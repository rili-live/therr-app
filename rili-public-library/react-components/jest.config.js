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
        'rili-public-library/utilities/(.*)': '<rootDir>../rili-public-library/utilities/lib/$1.js',
        'rili-public-library/styles/(.*)': '<rootDir>../rili-public-library/styles/$1.js',
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
