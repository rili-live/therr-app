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
        '@react-native-firebase/messaging': '<rootDir>/__mocks__/firebase/messaging.ts',
        '@invertase/react-native-apple-authentication': '<rootDir>/__mocks__/@invertase/react-native-apple-authentication.js',
        'react-native-device-info': '<rootDir>/__mocks__/react-native-device-info.ts',
    },
    moduleDirectories: ['<rootDir>/node_modules', '<rootDir>../node_modules'],
    setupFiles: ['./test-setup.ts'],
    testEnvironmentOptions: {
        url: 'https://www.example.com/',
    },
    // transform: {
    //     '^.+\\.tsx?$': 'ts-jest',
    //     '^.+\\.jsx?$': 'babel-jest',
    // },
    transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native(-.*)?|@react-native|@react-native-community|@react-native-picker|validator/es/lib/*)',
    ],
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
