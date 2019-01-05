/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const DuplicatePackageCheckerPlugin = require("duplicate-package-checker-webpack-plugin");
const HappyPack = require('happypack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

// Max thread pool size for parallel tasks
const THREAD_POOL_SIZE = 4;

const happyThreadPool = HappyPack.ThreadPool({
    // Sets the thread pool to
    size: THREAD_POOL_SIZE
})

const createHappyLoader = (id, loaders, cache = true) => {
    return new HappyPack({
        id: id,
        loaders: loaders,
        threadPool: happyThreadPool,
        cache: cache
    });
}

exports.deDupe = () => ({
    plugins: [new DuplicatePackageCheckerPlugin(
        {
            // Also show module that is requiring each duplicate package (default: false)
            verbose: true,
        }
    )]
});

exports.devServer = options => ({
    devServer: {
        historyApiFallback: {
            index: `${options.urlBase}/index.html`,
        },
        hot: true,
        https: false,
        stats: 'errors-only',
        host: options.host,
        port: options.port,
        publicPath: options.publicPath,
        disableHostCheck: options.disableHostCheck,
        public: options.public || undefined,
        proxy: options.proxy || undefined
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
    ],
});

exports.processReact = (paths, withHotLoader) => ({
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                include: paths,
                use: (withHotLoader) ? ['react-hot-loader', 'babel-loader'] : ['babel-loader'],
            },
        ],
    },
});

exports.processTypescript = (paths, withHotLoader) => {
    return {
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    include: paths,
                    use: (withHotLoader) ? [
                        {
                            loader: 'happypack/loader?id=ts',
                            options: {
                                babelrc: false,
                                plugins: [
                                    createHappyLoader('ts', [{
                                        path: 'react-hot-loader/babel',
                                        query: {
                                            happyPackMode: true
                                        }
                                    }])
                                ]
                            },
                        },
                        'ts-loader'
                    ] :
                    'ts-loader',
                },
            ],
        },
    }
};

exports.lintJavaScript = ({ paths, options }) => ({
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                enforce: 'pre',
                loader: 'eslint-loader',
                include: paths,
                options,
            },
        ],
    },
});

exports.loadCSS = (paths, env) => {
    const response = {
        module: {
            rules: [
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                        env === 'development' ? 'style-loader' : MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: { importLoaders: 1 }
                        },
                        'postcss-loader',
                        'sass-loader',
                    ],
                },
            ],
        },
        plugins: [
            new MiniCssExtractPlugin({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: env === 'development' ? '[name].css' : '[name].css',
                chunkFilename: env === 'development' ? '[id].css' : '[id].css',
            })
        ],
    };

    if (paths) {
        response.module.rules[0].include = paths;
    }

    return response;
};

exports.loadSvg = paths => ({
    module: {
        rules: [
            {
                test: /\.svg$/,
                include: paths,
                oneOf: [
                    {
                        issuer: /\.scss$/,
                        use: 'svg-url-loader',
                    },
                    {
                        use: 'svg-inline-loader',
                    },
                ],
            },
        ],
    },
});

exports.clean = (path, excludesArray) => ({
    plugins: [
        new CleanWebpackPlugin([path], {
            exclude: excludesArray,
        }),
    ],
});

exports.generateSourcemaps = type => ({
    devtool: type,
});

exports.minifyCss = () => ({
    optimization: {
        minimizer: [
            new OptimizeCSSAssetsPlugin({})
        ],
    }
})

exports.minifyJavaScript = ({ useSourceMap }) => ({
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                cache: true,
                parallel: true,
                uglifyOptions: {
                    compress: {
                        warnings: false,
                    },
                    ecma: 6,
                    mangle: true
                },
                sourceMap: useSourceMap
            })
        ]
    }
});

exports.setFreeVariable = (key, value) => {
    const env = {};
    env[key] = JSON.stringify(value);
    return {
        plugins: [
            new webpack.DefinePlugin(env),
        ],
    };
}
