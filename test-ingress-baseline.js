#!/usr/bin/env node
/**
 * Test script for TensorFlow Serving Ingress - BASELINE Model
 *
 * Tests connectivity to holmes-ads-v2.sharechat.internal via ingress
 * with TLS and custom path routing to the BASELINE model.
 */

const { makeIngressRequest, displayResults } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const config = require('./config');

async function testBaselineModel() {
  console.log('🧪 Testing BASELINE Model via Ingress\n');
  console.log('=' .repeat(60));
  console.log('');

  // Test data - same as used in client-with-builder.js
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

  try {
    // Build SequenceExample
    console.log('📝 Building SequenceExample with', Object.keys(featureListsData).length, 'features...');
    const serializedExample = buildSequenceExample(featureListsData);
    console.log(`✅ Serialized to ${serializedExample.length} bytes\n`);

    // Make request
    const response = await makeIngressRequest({
      serializedExample: serializedExample,
      modelName: config.MODELS.BASELINE.name,
      signatureName: config.MODELS.BASELINE.signature,
      ingressHost: config.INGRESS.HOST,
      modelPath: config.MODELS.BASELINE.path,
      port: config.INGRESS.PORT,
      timeout: 5000,
      caCertPath: config.INGRESS.CERT_PATH
    });

    // Display results
    displayResults(response);

    console.log('\n✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);

    if (error.code === 'ENOENT') {
      console.error('\n💡 Certificate file not found. Please ensure ingress.crt exists.');
    } else if (error.code === 14) {
      console.error('\n💡 Connection error. Check:');
      console.error('   - Ingress hostname is correct');
      console.error('   - Network connectivity to ingress');
      console.error('   - Certificate is valid');
    }

    process.exit(1);
  }
}

// Run test
testBaselineModel();
