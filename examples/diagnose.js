const grpc = require('@grpc/grpc-js');
const protobuf = require('protobufjs');
const path = require('path');

console.log('🔍 DIAGNOSIS: Checking each component\n');

// Python's exact serialized SequenceExample
const pythonHex = "12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e74657212070a050a030a01320a170a096f7356657273696f6e120a0a080a060a04726573740a150a09736f7572636541707012080a060a040a0253430a190a046369747912110a0f0a0d0a0b63686974726164757267610a1a0a0675736572696412100a0e0a0c0a0a323534353236343837320a250a0a70686f6e654d6f64656c12170a150a130a117869616f6d6920323230343132313970690a1e0a0c70686f6e6543617272696572120e0a0c0a0a0a08766920696e6469610a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a086c616e6775616765120b0a090a070a0574616d696c0a190a0b77696e6e696e675f626964120a0a0812060a04000000000a170a0861676552616e6765120b0a090a070a0531382d32340a210a0474696d6512190a170a150a13323032352d31302d31302030393a32313a33340a190a0b666c6f6f725f7072696365120a0a0812060a040000a0400a1d0a0761645f7479706512120a100a0e0a0c53435f4f555453545245414d0a110a0667656e64657212070a050a030a01460a350a0761647375756964122a0a280a260a2465356332663339342d303233652d343338332d393264302d623238663137633130653465";
const serializedExample = Buffer.from(pythonHex, 'hex');

// Load protos
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);

const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

// TEST 1: Check proto encoding
console.log('TEST 1: Proto Encoding');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const predictRequest = {
  modelSpec: {
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'
  },
  inputs: {
    'examples': {
      dtype: 7,
      tensorShape: {
        dim: [{ size: 1 }]
      },
      stringVal: [serializedExample]
    }
  }
};

try {
  const message = PredictRequest.create(predictRequest);
  console.log('✓ PredictRequest.create() succeeded');

  const errMsg = PredictRequest.verify(predictRequest);
  if (errMsg) {
    console.log('✗ Verification failed:', errMsg);
  } else {
    console.log('✓ Request verification passed');
  }

  const encoded = PredictRequest.encode(message).finish();
  console.log('✓ Encoded to', encoded.length, 'bytes');

  // Try to decode it back
  const decoded = PredictRequest.decode(encoded);
  console.log('✓ Decoded successfully');
  console.log('  - modelSpec.name:', decoded.modelSpec?.name);
  console.log('  - modelSpec.signatureName:', decoded.modelSpec?.signatureName);
  console.log('  - inputs.examples exists:', !!decoded.inputs?.examples);
  console.log('  - inputs.examples.dtype:', decoded.inputs?.examples?.dtype);
  console.log('  - inputs.examples.stringVal[0] length:', decoded.inputs?.examples?.stringVal?.[0]?.length);
} catch (e) {
  console.log('✗ Error:', e.message);
}

// TEST 2: Check connection
console.log('\n\nTEST 2: Connection');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const endpoint = '100.68.51.130:9500';
const credentials = grpc.credentials.createInsecure();
console.log('Endpoint:', endpoint);
console.log('Credentials: insecure');

const channel = new grpc.Channel(endpoint, credentials, {});
console.log('✓ Channel created');

// Check connectivity
setTimeout(() => {
  const state = channel.getConnectivityState(true);
  const stateNames = ['IDLE', 'CONNECTING', 'READY', 'TRANSIENT_FAILURE', 'SHUTDOWN'];
  console.log('✓ Channel state:', stateNames[state] || state);
}, 100);

// TEST 3: Check method path
console.log('\n\nTEST 3: Method Path');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const methodPath = '/tensorflow.serving.PredictionService/Predict';
console.log('Method:', methodPath);
console.log('Package: tensorflow.serving');
console.log('Service: PredictionService');
console.log('Method: Predict');

// TEST 4: Make actual request
console.log('\n\nTEST 4: Make Request');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const client = new grpc.Client(endpoint, credentials);

const serialize = (value) => {
  const message = PredictRequest.create(value);
  const buffer = Buffer.from(PredictRequest.encode(message).finish());
  console.log('  Serializing request:', buffer.length, 'bytes');
  return buffer;
};

const deserialize = (value) => {
  console.log('  Deserializing response:', value.length, 'bytes');
  return PredictResponse.decode(value);
};

console.log('Sending request...');

client.makeUnaryRequest(
  methodPath,
  serialize,
  deserialize,
  predictRequest,
  { deadline: Date.now() + 10000 },
  (error, response) => {
    client.close();

    if (error) {
      console.log('\n❌ REQUEST FAILED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Code:', error.code);
      console.log('Message:', error.message);
      console.log('Details:', error.details);

      console.log('\n📋 Error Code Reference:');
      console.log('  3 = INVALID_ARGUMENT (bad request format)');
      console.log('  5 = NOT_FOUND (service/method not found)');
      console.log('  12 = UNIMPLEMENTED (method not implemented)');
      console.log('  13 = INTERNAL (server error)');
      console.log('  14 = UNAVAILABLE (server unavailable)');

      console.log('\n💡 Next Steps:');
      if (error.code === 5) {
        console.log('  - Check if model "dnb_model_baseline" exists');
        console.log('  - Verify method path is correct');
      } else if (error.code === 13) {
        console.log('  - Server received request but failed processing');
        console.log('  - Check TensorFlow Serving logs for details');
        console.log('  - Verify model signature matches our inputs');
      } else if (error.code === 3) {
        console.log('  - Request format is incorrect');
        console.log('  - Check PredictRequest structure');
      }
    } else {
      console.log('\n✅ REQUEST SUCCEEDED!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\nOutputs:');
      for (const [key, tensor] of Object.entries(response.outputs)) {
        console.log(`\n  ${key}:`);
        console.log(`    dtype: ${tensor.dtype}`);
        if (tensor.floatVal && tensor.floatVal.length > 0) {
          console.log(`    value: ${tensor.floatVal[0]}`);
        }
      }
    }
  }
);
