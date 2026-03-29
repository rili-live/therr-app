// Shared ESLint configuration for React web clients (therr-client-web, therr-client-web-dashboard).
// Usage in web client .eslintrc.js:
//   const webConfig = require('../eslint-config/web');
//   module.exports = webConfig(__dirname);

const path = require('path');
const baseConfig = require('./base');

module.exports = function createWebConfig(clientDir, overrides = {}) {
    return {
        ...baseConfig,
        env: {
            browser: true,
            jest: true,
        },
        extends: [
            ...baseConfig.extends,
            'plugin:react/recommended',
        ],
        plugins: [
            ...baseConfig.plugins,
            'jsx-a11y',
        ],
        rules: {
            ...baseConfig.rules,
            'jsx-a11y/label-has-associated-control': [2, {
                labelComponents: ['CustomInputLabel'],
                labelAttributes: ['label'],
                controlComponents: ['CustomInput'],
                depth: 3,
            }],
            'react/jsx-indent': [2, 4],
            'react/jsx-indent-props': [2, 4],
            'react/prop-types': 'off',
            'react/display-name': 'off',
            'react/sort-comp': [
                2,
                {
                    order: ['static-variables', 'static-methods', 'instance-variables', 'constructor', 'lifecycle', 'everything-else', 'render'],
                },
            ],
            'import/extensions': [
                'error',
                'always',
                {
                    js: 'never',
                    jsx: 'always',
                    ts: 'never',
                    tsx: 'never',
                    'd.ts': 'never',
                },
            ],
            'import/no-extraneous-dependencies': [
                'warn',
                {
                    packageDir: [
                        path.join(clientDir, './'),
                        path.join(clientDir, '../'),
                    ],
                },
            ],
            'import/no-unresolved': ['error', {
                ignore: ['\\.(jpg|jpeg|png|gif|svg|webp|css|scss)$'],
            }],
            ...(overrides.rules || {}),
        },
        overrides: [
            {
                files: ['**/__tests__/**', '**/*.test.*'],
                rules: {
                    '@typescript-eslint/no-var-requires': 'off',
                    '@typescript-eslint/no-empty-function': 'off',
                },
            },
            ...(overrides.overrides || []),
        ],
        settings: {
            'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx'],
            },
            'import/resolver': {
                alias: {
                    map: [
                        ['therr-react/*', path.join(clientDir, '../therr-public-library/therr-react/lib')],
                        ['therr-styles/*', path.join(clientDir, '../therr-public-library/therr-styles/lib')],
                        ['therr-js-utilities/*', path.join(clientDir, '../therr-public-library/therr-js-utilities/lib')],
                        ['types/*', path.join(clientDir, './src/redux/types')],
                        ['actions/*', path.join(clientDir, './src/redux/actions')],
                        ...(overrides.aliasMap || []),
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
            ...(overrides.settings || {}),
        },
    };
};
