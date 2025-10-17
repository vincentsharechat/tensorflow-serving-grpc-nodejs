#!/usr/bin/env node
/**
 * Test script for all TensorFlow Serving model variants via Ingress
 *
 * Tests all three model paths:
 * - BASELINE (ADS_LST_DNB_BASELINE)
 * - CONSERVATIVE (ADS_LST_DNB_CONSERVATIVE)
 * - AGGRESSIVE (ADS_LST_DNB_AGGRESSIVE)
 *
 * Compares predictions across models to verify routing works correctly.
 */

const { makeIngressRequest } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const config = require('./config');

// Test data
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

/**
 * Extract key metrics from response
 */
function extractMetrics(response) {
  const metrics = {};

  if (response && response.outputs) {
    for (const [key, tensor] of Object.entries(response.outputs)) {
      if (tensor.floatVal && tensor.floatVal.length > 0) {
        metrics[key] = tensor.floatVal[0];
      } else if (tensor.int64Val && tensor.int64Val.length > 0) {
        metrics[key] = tensor.int64Val[0];
      }
    }
  }

  return metrics;
}

/**
 * Display comparison table
 */
function displayComparison(results) {
  console.log('\n📊 MODEL COMPARISON\n');
  console.log('=' .repeat(80));

  // Get all unique metric names
  const allMetrics = new Set();
  for (const result of results) {
    Object.keys(result.metrics).forEach(m => allMetrics.add(m));
  }

  // Display header
  console.log('\nMetric'.padEnd(30),
    'BASELINE'.padEnd(16),
    'CONSERVATIVE'.padEnd(16),
    'AGGRESSIVE'.padEnd(16));
  console.log('-'.repeat(80));

  // Display each metric
  for (const metric of Array.from(allMetrics).sort()) {
    const values = results.map(r => {
      const val = r.metrics[metric];
      return val !== undefined ? val.toFixed(6) : 'N/A';
    });

    console.log(
      metric.padEnd(30),
      values[0].padEnd(16),
      values[1].padEnd(16),
      values[2].padEnd(16)
    );
  }

  console.log('=' .repeat(80));
}

/**
 * Test a single model
 */
async function testModel(modelConfig, serializedExample) {
  console.log(`\n🎯 Testing ${modelConfig.name}...`);
  console.log('   Path:', modelConfig.path);

  try {
    const response = await makeIngressRequest({
      serializedExample: serializedExample,
      modelName: modelConfig.name,
      signatureName: modelConfig.signature,
      ingressHost: config.INGRESS.HOST,
      modelPath: modelConfig.path,
      port: config.INGRESS.PORT,
      timeout: 5000,
      caCertPath: config.INGRESS.CERT_PATH
    });

    const metrics = extractMetrics(response);
    console.log('   ✅ Success!');

    // Display key metrics
    if (metrics.optimal_floor_price) {
      console.log(`   optimal_floor_price: ${metrics.optimal_floor_price.toFixed(4)}`);
    }
    if (metrics.fill_probability) {
      console.log(`   fill_probability: ${metrics.fill_probability.toFixed(4)}`);
    }

    return {
      model: modelConfig.name,
      path: modelConfig.path,
      success: true,
      metrics: metrics,
      response: response
    };

  } catch (error) {
    console.log('   ❌ Failed:', error.message);
    return {
      model: modelConfig.name,
      path: modelConfig.path,
      success: false,
      error: error.message,
      metrics: {}
    };
  }
}

/**
 * Main test function
 */
async function testAllModels() {
  console.log('🧪 Testing All Model Variants via Ingress\n');
  console.log('=' .repeat(80));
  console.log('Ingress:', config.INGRESS.HOST);
  console.log('Port:', config.INGRESS.PORT);
  console.log('Certificate:', config.INGRESS.CERT_PATH);
  console.log('=' .repeat(80));

  // Build SequenceExample once
  console.log('\n📝 Building SequenceExample...');
  const serializedExample = buildSequenceExample(featureListsData);
  console.log(`✅ Serialized to ${serializedExample.length} bytes`);

  // Test all three models
  const results = [];

  console.log('\n🚀 Testing models sequentially...\n');

  // Test BASELINE
  results.push(await testModel(config.MODELS.BASELINE, serializedExample));
  await sleep(500);  // Small delay between requests

  // Test CONSERVATIVE
  results.push(await testModel(config.MODELS.CONSERVATIVE, serializedExample));
  await sleep(500);

  // Test AGGRESSIVE
  results.push(await testModel(config.MODELS.AGGRESSIVE, serializedExample));

  // Display summary
  console.log('\n\n📋 SUMMARY\n');
  console.log('=' .repeat(80));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`✅ Successful: ${successCount}/3`);
  console.log(`❌ Failed: ${failCount}/3`);

  // List failures
  if (failCount > 0) {
    console.log('\nFailed models:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.model} (${r.path}): ${r.error}`);
    });
  }

  // Display comparison if all succeeded
  if (successCount === 3) {
    displayComparison(results);
  }

  console.log('');

  // Exit code based on results
  if (failCount === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else if (successCount > 0) {
    console.log('⚠️  Some tests failed\n');
    process.exit(1);
  } else {
    console.log('❌ All tests failed\n');
    process.exit(1);
  }
}

/**
 * Helper: sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testAllModels().catch(error => {
  console.error('\n💥 Unexpected error:', error.message);
  process.exit(1);
});
