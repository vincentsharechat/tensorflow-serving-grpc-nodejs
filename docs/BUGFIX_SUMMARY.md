# SequenceExample Serialization Bug Fix

## Problem

The initial implementation produced invalid Protocol Buffer serialization that TensorFlow Serving rejected with:

```
INVALID_ARGUMENT: Invalid protocol message input, example id: <unknown>
```

## Root Cause

The simplified `example.proto` file was missing the `FeatureLists` wrapper message that TensorFlow expects.

### Incorrect Structure (Before)

```protobuf
message SequenceExample {
  map<string, FeatureList> feature_lists = 2;  // ❌ Direct map
}
```

This produced hex: `121a0a07...` (28 bytes for single feature)

### Correct Structure (After)

```protobuf
message SequenceExample {
  FeatureLists feature_lists = 2;  // ✅ Wrapper message
}

message FeatureLists {
  map<string, FeatureList> feature_list = 1;  // Map inside wrapper
}
```

This produces hex: `121c0a1a0a07...` (30 bytes for single feature) - matches Python exactly!

## Technical Details

### Hex Comparison

**Python (correct):**
```
121c0a1a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f31
```

**Node.js before fix:**
```
121a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f31
```

**Node.js after fix:**
```
121c0a1a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f31
```
✅ Perfect match!

### Binary Structure Analysis

The missing bytes `0a1a` represent:
- `0a` = wire type 2 (length-delimited message) for field 1
- `1a` = length (26 bytes) of the inner map entry

This is the `FeatureLists` wrapper that contains the map of feature lists.

## Changes Made

### 1. Updated proto/example.proto

Added the complete TensorFlow structure:

```protobuf
message SequenceExample {
  Features context = 1;
  FeatureLists feature_lists = 2;
}

message FeatureLists {
  map<string, FeatureList> feature_list = 1;
}
```

### 2. Updated sequence-example-builder.js

Changed the object structure to include the wrapper:

**Before:**
```javascript
const sequenceExample = SequenceExample.create({
  featureLists: featureListMap  // ❌ Direct map
});
```

**After:**
```javascript
const sequenceExample = SequenceExample.create({
  featureLists: {
    featureList: featureListMap  // ✅ Map inside wrapper
  }
});
```

## Verification

### Test with Single Feature
```bash
node -e "
const { buildSequenceExample, toHex } = require('./sequence-example-builder');
const hex = toHex(buildSequenceExample({'ad_type': ['SC_CPCV_1']}));
console.log('Match:', hex === '121c0a1a0a0761645f74797065120f0a0d0a0b0a0953435f435043565f31');
"
```

Output: `Match: true` ✅

### Test with Full gRPC Client
```bash
node client-with-builder.js
```

Output: `✅ SUCCESS!` with valid predictions ✅

## Key Takeaways

1. **Proto Structure Matters**: Even subtle differences in message nesting can cause serialization incompatibilities
2. **Test with Real Data**: The standalone serialization test didn't catch the issue - only the actual TensorFlow Serving call revealed it
3. **Wrapper Messages**: Protocol Buffer maps in nested structures require proper wrapper messages
4. **Field Numbering**: The `FeatureLists` message uses field 1 for `feature_list`, which is crucial for correct encoding

## Related TensorFlow Protos

The correct structure comes from TensorFlow's official proto definition:
- `tensorflow/core/example/example.proto`
- Defines: `SequenceExample`, `FeatureLists`, `FeatureList`, `Feature`, etc.

Our simplified proto now matches this structure for the fields we need.
