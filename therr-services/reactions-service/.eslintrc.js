const createServiceConfig = require('../../eslint-config/service');

// reactions-service uses Chai assertions in non-test source files
module.exports = createServiceConfig(__dirname, {
    rules: {
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
    },
});
