// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This will allow tree-shaking

const utilities = [
    // Config
    'config/index',

    // Constants
    'constants/index',

    // Database Helpers
    'db/index',

    // Database Helpers — server only (knex + structural pg connection types)
    // Excluded from frontend bundles by default; consumers must import 'therr-js-utilities/db-server'.
    'db-server/index',

    // HTTP/REST Helpers
    'http/index',

    // Location
    'location/index',

    // Metrics
    'metrics/index',

    // Express Middleware
    'middleware/index',

    // Types
    'types/index',

    // Utilities
    'calculate-pages',
    'email-validator',
    'format-sql-join-as-json',
    'http-response',
    'index-now',
    'internal-rest-request',
    'is-valid-input',
    'is-valid-password',
    'localization',
    'promiser',
    'sanitizers',
    'scroll-to',
    'normalize-phone-number',
    'print-logs',
    'log-or-update-span',
    'slugify',
];

module.exports = utilities;
