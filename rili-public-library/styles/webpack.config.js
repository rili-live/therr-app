const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const parts = require('../../webpack.parts');

const PATHS = {
    app: path.join(__dirname, 'src/index.js'),
    appSrc: path.join(__dirname, 'src'),
    lib: path.join(__dirname, 'lib'),
    public: '/',
};

const common = merge([
    {
        entry: PATHS.app,
        output: {
            path: PATHS.lib,
            filename: 'index.js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
            library: 'Rili Public Library: Styles',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss']
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.loadSvg(),
    parts.processReact([PATHS.app], false),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    parts.clean(PATHS.lib, ['svg-icons']),
    {
        mode: 'development',
        plugins: [
            new webpack.WatchIgnorePlugin([
                path.join(__dirname, 'node_modules'),
            ]),
            new webpack.NamedModulesPlugin(),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
                inject: true,
            }),
        ],
    },
    parts.loadCSS(PATHS.appSrc, 'development', true),
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
                inject: true,
            }),
        ],
    },
    parts.setFreeVariable('process.env.NODE_ENV', 'production'),
    parts.loadCSS(PATHS.appSrc, 'production', true),
    parts.minifyJavaScript({ useSourceMap: true }),
    parts.minifyCss(),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.lib, ['svg-icons']),
    {
        output: {
            filename: 'index.js',
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
