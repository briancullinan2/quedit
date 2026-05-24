
/*
function AntlrWorker(_this2, session, WorkerClient) {
    var baseOrigin = window.location.origin;
    var targetUrl = baseOrigin + "/ace/worker-antlr.js";

    session.activeMarkerIds = [];

    // 1. Invoke the parent constructor to set up the default Ace messaging layers
    WorkerClient.call(_this2, ["ace"], "ace/mode/antlr_worker_actions", "AntlrWorker", targetUrl);

    var aceBasePath = ace.config.get("basePath") || (baseOrigin + "/ace/");
    if (aceBasePath.slice(-1) !== "/") {
        aceBasePath += "/";
    }

    // 2. THE CHANNELS FIX: Safely resolve the true worker reference from either the sender proxy or the core instance
    var realWorkerThread = _this2.$worker || (_this2.sender && _this2.sender.$worker);

    if (realWorkerThread) {
        console.log("[AntlrWorker] Native thread captured. Injecting sovereign runtime bundle arrays...");
        realWorkerThread.postMessage({
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
    } else {
        console.warn("[AntlrWorker] Direct worker thread hook not populated yet. Falling back to deferred script execution proxy.");
        // Fallback: Use the standard worker client sender mechanism to queue the imports
        this.sender.postMessage("importScripts", [
            baseOrigin + '/preambles.js',
            baseOrigin + '/rosetta.js',
            baseOrigin + '/parsers.js',
            aceBasePath + "worker-base.js",
            baseOrigin + '/antlr-languages.bundle.js',
            baseOrigin + "/worker-language.js"
        ]);
    }

    this.attachToSession(session);
}

// Global prototype registration method
AntlrWorker.prototype.setLanguageTarget = setLanguageTarget;
*/

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
        session._emit("tokenizerUpdate", { first: 0, last: totalLines - 1 });
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




/*
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

    createWorker

    // Export a wrapper that feeds WorkerClient back into your constructor
    exports.AntlrWorker = function (session) {
        return new AntlrWorker(session, WorkerClient);
    };

});

*/
define("ace/mode/antlr_worker", [
    "require",
    "exports",
    "module",
    "ace/lib/oop",
    "ace/mode/text",
    "ace/worker/worker_client",
    "ace/mode/text_highlight_rules"
], function (require, exports, module) {
    "use strict";

    var oop = require("ace/lib/oop");
    var TextMode = require("ace/mode/text").Mode;
    var WorkerClient = require("ace/worker/worker_client").WorkerClient;
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    // ─── 1. YOUR CUSTOM ARCHITECTURE CONSTRUCTOR ───
    function AntlrWorker(session) {
        var baseOrigin = window.location.origin;
        var targetUrl = baseOrigin + "/ace/worker-antlr.js";

        session.activeMarkerIds = [];

        // Cleanly invoke the passed-in parent constructor natively
        WorkerClient.call(this, ["ace"], "ace/mode/antlr_worker_actions", "AntlrWorker", targetUrl);

        var aceBasePath = ace.config.get("basePath") || (baseOrigin + "/ace/");
        if (aceBasePath.slice(-1) !== "/") {
            aceBasePath += "/";
        }

        // Global prototype registration method
        this.setLanguageTarget = function (langKey, fileId) {
            if (this.$worker) {
                this.$worker.postMessage({
                    command: "setLanguageContext",
                    args: [langKey, fileId]
                });
            }
        };

        // Inject your custom runtime dependencies byte-wise!
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
        var _this2 = this;

        this.on("highlight", function (response) {
            if (typeof handleWorkerHighlight === 'function') {
                handleWorkerHighlight(session, response);
            }
        });
        this.on("blockRange", function (response) {
            if (typeof handleWorkerBlockHighlight === 'function') {
                handleWorkerBlockHighlight(session, response.data);
            }
        });
        this.on("annotate", function (response) {
            session.setAnnotations(response.data);
            if (typeof handleWorkerAnnotate === 'function') {
                handleWorkerAnnotate(session, response);
            }
        });

        this.on("terminate", function (response) {
            session.clearAnnotations();
            if (typeof clear === 'function') clear(session);
            _this2.onWorkerTerminate ? _this2.onWorkerTerminate(session) : null;
        });
    }

    // Inherit proto methods cleanly inside the loader space right next to the constructor
    oop.inherits(AntlrWorker, WorkerClient);

    // ─── 2. THE MODE CONTAINER SPECIFICATION ───
    var Mode = function () {
        this.HighlightRules = TextHighlightRules;
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.createWorker = function (session) {
            if (!session) return null;

            var modeId = (session.getMode() && session.getMode().$id) || session.$modeId || "";
            var languageKey = modeId.split("/").pop() || "c";
            languageKey = languageKey.toLowerCase();

            var fileId = session.workspaceFileId ||
                (session.getDocument() && session.getDocument().$fileId) ||
                "temp_buffer." + languageKey;

            session.workspaceFileId = fileId;

            var ext = "c";
            if (fileId && fileId.includes('.')) {
                ext = fileId.split('.').pop().toLowerCase();
            } else {
                ext = languageKey;
            }

            var supportedLanguages = [
                "c", "cpp", "angelscript", "lua", "wat", "asm",
                "quakemap", "javascript", "typescript", "html", "css3", "json"
            ];

            if (!supportedLanguages.includes(languageKey) && !supportedLanguages.includes(ext)) {
                console.log("[Ace Mode] Context '" + languageKey + "' (" + ext + ") bypasses ANTLR worker optimization.");
                return null;
            }

            var targetLangKey = supportedLanguages.includes(ext) ? ext : languageKey;

            // Instantiate your custom pre-seeded worker wrapper safely!
            var worker = new AntlrWorker(session);

            // Seed target environment variables down the pipe
            worker.setLanguageTarget(targetLangKey, fileId);

            return worker;
        };

        this.$id = "ace/mode/antlr";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});