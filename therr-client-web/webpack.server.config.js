const fs = require('fs');
const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const nodeExternals = require('webpack-node-externals');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const parts = require('../webpack.parts');

// For externals
const pkg = require('./package.json');
const deps = require('../package.json').dependencies;

const PATHS = {
    src: path.join(__dirname, 'src'),
    clientServer: path.join(__dirname, 'src/server-client.tsx'),
    build: path.join(__dirname, 'build'),
    utils: path.join(__dirname, '../utilities'),
    reactComponents: path.join(__dirname, '../therr-public-library/therr-react'),
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
                types: path.join(__dirname, 'src/redux/types/'),
                'therr-react': path.join(__dirname, '../therr-public-library/therr-react/lib'),
                'therr-styles': path.join(__dirname, '../therr-public-library/therr-styles/lib'),
                'therr-js-utilities': path.join(__dirname, '../therr-public-library/therr-js-utilities/lib'),
            },
            fallback: {
                fs: false,
                tls: false,
                net: false,
                os: false,
                path: false,
                zlib: false,
                http: require.resolve('http-browserify'),
                https: require.resolve('https-browserify'),
                stream: false,
                crypto: false,
            },
        },
        plugins: [
            new ModuleFederationPlugin({
                shared: {
                    axios: {
                        eager: true,
                        requiredVersion: deps.axios,
                        singleton: true,
                    },
                },
            }),
        ],
        externals: [
            ...Object.keys(pkg.peerDependencies || {}),
            nodeModules,
        ],
        target: 'node',
        node: {
            __dirname: true,
            __filename: true,
        },
        optimization: {
            emitOnErrors: true,
            moduleIds: 'deterministic',
        },
    },
    parts.clean(),
    parts.loadSvg(),
    parts.processTypescript([PATHS.src], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    {
        mode: 'development',
        externals: [
            ...Object.keys(pkg.peerDependencies || {}),
            nodeExternals(),
        ],
    },
    parts.minifyJavaScript({ useSourceMap: false }),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
    },
    // parts.analyzeBundle(),
    parts.minifyJavaScript({ useSourceMap: true }),
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env.production) {
        return [buildProd()];
    }

    return [buildDev()];
};
