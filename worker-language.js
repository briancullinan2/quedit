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

        return new LexerCtor(chars);
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

    parser._interp.predictionMode = antlr.atn.PredictionMode.LL;
    parser._errHandler = new antlr.error.DefaultErrorStrategy();


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
                console.log(`Parser failed at token cursor: ${token.start} ("${token.text}")`);
            }
        };

        const walker = new antlr.tree.ParseTreeWalker();
        walker.walk(configurationListener, tree);
    }

    return [semanticOverrides, parser];
}



function getAllTokens(sourceText, languageKey, onErrorFound, onResolveInclude) {
    const unifiedSourceBuffer = _safePreprocess(sourceText, languageKey, onResolveInclude, onErrorFound);

    // ─── STAGE 1: SPIN UP THE VISUAL ROW BUFFER ENGINE ───
    const visualLexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!visualLexer) return [];

    const antlr = AntlrRegistry.antlr4;
    const BaseCommonStream = AntlrRegistry.CommonTokenStream || antlr.CommonTokenStream;
    let StreamConstructor = antlr.BufferedTokenStream ? antlr.BufferedTokenStream : Object.getPrototypeOf(BaseCommonStream);
    if (!StreamConstructor || typeof StreamConstructor !== 'function' || StreamConstructor === Function.prototype) {
        StreamConstructor = BaseCommonStream;
    }

    // Capture everything (code + channel 1 whitespace) for your UI viewport map
    const visualTokenStream = new StreamConstructor(visualLexer);
    try { visualTokenStream.fill(); } catch (e) { }


    // ─── STAGE 2: SPIN UP THE ISOLATED AST PARSER ENGINE ───
    // Build a dedicated twin lexer so its internal stream cursors are 100% private
    const parserLexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    const parserTokenStream = new antlr.CommonTokenStream(parserLexer);

    // This will now parse flawlessly on channel 0 without seeing any whitespace artifacts!
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
            if (text === "") return null; // If it was a pure newline, let the line index break handle it natively
        }

        // Use the visualLexer to map names cleanly
        const rawTypeName = _resolveTokenTypeName(visualLexer, token.type);
        // Intercept and cross-reference semantic AST positions seamlessly
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