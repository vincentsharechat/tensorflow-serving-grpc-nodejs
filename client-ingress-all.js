#!/usr/bin/env node
/**
 * ✅ TensorFlow Serving Ingress Client - Score All Feature Examples with All Models
 *
 * This script runs predictions on all feature examples against all model variants
 * (BASELINE, CONSERVATIVE, AGGRESSIVE) and displays results in a formatted table.
 *
 * Usage:
 *   npm run client:ingress:all
 */

const { makeIngressRequest } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const { getAll, getCount } = require('./feature-examples');
const config = require('./config');

// Model variants to test
const MODEL_VARIANTS = ['BASELINE', 'CONSERVATIVE', 'AGGRESSIVE'];

/**
 * Run predictions for all feature examples against all model variants
 */
async function scoreAllExamples() {
  const examples = getAll();
  const totalCount = getCount();
  const results = [];

  console.log('🚀 Scoring All Feature Examples with All Model Variants');
  console.log(`📊 Total examples: ${totalCount}`);
  console.log(`🎯 Models: ${MODEL_VARIANTS.join(', ')}\n`);
  console.log('═'.repeat(100));

  for (let i = 0; i < totalCount; i++) {
    const example = examples[i];
    const serializedExample = buildSequenceExample(example);
    const exampleResults = {
      index: i,
      description: example.ad_type?.[0] || 'Unknown',
      models: {}
    };

    console.log(`\n📍 [${i + 1}/${totalCount}] Processing example ${i}...`);
    console.log(`   ✓ Serialized: ${serializedExample.length} bytes`);

    for (const variant of MODEL_VARIANTS) {
      const modelConfig = config.MODELS[variant];

      try {
        console.log(`   ⏳ Requesting ${variant}...`);

        const response = await makeIngressRequest({
          serializedExample: serializedExample,
          modelName: modelConfig.name,
          signatureName: modelConfig.signature,
          ingressHost: config.INGRESS.HOST,
          modelPath: modelConfig.path,
          port: config.INGRESS.PORT,
          timeout: 5000,
          caCertPath: config.INGRESS.CERT_PATH
        });

        // Extract predictions from response
        const predictions = {};
        if (response.outputs) {
          for (const [outputName, tensor] of Object.entries(response.outputs)) {
            if (tensor.floatVal && tensor.floatVal.length > 0) {
              predictions[outputName] = tensor.floatVal[0];
            } else if (tensor.int64Val && tensor.int64Val.length > 0) {
              predictions[outputName] = tensor.int64Val[0];
            }
          }
        }

        exampleResults.models[variant] = {
          status: '✅',
          predictions: predictions
        };

        console.log(`   ✓ ${variant} predictions received`);

      } catch (error) {
        console.error(`   ❌ ${variant} Error: ${error.message}`);
        exampleResults.models[variant] = {
          status: '❌',
          error: error.message
        };
      }
    }

    results.push(exampleResults);
    console.log('─'.repeat(100));
  }

  // Display summary table
  displaySummaryTable(results);
}

/**
 * Display results in a formatted table with all model variants
 */
function displaySummaryTable(results) {
  console.log('\n\n');

  // Collect all unique prediction keys from all models
  const predictionKeys = new Set();
  for (const result of results) {
    for (const variant of MODEL_VARIANTS) {
      const modelResult = result.models[variant];
      if (modelResult && modelResult.predictions) {
        Object.keys(modelResult.predictions).forEach(key => predictionKeys.add(key));
      }
    }
  }
  const sortedKeys = Array.from(predictionKeys).sort();

  // Define column widths
  const colWidth = {
    index: 5,
    adType: 20,
    model: 14,
    status: 4,
    pred: 16
  };

  const totalWidth = 150;

  console.log('═'.repeat(totalWidth));
  console.log('📋 RESULTS SUMMARY - ALL MODELS\n');

  // Create table headers
  let headerLine =
    'Index'.padEnd(colWidth.index) + ' | ' +
    'Ad Type'.padEnd(colWidth.adType) + ' | ' +
    'Model'.padEnd(colWidth.model) + ' | ' +
    'OK'.padEnd(colWidth.status) + ' | ' +
    sortedKeys.map(k => k.substring(0, colWidth.pred).padEnd(colWidth.pred)).join(' | ');

  console.log(headerLine);
  console.log('─'.repeat(totalWidth));

  // Display each result with all model variants
  for (const result of results) {
    const description = (result.description || 'Unknown').substring(0, colWidth.adType);

    for (let mi = 0; mi < MODEL_VARIANTS.length; mi++) {
      const variant = MODEL_VARIANTS[mi];
      const modelResult = result.models[variant];

      // Only show index and ad type on first model row
      const indexStr = mi === 0 ? String(result.index) : '';
      const adTypeStr = mi === 0 ? description : '';

      let line =
        indexStr.padEnd(colWidth.index) + ' | ' +
        adTypeStr.padEnd(colWidth.adType) + ' | ' +
        variant.padEnd(colWidth.model) + ' | ' +
        (modelResult?.status || '❓').padEnd(colWidth.status) + ' | ';

      if (modelResult && modelResult.predictions) {
        const predValues = sortedKeys.map(key => {
          const val = modelResult.predictions[key];
          if (val !== undefined && val !== null) {
            const numVal = typeof val === 'number' ? val.toFixed(4) : String(val);
            return numVal.substring(0, colWidth.pred).padEnd(colWidth.pred);
          }
          return 'N/A'.padEnd(colWidth.pred);
        });
        line += predValues.join(' | ');
      } else if (modelResult && modelResult.error) {
        line += modelResult.error.substring(0, 40);
      }

      console.log(line);
    }
    console.log('─'.repeat(totalWidth));
  }

  console.log('═'.repeat(totalWidth));

  // Display statistics per model
  console.log('\n📊 Statistics by Model:');
  for (const variant of MODEL_VARIANTS) {
    const successful = results.filter(r => r.models[variant]?.status === '✅').length;
    const failed = results.filter(r => r.models[variant]?.status === '❌').length;
    console.log(`   ${variant}: ✅ ${successful}/${results.length} | ❌ ${failed}/${results.length}`);
  }

  // Overall stats
  const totalCalls = results.length * MODEL_VARIANTS.length;
  let totalSuccess = 0;
  let totalFailed = 0;
  for (const result of results) {
    for (const variant of MODEL_VARIANTS) {
      if (result.models[variant]?.status === '✅') totalSuccess++;
      if (result.models[variant]?.status === '❌') totalFailed++;
    }
  }

  console.log(`\n   📈 Overall: ${totalSuccess}/${totalCalls} successful (${((totalSuccess/totalCalls)*100).toFixed(1)}%)`);
  console.log(`   ⏱️  Total: ${results.length} examples × ${MODEL_VARIANTS.length} models = ${totalCalls} predictions\n`);

  if (totalFailed === 0) {
    console.log('🎉 All predictions successful across all models!\n');
  } else {
    console.log(`⚠️  ${totalFailed} prediction(s) failed. Review errors above.\n`);
  }
}

// Run the scoring
if (require.main === module) {
  (async () => {
    try {
      await scoreAllExamples();
    } catch (error) {
      console.error('\n💥 Fatal error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { scoreAllExamples };
