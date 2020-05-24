module.exports = {
    preset: 'react-native',
    // globals: {
    //     window: {
    //         location: {
    //             origin: 'https://www.example.com/',
    //         },
    //     },
    // },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^.+\\.(png)$': '<rootDir>/__mocks__/fileMock.ts',
        '^.+\\.(css|scss|svg)$': 'identity-obj-proxy',
        'shared/(.*)': '<rootDir>../node_modules/$1',
        'rili-public-library/styles/(.*)': '<rootDir>../rili-public-library/styles/lib/$1.css',
        'rili-public-library/react-components/(.*)': '<rootDir>../rili-public-library/react-components/lib/$1',
        'rili-public-library/utilities/(.*)': '<rootDir>../rili-public-library/utilities/lib/$1',
    },
    moduleDirectories: [
        "<rootDir>/node_modules",
        "<rootDir>../node_modules"
    ],
    setupFiles: ['./test-setup.ts'],
    testURL: 'https://www.example.com/',
    // transform: {
    //     '^.+\\.tsx?$': 'ts-jest',
    //     '^.+\\.jsx?$': 'babel-jest',
    // },
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
