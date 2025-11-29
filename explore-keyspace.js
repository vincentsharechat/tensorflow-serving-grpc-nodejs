#!/usr/bin/env node
/**
 * Explore actual Scylla keyspaces and query data
 */

const cassandra = require('cassandra-driver');
const config = require('./config');

async function exploreKeyspace(keyspaceName) {
  console.log(`\n🔍 Exploring Keyspace: ${keyspaceName}`);
  console.log('═══════════════════════════════════════\n');

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

    // List tables in keyspace
    console.log(`📋 Tables in ${keyspaceName}:\n`);
    const tablesResult = await client.execute(
      `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
      [keyspaceName]
    );

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach((table, i) => {
      console.log(`  ${i + 1}. ${table}`);
    });

    if (tables.length === 0) {
      console.log('  (No tables found)\n');
      return;
    }

    // Pick first table and show schema
    const firstTable = tables[0];
    console.log(`\n📊 Schema for '${firstTable}':\n`);

    const schemaResult = await client.execute(
      `SELECT column_name, type, kind FROM system_schema.columns
       WHERE keyspace_name = ? AND table_name = ?`,
      [keyspaceName, firstTable]
    );

    console.log('Columns:');
    schemaResult.rows.forEach(row => {
      const kind = row.kind === 'partition_key' ? ' (PRIMARY KEY)' :
                   row.kind === 'clustering' ? ' (CLUSTERING)' : '';
      console.log(`  - ${row.column_name}: ${row.type}${kind}`);
    });

    // Try to query sample data
    console.log(`\n🔎 Sample data from '${firstTable}':\n`);
    try {
      const sampleResult = await client.execute(
        `SELECT * FROM ${keyspaceName}.${firstTable} LIMIT 3`
      );

      if (sampleResult.rows.length > 0) {
        console.log(`Found ${sampleResult.rows.length} rows:\n`);
        sampleResult.rows.forEach((row, i) => {
          console.log(`Row ${i + 1}:`);
          Object.keys(row).forEach(key => {
            const value = row[key];
            const displayValue = value !== null && value !== undefined ?
              (typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : String(value).substring(0, 50)) :
              'null';
            console.log(`  ${key}: ${displayValue}`);
          });
          console.log('');
        });
      } else {
        console.log('  (No data in table)\n');
      }
    } catch (queryError) {
      console.log(`  ⚠️  Could not query table: ${queryError.message}\n`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
  } finally {
    await client.shutdown();
  }
}

async function main() {
  // Try exploring multiple keyspaces
  const keyspacesToTry = [
    'ars_feature_store',
    'ad_relevance_service',
    'ars_attributes_store'
  ];

  for (const keyspace of keyspacesToTry) {
    await exploreKeyspace(keyspace);
  }

  console.log('\n✅ Exploration complete!\n');
}

main().catch(console.error);
