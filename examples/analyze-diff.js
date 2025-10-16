// Python's serialized SequenceExample (503 bytes)
const pythonHex = "12f4030a170a0c69735f726573706f6e64656412070a051a030a01000a1d0a12666565645f66657463685f636f756e74657212070a050a030a01320a170a096f7356657273696f6e120a0a080a060a04726573740a150a09736f7572636541707012080a060a040a0253430a190a046369747912110a0f0a0d0a0b63686974726164757267610a1a0a0675736572696412100a0e0a0c0a0a323534353236343837320a250a0a70686f6e654d6f64656c12170a150a130a117869616f6d6920323230343132313970690a1e0a0c70686f6e6543617272696572120e0a0c0a0a0a08766920696e6469610a180a057374617465120f0a0d0a0b0a096b61726e6174616b610a170a086c616e6775616765120b0a090a070a0574616d696c0a190a0b77696e6e696e675f626964120a0a0812060a04000000000a170a0861676552616e6765120b0a090a070a0531382d32340a210a0474696d6512190a170a150a13323032352d31302d31302030393a32313a33340a190a0b666c6f6f725f7072696365120a0a0812060a040000a0400a1d0a0761645f7479706512120a100a0e0a0c53435f4f555453545245414d0a110a0667656e64657212070a050a030a01460a350a0761647375756964122a0a280a260a2465356332663339342d303233652d343338332d393264302d623238663137633130653465";

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

const sequenceExample = buildSequenceExample(sampleData);
const nodeJsBytes = serializeSequenceExample(sequenceExample);
const nodeJsHex = nodeJsBytes.toString('hex');

console.log('Python length:', pythonHex.length / 2, 'bytes');
console.log('Node.js length:', nodeJsBytes.length, 'bytes');
console.log('Difference:', (pythonHex.length / 2) - nodeJsBytes.length, 'bytes');

console.log('\n=== First 100 chars comparison ===');
console.log('Python: ', pythonHex.substring(0, 100));
console.log('Node.js:', nodeJsHex.substring(0, 100));

// Check if strings match anywhere
if (pythonHex.includes(nodeJsHex.substring(50, 150))) {
  console.log('\n✓ Found Node.js substring in Python (features might just be reordered)');
} else {
  console.log('\n✗ Structures are fundamentally different');
}

// Decode feature names from Python hex
console.log('\n=== Python feature order (first 5) ===');
const pythonBuffer = Buffer.from(pythonHex, 'hex');
let pos = 0;
let count = 0;

function readVarint(buf, offset) {
  let value = 0;
  let shift = 0;
  let b;
  let i = offset;

  do {
    b = buf[i++];
    value |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);

  return { value, newOffset: i };
}

// Skip first field tag and length
pos = 2; // Skip 12 f4 03

for (let i = 0; i < 5 && pos < pythonBuffer.length; i++) {
  try {
    if (pythonBuffer[pos] === 0x0a) { // Field tag for feature_list entry
      pos++;
      const lengthResult = readVarint(pythonBuffer, pos);
      pos = lengthResult.newOffset;

      // Read key
      if (pythonBuffer[pos] === 0x0a) { // Key field
        pos++;
        const keyLenResult = readVarint(pythonBuffer, pos);
        const keyLen = keyLenResult.value;
        pos = keyLenResult.newOffset;

        const key = pythonBuffer.slice(pos, pos + keyLen).toString('utf-8');
        console.log(`  ${i + 1}. ${key}`);

        pos += keyLen;
        // Skip value for now
        if (pythonBuffer[pos] === 0x12) {
          pos++;
          const valueLenResult = readVarint(pythonBuffer, pos);
          pos = valueLenResult.newOffset + valueLenResult.value;
        }
      }
    } else {
      break;
    }
  } catch (e) {
    break;
  }
}

console.log('\n=== Node.js feature order (first 5) ===');
const nodeJsBuffer = nodeJsBytes;
pos = 2; // Skip first bytes

for (let i = 0; i < 5 && pos < nodeJsBuffer.length; i++) {
  try {
    if (nodeJsBuffer[pos] === 0x0a) {
      pos++;
      const lengthResult = readVarint(nodeJsBuffer, pos);
      pos = lengthResult.newOffset;

      if (nodeJsBuffer[pos] === 0x0a) {
        pos++;
        const keyLenResult = readVarint(nodeJsBuffer, pos);
        const keyLen = keyLenResult.value;
        pos = keyLenResult.newOffset;

        const key = nodeJsBuffer.slice(pos, pos + keyLen).toString('utf-8');
        console.log(`  ${i + 1}. ${key}`);

        pos += keyLen;
        if (nodeJsBuffer[pos] === 0x12) {
          pos++;
          const valueLenResult = readVarint(nodeJsBuffer, pos);
          pos = valueLenResult.newOffset + valueLenResult.value;
        }
      }
    } else {
      break;
    }
  } catch (e) {
    break;
  }
}
