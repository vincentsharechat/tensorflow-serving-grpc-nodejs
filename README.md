# TensorFlow Serving gRPC Client for Node.js

A working Node.js gRPC client for making inference requests to TensorFlow Serving, specifically tested with DNB (Dynamic Network Bidding) model.

## ✅ Features

- ✅ **Correct proto definitions** with proper field numbers
- ✅ **Direct pod connection** to TensorFlow Serving (port 9500)
- ✅ **Ingress support** with TLS certificates (port 443)
- ✅ **Full prediction parsing** - all output tensors displayed correctly
- ✅ **Simple API** - easy to integrate into your application

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Run Example

```bash
node final-working-client.js
```

### Expected Output

```
✅ SUCCESS!

📊 MODEL PREDICTIONS

  expected_fill_value:
    Value: 3.4462599754333496
    Shape: [1 × 1]

  fill_probability:
    Value: 0.4901264011859894
    Shape: [1 × 1]

  optimal_floor_price:
    Value: 7.031369686126709
    Shape: [1 × 1]

  floor_constraint_penalty:
    Value: 0
    Shape: []
```

## 📖 Usage

### Option 1: Build SequenceExample in Node.js (NEW! ⭐)

Build and serialize SequenceExample directly in Node.js (no Python needed):

```javascript
const { buildSequenceExample } = require('./sequence-example-builder');

// Define your features
const features = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"],
  "ageRange": ["18-24"]
};

// Serialize (equivalent to Python's SerializeToString())
const serialized = buildSequenceExample(features);
```

**Run the example:**
```bash
node client-with-builder.js
```

**Documentation:** See [SEQUENCE_EXAMPLE_GUIDE.md](SEQUENCE_EXAMPLE_GUIDE.md) for full API reference

### Option 2: Pre-serialize with Python

1. **Serialize your SequenceExample in Python:**

```python
# In your Python code
serialized = sequence_example.SerializeToString()
print(serialized.hex())
```

2. **Update the hex string in your code:**

```javascript
const SERIALIZED_EXAMPLE_HEX = "YOUR_HEX_HERE";
```

3. **Run the client:**

```bash
node final-working-client.js
```

### Configuration

Update these constants in `final-working-client.js`:

```javascript
const MODEL_NAME = 'dnb_model_baseline';      // Your model name
const SIGNATURE_NAME = 'serving_default';     // Your signature
const ENDPOINT = '100.68.51.130:9500';        // Your TF Serving endpoint
```

## 🔑 Key Technical Details

### Proto Field Numbers (CRITICAL!)

The success of this client depends on using the **correct TensorFlow Serving proto field numbers**:

#### ModelSpec
```protobuf
message ModelSpec {
  string name = 1;
  Version version = 2;          // ← Field 2 (often omitted but exists!)
  string signature_name = 3;     // ← Field 3 (NOT 2!)
}
```

#### PredictResponse
```protobuf
message PredictResponse {
  map<string, TensorProto> outputs = 1;   // ← Field 1 (outputs first!)
  ModelSpec model_spec = 2;                // ← Field 2
}
```

### Why @grpc/proto-loader?

We use `@grpc/proto-loader` instead of `protobufjs` because:
- ✅ Better compatibility with Google's protobuf format
- ✅ Correct map encoding for TensorFlow Serving
- ✅ Proper field ordering preservation

## 📁 Project Structure

```
grpc-inference-client/
├── proto/
│   ├── predict.proto              # TF Serving prediction service (FIXED field numbers)
│   ├── tensor.proto               # TensorFlow tensor definitions
│   └── example.proto              # SequenceExample format (with FeatureLists wrapper)
├── sequence-example-builder.js    # ⭐ NEW: Build & serialize SequenceExample
├── client-with-builder.js         # ⭐ NEW: Full gRPC client with builder
├── test-serialization.js          # ⭐ NEW: Test suite
├── final-working-client.js        # ✅ Original working example (pre-serialized hex)
├── SEQUENCE_EXAMPLE_GUIDE.md      # ⭐ NEW: Complete builder documentation
├── BUGFIX_SUMMARY.md              # ⭐ NEW: Technical proto structure details
├── package.json
└── README.md
```

## 🐛 Troubleshooting

### Error: `13 INTERNAL`

**Cause:** Wrong proto field numbers (most common issue!)

**Fix:** Ensure `ModelSpec.signature_name = 3` (not 2)

### Error: `3 INVALID_ARGUMENT: Invalid protocol message input`

**Cause:** SequenceExample format doesn't match model expectations

**Fix:** 
- Verify all required features are present
- Use Python to serialize your SequenceExample correctly
- Check feature names match model's expected inputs

### Wrong output values or corrupted data

**Cause:** Wrong `PredictResponse` field mapping

**Fix:** Ensure `outputs = 1` and `model_spec = 2` in PredictResponse

### Connection errors

**Cause:** Network/endpoint issues

**Fix:**
- For direct pod: Use `grpc.credentials.createInsecure()`
- For ingress: Use `grpc.credentials.createSsl(rootCert)` with proper certificate

## 🎯 Architecture

```
┌─────────────┐
│  Node.js    │
│   Client    │
└──────┬──────┘
       │ gRPC (port 9500 or 443)
       │
┌──────▼──────────────┐
│  TensorFlow Serving │
│  (DNB Model)        │
└─────────────────────┘
```

## 📊 Response Format

The model returns multiple predictions:

- **`fill_probability`**: Predicted probability of ad fill (0.0-1.0)
- **`optimal_floor_price`**: Recommended floor price
- **`expected_fill_value`**: Expected value if filled
- **`floor_constraint_penalty`**: Constraint penalty value

## 🔒 Security

- **Direct Pod Access**: Uses insecure connection (development only)
- **Ingress Access**: Uses TLS with certificate (`ingress.crt`)
- **Production**: Use proper authentication and TLS certificates

## 📝 License

MIT

## 🤝 Contributing

Issues and PRs welcome!

## ⚡ Performance Tips

1. **Reuse client connections** - don't create new client for each request
2. **Batch requests** when possible
3. **Set appropriate deadlines** to avoid hanging
4. **Monitor latency** for production use

## 📚 Resources

- [TensorFlow Serving gRPC API](https://www.tensorflow.org/tfx/serving/api_rest)
- [@grpc/grpc-js Documentation](https://grpc.github.io/grpc/node/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)

---

Made with ❤️ for TensorFlow Serving + Node.js integration
