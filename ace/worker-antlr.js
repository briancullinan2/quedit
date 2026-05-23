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
 * into Clang/LCC compiler-style multi-line string segments.
 */
function processSyntaxError(lines, annotations, syntaxError) {
    const zeroIndexedRow = syntaxError.line - 1;
    const activeLineText = lines[zeroIndexedRow] || "";
    const cleanLine = activeLineText.replace(/\t/g, '    '); // Flatten tabs for layout alignment

    // Build a classic visual compiler caret layout:    ^~~~~
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
 * Functional collector running over tokens to look for lingering tasks or hidden blocks
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

/**
 * Pure mapping iterator mapping linear ANTLR streams into Ace row arrays
 */
function mapToRowBucket(tokens, tokenLines, token) {
    const zeroIndexedRow = token.line - 1;
    if (!tokenLines[zeroIndexedRow]) {
        tokenLines[zeroIndexedRow] = [];
    }

    let symbolicNameTarget = token.type;
    if (token.textType === 'comment') {
        symbolicNameTarget = 'BlockComment';
    } else if (token.textType === 'string') {
        symbolicNameTarget = 'StringLiteral';
    }

    let rosettaType = toRosettaToken(token.type, this.languageKey);
    if (symbolicNameTarget === 'Identifier') {
        const nextToken = tokens[tokens.indexOf(token) + 1];
        if (nextToken && nextToken.text === '(') {
            rosettaType = "entity.name.function"; // Lights up function names in crisp blue
        }
    }

    tokenLines[zeroIndexedRow].push({
        type: rosettaType,
        value: token.text
    });
}

/**
 * Primary state execution sequence calculating code highlights and token placements
 */
function onUpdate() {
    const fullText = this.doc.getValue();
    const lines = fullText.split('\n');
    let annotations = [];
    let tokenLines = [];

    try {
        // Bind the active document lines and annotation array targets to the error formatter
        const errorBoundCallback = processSyntaxError.bind(null, lines, annotations);

        // Execute the failsafe lookahead token compiler pipeline
        const tokens = getAllTokens(fullText, this.languageKey, errorBoundCallback);

        // Map out structural annotations (TODOs / hidden streams)
        tokens.forEach(processStructuralFlags.bind(null, annotations));

        // Map linear array indices to row grid arrays with context binding for this.languageKey
        tokens.forEach(mapToRowBucket.bind(this, tokens, tokenLines));

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

    // Flush annotations array directly out to the editor gutter
    this.sender.emit("annotate", annotations);
}

// =====================================================================
// 2. CLASS DEFINITION & INHERITANCE BOOTSTRAP
// =====================================================================

function AntlrWorkerBackend(sender) {
    debugger
    const Mirror = self.main = ace.require("ace/worker/mirror").Mirror;
    Mirror.call(this, sender);

    this.setTimeout(200); // Debounce loop delay matching editor buffers
    this.languageKey = "c";
    this.activeFileId = "";
}

function setupInheritance() {
    const Mirror = ace.require("ace/worker/mirror").Mirror;
    const oop = ace.require("ace/lib/oop");
    oop.inherits(AntlrWorkerBackend, Mirror);

    // Assign clean, top-level functional prototype methods directly
    AntlrWorkerBackend.prototype.setLanguageContext = setLanguageContext;
    AntlrWorkerBackend.prototype.onUpdate = onUpdate;
}

// Preserve a local reference to Ace's original, native message parser handler
//const nativeWorkerOnMessage = self.onmessage;

self.addEventListener('message', function (e) {
    const msg = e.data;

    // 1. COMMAND FILTER GATE
    if (msg.command && ['customHighlightRoute', 'requestAST'].includes(msg.command)) {
        e.stopImmediatePropagation();
        return; // Process custom actions here safely
    }

    // 2. LIFECYCLE HIJACK: Intercept the true Ace 'init' command packet frame
    if (msg.init) {
        // Force Ace to run its standard initialization branch first!
        // This causes worker-base.js to resolve 'require(i.module)[i.classname]'
        // and populate 'n = e.main = new s(r)' natively.
        //nativeWorkerOnMessage(e);

        // Capture Ace's newly constructed instance out of its own global scope assignment
        if (self.main) {
            antlrProcessor = self.main;
            
            // Re-assign the top-level prototype context methods directly to the active instance
            antlrProcessor.setLanguageContext = setLanguageContext.bind(antlrProcessor);
            antlrProcessor.onUpdate = onUpdate.bind(antlrProcessor);
            
            // Prime the initial document state safely inside Ace's memory layout
            antlrProcessor.setValue("");
        }
        return;
    }

    // 3. SECURE FALLBACK PACKET ROUTING
    // If a custom command hits before initialization completes, track it safely
    if (antlrProcessor && typeof antlrProcessor[msg.command] === "function") {
        antlrProcessor[msg.command].apply(antlrProcessor, msg.args);
        
        if (['change', 'setValue'].includes(msg.command)) {
            return; 
        }
    }

    // Pass standard text stream buffers ('change', 'setValue') down to the native handler
    //if (nativeWorkerOnMessage) {
    //    nativeWorkerOnMessage(e);
    //}
});