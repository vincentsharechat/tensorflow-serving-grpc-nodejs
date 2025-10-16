#!/usr/bin/env node
/**
 * ✅ WORKING gRPC Inference Client for TensorFlow Serving
 *
 * This client successfully makes predictions using:
 * - Correct proto field numbers (signature_name=3, outputs=1)
 * - @grpc/proto-loader for proper Google protobuf compatibility
 * - Direct pod connection to TensorFlow Serving
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// ==================== CONFIGURATION ====================

// Your serialized SequenceExample from Python
// Get this by running: print(serialized_example.hex())
const SERIALIZED_EXAMPLE_HEX = "12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e74657212070a050a030a01320a170a096f7356657273696f6e120a0a080a060a04726573740a150a09736f7572636541707012080a060a040a0253430a190a046369747912110a0f0a0d0a0b63686974726164757267610a1a0a0675736572696412100a0e0a0c0a0a323534353236343837320a250a0a70686f6e654d6f64656c12170a150a130a117869616f6d6920323230343132313970690a1e0a0c70686f6e6543617272696572120e0a0c0a0a0a08766920696e6469610a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a086c616e6775616765120b0a090a070a0574616d696c0a190a0b77696e6e696e675f626964120a0a0812060a04000000000a170a0861676552616e6765120b0a090a070a0531382d32340a210a0474696d6512190a170a150a13323032352d31302d31302030393a32313a33340a190a0b666c6f6f725f7072696365120a0a0812060a040000a0400a1d0a0761645f7479706512120a100a0e0a0c53435f4f555453545245414d0a110a0667656e64657212070a050a030a01460a350a0761647375756964122a0a280a260a2465356332663339342d303233652d343338332d393264302d623238663137633130653465";

const MODEL_NAME = 'dnb_model_baseline';
const SIGNATURE_NAME = 'serving_default';
const ENDPOINT = '100.68.51.130:9500';

// ==================== MAIN CODE ====================

async function makePrediction() {
  console.log('🚀 TensorFlow Serving gRPC Inference Client\n');

  // Load proto definitions using proto-loader
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

  // Create gRPC client
  const client = new PredictionService(
    ENDPOINT,
    grpc.credentials.createInsecure()
  );

  // Deserialize the example
  const serializedExample = Buffer.from(SERIALIZED_EXAMPLE_HEX, 'hex');

  console.log('📦 Input: SequenceExample', serializedExample.length, 'bytes');
  console.log('🎯 Model:', MODEL_NAME);
  console.log('📝 Signature:', SIGNATURE_NAME);
  console.log('🔗 Endpoint:', ENDPOINT);
  console.log('\n⏳ Making inference request...\n');

  // Create request (using snake_case for proto-loader)
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
      // Sort outputs for consistent display
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
makePrediction().catch(console.error);
