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


    if (msg.command === 'getFoldRegions') {
        e.stopImmediatePropagation()
        return executeGetFoldRegionsCommand(msg, antlrProcessor.sender)
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





function executeGetFoldRegionsCommand(msg, sender) {
    // 1. RECOVER WORKER CONTEXT HOOKS
    const activeDoc = antlrProcessor.doc || self.doc || (typeof globalDoc !== 'undefined' ? globalDoc : null);
    if (!activeDoc) {
        console.warn("[Worker Fold] Execution failed: Active document stream buffer is missing.");
        return;
    }

    const codeString = activeDoc.getValue();
    const languageKey = antlrProcessor.languagekey || self.languageKey || "c";

    // Resolve core ANTLR library context reference out of the worker global space
    const antlrCore = AntlrRegistry?.antlr4 || self.antlr4 || (self.antlr && self.antlr.core) || antlr;
    if (!antlrCore) {
        console.error("[Worker Fold] Critical Error: ANTLR runtime core library context lost.");
        return;
    }

    // 2. PARSER CONSTRUCTION PIPELINE
    const cleanKey = languageKey.toLowerCase().trim();
    const lexerLookupKey = `${cleanKey}_lexer`;
    const parserLookupKey = `${cleanKey}_parser`;

    let LexerCtor = AntlrRegistry[lexerLookupKey];
    let ParserCtor = AntlrRegistry[parserLookupKey];

    if (!LexerCtor || !ParserCtor) {
        console.warn(`[Worker Fold] No valid ANTLR grammars registered for language key: ${languageKey}`);
        return;
    }

    // Spin up lightweight input char-stream frameworks natively
    //const chars = new antlrCore.InputStream(codeString);
    const lexer = createLexerInstance(codeString, languageKey);
    const tokens = new antlrCore.CommonTokenStream(lexer);
    const parser = new ParserCtor(tokens);

    // Mute console errors during layout-only block parsing runs
    parser.removeErrorListeners();
    parser._interp.predictionMode = antlrCore.atn.PredictionMode.SLL; // Use fast SLL mode for speed on layout scans
    parser._errHandler = new antlrCore.error.BailErrorStrategy ? new antlrCore.error.BailErrorStrategy() : new antlrCore.error.DefaultErrorStrategy();

    // 3. GENERATE AST SYNTAX TREE SKELETON
    let tree = null;
    try {
        const targetRules = parser.ruleNames || (parser.constructor && parser.constructor.ruleNames);
        if (targetRules && targetRules[0] && typeof parser[targetRules[0]] === 'function') {
            const rootRuleName = targetRules[0]; // Matches base rules like "compilationUnit" or "json"
            tree = parser[rootRuleName]();
        }
    } catch (parseFallbackError) {
        // If Bail Strategy tripped under SLL, drop back to LL mode quickly for deep checking
        try {
            tokens.reset();
            parser._interp.predictionMode = antlrCore.atn.PredictionMode.LL;
            parser._errHandler = new antlrCore.error.DefaultErrorStrategy();
            const rootRuleName = parser.ruleNames[0];
            tree = parser[rootRuleName]();
        } catch (treeCrash) {
            console.error("[Worker Fold] Syntax compilation completely blocked context generation: ", treeCrash);
            return;
        }
    }

    



    // 4. RUN AGNOSTIC BLOCK HARVEST VISITOR
    if (tree) {
        try {
            const blockVisitor = new AntlrBlockCollectorVisitor(parser);
            const rawBlocks = blockVisitor.collect(tree);

            const langId = languageKey || "c";
            const regexRule = ROSETTA_BLOCK_ASSOCIATIONS[langId];

            // ─── STAGE 1: HYBRID VALIDATION CEILING ───
            const validatedBlocks = rawBlocks.filter(b => {
                const height = b.endLine - b.startLine;
                if (height <= 5) return false; 

                if (height > 300 && regexRule && regexRule.open) {
                    // CRITICAL FIX: Use the exact same context resolution hook as the top of the function
                    const checkDoc = antlrProcessor.doc || self.doc || (typeof globalDoc !== 'undefined' ? globalDoc : null);
                    if (checkDoc) {
                        const headerLineText = checkDoc.getLine(b.startLine - 1) || "";
                        const prevLineText = b.startLine > 1 ? checkDoc.getLine(b.startLine - 2) || "" : "";

                        regexRule.open.lastIndex = 0;
                        const isValidHeader = regexRule.open.test(headerLineText) || regexRule.open.test(prevLineText);

                        if (!isValidHeader) {
                            console.warn(`[Regex Gated] Dropped structural anomaly at line ${b.startLine}`);
                            return false; 
                        }
                    }
                }
                return true; 
            });

            // ─── STAGE 2: SORT BY NESTING DEPTH (NARROWEST SPANS FIRST) ───
            validatedBlocks.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine));

            const discoveredBlocks = [];

            // ─── STAGE 3: THE ANTI-BLANKET SWEEP (FIXED) ───
            for (let i = 0; i < validatedBlocks.length; i++) {
                const current = validatedBlocks[i];
                let isOuterParentArtifact = false;
                let wrappedApprovedCount = 0;

                for (let j = 0; j < discoveredBlocks.length; j++) {
                    const approved = discoveredBlocks[j];

                    // Check if current block entirely blankets an already-approved inner body
                    const wrapsApprovedBlock = current.startLine <= approved.startLine && current.endLine >= approved.endLine;
                    
                    if (wrapsApprovedBlock) {
                        wrappedApprovedCount++;
                        
                        const startsClose = Math.abs(current.startLine - approved.startLine) <= 2;
                        const endsClose = Math.abs(current.endLine - approved.endLine) <= 2;

                        // Case A: Tightly matching double-wrapper (e.g., compoundStatement vs blockItemList)
                        if (startsClose || endsClose) {
                            isOuterParentArtifact = true;
                            break;
                        }
                    }
                }

                // Case B: The Macro-Blanket Trap. If this block spans a long distance
                // and swallows multiple completely separate approved functions, it's a phantom.
                if (wrappedApprovedCount > 2 && (current.endLine - current.startLine) > 300) {
                    console.warn(`[Macro Blanket Defeated] Dropped rogue container starting at line ${current.startLine} swallowing ${wrappedApprovedCount} functions.`);
                    isOuterParentArtifact = true;
                }

                if (!isOuterParentArtifact) {
                    discoveredBlocks.push(current);
                }
            }

            // ─── STAGE 4: RESTORE CHRONOLOGICAL ORDER FOR SIDEBAR / NAVIGATION TREE ───
            discoveredBlocks.sort((a, b) => a.startLine - b.startLine);

            // 5. EMIT BOUNDARIES IMMEDIATELY BACK TO MAIN THREAD VIA CHANNELS
            sender.emit("foldRegionsCalculated", {
                fileId: self.activeFileId || msg.args?.[0] || "active_buffer",
                blocks: discoveredBlocks
            });

        } catch (visitorError) {
            console.warn("[Worker Fold] AntlrBlockCollectorVisitor invocation error: ", visitorError);
        }
    }
}