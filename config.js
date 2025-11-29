/**
 * Centralized Configuration for TensorFlow Serving Clients
 *
 * This file contains all endpoint and model configuration
 * for both direct pod access and ingress routing.
 */

module.exports = {
  // ==================== SCYLLA DB CONFIGURATION ====================
  // Scylla cluster for historical features
  SCYLLA: {
    CONTACT_POINTS: [
      'node-0.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud',
      'node-1.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud',
      'node-2.gce-asia-south-1.05be2fa55045b1fb2113.clusters.scylla.cloud',
    ],
    CREDENTIALS: {
      username: process.env.SCYLLA_USERNAME || 'cassandra',
      password: process.env.SCYLLA_PASSWORD || 'cassandra',
    },
    KEYSPACE: 'ads_features',
    LOCAL_DC: 'GCE_ASIA_SOUTH_1',
    PORT: 9042,
    CONNECTION_TIMEOUT: 5000,
    REQUEST_TIMEOUT: 2000,
  },

  // ==================== POD CONFIGURATION ====================
  // Direct pod access (no TLS, port 9500)
  POD: {
    ENDPOINT: '100.68.113.134:9500',
    PORT: 9500,
    USE_TLS: false
  },

  // ==================== INGRESS CONFIGURATION ====================
  // Ingress with TLS and custom path routing
  INGRESS: {
    HOST: 'holmes-ads-v2.sharechat.internal',
    PORT: 443,
    USE_TLS: true,
    CERT_PATH: 'ingress.crt'
  },

  // ==================== MODEL PATHS ====================
  // Custom paths for ingress routing to different model variants
  MODEL_PATHS: {
    BASELINE: 'ads-dnb-baseline-v1/sparse',
    CONSERVATIVE: 'ads-dnb-conservative-v1/sparse',
    AGGRESSIVE: 'ads-dnb-aggressive-v1/sparse'
  },

  // ==================== MODEL CONFIGURATION ====================
  MODELS: {
    BASELINE: {
      name: 'dnb-model-baseline-v1',
      signature: 'serving_default',
      path: 'ads-dnb-baseline-v1/sparse'
    },
    CONSERVATIVE: {
      name: 'dnb-model-conservative-v1',
      signature: 'serving_default',
      path: 'ads-dnb-conservative-v1/sparse'
    },
    AGGRESSIVE: {
      name: 'dnb-model-aggressive-v1',
      signature: 'serving_default',
      path: 'ads-dnb-aggressive-v1/sparse'
    }
  },

  // ==================== REQUEST DEFAULTS ====================
  DEFAULTS: {
    TIMEOUT: 1000,        // Default timeout in milliseconds
    SIGNATURE: 'serving_default',
    DTYPE_STRING: 7       // TensorFlow DT_STRING type
  },

  // ==================== FEATURE CONFIGURATION ====================
  FEATURES: {
    // Historical features from Scylla DB
    HISTORICAL: [
      'historical_ctr',
      'historical_cvr',
      'avg_watch_time',
      'engagement_score',
      'last_interaction_ts'
    ],

    // Default values if historical data not found
    HISTORICAL_DEFAULTS: {
      historical_ctr: 0.0,
      historical_cvr: 0.0,
      avg_watch_time: 0.0,
      engagement_score: 0.0,
      last_interaction_ts: 0
    }
  }
};
