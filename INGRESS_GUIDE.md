## Ingress Connectivity Guide

Complete guide for connecting to TensorFlow Serving via ingress with TLS encryption and custom path routing.

## Overview

The ingress setup allows you to connect to TensorFlow Serving through `holmes-ads-v2.sharechat.internal:443` with:

- **TLS/SSL encryption** for secure communication
- **Custom path routing** to different model variants
- **Certificate-based authentication**
- **Load balancing** and routing provided by ingress controller

### Comparison: Pod vs Ingress

| Feature | Pod Direct | Ingress |
|---------|------------|---------|
| Endpoint | `100.68.113.134:9500` | `holmes-ads-v2.sharechat.internal:443` |
| Protocol | Insecure gRPC | Secure gRPC (TLS) |
| Port | 9500 | 443 |
| Certificate | Not required | Required (`ingress.crt`) |
| Path routing | Default | Custom (BASELINE/CONSERVATIVE/AGGRESSIVE) |
| Load balancing | None | Yes |
| Production ready | No | Yes |

## Prerequisites

### 1. TLS Certificate

You need a valid TLS certificate file to connect to the ingress endpoint.

**Check if certificate exists:**
```bash
ls -lh ingress.crt
```

**If file is empty or missing**, obtain the certificate:

```bash
# Option 1: From kubectl (if you have cluster access)
kubectl get secret -n ads-serving ingress-tls -o jsonpath='{.data.ca\.crt}' | base64 -d > ingress.crt

# Option 2: Use openssl to fetch from server
echo -n | openssl s_client -connect holmes-ads-v2.sharechat.internal:443 -showcerts | \
  sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' > ingress.crt

# Option 3: Request from infrastructure team
# Contact your DevOps/Infrastructure team for the certificate
```

**Verify certificate:**
```bash
# Check file size (should not be 0 bytes)
wc -c ingress.crt

# View certificate details
openssl x509 -in ingress.crt -text -noout
```

### 2. Network Access

Ensure you can reach the ingress endpoint:

```bash
# Test DNS resolution
nslookup holmes-ads-v2.sharechat.internal

# Test connectivity
nc -zv holmes-ads-v2.sharechat.internal 443
```

### 3. Dependencies

All required npm packages are already installed:
```json
{
  "@grpc/grpc-js": "^1.9.0",
  "@grpc/proto-loader": "^0.7.10",
  "protobufjs": "^7.5.4"
}
```

## Quick Start

### 1. Basic Usage

Connect to the BASELINE model:

```javascript
const { makeIngressRequest, displayResults } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const config = require('./config');

// Define features
const features = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"],
  "ageRange": ["18-24"]
  // ... more features
};

// Serialize
const serialized = buildSequenceExample(features);

// Make request
const response = await makeIngressRequest({
  serializedExample: serialized,
  modelName: config.MODELS.BASELINE.name,
  signatureName: config.MODELS.BASELINE.signature,
  ingressHost: config.INGRESS.HOST,
  modelPath: config.MODELS.BASELINE.path,
  port: config.INGRESS.PORT,
  caCertPath: config.INGRESS.CERT_PATH
});

displayResults(response);
```

### 2. Run Test Scripts

**Test BASELINE model:**
```bash
node test-ingress-baseline.js
```

**Test all three models:**
```bash
node test-ingress-all-models.js
```

**Run directly:**
```bash
node client-ingress.js
```

## Model Variants

Three model variants are available via different ingress paths.

**Important:** Each ingress path routes to a separate TensorFlow Serving deployment with its own model name:
- Path `ADS_LST_DNB_BASELINE` → Model `dnb_model_baseline`
- Path `ADS_LST_DNB_CONSERVATIVE` → Model `dnb_model_conservative`
- Path `ADS_LST_DNB_AGGRESSIVE` → Model `dnb_model_aggressive`

**Note:** As of the latest test, only the BASELINE model is deployed. CONSERVATIVE and AGGRESSIVE models return `NOT_FOUND` errors and may be deployed in the future.

### BASELINE Model

**Use case:** Standard predictions with balanced behavior

```javascript
const response = await makeIngressRequest({
  serializedExample: serialized,
  modelName: 'dnb_model_baseline',
  signatureName: 'serving_default',
  ingressHost: 'holmes-ads-v2.sharechat.internal',
  modelPath: 'ADS_LST_DNB_BASELINE',
  port: 443
});
```

### CONSERVATIVE Model

**Use case:** Lower risk, conservative floor price recommendations

```javascript
const response = await makeIngressRequest({
  serializedExample: serialized,
  modelName: 'dnb_model_conservative',
  signatureName: 'serving_default',
  ingressHost: 'holmes-ads-v2.sharechat.internal',
  modelPath: 'ADS_LST_DNB_CONSERVATIVE',
  port: 443
});
```

### AGGRESSIVE Model

**Use case:** Higher risk, aggressive floor price recommendations

```javascript
const response = await makeIngressRequest({
  serializedExample: serialized,
  modelName: 'dnb_model_aggressive',
  signatureName: 'serving_default',
  ingressHost: 'holmes-ads-v2.sharechat.internal',
  modelPath: 'ADS_LST_DNB_AGGRESSIVE',
  port: 443
});
```

## Configuration

### Using config.js

All configuration is centralized in `config.js`:

```javascript
const config = require('./config');

// Ingress settings
config.INGRESS.HOST        // 'holmes-ads-v2.sharechat.internal'
config.INGRESS.PORT        // 443
config.INGRESS.CERT_PATH   // 'ingress.crt'

// Model configurations
config.MODELS.BASELINE
config.MODELS.CONSERVATIVE
config.MODELS.AGGRESSIVE

// Model paths
config.MODEL_PATHS.BASELINE      // 'ADS_LST_DNB_BASELINE'
config.MODEL_PATHS.CONSERVATIVE  // 'ADS_LST_DNB_CONSERVATIVE'
config.MODEL_PATHS.AGGRESSIVE    // 'ADS_LST_DNB_AGGRESSIVE'
```

### Custom Configuration

Override defaults for specific use cases:

```javascript
await makeIngressRequest({
  serializedExample: serialized,
  modelName: 'my_custom_model',
  signatureName: 'custom_signature',
  ingressHost: 'custom.internal',
  modelPath: 'CUSTOM_PATH',
  port: 443,
  timeout: 5000,  // 5 seconds
  caCertPath: './my-cert.crt'
});
```

## Advanced Features

### 1. Adding "common" Input

Some models support an additional "common" input tensor:

```javascript
const commonFeatures = {
  "global_feature_1": ["value1"],
  "global_feature_2": ["value2"]
};

const serializedCommon = buildSequenceExample(commonFeatures);

const response = await makeIngressRequest({
  serializedExample: serialized,
  serializedCommon: serializedCommon,  // Add common input
  modelName: config.MODELS.BASELINE.name,
  // ... other options
});
```

### 2. Custom Timeout

Adjust timeout for slow networks or large payloads:

```javascript
await makeIngressRequest({
  // ... other options
  timeout: 10000  // 10 seconds
});
```

### 3. Error Handling

```javascript
try {
  const response = await makeIngressRequest({...});
  displayResults(response);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('Certificate file not found');
  } else if (error.code === 14) {
    console.error('Connection error - check network/certificate');
  } else if (error.code === 3) {
    console.error('Invalid request - check model name/signature');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## How It Works

### Custom Path Routing

The Python code uses `channel.unary_unary()` to specify custom method paths:

```python
method = f"/{path}/tensorflow.serving.PredictionService/Predict"
# Example: /ADS_LST_DNB_BASELINE/tensorflow.serving.PredictionService/Predict
```

In Node.js, we use `channel.makeUnaryRequest()`:

```javascript
const methodPath = `/${modelPath}/tensorflow.serving.PredictionService/Predict`;

channel.makeUnaryRequest(
  methodPath,
  requestSerializer,
  responseDeserializer,
  request,
  metadata,
  options,
  callback
);
```

### TLS Certificate Handling

**Load certificate:**
```javascript
const fs = require('fs');
const certContent = fs.readFileSync('ingress.crt');
const credentials = grpc.credentials.createSsl(certContent);
```

**Create secure channel:**
```javascript
const channel = new grpc.Channel(
  'holmes-ads-v2.sharechat.internal:443',
  credentials
);
```

### Request Serialization

Using protobufjs for manual encoding/decoding:

```javascript
const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

// Serializer
(value) => PredictRequest.encode(value).finish()

// Deserializer
(buffer) => PredictResponse.decode(buffer)
```

## Troubleshooting

### Certificate Errors

**Error: Certificate file not found**
```
Error: ENOENT: no such file or directory, open 'ingress.crt'
```

**Solution:** Obtain certificate as described in Prerequisites section

**Error: Certificate file is empty**
```
Error: Certificate file is empty: ingress.crt
```

**Solution:** File exists but has no content (0 bytes). Fetch actual certificate.

**Error: self signed certificate**
```
Error: self signed certificate in certificate chain
```

**Solution:** This is expected for internal certificates. Ensure you're using the correct CA cert.

### Connection Errors

**Error: UNAVAILABLE (code 14)**
```
Error: 14 UNAVAILABLE: failed to connect to all addresses
```

**Possible causes:**
- Network connectivity issues
- Incorrect hostname/port
- Firewall blocking port 443
- Certificate validation failure

**Debug steps:**
```bash
# Test DNS
nslookup holmes-ads-v2.sharechat.internal

# Test port
nc -zv holmes-ads-v2.sharechat.internal 443

# Test TLS
openssl s_client -connect holmes-ads-v2.sharechat.internal:443
```

### Path Routing Errors

**Error: Method not found**
```
Error: 12 UNIMPLEMENTED: unknown service
```

**Possible causes:**
- Incorrect model path
- Path routing not configured in ingress
- Wrong method name

**Solution:** Verify model path in config:
```javascript
console.log('Using path:', config.MODEL_PATHS.BASELINE);
```

### Request Errors

**Error: INVALID_ARGUMENT (code 3)**
```
Error: 3 INVALID_ARGUMENT: Invalid protocol message input
```

**Possible causes:**
- Malformed SequenceExample
- Missing required features
- Wrong model signature

**Debug:**
```javascript
// Verify serialization
const hex = toHex(serializedExample);
console.log('Serialized hex:', hex.substring(0, 100));

// Check size
console.log('Size:', serializedExample.length, 'bytes');
```

### Timeout Errors

**Error: DEADLINE_EXCEEDED (code 4)**
```
Error: 4 DEADLINE_EXCEEDED: Deadline exceeded
```

**Solution:** Increase timeout:
```javascript
await makeIngressRequest({
  // ... other options
  timeout: 10000  // Increase to 10 seconds
});
```

## Performance Considerations

### Latency

Typical latency breakdown:
- **Direct pod:** 50-100ms
- **Via ingress:** 100-200ms (adds ~50-100ms overhead)

The ingress adds latency due to:
- TLS handshake
- Load balancer routing
- Additional network hops

### Optimization Tips

**1. Reuse connections:**
```javascript
// Bad: Creates new channel for each request
async function badExample() {
  for (let i = 0; i < 100; i++) {
    await makeIngressRequest({...});  // Creates new channel each time
  }
}

// Good: Reuse channel (requires refactoring client-ingress.js)
// Future enhancement
```

**2. Batch requests:** If possible, batch multiple predictions

**3. Adjust timeout:** Set appropriate timeout based on your SLA

**4. Monitor latency:**
```javascript
const start = Date.now();
const response = await makeIngressRequest({...});
const latency = Date.now() - start;
console.log('Latency:', latency, 'ms');
```

## Security Best Practices

### 1. Certificate Management

- **Don't commit certificates to git**
  ```bash
  echo "*.crt" >> .gitignore
  echo "*.pem" >> .gitignore
  ```

- **Rotate certificates regularly**
- **Store certificates securely** (use secrets management)

### 2. Credential Handling

- Never hardcode sensitive information
- Use environment variables for hostnames
- Implement proper access controls

### 3. Network Security

- Use ingress instead of direct pod access in production
- Ensure TLS is enabled (port 443)
- Monitor failed authentication attempts

## Migration from Pod to Ingress

### Step 1: Test connectivity
```bash
node test-ingress-baseline.js
```

### Step 2: Compare results
Run both pod and ingress clients with same input:
```bash
node client-with-builder.js     # Pod
node client-ingress.js          # Ingress
```

Verify predictions match (within floating point tolerance).

### Step 3: Update application code
Replace pod endpoint with ingress:

```javascript
// Before
const response = await makeDirectPodRequest(...);

// After
const response = await makeIngressRequest(...);
```

### Step 4: Monitor and validate
- Check error rates
- Monitor latency
- Validate prediction quality

## Production Deployment

### Checklist

- [ ] Valid TLS certificate obtained and tested
- [ ] Network connectivity verified
- [ ] All three model paths tested
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring/alerting setup
- [ ] Timeout values tuned
- [ ] Load testing completed
- [ ] Rollback plan prepared

### Configuration

Use environment variables for production:

```javascript
const config = {
  INGRESS_HOST: process.env.TF_SERVING_HOST || 'holmes-ads-v2.sharechat.internal',
  INGRESS_PORT: parseInt(process.env.TF_SERVING_PORT) || 443,
  CERT_PATH: process.env.TF_SERVING_CERT || 'ingress.crt',
  TIMEOUT: parseInt(process.env.TF_SERVING_TIMEOUT) || 5000
};
```

### Monitoring

Key metrics to track:
- Request latency (p50, p95, p99)
- Error rate by error code
- Success rate per model path
- Certificate expiration date
- TLS handshake time

## References

- [TensorFlow Serving gRPC API](https://www.tensorflow.org/tfx/serving/api_docs/cc)
- [@grpc/grpc-js Documentation](https://grpc.github.io/grpc/node/)
- [gRPC SSL/TLS Guide](https://grpc.io/docs/guides/auth/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Verify certificate and network connectivity
3. Review error codes and messages
4. Consult with infrastructure team for ingress issues
