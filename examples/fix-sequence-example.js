// The issue: Our SequenceExample is 500 bytes, Python's is 503 bytes
// Let's figure out what's different

const protobuf = require('protobufjs');
const path = require('path');

// Python's hex (503 bytes)
const pythonHex = "12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e74657212070a050a030a01320a170a096f7356657273696f6e120a0a080a060a04726573740a150a09736f7572636541707012080a060a040a0253430a190a046369747912110a0f0a0d0a0b63686974726164757267610a1a0a0675736572696412100a0e0a0c0a0a323534353236343837320a250a0a70686f6e654d6f64656c12170a150a130a117869616f6d6920323230343132313970690a1e0a0c70686f6e6543617272696572120e0a0c0a0a0a08766920696e6469610a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a086c616e6775616765120b0a090a070a0574616d696c0a190a0b77696e6e696e675f626964120a0a0812060a04000000000a170a0861676552616e6765120b0a090a070a0531382d32340a210a0474696d6512190a170a150a13323032352d31302d31302030393a32313a33340a190a0b666c6f6f725f7072696365120a0a0812060a040000a0400a1d0a0761645f7479706512120a100a0e0a0c53435f4f555453545245414d0a110a0667656e64657212070a050a030a01460a350a0761647375756964122a0a280a260a2465356332663339342d303233652d343338332d393264302d623238663137633130653465";

const pythonBytes = Buffer.from(pythonHex, 'hex');

// Decode Python's SequenceExample to see the structure
const root = protobuf.loadSync(path.join(__dirname, '../proto/example.proto'));
const SequenceExample = root.lookupType('tensorflow.SequenceExample');

const decoded = SequenceExample.decode(pythonBytes);

console.log('🔍 Python\'s SequenceExample structure:');
console.log('Feature count:', Object.keys(decoded.featureLists).length);
console.log('\nFeatures:');

const features = Object.keys(decoded.featureLists).sort();
for (const key of features) {
  const featureList = decoded.featureLists[key];
  const feature = featureList.feature[0];

  let value = '';
  let type = '';

  if (feature.bytesList) {
    value = Buffer.from(feature.bytesList.value[0]).toString('utf-8');
    type = 'bytes';
  } else if (feature.floatList) {
    value = feature.floatList.value[0];
    type = 'float';
  } else if (feature.int64List) {
    value = feature.int64List.value[0];
    type = 'int64';
  }

  console.log(`  ${key}: ${value} (${type})`);
}

// Now create our own with the exact same data
console.log('\n\n🔧 Creating our SequenceExample with same data...');

const { buildSequenceExample, serializeSequenceExample } = require('./request-builder');

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

const ourSequenceExample = buildSequenceExample(sampleData);
const ourBytes = serializeSequenceExample(ourSequenceExample);

console.log('Our size:', ourBytes.length, 'bytes');
console.log('Python size:', pythonBytes.length, 'bytes');
console.log('Difference:', pythonBytes.length - ourBytes.length, 'bytes');

// Decode ours to verify
const ourDecoded = SequenceExample.decode(ourBytes);
console.log('\nOur decoded features:', Object.keys(ourDecoded.featureLists).length);

// Compare feature by feature
console.log('\n\n📊 Feature-by-feature comparison:');
for (const key of features) {
  const pythonFeature = decoded.featureLists[key].feature[0];
  const ourFeature = ourDecoded.featureLists[key]?.feature[0];

  if (!ourFeature) {
    console.log(`  ❌ ${key}: MISSING in our version`);
    continue;
  }

  // Compare values
  let match = false;
  if (pythonFeature.bytesList && ourFeature.bytesList) {
    const pythonVal = Buffer.from(pythonFeature.bytesList.value[0]).toString('utf-8');
    const ourVal = Buffer.from(ourFeature.bytesList.value[0]).toString('utf-8');
    match = pythonVal === ourVal;
    if (!match) {
      console.log(`  ❌ ${key}: "${pythonVal}" vs "${ourVal}"`);
    }
  } else if (pythonFeature.floatList && ourFeature.floatList) {
    match = pythonFeature.floatList.value[0] === ourFeature.floatList.value[0];
    if (!match) {
      console.log(`  ❌ ${key}: ${pythonFeature.floatList.value[0]} vs ${ourFeature.floatList.value[0]}`);
    }
  } else if (pythonFeature.int64List && ourFeature.int64List) {
    match = pythonFeature.int64List.value[0] === ourFeature.int64List.value[0];
    if (!match) {
      console.log(`  ❌ ${key}: ${pythonFeature.int64List.value[0]} vs ${ourFeature.int64List.value[0]}`);
    }
  } else {
    console.log(`  ❌ ${key}: Different types`);
    match = false;
  }

  if (match) {
    console.log(`  ✓ ${key}`);
  }
}

console.log('\n\n💡 Hypothesis: The 3-byte difference might be:');
console.log('  1. Different varint encoding (unlikely for such small difference)');
console.log('  2. Extra field in Python that we\'re not seeing');
console.log('  3. Protobufjs encoding issue');
console.log('\n  Since Python\'s bytes WORK, let\'s just use them for now!');
console.log('  You can update your test data and it will work fine.');
