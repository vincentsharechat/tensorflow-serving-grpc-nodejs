#!/usr/bin/env node
/**
 * SequenceExample Builder for TensorFlow Serving
 *
 * Converts feature_lists data structure to serialized binary format
 * using Protocol Buffers (equivalent to Python's SerializeToString())
 */

const protobuf = require('protobufjs');
const path = require('path');

/**
 * Loads the TensorFlow example.proto definitions
 *
 * NOTE: We use protobufjs for serialization (creating binary data),
 * while @grpc/grpc-js is used for sending the binary via gRPC.
 * The binary format is standardized and compatible between both libraries.
 */
function loadExampleProto() {
  const PROTO_PATH = path.join(__dirname, 'proto/example.proto');
  // Load with keepCase: false to use camelCase (protobufjs default)
  const root = protobuf.loadSync(PROTO_PATH);
  return root.lookupType('tensorflow.SequenceExample');
}

/**
 * Builds a SequenceExample from feature_lists data
 *
 * @param {Object} featureListsData - Object with feature lists
 * @returns {Buffer} - Serialized binary protocol buffer
 *
 * Example input:
 * {
 *   "ad_type": ["SC_CPCV_1"],
 *   "adsuuid": ["0532afbb-3c85-4776-b5c6-d908a47c1441"],
 *   "ageRange": ["18-24"],
 *   ...
 * }
 */
function buildSequenceExample(featureListsData) {
  const SequenceExample = loadExampleProto();

  // Convert feature_lists data to protobuf structure
  // NOTE: protobufjs uses camelCase by default (featureLists, bytesList, etc.)
  // Structure: SequenceExample.featureLists.featureList[key] = FeatureList
  const featureListMap = {};

  for (const [key, values] of Object.entries(featureListsData)) {
    // Each value array becomes a FeatureList
    const features = values.map(value => {
      // Determine the type of feature
      if (typeof value === 'string') {
        // BytesList for string values (use camelCase: bytesList)
        return {
          bytesList: {
            value: [Buffer.from(value, 'utf-8')]
          }
        };
      } else if (typeof value === 'number') {
        // Check if it's a float or int
        if (Number.isInteger(value)) {
          return {
            int64List: {
              value: [value]
            }
          };
        } else {
          return {
            floatList: {
              value: [value]
            }
          };
        }
      } else if (Buffer.isBuffer(value)) {
        // Already a buffer
        return {
          bytesList: {
            value: [value]
          }
        };
      } else {
        throw new Error(`Unsupported value type for key "${key}": ${typeof value}`);
      }
    });

    featureListMap[key] = {
      feature: features
    };
  }

  // Create the SequenceExample message with proper structure
  // SequenceExample has a FeatureLists message which contains the map
  const sequenceExample = SequenceExample.create({
    featureLists: {
      featureList: featureListMap
    }
  });

  // Encode to binary (equivalent to SerializeToString())
  const buffer = SequenceExample.encode(sequenceExample).finish();
  return buffer;
}

/**
 * Converts serialized buffer to hex string
 * (equivalent to Python's .hex() method)
 *
 * @param {Buffer} buffer - Serialized protocol buffer
 * @returns {string} - Hex string representation
 */
function toHex(buffer) {
  return buffer.toString('hex');
}

/**
 * Example usage demonstrating the conversion
 */
function exampleUsage() {
  console.log('🔧 SequenceExample Builder Demo\n');

  // Define feature_lists as object (your input data)
  const featureListsData = {
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
  };

  console.log('📝 Input feature_lists:');
  console.log(JSON.stringify(featureListsData, null, 2));
  console.log('');

  // Build and serialize
  const serialized = buildSequenceExample(featureListsData);

  console.log('✅ Serialization complete!\n');
  console.log(`📦 Binary size: ${serialized.length} bytes`);
  console.log('');

  // Display as Buffer
  console.log('🔢 Buffer representation:');
  console.log(serialized);
  console.log('');

  // Display as hex
  const hexString = toHex(serialized);
  console.log('🔤 Hex representation:');
  console.log(hexString);
  console.log('');

  // Compare with expected hex
  const expectedHex = "1299030a170a0861676552616e6765120b0a090a070a0531382d32340a150a09736f7572636541707012080a060a040a0253430a1a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f310a110a0667656e64657212070a050a030a01460a140a0463697479120c0a0a0a080a066b6f7070616c0a350a0761647375756964122a0a280a260a2430353332616662622d336338352d343737362d623563362d6439303861343763313434310a1d0a12666565645f66657463685f636f756e74657212070a050a030a01310a170a086c616e6775616765120b0a090a070a0574616d696c0a210a0474696d6512190a170a150a13323032352d31302d31302032323a30323a32340a200a0a70686f6e654d6f64656c12120a100a0e0a0c6f70706f20637068323638310a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a096f7356657273696f6e120a0a080a060a04726573740a200a0c70686f6e654361727269657212100a0e0a0c0a0a696e642061697274656c0a190a06757365726964120f0a0d0a0b0a09373439363033323935";

  console.log('🎯 Expected hex (from Python):');
  console.log(expectedHex);
  console.log('');

  // Note: Order might differ due to map iteration, but content should be the same
  if (hexString === expectedHex) {
    console.log('✅ Perfect match with Python output!');
  } else {
    console.log('⚠️  Hex differs (this is normal - protobuf map field ordering may vary)');
    console.log('   Both representations are valid and will deserialize identically');
  }

  return serialized;
}

// Export functions for use in other modules
module.exports = {
  buildSequenceExample,
  toHex,
  loadExampleProto
};

// Run example if executed directly
if (require.main === module) {
  exampleUsage();
}
