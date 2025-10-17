# Quick Start Guide

Get up and running with TensorFlow Serving gRPC client in under 5 minutes.

## 1. Installation

```bash
npm install
```

## 2. Choose Your Connection Method

### Option A: Direct Pod Connection (Development)

Fastest way to get started - no certificate required:

```bash
npm run client:pod
```

**When to use:** Local development, testing

### Option B: Ingress with TLS (Production)

Secure production connection with certificate:

1. Ensure `ingress.crt` certificate exists
2. Run: `npm run client:ingress`

**When to use:** Production deployments

## 3. Test Your Setup

```bash
# Test serialization
npm test

# Test ingress connectivity
npm test:ingress
```

## 4. Use in Your Code

```javascript
const { buildSequenceExample } = require('./sequence-example-builder');
const { makeIngressRequest } = require('./client-ingress');
const config = require('./config');

// Define your features
const features = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["123456"],
  "ageRange": ["18-24"]
};

// Serialize
const serialized = buildSequenceExample(features);

// Make prediction (ingress)
const response = await makeIngressRequest({
  serializedExample: serialized,
  modelName: config.MODELS.BASELINE.name,
  signatureName: config.MODELS.BASELINE.signature,
  ingressHost: config.INGRESS.HOST,
  modelPath: config.MODELS.BASELINE.path,
  port: 443
});

console.log('Predictions:', response.outputs);
```

## Common Commands

```bash
npm run demo              # Demo serialization builder
npm run client:pod        # Connect via pod (direct)
npm run client:ingress    # Connect via ingress (TLS)
npm test                  # Run serialization tests
npm test:ingress          # Test ingress BASELINE model
npm test:ingress:all      # Test all model variants
```

## Configuration

Edit `config.js` to customize:
- Pod endpoints
- Ingress settings
- Model names and paths
- Timeout values

## Need Help?

- **Setup issues:** See [INGRESS_GUIDE.md](docs/INGRESS_GUIDE.md)
- **Serialization:** See [SEQUENCE_EXAMPLE_GUIDE.md](docs/SEQUENCE_EXAMPLE_GUIDE.md)
- **Full documentation:** See [README.md](README.md)

## What's Next?

1. Review full [README.md](README.md) for detailed usage
2. Check [docs/](docs/) folder for comprehensive guides
3. Explore [tests/](tests/) for more examples
