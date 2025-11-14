#!/usr/bin/env node
/**
 * Quick automated test for Scylla integration
 */

const ScyllaClient = require('./scylla-client');
const config = require('./config');

async function quickTest() {
  console.log('🧪 Quick Scylla Integration Test\n');

  const client = new ScyllaClient();
  let success = true;

  try {
    // Test 1: Connection
    console.log('✓ Test 1: Connecting to Scylla...');
    await client.connect();
    console.log('  ✅ Connected\n');

    // Test 2: Cluster info
    console.log('✓ Test 2: Getting cluster info...');
    const testResult = await client.testConnection();
    console.log(`  ✅ Cluster accessible\n`);

    // Test 3: List keyspaces
    console.log('✓ Test 3: Listing keyspaces...');
    const keyspaces = await client.listKeyspaces();
    console.log(`  ✅ Found ${keyspaces.length} keyspaces\n`);

    // Test 4: Get features with defaults
    console.log('✓ Test 4: Getting features with defaults...');
    const features = await client.getHistoricalFeaturesWithDefaults('test_gaid');
    console.log(`  ✅ Got features (using defaults): CTR=${features.historical_ctr}\n`);

    // Test 5: Batch query
    console.log('✓ Test 5: Batch query...');
    const batchResults = await client.batchGetHistoricalFeatures(['gaid1', 'gaid2']);
    console.log(`  ✅ Batch query completed (${batchResults.length} results)\n`);

    console.log('═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════\n');
    console.log('Summary:');
    console.log('  ✅ Scylla connection: Working');
    console.log('  ✅ Cluster access: Working');
    console.log('  ✅ Keyspace listing: Working');
    console.log('  ✅ Default features: Working');
    console.log('  ✅ Batch queries: Working');
    console.log('\n📋 Available keyspaces:');
    keyspaces.slice(0, 10).forEach(ks => console.log(`  - ${ks}`));
    if (keyspaces.length > 10) {
      console.log(`  ... and ${keyspaces.length - 10} more`);
    }
    console.log('\n📖 Next steps:');
    console.log('  1. Update config.js with correct KEYSPACE');
    console.log('  2. Update scylla-client.js with correct table/columns');
    console.log('  3. Run: npm run client:scylla');
    console.log('\n💡 See SCYLLA_SETUP.md for details');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    success = false;
  } finally {
    await client.close();
  }

  process.exit(success ? 0 : 1);
}

quickTest();
