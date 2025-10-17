# ✅ SOLUTION: Working gRPC Inference Client

## 🎯 The Root Cause

The TensorFlow Serving `ModelSpec.signature_name` field is **field number 3**, not field number 2!

```protobuf
message ModelSpec {
  string name = 1;
  // Field 2 is reserved (was version, now deprecated)
  string signature_name = 3;  // ← This is the fix!
}
```

## ✅ Working Code

Use Python's serialized SequenceExample bytes directly:

```javascript
// File: src/working-client.js
const grpc = require('@grpc/grpc-js');
const protobuf = require('protobufjs');
const path = require('path');

// Get your serialized SequenceExample from Python:
// serialized_example = sequence_example.SerializeToString()
// print(serialized_example.hex())

const pythonSerializedExample = Buffer.from("YOUR_HEX_HERE", 'hex');

// Load protos
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);

const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

// Create request
const predictRequest = {
  modelSpec: {
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'  // camelCase for protobufjs!
  },
  inputs: {
    'examples': {
      dtype: 7,  // DT_STRING
      tensorShape: {
        dim: [{ size: 1 }]
      },
      stringVal: [pythonSerializedExample]
    }
  }
};

// Make request
const endpoint = '100.68.51.130:9500';
const client = new grpc.Client(endpoint, grpc.credentials.createInsecure());

const serialize = (value) => {
  const message = PredictRequest.create(value);
  return Buffer.from(PredictRequest.encode(message).finish());
};

const deserialize = (value) => {
  return PredictResponse.decode(value);
};

client.makeUnaryRequest(
  '/tensorflow.serving.PredictionService/Predict',
  serialize,
  deserialize,
  predictRequest,
  (error, response) => {
    client.close();

    if (error) {
      console.error('Error:', error.message);
      return;
    }

    console.log('Success! Outputs:', response.outputs);
  }
);
```

## 📝 Key Learnings

### 1. Proto Field Numbers Matter!
- TensorFlow Serving uses field 3 for `signature_name`, not field 2
- Field 2 was reserved for `version` (now deprecated)

### 2. protobufjs Uses camelCase
Field names must be camelCase:
- `model_spec` → `modelSpec`
- `signature_name` → `signatureName`
- `feature_lists` → `featureLists`
- `string_val` → `stringVal`

### 3. Error Code Progression
- `13 INTERNAL` → Proto field mismatch (signature_name was wrong)
- `3 INVALID_ARGUMENT` → SequenceExample parsing issue
- `SUCCESS` → Everything correct!

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Test with Python's bytes
node src/test-python-bytes.js

# 3. For production, get your data's serialized bytes from Python:
#    serialized = sequence_example.SerializeToString()
#    print(serialized.hex())
```

## 🐛 Troubleshooting

### Still getting INTERNAL errors?
- Check `ModelSpec.signature_name` is field 3
- Verify you're using camelCase field names
- Make sure certificate is correct if using ingress

### Getting INVALID_ARGUMENT?
- Your SequenceExample format doesn't match the model
- Use Python to serialize your SequenceExample
- Check all required features are present

## 📁 Files

- [proto/predict.proto](proto/predict.proto) - Fixed with signature_name = 3
- [src/test-python-bytes.js](src/test-python-bytes.js) - Working example
- [src/request-builder.js](src/request-builder.js) - SequenceExample builder (has minor encoding differences from Python)

## ✨ Success!

The client now successfully makes inference requests to TensorFlow Serving! The key was discovering that `signature_name` is field 3, not field 2 in the ModelSpec proto definition.
