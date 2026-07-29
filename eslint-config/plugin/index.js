// Repo-local ESLint plugin: architectural invariants that must fail the build.
//
// These were previously expressed as `no-restricted-syntax` selectors. That worked, but
// shared a single rule ID with airbnb-base's for..of/for..in/with/label restrictions, so
// one `// eslint-disable-next-line no-restricted-syntax` comment written for a for..of loop
// also silently switched off brand-scoped-table enforcement on that line. Giving each
// invariant its own rule ID makes a disable comment mean exactly one thing.
//
// Consumed via `plugins: ['therr']` — see eslint-config/service.js.

module.exports = {
    rules: {
        'no-direct-brand-scoped-table': require('./rules/no-direct-brand-scoped-table'),
        'no-async-table-builder-callback': require('./rules/no-async-table-builder-callback'),
    },
};
