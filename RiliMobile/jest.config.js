module.exports = {
    preset: 'react-native',
    globals: {
        window: {}, // This required since we import Rili React library that is compiled for web app (with window)
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^.+\\.(png)$': '<rootDir>/__mocks__/fileMock.ts',
        '^.+\\.(css|scss|svg)$': 'identity-obj-proxy',
        'shared/(.*)': '<rootDir>../node_modules/$1',
        'rili-styles/(.*)': '<rootDir>../rili-public-library/styles/lib/$1.css',
        'rili-react/(.*)': '<rootDir>../rili-public-library/react/lib/$1',
        'rili-utilities/(.*)':
            '<rootDir>../rili-public-library/utilities/lib/$1',
    },
    moduleDirectories: ['<rootDir>/node_modules', '<rootDir>../node_modules'],
    setupFiles: ['./test-setup.ts'],
    testURL: 'https://www.example.com/',
    // transform: {
    //     '^.+\\.tsx?$': 'ts-jest',
    //     '^.+\\.jsx?$': 'babel-jest',
    // },
    testRegex: '/__tests__/.*\\.(tsx?|jsx?)$',
};
