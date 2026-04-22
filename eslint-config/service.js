// Shared ESLint configuration for backend microservices (therr-services/*).
// Usage in service .eslintrc.js:
//   const serviceConfig = require('../../eslint-config/service');
//   module.exports = serviceConfig(__dirname);

const path = require('path');
const baseConfig = require('./base');

module.exports = function createServiceConfig(serviceDir, overrides = {}) {
    return {
        ...baseConfig,
        env: {
            node: true,
            mocha: true,
        },
        rules: {
            ...baseConfig.rules,
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
                        path.join(serviceDir, './'),
                        path.join(serviceDir, '../..'),
                    ],
                },
            ],
            ...(overrides.rules || {}),
        },
        overrides: [
            {
                files: ['tests/**/*.ts', 'tests/**/*.tsx'],
                rules: {
                    'no-unused-expressions': 'off',
                    '@typescript-eslint/no-unused-expressions': 'off',
                    '@typescript-eslint/no-empty-function': 'off',
                },
            },
            ...(overrides.overrides || []),
        ],
        settings: {
            'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts'],
            },
            'import/resolver': {
                alias: {
                    map: [
                        ['therr-public-library/therr-styles/*', path.join(serviceDir, '../../therr-public-library/therr-styles')],
                        ['therr-js-utilities/*', path.join(serviceDir, '../../therr-public-library/therr-js-utilities/lib')],
                    ],
                    extensions: ['.js', '.jsx', '.json', '.scss'],
                },
                node: {
                    extensions: ['.js', '.ts'],
                },
            },
            ...(overrides.settings || {}),
        },
    };
};
