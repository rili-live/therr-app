module.exports = {
    preset: 'react-native',
    globals: {
        window: {}, // This required since we import Therr React library that is compiled for web app (with window)
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^.+\\.(png)$': '<rootDir>/__mocks__/fileMock.ts',
        '^.+\\.(css|scss|svg)$': 'identity-obj-proxy',
        'shared/(.*)': '<rootDir>../node_modules/$1',
        'therr-styles/(.*)':
            '<rootDir>../therr-public-library/therr-styles/lib/$1.css',
        'therr-react/(.*)':
            '<rootDir>../therr-public-library/therr-react/lib/$1',
        'therr-js-utilities/(.*)':
            '<rootDir>../therr-public-library/therr-js-utilities/lib/$1',
    },
    moduleDirectories: ['<rootDir>/node_modules', '<rootDir>../node_modules'],
    setupFiles: ['./test-setup.ts'],
    testURL: 'https://www.example.com/',
    // transform: {
    //     '^.+\\.tsx?$': 'ts-jest',
    //     '^.+\\.jsx?$': 'babel-jest',
    // },
    transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native-community|@react-native-picker|validator/es/lib/*)',
    ],
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
