// jest.config.js
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
        'rili-public-library/react-components/(.*)': '<rootDir>../rili-public-library/react-components/lib/$1.js',
        'rili-public-library/utilities/(.*)': '<rootDir>../rili-public-library/utilities/lib/$1.js',
    },
    setupFiles: [],
    setupTestFrameworkScriptFile: './test-setup.ts',
    testURL: 'https://www.example.com/',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
