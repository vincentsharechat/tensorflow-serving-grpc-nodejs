#!/usr/bin/env node
/**
 * Test Script for Simplified Scylla + Inference Client
 *
 * This demonstrates how to use the simplified client for predictions.
 */

const SimpleInferenceClient = require('./simple-scylla-client');

// Test 1: Single prediction
async function testSinglePrediction() {
  console.log('\n=== Test 1: Single Prediction ===\n');

  const client = new SimpleInferenceClient({ verbose: true });

  try {
    await client.initialize();

    // Make a prediction for a specific user, ad type, and source app
    const result = await client.predict(
      '123456',      // userid
      'SC_CPCV_1',   // adType (ad campaign type)
      'SC',          // sourceApp ('SC' for ShareChat, 'MJ' for Moj)
      {
        // Optional: Add real-time features
        campaign_id: ['789'],
        creative_id: ['101112']
      }
    );

    console.log('\n📊 Prediction Result:');
    console.log('  User ID:', result.userid);
    console.log('  Ad Type:', result.adType);
    console.log('  Source App:', result.sourceApp);
    console.log('\n  Historical Features (from Scylla):');
    console.log('    1-day winrate:', result.historicalFeatures.winrate_1_day);
    console.log('    7-day winrate:', result.historicalFeatures.winrate_7_day);
    console.log('    1-day avg winning bid:', result.historicalFeatures.winning_bid_avg_1_day);
    console.log('\n  Predictions (from TF Serving):');
    console.log(JSON.stringify(result.predictions, null, 4));

    return result;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Test 2: Batch predictions
async function testBatchPredictions() {
  console.log('\n=== Test 2: Batch Predictions ===\n');

  const client = new SimpleInferenceClient({ verbose: false });

  try {
    await client.initialize();

    // Batch predictions for multiple users
    const requests = [
      { userid: '123456', adType: 'SC_CPCV_1', sourceApp: 'SC' },
      { userid: '789012', adType: 'SC_CPCV_1', sourceApp: 'SC' },
      { userid: '345678', adType: 'SC_CPC_1', sourceApp: 'MJ' }
    ];

    const results = await client.batchPredict(requests, {
      campaign_id: ['789']  // Shared feature for all requests
    });

    console.log('📊 Batch Results:\n');
    results.forEach((result, index) => {
      console.log(`[${index + 1}] User ${result.userid} (${result.adType}, ${result.sourceApp})`);
      console.log(`    Winrate (1d/7d): ${result.historicalFeatures.winrate_1_day} / ${result.historicalFeatures.winrate_7_day}`);
      console.log(`    Predictions:`, result.predictions);
      console.log('');
    });

    return results;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Test 3: Test Scylla connection only (no inference)
async function testScyllaOnly() {
  console.log('\n=== Test 3: Scylla Connection Only ===\n');

  const SimpleInferenceClient = require('./simple-scylla-client');
  const client = new SimpleInferenceClient({ verbose: true });

  try {
    await client.initialize();

    // Just fetch historical features
    const features = await client.getHistoricalFeatures('123456', 'SC_CPCV_1', 'SC');

    console.log('\n📊 Historical Features Retrieved:');
    console.log(JSON.stringify(features, null, 2));

    return features;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  const test = process.argv[2] || 'single';

  try {
    switch (test) {
      case 'single':
        await testSinglePrediction();
        break;
      case 'batch':
        await testBatchPredictions();
        break;
      case 'scylla':
        await testScyllaOnly();
        break;
      case 'all':
        await testScyllaOnly();
        await testSinglePrediction();
        await testBatchPredictions();
        break;
      default:
        console.log('Usage: node test-simple-client.js [single|batch|scylla|all]');
        console.log('');
        console.log('Tests:');
        console.log('  single  - Test single prediction (default)');
        console.log('  batch   - Test batch predictions');
        console.log('  scylla  - Test Scylla connection only');
        console.log('  all     - Run all tests');
        process.exit(1);
    }

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testSinglePrediction,
  testBatchPredictions,
  testScyllaOnly
};
