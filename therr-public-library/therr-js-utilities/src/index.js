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
    'localization',
    'promiser',
    'scroll-to',
    'Logger',
    'normalize-phone-number',
    'print-logs',
];

module.exports = utilities;
