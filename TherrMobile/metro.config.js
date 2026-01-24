const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const path = require('path');

const extraNodeModules = {
    shared: path.join(__dirname, '/../node_modules'),
    'therr-react': path.join(
        __dirname,
        '/../therr-public-library/therr-react/lib'
    ),
    'therr-js-utilities': path.join(
        __dirname,
        '/../therr-public-library/therr-js-utilities/lib'
    ),
    // Force shared libraries to use TherrMobile's React to prevent duplicate React copies
    react: path.join(__dirname, 'node_modules/react'),
    'react-dom': path.join(__dirname, 'node_modules/react-dom'),
    'react-native': path.join(__dirname, 'node_modules/react-native'),
    // Redux packages must also resolve locally to use the same React instance
    'react-redux': path.join(__dirname, 'node_modules/react-redux'),
    redux: path.join(__dirname, 'node_modules/redux'),
    '@reduxjs/toolkit': path.join(__dirname, 'node_modules/@reduxjs/toolkit'),
};
const watchFolders = [
    path.join(__dirname, '/../node_modules'),
    path.join(__dirname, '/../therr-public-library/therr-react/lib'),
    path.join(__dirname, '/../therr-public-library/therr-js-utilities/lib'),
];

const config = {
    resolver: {
        extraNodeModules: new Proxy(extraNodeModules, {
            get: (target, name) =>
                //redirects dependencies referenced from shared/ to local node_modules
                name in target
                    ? target[name]
                    : path.join(process.cwd(), `node_modules/${name}`),
        }),
    },
    watchFolders,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
