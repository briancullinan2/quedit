// worker-antlr.js
let antlrProcessor = null;

// 1. TOP-LEVEL CLASS DECLARATION (No complex nesting or factories)
function AntlrWorkerBackend(sender) {
    // Dynamically retrieve Mirror from the loaded worker-base scope
    const Mirror = ace.require("ace/worker/mirror").Mirror;
    Mirror.call(this, sender);

    this.setTimeout(200); // Debounce runtime execution (ms)
    this.languageKey = "c";
    this.activeFileId = "";
}

// Complete the prototype inheritance flatly
function setupInheritance() {
    const Mirror = ace.require("ace/worker/mirror").Mirror;
    const oop = ace.require("ace/lib/oop");
    oop.inherits(AntlrWorkerBackend, Mirror);

    // Assign clean, top-level prototype methods directly
    AntlrWorkerBackend.prototype.setLanguageContext = function (langKey, fileId) {
        this.languageKey = langKey;
        this.activeFileId = fileId;
        this.deferredUpdate.schedule(); // Native trigger to fire onUpdate()
    };

    AntlrWorkerBackend.prototype.onUpdate = function () {
        const fullText = this.doc.getValue();
        const lines = fullText.split('\n'); // Split text to extract code context lines
        let annotations = [];

        try {
            // Live data transfer directly to your real ANTLR setup, checking errors inline
            const tokens = TokenVisitor.getAllTokens(fullText, this.languageKey, function (syntaxError) {
                const zeroIndexedRow = syntaxError.line - 1;
                const activeLineText = lines[zeroIndexedRow] || "";
                const cleanLine = activeLineText.replace(/\t/g, '    '); // Flatten tabs for layout alignment

                // Build a classic visual compiler caret:      ^~~~~
                const leadingSpaces = ' '.repeat(Math.max(0, syntaxError.column));
                const caretMarker = `${leadingSpaces}^~~~~`;

                // Combine into a multi-line diagnostic snippet string
                const clangDiagnosticText = [
                    `stdin.c:${syntaxError.line}:${syntaxError.column + 1}: error: ${syntaxError.message}`,
                    cleanLine.trimEnd(),
                    caretMarker
                ].join('\n');

                annotations.push({
                    row: zeroIndexedRow,
                    column: syntaxError.column,
                    text: clangDiagnosticText,
                    type: "error" // Red error badge inside Ace gutter
                });
            });

            // Process structural flags (Comments / Tasks / Custom Preprocessor Channels)
            tokens.forEach(function (token) {
                if (token.textType === 'comment' && token.text.toLowerCase().includes('todo')) {
                    annotations.push({
                        row: token.line - 1,
                        column: token.column,
                        text: "Unresolved task: " + token.text.trim(),
                        type: "info" // Blue info badge
                    });
                }
                if (token.channel > 1) {
                    annotations.push({
                        row: token.line - 1,
                        column: token.column,
                        text: "Isolated preprocessor block [" + token.type + "]",
                        type: "warning" // Yellow warning badge
                    });
                }
            });

        } catch (lexerError) {
            annotations.push({
                row: 0,
                column: 0,
                text: "ANTLR Processing crash: " + lexerError.message,
                type: "error"
            });
        }

        // Send actual data transfer packet back to UI thread
        this.sender.emit("annotate", annotations);
    };
}

self.addEventListener("message", function (e) {
    const msg = e.data;

    // RULE: If it has a command, our custom processor will handle it. 
    // Kill the event transmission so worker-base.js never throws an "Unknown command" error.
    if (msg.command) {
        e.stopImmediatePropagation();
    }

    // Handle initial script configurations
    if (msg.command === "importScripts") {
        self.importScripts(...msg.args);
        setupInheritance();

        const cleanSender = {
            on: function () { },
            callback: function (data, id) { self.postMessage({ type: "call", id: id, data: data }); },
            emit: function (name, data) { self.postMessage({ type: "event", name: name, data: data }); }
        };

        antlrProcessor = new AntlrWorkerBackend(cleanSender);
        antlrProcessor.setValue(""); // Prime the document state
        return;
    }

    if (antlrProcessor && typeof antlrProcessor[msg.command] === "function") {
        antlrProcessor[msg.command].apply(antlrProcessor, msg.args);
    }
    else if (antlrProcessor && Object.getPrototypeOf(AntlrWorkerBackend.prototype)[msg.command]) {
        Object.getPrototypeOf(AntlrWorkerBackend.prototype)[msg.command].apply(antlrProcessor, msg.args);
    }
}, true);