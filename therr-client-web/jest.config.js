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
        'therr-react/(.*)': '<rootDir>../therr-public-library/therr-react/lib/$1',
        'therr-js-utilities/(.*)': '<rootDir>../therr-public-library/therr-js-utilities/lib/$1',
        'therr-styles/(.*)': '<rootDir>../therr-public-library/therr-styles/lib/$1.css',
        '^actions/(.*)': '<rootDir>/src/redux/actions/$1.ts',
        '^enums/(.*)': '<rootDir>/src/constants/enums/$1.ts',
        '^types/(.*)': '<rootDir>/src/redux/types/$1.ts',
    },
    setupFiles: [],
    setupFilesAfterEnv: ['./test-setup.ts'],
    testEnvironmentOptions: {
        url: 'https://www.example.com/',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
