const grpc = require('@grpc/grpc-js');
const protobuf = require('protobufjs');
const path = require('path');

// Use Python's EXACT serialized bytes
const pythonHex = "12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e74657212070a050a030a01320a170a096f7356657273696f6e120a0a080a060a04726573740a150a09736f7572636541707012080a060a040a0253430a190a046369747912110a0f0a0d0a0b63686974726164757267610a1a0a0675736572696412100a0e0a0c0a0a323534353236343837320a250a0a70686f6e654d6f64656c12170a150a130a117869616f6d6920323230343132313970690a1e0a0c70686f6e6543617272696572120e0a0c0a0a0a08766920696e6469610a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a086c616e6775616765120b0a090a070a0574616d696c0a190a0b77696e6e696e675f626964120a0a0812060a04000000000a170a0861676552616e6765120b0a090a070a0531382d32340a210a0474696d6512190a170a150a13323032352d31302d31302030393a32313a33340a190a0b666c6f6f725f7072696365120a0a0812060a040000a0400a1d0a0761645f7479706512120a100a0e0a0c53435f4f555453545245414d0a110a0667656e64657212070a050a030a01460a350a0761647375756964122a0a280a260a2465356332663339342d303233652d343338332d393264302d623238663137633130653465";

const serializedExample = Buffer.from(pythonHex, 'hex');

console.log('🧪 Testing with Python\'s exact serialized SequenceExample');
console.log('📏 Size:', serializedExample.length, 'bytes');

// Load protos
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);

const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

// Setup connection
const endpoint = '100.68.51.130:9500';
const credentials = grpc.credentials.createInsecure();

console.log('🔗 Connecting to pod:', endpoint);

// Create PredictRequest with Python's bytes
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
      versionNumber: 0,
      stringVal: [serializedExample]  // Using Python's exact bytes
    }
  }
};

console.log('🚀 Sending request with Python\'s serialized bytes...');

// Make request
const client = new grpc.Client(endpoint, credentials);

const serialize = (value) => {
  const message = PredictRequest.create(value);
  return Buffer.from(PredictRequest.encode(message).finish());
};

const deserialize = (value) => {
  return PredictResponse.decode(value);
};

const methodPath = '/tensorflow.serving.PredictionService/Predict';

client.makeUnaryRequest(
  methodPath,
  serialize,
  deserialize,
  predictRequest,
  (error, response) => {
    client.close();

    if (error) {
      console.error('❌ Error:', error.code, error.message);
      console.error('Details:', error.details);
      return;
    }

    console.log('✅ SUCCESS! Got response:');
    console.log('\n📊 Outputs:');

    if (!response.outputs || Object.keys(response.outputs).length === 0) {
      console.log('  (Response has no outputs)');
      console.log('\nFull response structure:', JSON.stringify(response, null, 2));
      return;
    }

    for (const [key, tensor] of Object.entries(response.outputs)) {
      console.log(`\n  ${key}:`);
      console.log(`    dtype: ${tensor.dtype}`);

      if (tensor.tensorShape) {
        const dims = tensor.tensorShape.dim || [];
        const shape = dims.map(d => d.size).join(' x ');
        console.log(`    shape: [${shape}]`);
      }

      if (tensor.floatVal && tensor.floatVal.length > 0) {
        console.log(`    floatVal:`, tensor.floatVal);
      }
      if (tensor.stringVal && tensor.stringVal.length > 0) {
        console.log(`    stringVal length:`, tensor.stringVal.length);
      }
      if (tensor.int64Val && tensor.int64Val.length > 0) {
        console.log(`    int64Val:`, tensor.int64Val);
      }
    }
  }
);
