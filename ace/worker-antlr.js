let antlrProcessor = null;

// =====================================================================
// 1. TOP-LEVEL GLOBAL MICRO-UTILITY FUNCTIONS
// =====================================================================

/**
 * Updates the structural targets and re-schedules the parser timeline
 */
function setLanguageContext(langKey, fileId) {
    this.languageKey = langKey;
    this.activeFileId = fileId;
    this.deferredUpdate.schedule(); // Native trigger to fire onUpdate()
}

/**
 * Pure transformation callback formatting incoming ANTLR syntax errors
 */
function processSyntaxError(lines, annotations, syntaxError) {
    const zeroIndexedRow = syntaxError.line - 1;
    const activeLineText = lines[zeroIndexedRow] || "";
    const cleanLine = activeLineText.replace(/\t/g, '    ');

    const leadingSpaces = ' '.repeat(Math.max(0, syntaxError.column));
    const caretMarker = `${leadingSpaces}^~~~~`;

    const clangDiagnosticText = [
        `stdin.c:${syntaxError.line}:${syntaxError.column + 1}: error: ${syntaxError.message}`,
        cleanLine.trimEnd(),
        caretMarker
    ].join('\n');

    annotations.push({
        row: zeroIndexedRow,
        column: syntaxError.column,
        text: clangDiagnosticText,
        type: "error"
    });
}

/**
 * Functional collector scanning for lingering tasks or preprocessor channels
 */
function processStructuralFlags(annotations, token) {
    if (token.textType === 'comment' && token.text.toLowerCase().includes('todo')) {
        annotations.push({
            row: token.line - 1,
            column: token.column,
            text: "Unresolved task: " + token.text.trim(),
            type: "info"
        });
    }
    if (token.channel > 1) {
        annotations.push({
            row: token.line - 1,
            column: token.column,
            text: "Isolated preprocessor block [" + token.type + "]",
            type: "warning"
        });
    }
}

function mapToRowBucket(tokens, tokenLines, lexer, parser, semanticOverrides, token) {
    const rawText = token.text || "";
    let baseRowIndex = token.line - 1; // 0-indexed base coordinate

    // Fetch your dynamic classification up front
    let rosettaType = token.rosettaScope;// semanticOverrides.get(token.start);
    //if (!rosettaType) {
    //    const nativeSymbol = (lexer && lexer.constructor.symbolicNames) ? lexer.constructor.symbolicNames[token.type] : null;
    //    const rawTypeName = nativeSymbol || `type_${token.type}`;
    //    rosettaType = token.rosettaScope;
    //}

    // ─── THE MULTI-LINE SPLITTING LOOP ───
    // If the token contains internal line breaks, distribute the pieces safely
    if (rawText.includes('\n')) {
        const structuralLines = rawText.split('\n');

        structuralLines.forEach((lineText, offset) => {
            const targetRow = baseRowIndex + offset;

            // Strip trailing carriage returns if present on the split fragment
            if (lineText.endsWith('\r')) {
                lineText = lineText.slice(0, -1);
            }

            // Ensure the target row array exists
            if (!tokenLines[targetRow]) {
                tokenLines[targetRow] = [];
            }

            // Do not push empty string artifacts on trailing split lines
            if (lineText === "" && offset === structuralLines.length - 1) {
                return;
            }

            tokenLines[targetRow].push({
                type: rosettaType,
                value: lineText
            });
        });
    } else {
        // ─── STANDARD SINGLE-LINE TRACKING ───
        let tokenText = rawText;
        if (tokenText.endsWith('\r')) tokenText = tokenText.slice(0, -1);

        if (!tokenLines[baseRowIndex]) {
            tokenLines[baseRowIndex] = [];
        }

        tokenLines[baseRowIndex].push({
            type: rosettaType,
            value: tokenText
        });
    }
}



function onUpdate() {
    // Safety check: if no document has been assigned yet, slide out
    if (!this.doc) return;

    const fullText = this.doc.getValue();
    const lines = fullText.split('\n');
    let annotations = [];
    let tokenLines = [];

    try {
        const errorBoundCallback = processSyntaxError.bind(null, lines, annotations);

        // A. Extract baseline token streams
        const [tokens, lexer, parser] = getAllTokens(fullText, this.languageKey, errorBoundCallback);

        // B. RUN THE DEEP-SCANNER PASS TO HARVEST THE SEMANTIC OVERRIDES DICTIONARY
        // We reuse the exact token stream configuration, reset it inside the method, and capture overrides
        const tokenStream = parser.getInputStream(); // or parser._input depending on target bindings
        const [semanticOverrides] = _extractSemanticOverrides(tokenStream, this.languageKey, errorBoundCallback, lexer, AntlrRegistry.antlr4);

        // C. Process standard compilation flags
        tokens.forEach(processStructuralFlags.bind(null, annotations));

        // D. Pass your harvested semanticOverrides cache down into the mapper mapping execution loop
        tokens.forEach(mapToRowBucket.bind(this, tokens, tokenLines, lexer, parser, semanticOverrides));

        // Fill any empty line arrays so Ace has a stable line indexing sequence
        for (let i = 0; i < lines.length; i++) {
            if (!tokenLines[i]) tokenLines[i] = [];
        }

        this.sender.emit("highlight", {
            tokenLines: tokenLines,
            fileId: this.activeFileId
        });
    } catch (lexerError) {
        debugger;
        annotations.push({
            row: 0,
            column: 0,
            text: "ANTLR Processing crash: " + lexerError.message,
            type: "error"
        });
    }

    this.sender.emit("annotate", annotations);
}


function AntlrWorkerBackend(sender) {
    const Mirror = ace.require("ace/worker/mirror").Mirror;
    Mirror.call(this, sender);

    this.setTimeout(200);
    this.languageKey = "c";
    this.activeFileId = "";
}

function setupInheritance() {
    const Mirror = ace.require("ace/worker/mirror").Mirror;
    const oop = ace.require("ace/lib/oop");
    oop.inherits(AntlrWorkerBackend, Mirror);

    AntlrWorkerBackend.prototype.setLanguageContext = setLanguageContext;
    AntlrWorkerBackend.prototype.onUpdate = onUpdate;
}

// =====================================================================
// 3. CLEAN LISTENER COEXISTENCE BUS
// =====================================================================

self.addEventListener('message', function (e) {
    const msg = e.data;
    msg.command ||= msg.event
    // 1. FILTER HIGH-FIDELITY HOOKS
    if (msg.command && ['customHighlightRoute', 'requestAST'].includes(msg.command)) {
        e.stopImmediatePropagation();
        return;
    }

    if (msg.command === "calculateActiveBlockRange") {
        const cursorRow = msg.data.lineNumber; // 1-based lineNumber passed from front-end
        const codeString = antlrProcessor.doc.getValue(); // Get running buffer from doc wrapper
        const runningLangId = antlrProcessor.languageKey || "c";

        try {
            // Execute your streamlined look-around block algorithm
            const blockMeta = extractCurrentBlock(codeString, cursorRow, runningLangId);

            // Post the clean range boundaries right back up the thread channel
            antlrProcessor.sender.emit("blockRange", {
                startLine: blockMeta.startLine,
                endLine: blockMeta.endLine
            })
        } catch (err) {
            console.error("[Worker Block Trace Error]: ", err);
        }
        e.stopImmediatePropagation();
        return
    }

    // 2. SOVEREIGN BOOTSTRAP INITIALIZATION
    if (msg.command === "importScripts") {
        // Let the worker thread download your dependencies cleanly
        self.importScripts(...msg.args);
        setupInheritance();

        // Build a dedicated sender pipeline to post events straight back to our frontend instance
        const cleanSender = {
            on: function () { },
            callback: function (data, id) { self.postMessage({ type: "call", id: id, data: data }); },
            emit: function (name, data) { self.postMessage({ type: "event", name: name, data: data }); }
        };

        // Construct your independent workspace engine instance!
        antlrProcessor = new AntlrWorkerBackend(cleanSender);
        return;
    }

    // 3. AUTONOMOUS TUNNELING GATES
    // If your frontend worker client posts an explicit execution directive,
    // intercept it and apply it straight to your processor context.
    if (antlrProcessor && typeof antlrProcessor[msg.command] === "function") {
        antlrProcessor[msg.command].apply(antlrProcessor, msg.args);
        e.stopImmediatePropagation();
        return;
    }

    // 4. ACE CHANGE HOOK INTEGRATION
    // Since worker-base.js handles "change" packets inside its own listener array,
    // we mirror the incoming edits directly to your sovereign doc state tracker.
    if (antlrProcessor && antlrProcessor.doc && msg.command === "change") {
        antlrProcessor.doc.applyDeltas(msg.args[0]);
        antlrProcessor.deferredUpdate.schedule(); // Trigger lookahead parse
    }
}, true);

