const createServiceConfig = require('../../eslint-config/service');

module.exports = createServiceConfig(__dirname, {
    rules: {
        'no-console': 'off',
        'no-plusplus': 'off',
        'no-await-in-loop': 'off',
        'no-restricted-syntax': 'off',
    },
});
