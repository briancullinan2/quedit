
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
	mode: 'production',
	entry: [
		'./components/bundle/lumino.ts',
		'./components/bundle/lumino-files.ts'
	], // Aligned with your actual entry location
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
		noParse: [/[\\/]node_modules[\\/]@babel[\\/]standalone[\\/]/],
		rules: [
			{
				test: /rosetta\/binary\.js$/,
				type: 'javascript/auto', // Resets the module type configuration
				parser: {
					sourceType: 'module' // Explicitly forces webpack to permit import/export
				}
			},
			{
				// require.resolve returns the exact absolute path to the node_modules entrypoint
				test: require.resolve('diff'),
				use: [
					{
						loader: 'expose-loader',
						options: {
							// This registers it directly on window.diff and globalThis.diff
							exposes: ['diff'],
						},
					},
				],
			},
			{
				test: path.resolve(__dirname, './components/bundle/lumino-files.ts'),
				use: [
					{
						loader: 'expose-loader',
						options: {
							exposes: ['FileManager'],
						},
					},
				],
			},
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
		new webpack.ProvidePlugin({
			diff: 'diff',
		}),
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
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				exclude: /babel\.min\.js$/,
				parallel: true,
				terserOptions: {
					// Prevents name mangling stripping
					mangle: {
						keep_fnames: true,
						keep_classnames: true, // Optional: keeps class names intact too
					},
					// Prevents optimization passes from discarding or renaming structures
					compress: {
						keep_fnames: true,
						keep_classnames: true,
					}
				},
			}),
		],
	},
};
