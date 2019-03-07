const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const merge = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin'); // eslint-disable-line import/no-extraneous-dependencies
const parts = require('../webpack.parts');

// For externals
const pkg = require('./package.json');

const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'build/static'),
    utils: path.join(__dirname, '../utilities'),
    reactComponents: path.join(__dirname, '../rili-public-library/react-components'),
    public: '/',
};

const common = merge([
    {
        entry: {
            app: path.join(PATHS.app, 'index.tsx'),
        },
        output: {
            path: PATHS.build,
            filename: 'app.js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss', '.css'],
            alias: {
                actions: path.join(__dirname, 'src/redux/actions/'),
                enums: path.join(__dirname, 'src/constants/enums/'),
                'rili-public-library/react-components': path.join(__dirname, '../rili-public-library/react-components/lib'),
                'rili-public-library/styles': path.join(__dirname, '../rili-public-library/styles/lib'),
                'rili-public-library/utilities': path.join(__dirname, '../rili-public-library/utilities/lib'),
            },
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.loadSvg(),
    parts.processReact([PATHS.app, PATHS.reactComponents, PATHS.utils], false),
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
        port: process.env.PORT || 7070,
        publicPath: PATHS.public,
    }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        plugins: [
            new webpack.HashedModuleIdsPlugin(),
        ],
    },
    parts.analyzeBundle(),
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
    parts.clean(PATHS.build),
    {
        output: {
            filename: 'app.js',
        },
        externals: Object.keys(pkg.peerDependencies || {}),
    },
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env === 'production') {
        return [buildUmd()];
    }

    return [buildDev()];
};
