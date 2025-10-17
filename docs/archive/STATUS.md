# gRPC Inference Client - Status

## ✅ What's Working

1. **Proto files** - TensorFlow Serving protos load correctly
2. **SequenceExample serialization** - 501 bytes with 17 features
3. **PredictRequest encoding** - 567 bytes total, properly formatted
4. **Direct pod connection** - Successfully connecting to `100.68.51.130:9500`
5. **Field naming** - Fixed protobufjs camelCase requirement

## ❌ Current Issue

**INTERNAL Error from TensorFlow Serving**

```
Error: 13 INTERNAL:
Details: (empty)
```

The server is receiving our request but returning an internal error with no details.

## Request Structure (Verified Working)

```javascript
PredictRequest {
  modelSpec: {
    name: 'dnb_model_baseline',
    signatureName: 'serving_default'
  },
  inputs: {
    examples: TensorProto {
      dtype: 7 (DT_STRING),
      tensorShape: { dim: [{ size: 1 }] },
      stringVal: [<501 byte SequenceExample>]
    }
  }
}
```

The SequenceExample contains all 17 features:
- String features: time, date, ad_type, adsuuid, ageRange, city, feed_fetch_counter, gender, language, osVersion, phoneCarrier, phoneModel, sourceApp, state, userid
- Float features: floor_price, winning_bid

## Key Learnings

### protobufjs uses camelCase!

When using protobufjs, field names must be in camelCase:
- `model_spec` → `modelSpec`
- `signature_name` → `signatureName`
- `feature_lists` → `featureLists`
- `bytes_list` → `bytesList`
- `float_list` → `floatList`
- `string_val` → `stringVal`
- `tensor_shape` → `tensorShape`

This is different from the proto definitions which use snake_case.

## Next Steps

1. Verify the Python notebook works with the same pod IP
2. Compare the exact bytes sent by Python vs. Node.js
3. Check TensorFlow Serving logs for more details on the INTERNAL error
4. Verify the model is loaded and accessible

## Files

- [src/test-request.js](src/test-request.js) - Main client
- [src/request-builder.js](src/request-builder.js) - SequenceExample builder
- [src/inspect-request.js](src/inspect-request.js) - Debug tool to inspect encoded bytes
- [proto/](proto/) - TensorFlow Serving proto definitions

## Testing

```bash
# Run inference request
npm run test-request

# Inspect request structure
node src/inspect-request.js

# Test proto loading
npm run test-proto
```
