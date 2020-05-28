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
    reactComponents: path.join(__dirname, '../rili-public-library/rili-react'),
    public: '/',
};

const entry = {
    app: path.join(PATHS.app, 'index.tsx'),
};

// This allows us to output multiple css theme files
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
                'rili-react': path.join(__dirname, '../rili-public-library/rili-react/lib'),
                'rili-public-library/styles': path.join(__dirname, '../rili-public-library/styles/lib'),
                'rili-js-utilities': path.join(__dirname, '../rili-public-library/rili-js-utilities/lib'),
            },
        },
        plugins: [
            new webpack.NoEmitOnErrorsPlugin(),
            new webpack.HashedModuleIdsPlugin(),
        ],
        externals: Object.keys(pkg.peerDependencies || {}),
    },
    parts.clean(PATHS.build),
    parts.loadSvg(),
    parts.processReact([PATHS.app, PATHS.reactComponents, PATHS.utils], false),
    parts.processTypescript([PATHS.app], false),
    parts.generateSourcemaps('source-map'),
    parts.deDupe(),
]);

const buildDev = () => merge([
    common,
    {
        mode: 'development',
    },
    parts.loadCSS(null, 'development'),
]);

const buildProd = () => merge([
    common,
    {
        mode: 'production',
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

module.exports = (env) => {
    console.log('Frontend Environment Variables', env);
    process.env.BABEL_ENV = env.production ? 'production' : 'development';

    if (env.production) {
        return [buildProd()];
    }

    return [buildDev()];
};
