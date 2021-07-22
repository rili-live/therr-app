module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        [
            'module:react-native-dotenv',
            {
                path: '.env',
                moduleName: 'react-native-dotenv',
                allowUndefined: false,
                whitelist: ['EXAMPLE'],
            },
        ],
        'transform-inline-environment-variables',
        [
            'module-resolver',
            {
                alias: {
                    shared: '../node_modules',
                },
            },
        ],
    ],
};
