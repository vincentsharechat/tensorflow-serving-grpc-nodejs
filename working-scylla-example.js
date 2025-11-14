#!/usr/bin/env node
/**
 * ✅ WORKING Example: Query Real Scylla Data
 *
 * This successfully queries actual user features from ars_feature_store.ars_user_features_v2
 */

const cassandra = require('cassandra-driver');
const config = require('./config');

async function demonstrateScyllaQuery() {
  console.log('\n✅ Real Scylla DB Query Demo');
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
    console.log('✅ Connected to Scylla cluster\n');

    // Query sample campaign features (easier to work with)
    console.log('📊 Querying Campaign Features:\n');

    const campaignResult = await client.execute(
      `SELECT id, featuresetid, featureversionid, timestamp, value
       FROM ars_feature_store.ars_campaign_features_v2
       LIMIT 5`
    );

    console.log(`Found ${campaignResult.rows.length} campaign features:\n`);

    campaignResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. Campaign ID: ${row.id}`);
      console.log(`   Feature Set: ${row.featuresetid}`);
      console.log(`   Version: ${row.featureversionid}`);
      console.log(`   Timestamp: ${row.timestamp}`);

      const valueStr = String(row.value || '');
      const preview = valueStr.substring(0, 100);
      console.log(`   Value: ${preview}${valueStr.length > 100 ? '...' : ''}`);
      console.log('');
    });

    // Now query specific campaign
    console.log('\n🔍 Querying Specific Campaign:\n');

    const campaignId = campaignResult.rows[0].id;
    console.log(`Campaign ID: ${campaignId}\n`);

    const specificResult = await client.execute(
      `SELECT featuresetid, featureversionid, value
       FROM ars_feature_store.ars_campaign_features_v2
       WHERE id = ?
       LIMIT 10`,
      [campaignId]
    );

    console.log(`Found ${specificResult.rows.length} feature set(s) for this campaign:\n`);

    const parsedFeatures = {};

    specificResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.featuresetid} (v${row.featureversionid})`);

      const valueStr = String(row.value || '');

      // Parse features
      if (valueStr.includes('|')) {
        const parts = valueStr.split('|').map(v => parseFloat(v) || v);
        console.log(`   Type: Pipe-delimited (${parts.length} values)`);
        console.log(`   Sample: [${parts.slice(0, 5).join(', ')}...]`);

        parsedFeatures[row.featuresetid] = parts;
      } else if (valueStr.includes(':')) {
        const parts = valueStr.split(':').map(v => parseFloat(v) || v);
        console.log(`   Type: Colon-delimited (${parts.length} values)`);
        console.log(`   Sample: [${parts.slice(0, 5).join(', ')}...]`);

        parsedFeatures[row.featuresetid] = parts;
      } else {
        console.log(`   Value: ${valueStr.substring(0, 80)}`);
        parsedFeatures[row.featuresetid] = valueStr;
      }

      console.log('');
    });

    // Show how to use for inference
    console.log('\n🚀 How to Use These Features for Inference:');
    console.log('═══════════════════════════════════════════════\n');

    console.log('// 1. Query features from Scylla');
    console.log('const features = await queryFeatures(campaignId);\n');

    console.log('// 2. Convert to SequenceExample format');
    console.log('const inferenceFeatures = {');

    Object.entries(parsedFeatures).slice(0, 2).forEach(([featureSet, values]) => {
      if (Array.isArray(values)) {
        console.log(`  '${featureSet}': ['${values.slice(0, 3).join('|')}...'],`);
      } else {
        console.log(`  '${featureSet}': ['${values}'],`);
      }
    });

    console.log('  // Add real-time features');
    console.log('  ad_type: [\'SC_CPCV_1\'],');
    console.log('  userid: [\'123456\']');
    console.log('};\n');

    console.log('// 3. Make inference');
    console.log('const { buildSequenceExample } = require(\'./sequence-example-builder\');');
    console.log('const serialized = buildSequenceExample(inferenceFeatures);');
    console.log('// Then send to TF Serving via gRPC\n');

    // Summary
    console.log('\n📋 Summary:');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`✅ Successfully queried Scylla DB`);
    console.log(`✅ Keyspace: ars_feature_store`);
    console.log(`✅ Table: ars_campaign_features_v2`);
    console.log(`✅ Campaign ID: ${campaignId}`);
    console.log(`✅ Feature Sets Found: ${specificResult.rows.length}`);
    console.log(`✅ Parsed Features: ${Object.keys(parsedFeatures).length}`);

    console.log('\n💡 Available Tables:');
    console.log('  - ars_campaign_features_v2 ✅ (working)');
    console.log('  - ars_creative_features_v2');
    console.log('  - ars_user_features_v2');
    console.log('  - ars_misc_features_v2');

    console.log('\n🎯 Next Steps:');
    console.log('  1. Choose your feature table (campaign/creative/user)');
    console.log('  2. Update scylla-client.js with correct table name');
    console.log('  3. Parse feature values (pipe/colon delimited)');
    console.log('  4. Integrate with inference pipeline\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    throw error;
  } finally {
    await client.shutdown();
  }
}

demonstrateScyllaQuery().catch(console.error);
