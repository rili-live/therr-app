const path = require('path');
const baseConfig = require('../eslint-config/base');

// TherrMobile uses @react-native instead of airbnb-base,
// so it only uses base rules (not base extends).
module.exports = {
    env: {
        jest: true,
    },
    extends: ['@react-native'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'jest'],
    ignorePatterns: ['**/.eslintrc.js'],
    rules: {
        ...baseConfig.rules,
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/sort-comp': [
            2,
            {
                order: ['static-variables', 'static-methods', 'instance-variables', 'constructor', 'lifecycle', 'everything-else', 'render'],
            },
        ],
        'prettier/prettier': 'off',
        'import/prefer-default-export': 'off',
        semi: 'error',
        'comma-dangle': ['error', 'always-multiline'],
        'no-trailing-spaces': 'error',
    },
    settings: {
        'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/resolver': {
            alias: {
                map: [
                    ['shared/*', path.join(__dirname, '../node_modules')],
                    ['therr-react/*', path.join(__dirname, '../therr-public-library/therr-react/lib')],
                    ['therr-styles/*', path.join(__dirname, '../therr-public-library/therr-styles/lib')],
                    ['therr-js-utilities/*', path.join(__dirname, '../therr-public-library/therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.ts', '.json', '.scss'],
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
        react: {
            version: 'detect',
        },
    },
};
