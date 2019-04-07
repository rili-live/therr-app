const fs = require('fs');
const path = require('path');
const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const merge = require('webpack-merge'); // eslint-disable-line import/no-extraneous-dependencies
const parts = require('../webpack.parts');

// For externals
const pkg = require('./package.json');

const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'build/static'),
    themes: path.join(__dirname, 'src/styles/themes'),
    utils: path.join(__dirname, '../utilities'),
    reactComponents: path.join(__dirname, '../rili-public-library/react-components'),
    public: '/',
};

const entry = {
    app: path.join(PATHS.app, 'index.tsx'),
};

fs.readdirSync(PATHS.themes).forEach((pathName) => {
    entry[`theme-${pathName}`] = `${PATHS.themes}/${pathName}/index.ts`;
});

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
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss', '.css'],
            alias: {
                actions: path.join(__dirname, 'src/redux/actions/'),
                enums: path.join(__dirname, 'src/constants/enums/'),
                types: path.join(__dirname, 'src/redux/types/'),
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
            // new HtmlWebpackPlugin({
            //     template: 'src/index.html',
            //     inject: false,
            // }),
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
    },
    // parts.analyzeBundle(),
    parts.lintJavaScript({
        paths: PATHS.app,
        options: {
            emitWarning: true,
        },
    }),
    parts.loadCSS(null, 'production'),
    parts.minifyJavaScript({ useSourceMap: false }),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.build),
    {
        output: {
            filename: '[name].js',
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
