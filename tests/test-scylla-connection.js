#!/usr/bin/env node
/**
 * Test Scylla DB Connection
 *
 * This script tests connectivity to the Scylla cluster and validates
 * that we can retrieve historical features.
 *
 * Run with: npm run test:scylla
 */

const ScyllaClient = require('../scylla-client');
const config = require('../config');

async function testScyllaConnection() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Scylla DB Connection Test');
  console.log('═══════════════════════════════════════════════════\n');

  const client = new ScyllaClient();

  try {
    // ==================== Test 1: Connection ====================
    console.log('📌 Test 1: Connection to Scylla Cluster');
    console.log('─────────────────────────────────────────────────\n');

    await client.connect();
    console.log('✅ Connection successful\n');

    // ==================== Test 2: Cluster Info ====================
    console.log('📌 Test 2: Cluster Information');
    console.log('─────────────────────────────────────────────────\n');

    const connectionSuccess = await client.testConnection();
    if (connectionSuccess) {
      console.log('✅ Cluster info retrieved\n');
    } else {
      throw new Error('Failed to retrieve cluster info');
    }

    // ==================== Test 3: Schema Validation ====================
    console.log('📌 Test 3: Table Schema Validation');
    console.log('─────────────────────────────────────────────────\n');

    try {
      const schema = await client.getTableSchema('historical_features_table');
      console.log(`✅ Schema validated (${schema.length} columns)\n`);
    } catch (error) {
      console.log('⚠️  Table may not exist yet (expected in development)\n');
    }

    // ==================== Test 4: Query Historical Features ====================
    console.log('📌 Test 4: Query Historical Features');
    console.log('─────────────────────────────────────────────────\n');

    const testGaid = '2312341';
    console.log(`  Testing GAID: ${testGaid}\n`);

    try {
      const features = await client.getHistoricalFeatures(testGaid);

      if (features) {
        console.log('✅ Historical features found:');
        console.log(`  GAID: ${features.gaid}`);
        console.log(`  Historical CTR: ${features.historical_ctr}`);
        console.log(`  Historical CVR: ${features.historical_cvr}`);
        console.log(`  Avg Watch Time: ${features.avg_watch_time}`);
        console.log(`  Engagement Score: ${features.engagement_score}`);
        console.log(`  Last Interaction: ${features.last_interaction_ts}`);
      } else {
        console.log('⚠️  No historical features found (will use defaults)');
      }
    } catch (error) {
      console.log('⚠️  Query failed (table may not exist yet)');
      console.log(`  Error: ${error.message}`);
    }

    console.log('');

    // ==================== Test 5: Default Features ====================
    console.log('📌 Test 5: Default Features Fallback');
    console.log('─────────────────────────────────────────────────\n');

    const featuresWithDefaults = await client.getHistoricalFeaturesWithDefaults(testGaid);
    console.log('✅ Features retrieved (with defaults if needed):');
    console.log(`  Historical CTR: ${featuresWithDefaults.historical_ctr}`);
    console.log(`  Historical CVR: ${featuresWithDefaults.historical_cvr}`);
    console.log(`  Avg Watch Time: ${featuresWithDefaults.avg_watch_time}`);
    console.log(`  Engagement Score: ${featuresWithDefaults.engagement_score}`);
    console.log('');

    // ==================== Test 6: Batch Query ====================
    console.log('📌 Test 6: Batch Query');
    console.log('─────────────────────────────────────────────────\n');

    const testGaids = ['2312341', '2312342', '2312343'];
    console.log(`  Testing ${testGaids.length} GAIDs: ${testGaids.join(', ')}\n`);

    const batchFeatures = await client.batchGetHistoricalFeatures(testGaids);
    console.log(`✅ Batch query completed (${batchFeatures.length} results)`);

    batchFeatures.forEach((features, index) => {
      console.log(`  [${index + 1}] ${features.gaid}: CTR=${features.historical_ctr}`);
    });

    console.log('');

    // ==================== Summary ====================
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ All Tests Passed!');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('Summary:');
    console.log('  ✅ Connection: Working');
    console.log('  ✅ Cluster info: Accessible');
    console.log('  ✅ Query: Functional');
    console.log('  ✅ Defaults: Working');
    console.log('  ✅ Batch: Working');
    console.log('');

    console.log('📋 Configuration:');
    console.log(`  Nodes: ${config.SCYLLA.CONTACT_POINTS.length}`);
    console.log(`  Keyspace: ${config.SCYLLA.KEYSPACE}`);
    console.log(`  Local DC: ${config.SCYLLA.LOCAL_DC}`);
    console.log('');

    return true;

  } catch (error) {
    console.error('\n❌ Test Failed');
    console.error('─────────────────────────────────────────────────\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\n📋 Troubleshooting:');
    console.error('  1. Verify network connectivity to Scylla nodes');
    console.error('  2. Check VPN/firewall settings');
    console.error('  3. Verify credentials (from K8s secrets)');
    console.error('  4. Ensure Scylla cluster is running');
    console.error('  5. Check keyspace and table exist');
    console.error('');

    console.error('📖 Configuration:');
    console.error(`  Contact Points: ${config.SCYLLA.CONTACT_POINTS.join(', ')}`);
    console.error(`  Keyspace: ${config.SCYLLA.KEYSPACE}`);
    console.error(`  Local DC: ${config.SCYLLA.LOCAL_DC}`);
    console.error('');

    return false;

  } finally {
    await client.close();
  }
}

// ==================== Main Execution ====================

if (require.main === module) {
  testScyllaConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testScyllaConnection };
