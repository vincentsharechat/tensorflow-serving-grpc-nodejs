/**
 * Centralized Configuration for TensorFlow Serving Clients
 *
 * This file contains all endpoint and model configuration
 * for both direct pod access and ingress routing.
 */

module.exports = {
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
    BASELINE: 'ADS_LST_DNB_BASELINE',
    CONSERVATIVE: 'ADS_LST_DNB_CONSERVATIVE',
    AGGRESSIVE: 'ADS_LST_DNB_AGGRESSIVE'
  },

  // ==================== MODEL CONFIGURATION ====================
  MODELS: {
    BASELINE: {
      name: 'dnb_model_baseline',
      signature: 'serving_default',
      path: 'ADS_LST_DNB_BASELINE'
    },
    CONSERVATIVE: {
      name: 'dnb_model_conservative',
      signature: 'serving_default',
      path: 'ADS_LST_DNB_CONSERVATIVE'
    },
    AGGRESSIVE: {
      name: 'dnb_model_aggressive',
      signature: 'serving_default',
      path: 'ADS_LST_DNB_AGGRESSIVE'
    }
  },

  // ==================== REQUEST DEFAULTS ====================
  DEFAULTS: {
    TIMEOUT: 1000,        // Default timeout in milliseconds
    SIGNATURE: 'serving_default',
    DTYPE_STRING: 7       // TensorFlow DT_STRING type
  }
};
