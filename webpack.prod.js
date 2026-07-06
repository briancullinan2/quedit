
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './components/bundle/lumino.ts', // Aligned with your actual entry location
    target: 'web',
    output: {
        filename: 'app.bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    stats: 'verbose', // Generates comprehensive build stream analytics
    stats: {
        errorDetails: true, // Forces display of exact file resolution traces
        colors: true,
        modules: true,
        reasons: true
    },
    resolve: {
        extensions: ['.ts', '.js', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'node_modules/@babel/standalone/babel.min.js'),
                    to: path.resolve(__dirname, 'dist/babel.min.js'),
                },
            ],
        }),
    ],
    performance: {
        hints: false,
    },
};