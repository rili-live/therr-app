const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const parts = require('../../webpack.parts');

// List of utility filenames
const utilities = require('./src');

const PATHS = {
    app: path.join(__dirname, 'src'),
    lib: path.join(__dirname, 'lib'),
    public: '/',
};

const entry = {};
utilities.forEach((utility) => {
    entry[utility] = `${PATHS.app}/${utility}.ts`;
});

const common = merge([
    {
        entry,
        output: {
            path: PATHS.lib,
            filename: '[name].js',
            publicPath: PATHS.public,
            libraryTarget: 'umd',
            library: 'Rili Public Library: Utilities',
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
        ],
    },
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

// TODO: Add a dev build?

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
    parts.minifyJavaScript({ useSourceMap: true }),
]);

const buildUmd = () => merge([
    buildProd(),
    parts.clean(PATHS.lib),
    {
        output: {
            filename: '[name].js',
        },
    },
]);

module.exports = (env) => {
    process.env.BABEL_ENV = env;

    if (env === 'production') {
        return [buildUmd()];
    }

    return [buildUmd()];
};
