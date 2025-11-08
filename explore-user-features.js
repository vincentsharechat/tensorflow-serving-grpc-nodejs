#!/usr/bin/env node
/**
 * Explore ars_user_features_v2 table for historical features
 */

const cassandra = require('cassandra-driver');
const config = require('./config');

async function exploreUserFeatures() {
  console.log('\n🔍 Exploring ars_user_features_v2 for Historical Features');
  console.log('═══════════════════════════════════════════════════════\n');

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

    // Show schema
    console.log('📊 Schema for ars_feature_store.ars_user_features_v2:\n');
    const schemaResult = await client.execute(
      `SELECT column_name, type, kind FROM system_schema.columns
       WHERE keyspace_name = 'ars_feature_store' AND table_name = 'ars_user_features_v2'`
    );

    console.log('Columns:');
    schemaResult.rows.forEach(row => {
      const kind = row.kind === 'partition_key' ? ' 🔑 PRIMARY KEY' :
                   row.kind === 'clustering' ? ' 📌 CLUSTERING' : '';
      console.log(`  - ${row.column_name}: ${row.type}${kind}`);
    });

    // Query sample data
    console.log(`\n🔎 Sample data (3 rows):\n`);
    const sampleResult = await client.execute(
      `SELECT * FROM ars_feature_store.ars_user_features_v2 LIMIT 3`
    );

    if (sampleResult.rows.length > 0) {
      sampleResult.rows.forEach((row, i) => {
        console.log(`\n📄 Row ${i + 1}:`);
        console.log(`─────────────────────────────────────────`);
        Object.keys(row).forEach(key => {
          const value = row[key];
          let displayValue;

          if (value === null || value === undefined) {
            displayValue = 'null';
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value);
          } else {
            displayValue = String(value);
          }

          // Truncate long values
          if (displayValue.length > 100) {
            displayValue = displayValue.substring(0, 100) + '...';
          }

          console.log(`  ${key}: ${displayValue}`);
        });
      });

      // Analyze feature types
      console.log(`\n\n🎯 Feature Analysis:`);
      console.log(`─────────────────────────────────────────\n`);

      const firstRow = sampleResult.rows[0];
      console.log(`Primary Key (ID): ${firstRow.id || 'unknown'}`);
      console.log(`Feature Set ID: ${firstRow.featuresetid || 'unknown'}`);
      console.log(`Feature Version: ${firstRow.featureversionid || 'unknown'}`);
      console.log(`Timestamp: ${firstRow.timestamp || 'unknown'}`);

      if (firstRow.value) {
        console.log(`\nValue format: ${typeof firstRow.value}`);
        const valueStr = String(firstRow.value);
        if (valueStr.includes('|')) {
          const parts = valueStr.split('|');
          console.log(`Value structure: Pipe-delimited (${parts.length} parts)`);
          console.log(`Sample parts: ${parts.slice(0, 5).join(' | ')}`);
        }
      }

      // Query specific user if possible
      console.log(`\n\n🔍 Query by specific ID (using first row's ID):\n`);
      const testId = firstRow.id;

      try {
        const userResult = await client.execute(
          `SELECT * FROM ars_feature_store.ars_user_features_v2 WHERE id = ? LIMIT 5`,
          [testId]
        );

        console.log(`Found ${userResult.rows.length} feature(s) for ID: ${testId}\n`);
        userResult.rows.forEach((row, i) => {
          console.log(`Feature ${i + 1}: ${row.featuresetid} (v${row.featureversionid})`);
          const val = String(row.value || '').substring(0, 80);
          console.log(`  Value: ${val}${row.value && row.value.length > 80 ? '...' : ''}`);
        });
      } catch (err) {
        console.log(`  Could not query by ID: ${err.message}`);
      }

    } else {
      console.log('  (No data found)\n');
    }

    // Summary
    console.log(`\n\n📋 Summary:`);
    console.log(`─────────────────────────────────────────`);
    console.log(`✅ Keyspace: ars_feature_store`);
    console.log(`✅ Table: ars_user_features_v2`);
    console.log(`✅ Structure: id (PRIMARY KEY), featuresetid (CLUSTERING), value, timestamp`);
    console.log(`✅ Can query by: id (user/campaign/creative identifier)`);
    console.log(`\n💡 This table stores versioned features for different entities`);
    console.log(`💡 Each entity (user/campaign) can have multiple feature sets`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.shutdown();
  }
}

exploreUserFeatures().catch(console.error);
