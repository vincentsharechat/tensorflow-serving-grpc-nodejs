#!/usr/bin/env node
/**
 * ✅ Complete gRPC Client with SequenceExample Builder
 *
 * This example shows how to:
 * 1. Build a SequenceExample from feature data
 * 2. Serialize it to binary using protobufjs
 * 3. Send it to TensorFlow Serving using @grpc/grpc-js
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { buildSequenceExample, toHex } = require('./sequence-example-builder');

// ==================== CONFIGURATION ====================

const MODEL_NAME = 'dnb_model_baseline';
const SIGNATURE_NAME = 'serving_default';
const ENDPOINT = '100.68.113.134:9500';

// ==================== MAIN CODE ====================

async function makePredictionWithBuilder() {
  console.log('🚀 TensorFlow Serving gRPC Client with Builder\n');

  // ========== STEP 1: Define your feature data ==========
  const featureListsData = {
    "ad_type": ["SC_CPCV_1"],
    "adsuuid": ["0532afbb-3c85-4776-b5c6-d908a47c1441"],
    "ageRange": ["18-24"],
    "city": ["koppal"],
    "feed_fetch_counter": ["1"],
    "gender": ["F"],
    "language": ["tamil"],
    "osVersion": ["rest"],
    "phoneCarrier": ["ind airtel"],
    "phoneModel": ["oppo cph2681"],
    "sourceApp": ["SC"],
    "state": ["karnataka"],
    "time": ["2025-10-10 22:02:24"],
    "userid": ["749603295"]
  };

  console.log('📝 Feature lists:');
  console.log(JSON.stringify(featureListsData, null, 2));
  console.log('');

  // ========== STEP 2: Build and serialize SequenceExample ==========
  console.log('🔧 Building SequenceExample...');
  const serializedExample = buildSequenceExample(featureListsData);

  console.log(`✅ Serialized to ${serializedExample.length} bytes`);
  console.log(`🔤 Hex: ${toHex(serializedExample).substring(0, 60)}...`);
  console.log('');

  // ========== STEP 3: Load gRPC proto and create client ==========
  const PROTO_PATH = path.join(__dirname, 'proto/predict.proto');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'proto')]
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const PredictionService = protoDescriptor.tensorflow.serving.PredictionService;

  const client = new PredictionService(
    ENDPOINT,
    grpc.credentials.createInsecure()
  );

  // ========== STEP 4: Make prediction request ==========
  console.log('🎯 Model:', MODEL_NAME);
  console.log('📝 Signature:', SIGNATURE_NAME);
  console.log('🔗 Endpoint:', ENDPOINT);
  console.log('\n⏳ Making inference request...\n');

  const request = {
    model_spec: {
      name: MODEL_NAME,
      signature_name: SIGNATURE_NAME
    },
    inputs: {
      'examples': {
        dtype: 7,  // DT_STRING
        tensor_shape: {
          dim: [{ size: 1 }]
        },
        string_val: [serializedExample]
      }
    }
  };

  // Make the prediction
  client.Predict(request, { deadline: Date.now() + 10000 }, (error, response) => {
    if (error) {
      console.error('❌ Request failed:', error.code, error.message);
      console.error('   Details:', error.details);
      process.exit(1);
    }

    console.log('✅ SUCCESS!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MODEL PREDICTIONS\n');

    if (response.outputs) {
      const outputNames = Object.keys(response.outputs).sort();

      for (const outputName of outputNames) {
        const tensor = response.outputs[outputName];

        console.log(`  ${outputName}:`);

        if (tensor.float_val && tensor.float_val.length > 0) {
          const value = tensor.float_val[0];
          console.log(`    Value: ${value}`);
        }

        if (tensor.tensor_shape && tensor.tensor_shape.dim) {
          const shape = tensor.tensor_shape.dim.map(d => d.size).join(' × ');
          console.log(`    Shape: [${shape}]`);
        }

        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (response.model_spec) {
      console.log('\n📋 Model Info:');
      console.log(`  Name: ${response.model_spec.name}`);
      console.log(`  Signature: ${response.model_spec.signature_name}`);
      if (response.model_spec.version) {
        console.log(`  Version: ${response.model_spec.version.value}`);
      }
    }

    console.log('\n✨ Done!');
  });
}

// Run it
makePredictionWithBuilder().catch(console.error);
