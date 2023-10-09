const fs = require('fs');
const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const nodeExternals = require('webpack-node-externals');
const parts = require('../webpack.parts');

const pkg = require('./package.json');

const PATHS = {
    app: path.join(__dirname, 'src'),
    assets: path.join(__dirname, 'src/_static'),
    build: path.join(__dirname, 'build'),
    public: '/',
};

const nodeModules = {};
fs.readdirSync('../node_modules').filter((x) => ['.bin'].indexOf(x) === -1)
    .forEach((mod) => { nodeModules[mod] = `commonjs ${mod}`; });

const common = merge([
    {
        entry: {
            server: `${PATHS.app}/index.ts`,
        },
        output: {
            path: PATHS.build,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
            alias: {
                'therr-js-utilities': path.join(__dirname, '../therr-public-library/therr-js-utilities/lib'),
            },
        },
        externals: [
            ...Object.keys(pkg.peerDependencies || {}),
            nodeModules,
        ],
        target: 'node',
        node: {
            __dirname: false,
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.clean(),
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
    parts.copyDir(PATHS.assets, `${PATHS.build}/static`), // Copies static assets
]);

const buildDev = () => merge([
    common,
    {
        entry: {
            server: `${PATHS.app}/index.ts`,
            main: 'webpack/hot/poll?100',
        },
        mode: 'development',
        externals: [
            ...Object.keys(pkg.peerDependencies || {}),
            nodeExternals({
                allowlist: ['webpack/hot/poll?100'],
            }),
        ],
        plugins: [
            new webpack.HotModuleReplacementPlugin(),
        ],
    },
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        optimization: {
            moduleIds: 'deterministic',
        },
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
