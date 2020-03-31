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
        'rili-public-library/utilities/(.*)': '<rootDir>../utilities/lib/$1',
        'rili-public-library/styles/(.*)': '<rootDir>../styles/$1',
    },
    rootDir: './',
    setupFiles: [],
    setupFilesAfterEnv: ['./test-setup.ts'],
    testURL: 'https://www.example.com/',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    testRegex: 'src/.*/__tests__/.*\\.(tsx?|jsx?)$',
};
