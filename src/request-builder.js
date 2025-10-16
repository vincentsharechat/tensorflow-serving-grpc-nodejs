// Helper to build SequenceExample from sample data
// Note: protobufjs uses camelCase field names!
function buildSequenceExample(data) {
  const featureLists = {};

  // String features (NO 'date' - Python doesn't have it)
  const stringFeatures = [
    'time', 'ad_type', 'adsuuid', 'ageRange', 'city',
    'feed_fetch_counter', 'gender', 'language', 'osVersion',
    'phoneCarrier', 'phoneModel', 'sourceApp', 'state', 'userid'
  ];

  for (const key of stringFeatures) {
    if (data[key] !== undefined) {
      featureLists[key] = {
        feature: [{
          bytesList: {  // camelCase!
            value: [Buffer.from(data[key], 'utf8')]
          }
        }]
      };
    }
  }

  // Float features
  if (data.floor_price !== undefined) {
    featureLists['floor_price'] = {
      feature: [{
        floatList: {  // camelCase!
          value: [data.floor_price]
        }
      }]
    };
  }

  if (data.winning_bid !== undefined) {
    featureLists['winning_bid'] = {
      feature: [{
        floatList: {  // camelCase!
          value: [data.winning_bid]
        }
      }]
    };
  }

  // Int64 features
  if (data.is_responded !== undefined) {
    featureLists['is_responded'] = {
      feature: [{
        int64List: {  // camelCase!
          value: [data.is_responded]
        }
      }]
    };
  }

  // Sort keys alphabetically to match Python's output
  const sortedFeatureLists = {};
  const keys = Object.keys(featureLists).sort();
  for (const key of keys) {
    sortedFeatureLists[key] = featureLists[key];
  }

  return { featureLists: sortedFeatureLists };  // camelCase!
}

// Serialize SequenceExample to protobuf bytes using protobufjs
function serializeSequenceExample(sequenceExample) {
  const protobuf = require('protobufjs');
  const path = require('path');

  // Load the proto file
  const root = protobuf.loadSync(path.join(__dirname, '../proto/example.proto'));
  const SequenceExample = root.lookupType('tensorflow.SequenceExample');

  // Verify and encode
  const errMsg = SequenceExample.verify(sequenceExample);
  if (errMsg) throw Error(errMsg);

  const message = SequenceExample.create(sequenceExample);
  return SequenceExample.encode(message).finish();
}

module.exports = {
  buildSequenceExample,
  serializeSequenceExample
};
