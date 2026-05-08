const liveServer = require("live-server");

const params = {
    port: 8080,
    host: "0.0.0.0",
    root: "./",
    open: true,
    logLevel: 2,
    fullReload: true,
    watch: ['./*'],
    middleware: [
        function (req, res, next) {
            res.setHeader('Permissions-Policy', 'cross-origin-isolated=(*)');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            // Add this to allow resources to be loaded under the COEP policy
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            next();
        }
    ]
};

liveServer.start(params);