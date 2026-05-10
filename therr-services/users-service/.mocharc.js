module.exports = {
  extension: ['ts', 'js'],
  timeout: 10000, // 10 second timeout for integration tests
  require: ['./tests/setup.ts'],
};
