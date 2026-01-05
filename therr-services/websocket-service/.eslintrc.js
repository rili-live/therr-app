const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        node: true,
        mocha: true,
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
    ],
    plugins: [
        '@typescript-eslint',
    ],
    parser: '@typescript-eslint/parser',
    rules: {
        indent: [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 160 }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/interface-name-prefix': 0,
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        'import/prefer-default-export': 'off',
        'no-unused-expressions': 'off', // Allow chai assertions like expect().to.be.eq(true)
        '@typescript-eslint/no-unused-expressions': 'off',
        'import/extensions': [
            'error',
            'always',
            {
                js: 'never',
                ts: 'never',
                'd.ts': 'never',
            },
        ],
        'import/no-extraneous-dependencies': [
            'warn',
            {
                packageDir: [
                    path.join(__dirname, './'),
                    path.join(__dirname, '../..'),
                ],
            },
        ],
        'import/no-relative-packages': 'off',
    },
    settings: {
        'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts'],
        },
        'import/resolver': {
            // NOTE: These aliases must match aliases in webpack.config.js
            alias: {
                map: [
                    ['therr-public-library/therr-styles/*', path.join(__dirname, '../../therr-public-library/therr-styles')],
                    ['therr-js-utilities/*', path.join(__dirname, '../../therr-public-library/therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss'],
            },
            node: {
                extensions: ['.js', '.ts'],
            },
        },
    },
};
