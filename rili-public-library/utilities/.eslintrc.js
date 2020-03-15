const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        jest: true,
        mocha: true
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended'
    ],
    plugins: [
        '@typescript-eslint'
    ],
    parser: '@typescript-eslint/parser',
    rules: {
        'indent': [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 140 }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        'import/prefer-default-export': 'off',
    }
};

