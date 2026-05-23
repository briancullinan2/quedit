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

            let tokenLines = [];

            // Convert the linear ANTLR stream into Ace-compatible row-token objects
            tokens.forEach(function (token) {
                const zeroIndexedRow = token.line - 1;
                if (!tokenLines[zeroIndexedRow]) {
                    tokenLines[zeroIndexedRow] = [];
                }

                // CHOOSE THE TRACKING PATH:
                // If the token is on a hidden channel or explicitly marked as comment/string, override its root class
                let symbolicNameTarget = token.type; // e.g. 'Int', 'For', 'IntegerConstant'

                if (token.textType === 'comment') {
                    symbolicNameTarget = 'BlockComment';
                } else if (token.textType === 'string') {
                    symbolicNameTarget = 'StringLiteral';
                }

                // Map raw ANTLR symbolic names straight to your target Rosetta layer names
                let rosettaType = toRosettaToken(token.type, this.languageKey);
                if (symbolicNameTarget === 'Identifier') {
                    // Look at the sibling index position right next door
                    const nextToken = tokens[tokens.indexOf(token) + 1];
                    if (nextToken && nextToken.text === '(') {
                        rosettaType = "entity.name.function"; // Lights up function titles in crisp blue!
                    }
                }

                tokenLines[zeroIndexedRow].push({
                    type: rosettaType,
                    //type: 'rosetta.' + rosettaType, // Successfully hands over 'storage', 'keyword', 'constant.numeric', etc.
                    value: token.text
                });
            }.bind(this));


            this.sender.emit("highlight", {
                tokenLines: tokenLines,
                fileId: this.activeFileId
            });
        } catch (lexerError) {
            debugger
            annotations.push({
                row: 0,
                column: 0,
                text: "ANTLR Processing crash: " + lexerError.message,
                type: "error"
            });
        }

        // Send both the diagnostics AND the clean token data structures over the bridge
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


/**
 * Rosetta Token Map Engine
 * Converts high-fidelity ANTLR C-Grammar symbolic type names straight into
 * compatible Ace Editor TextMate CSS scope strings.
 * * @param {string} antlrSymbolicName - The raw resolved token type (e.g., 'Int', 'For', 'Identifier')
 * @param {string} languageKey - Target file language extension context ('c' / 'cpp')
 * @returns {string} - Ace-compatible CSS class selector string
 */
function toRosettaToken(antlrSymbolicName, languageKey) {
    if (!antlrSymbolicName) return "text";

    // 1. FAST MARSHALING FOR LITERAL STRINGS
    // If ANTLR returns single-quoted literal operators directly (e.g. "';'", "'='", "'++'")
    if (antlrSymbolicName.startsWith("'") && antlrSymbolicName.endsWith("'")) {
        const literal = antlrSymbolicName.slice(1, -1);
        // Map common structural assignment/punctuation boundaries
        if (['=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|='].includes(literal)) {
            return "keyword.operator";
        }
        if (['+', '-', '*', '/', '%', '++', '--', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~', '<<', '>>'].includes(literal)) {
            return "keyword.operator";
        }
        return "keyword.operator"; // Fallback punctuation
    }

    // Normalize casing for dictionary evaluation matches
    const tokenKey = antlrSymbolicName.trim();
    const lowerKey = tokenKey.toLowerCase();

    // 2. EXPLICIT GROUP STORAGE DICTIONARIES

    // Primitive C Types & Storage Qualifiers -> Maps to: .ace_storage
    const storageTypes = new Set([
        'Void', 'Char', 'Short', 'Int', 'Long', 'Float', 'Double', 'Signed', 'Unsigned', 'Bool',
        'Auto', 'Constexpr', 'Extern', 'Register', 'Static', 'ThreadLocal', 'Typedef',
        'Struct', 'Union', 'Enum', 'Const', 'Restrict', 'Volatile_1', 'Volatile_2', '_Atomic', '_Complex'
    ]);

    // Native C Structural Keywords -> Maps to: .ace_keyword
    const keywords = new Set([
        'Break', 'Case', 'Continue', 'Default', 'Do', 'Else', 'For', 'Goto', 'If', 'Inline',
        'Return', 'Switch', 'While', '_Noreturn', 'Static_assert', 'Sizeof', 'Alignof',
        'Countof', 'Maxof', 'Minof', 'Attribute', 'Asm_1', 'Asm_2', 'Asm_3'
    ]);

    // 3. POLYMORPHIC SCOPE RESOLUTION ROUTINES

    if (storageTypes.has(tokenKey)) {
        return "storage";
    }

    if (keywords.has(tokenKey)) {
        return "keyword";
    }

    // Numbers & Constants -> Maps to: .ace_constant.ace_numeric
    if (tokenKey === 'IntegerConstant' || tokenKey === 'DigitSequence') {
        return "constant.numeric";
    }
    if (tokenKey === 'FloatingConstant') {
        return "constant.numeric";
    }

    // Explicit Core Language Constants -> Maps to: .ace_constant.ace_language
    if (lowerKey.includes('predefinedconstant') || ["'true'", "'false'", "'nullptr'"].includes(antlrSymbolicName)) {
        return "constant.language";
    }

    // String Channels -> Maps to: .ace_string
    if (tokenKey === 'StringLiteral' || tokenKey === 'CharacterConstant') {
        return "string";
    }

    // Preprocessor Blocks -> Maps to: .ace_meta.ace_tag
    if (tokenKey === 'LineDirective') {
        return "meta.tag";
    }

    // Comments -> Maps to: .ace_comment
    if (lowerKey.includes('comment') || tokenKey === 'BlockComment') {
        return "comment";
    }

    // Base Identifiers -> Maps to variables or generic text codes
    if (tokenKey === 'Identifier') {
        return "variable";
    }

    // Fallback baseline wrapper safety gate
    return "text";
}

