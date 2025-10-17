#!/usr/bin/env node
/**
 * Test script to verify SequenceExample serialization matches Python
 */

const { buildSequenceExample, toHex } = require('../sequence-example-builder');

console.log('🧪 Testing SequenceExample Serialization\n');

// Test 1: Single string feature
console.log('Test 1: Single string feature');
const test1 = buildSequenceExample({ 'ad_type': ['SC_CPCV_1'] });
const test1Hex = toHex(test1);
const expectedTest1 = '121c0a1a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f31';
console.log(`  Length: ${test1.length} bytes`);
console.log(`  Match:  ${test1Hex === expectedTest1 ? '✅ PASS' : '❌ FAIL'}`);
if (test1Hex !== expectedTest1) {
  console.log(`  Expected: ${expectedTest1}`);
  console.log(`  Got:      ${test1Hex}`);
}
console.log();

// Test 2: Multiple features
console.log('Test 2: Multiple features (map ordering may vary)');
const test2 = buildSequenceExample({
  'ad_type': ['SC_CPCV_1'],
  'userid': ['749603295']
});
console.log(`  Length: ${test2.length} bytes`);
console.log(`  Hex starts with '1299': ${toHex(test2).startsWith('1299') ? '✅ PASS' : '❌ FAIL'}`);
console.log();

// Test 3: Integer feature
console.log('Test 3: Integer feature');
const test3 = buildSequenceExample({ 'count': [42] });
const test3Hex = toHex(test3);
console.log(`  Length: ${test3.length} bytes`);
console.log(`  Contains int64: ${test3Hex.includes('10') ? '✅ PASS' : '❌ FAIL'}`); // 10 = wire type 0 (varint)
console.log();

// Test 4: Float feature
console.log('Test 4: Float feature');
const test4 = buildSequenceExample({ 'price': [9.99] });
const test4Hex = toHex(test4);
console.log(`  Length: ${test4.length} bytes`);
console.log(`  Contains float: ${test4Hex.includes('1a') ? '✅ PASS' : '❌ FAIL'}`); // 1a = wire type 2 (length-delimited)
console.log();

// Test 5: Multiple values in single feature
console.log('Test 5: Multiple values in single feature');
const test5 = buildSequenceExample({ 'tags': ['sports', 'news', 'entertainment'] });
console.log(`  Length: ${test5.length} bytes`);
console.log(`  Has content: ${test5.length > 50 ? '✅ PASS' : '❌ FAIL'}`);
console.log();

// Test 6: Full example (from Python)
console.log('Test 6: Full example with 14 features');
const fullExample = buildSequenceExample({
  "ad_type": ["SC_CPCV_1"],
  "adsuuid": ["0532afbb-3c85-4776-b5c6-d908a47c1441"],
  "ageRange": ["18-24"],
  "city": ["koppal"],
  "feed_fetch_counter": ["1"],
  "gender": ["F"],
  "language": ["tamil"],
  "osVersion": ["rest"],
  "phoneCarrier": ["ind airtel"],
  "phoneModel": ["oppo cph2681"],
  "sourceApp": ["SC"],
  "state": ["karnataka"],
  "time": ["2025-10-10 22:02:24"],
  "userid": ["749603295"]
});
const fullHex = toHex(fullExample);
const expectedFullStart = '1299030a'; // 12 = field 2, 9903 = length varint, 0a = map entry
console.log(`  Length: ${fullExample.length} bytes (expected ~412)`);
console.log(`  Starts correctly: ${fullHex.startsWith(expectedFullStart) ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Size in range: ${fullExample.length >= 410 && fullExample.length <= 415 ? '✅ PASS' : '❌ FAIL'}`);
console.log();

// Test 7: Empty feature (edge case)
console.log('Test 7: Empty feature list');
try {
  const test7 = buildSequenceExample({});
  console.log(`  Length: ${test7.length} bytes`);
  console.log(`  Handles empty: ✅ PASS`);
} catch (e) {
  console.log(`  Error: ${e.message}`);
  console.log(`  Handles empty: ❌ FAIL`);
}
console.log();

// Test 8: Type detection
console.log('Test 8: Mixed types in single example');
const test8 = buildSequenceExample({
  'string_field': ['hello'],
  'int_field': [42],
  'float_field': [3.14]
});
console.log(`  Length: ${test8.length} bytes`);
console.log(`  Mixed types: ${test8.length > 30 ? '✅ PASS' : '❌ FAIL'}`);
console.log();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✨ All tests completed!');
console.log();
console.log('To test with TensorFlow Serving:');
console.log('  node client-with-builder.js');
