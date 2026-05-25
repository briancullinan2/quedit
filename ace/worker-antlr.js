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
    if (token.textType === 'comment'
        && (token.text.toLowerCase().includes('todo')
            || token.text.toLowerCase().includes('fix'))
    ) {
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
self.addEventListener('message', function (e) {
    const msg = e.data;
    if (!msg) return;

    // Use a localized variable for routing so we don't mutate the raw event object 
    // that Ace's worker-base.js expects to read further down the chain.
    const commandName = msg.command || msg.event;

    // 1. FILTER HIGH-FIDELITY HOOKS
    if (commandName && ['customHighlightRoute', 'requestAST'].includes(commandName)) {
        e.stopImmediatePropagation();
        return;
    }

    if (commandName === "calculateActiveBlockRange") {
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
            });
        } catch (err) {
            console.error("[Worker Block Trace Error]: ", err);
        }
        e.stopImmediatePropagation();
        return;
    }

    if (commandName === 'getFoldRegions') {
        e.stopImmediatePropagation();
        return executeGetFoldRegionsCommand(msg, antlrProcessor.sender);
    }

    // 2. SOVEREIGN BOOTSTRAP INITIALIZATION
    if (commandName === "importScripts") {
        e.stopImmediatePropagation(); // Prevent Ace from trying to parse script imports

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
    if (antlrProcessor && typeof antlrProcessor[commandName] === "function") {
        antlrProcessor[commandName].apply(antlrProcessor, msg.args);
        e.stopImmediatePropagation();
        return;
    }

    // 4. ACE CHANGE HOOK INTEGRATION
    // Mirror the edits to your state tracker, but DO NOT call stopImmediatePropagation().
    // Ace's background engine relies on receiving this identical change event next.
    if (antlrProcessor && antlrProcessor.doc && commandName === "change") {
        // Rehydrate compressed delta structure back into the required standard format
        const rawPayload = msg.data && msg.data.data;
        if (Array.isArray(rawPayload) && rawPayload.length >= 2) {
            const startPos = rawPayload[0]; // {"row":6,"column":28}
            const secondParam = rawPayload[1]; // Can be {"row":6,"column":30} OR an Array of lines [";"]

            let cleanDelta;

            // 1. CHECK IF DELETION: If the second element has a 'row' property, it's an end position object
            if (secondParam && typeof secondParam === "object" && "row" in secondParam) {
                cleanDelta = {
                    action: "remove",
                    start: startPos,
                    end: secondParam,
                    // For a remove action, standard applyDeltas will slice out the text, 
                    // but providing an empty array prevents crashes if the tracker demands the lines key
                    lines: []
                };
            }
            // 2. CHECK IF INSERTION: If the second element is an array of text lines
            else if (Array.isArray(secondParam)) {
                const endRow = startPos.row + secondParam.length - 1;
                const endColumn = (secondParam.length === 1)
                    ? startPos.column + secondParam[0].length
                    : secondParam[secondParam.length - 1].length;

                cleanDelta = {
                    action: "insert",
                    start: startPos,
                    end: { row: endRow, column: endColumn },
                    lines: secondParam
                };
            }

            // 3. Apply the fixed delta to your tracker if valid
            if (cleanDelta) {
                antlrProcessor.doc.applyDeltas([cleanDelta]);
                antlrProcessor.deferredUpdate.schedule(); // Trigger lookahead parse
            }
        }
        // No stopImmediatePropagation() here! Let it pass straight through to Ace.
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
    const silentDiagnosticObserver = {
        syntaxError: function (recognizer, offendingSymbol, line, column, msg, e) {
            // Quietly absorb syntax markers during visual fold processing runs
        },
        reportAmbiguity: function (recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs) {
            // Absorb deep SLL prediction branching conflicts silently
        },
        reportAttemptingFullContext: function (recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs) {
            // CRITICAL PROXIMATE GAP FIX: Satisfies the engine when dropping into deep LL validation
        },
        reportContextSensitivity: function (recognizer, dfa, startIndex, stopIndex, prediction, configs) {
            // Absorb fallback optimization logs smoothly
        }
    };

    // Attach the clean listener shell to the parser
    parser.addErrorListener(silentDiagnosticObserver);

    //parser._interp.predictionMode = AntlrRegistry.antlr4.atn.PredictionMode.SLL;
    const ErrorNamespace = AntlrRegistry.antlr4?.error || {};
    const BailStrategy = ErrorNamespace.BailErrorStrategy;
    const DefaultStrategy = ErrorNamespace.DefaultErrorStrategy;

    // 2. Default to DefaultErrorStrategy so the parser attempts syntax recovery 
    // rather than instantly throwing an uncatchable exception on minor token gaps
    if (DefaultStrategy) {
        parser._errHandler = new DefaultStrategy();
    } else if (BailStrategy) {
        parser._errHandler = new BailStrategy();
    }

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
            const checkDoc = antlrProcessor.doc || self.doc || (typeof globalDoc !== 'undefined' ? globalDoc : null);

            if (checkDoc) {
                const discoveredBlocks = [];

                // Total line count helper to check bounds safely
                const totalLines = checkDoc.getLength();

                // Step 2: Filter out blocks that don't meet basic size criteria
                // Rule: Must be at least 5 lines long (inclusive bounds check)
                const candidates = rawBlocks.filter(b => (b.endLine - b.startLine + 1) >= 5);

                // Step 3: Run filtering & line adjustments
                for (let i = 0; i < candidates.length; i++) {
                    const b = candidates[i];

                    // 1-based to 0-based conversion for Ace Document line indexing
                    const startLineIdx = b.startLine - 1;
                    const endLineIdx = b.endLine - 1;

                    // Skip safely if the positions are out of file boundaries
                    if (startLineIdx < 0 || endLineIdx >= totalLines) continue;

                    // Step 4: Handle standard JS deep nesting threshold
                    // Filter elements in the original list that are strictly inside this block
                    const internalBlocks = rawBlocks.filter(other =>
                        other !== b &&
                        other.startLine >= b.startLine &&
                        other.endLine <= b.endLine
                    );

                    // Skip block if it contains more than 4 nested functional blocks
                    if (internalBlocks.length > 100) {

                        continue;
                    }

                    // Step 5: Double-stack elimination (De-duplication of identical/near-identical ranges)
                    // Check if we already processed a broader structural rule handling this exact code range
                    const isDuplicate = discoveredBlocks.some(existing =>
                        Math.abs(existing.startLine - b.startLine) <= 1 &&
                        Math.abs(existing.endLine - b.endLine) <= 1
                    );
                    if (isDuplicate) continue;

                    // Step 6: Visual Bracket Layout Adjustment
                    const headerLineText = checkDoc.getLine(startLineIdx) || "";
                    let finalStartLine = b.startLine;
                    let finalEndLine = b.endLine;

                    // If the starting line contains an opening curly bracket '{', 
                    // adjust the fold downward by 1 line so the function signature line remains visible
                    if (headerLineText.includes('{')) {
                        finalStartLine = b.startLine + 1;
                    }


                    if (checkDoc.getLine(endLineIdx).includes('}')
                        || checkDoc.getLine(endLineIdx + 1).includes('}')
                    ) {
                        finalEndLine = b.endLine - 1;
                    }

                    // Final sanity check: ensuring our modifications didn't shrink the fold to less than 2 lines
                    if (b.endLine - finalStartLine >= 2) {
                        discoveredBlocks.push({
                            ruleName: b.ruleName,
                            startLine: finalStartLine,
                            endLine: finalEndLine,
                            startIndex: b.startIndex,
                            endIndex: b.endIndex
                        });
                    }
                }

                // Step 7: Emit processed clean fold structures to the Ace interface
                sender.emit("foldRegionsCalculated", {
                    fileId: self.activeFileId || msg.args?.[0] || "active_buffer",
                    blocks: discoveredBlocks
                });
            }

        } catch (visitorError) {
            console.warn("[Worker Fold] AntlrBlockCollectorVisitor invocation error: ", visitorError);
        }
    }
}