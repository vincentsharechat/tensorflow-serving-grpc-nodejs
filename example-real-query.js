#!/usr/bin/env node
/**
 * Real working example with actual Scylla data
 *
 * This demonstrates querying actual user features from ars_feature_store
 */

const cassandra = require('cassandra-driver');
const config = require('./config');

async function queryRealUserFeatures(userId) {
  console.log('\n🎯 Querying Real User Features from Scylla');
  console.log('═══════════════════════════════════════════════\n');

  const authProvider = new cassandra.auth.PlainTextAuthProvider(
    config.SCYLLA.CREDENTIALS.username,
    config.SCYLLA.CREDENTIALS.password
  );

  const client = new cassandra.Client({
    contactPoints: config.SCYLLA.CONTACT_POINTS,
    localDataCenter: config.SCYLLA.LOCAL_DC,
    authProvider: authProvider,
    protocolOptions: { port: config.SCYLLA.PORT },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Scylla\n');

    // Query all features for a user
    console.log(`📊 Fetching features for user: ${userId}\n`);

    const result = await client.execute(
      `SELECT id, featuresetid, featureversionid, timestamp, value
       FROM ars_feature_store.ars_user_features_v2
       WHERE id = ?
       LIMIT 10`,
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('⚠️  No features found for this user\n');
      console.log('💡 Tip: Run this to find a valid user ID:');
      console.log('   SELECT id FROM ars_feature_store.ars_user_features_v2 LIMIT 1;\n');
      return null;
    }

    console.log(`✅ Found ${result.rows.length} feature set(s):\n`);

    const features = {};

    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.featuresetid} (version: ${row.featureversionid})`);
      console.log(`   Timestamp: ${row.timestamp}`);

      const valueStr = String(row.value || '');
      const preview = valueStr.substring(0, 80);
      console.log(`   Value: ${preview}${valueStr.length > 80 ? '...' : ''}`);

      // Parse value
      if (valueStr.includes('|')) {
        const parts = valueStr.split('|');
        console.log(`   Format: Pipe-delimited (${parts.length} values)`);
        features[row.featuresetid] = {
          type: 'pipe-delimited',
          values: parts.map(v => parseFloat(v) || 0),
          raw: valueStr
        };
      } else if (valueStr.includes(':')) {
        const parts = valueStr.split(':');
        console.log(`   Format: Colon-delimited (${parts.length} values)`);
        features[row.featuresetid] = {
          type: 'colon-delimited',
          values: parts.map(v => parseFloat(v) || 0),
          raw: valueStr
        };
      }

      console.log('');
    });

    // Show how to use these features for inference
    console.log('\n💡 Using Features for Inference:');
    console.log('─────────────────────────────────────────\n');

    if (features['user_engagement_features_6m']) {
      const engagementFeatures = features['user_engagement_features_6m'];
      const values = engagementFeatures.values;

      console.log('Example: user_engagement_features_6m');
      console.log(`  Total values: ${values.length}`);
      console.log(`  Sample values: ${values.slice(0, 5).join(', ')}...`);
      console.log('');
      console.log('  Can be used as:');
      console.log('  {');
      console.log('    user_engagement_0: [values[0]],');
      console.log('    user_engagement_1: [values[1]],');
      console.log('    user_engagement_2: [values[2]],');
      console.log('    ...');
      console.log('  }');
      console.log('');
    }

    // Example integration
    console.log('\n🔗 Integration Example:');
    console.log('─────────────────────────────────────────\n');
    console.log('const { runInferencePipeline } = require(\'./client-with-scylla\');\n');
    console.log('// Fetch historical features from Scylla');
    console.log(`const features = await fetchUserFeatures('${userId}');\n`);
    console.log('// Combine with real-time features');
    console.log('const result = await runInferencePipeline(');
    console.log(`  '${userId}',`);
    console.log('  {');
    console.log('    ad_type: [\'SC_CPCV_1\'],');
    console.log('    // Add parsed historical features here');
    console.log('    ...features');
    console.log('  }');
    console.log(');\n');
    console.log('console.log(result.predictions);');

    return features;

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    throw error;
  } finally {
    await client.shutdown();
  }
}

async function main() {
  // Get a sample user ID from the database
  console.log('🔍 Finding a sample user...\n');

  const authProvider = new cassandra.auth.PlainTextAuthProvider(
    config.SCYLLA.CREDENTIALS.username,
    config.SCYLLA.CREDENTIALS.password
  );

  const client = new cassandra.Client({
    contactPoints: config.SCYLLA.CONTACT_POINTS,
    localDataCenter: config.SCYLLA.LOCAL_DC,
    authProvider: authProvider,
    protocolOptions: { port: config.SCYLLA.PORT },
  });

  await client.connect();

  const sampleResult = await client.execute(
    'SELECT id FROM ars_feature_store.ars_user_features_v2 LIMIT 1'
  );

  await client.shutdown();

  if (sampleResult.rows.length > 0) {
    const sampleUserId = sampleResult.rows[0].id;
    console.log(`✅ Found sample user: ${sampleUserId}\n`);

    // Query features for this user
    await queryRealUserFeatures(sampleUserId);
  } else {
    console.log('⚠️  No users found in database\n');
  }

  console.log('\n✅ Query Complete!\n');
  console.log('📚 Next Steps:');
  console.log('  1. Update scylla-client.js to query ars_user_features_v2');
  console.log('  2. Parse feature values (pipe or colon delimited)');
  console.log('  3. Map to your model\'s expected features');
  console.log('  4. Run: npm run client:scylla\n');
}

main().catch(console.error);
