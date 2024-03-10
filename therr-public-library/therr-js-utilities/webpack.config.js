const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const parts = require('../../webpack.parts');

// For externals
const localPkg = require('./package.json');
const rootPkg = require('../../package.json');

// List of utility filenames
const utilities = require('./src');

const PATHS = {
    app: path.join(__dirname, 'src'),
    lib: path.join(__dirname, 'lib'),
    public: '/',
};

const entry = {};
utilities.forEach((utilityPath) => {
    if (utilityPath === 'constants/index'
        || utilityPath === 'config/index'
        || utilityPath === 'db/index'
        || utilityPath === 'http/index'
        || utilityPath === 'location/index'
        || utilityPath === 'metrics/index'
        || utilityPath === 'middleware/index') {
        entry[utilityPath.split('/')[0]] = `${PATHS.app}/${utilityPath}.ts`;
    } else {
        const pathSplit = utilityPath.split('/');
        const name = pathSplit[pathSplit.length - 1];
        entry[name] = `${PATHS.app}/${utilityPath}.ts`;
    }
});

const common = merge([
    {
        entry,
        output: {
            path: PATHS.lib,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
            library: 'Therr Public Library: Utilities',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
        target: 'node',
        node: {
            __dirname: false,
        },
        optimization: {
            emitOnErrors: true,
            moduleIds: 'deterministic',
        },
        externals: [
            ...Object.keys(localPkg.peerDependencies || {}),
            ...Object.keys(rootPkg.dependencies || {}),
        ],
    },
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.clean(),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    {
        mode: 'development',
    },
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
    },
    // parts.analyzeBundle(),
    parts.minifyJavaScript({ useSourceMap: false }),
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env.production) {
        return [buildProd()];
    }

    return [buildDev()];
};
