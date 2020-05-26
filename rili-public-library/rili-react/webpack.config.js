const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const merge = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin'); // eslint-disable-line import/no-extraneous-dependencies
const DeclarationBundlerPlugin = require('declaration-bundler-webpack-plugin');
const parts = require('../../webpack.parts');

// For externals
const localPkg = require('./package.json');
const rootPkg = require('../../package.json');

const { components, redux, services } = require('./src');

const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'build'),
    lib: path.join(__dirname, 'lib'),
    utils: path.join(__dirname, '../utilities'),
    public: '/',
};

const entry = {};
components.forEach((componentPath) => {
    const pathSplit = componentPath.split('/');
    const name = pathSplit[pathSplit.length - 1] === 'index' ? pathSplit[pathSplit.length - 2] : pathSplit[pathSplit.length - 1];
    entry[name] = `${PATHS.app}/${componentPath}.tsx`;
});
redux.forEach((reduxPath) => {
    const pathSplit = reduxPath.split('/');
    const name = pathSplit[pathSplit.length - 1] === 'index' ? pathSplit[pathSplit.length - 2] : pathSplit[pathSplit.length - 1];
    entry[name] = `${PATHS.app}/${reduxPath}.ts`;
});
services.forEach((servicePath) => {
    const pathSplit = servicePath.split('/');
    const name = pathSplit[pathSplit.length - 1] === 'index' ? pathSplit[pathSplit.length - 2] : pathSplit[pathSplit.length - 1];
    entry[name] = `${PATHS.app}/${servicePath}.ts`;
});

const common = merge([
    {
        entry,
        output: {
            path: PATHS.lib,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
            library: 'Rili Public Library: React Components',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss'],
            alias: {
                'rili-public-library/styles': path.join(__dirname, '../styles/lib'),
                'rili-public-library/utilities': path.join(__dirname, '../utilities/lib'),
            },
        },
        target: 'node',
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
                inject: false,
            }),
        ],
    },
    parts.clean(PATHS.lib),
    parts.loadSvg(),
    parts.processReact([PATHS.app, PATHS.utils], false),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
    {
        output: {
            filename: '[name].js',
            path: PATHS.lib,
        },
    },
]);

const buildDev = () => merge([
    common,
    parts.clean(PATHS.build),
    {
        mode: 'development',
        plugins: [
            new webpack.NamedModulesPlugin(),
        ],
    },
    parts.loadCSS(null, 'development'),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        plugins: [
            new webpack.HashedModuleIdsPlugin(),
        ],
        externals: [
            ...Object.keys(localPkg.peerDependencies || {}),
            ...Object.keys(rootPkg.dependencies || {}),
        ],
    },
    // parts.analyzeBundle(),
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.loadCSS(null, 'production'),
    parts.minifyJavaScript({ useSourceMap: true }),
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env === 'production') {
        return [buildProd()];
    }

    return [buildDev()];
};
