const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const path = require('path');

// HABITS does not ship the background-geolocation native module (see
// android/gradle.properties THERR_BG_GEOLOCATION_ENABLED + react-native.config.js).
// Alias the JS import to a no-op stub so Layout.tsx stays byte-identical to general.
// Hardcoded on this niche branch — Metro/Node config files cannot resolve the
// CURRENT_BRAND_VARIATION TS import at config-load time without ts-node.
const isBackgroundGeolocationDisabled = true;
const backgroundGeolocationStubPath = path.resolve(
    __dirname,
    'main/utilities/backgroundGeolocationStub.ts',
);

// Block React packages from root node_modules to prevent version conflicts
const rootNodeModules = path.join(__dirname, '/../node_modules');
// Escape special regex characters in path
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
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
    // expo-modules-core is nested inside expo/node_modules/ (not hoisted) — point Metro to it directly
    'expo-modules-core': path.join(__dirname, 'node_modules/expo/node_modules/expo-modules-core'),
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
    transformer: {
        // Evaluate `require(...)` lazily (on first symbol access) rather than eagerly at module load.
        // Significantly reduces cold-start JS evaluation for apps with many routes.
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: true,
            },
        }),
    },
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
            if (isBackgroundGeolocationDisabled && moduleName === 'react-native-background-geolocation') {
                return {
                    type: 'sourceFile',
                    filePath: backgroundGeolocationStubPath,
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
