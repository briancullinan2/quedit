/**
 * Copyright 2026 WebAssembly Community Group participants
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

let port;
const AntlrRegistry = self.AntlrLanguages;


function createLexerInstance(sourceText, languageKey) {
    if (!languageKey) return null;

    // 1. Force the lookup key to be fully normalized lowercase
    const cleanKey = languageKey.toLowerCase().trim();
    const lookupKey = `${cleanKey}_lexer`;

    let LexerCtor = AntlrRegistry[lookupKey];

    // Sane localized compiler overrides map
    if (!LexerCtor) {
        if (cleanKey === 'python') LexerCtor = AntlrRegistry['python3_lexer'];
    }

    if (!LexerCtor) {
        console.error(`[Worker] Normalized target look-up key '${lookupKey}' not found in registry matrix.`);
        return null;
    }

    const antlr = AntlrRegistry.antlr4;
    let chars;
    try {
        chars = (antlr.CharStreams && typeof antlr.CharStreams.fromString === 'function')
            ? antlr.CharStreams.fromString(sourceText)
            : new antlr.InputStream(sourceText);

        if (LexerCtor.normalizeInputStream && typeof LexerCtor.normalizeInputStream === 'function') {
            chars = LexerCtor.normalizeInputStream(chars);
        } else if (LexerCtor.prototype && Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream) {
            chars = Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream(chars);
        }


        // 1. Instantiate the stream pipeline completely natively
        //const chars = new AntlrRegistry.antlr4.InputStream(codeString);
        const lexer = new LexerCtor(chars);
        //const tokens = new AntlrRegistry.antlr4.CommonTokenStream(lexer);

        // ─── THE SIDE-EFFECT FREE FIXED INTERCEPT LOOP ───
        // Force-fill the stream buffer array natively so we can work with real instances
        //tokens.fill();
        /*
        // Walk the flat array cache and memoize text explicitly
        if (tokens.tokens && Array.isArray(tokens.tokens)) {
            for (let i = 0; i < tokens.tokens.length; i++) {
                const t = tokens.tokens[i];

                // Skip mutations if ANTLR already hard-baked an EOF or special token string value
                if (t._text !== null && t._text !== undefined) continue;

                try {
                    // Hard-bind the sliced string directly to avoid the lazy-evaluation getter bugs
                    t.text = codeString.substring(t.start, t.stop + 1);
                } catch (e) {
                    t.text = "";
                }
            }
        }
        */

        return lexer
    } catch (e) {
        console.error(`[Worker] Failed to spin up ANTLR string stream for look-up '${lookupKey}':`, e);
        return null;
    }
}

function _safePreprocess(sourceText, languageKey, onResolveInclude, onErrorFound) {
    try {
        return preprocessSourceText(sourceText, languageKey, onResolveInclude, onErrorFound);
    } catch (e) {
        console.error("[Preprocessor Crisis] Virtual assembly layer collapsed:", e);
        return sourceText;
    }
}




function _extractSemanticOverrides(tokenStream, languageKey, onErrorFound, lexer, antlr) {
    const semanticOverrides = new Map();
    if (!languageKey) return semanticOverrides;

    // 1. Force strict lowercase flat-key parity with our normalized database registry
    const cleanKey = languageKey.toLowerCase().trim();
    const lookupKey = `${cleanKey}_parser`;

    let ParserCtor = AntlrRegistry[lookupKey];

    const parser = new ParserCtor(tokenStream);
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
    if (typeof onErrorFound === 'function') {
        parser.addErrorListener({
            syntaxError: (recognizer, offendingSymbol, line, column, msg) => {
                onErrorFound({ line, column, message: msg });

                // If there is an offending token, inject a failure scope directly into our overrides map
                if (offendingSymbol && typeof offendingSymbol.start === 'number') {
                    const errorScope = "text.syntax_error.err_notfound.annotation_required";
                    semanticOverrides.set(offendingSymbol.start, errorScope);
                }
            }
        });
    }
    parser._interp.predictionMode = AntlrRegistry.antlr4.atn.PredictionMode.SLL;
    parser._errHandler = new AntlrRegistry.antlr4.error.BailErrorStrategy ? new AntlrRegistry.antlr4.error.BailErrorStrategy() : new AntlrRegistry.antlr4.error.DefaultErrorStrategy();


    let tree = null;
    try {
        // Fallback array evaluation: check the instance or constructor for rule maps
        const targetRules = parser.ruleNames || (parser.constructor && parser.constructor.ruleNames);

        if (targetRules && targetRules[0] && typeof parser[targetRules[0]] === 'function') {
            const rootRuleName = targetRules[0]; // Resolves straight to "json" or "compilationUnit"
            console.log(`[Worker] Dynamic execution target acquired: parser.${rootRuleName}()`);
            tree = parser[rootRuleName]();
        }
    } catch (dynamicParseError) {
        console.warn("[Worker] Dynamic root execution failed, falling back to legacy signature gates:", dynamicParseError);
    }


    if (tree) {
        const configurationListener = {
            enterEveryRule: function (ctx) {
                const ruleName = parser.ruleNames[ctx.ruleIndex];
                console.log(`Rule: ${ruleName} | Invoking State: ${ctx.invokingState}`);
            },
            exitEveryRule: function (ctx) { },

            visitTerminal: function (node) {
                const token = node.symbol;
                let ctx = node.parentCtx;

                // 1. ACCUMULATE ACCURATE INHERITANCE STRUCTURAL DATA
                const ruleHistory = [];
                let currentCtx = ctx;

                while (currentCtx) {
                    if (currentCtx.ruleIndex !== undefined && parser.ruleNames[currentCtx.ruleIndex]) {
                        ruleHistory.push(parser.ruleNames[currentCtx.ruleIndex]);
                    }
                    currentCtx = currentCtx.parentCtx; // Move up the syntax tree hierarchy
                }

                const ruleName = parser.ruleNames[ctx.ruleIndex];
                const tokenStartChar = token.start;
                const tokenText = token.text;
                const tokenTypeString = lexer.constructor.symbolicNames[token.type] || "text";

                // 2. ATTACH INHERITANCE TO THE PAYLOAD OBJECT
                // We add 'ruleHistory' onto the token object so 'toRosettaToken' can inspect it natively.
                token.ruleHistory = ruleHistory;
                token.contextNode = ctx; // Pass the active parent context node along for deep walks

                console.log(`Token: "${tokenText}" | Direct Rule: ${ruleName} | Inherited Trace Array:`, ruleHistory);

                // Run your flattened pipeline with the newly enriched token payload
                const generalScope = toRosettaToken(tokenTypeString, ruleName, lexer, parser, token, tokenStream);

                semanticOverrides.set(tokenStartChar, generalScope);
            },

            visitErrorNode: function (node) {
                const token = node.symbol;
                //console.log(`Parser failed at token cursor: ${token.start} ("${token.text}")`);
            }
        };

        const walker = new antlr.tree.ParseTreeWalker();
        walker.walk(configurationListener, tree);


    }

    return [semanticOverrides, parser];
}


function getAllTokens(sourceText, languageKey, onErrorFound, onResolveInclude) {
    const unifiedSourceBuffer = _safePreprocess(sourceText, languageKey, onResolveInclude, onErrorFound);
    const antlr = AntlrRegistry.antlr4;

    // ─── STAGE 1: SPIN UP THE VISUAL ROW BUFFER ENGINE ───
    const visualLexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!visualLexer) return [];

    const BaseCommonStream = AntlrRegistry.CommonTokenStream || antlr.CommonTokenStream;
    let StreamConstructor = antlr.BufferedTokenStream ? antlr.BufferedTokenStream : Object.getPrototypeOf(BaseCommonStream);
    if (!StreamConstructor || typeof StreamConstructor !== 'function' || StreamConstructor === Function.prototype) {
        StreamConstructor = BaseCommonStream;
    }

    const visualTokenStream = new StreamConstructor(visualLexer);

    try {
        // Force-load all raw tokens natively into memory 
        visualTokenStream.fill();

        /*
        const visualTokensArr = visualTokenStream.tokens || (typeof visualTokenStream.getTokens === 'function' ? visualTokenStream.getTokens() : []);
        if (Array.isArray(visualTokensArr)) {
            for (let i = 0; i < visualTokensArr.length; i++) {
                const t = visualTokensArr[i];
                if (t && (t._text === null || t._text === undefined)) {
                    try {
                        t.text = unifiedSourceBuffer.substring(t.start, t.stop + 1);
                    } catch (err) {
                        t.text = "";
                    }
                }
            }
        }
        */
    } catch (e) {
        console.error("[Worker Visual Stream Fill Failure]:", e);
    }


    // ─── STAGE 2: SPIN UP THE ISOLATED AST PARSER ENGINE ───
    const parserLexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    const parserTokenStream = new antlr.CommonTokenStream(parserLexer);

    // Run the extraction matrix smoothly with clean channel 0 tokens
    const [semanticOverrides, parser] = _extractSemanticOverrides(parserTokenStream, languageKey, onErrorFound, parserLexer, antlr);


    // ─── STAGE 3: MAP THE SECURED BUFFERS DOWN THE WIRE ───
    let allTokensArray = [];
    if (typeof visualTokenStream.getTokens === 'function') allTokensArray = visualTokenStream.getTokens();
    if (!allTokensArray || allTokensArray.length === 0) allTokensArray = visualTokenStream.tokens || [];

    return [allTokensArray.map((token) => {
        if (!token || token.type === antlr.Token.EOF) return null;

        let text = token.text || "";

        // Sanitize leading newlines out of raw whitespace blocks so they stream nicely into row buckets
        if (token.channel === 1 && text.startsWith('\n')) {
            text = text.substring(1);
            if (text === "") return null;
        }

        const rawTypeName = _resolveTokenTypeName(visualLexer, token.type);
        let baselineClassification = semanticOverrides.get(token.start);

        if (!baselineClassification) {
            baselineClassification = toRosettaToken(
                rawTypeName,
                token.tokenRule,
                visualLexer,
                parser,
                token,
                visualTokenStream,
                rawTypeName
            );
        }

        return _buildTokenPayload(
            token,
            baselineClassification,
            baselineClassification,
            rawTypeName.toLowerCase(),
            visualLexer,
            parser,
            null
        );
    }).filter(Boolean), visualLexer, parser];
}


function preprocessSourceText(sourceText, languageKey, onResolveInclude, onErrorFound, visitedFiles = new Set()) {
    if (typeof onResolveInclude !== 'function') return sourceText;

    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return sourceText;

    let expandedText = "";
    let token = lexer.nextToken();
    const antlr = AntlrRegistry.antlr4;

    while (token.type !== antlr.Token.EOF) {
        const rawTypeName = _resolveTokenTypeName(lexer, token.type);




        // TODO: resolve header types
        if (rawTypeName === 'Directive' || token.text.trim().startsWith('#include')) {
            const includeMatch = token.text.match(/#include\s*["<]([^">]+)[">]/);
            if (includeMatch && includeMatch[1]) {
                const targetFileName = includeMatch[1].trim();

                if (!visitedFiles.has(targetFileName)) {
                    visitedFiles.add(targetFileName);
                    try {
                        const headerContents = onResolveInclude(targetFileName);
                        if (headerContents) {
                            const fullyExpandedHeader = preprocessSourceText(headerContents, languageKey, onResolveInclude, onErrorFound, visitedFiles);
                            expandedText += `\n/* --- Start Unified Include: ${targetFileName} --- */\n`;
                            expandedText += fullyExpandedHeader;
                            expandedText += `\n/* --- End Unified Include: ${targetFileName} --- */\n`;
                        }
                    } catch (err) {
                        // Track missing dependencies in a global context register for the token mapper to read
                        if (typeof window !== 'undefined') {
                            window.__missingHeaders = window.__missingHeaders || new Set();
                            window.__missingHeaders.add(targetFileName);
                        }
                        expandedText += `\n/* Missing Header Dependency: ${targetFileName} */\n`;
                        onErrorFound({ line: token.start.line, column: token.start.column, message: err.message });
                    }
                }
            } else {
                expandedText += token.text;
            }
        } else {
            expandedText += token.text;
        }
        token = lexer.nextToken();
    }
    return expandedText;
}

function getFoldRegions(sourceText, languageKey) {
    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return [];

    const folds = [];
    const braceStack = [];
    const preprocessorStack = [];
    let token = lexer.nextToken();
    const eof = AntlrRegistry.antlr4.Token.EOF;

    while (token.type !== eof) {
        const typeName = _resolveTokenTypeName(lexer, token.type);
        const row = token.line - 1;

        if (typeName === 'OpenCurlyBracket' || token.text === '{') {
            braceStack.push(row);
        } else if (typeName === 'CloseCurlyBracket' || token.text === '}') {
            if (braceStack.length > 0) {
                const startRow = braceStack.pop();
                if (row > startRow) folds.push({ startRow, endRow: row, type: 'brace' });
            }
        }

        if (token.text.startsWith('#if') || token.text.startsWith('#ifdef')) {
            preprocessorStack.push(row);
        } else if (token.text.startsWith('#endif')) {
            if (preprocessorStack.length > 0) {
                const startRow = preprocessorStack.pop();
                if (row > startRow) folds.push({ startRow, endRow: row, type: 'preprocessor' });
            }
        }

        if (token.channel === 1 || ['BlockComment', 'MULTI_LINE_COMMENT'].includes(typeName)) {
            const textLines = token.text.split('\n');
            if (textLines.length > 1) {
                folds.push({ startRow: row, endRow: row + textLines.length - 1, type: 'comment' });
            }
        }
        token = lexer.nextToken();
    }
    return folds;
}

function getTokensForLine(sourceText, languageKey, targetLine) {
    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return [];

    const lineTokens = [];
    let token = lexer.nextToken();
    const eof = AntlrRegistry.antlr4.Token.EOF;

    while (token.type !== eof) {
        if (token.line > targetLine) break;
        if (token.line === targetLine) {
            lineTokens.push({
                text: token.text,
                type: _resolveTokenTypeName(lexer, token.type),
                start: token.start,
                stop: token.stop,
                column: token.column,
                channel: token.channel
            });
        }
        token = lexer.nextToken();
    }
    return lineTokens;
}


const onAnyMessage = async event => {
    const { id, data, responseId } = event.data;
    if (!id) return;
    let output = null;

    try {
        switch (id) {
            case 'constructor':
                port = event.data.data;
                port.onmessage = onAnyMessage;

                self.language = {
                    lineToken: async (text, language, line) => await self.onmessage({ id: 'lineToken', data: { text, language, line } }),
                    getAllTokens: async (text, language) => await self.onmessage({ id: 'lineToken', data: { text, language } })
                };
                return;

            case 'lineToken':
                output = getTokensForLine(data.text, data.language, data.line);
                break;

            case 'tokens':
                output = getAllTokens(data.text, data.language, data.onErrorFound, data.onResolveInclude);
                break;

            case 'folds':
                output = getFoldRegions(data.text, data.language);
                break;

            default:
                output = { status: 'unhandled_command' };
                break;
        }
    } catch (e) {
        output = { error: e.toString(), stack: e.stack };
    } finally {
        if (port && id !== 'constructor') {
            port.postMessage({ id: 'runAsync', responseId, data: output });
        }
    }
};

self.addEventListener('message', onAnyMessage);