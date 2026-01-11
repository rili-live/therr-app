module.exports = {
    globals: {
        window: {
            location: {
                origin: 'https://www.example.com/',
            },
        },
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^.+\\.(css|scss|svg)$': 'identity-obj-proxy',
        'therr-js-utilities/(.*)': '<rootDir>../therr-js-utilities/lib/$1',
        'therr-styles/(.*)': '<rootDir>../therr-styles/$1',
    },
    rootDir: './',
    setupFiles: [],
    setupFilesAfterEnv: ['./test-setup.ts'],
    testEnvironmentOptions: {
        url: 'https://www.example.com/',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    testRegex: 'src/.*/__tests__/.*\\.(tsx?|jsx?)$',
};
