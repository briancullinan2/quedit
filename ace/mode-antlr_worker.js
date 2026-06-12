



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
ace.define("ace/mode/antlr_worker", [
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
ace.define("ace/mode/antlr_worker", [
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
        this.setLanguageTarget = function (fileId) {
            if (this.$worker) {
                this.$worker.postMessage({
                    command: "setLanguageContext",
                    args: [fileId]
                });
            }
        };

        // Inject your custom runtime dependencies byte-wise!
        if (this.$worker) {
            this.$worker.postMessage({
                command: "importScripts",
                args: [
                    baseOrigin + '/components/core/preambles.js',
                    baseOrigin + '/components/rosetta/rosetta.js',
                    baseOrigin + '/components/rosetta/parsers.js',
                    baseOrigin + "/ace/worker-base.js",
                    baseOrigin + '/components/rosetta/antlr-languages.bundle.js',
                    baseOrigin + "/components/rosetta/worker-language.js"
                ]
            });
        }

        this.attachToDocument(session);
        var _this2 = this;

        this.on("highlight", function (response) {
            if (typeof handleWorkerStreamHighlight === 'function') {
                handleWorkerStreamHighlight(session, response.data);
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
        this.on("foldRegionsCalculated", function (response) {
            if (typeof handleWorkerFoldRegions === 'function') {
                handleWorkerFoldRegions(session, response.data);
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

            // Instantiate your custom pre-seeded worker wrapper safely!
            var worker = new AntlrWorker(session);

            // Seed target environment variables down the pipe
            worker.setLanguageTarget(fileId);

            return worker;
        };

        this.$id = "ace/mode/antlr";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});



/**
 * Core Gutter Plugin: Man-in-the-middle handler that overrides Ace's 
 * internal template string generators to force VS Code style chevrons.
 */
function handleWorkerFoldRegions(session, data) {
    const blocks = data.blocks || [];
    session.antlrDiscoveredFoldBlocks = blocks;

    const renderer = aceEditor.renderer;
    if (!renderer || !renderer.$gutterLayer) return;

    // ─── 1. FORCE THE IN-MEMORY ARRAY SYSTEM TO SHIFT STATES ───
    session.foldWidgets = [];
    for (let i = 0; i < session.getLength(); i++) {
        const humanRow = i + 1;
        const hasBlockStart = blocks.some(b => b.startLine === humanRow);
        session.foldWidgets[i] = hasBlockStart ? "start" : "";
    }

    // ─── 2. PLUG NATIVE RANGE OVERRIDES FOR CLICK INTERACTIONS ───
    session.getFoldWidget = function (row) {
        return session.foldWidgets[row] || "";
    };

    session.getFoldWidgetRange = function (row) {
        const humanRow = row + 1;
        const aceRange = ace.require("ace/range").Range;

        // Specificity sort: prioritize the narrowest nested inner rule on multi-block lines
        const targetBlock = (session.antlrDiscoveredFoldBlocks || [])
            .filter(b => b.startLine === humanRow)
            .sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine))[0];

        if (targetBlock) {
            const lineText = session.getLine(row);
            const startColumn = lineText.search(/\S/) !== -1 ? lineText.search(/\S/) : 0;
            return new aceRange(row, startColumn, targetBlock.endLine - 1, session.getLine(targetBlock.endLine - 1).length);
        }
        return null;
    };

    // ─── 3. OVERRIDE THE PHYSICAL HTML STRING GENERATOR ───
    // This intercepts Ace's internal cell compiler right before strings append to the DOM layer!

    return
    if (!renderer.$gutterLayer.originalUpdateCellHtml) {
        renderer.$gutterLayer.originalUpdateCellHtml = renderer.$gutterLayer.update;

        renderer.$gutterLayer.update = function (config) {
            // Run the standard core gutter row generator loop array
            this.originalUpdateCellHtml(config);

            // Instantly grab the freshly drawn cells out of the virtual layer layout container
            const cells = this.element.children;
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const rowText = cell.textContent.replace(/[^\d]/g, '');
                const rowIdx = parseInt(rowText, 10) - 1;

                if (isNaN(rowIdx)) continue;

                const humanRow = rowIdx + 1;
                const hasBlockStart = (session.antlrDiscoveredFoldBlocks || []).some(b => b.startLine === humanRow);

                // Fetch the inner placeholder span node container
                let span = cell.querySelector("span");
                if (span) {
                    if (hasBlockStart) {
                        const isFolded = session.isRowFolded(rowIdx);
                        // Inject the exact multi-class structure Ace requires to trigger mouse events
                        span.className = `ace_fold-widget ace_start ${isFolded ? "ace_closed" : "ace_open"}`;
                        span.style.display = "inline-block";
                        span.style.visibility = "visible";
                    } else {
                        span.className = "";
                        span.style.display = "none";
                    }
                }
            }
        };
    }

    // ─── 4. FLUSH BUFFER AND RERENDER FULL MESH ───
    renderer.$gutterLayer.config = null;
    session._emit("changeFoldWidget");
    aceEditor.renderer.updateFull(true);
}