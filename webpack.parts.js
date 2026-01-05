/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const DuplicatePackageCheckerPlugin = require("duplicate-package-checker-webpack-plugin");
const HappyPack = require('happypack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

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

exports.analyzeBundle = (config = {}) => ({
    plugins: [new BundleAnalyzerPlugin(Object.assign({
        analyzerPort: 8888,
    }, config))],
});

exports.copyDir = (source, dest) => ({
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: source,
                    to: dest,
                },
            ],
        }),
    ],
});

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
    // module: {
    //     rules: [
    //         {
    //             test: /\.jsx?$/,
    //             enforce: 'pre',
    //             loader: 'eslint-loader',
    //             include: paths,
    //             options: options || {},
    //         },
    //     ],
    // },
    plugins: [new ESLintPlugin(options)],
});

exports.lintTypeScript = exports.lintJavaScript;

exports.loadCSS = (paths, env, dontHash) => {
    const miniCssExtractPlugin = new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: (env === 'development' || dontHash) ? '[name].css' : '[name].[contenthash].css',
        chunkFilename: (env === 'development' || dontHash) ? '[id].css' : '[id].[contenthash].css',
    });

    const response = {
        module: {
            rules: [
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: { importLoaders: 1 }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: {
                                    plugins: [
                                        autoprefixer(),
                                    ],
                                },
                            },
                        },
                        'sass-loader',
                    ],
                },
            ],
        },
        plugins: [
            miniCssExtractPlugin,
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
            {
                test: /\.(eot|woff|woff2|ttf)$/,
                use: ['file-loader']
            }
        ],
    },
});

exports.clean = (paths = []) => ({
    plugins: [
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: paths,
        }),
    ],
});

exports.generateSourcemaps = type => ({
    devtool: type,
});

exports.minifyCss = () => ({
    optimization: {
        minimizer: [
            new CssMinimizerPlugin({})
        ],
    }
})

exports.minifyJavaScript = ({ useSourceMap }) => ({
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            parallel: true,
            terserOptions: {
                compress: {
                    warnings: false,
                },
                ecma: 2015,
                mangle: true
            },
        })],
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
