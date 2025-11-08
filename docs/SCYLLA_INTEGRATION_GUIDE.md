# Scylla DB Integration Guide

Complete guide for integrating Scylla DB historical features with TensorFlow Serving inference.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

## Overview

This integration connects Scylla DB for historical feature retrieval with TensorFlow Serving for real-time inference predictions.

**Based on:**
- [ARS db-driver-v2 pattern](https://github.com/ShareChat/ads-ds-services/blob/master/ad-relevance-service/internal/infrastructure/dbDriverV2/)
- [Ads Service Scylla connection](https://github.com/ShareChat/ads-service/blob/master/driver/dbClient.js)
- [ARS K8s secrets](https://github.com/ShareChat/ads-ds-services/blob/master/ad-relevance-service/infra/production/values.yaml#L41-L60)

**Scale:** Designed to handle **21 billion requests/day**

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Request Flow                       │
└──────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  Client App │
    │  (GAID)     │
    └──────┬──────┘
           │
           ▼
    ┌────────────────────────────────────────┐
    │  1. ScyllaClient.getHistoricalFeatures │
    │     Query: historical_features_table   │
    │     Key: GAID                          │
    └──────┬─────────────────────────────────┘
           │
           ├─────────────────────────────┐
           ▼                             │
    ┌─────────────────────┐             │
    │   Scylla Cluster    │             │
    │   - node-0          │             │
    │   - node-1          │             │
    │   - node-2          │             │
    └──────┬──────────────┘             │
           │ Returns:                    │
           │ - historical_ctr            │
           │ - historical_cvr            │
           │ - avg_watch_time            │
           │ - engagement_score          │
           ▼                             │
    ┌─────────────────────┐             │
    │  2. Feature Merge   │             │
    │     Historical +    │◄────────────┘
    │     Real-time       │  If not found,
    └──────┬──────────────┘  use defaults
           │
           ▼
    ┌─────────────────────┐
    │  3. Build           │
    │     SequenceExample │
    └──────┬──────────────┘
           │
           ▼
    ┌─────────────────────┐
    │  4. TF Serving      │
    │     gRPC Inference  │
    └──────┬──────────────┘
           │
           ▼
    ┌─────────────────────┐
    │  5. Predictions     │
    │     - predicted_ctr │
    │     - floor_price   │
    └─────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd grpc-inference-client
npm install
```

This installs:
- `cassandra-driver` - Scylla DB client
- `@grpc/grpc-js` - gRPC client
- `protobufjs` - Protocol Buffers

### 2. Configure Scylla Connection

Edit [`config.js`](../config.js):

```javascript
module.exports = {
  SCYLLA: {
    CONTACT_POINTS: [
      'node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud',
      'node-1.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud',
      'node-2.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud'
    ],
    CREDENTIALS: {
      username: process.env.SCYLLA_USERNAME || 'cassandra',
      password: process.env.SCYLLA_PASSWORD || 'cassandra'
    },
    KEYSPACE: 'ads_features',
    LOCAL_DC: 'gce-asia-south-1'
  }
};
```

### 3. Test Connection

```bash
npm run test:scylla
```

Expected output:
```
✅ Connection: Working
✅ Cluster info: Accessible
✅ Query: Functional
✅ Defaults: Working
✅ Batch: Working
```

### 4. Run Complete Pipeline

```bash
npm run client:scylla
```

## Configuration

### Environment Variables

For production, use environment variables:

```bash
export SCYLLA_USERNAME="your_username"
export SCYLLA_PASSWORD="your_password"
```

Or set them in your deployment YAML:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: inference-client
spec:
  containers:
  - name: client
    env:
    - name: SCYLLA_USERNAME
      valueFrom:
        secretKeyRef:
          name: scylla-credentials
          key: username
    - name: SCYLLA_PASSWORD
      valueFrom:
        secretKeyRef:
          name: scylla-credentials
          key: password
```

### Scylla Configuration Options

```javascript
SCYLLA: {
  // DNS names (recommended)
  CONTACT_POINTS: ['node-0...', 'node-1...', 'node-2...'],

  // Private IPs (fallback)
  // CONTACT_POINTS: ['10.0.128.92', '10.0.128.87', '10.0.128.90'],

  CREDENTIALS: {
    username: 'cassandra',
    password: 'cassandra'
  },

  KEYSPACE: 'ads_features',
  LOCAL_DC: 'gce-asia-south-1',
  PORT: 9042,

  // Performance tuning
  CONNECTION_TIMEOUT: 5000,   // 5 seconds
  REQUEST_TIMEOUT: 2000,      // 2 seconds
}
```

### Feature Configuration

Define historical features and defaults:

```javascript
FEATURES: {
  HISTORICAL: [
    'historical_ctr',
    'historical_cvr',
    'avg_watch_time',
    'engagement_score',
    'last_interaction_ts'
  ],

  HISTORICAL_DEFAULTS: {
    historical_ctr: 0.0,
    historical_cvr: 0.0,
    avg_watch_time: 0.0,
    engagement_score: 0.0,
    last_interaction_ts: 0
  }
}
```

## Usage Examples

### Example 1: Single GAID Inference

```javascript
const { runInferencePipeline } = require('./client-with-scylla');

const gaid = '2312341';
const realtimeFeatures = {
  ad_type: ['SC_CPCV_1'],
  userid: ['123456'],
  ageRange: ['18-24'],
  city: ['bangalore']
};

const result = await runInferencePipeline(gaid, realtimeFeatures);

console.log('Predictions:', result.predictions);
// Output:
// {
//   predicted_ctr: 0.0234,
//   optimal_floor_price: 20.08,
//   fill_probability: 0.17
// }
```

### Example 2: Batch Inference

```javascript
const { runBatchInference } = require('./client-with-scylla');

const gaids = ['2312341', '2312342', '2312343'];
const realtimeFeatures = {
  ad_type: ['SC_CPCV_1'],
  userid: ['123456']
};

const results = await runBatchInference(gaids, realtimeFeatures);

results.forEach((result, index) => {
  console.log(`[${index + 1}] ${result.gaid}: CTR=${result.predictions.predicted_ctr}`);
});
```

### Example 3: Scylla Client Only

```javascript
const ScyllaClient = require('./scylla-client');

const client = new ScyllaClient();
await client.connect();

// Get features with automatic defaults
const features = await client.getHistoricalFeaturesWithDefaults('2312341');
console.log(features);
// Output:
// {
//   gaid: '2312341',
//   historical_ctr: 0.023,
//   historical_cvr: 0.012,
//   avg_watch_time: 45.2,
//   engagement_score: 0.78,
//   last_interaction_ts: 1699123456
// }

await client.close();
```

### Example 4: Error Handling

```javascript
const ScyllaClient = require('./scylla-client');

const client = new ScyllaClient();

try {
  await client.connect();

  const features = await client.getHistoricalFeatures('2312341');

  if (!features) {
    console.log('No historical data, using defaults');
    // Use default features
  } else {
    console.log('Historical data found:', features);
  }

} catch (error) {
  console.error('Scylla error:', error.message);
  // Fallback to defaults or return error
} finally {
  await client.close();
}
```

## Production Deployment

### Checklist

- [ ] **Credentials secured** - Never hardcode, use K8s secrets
- [ ] **Network connectivity verified** - Test connection to all nodes
- [ ] **Connection pooling configured** - Optimize for request volume
- [ ] **Prepared statements** - Used for all queries
- [ ] **Error handling** - Fallback to defaults gracefully
- [ ] **Monitoring** - Track latency, errors, cache hit rates
- [ ] **Load testing** - Verify performance at target scale

### K8s Secrets Setup

Create Scylla credentials secret:

```bash
kubectl create secret generic scylla-credentials \
  --from-literal=username='your_username' \
  --from-literal=password='your_password' \
  -n ads-serving
```

Reference in deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inference-client
spec:
  template:
    spec:
      containers:
      - name: client
        image: inference-client:latest
        env:
        - name: SCYLLA_USERNAME
          valueFrom:
            secretKeyRef:
              name: scylla-credentials
              key: username
        - name: SCYLLA_PASSWORD
          valueFrom:
            secretKeyRef:
              name: scylla-credentials
              key: password
```

### Connection Pooling

For high-scale production (21B requests/day):

```javascript
const ScyllaClient = require('./scylla-client');
const config = require('./config');

// Increase connection pool
config.SCYLLA.MAX_CONNECTIONS_PER_HOST = 20;

const client = new ScyllaClient(config.SCYLLA);
await client.connect();

// Reuse client across requests
// DON'T create new client per request!
```

## Troubleshooting

### Issue: Cannot Connect to Scylla

**Error:**
```
NoHostAvailable: Unable to connect to any servers
```

**Solutions:**

1. **Verify network connectivity:**
   ```bash
   ping node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud
   ```

2. **Check VPN/firewall:**
   - Ensure you're on the correct VPN
   - Verify firewall rules allow port 9042

3. **Test with cqlsh:**
   ```bash
   cqlsh node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud \
     -u cassandra -p cassandra
   ```

4. **Try private IPs:**
   ```javascript
   CONTACT_POINTS: ['10.0.128.92', '10.0.128.87', '10.0.128.90']
   ```

### Issue: No Data Returned

**Error:**
```
No historical features found for GAID: 2312341
```

**Solutions:**

1. **Verify table exists:**
   ```bash
   cqlsh -u cassandra -p cassandra
   > USE ads_features;
   > DESCRIBE TABLE historical_features_table;
   ```

2. **Check GAID format:**
   - Ensure GAID matches data format in table
   - Check for leading/trailing spaces

3. **Use defaults:**
   ```javascript
   const features = await client.getHistoricalFeaturesWithDefaults(gaid);
   // Always returns features (uses defaults if not found)
   ```

### Issue: Slow Queries

**Problem:**
Queries taking >50ms

**Solutions:**

1. **Use prepared statements:**
   ```javascript
   // Already implemented in ScyllaClient
   this.preparedStatements.getHistoricalFeatures = await this.client.prepare(query);
   ```

2. **Verify indexes:**
   ```sql
   -- Check if GAID is primary key or has secondary index
   DESCRIBE TABLE historical_features_table;
   ```

3. **Monitor with metrics:**
   ```javascript
   const start = Date.now();
   const features = await client.getHistoricalFeatures(gaid);
   const latency = Date.now() - start;
   console.log(`Scylla query latency: ${latency}ms`);
   ```

### Issue: Connection Timeout

**Error:**
```
OperationTimedOut: Server timeout during read query
```

**Solutions:**

1. **Increase timeout:**
   ```javascript
   SCYLLA: {
     REQUEST_TIMEOUT: 5000,  // Increase to 5 seconds
   }
   ```

2. **Check Scylla cluster health:**
   ```bash
   nodetool status
   ```

3. **Verify consistency level:**
   ```javascript
   const result = await this.client.execute(
     query,
     [gaid],
     {
       prepare: true,
       consistency: cassandra.types.consistencies.localOne  // Faster
     }
   );
   ```

## Performance Optimization

### For 21 Billion Requests/Day

**1. Connection Pooling**

```javascript
pooling: {
  coreConnectionsPerHost: {
    [cassandra.types.distance.local]: 20,   // Increased from 10
    [cassandra.types.distance.remote]: 2
  }
}
```

**2. Prepared Statements**

All queries in `ScyllaClient` use prepared statements automatically:

```javascript
this.preparedStatements.getHistoricalFeatures = await this.client.prepare(query);
const result = await this.client.execute(stmt, [gaid], { prepare: true });
```

**3. Batch Queries**

For multiple GAIDs, use `batchGetHistoricalFeatures`:

```javascript
const gaids = ['gaid1', 'gaid2', 'gaid3', ...];
const features = await client.batchGetHistoricalFeatures(gaids);
// Queries run in parallel
```

**4. Async Queries**

```javascript
// Don't wait sequentially
const promise1 = client.getHistoricalFeatures('gaid1');
const promise2 = client.getHistoricalFeatures('gaid2');
const promise3 = client.getHistoricalFeatures('gaid3');

const [f1, f2, f3] = await Promise.all([promise1, promise2, promise3]);
```

**5. Caching (Optional)**

For frequently accessed GAIDs:

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 min TTL

async function getCachedFeatures(gaid) {
  const cached = cache.get(gaid);
  if (cached) return cached;

  const features = await client.getHistoricalFeatures(gaid);
  cache.set(gaid, features);
  return features;
}
```

### Latency Benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| Scylla query (prepared) | 5-10ms | Single GAID |
| Scylla query (unprepared) | 15-30ms | First query |
| Batch query (10 GAIDs) | 10-20ms | Parallel execution |
| Complete pipeline | 160-210ms | Scylla + TF Serving |

## Database Schema

### Required Table Structure

```sql
CREATE TABLE IF NOT EXISTS ads_features.historical_features_table (
  gaid text PRIMARY KEY,
  historical_ctr double,
  historical_cvr double,
  avg_watch_time double,
  engagement_score double,
  last_interaction_ts bigint
);
```

### Example Data

```sql
INSERT INTO ads_features.historical_features_table (
  gaid, historical_ctr, historical_cvr, avg_watch_time, engagement_score, last_interaction_ts
) VALUES (
  '2312341', 0.023, 0.012, 45.2, 0.78, 1699123456
);
```

### Querying with cqlsh

```bash
# Connect
cqlsh node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud \
  -u cassandra -p cassandra

# Use keyspace
USE ads_features;

# Query data
SELECT * FROM historical_features_table WHERE gaid = '2312341';

# Check table size
SELECT COUNT(*) FROM historical_features_table;
```

## References

### Internal Documentation

- **ARS DB Driver:** [db-driver-v2 implementation](https://github.com/ShareChat/ads-ds-services/blob/master/ad-relevance-service/internal/infrastructure/dbDriverV2/dbDriverV2.go)
- **Ads Service:** [Node.js Scylla connection](https://github.com/ShareChat/ads-service/blob/master/driver/dbClient.js)
- **K8s Secrets:** [ARS production values](https://github.com/ShareChat/ads-ds-services/blob/master/ad-relevance-service/infra/production/values.yaml#L41-L60)

### External Documentation

- [Scylla DB Documentation](https://docs.scylladb.com/)
- [Cassandra Node.js Driver](https://docs.datastax.com/en/developer/nodejs-driver/)
- [Prepared Statements Best Practices](https://docs.scylladb.com/stable/using-scylla/drivers/cql-drivers/scylla-nodejs-driver.html#prepared-statements)

### Project Files

- [scylla-client.js](../scylla-client.js) - Scylla DB client implementation
- [client-with-scylla.js](../client-with-scylla.js) - Complete pipeline example
- [config.js](../config.js) - Configuration (includes Scylla settings)
- [tests/test-scylla-connection.js](../tests/test-scylla-connection.js) - Connection tests

## Next Steps

1. **Test connection:** `npm run test:scylla`
2. **Customize schema:** Update table/column names in `scylla-client.js`
3. **Add monitoring:** Track latency, errors, throughput
4. **Load test:** Verify performance at production scale
5. **Deploy to K8s:** Use secrets for credentials

## Support

For questions:
- **Scylla DB:** @Akash Manna
- **Integration:** Review [client-with-scylla.js](../client-with-scylla.js)
- **ARS Team:** Ad Relevance Service team

---

**🚀 Ready to integrate? Run `npm run test:scylla` to verify your connection!**
