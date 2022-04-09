module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        [
            'module:react-native-dotenv',
            {
                path: '.env',
                moduleName: 'react-native-dotenv',
                allowUndefined: false,
                allowlist: ['GOOGLE_APIS_ANDROID_KEY', 'GOOGLE_APIS_IOS_KEY'],
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
        // 'react-native-reanimated/plugin',
    ],
};
