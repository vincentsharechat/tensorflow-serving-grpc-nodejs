# SequenceExample Serialization Guide

This guide shows how to build and serialize TensorFlow `SequenceExample` protobuf messages in Node.js, equivalent to Python's `SerializeToString()` method.

## Overview

The serialization workflow involves:

1. **Building**: Create a SequenceExample from feature data using `protobufjs`
2. **Serializing**: Convert to binary format (equivalent to Python's `SerializeToString()`)
3. **Sending**: Use the binary data in gRPC requests with `@grpc/grpc-js`

## Quick Start

### 1. Basic Serialization

```javascript
const { buildSequenceExample, toHex } = require('./sequence-example-builder');

// Define your feature lists
const featureListsData = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"],
  "ageRange": ["18-24"]
};

// Serialize to binary (equivalent to Python's SerializeToString())
const serializedBinary = buildSequenceExample(featureListsData);

// Get hex representation (equivalent to Python's .hex())
const hexString = toHex(serializedBinary);

console.log('Binary:', serializedBinary);  // Buffer
console.log('Hex:', hexString);           // String
```

### 2. Complete gRPC Client Example

```javascript
const { buildSequenceExample } = require('./sequence-example-builder');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Build SequenceExample
const featureListsData = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"],
  // ... more features
};

const serializedExample = buildSequenceExample(featureListsData);

// Use in gRPC request
const request = {
  model_spec: {
    name: 'my_model',
    signature_name: 'serving_default'
  },
  inputs: {
    'examples': {
      dtype: 7,  // DT_STRING
      tensor_shape: { dim: [{ size: 1 }] },
      string_val: [serializedExample]  // Use the serialized binary
    }
  }
};

// Send request...
```

## Supported Feature Types

### String Features (bytes_list)

```javascript
const features = {
  "gender": ["F"],
  "city": ["koppal"]
};
```

### Integer Features (int64_list)

```javascript
const features = {
  "age": [25],
  "count": [42]
};
```

### Float Features (float_list)

```javascript
const features = {
  "price": [9.99],
  "rating": [4.5]
};
```

### Multiple Values per Feature

```javascript
const features = {
  "tags": ["sports", "news", "entertainment"],  // Multiple strings
  "scores": [0.8, 0.6, 0.9]                     // Multiple floats
};
```

## API Reference

### `buildSequenceExample(featureListsData)`

Builds and serializes a SequenceExample from feature data.

**Parameters:**
- `featureListsData` (Object): Feature lists with string keys and array values

**Returns:**
- `Buffer`: Serialized binary protocol buffer

**Example:**
```javascript
const serialized = buildSequenceExample({
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"]
});
```

### `toHex(buffer)`

Converts a serialized buffer to hex string.

**Parameters:**
- `buffer` (Buffer): Serialized protocol buffer

**Returns:**
- `string`: Hex string representation

**Example:**
```javascript
const hexString = toHex(serialized);
console.log(hexString); // "121a0a07..."
```

## Python Equivalence

### Python Code

```python
import tensorflow as tf

# Build SequenceExample
sequence_example = tf.train.SequenceExample()
feature_lists = sequence_example.feature_lists.feature_list

# Add features
feature_lists['ad_type'].feature.add().bytes_list.value.append(b'SC_CPCV_1')
feature_lists['userid'].feature.add().bytes_list.value.append(b'749603295')

# Serialize
serialized_binary = sequence_example.SerializeToString()
hex_string = serialized_binary.hex()
```

### Node.js Equivalent

```javascript
const { buildSequenceExample, toHex } = require('./sequence-example-builder');

// Build and serialize
const featureListsData = {
  "ad_type": ["SC_CPCV_1"],
  "userid": ["749603295"]
};

const serializedBinary = buildSequenceExample(featureListsData);
const hexString = toHex(serializedBinary);
```

## How It Works

### Protocol Buffer Structure

The `SequenceExample` proto structure (matches TensorFlow's official definition):

```protobuf
message SequenceExample {
  Features context = 1;           // Optional context features
  FeatureLists feature_lists = 2; // Required: wrapper for feature lists
}

message FeatureLists {
  map<string, FeatureList> feature_list = 1; // Map of feature lists
}

message FeatureList {
  repeated Feature feature = 1;   // Array of features
}

message Feature {
  oneof kind {
    BytesList bytes_list = 1;     // For string/bytes values
    FloatList float_list = 2;     // For float values
    Int64List int64_list = 3;     // For integer values
  }
}
```

**Important:** The `FeatureLists` wrapper message (field 2) is critical. Without this wrapper, TensorFlow Serving will reject the serialized data with `INVALID_ARGUMENT` errors.

### Internal Representation

When you pass:
```javascript
{
  "ad_type": ["SC_CPCV_1"]
}
```

It's converted to:
```javascript
{
  featureLists: {           // FeatureLists wrapper message
    featureList: {          // Map inside wrapper
      'ad_type': {          // FeatureList for 'ad_type' key
        feature: [          // Array of Feature messages
          {
            bytesList: {
              value: [Buffer.from('SC_CPCV_1')]
            }
          }
        ]
      }
    }
  }
}
```

**Important:** The `FeatureLists` wrapper message is required for TensorFlow compatibility. Without it, you'll get `INVALID_ARGUMENT` errors from TensorFlow Serving.

Note: `protobufjs` uses camelCase (`featureLists`, `bytesList`) while Python uses snake_case (`feature_lists`, `bytes_list`). The binary output is identical.

## Library Compatibility

### protobufjs (for serialization)
- Used for creating and encoding SequenceExample
- Provides `.create()` and `.encode()` methods
- Produces standard Protocol Buffer binary format

### @grpc/grpc-js (for gRPC)
- Used for sending binary data via gRPC
- Fully compatible with protobufjs binary output
- Both follow the same Protocol Buffer specification

The binary format is standardized, so data serialized with protobufjs can be sent with @grpc/grpc-js and deserialized in Python/TensorFlow.

## Common Issues

### Empty Buffer (0 bytes)

**Problem:**
```javascript
const buffer = buildSequenceExample({ ... });
console.log(buffer.length); // 0
```

**Solution:** Make sure to use camelCase field names internally (handled automatically by the library).

### Map Field Ordering

The hex output may differ from Python due to map field ordering:

```
Python:  1299030a170a0861676552616e6765...
Node.js: 121a0a0761645f74797065120f0a0d...
```

This is **normal and expected**. Protocol Buffer maps don't guarantee ordering. Both representations deserialize to identical data.

## Running Examples

### Test the builder
```bash
node sequence-example-builder.js
```

### Run complete client
```bash
node client-with-builder.js
```

### Run original client with hex input
```bash
node final-working-client.js
```

## Summary

- Use `buildSequenceExample()` to convert feature objects to binary
- Use `toHex()` to get hex string representation
- The binary output is compatible with `@grpc/grpc-js` and TensorFlow Serving
- Map ordering differences from Python are normal and safe
