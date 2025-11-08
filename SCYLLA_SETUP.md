# Scylla DB Setup Guide

## ✅ Connection Successful!

Your Scylla integration is working! The test successfully connected to the cluster:

- **Cluster:** sharechat-ad-relevance-service-prod-in
- **Version:** Scylla 3.0.8
- **Nodes:** 3 nodes in `GCE_ASIA_SOUTH_1`

## 📋 Available Keyspaces

The following keyspaces are available in your cluster:

- `ars_feature_store` - ⭐ **Likely candidate for historical features**
- `ad_relevance_service` - ARS main keyspace
- `ars_attributes_store` - User attributes
- `ars_campaign_creative` - Campaign data
- `ars_auction` - Auction data
- `ars_recsys` - Recommendation system
- `ars_pacing` - Pacing data
- `ars_lookalike_exp` - Lookalike experiments
- `ars_dmp_exp` - DMP experiments
- `ads_pacing` - Ads pacing
- `audit` - Audit logs
- `keyspace1` - Test keyspace
- (plus system keyspaces)

## 🔧 Next Steps

### 1. Update Config with Correct Keyspace

Edit [`config.js`](config.js) line 21:

```javascript
SCYLLA: {
  // ...
  KEYSPACE: 'ars_feature_store',  // ⬅️ Update this based on your actual keyspace
  // ...
}
```

### 2. Find Your Historical Features Table

Connect with cqlsh to explore:

```bash
# Connect to Scylla
cqlsh node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud \
  -u cassandra -p cassandra

# Use the keyspace
USE ars_feature_store;

# List tables
DESCRIBE TABLES;

# Examine table structure
DESCRIBE TABLE <your_table_name>;
```

### 3. Update ScyllaClient with Your Schema

Edit [`scylla-client.js`](scylla-client.js) line 87:

```javascript
async prepareStatements() {
  this.preparedStatements.getHistoricalFeatures = await this.client.prepare(`
    SELECT
      gaid,                    // ⬅️ Update column names
      historical_ctr,          // ⬅️ to match your schema
      historical_cvr,
      avg_watch_time,
      engagement_score,
      last_interaction_ts
    FROM your_actual_table_name   // ⬅️ Update table name
    WHERE gaid = ?
  `);
}
```

### 4. Update Feature Defaults

Edit [`config.js`](config.js) lines 61-78 to match your features:

```javascript
FEATURES: {
  HISTORICAL: [
    'historical_ctr',      // ⬅️ List your actual features
    'historical_cvr',
    'avg_watch_time',
    'engagement_score',
    'last_interaction_ts'
  ],

  HISTORICAL_DEFAULTS: {
    historical_ctr: 0.0,   // ⬅️ Update default values
    historical_cvr: 0.0,
    avg_watch_time: 0.0,
    engagement_score: 0.0,
    last_interaction_ts: 0
  }
}
```

### 5. Test Again

```bash
npm run test:scylla
```

## 🔍 Explore Your Schema

### Option 1: Using cqlsh (Interactive)

```bash
# Connect
cqlsh node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud \
  -u cassandra -p cassandra

# Explore
cqlsh> USE ars_feature_store;
cqlsh:ars_feature_store> DESCRIBE TABLES;
cqlsh:ars_feature_store> SELECT * FROM <table_name> LIMIT 5;
```

### Option 2: Using the ScyllaClient

Create a script to explore:

```javascript
const ScyllaClient = require('./scylla-client');
const config = require('./config');

async function explore() {
  // Update to correct keyspace
  config.SCYLLA.KEYSPACE = 'ars_feature_store';

  const client = new ScyllaClient(config.SCYLLA);
  await client.connect();

  // List all tables
  const result = await client.client.execute(`
    SELECT table_name FROM system_schema.tables
    WHERE keyspace_name = 'ars_feature_store'
  `);

  console.log('Available tables:');
  result.rows.forEach(row => {
    console.log(`  - ${row.table_name}`);
  });

  await client.close();
}

explore();
```

## 📖 Example: Adapting to Your Schema

Let's say you found a table `user_historical_features` with columns:
- `user_id` (primary key)
- `ctr_7d` (7-day CTR)
- `cvr_7d` (7-day CVR)
- `avg_session_time`
- `engagement_rate`

Update the code:

**config.js:**
```javascript
SCYLLA: {
  KEYSPACE: 'ars_feature_store',
},
FEATURES: {
  HISTORICAL: [
    'ctr_7d',
    'cvr_7d',
    'avg_session_time',
    'engagement_rate'
  ],
  HISTORICAL_DEFAULTS: {
    ctr_7d: 0.0,
    cvr_7d: 0.0,
    avg_session_time: 0.0,
    engagement_rate: 0.0
  }
}
```

**scylla-client.js (prepareStatements method):**
```javascript
this.preparedStatements.getHistoricalFeatures = await this.client.prepare(`
  SELECT
    user_id,
    ctr_7d,
    cvr_7d,
    avg_session_time,
    engagement_rate
  FROM user_historical_features
  WHERE user_id = ?
`);
```

**scylla-client.js (getHistoricalFeatures method):**
```javascript
return {
  user_id: row.user_id,
  ctr_7d: row.ctr_7d || config.FEATURES.HISTORICAL_DEFAULTS.ctr_7d,
  cvr_7d: row.cvr_7d || config.FEATURES.HISTORICAL_DEFAULTS.cvr_7d,
  avg_session_time: row.avg_session_time || config.FEATURES.HISTORICAL_DEFAULTS.avg_session_time,
  engagement_rate: row.engagement_rate || config.FEATURES.HISTORICAL_DEFAULTS.engagement_rate
};
```

## ✅ Current Status

- ✅ Scylla connection: **Working**
- ✅ Data center config: **Fixed** (GCE_ASIA_SOUTH_1)
- ✅ Cluster access: **Verified**
- ✅ Error handling: **Working** (falls back to defaults)
- ⏳ Keyspace: **Needs configuration**
- ⏳ Table schema: **Needs configuration**

## 🆘 Need Help?

1. **Contact:** @Akash Manna for Scylla schema details
2. **Documentation:** [docs/SCYLLA_INTEGRATION_GUIDE.md](docs/SCYLLA_INTEGRATION_GUIDE.md)
3. **ARS Reference:** Check existing ARS code for table/column names

## 🚀 Once Configured

After updating the keyspace and schema, you can use:

```bash
# Test Scylla connection
npm run test:scylla

# Run complete pipeline (Scylla + Inference)
npm run client:scylla
```

Example usage:

```javascript
const { runInferencePipeline } = require('./client-with-scylla');

const result = await runInferencePipeline(
  'user_gaid_123',  // Your GAID/user_id
  {
    ad_type: ['SC_CPCV_1'],
    userid: ['123456'],
    ageRange: ['18-24']
  }
);

console.log('Predictions:', result.predictions);
```

---

**Next:** Update `config.js` with your actual keyspace name and re-run `npm run test:scylla`
