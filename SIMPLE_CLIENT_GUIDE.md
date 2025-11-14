# Simple Scylla + Inference Client - Quick Start Guide

## Overview

The `simple-scylla-client.js` provides a streamlined interface to:
1. Fetch historical features from Scylla DB
2. Make inference predictions via TensorFlow Serving
3. Handle both single and batch requests

## Quick Start

### 1. Basic Usage

```javascript
const SimpleInferenceClient = require('./simple-scylla-client');

const client = new SimpleInferenceClient({ verbose: true });

// Initialize connection
await client.initialize();

// Make a prediction
const result = await client.predict(
  '123456',      // userid
  'SC_CPCV_1',   // adType
  'SC',          // sourceApp
  {
    // Optional real-time features
    campaign_id: ['789']
  }
);

console.log(result.predictions);

// Close when done
await client.close();
```

### 2. Run Tests

```bash
cd ~/grpc-inference-client

# Test single prediction (default)
node test-simple-client.js

# Test batch predictions
node test-simple-client.js batch

# Test Scylla connection only (no inference)
node test-simple-client.js scylla

# Run all tests
node test-simple-client.js all
```

## API Reference

### Constructor

```javascript
new SimpleInferenceClient(options)
```

**Options:**
- `verbose` (boolean): Enable detailed logging (default: false)
- `scyllaConfig` (object): Override Scylla configuration (optional)
- `modelConfig` (object): Override model configuration (optional)

### Methods

#### `initialize()`
Initialize Scylla connection and load protobuf definitions.

```javascript
await client.initialize();
```

#### `predict(userid, adType, sourceApp, realtimeFeatures)`
Make a single prediction.

**Parameters:**
- `userid` (string): User ID
- `adType` (string): Ad type (e.g., 'SC_CPCV_1', 'SC_CPC_1')
- `sourceApp` (string): Source app ('SC' for ShareChat, 'MJ' for Moj)
- `realtimeFeatures` (object): Additional real-time features (optional)

**Returns:**
```javascript
{
  userid: '123456',
  adType: 'SC_CPCV_1',
  sourceApp: 'SC',
  historicalFeatures: {
    requests_1_day: 10,
    responses_1_day: 5,
    winrate_1_day: 0.5,
    floor_price_avg_1_day: 2.5,
    winning_bid_avg_1_day: 3.2,
    // ... all 18 features
  },
  predictions: {
    predicted_ctr: 0.0234,
    predicted_cvr: 0.0056,
    // ... model outputs
  }
}
```

#### `batchPredict(requests, realtimeFeatures)`
Make batch predictions.

**Parameters:**
- `requests` (array): Array of `{userid, adType, sourceApp}` objects
- `realtimeFeatures` (object): Shared real-time features (optional)

**Returns:** Array of prediction results

**Example:**
```javascript
const results = await client.batchPredict(
  [
    { userid: '123', adType: 'SC_CPCV_1', sourceApp: 'SC' },
    { userid: '456', adType: 'SC_CPC_1', sourceApp: 'MJ' }
  ],
  { campaign_id: ['789'] }
);
```

#### `getHistoricalFeatures(userid, adType, sourceApp)`
Fetch only historical features (no inference).

```javascript
const features = await client.getHistoricalFeatures('123456', 'SC_CPCV_1', 'SC');
```

#### `close()`
Close all connections.

```javascript
await client.close();
```

## Historical Features

The client fetches **18 features** from Scylla:

### 1-Day Features (9 features)
- `requests_1_day`: Request count
- `responses_1_day`: Response count
- `floor_price_sum_1_day`: Sum of floor prices
- `floor_price_max_1_day`: Max floor price
- `winning_bid_sum_1_day`: Sum of winning bids
- `winning_bid_max_1_day`: Max winning bid
- `winrate_1_day`: Response rate (responses/requests)
- `floor_price_avg_1_day`: Average floor price
- `winning_bid_avg_1_day`: Average winning bid

### 7-Day Features (9 features)
Same as 1-day but aggregated over 7 days.

### Key Format
Scylla key: `userid|adType|sourceApp`

Example: `123456|SC_CPCV_1|SC`

## Configuration

Edit [config.js](config.js) to update:

### Scylla Settings
```javascript
SCYLLA: {
  CONTACT_POINTS: ['node-0.scylla.cloud', ...],
  CREDENTIALS: { username: 'user', password: 'pass' },
  KEYSPACE: 'ars_feature_store',
  LOCAL_DC: 'GCE_ASIA_SOUTH_1',
  PORT: 9042
}
```

### Model Settings
```javascript
MODELS: {
  BASELINE: {
    name: 'dnb_model_baseline',
    signature: 'serving_default',
    path: 'ADS_LST_DNB_BASELINE'
  }
}
```

## Troubleshooting

### Connection Issues
```bash
# Test Scylla connection only
node test-simple-client.js scylla
```

### Feature Not Found
If Scylla returns no features, the client returns **default values** (all zeros) to prevent inference failures.

### Inference Errors
Check:
1. TLS certificate at `ingress.crt`
2. Model path in config matches ingress routing
3. Feature names match model's expected inputs

## Examples

### Example 1: Single User Prediction
```javascript
const client = new SimpleInferenceClient({ verbose: true });
await client.initialize();

const result = await client.predict('123456', 'SC_CPCV_1', 'SC');
console.log('Predicted CTR:', result.predictions.predicted_ctr);

await client.close();
```

### Example 2: Batch with Real-time Features
```javascript
const client = new SimpleInferenceClient();
await client.initialize();

const results = await client.batchPredict(
  [
    { userid: 'user1', adType: 'SC_CPCV_1', sourceApp: 'SC' },
    { userid: 'user2', adType: 'SC_CPCV_1', sourceApp: 'SC' }
  ],
  {
    campaign_id: ['campaign_123'],
    creative_id: ['creative_456'],
    time_of_day: ['afternoon']
  }
);

results.forEach(r => {
  console.log(`${r.userid}: ${r.predictions.predicted_ctr}`);
});

await client.close();
```

### Example 3: Use Different Model
```javascript
const config = require('./config');

const client = new SimpleInferenceClient({
  modelConfig: config.MODELS.AGGRESSIVE,
  verbose: true
});

await client.initialize();
const result = await client.predict('123456', 'SC_CPCV_1', 'SC');

await client.close();
```

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌──────────┐   ┌──────────────┐
│  Scylla  │   │  TF Serving  │
│   DB     │   │   (gRPC)     │
└──────────┘   └──────────────┘
       │             │
       └──────┬──────┘
              ▼
      ┌──────────────┐
      │  Predictions │
      └──────────────┘
```

## Next Steps

1. Update `userid`, `adType`, `sourceApp` in test file
2. Run `node test-simple-client.js scylla` to verify Scylla connection
3. Run `node test-simple-client.js single` for full prediction
4. Integrate into your application
