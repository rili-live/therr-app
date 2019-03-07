const fs = require('fs');
const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const merge = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const parts = require('../webpack.parts');

const pkg = require('./package.json');

const PATHS = {
    src: path.join(__dirname, 'src'),
    clientServer: path.join(__dirname, 'src/server-client.tsx'),
    build: path.join(__dirname, 'build'),
    utils: path.join(__dirname, '../utilities'),
    reactComponents: path.join(__dirname, '../rili-public-library/react-components'),
    public: '/',
};

const nodeModules = {};
fs.readdirSync('../node_modules').filter(x => ['.bin'].indexOf(x) === -1)
    .forEach((mod) => { nodeModules[mod] = `commonjs ${mod}`; });

const common = merge([
    {
        entry: {
            'server-client': path.join(PATHS.clientServer),
        },
        output: {
            path: PATHS.build,
            filename: 'server-client.js',
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
        externals: nodeModules,
        target: 'node',
        node: {
            __dirname: true,
            __filename: true,
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.loadSvg(),
    parts.processTypescript([PATHS.src], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    parts.clean(PATHS.build, ['static']),
    {
        mode: 'development',
        plugins: [
            new webpack.WatchIgnorePlugin([
                path.join(__dirname, 'node_modules'),
            ]),
            new webpack.NamedModulesPlugin(),
        ],
    },
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
        externals: [
            ...Object.keys(pkg.peerDependencies || {}),
            nodeModules,
        ],
    },
    parts.analyzeBundle(),
    parts.setFreeVariable('process.env.NODE_ENV', 'production'),
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.build, ['static']),
    {
        output: {
            filename: 'server-client.js',
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
