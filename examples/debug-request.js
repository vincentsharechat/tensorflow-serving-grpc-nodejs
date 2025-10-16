const protobuf = require('protobufjs');
const path = require('path');

// Load protos
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);

const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');

// Create a test request - protobufjs uses camelCase field names!
const testRequest = {
  modelSpec: {  // Use camelCase, not snake_case
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'  // camelCase here too
  },
  inputs: {
    'examples': {
      dtype: 7,
      tensorShape: {  // camelCase
        dim: [{ size: 1 }]
      },
      stringVal: [Buffer.from('test')]  // camelCase
    }
  }
};

console.log('Test request object:');
console.log(JSON.stringify(testRequest, null, 2));

// Verify the message
const errMsg = PredictRequest.verify(testRequest);
if (errMsg) {
  console.error('❌ Verification failed:', errMsg);
} else {
  console.log('✅ Request structure is valid');
}

// Create and encode
const message = PredictRequest.create(testRequest);
console.log('\n✅ Created message:', message);
console.log('message.model_spec:', message.model_spec);
console.log('message.inputs:', message.inputs);

// Try encoding with toJSON first
const messageJSON = PredictRequest.toObject(message);
console.log('\nmessageJSON:', JSON.stringify(messageJSON, null, 2));

const encoded = PredictRequest.encode(message).finish();
console.log('\n✅ Encoded to', encoded.length, 'bytes');
console.log('Hex:', encoded.toString('hex'));

// Decode to verify
const decoded = PredictRequest.decode(encoded);
console.log('\n✅ Decoded message:');
console.log('  model_spec:', decoded.model_spec);
console.log('  inputs keys:', Object.keys(decoded.inputs));

// Try encoding just model_spec
const ModelSpec = root.lookupType('tensorflow.serving.ModelSpec');
const modelSpecMsg = ModelSpec.create({ name: 'dnb_model_baseline', signature_name: 'serving_default' });
const modelSpecEncoded = ModelSpec.encode(modelSpecMsg).finish();
console.log('\nModelSpec alone encoded to', modelSpecEncoded.length, 'bytes:', modelSpecEncoded.toString('hex'));
