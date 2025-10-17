#!/usr/bin/env node
/**
 * ✅ TensorFlow Serving Ingress Client with TLS and Custom Path Routing
 *
 * This client connects to TensorFlow Serving via ingress with:
 * - TLS/SSL encryption (port 443)
 * - Custom path routing for model variants (BASELINE, CONSERVATIVE, AGGRESSIVE)
 * - Certificate-based authentication
 * - Support for optional "common" input tensor
 *
 * Equivalent to Python's channel.unary_unary() with custom method path
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const protobuf = require('protobufjs');
const path = require('path');
const fs = require('fs');
const { buildSequenceExample, toHex } = require('./sequence-example-builder');
const config = require('./config');

/**
 * Makes a gRPC prediction request to TensorFlow Serving via ingress
 *
 * @param {Object} options - Request options
 * @param {Buffer} options.serializedExample - Serialized SequenceExample
 * @param {string} options.modelName - Model name (e.g., 'dnb_model_baseline')
 * @param {string} options.signatureName - Signature name (default: 'serving_default')
 * @param {string} options.ingressHost - Ingress hostname
 * @param {string} options.modelPath - Custom path for routing (e.g., 'ADS_LST_DNB_BASELINE')
 * @param {number} options.port - Port number (default: 443 for TLS, 80 for insecure)
 * @param {Buffer} options.serializedCommon - Optional serialized common features
 * @param {number} options.timeout - Timeout in milliseconds (default: 1000)
 * @param {string} options.caCertPath - Path to CA certificate file (default: 'ingress.crt')
 * @returns {Promise<Object>} - Prediction response
 */
async function makeIngressRequest(options) {
  const {
    serializedExample,
    modelName,
    signatureName = config.DEFAULTS.SIGNATURE,
    ingressHost,
    modelPath,
    port = 443,
    serializedCommon = null,
    timeout = config.DEFAULTS.TIMEOUT,
    caCertPath = config.INGRESS.CERT_PATH
  } = options;

  // Validate required parameters
  if (!serializedExample) {
    throw new Error('serializedExample is required');
  }
  if (!modelName) {
    throw new Error('modelName is required');
  }
  if (!ingressHost) {
    throw new Error('ingressHost is required');
  }
  if (!modelPath) {
    throw new Error('modelPath is required (e.g., ADS_LST_DNB_BASELINE)');
  }

  console.log('🔐 TensorFlow Serving Ingress Client\n');
  console.log('🌐 Ingress Host:', ingressHost);
  console.log('🔌 Port:', port);
  console.log('🛣️  Model Path:', modelPath);
  console.log('🎯 Model:', modelName);
  console.log('📝 Signature:', signatureName);
  console.log('');

  // Load Protocol Buffer definitions
  const root = protobuf.loadSync([
    path.join(__dirname, 'proto/predict.proto'),
    path.join(__dirname, 'proto/tensor.proto')
  ]);

  const PredictRequest = root.lookupType('tensorflow.serving.PredictRequest');
  const PredictResponse = root.lookupType('tensorflow.serving.PredictResponse');

  // Setup credentials
  let credentials;
  if (port === 443) {
    // TLS/SSL with certificate
    if (!fs.existsSync(caCertPath)) {
      throw new Error(`Certificate file not found: ${caCertPath}`);
    }

    const certContent = fs.readFileSync(caCertPath);
    if (certContent.length === 0) {
      throw new Error(`Certificate file is empty: ${caCertPath}. Please provide a valid certificate.`);
    }

    console.log('🔒 Using TLS with certificate:', caCertPath);
    credentials = grpc.credentials.createSsl(certContent);
  } else {
    // Insecure for port 80
    console.log('⚠️  Using insecure connection (no TLS)');
    credentials = grpc.credentials.createInsecure();
  }

  // Create client with credentials
  const target = `${ingressHost}:${port}`;
  const client = new grpc.Client(target, credentials);

  console.log('🔗 Connected to:', target);
  console.log('⏳ Making prediction request...\n');

  // Build request payload
  const inputs = {
    'examples': {
      dtype: config.DEFAULTS.DTYPE_STRING,
      tensorShape: {
        dim: [{ size: 1 }]
      },
      stringVal: [serializedExample]
    }
  };

  // Add optional common input
  if (serializedCommon) {
    inputs['common'] = {
      dtype: config.DEFAULTS.DTYPE_STRING,
      tensorShape: {
        dim: [{ size: 1 }]
      },
      stringVal: [serializedCommon]
    };
    console.log('📦 Including "common" input tensor');
  }

  // Create PredictRequest
  const requestPayload = {
    modelSpec: {
      name: modelName,
      signatureName: signatureName
    },
    inputs: inputs
  };

  // Verify and encode request
  const errMsg = PredictRequest.verify(requestPayload);
  if (errMsg) {
    throw new Error(`Invalid PredictRequest: ${errMsg}`);
  }

  const request = PredictRequest.create(requestPayload);
  const requestBuffer = PredictRequest.encode(request).finish();

  console.log('📤 Request size:', requestBuffer.length, 'bytes');

  // Custom method path: /{custom_path}/{package.Service}/{Method}
  const methodPath = `/${modelPath}/tensorflow.serving.PredictionService/Predict`;
  console.log('🛤️  Method path:', methodPath);
  console.log('');

  // Make the unary request with custom path
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;

    const call = client.makeUnaryRequest(
      methodPath,
      // Serializer: encode PredictRequest to bytes
      (value) => {
        const message = PredictRequest.create(value);
        return PredictRequest.encode(message).finish();
      },
      // Deserializer: decode bytes to PredictResponse
      (buffer) => {
        return PredictResponse.decode(buffer);
      },
      request,
      new grpc.Metadata(),
      { deadline: deadline },
      (error, response) => {
        // Close client after request
        client.close();

        if (error) {
          console.error('❌ Request failed:', error.code, error.message);
          console.error('   Details:', error.details);
          reject(error);
          return;
        }

        console.log('✅ SUCCESS!\n');
        resolve(response);
      }
    );
  });
}

/**
 * Display prediction results in a formatted way
 */
function displayResults(response) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 MODEL PREDICTIONS\n');

  if (response.outputs) {
    const outputNames = Object.keys(response.outputs).sort();

    for (const outputName of outputNames) {
      const tensor = response.outputs[outputName];

      console.log(`  ${outputName}:`);

      // Display float values
      if (tensor.floatVal && tensor.floatVal.length > 0) {
        const value = tensor.floatVal[0];
        console.log(`    Value: ${value}`);
      }

      // Display int values
      if (tensor.int64Val && tensor.int64Val.length > 0) {
        const value = tensor.int64Val[0];
        console.log(`    Value: ${value}`);
      }

      // Display shape
      if (tensor.tensorShape && tensor.tensorShape.dim) {
        const shape = tensor.tensorShape.dim.map(d => d.size).join(' × ');
        console.log(`    Shape: [${shape}]`);
      }

      console.log('');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Display model info
  if (response.modelSpec) {
    console.log('\n📋 Model Info:');
    console.log(`  Name: ${response.modelSpec.name}`);
    console.log(`  Signature: ${response.modelSpec.signatureName}`);
    if (response.modelSpec.version) {
      console.log(`  Version: ${response.modelSpec.version.value}`);
    }
  }

  console.log('\n✨ Done!');
}

// Example usage if run directly
if (require.main === module) {
  (async () => {
    try {
      // Example feature data
      const featureListsData = {
        "ad_type": ["SC_CPCV_1"],
        "adsuuid": ["0532afbb-3c85-4776-b5c6-d908a47c1441"],
        "ageRange": ["18-24"],
        "city": ["koppal"],
        "feed_fetch_counter": ["1"],
        "gender": ["F"],
        "language": ["tamil"],
        "osVersion": ["rest"],
        "phoneCarrier": ["ind airtel"],
        "phoneModel": ["oppo cph2681"],
        "sourceApp": ["SC"],
        "state": ["karnataka"],
        "time": ["2025-10-10 22:02:24"],
        "userid": ["749603295"]
      };

      console.log('📝 Building SequenceExample...');
      const serializedExample = buildSequenceExample(featureListsData);
      console.log(`✅ Serialized to ${serializedExample.length} bytes\n`);

      // Make request to BASELINE model via ingress
      const response = await makeIngressRequest({
        serializedExample: serializedExample,
        modelName: config.MODELS.BASELINE.name,
        signatureName: config.MODELS.BASELINE.signature,
        ingressHost: config.INGRESS.HOST,
        modelPath: config.MODELS.BASELINE.path,
        port: config.INGRESS.PORT,
        timeout: 5000,  // 5 second timeout
        caCertPath: config.INGRESS.CERT_PATH
      });

      displayResults(response);
    } catch (error) {
      console.error('\n💥 Error:', error.message);
      process.exit(1);
    }
  })();
}

// Export for use in other modules
module.exports = {
  makeIngressRequest,
  displayResults
};
