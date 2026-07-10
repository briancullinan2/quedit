const Path = require("path");
const { merge } = require("webpack-merge");
const Webpack = require("webpack");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");

// Resolve the paths to the miniPaint submodule
const paintPath = Path.resolve(__dirname, "../miniPaint");
const paintConfig = require(Path.resolve(paintPath, "webpack.config.js"));

const git = new GitRevisionPlugin({
	gitWorkTree: paintPath
});

// Explicitly target your components folder inside the main project
const output = Path.resolve(__dirname, "./components/paint");

module.exports = [
	merge(paintConfig, {
		devtool: false,
		mode: "production",
		optimization: {
			minimize: true,
			sideEffects: "flag",
			moduleIds: "named",
			concatenateModules: false
		},
		performance: {
			hints: false,
		},
		plugins: [
			new Webpack.NormalModuleReplacementPlugin(
				/Global\.js$/,
				Path.resolve(output, "Global.js")
			),
			new Webpack.DefinePlugin({
				"VERSION": JSON.stringify(require(Path.resolve(paintPath, "package.json")).version),
				"TIMESTAMP": JSON.stringify(new Date().toISOString()),
				"REPOSITORY_BRANCH": JSON.stringify(git.branch()),
				"REPOSITORY_COMMIT": JSON.stringify(git.commithash()),
				"DEVELOPMENT": JSON.stringify(false)
			})
		],
		output: {
			hashFunction: "sha256",
			filename: "bundle.js",
			path: output,
			libraryTarget: "umd",
			library: "Paint"
		}
	}),
];
