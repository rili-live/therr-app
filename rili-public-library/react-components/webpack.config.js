const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const parts = require('../../webpack.parts');

// List of utility filenames
const components = require('./src');

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
    const name = pathSplit[pathSplit.length - 1];
    entry[name] = `${PATHS.app}/components/${componentPath}.tsx`;
});

const common = merge([
    {
        entry,
        output: {
            path: PATHS.build,
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
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.loadSvg(),
    parts.processReact([PATHS.app, PATHS.utils], false),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    parts.clean(PATHS.build),
    {
        mode: 'development',
        plugins: [
            new webpack.WatchIgnorePlugin([
                path.join(__dirname, 'node_modules'),
            ]),
            new webpack.NamedModulesPlugin(),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
                inject: false,
            }),
        ],
    },
    parts.loadCSS(null, 'development'),
    parts.devServer({
        disableHostCheck: true,
        host: process.env.HOST || 'localhost',
        port: process.env.PORT || 7700,
        publicPath: PATHS.public,
    }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        plugins: [
            new webpack.HashedModuleIdsPlugin(),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
                inject: false,
            }),
        ],
    },
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.setFreeVariable('process.env.NODE_ENV', 'production'),
    parts.loadCSS(null, 'production'),
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.lib),
    {
        output: {
            filename: '[name].js',
            path: PATHS.lib,
        },
    },
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env === 'production') {
        return [buildUmd()];
    }

    return [buildDev()];
};
