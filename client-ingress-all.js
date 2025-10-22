#!/usr/bin/env node
/**
 * ✅ TensorFlow Serving Ingress Client - Score All Feature Examples
 *
 * This script runs predictions on all feature examples and displays
 * results in a formatted table for easy comparison.
 *
 * Usage:
 *   npm run client:ingress:all
 */

const { makeIngressRequest } = require('./client-ingress');
const { buildSequenceExample } = require('./sequence-example-builder');
const { getAll, getCount } = require('./feature-examples');
const config = require('./config');

/**
 * Run predictions for all feature examples
 */
async function scoreAllExamples() {
  const examples = getAll();
  const totalCount = getCount();
  const results = [];

  console.log('🚀 Scoring All Feature Examples');
  console.log(`📊 Total examples: ${totalCount}\n`);
  console.log('═'.repeat(80));

  for (let i = 0; i < totalCount; i++) {
    try {
      console.log(`\n📍 [${i + 1}/${totalCount}] Processing example ${i}...`);

      const example = examples[i];
      const serializedExample = buildSequenceExample(example);

      console.log(`   ✓ Serialized: ${serializedExample.length} bytes`);
      console.log('   ⏳ Making prediction request...');

      const response = await makeIngressRequest({
        serializedExample: serializedExample,
        modelName: config.MODELS.BASELINE.name,
        signatureName: config.MODELS.BASELINE.signature,
        ingressHost: config.INGRESS.HOST,
        modelPath: config.MODELS.BASELINE.path,
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

      results.push({
        index: i,
        status: '✅ SUCCESS',
        predictions: predictions,
        description: example.ad_type?.[0] || 'Unknown'
      });

      console.log(`   ✓ Predictions received`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        index: i,
        status: '❌ FAILED',
        error: error.message,
        description: examples[i]?.ad_type?.[0] || 'Unknown'
      });
    }

    console.log('─'.repeat(80));
  }

  // Display summary table
  displaySummaryTable(results);
}

/**
 * Display results in a formatted table
 */
function displaySummaryTable(results) {
  console.log('\n\n');

  // Collect all unique prediction keys to determine column structure
  const predictionKeys = new Set();
  for (const result of results) {
    if (result.predictions) {
      Object.keys(result.predictions).forEach(key => predictionKeys.add(key));
    }
  }
  const sortedKeys = Array.from(predictionKeys).sort();

  // Define column widths
  const colWidth = {
    index: 5,
    status: 10,
    adType: 25,
    pred: 18  // Per prediction column
  };

  // Calculate total width
  const totalWidth = colWidth.index + 3 + colWidth.status + 3 + colWidth.adType + 3 + (sortedKeys.length * (colWidth.pred + 1));

  console.log('═'.repeat(Math.min(totalWidth + 10, 200)));
  console.log('📋 RESULTS SUMMARY\n');

  // Create table headers
  let headerLine =
    'Index'.padEnd(colWidth.index) + ' | ' +
    'Status'.padEnd(colWidth.status) + ' | ' +
    'Ad Type'.padEnd(colWidth.adType) + ' | ' +
    sortedKeys.map(k => k.padEnd(colWidth.pred)).join(' | ');

  console.log(headerLine);
  console.log('─'.repeat(Math.min(totalWidth + 10, 200)));

  // Display each result
  for (const result of results) {
    const status = result.status;
    const description = (result.description || 'Unknown').substring(0, colWidth.adType);

    let line =
      String(result.index).padEnd(colWidth.index) + ' | ' +
      status.padEnd(colWidth.status) + ' | ' +
      description.padEnd(colWidth.adType) + ' | ';

    // Add prediction values in fixed order
    if (result.predictions) {
      const predValues = sortedKeys.map(key => {
        const val = result.predictions[key];
        if (val !== undefined && val !== null) {
          const numVal = typeof val === 'number' ? val.toFixed(4) : String(val);
          return numVal.padEnd(colWidth.pred);
        }
        return 'N/A'.padEnd(colWidth.pred);
      });
      line += predValues.join(' | ');
    } else if (result.error) {
      line += result.error.substring(0, colWidth.pred);
    }

    console.log(line);
  }

  console.log('═'.repeat(Math.min(totalWidth + 10, 200)));

  // Display statistics
  const successful = results.filter((r) => r.status === '✅ SUCCESS').length;
  const failed = results.filter((r) => r.status === '❌ FAILED').length;

  console.log('\n📊 Statistics:');
  console.log(`   ✅ Successful: ${successful}/${results.length}`);
  console.log(`   ❌ Failed: ${failed}/${results.length}`);
  console.log(`   ⏱️  Total: ${results.length} examples processed\n`);

  if (failed === 0) {
    console.log('🎉 All examples scored successfully!\n');
  } else {
    console.log(`⚠️  ${failed} example(s) failed. Review errors above.\n`);
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
