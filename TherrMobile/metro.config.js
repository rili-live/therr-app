const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
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
