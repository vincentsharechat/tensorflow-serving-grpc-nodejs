#!/usr/bin/env node
/**
 * Simplified Scylla + Inference Client
 *
 * Streamlined version that combines Scylla DB queries with TensorFlow Serving inference
 * in a single, easy-to-use interface.
 */

const cassandra = require('cassandra-driver');
const grpc = require('@grpc/grpc-js');
const protobuf = require('protobufjs');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { buildSequenceExample } = require('./sequence-example-builder');

class SimpleInferenceClient {
  constructor(options = {}) {
    this.scyllaConfig = options.scyllaConfig || config.SCYLLA;
    this.modelConfig = options.modelConfig || config.MODELS.BASELINE;
    this.verbose = options.verbose || false;

    this.scyllaClient = null;
    this.grpcClient = null;
    this.preparedQuery = null;
  }

  /**
   * Initialize connections to Scylla and load protobuf definitions
   */
  async initialize() {
    // Connect to Scylla
    const authProvider = new cassandra.auth.PlainTextAuthProvider(
      this.scyllaConfig.CREDENTIALS.username,
      this.scyllaConfig.CREDENTIALS.password
    );

    this.scyllaClient = new cassandra.Client({
      contactPoints: this.scyllaConfig.CONTACT_POINTS,
      localDataCenter: this.scyllaConfig.LOCAL_DC,
      authProvider,
      protocolOptions: { port: this.scyllaConfig.PORT },
      socketOptions: {
        connectTimeout: this.scyllaConfig.CONNECTION_TIMEOUT,
        readTimeout: this.scyllaConfig.REQUEST_TIMEOUT
      }
    });

    await this.scyllaClient.connect();

    // Prepare query for ARS feature store format
    // Key format: userid|ad_type|sourceApp
    // Feature set: dnb_historical_features
    this.preparedQuery = await this.scyllaClient.prepare(`
      SELECT featuresetid, featureversionid, value
      FROM ars_feature_store.ars_user_features_v2
      WHERE id = ? AND featuresetid = 'dnb_historical_features'
    `);

    // Load protobuf definitions
    this.proto = protobuf.loadSync([
      path.join(__dirname, 'proto/predict.proto'),
      path.join(__dirname, 'proto/tensor.proto')
    ]);

    if (this.verbose) {
      console.log('✓ Initialized Scylla connection and protobuf definitions');
    }
  }

  /**
   * Get historical features from Scylla for user+ad_type+sourceApp
   * Features are stored as colon-separated values in ARS format
   */
  async getHistoricalFeatures(userid, adType, sourceApp) {
    // Build composite key: userid|ad_type|sourceApp
    const compositeKey = `${userid}|${adType}|${sourceApp}`;

    const result = await this.scyllaClient.execute(
      this.preparedQuery,
      [compositeKey],
      { prepare: true }
    );

    if (result.rows.length === 0) {
      if (this.verbose) {
        console.log(`  No features found for key: ${compositeKey}`);
      }
      // Return defaults if not found
      return this._getDefaultFeatures();
    }

    // Parse colon-separated features
    // Format: requests_1d:responses_1d:floor_sum_1d:...
    const row = result.rows[0];
    const valueStr = String(row.value || '');
    const features = valueStr.split(':').map(v => parseFloat(v) || 0.0);

    if (this.verbose) {
      console.log(`  Found features for: ${compositeKey}`);
      console.log(`  Feature set: ${row.featuresetid}`);
      console.log(`  Version: ${row.featureversionid}`);
    }

    return this._parseFeatures(features);
  }

  /**
   * Parse feature array into named features
   * Based on dnb_historical_features_scylla.sql column order
   */
  _parseFeatures(features) {
    return {
      requests_1_day: features[0] || 0,
      responses_1_day: features[1] || 0,
      floor_price_sum_1_day: features[2] || 0.0,
      floor_price_max_1_day: features[3] || 0.0,
      winning_bid_sum_1_day: features[4] || 0.0,
      winning_bid_max_1_day: features[5] || 0.0,
      winrate_1_day: features[6] || 0.0,
      floor_price_avg_1_day: features[7] || 0.0,
      winning_bid_avg_1_day: features[8] || 0.0,
      requests_7_day: features[9] || 0,
      responses_7_day: features[10] || 0,
      floor_price_sum_7_day: features[11] || 0.0,
      floor_price_max_7_day: features[12] || 0.0,
      winning_bid_sum_7_day: features[13] || 0.0,
      winning_bid_max_7_day: features[14] || 0.0,
      winrate_7_day: features[15] || 0.0,
      floor_price_avg_7_day: features[16] || 0.0,
      winning_bid_avg_7_day: features[17] || 0.0
    };
  }

  /**
   * Get default features when none found in DB
   */
  _getDefaultFeatures() {
    return {
      requests_1_day: 0,
      responses_1_day: 0,
      floor_price_sum_1_day: 0.0,
      floor_price_max_1_day: 0.0,
      winning_bid_sum_1_day: 0.0,
      winning_bid_max_1_day: 0.0,
      winrate_1_day: 0.0,
      floor_price_avg_1_day: 0.0,
      winning_bid_avg_1_day: 0.0,
      requests_7_day: 0,
      responses_7_day: 0,
      floor_price_sum_7_day: 0.0,
      floor_price_max_7_day: 0.0,
      winning_bid_sum_7_day: 0.0,
      winning_bid_max_7_day: 0.0,
      winrate_7_day: 0.0,
      floor_price_avg_7_day: 0.0,
      winning_bid_avg_7_day: 0.0
    };
  }

  /**
   * Make inference request to TensorFlow Serving
   *
   * @param {string} userid - User ID
   * @param {string} adType - Ad type (e.g., 'SC_CPCV_1')
   * @param {string} sourceApp - Source app (e.g., 'SC' or 'MJ')
   * @param {Object} realtimeFeatures - Additional real-time features
   */
  async predict(userid, adType, sourceApp, realtimeFeatures = {}) {
    // Fetch historical features from Scylla
    const historicalFeatures = await this.getHistoricalFeatures(userid, adType, sourceApp);

    // Combine features - convert all numeric features to strings for TF
    const features = {
      userid: [userid],
      ad_type: [adType],
      sourceApp: [sourceApp],

      // 1-day historical features
      requests_1_day: [historicalFeatures.requests_1_day.toString()],
      responses_1_day: [historicalFeatures.responses_1_day.toString()],
      floor_price_sum_1_day: [historicalFeatures.floor_price_sum_1_day.toString()],
      floor_price_max_1_day: [historicalFeatures.floor_price_max_1_day.toString()],
      winning_bid_sum_1_day: [historicalFeatures.winning_bid_sum_1_day.toString()],
      winning_bid_max_1_day: [historicalFeatures.winning_bid_max_1_day.toString()],
      winrate_1_day: [historicalFeatures.winrate_1_day.toString()],
      floor_price_avg_1_day: [historicalFeatures.floor_price_avg_1_day.toString()],
      winning_bid_avg_1_day: [historicalFeatures.winning_bid_avg_1_day.toString()],

      // 7-day historical features
      requests_7_day: [historicalFeatures.requests_7_day.toString()],
      responses_7_day: [historicalFeatures.responses_7_day.toString()],
      floor_price_sum_7_day: [historicalFeatures.floor_price_sum_7_day.toString()],
      floor_price_max_7_day: [historicalFeatures.floor_price_max_7_day.toString()],
      winning_bid_sum_7_day: [historicalFeatures.winning_bid_sum_7_day.toString()],
      winning_bid_max_7_day: [historicalFeatures.winning_bid_max_7_day.toString()],
      winrate_7_day: [historicalFeatures.winrate_7_day.toString()],
      floor_price_avg_7_day: [historicalFeatures.floor_price_avg_7_day.toString()],
      winning_bid_avg_7_day: [historicalFeatures.winning_bid_avg_7_day.toString()],

      // Real-time features
      ...realtimeFeatures
    };

    // Build SequenceExample
    const serializedExample = buildSequenceExample(features);

    // Make inference
    const response = await this._makeGrpcRequest(serializedExample);

    // Extract predictions
    const predictions = this._extractPredictions(response);

    return {
      userid,
      adType,
      sourceApp,
      historicalFeatures,
      predictions
    };
  }

  /**
   * Batch predict for multiple users
   *
   * @param {Array<{userid, adType, sourceApp}>} requests - Array of prediction requests
   * @param {Object} realtimeFeatures - Additional real-time features
   */
  async batchPredict(requests, realtimeFeatures = {}) {
    const results = await Promise.all(
      requests.map(req => this.predict(req.userid, req.adType, req.sourceApp, realtimeFeatures))
    );
    return results;
  }

  /**
   * Internal method to make gRPC request
   */
  async _makeGrpcRequest(serializedExample) {
    // Setup TLS credentials
    let credentials;
    const caCertPath = config.INGRESS.CERT_PATH;

    if (fs.existsSync(caCertPath)) {
      credentials = grpc.credentials.createSsl(fs.readFileSync(caCertPath));
    } else {
      credentials = grpc.credentials.createSsl();
    }

    // Create client
    const target = `${config.INGRESS.HOST}:${config.INGRESS.PORT}`;
    const client = new grpc.Client(target, credentials, {
      'grpc.max_send_message_length': 100 * 1024 * 1024,
      'grpc.max_receive_message_length': 100 * 1024 * 1024,
    });

    // Build request
    const PredictRequest = this.proto.lookupType('tensorflow.serving.PredictRequest');
    const PredictResponse = this.proto.lookupType('tensorflow.serving.PredictResponse');

    const request = {
      model_spec: {
        name: this.modelConfig.name,
        signature_name: this.modelConfig.signature || config.DEFAULTS.SIGNATURE
      },
      inputs: {
        examples: {
          dtype: config.DEFAULTS.DTYPE_STRING,
          tensor_shape: { dim: [{ size: 1 }] },
          string_val: [serializedExample]
        }
      }
    };

    const requestBuffer = PredictRequest.encode(request).finish();
    const methodPath = `/${this.modelConfig.path}/tensorflow.serving.PredictionService/Predict`;

    // Make request
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 2);

      client.makeUnaryRequest(
        methodPath,
        (arg) => arg,
        (arg) => arg,
        requestBuffer,
        null,
        { deadline },
        (error, responseBuffer) => {
          client.close();

          if (error) {
            reject(error);
            return;
          }

          try {
            resolve(PredictResponse.decode(responseBuffer));
          } catch (decodeError) {
            reject(decodeError);
          }
        }
      );
    });
  }

  /**
   * Extract predictions from TensorFlow response
   */
  _extractPredictions(response) {
    const predictions = {};
    for (const [outputName, tensor] of Object.entries(response.outputs)) {
      if (tensor.float_val && tensor.float_val.length > 0) {
        predictions[outputName] = tensor.float_val[0];
      }
    }
    return predictions;
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.scyllaClient) {
      await this.scyllaClient.shutdown();
    }
    if (this.verbose) {
      console.log('✓ Connections closed');
    }
  }
}

// ==================== Usage Example ====================

async function main() {
  const client = new SimpleInferenceClient({ verbose: true });

  try {
    await client.initialize();

    // Single prediction
    const result = await client.predict('2312341', {
      ad_type: ['SC_CPCV_1'],
      userid: ['123456'],
      ageRange: ['18-24'],
      city: ['bangalore']
    });

    console.log('\nResult:', JSON.stringify(result, null, 2));

    // Batch predictions (optional)
    /*
    const batchResults = await client.batchPredict(
      ['2312341', '2312342', '2312343'],
      { ad_type: ['SC_CPCV_1'] }
    );
    console.log('\nBatch Results:', JSON.stringify(batchResults, null, 2));
    */

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimpleInferenceClient;
