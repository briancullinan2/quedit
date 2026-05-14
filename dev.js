const liveServer = require("live-server");

function middleware(req, res, next) {
    // Essential for CORS in Workers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    // Essential for SharedArrayBuffer / Cross-Origin Isolation
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // This tells the browser it's okay to load this resource 
    // even when the requesting page has a COEP policy
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    res.setHeader('Permissions-Policy', 'cross-origin-isolated=(*)');

    // Handle preflight OPTIONS requests immediately
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    next();
}


const params = {
    port: 8080,
    host: "localhost",
    root: "./",
    open: true,
    logLevel: 2,
    fullReload: true,
    watch: ['./*'],
    middleware: [middleware]
};

liveServer.start(params);