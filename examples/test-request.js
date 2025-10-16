const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const protobuf = require('protobufjs');
const path = require('path');
const fs = require('fs');
const { buildSequenceExample, serializeSequenceExample } = require('./request-builder');

// Sample data from your example - MUST match Python's SequenceExample exactly
const sampleData = {
  time: '2025-10-10 09:21:34',
  // Note: NO 'date' field - Python doesn't have it
  ad_type: 'SC_OUTSTREAM',
  adsuuid: 'e5c2f394-023e-4383-92d0-b28f17c10e4e',
  ageRange: '18-24',
  city: 'chitradurga',
  feed_fetch_counter: '2',
  gender: 'F',
  language: 'tamil',
  osVersion: 'rest',
  phoneCarrier: 'vi india',
  phoneModel: 'xiaomi 22041219pi',
  sourceApp: 'SC',
  state: 'karnataka',
  userid: '2545264872',
  floor_price: 5.0,
  winning_bid: 0.0,
  is_responded: 0  // int64 field
};

// Load predict.proto
const PROTO_PATH = path.join(__dirname, '../proto/predict.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, '../proto')]
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

// Load protos with protobufjs for serialization
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);
const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

// Setup credentials - connect directly to pod instead of ingress
const endpoint = '100.68.51.130:9500';

// Use insecure credentials for direct pod connection (no TLS on pod)
const credentials = grpc.credentials.createInsecure();

console.log('🔗 Connecting to pod:', endpoint);
console.log('⚠️  Using insecure connection (direct pod access)');

// Build the SequenceExample
const sequenceExample = buildSequenceExample(sampleData);
const serializedExample = serializeSequenceExample(sequenceExample);

console.log('📦 Built SequenceExample with', Object.keys(sequenceExample.featureLists).length, 'features');
console.log('📏 Serialized example size:', serializedExample.length, 'bytes');
console.log('📐 First 50 bytes (hex):', serializedExample.slice(0, 50).toString('hex'));

// Create PredictRequest - protobufjs uses camelCase field names
const predictRequest = {
  modelSpec: {
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'
  },
  inputs: {
    'examples': {
      dtype: 7, // DT_STRING
      tensorShape: {
        dim: [{ size: 1 }]
      },
      versionNumber: 0,  // Explicitly set to match Python
      stringVal: [serializedExample]
    }
  }
};

console.log('🚀 Sending predict request...');
console.log('📝 Request structure:');
console.log('  modelSpec.name:', predictRequest.modelSpec.name);
console.log('  modelSpec.signatureName:', predictRequest.modelSpec.signatureName);
console.log('  inputs.examples.dtype:', predictRequest.inputs.examples.dtype);
console.log('  inputs.examples.tensorShape:', JSON.stringify(predictRequest.inputs.examples.tensorShape));
console.log('  inputs.examples.stringVal length:', predictRequest.inputs.examples.stringVal.length);
console.log('  inputs.examples.stringVal[0] length:', predictRequest.inputs.examples.stringVal[0].length);

// Helper function to make unary request with custom path
function makeRequest(methodPath, callback) {
  const client = new grpc.Client(endpoint, credentials);

  const serialize = (value) => {
    const message = PredictRequest.create(value);
    return Buffer.from(PredictRequest.encode(message).finish());
  };

  const deserialize = (value) => {
    return PredictResponse.decode(value);
  };

  client.makeUnaryRequest(
    methodPath,
    serialize,
    deserialize,
    predictRequest,
    (error, response) => {
      client.close();
      callback(error, response);
    }
  );
}

// Use standard TensorFlow Serving method path (no ingress prefix needed)
const methodPath = '/tensorflow.serving.PredictionService/Predict';

makeRequest(methodPath, (error, response) => {
  if (error) {
    console.error('❌ Error:', error.code, error.message);
    console.error('Details:', error.details);
    console.error('Metadata:', error.metadata);

    // Log full error for debugging
    console.error('\nFull error object:');
    console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return;
  }

  console.log('✅ Success!');
  printResponse(response);
});

function printResponse(response) {
  console.log('\n📊 Response outputs:');
  if (response.outputs) {
    for (const [key, tensor] of Object.entries(response.outputs)) {
      console.log(`\n  ${key}:`);
      console.log(`    dtype: ${tensor.dtype}`);
      console.log(`    shape:`, tensor.tensor_shape);

      if (tensor.float_val && tensor.float_val.length > 0) {
        console.log(`    values:`, tensor.float_val);
      }
    }
  }
}
