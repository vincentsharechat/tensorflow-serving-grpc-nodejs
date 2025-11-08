#!/usr/bin/env node
/**
 * Complete Inference Pipeline with Scylla DB Integration
 *
 * This client demonstrates the full pipeline:
 * 1. Fetch historical features from Scylla DB
 * 2. Combine with real-time features
 * 3. Make inference prediction via TensorFlow Serving
 *
 * Architecture:
 * Scylla DB (historical) → Feature Merge → TF Serving (inference) → Predictions
 *
 * Based on:
 * - ARS db-driver-v2 pattern for Scylla
 * - holmes-ads-v2 ingress for TF Serving
 */

const ScyllaClient = require('./scylla-client');
const { buildSequenceExample, toHex } = require('./sequence-example-builder');
const config = require('./config');
const grpc = require('@grpc/grpc-js');
const protobuf = require('protobufjs');
const path = require('path');
const fs = require('fs');

/**
 * Make inference request to TensorFlow Serving
 */
async function makeInferenceRequest(serializedExample, modelConfig) {
  const {
    modelName,
    signatureName = config.DEFAULTS.SIGNATURE,
    modelPath
  } = modelConfig;

  const ingressHost = config.INGRESS.HOST;
  const port = config.INGRESS.PORT;
  const caCertPath = config.INGRESS.CERT_PATH;

  console.log('📡 Making inference request...');
  console.log(`  Model: ${modelName}`);
  console.log(`  Path: ${modelPath}`);

  // Load Protocol Buffer definitions
  const root = protobuf.loadSync([
    path.join(__dirname, 'proto/predict.proto'),
    path.join(__dirname, 'proto/tensor.proto')
  ]);

  const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
  const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

  // Setup TLS credentials
  let credentials;
  if (fs.existsSync(caCertPath)) {
    const certContent = fs.readFileSync(caCertPath);
    credentials = grpc.credentials.createSsl(certContent);
    console.log('  Using TLS');
  } else {
    console.log('  ⚠️  Certificate not found, using default SSL');
    credentials = grpc.credentials.createSsl();
  }

  // Create gRPC client
  const target = `${ingressHost}:${port}`;
  const client = new grpc.Client(target, credentials, {
    'grpc.max_send_message_length': 100 * 1024 * 1024,
    'grpc.max_receive_message_length': 100 * 1024 * 1024,
  });

  // Build request
  const request = {
    model_spec: {
      name: modelName,
      signature_name: signatureName
    },
    inputs: {
      examples: {
        dtype: config.DEFAULTS.DTYPE_STRING,
        tensor_shape: { dim: [{ size: 1 }] },
        string_val: [serializedExample]
      }
    }
  };

  // Serialize request
  const requestBuffer = PredictRequest.encode(request).finish();

  // Custom method path for ingress routing
  const methodPath = `/${modelPath}/tensorflow.serving.PredictionService/Predict`;

  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 2); // 2 second timeout

    client.makeUnaryRequest(
      methodPath,
      (arg) => arg,
      (arg) => arg,
      requestBuffer,
      null,
      { deadline },
      (error, responseBuffer) => {
        client.close();

        if (error) {
          reject(error);
          return;
        }

        try {
          const response = PredictResponse.decode(responseBuffer);
          resolve(response);
        } catch (decodeError) {
          reject(decodeError);
        }
      }
    );
  });
}

/**
 * Extract prediction values from TF Serving response
 */
function extractPredictions(response) {
  const predictions = {};

  for (const [outputName, tensor] of Object.entries(response.outputs)) {
    if (tensor.float_val && tensor.float_val.length > 0) {
      predictions[outputName] = tensor.float_val[0];
    }
  }

  return predictions;
}

/**
 * Complete inference pipeline
 */
async function runInferencePipeline(gaid, realtimeFeatures = {}) {
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 Complete Inference Pipeline with Scylla DB');
  console.log('═══════════════════════════════════════════════════\n');

  const scyllaClient = new ScyllaClient();

  try {
    // ==================== STEP 1: Connect to Scylla ====================
    console.log('📊 STEP 1: Fetching Historical Features from Scylla DB');
    console.log('─────────────────────────────────────────────────\n');

    await scyllaClient.connect();

    // Test connection
    await scyllaClient.testConnection();
    console.log('');

    // Fetch historical features
    console.log(`🔍 Querying GAID: ${gaid}`);
    const historicalFeatures = await scyllaClient.getHistoricalFeaturesWithDefaults(gaid);

    console.log('✅ Historical features retrieved:');
    console.log(`  historical_ctr: ${historicalFeatures.historical_ctr}`);
    console.log(`  historical_cvr: ${historicalFeatures.historical_cvr}`);
    console.log(`  avg_watch_time: ${historicalFeatures.avg_watch_time}`);
    console.log(`  engagement_score: ${historicalFeatures.engagement_score}`);
    console.log('');

    // ==================== STEP 2: Merge Features ====================
    console.log('🔗 STEP 2: Merging Historical + Real-time Features');
    console.log('─────────────────────────────────────────────────\n');

    // Combine historical features with real-time features
    const combinedFeatures = {
      // Historical features from Scylla
      gaid: [gaid],
      historical_ctr: [historicalFeatures.historical_ctr.toString()],
      historical_cvr: [historicalFeatures.historical_cvr.toString()],
      avg_watch_time: [historicalFeatures.avg_watch_time.toString()],
      engagement_score: [historicalFeatures.engagement_score.toString()],

      // Real-time features (from request context)
      ...realtimeFeatures
    };

    console.log('✅ Combined features prepared');
    console.log(`  Total feature count: ${Object.keys(combinedFeatures).length}`);
    console.log('');

    // ==================== STEP 3: Build SequenceExample ====================
    console.log('📦 STEP 3: Building SequenceExample');
    console.log('─────────────────────────────────────────────────\n');

    const serializedExample = buildSequenceExample(combinedFeatures);
    console.log(`✅ SequenceExample serialized (${serializedExample.length} bytes)`);
    console.log(`  Hex preview: ${toHex(serializedExample).substring(0, 64)}...`);
    console.log('');

    // ==================== STEP 4: Make Inference ====================
    console.log('🎯 STEP 4: Making Inference Request');
    console.log('─────────────────────────────────────────────────\n');

    const modelConfig = config.MODELS.BASELINE;
    const response = await makeInferenceRequest(serializedExample, modelConfig);

    console.log('✅ Inference completed successfully');
    console.log('');

    // ==================== STEP 5: Extract Predictions ====================
    console.log('📊 STEP 5: Extracting Predictions');
    console.log('─────────────────────────────────────────────────\n');

    const predictions = extractPredictions(response);

    console.log('✅ Predictions:');
    for (const [name, value] of Object.entries(predictions)) {
      console.log(`  ${name}: ${value.toFixed(6)}`);
    }
    console.log('');

    // Model version info
    if (response.model_spec && response.model_spec.version) {
      console.log(`📌 Model version: ${response.model_spec.version.value}`);
      console.log('');
    }

    // ==================== Summary ====================
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Pipeline Completed Successfully');
    console.log('═══════════════════════════════════════════════════');

    return {
      gaid,
      historicalFeatures,
      predictions,
      modelVersion: response.model_spec?.version?.value
    };

  } catch (error) {
    console.error('❌ Pipeline error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  } finally {
    await scyllaClient.close();
  }
}

/**
 * Batch inference for multiple GAIDs
 */
async function runBatchInference(gaids, realtimeFeatures = {}) {
  console.log('═══════════════════════════════════════════════════');
  console.log(`🚀 Batch Inference Pipeline (${gaids.length} GAIDs)`);
  console.log('═══════════════════════════════════════════════════\n');

  const scyllaClient = new ScyllaClient();

  try {
    await scyllaClient.connect();

    // Batch fetch historical features
    console.log('📊 Fetching historical features for all GAIDs...');
    const historicalFeaturesArray = await scyllaClient.batchGetHistoricalFeatures(gaids);
    console.log(`✅ Retrieved features for ${historicalFeaturesArray.length} GAIDs\n`);

    // Process each GAID
    const results = [];
    for (let i = 0; i < gaids.length; i++) {
      const gaid = gaids[i];
      const historicalFeatures = historicalFeaturesArray[i];

      console.log(`[${i + 1}/${gaids.length}] Processing GAID: ${gaid}`);

      // Combine features
      const combinedFeatures = {
        gaid: [gaid],
        historical_ctr: [historicalFeatures.historical_ctr.toString()],
        historical_cvr: [historicalFeatures.historical_cvr.toString()],
        avg_watch_time: [historicalFeatures.avg_watch_time.toString()],
        engagement_score: [historicalFeatures.engagement_score.toString()],
        ...realtimeFeatures
      };

      // Build and make inference
      const serializedExample = buildSequenceExample(combinedFeatures);
      const response = await makeInferenceRequest(serializedExample, config.MODELS.BASELINE);
      const predictions = extractPredictions(response);

      results.push({
        gaid,
        historicalFeatures,
        predictions
      });

      console.log(`  Predicted CTR: ${predictions.predicted_ctr?.toFixed(4) || 'N/A'}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Batch Pipeline Completed');
    console.log('═══════════════════════════════════════════════════');

    return results;

  } catch (error) {
    console.error('❌ Batch pipeline error:', error.message);
    throw error;
  } finally {
    await scyllaClient.close();
  }
}

// ==================== Main Execution ====================

if (require.main === module) {
  // Example 1: Single GAID inference
  const exampleGaid = '2312341';
  const exampleRealtimeFeatures = {
    ad_type: ['SC_CPCV_1'],
    userid: ['123456'],
    ageRange: ['18-24'],
    city: ['bangalore']
  };

  runInferencePipeline(exampleGaid, exampleRealtimeFeatures)
    .then(result => {
      console.log('\n📈 Final Result:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });

  // Example 2: Batch inference (uncomment to use)
  /*
  const exampleGaids = ['2312341', '2312342', '2312343'];
  runBatchInference(exampleGaids, exampleRealtimeFeatures)
    .then(results => {
      console.log('\n📈 Batch Results:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
  */
}

module.exports = {
  runInferencePipeline,
  runBatchInference,
  makeInferenceRequest,
  extractPredictions
};
