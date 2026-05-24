

function AntlrWorker(session, WorkerClient) {
    var baseOrigin = window.location.origin;
    var targetUrl = baseOrigin + "/ace/worker-antlr.js";

    session.activeMarkerIds = [];

    // Cleanly invoke the passed-in parent constructor
    WorkerClient.call(this, ["ace"], "ace/mode/antlr_worker_actions", "AntlrWorker", targetUrl);

    var aceBasePath = ace.config.get("basePath") || (baseOrigin + "/ace/");
    if (aceBasePath.slice(-1) !== "/") {
        aceBasePath += "/";
    }

    
    // Global prototype registration method
    this.setLanguageTarget = setLanguageTarget.bind(this, this.$worker);

    if (this.$worker) {
        this.$worker.postMessage({
            command: "importScripts",
            args: [
                baseOrigin + '/preambles.js',
                baseOrigin + '/rosetta.js',
                baseOrigin + '/parsers.js',
                aceBasePath + "worker-base.js",
                baseOrigin + '/antlr-languages.bundle.js',
                baseOrigin + "/worker-language.js"
            ]
        });
    }

    this.attachToDocument(session);
    let _this2 = this

    this.on("highlight", function (response) {
        handleWorkerHighlight(session, response);
    });

    this.on("annotate", function (response) {
        handleWorkerAnnotate(session, response);
    });
    this.on("terminate", function (response) {
        clear(asession);
        _this2.onWorkerTerminate(session)
    });


}

// Global prototype registration method
AntlrWorker.prototype.setLanguageTarget = setLanguageTarget;


function bridgeApplyCustomWorkerHighlights(tokenLines) {
    if (!this.activeEditor || !tokenLines) return;

    let session = this.activeEditor.getSession();
    session.bgTokenizer.lines = tokenLines;
    session.bgTokenizer.fireUpdateEvent(0, tokenLines.length - 1);
}

function onBridgeHighlight(response) {
    const session = this.docSession; // Ensure you have a reference to the active session
    const { totalLines, antlrTokensByLine } = response.data;

    // 1. Tell Ace's background tokenizer to stop fighting your data
    if (session.bgTokenizer) {
        // Clear Ace's default internal cache lines
        session.bgTokenizer.lines = session.bgTokenizer.lines || [];

        // 2. Overwrite Ace's token cache arrays with your precise ANTLR tokens
        for (let row = 0; row < totalLines; row++) {
            if (antlrTokensByLine[row]) {
                // Format expected by Ace: [{ type: "keyword.antlr", value: "void" }, ...]
                session.bgTokenizer.lines[row] = antlrTokensByLine[row];
            }
        }

        // 3. Force Ace to redraw the viewport using your newly injected arrays
        session._emit("tokenizerUpdate", { firstRow: 0, lastRow: totalLines - 1 });
    }
}

/**
 * High-Fidelity Client-Side Token Interception and Semantic Enrichment
 */
function onWorkerHighlight(e) {
    // 1. THE CANCELLATION GATE (Prevents UI repaint thrashing during panel swaps)
    if (window.currentActiveLayoutMode === 'navigation-override' || window.preventHighlightPaint) {
        return;
    }

    var compilerDiagnostics = ace.require("ace/ext/compiler_diagnostics");
    if (compilerDiagnostics && compilerDiagnostics.getBridge) {
        var bridge = compilerDiagnostics.getBridge();

        // 2. SEMANTIC TRANSFORMATION PASS
        const enrichedTokenLines = e.data.tokenLines.map(function (rowTokens) {
            if (!rowTokens) return rowTokens;

            return rowTokens.map(function (token) {
                // Feature A: Check for custom spelling markers inside comments
                if (token.type === 'comment' && token.value.includes('TODO')) {
                    token.type += " spelling-error task-marker";
                }

                // Feature B: Enrich matching compiled interactive Quake 3 definitions
                if (token.type === 'entity.name.function' && window.clickableSymbolsMap?.[token.value]) {
                    token.type += " clickable-engine-symbol";
                }

                return token;
            });
        });

        // 3. Inject the finalized token map directly into Ace's background tokenizer cache
        bridge.applyCustomWorkerHighlights(enrichedTokenLines);
    }
}

function onWorkerAnnotate(session, e) {
    var compilerDiagnostics = ace.require("ace/ext/compiler_diagnostics");
    if (compilerDiagnostics && compilerDiagnostics.getBridge) {
        var bridge = compilerDiagnostics.getBridge();
        bridge.setWorkerAnnotations(e.data);
    } else {
        session.setAnnotations(e.data);
    }
}

/**
 * Cleanup handler when a workspace edit session is dismantled
 */
function onWorkerTerminate(_this2, session) {
    session.clearAnnotations();
    for (var m = 0; m < _this2.activeMarkerIds.length; m++) {
        session.removeMarker(_this2.activeMarkerIds[m]);
    }
    _this2.activeMarkerIds = [];
}

/**
 * Explicit setter proxy forwarding environment states downstream to the background thread
 */
function setLanguageTarget(_worker, langKey, fileId) {
    if (_worker) {
        _worker.postMessage({
            command: "setLanguageContext",
            args: [langKey, fileId]
        });
    }
}





define("ace/mode/antlr_worker", [
    "require",
    "exports",
    "module",
    "ace/worker/worker_client",
    "ace/lib/oop"
], function (require, exports, module) {
    "use strict";

    var WorkerClient = require("ace/worker/worker_client").WorkerClient;
    var oop = require("ace/lib/oop");

    // Inherit proto methods cleanly inside the loader space
    oop.inherits(AntlrWorker, WorkerClient);

    // Export a wrapper that feeds WorkerClient back into your constructor
    exports.AntlrWorker = function (session) {
        return new AntlrWorker(session, WorkerClient);
    };
});
