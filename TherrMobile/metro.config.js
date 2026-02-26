const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const path = require('path');

// Block React packages from root node_modules to prevent version conflicts
const rootNodeModules = path.join(__dirname, '/../node_modules');
// Escape special regex characters in path
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const escapedRoot = escapeRegex(rootNodeModules);
const blockList = [
    new RegExp(`${escapedRoot}[\\/]react[\\/].*`),
    new RegExp(`${escapedRoot}[\\/]react-dom[\\/].*`),
    new RegExp(`${escapedRoot}[\\/]react-native[\\/].*`),
    new RegExp(`${escapedRoot}[\\/]react-redux[\\/].*`),
    new RegExp(`${escapedRoot}[\\/]redux[\\/].*`),
    new RegExp(`${escapedRoot}[\\/]@reduxjs[\\/]toolkit[\\/].*`),
];

const extraNodeModules = {
    shared: rootNodeModules,
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
    axios: path.join(rootNodeModules, 'axios'),
};
const watchFolders = [
    rootNodeModules,
    path.join(__dirname, '/../therr-public-library/therr-react/lib'),
    path.join(__dirname, '/../therr-public-library/therr-js-utilities/lib'),
];

// Force all axios imports (CJS require + ESM import) to a single file.
// axios package.json "exports" maps require→dist/browser/axios.cjs and
// default→dist/esm/axios.js, creating two singletons in the Metro bundle.
const axiosCjsPath = path.resolve(rootNodeModules, 'axios/dist/browser/axios.cjs');

// Force all use-latest-callback imports to the root v0.2.6 copy.
// react-native-tab-view nests v0.1.11 which has incompatible CJS/ESM exports,
// causing "useLatestCallback.default is not a function" at runtime.
const useLatestCallbackPath = path.resolve(__dirname, 'node_modules/use-latest-callback/lib/src/index.js');

const config = {
    resolver: {
        blockList,
        resolveRequest: (context, moduleName, platform) => {
            if (moduleName === 'axios') {
                return {
                    type: 'sourceFile',
                    filePath: axiosCjsPath,
                };
            }
            if (moduleName === 'use-latest-callback') {
                return {
                    type: 'sourceFile',
                    filePath: useLatestCallbackPath,
                };
            }
            return context.resolveRequest(context, moduleName, platform);
        },
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
