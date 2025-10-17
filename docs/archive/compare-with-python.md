# Comparison: Python (Working) vs Node.js (INTERNAL Error)

## Python's Approach

```python
tensor_proto = tf.make_tensor_proto(
    values=[serialized_example],
    dtype=tf.string,
    shape=[1]
)
request.inputs["examples"].CopyFrom(tensor_proto)
```

## Our Node.js Approach

```javascript
{
  dtype: 7, // DT_STRING
  tensorShape: {
    dim: [{ size: 1 }]
  },
  stringVal: [serializedExample]
}
```

## Potential Issue

TensorProto has MANY fields, not just dtype, shape, and string_val. The `tf.make_tensor_proto` might be setting additional fields we're missing!

TensorProto fields include:
- dtype
- tensor_shape
- version_number
- tensor_content (packed binary)
- half_val, float_val, double_val
- int_val, string_val, scomplex_val, int64_val
- bool_val, dcomplex_val, resource_handle_val
- variant_val, uint32_val, uint64_val

**Hypothesis**: We might need to use a more complete TensorProto definition.
