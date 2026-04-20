const path = require('path');

module.exports = {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
        // React Compiler (annotation mode): only memoizes function components/hooks that
        // begin their body with a "use memo" directive. Must run before other transforms;
        // react-native-worklets/plugin stays last.
        ['babel-plugin-react-compiler', { compilationMode: 'annotation', target: '19' }],
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
                resolvePath(sourcePath, currentFile) {
                    // Redirect react-native imports to our resolver that provides deprecated prop types
                    if (
                        sourcePath === 'react-native' &&
                        !currentFile.includes('node_modules/react-native/') &&
                        !currentFile.includes('node_modules\\react-native\\') &&
                        !currentFile.includes('resolver/react-native/') &&
                        !currentFile.includes('resolver\\react-native\\')
                    ) {
                        return path.resolve(__dirname, 'resolver/react-native');
                    }
                    return undefined;
                },
            },
        ],
        'react-native-paper/babel',
        // Strip console.* calls in production bundles (keep error/warn for Crashlytics/LogRocket).
        // Runs only on production builds so dev logs are preserved.
        ...(process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production'
            ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
            : []),
        'react-native-worklets/plugin', // Should always be last (Reanimated 4 + worklets package)
    ],
};
