// Shared ESLint configuration for backend microservices (therr-services/*).
// Usage in service .eslintrc.js:
//   const serviceConfig = require('../../eslint-config/service');
//   module.exports = serviceConfig(__dirname);

const path = require('path');
const baseConfig = require('./base');
const { SHARED_LIBRARY_MODULES, SHARED_LIBRARY_INTERNAL_REGEX } = require('./shared-library-modules');
const { MIGRATION_IDEMPOTENCY_CUTOFF } = require('./migration-idempotency-cutoff');

// The brand-scoped-table and async-table-builder invariants used to be expressed as
// `no-restricted-syntax` selectors. Two problems with that, both now fixed by moving them
// into eslint-plugin-therr (eslint-config/plugin) as first-class rules:
//
//   1. They shared a rule ID with airbnb-base's for..of/for..in/with/label restrictions,
//      so a single `// eslint-disable-next-line no-restricted-syntax` written to permit a
//      for..of loop also switched off brand-scoped-table enforcement on that line.
//   2. Setting `no-restricted-syntax` here *replaced* airbnb's selectors rather than
//      extending them, silently disabling the for..of/for..in restrictions across every
//      service. (The four disable comments in service code are evidence: they suppress a
//      rule that had stopped firing.) Not overriding the rule restores those.
//
// The rules are unit-tested with ESLint's RuleTester — see eslint-config/plugin/tests/.

module.exports = function createServiceConfig(serviceDir, overrides = {}) {
    return {
        ...baseConfig,
        env: {
            node: true,
            mocha: true,
        },
        plugins: [
            ...(baseConfig.plugins || []),
            'therr',
        ],
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
            'therr/no-direct-brand-scoped-table': 'error',
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
            // or dropping them — brand-scoping is enforced at runtime via BrandScopedStore, and
            // schema-level DDL is safe by definition. So that rule is off here.
            //
            // Migrations have their own footguns instead, and both rules below are on only
            // here, where migrations actually live:
            //
            //   - `no-async-table-builder-callback`: an `async` callback passed to a Knex table
            //     builder silently drops every `table.*` call after the first `await` from the
            //     emitted DDL.
            //   - `require-idempotent-migration`: a migration that dies partway through leaves
            //     the schema half-changed with no `knex_migrations` row, so the next deploy
            //     re-runs it from the top and fails on the half it already applied. Applies from
            //     MIGRATION_IDEMPOTENCY_CUTOFF forward — see migration-idempotency-cutoff.js for
            //     why the back catalogue is exempt.
            {
                files: ['src/store/migrations/**/*.js', 'src/store/seeds/**/*.js'],
                rules: {
                    'therr/no-direct-brand-scoped-table': 'off',
                    'therr/no-async-table-builder-callback': 'error',
                    'therr/require-idempotent-migration': ['error', { since: MIGRATION_IDEMPOTENCY_CUTOFF }],
                },
            },
            ...(overrides.overrides || []),
        ],
        settings: {
            'import/core-modules': SHARED_LIBRARY_MODULES,
            'import/internal-regex': SHARED_LIBRARY_INTERNAL_REGEX,
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
