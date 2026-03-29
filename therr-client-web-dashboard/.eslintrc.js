const createWebConfig = require('../eslint-config/web');

module.exports = createWebConfig(__dirname, {
    rules: {
        'react/no-unescaped-entities': 'off',
    },
});
