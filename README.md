# TensorFlow Serving gRPC Client for Node.js

Complete Node.js solution for TensorFlow Serving with SequenceExample serialization, direct pod access, and production-ready ingress connectivity with TLS.

## Features

- ✅ **SequenceExample Builder** - Python-equivalent serialization (`SerializeToString()`)
- ✅ **Direct Pod Access** - Fast development connectivity (port 9500)
- ✅ **Ingress with TLS** - Production-ready with certificate authentication (port 443)
- ✅ **Custom Path Routing** - Support for multiple model variants (BASELINE/CONSERVATIVE/AGGRESSIVE)
- ✅ **Comprehensive Testing** - Full test suite with validation against Python output

## Quick Start

```bash
# Install dependencies
npm install

# Test serialization
npm test

# Connect via pod (development)
npm run client:pod

# Connect via ingress (production)
npm run client:ingress
```

**👉 See [QUICKSTART.md](QUICKSTART.md) for detailed 5-minute setup guide**

## Project Structure

```
grpc-inference-client/
├── QUICKSTART.md                    # 5-minute getting started guide
├── README.md                        # This file
├── config.js                        # Centralized configuration
├── sequence-example-builder.js      # SequenceExample serialization
├── client-with-builder.js           # Pod client (development)
├── client-ingress.js                # Ingress client (production)
├── proto/                           # Protocol Buffer definitions
│   ├── predict.proto
│   ├── tensor.proto
│   └── example.proto
├── tests/                           # Test scripts
│   ├── test-serialization.js
│   ├── test-ingress-baseline.js
│   └── test-ingress-all-models.js
├── docs/                            # Documentation
│   ├── SEQUENCE_EXAMPLE_GUIDE.md   # Serialization API reference
│   ├── INGRESS_GUIDE.md            # Ingress setup & troubleshooting
│   ├── BUGFIX_SUMMARY.md           # Proto structure fix details
│   ├── COMPLETION_SUMMARY.md       # SequenceExample implementation
│   ├── INGRESS_IMPLEMENTATION_SUMMARY.md  # Ingress implementation
│   └── archive/                     # Historical documentation
├── examples/                        # Example scripts
│   └── archive/                     # Legacy examples
└── src/                             # Source utilities
```

## Usage

### 1. Build SequenceExample

```javascript
const { buildSequenceExample } = require('./sequence-example-builder');

const features = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["123456"],
  "ageRange": ["18-24"],
  "city": ["bangalore"]
};

// Serialize (equivalent to Python's SerializeToString())
const serialized = buildSequenceExample(features);
```

### 2. Connect via Pod (Development)

```javascript
const { buildSequenceExample } = require('./sequence-example-builder');
// Import and use client-with-builder.js
// See client-with-builder.js for full example
```

```bash
npm run client:pod
```

### 3. Connect via Ingress (Production)

```javascript
const { makeIngressRequest } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const config = require('./config');

const response = await makeIngressRequest({
  serializedExample: buildSequenceExample(features),
  modelName: config.MODELS.BASELINE.name,
  signatureName: config.MODELS.BASELINE.signature,
  ingressHost: config.INGRESS.HOST,
  modelPath: config.MODELS.BASELINE.path,
  port: 443,
  caCertPath: 'ingress.crt'
});
```

```bash
npm run client:ingress
```

## Model Variants

Three model variants available via ingress:

| Model | Path | Model Name | Status |
|-------|------|------------|--------|
| BASELINE | `ADS_LST_DNB_BASELINE` | `dnb_model_baseline` | ✅ Available |
| CONSERVATIVE | `ADS_LST_DNB_CONSERVATIVE` | `dnb_model_conservative` | ⏳ Pending |
| AGGRESSIVE | `ADS_LST_DNB_AGGRESSIVE` | `dnb_model_aggressive` | ⏳ Pending |

## NPM Scripts

```bash
# Testing
npm test                  # Run serialization tests
npm test:ingress          # Test BASELINE model via ingress
npm test:ingress:all      # Test all model variants

# Clients
npm run client:pod        # Connect via pod (development)
npm run client:ingress    # Connect via ingress (production)

# Demo
npm run demo              # Demo serialization builder
```

## Configuration

Edit `config.js` to customize:

```javascript
module.exports = {
  POD: {
    ENDPOINT: '100.68.113.134:9500',
    PORT: 9500,
    USE_TLS: false
  },
  INGRESS: {
    HOST: 'holmes-ads-v2.sharechat.internal',
    PORT: 443,
    USE_TLS: true,
    CERT_PATH: 'ingress.crt'
  },
  MODELS: {
    BASELINE: {
      name: 'dnb_model_baseline',
      signature: 'serving_default',
      path: 'ADS_LST_DNB_BASELINE'
    }
    // ... CONSERVATIVE, AGGRESSIVE
  }
};
```

## Documentation

### Quick References

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[docs/SEQUENCE_EXAMPLE_GUIDE.md](docs/SEQUENCE_EXAMPLE_GUIDE.md)** - Complete serialization API
- **[docs/INGRESS_GUIDE.md](docs/INGRESS_GUIDE.md)** - Ingress setup & troubleshooting

### Implementation Details

- **[docs/COMPLETION_SUMMARY.md](docs/COMPLETION_SUMMARY.md)** - SequenceExample implementation
- **[docs/INGRESS_IMPLEMENTATION_SUMMARY.md](docs/INGRESS_IMPLEMENTATION_SUMMARY.md)** - Ingress implementation
- **[docs/BUGFIX_SUMMARY.md](docs/BUGFIX_SUMMARY.md)** - Proto structure fix

## Python Equivalence

This implementation produces **byte-for-byte identical** output to Python:

### Python
```python
import tensorflow as tf

sequence_example = tf.train.SequenceExample()
fl = sequence_example.feature_lists.feature_list
fl['ad_type'].feature.add().bytes_list.value.append(b'SC_CPCV_1')

serialized = sequence_example.SerializeToString()
hex_string = serialized.hex()
```

### Node.js
```javascript
const { buildSequenceExample, toHex } = require('./sequence-example-builder');

const serialized = buildSequenceExample({ 'ad_type': ['SC_CPCV_1'] });
const hex_string = toHex(serialized);

// Result: Exact match with Python! ✅
```

## Testing

### Serialization Tests

```bash
npm test
# ✅ Test 1 (single feature): PASS - exact Python match
# ✅ Test 6 (14 features): PASS - correct size (412 bytes)
```

### Ingress Tests

```bash
npm test:ingress
# ✅ TLS handshake: Working
# ✅ Custom path routing: Working
# ✅ Model predictions: Valid
```

### Production Verification

Tested against live endpoint: `holmes-ads-v2.sharechat.internal:443`

```
✅ BASELINE model: SUCCESS
   - optimal_floor_price: 20.08
   - fill_probability: 0.17
   - Model version: 1760489874
```

## Troubleshooting

### Certificate Issues

**Error: Certificate file not found**
```bash
# Obtain certificate (see docs/INGRESS_GUIDE.md for methods)
kubectl get secret -n ads-serving ingress-tls -o jsonpath='{.data.ca\.crt}' | base64 -d > ingress.crt
```

### Connection Issues

**Error: UNAVAILABLE (code 14)**
```bash
# Test connectivity
nslookup holmes-ads-v2.sharechat.internal
nc -zv holmes-ads-v2.sharechat.internal 443
```

### Model Not Found

**Error: NOT_FOUND (code 5)**

Check `config.js` model name matches TensorFlow Serving deployment.

**👉 See [docs/INGRESS_GUIDE.md](docs/INGRESS_GUIDE.md) for comprehensive troubleshooting**

## Production Deployment

### Checklist

- [ ] Valid TLS certificate obtained (`ingress.crt`)
- [ ] Network connectivity verified
- [ ] Model paths tested
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] Timeout values tuned

### Environment Variables

```javascript
const config = {
  INGRESS_HOST: process.env.TF_SERVING_HOST || 'holmes-ads-v2.sharechat.internal',
  INGRESS_PORT: parseInt(process.env.TF_SERVING_PORT) || 443,
  CERT_PATH: process.env.TF_SERVING_CERT || 'ingress.crt'
};
```

## Key Technical Details

### TLS/SSL Implementation

```javascript
const certContent = fs.readFileSync('ingress.crt');
const credentials = grpc.credentials.createSsl(certContent);
const client = new grpc.Client(target, credentials);
```

### Custom Path Routing

```javascript
const methodPath = '/ADS_LST_DNB_BASELINE/tensorflow.serving.PredictionService/Predict';
client.makeUnaryRequest(methodPath, serializer, deserializer, request, ...);
```

### Protocol Buffer Structure

Matches TensorFlow's official `tensorflow/core/example/example.proto`:
- `SequenceExample` → `FeatureLists` → `FeatureList` → `Feature`
- Supports `bytes_list`, `int64_list`, `float_list`

## Performance

| Connection Type | Latency | Notes |
|----------------|---------|-------|
| Direct Pod | ~100ms | Baseline |
| Via Ingress (TLS) | ~150-200ms | +50-100ms overhead |

## Dependencies

```json
{
  "@grpc/grpc-js": "^1.9.0",
  "@grpc/proto-loader": "^0.7.10",
  "protobufjs": "^7.5.4"
}
```

## Contributing

1. Review documentation in `docs/`
2. Run tests: `npm test && npm test:ingress`
3. Follow existing code style
4. Update documentation for API changes

## License

MIT

## Support

- **Issues:** Create an issue in the repository
- **Documentation:** Check `docs/` directory
- **Quick Start:** See [QUICKSTART.md](QUICKSTART.md)

---

**🚀 Ready to get started? See [QUICKSTART.md](QUICKSTART.md) for a 5-minute setup guide!**
