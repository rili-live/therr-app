const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const merge = require('webpack-merge');
const parts = require('../webpack.parts');

// List of utility filenames
const servers = require('./src');

const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'build'),
    public: '/',
};

const entry = {};
servers.forEach((server) => {
    entry[server] = `${PATHS.app}/${server}.ts`;
});

const nodeModules = {};
fs.readdirSync('node_modules').filter(x => ['.bin'].indexOf(x) === -1)
    .forEach((mod) => { nodeModules[mod] = `commonjs ${mod}`; });


const common = merge([
    {
        entry,
        output: {
            path: PATHS.build,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
        externals: nodeModules,
        target: 'node',
        node: {
            __dirname: false,
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    {
        mode: 'development',
    },
    parts.setFreeVariable('process.env.NODE_ENV', 'development'),
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        plugins: [
            new webpack.HashedModuleIdsPlugin(),
        ],
    },
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.setFreeVariable('process.env.NODE_ENV', 'production'),
    parts.minifyJavaScript({ useSourceMap: false }),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.build, ['static']),
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env === 'production') {
        return [buildUmd()];
    }

    return [buildDev()];
};
