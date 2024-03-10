// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This will allow tree-shaking

const utilities = [
    // Config
    'config/index',

    // Constants
    'constants/index',

    // Database Helpers
    'db/index',

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
    'is-valid-input',
    'is-valid-password',
    'localization',
    'promiser',
    'scroll-to',
    'normalize-phone-number',
    'print-logs',
    'log-or-update-span',
];

module.exports = utilities;
