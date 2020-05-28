/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const path = require('path');

const extraNodeModules = {
    shared: path.join(__dirname, '/../node_modules'),
    'rili-react': path.join(
        __dirname,
        '/../rili-public-library/rili-react/lib'
    ),
    'rili-utilities': path.join(
        __dirname,
        '/../rili-public-library/rili-js-utilities/lib'
    ),
};
const watchFolders = [
    path.join(__dirname, '/../node_modules'),
    path.join(__dirname, '/../rili-public-library/rili-react/lib'),
    path.join(__dirname, '/../rili-public-library/rili-js-utilities/lib'),
];

module.exports = {
    transformer: {
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: false,
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
