const { buildSequenceExample, serializeSequenceExample } = require('./request-builder');

// Exact same data as Python
const sampleData = {
  time: '2025-10-10 09:21:34',
  ad_type: 'SC_OUTSTREAM',
  adsuuid: 'e5c2f394-023e-4383-92d0-b28f17c10e4e',
  ageRange: '18-24',
  city: 'chitradurga',
  feed_fetch_counter: '2',
  gender: 'F',
  language: 'tamil',
  osVersion: 'rest',
  phoneCarrier: 'vi india',
  phoneModel: 'xiaomi 22041219pi',
  sourceApp: 'SC',
  state: 'karnataka',
  userid: '2545264872',
  floor_price: 5.0,
  winning_bid: 0.0,
  is_responded: 0
};

const sequenceExample = buildSequenceExample(sampleData);
const serialized = serializeSequenceExample(sequenceExample);

console.log('Node.js serialized:');
console.log('  Length:', serialized.length, 'bytes');
console.log('  Hex:', serialized.toString('hex'));
console.log('\nPython serialized (paste from notebook):');
console.log('  Length: 503 bytes');
console.log('  Hex: 12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e746572...');
console.log('\nTo compare:');
console.log('1. Run this in Python notebook:');
console.log('   print(serialized_example.hex())');
console.log('2. Compare the full hex strings');
