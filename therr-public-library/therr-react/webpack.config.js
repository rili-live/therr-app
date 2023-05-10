const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin'); // eslint-disable-line import/no-extraneous-dependencies
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const parts = require('../../webpack.parts');

// For externals
const localPkg = require('./package.json');
const rootPkg = require('../../package.json');

const {
    components,
    constants,
    redux,
    services,
    types,
} = require('./src');

const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'build'),
    lib: path.join(__dirname, 'lib'),
    utils: path.join(__dirname, '../utilities'),
    public: '/',
};

const entry = {
    index: path.join(PATHS.app, 'index'),
};
components.forEach((filePath) => {
    const isIndexFile = filePath.includes('index');
    const name = isIndexFile ? filePath.split('/index')[0] : filePath;
    entry[name] = `${PATHS.app}/${filePath}.${isIndexFile ? 'ts' : 'tsx'}`;
});
[...redux, ...constants, ...services, ...types].forEach((filePath) => {
    const name = filePath.includes('index') ? filePath.split('/index')[0] : filePath;
    entry[name] = `${PATHS.app}/${filePath}.ts`;
});

const common = merge([
    {
        entry,
        output: {
            path: PATHS.lib,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
            library: 'Therr Public Library: React Components',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss'],
            alias: {
                'therr-styles': path.join(__dirname, '../therr-styles/lib'),
                'therr-js-utilities': path.join(__dirname, '../therr-js-utilities/lib'),
            },
            fallback: {
                fs: false,
                tls: false,
                net: false,
                os: false,
                path: false,
                zlib: false,
                http: false,
                https: false,
                stream: false,
                crypto: false,
            },
        },
        target: 'node',
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
            new ModuleFederationPlugin({
                shared: {
                    axios: {
                        eager: true,
                        requiredVersion: rootPkg.dependencies.axios,
                        singleton: true,
                    },
                },
            }),
            new HtmlWebpackPlugin({
                template: 'src/index.html',
                inject: false,
            }),
        ],
    },
    parts.clean(),
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
    parts.clean(),
    {
        mode: 'development',
        optimization: {
            moduleIds: 'named',
        },
    },
    parts.loadCSS(null, 'development'),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
        optimization: {
            emitOnErrors: true,
            moduleIds: 'deterministic',
        },
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
    console.log('Environment: ', env);

    if (env.production) {
        return [buildProd()];
    }

    return [buildDev()];
};
