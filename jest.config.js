// Root jest.config.js — handles packages that don't have their own jest config
// (services, therr-js-utilities). Packages with their own jest.config.js
// (therr-client-web, TherrMobile, therr-react, therr-client-web-dashboard)
// should be tested from within their own directories.

// Jest defaults NODE_ENV to 'test', but global-config only has development/stage/production keys
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'test') {
    process.env.NODE_ENV = 'development';
}

module.exports = {
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^.+\\.(css|scss|svg|png)$': 'identity-obj-proxy',
        'therr-react/(.*)': '<rootDir>/therr-public-library/therr-react/lib/$1',
        'therr-js-utilities/(.*)': '<rootDir>/therr-public-library/therr-js-utilities/lib/$1',
        'therr-styles/(.*)': '<rootDir>/therr-public-library/therr-styles/lib/$1.css',
    },
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
    },
    testPathIgnorePatterns: [
        '/node_modules/',
        // Packages with their own jest.config.js — run from their own directories
        '<rootDir>/TherrMobile/',
        '<rootDir>/therr-client-web/',
        '<rootDir>/therr-client-web-dashboard/',
        '<rootDir>/therr-public-library/therr-react/',
        // Exclude compiled lib/ directories (contain .d.ts test files)
        '/lib/',
        // Exclude integration tests (require running database/Redis)
        '/tests/integration/',
    ],
    setupFilesAfterEnv: ['./jest.setup.js'],
    testRegex: '(/__tests__/.*|/tests/.*)\\.(tsx?|jsx?)$',
};
