/**
 * Scylla DB Client for Historical Features
 *
 * Based on ARS db-driver-v2 pattern:
 * https://github.com/ShareChat/ads-ds-services/blob/master/ad-relevance-service/internal/infrastructure/dbDriverV2/
 *
 * Handles 21B requests/day with:
 * - Prepared statements for performance
 * - Connection pooling
 * - Automatic failover across nodes
 */

const cassandra = require('cassandra-driver');
const config = require('./config');

class ScyllaClient {
  constructor(scyllaConfig = config.SCYLLA) {
    this.config = scyllaConfig;
    this.client = null;
    this.preparedStatements = {};
  }

  /**
   * Connect to Scylla cluster
   */
  async connect() {
    if (this.client) {
      console.log('ScyllaClient: Already connected');
      return;
    }

    console.log('ScyllaClient: Connecting to Scylla cluster...');
    console.log(`  Contact points: ${this.config.CONTACT_POINTS.join(', ')}`);
    console.log(`  Keyspace: ${this.config.KEYSPACE}`);

    const authProvider = new cassandra.auth.PlainTextAuthProvider(
      this.config.CREDENTIALS.username,
      this.config.CREDENTIALS.password
    );

    this.client = new cassandra.Client({
      contactPoints: this.config.CONTACT_POINTS,
      localDataCenter: this.config.LOCAL_DC,
      authProvider: authProvider,
      protocolOptions: { port: this.config.PORT },
      socketOptions: {
        connectTimeout: this.config.CONNECTION_TIMEOUT,
        readTimeout: this.config.REQUEST_TIMEOUT
      },
      pooling: {
        coreConnectionsPerHost: {
          [cassandra.types.distance.local]: 10,
          [cassandra.types.distance.remote]: 1
        }
      }
    });

    await this.client.connect();
    console.log('ScyllaClient: Connected successfully');

    // Try to use keyspace if configured
    if (this.config.KEYSPACE) {
      try {
        await this.client.execute(`USE ${this.config.KEYSPACE}`);
        console.log(`ScyllaClient: Using keyspace: ${this.config.KEYSPACE}`);

        // Prepare common statements
        await this.prepareStatements();
      } catch (error) {
        console.log(`⚠️  Keyspace '${this.config.KEYSPACE}' not found`);
        console.log('   Available keyspaces:');
        const keyspaces = await this.listKeyspaces();
        keyspaces.forEach(ks => console.log(`   - ${ks}`));
        console.log('   Update config.js with the correct keyspace name');
      }
    }
  }

  /**
   * Prepare CQL statements for optimal performance
   */
  async prepareStatements() {
    console.log('ScyllaClient: Preparing statements...');

    // Query for historical features by GAID
    this.preparedStatements.getHistoricalFeatures = await this.client.prepare(`
      SELECT
        gaid,
        historical_ctr,
        historical_cvr,
        avg_watch_time,
        engagement_score,
        last_interaction_ts
      FROM historical_features_table
      WHERE gaid = ?
    `);

    console.log('ScyllaClient: Statements prepared');
  }

  /**
   * Get historical features for a GAID
   *
   * @param {string} gaid - Google Advertising ID
   * @returns {Promise<Object|null>} Historical features or null if not found
   */
  async getHistoricalFeatures(gaid) {
    if (!this.client) {
      throw new Error('ScyllaClient: Not connected. Call connect() first.');
    }

    try {
      const result = await this.client.execute(
        this.preparedStatements.getHistoricalFeatures,
        [gaid],
        { prepare: true }
      );

      if (result.rows.length === 0) {
        console.log(`ScyllaClient: No historical features found for GAID: ${gaid}`);
        return null;
      }

      const row = result.rows[0];
      return {
        gaid: row.gaid,
        historical_ctr: row.historical_ctr || config.FEATURES.HISTORICAL_DEFAULTS.historical_ctr,
        historical_cvr: row.historical_cvr || config.FEATURES.HISTORICAL_DEFAULTS.historical_cvr,
        avg_watch_time: row.avg_watch_time || config.FEATURES.HISTORICAL_DEFAULTS.avg_watch_time,
        engagement_score: row.engagement_score || config.FEATURES.HISTORICAL_DEFAULTS.engagement_score,
        last_interaction_ts: row.last_interaction_ts || config.FEATURES.HISTORICAL_DEFAULTS.last_interaction_ts
      };
    } catch (error) {
      console.error(`ScyllaClient: Error fetching features for GAID ${gaid}:`, error.message);
      throw error;
    }
  }

  /**
   * Get historical features with defaults
   * Returns default values if no data found
   *
   * @param {string} gaid - Google Advertising ID
   * @returns {Promise<Object>} Historical features (never null)
   */
  async getHistoricalFeaturesWithDefaults(gaid) {
    try {
      const features = await this.getHistoricalFeatures(gaid);
      if (features) {
        return features;
      }

      // Return defaults if no data found
      console.log(`ScyllaClient: Using default features for GAID: ${gaid}`);
      return {
        gaid: gaid,
        ...config.FEATURES.HISTORICAL_DEFAULTS
      };
    } catch (error) {
      console.error(`ScyllaClient: Error, returning defaults for GAID ${gaid}:`, error.message);
      return {
        gaid: gaid,
        ...config.FEATURES.HISTORICAL_DEFAULTS
      };
    }
  }

  /**
   * Batch get historical features for multiple GAIDs
   *
   * @param {string[]} gaids - Array of GAIDs
   * @returns {Promise<Object[]>} Array of historical features
   */
  async batchGetHistoricalFeatures(gaids) {
    const promises = gaids.map(gaid => this.getHistoricalFeaturesWithDefaults(gaid));
    return Promise.all(promises);
  }

  /**
   * List available keyspaces
   */
  async listKeyspaces() {
    if (!this.client) {
      throw new Error('ScyllaClient: Not connected. Call connect() first.');
    }

    try {
      const result = await this.client.execute(
        'SELECT keyspace_name FROM system_schema.keyspaces'
      );

      return result.rows.map(row => row.keyspace_name);
    } catch (error) {
      console.error('ScyllaClient: Error listing keyspaces:', error.message);
      return [];
    }
  }

  /**
   * Test connection to Scylla cluster
   */
  async testConnection() {
    if (!this.client) {
      throw new Error('ScyllaClient: Not connected. Call connect() first.');
    }

    try {
      const result = await this.client.execute(
        'SELECT cluster_name, release_version FROM system.local'
      );

      const row = result.rows[0];
      console.log('ScyllaClient: Connection test successful');
      console.log(`  Cluster: ${row.cluster_name}`);
      console.log(`  Version: ${row.release_version}`);
      return true;
    } catch (error) {
      console.error('ScyllaClient: Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName = 'historical_features_table') {
    if (!this.client) {
      throw new Error('ScyllaClient: Not connected. Call connect() first.');
    }

    try {
      const result = await this.client.execute(
        `SELECT column_name, type FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?`,
        [this.config.KEYSPACE, tableName]
      );

      console.log(`ScyllaClient: Schema for ${tableName}:`);
      result.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.type}`);
      });

      return result.rows;
    } catch (error) {
      console.error(`ScyllaClient: Error fetching schema for ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      await this.client.shutdown();
      console.log('ScyllaClient: Connection closed');
      this.client = null;
    }
  }
}

module.exports = ScyllaClient;
