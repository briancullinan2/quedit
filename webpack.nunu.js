const Path = require("path");
const { merge } = require("webpack-merge");
const Webpack = require("webpack");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");

// Resolve the paths to the nunuStudio submodule
const nunuPath = Path.resolve(__dirname, "../nunuStudio");
const common = require(Path.resolve(nunuPath, "webpack.config.js"));

const git = new GitRevisionPlugin({
	gitWorkTree: nunuPath
});

// Explicitly target your components folder inside the main project
const output = Path.resolve(__dirname, "./components/map-editor");

module.exports = [
	merge(common[0], {
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
				"VERSION": JSON.stringify(require(Path.resolve(nunuPath, "package.json")).version),
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
			library: "Nunu"
		}
	}),
	// Keep the second config object intact so the build matches what nunu expects
	common[1]
];
