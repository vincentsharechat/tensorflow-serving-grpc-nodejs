const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load the proto files
const PROTO_PATH = path.join(__dirname, '../proto/predict.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, '../proto')]
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

console.log('✓ Proto files loaded successfully');
console.log('✓ Available services:', Object.keys(protoDescriptor.tensorflow.serving));
console.log('✓ PredictionService found:', !!protoDescriptor.tensorflow.serving.PredictionService);
