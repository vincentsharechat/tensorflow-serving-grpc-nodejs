const protobuf = require('protobufjs');
const path = require('path');
const { buildSequenceExample, serializeSequenceExample } = require('./request-builder');

// Same sample data
const sampleData = {
  time: '2025-10-10 09:21:34',
  date: '2025-10-10',
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
  winning_bid: 0.0
};

console.log('Building SequenceExample...');
const sequenceExample = buildSequenceExample(sampleData);
console.log('Features:', Object.keys(sequenceExample.featureLists));

console.log('\nSerializing...');
const serialized = serializeSequenceExample(sequenceExample);
console.log('Serialized size:', serialized.length, 'bytes');

// Decode back to verify
const root = protobuf.loadSync(path.join(__dirname, '../proto/example.proto'));
const SequenceExample = root.lookupType('tensorflow.SequenceExample');
const decoded = SequenceExample.decode(serialized);

console.log('\nDecoded feature_lists keys:', Object.keys(decoded.featureLists));
console.log('\nSample decoded feature (time):');
const timeFeature = decoded.featureLists['time'];
if (timeFeature) {
  console.log('  Has', timeFeature.feature.length, 'feature(s)');
  if (timeFeature.feature[0].bytesList) {
    console.log('  Value:', Buffer.from(timeFeature.feature[0].bytesList.value[0]).toString('utf8'));
  }
}

// Now build the full PredictRequest
const predictRoot = protobuf.loadSync([
  path.join(__dirname, '../proto/predict.proto'),
  path.join(__dirname, '../proto/tensor.proto')
]);

const PredictRequest = predictRoot.lookupType('tensorflow.serving.PredictRequest');

const predictRequest = {
  modelSpec: {
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'
  },
  inputs: {
    'examples': {
      dtype: 7,
      tensorShape: {
        dim: [{ size: 1 }]
      },
      stringVal: [serialized]
    }
  }
};

console.log('\nBuilding PredictRequest...');
const predictMsg = PredictRequest.create(predictRequest);
console.log('modelSpec:', predictMsg.modelSpec);
console.log('inputs keys:', Object.keys(predictMsg.inputs));

const predictEncoded = PredictRequest.encode(predictMsg).finish();
console.log('\n✅ Full PredictRequest encoded to', predictEncoded.length, 'bytes');

// Decode to verify
const predictDecoded = PredictRequest.decode(predictEncoded);
console.log('\n✅ Decoded PredictRequest:');
console.log('  modelSpec:', predictDecoded.modelSpec);
console.log('  inputs:', Object.keys(predictDecoded.inputs));
console.log('  examples tensor dtype:', predictDecoded.inputs.examples.dtype);
console.log('  examples tensor stringVal length:', predictDecoded.inputs.examples.stringVal.length);
console.log('  examples tensor stringVal[0] size:', predictDecoded.inputs.examples.stringVal[0].length, 'bytes');
