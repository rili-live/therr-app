const path = require('path');

module.exports = {
    presets: ['module:@react-native/babel-preset'],
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
                root: ['.'],
                alias: {
                    shared: '../node_modules',
                },
                resolvePath(sourcePath, currentFile, opts) {
                    if (
                        sourcePath === 'react-native' &&
                        !(
                            (
                                currentFile.includes('node_modules/react-native/') || // macos/linux paths
                                currentFile.includes('node_modules\\react-native\\')
                            ) // windows path
                        ) &&
                        !(
                            currentFile.includes('resolver/react-native/') ||
                            currentFile.includes('resolver\\react-native\\')
                        )
                    ) {
                        return path.resolve(__dirname, 'resolver/react-native');
                    }
                    /**
                     * The `opts` argument is the options object that is passed through the Babel config.
                     * opts = {
                     *   extensions: [".js"],
                     *   resolvePath: ...,
                     * }
                     */
                    return undefined;
                },
            },
        ],
        'react-native-reanimated/plugin', // Should always be last
    ],
};
