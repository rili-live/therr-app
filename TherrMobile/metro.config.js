/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
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

module.exports = {
    transformer: {
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: true,
            },
        }),
    },
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
