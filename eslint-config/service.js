// Shared ESLint configuration for backend microservices (therr-services/*).
// Usage in service .eslintrc.js:
//   const serviceConfig = require('../../eslint-config/service');
//   module.exports = serviceConfig(__dirname);

const path = require('path');
const baseConfig = require('./base');
const { BRAND_SCOPED_TABLES } = require('./brand-scoped-tables');

// Build a no-restricted-syntax selector that flags string literals matching brand-scoped table names.
// Catches `.from('main.notifications')`, `into('main.notifications')`, raw SQL `FROM main.notifications`,
// and the `'main.notifications'` constant in tableNames.ts (intentional — only sanctioned stores should re-export it).
// Storefiles that legitimately reference the table go in the per-service .eslintrc.js overrides.
const buildBrandScopedTablesRule = () => {
    if (!BRAND_SCOPED_TABLES.length) {
        // No tables onboarded yet (early in the multi-app data isolation rollout). Rule is a no-op.
        return [];
    }
    const selectors = BRAND_SCOPED_TABLES.map((tableName) => ({
        selector: `Literal[value="${tableName}"]`,
        message: `Direct reference to brand-scoped table "${tableName}" is forbidden. `
            + 'Route the query through the BrandScopedStore subclass for this table. '
            + 'See docs/NICHE_APP_DATABASE_GUIDELINES.md.',
    }));
    return [['error', ...selectors]];
};

module.exports = function createServiceConfig(serviceDir, overrides = {}) {
    const brandScopedRule = buildBrandScopedTablesRule();
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
            ...(brandScopedRule.length ? { 'no-restricted-syntax': brandScopedRule[0] } : {}),
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
            // Migration files legitimately reference brand-scoped tables when creating, altering,
            // or dropping them. The brand-scoping enforcement is at runtime via BrandScopedStore;
            // schema-level operations are safe by definition.
            {
                files: ['src/store/migrations/**/*.js', 'src/store/seeds/**/*.js'],
                rules: {
                    'no-restricted-syntax': 'off',
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
