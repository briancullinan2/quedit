/**
 * Copyright 2026 WebAssembly Community Group participants
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

let port;
const AntlrRegistry = self.AntlrLanguages;

// =====================================================================
// 1. CORE PIPELINE BACKEND CONSTRUCTORS
// =====================================================================

function createLexerInstance(sourceText, languageKey) {
    const lexerName = `${languageKey}_${languageKey.charAt(0).toUpperCase() + languageKey.slice(1)}Lexer`;
    let LexerCtor = AntlrRegistry[lexerName];

    if (!LexerCtor) {
        if (languageKey === 'c') LexerCtor = AntlrRegistry['cpp_CLexer'];
        if (languageKey === 'cpp') LexerCtor = AntlrRegistry['cpp_CPP14Lexer'];
        if (languageKey === 'python') LexerCtor = AntlrRegistry['python3_Python3Lexer'];
    }

    if (!LexerCtor) {
        console.error(`[Worker] Language target context '${languageKey}' not found in bundle.`);
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
        console.error("[Worker] Failed to spin up ANTLR string stream:", e);
        return null;
    }
}

function _safePreprocess(sourceText, languageKey, onResolveInclude) {
    try {
        return preprocessSourceText(sourceText, languageKey, onResolveInclude);
    } catch (e) {
        console.error("[Preprocessor Crisis] Virtual assembly layer collapsed:", e);
        return sourceText;
    }
}



/**
 * Universal Structural Rule Context Deep-Scanner Pass
 */
function _extractSemanticOverrides(tokenStream, languageKey, onErrorFound, lexer, antlr) {
    const semanticOverrides = new Map();
    const lCased = languageKey.toLowerCase();

    const pName = `${lCased}_${lCased.charAt(0).toUpperCase() + lCased.slice(1)}Parser`;
    let ParserCtor = AntlrRegistry[pName] || (lCased === 'c' ? AntlrRegistry.c_CParser : (lCased === 'cpp' ? AntlrRegistry.cpp_CPP14Parser : null));

    if (!ParserCtor) return semanticOverrides;

    const parser = new ParserCtor(tokenStream);
    parser.removeErrorListeners();

    if (typeof onErrorFound === 'function') {
        parser.addErrorListener({
            syntaxError: (recognizer, offendingSymbol, line, column, msg) => {
                onErrorFound({ line, column, message: msg });
            }
        });
    }

    parser._interp.predictionMode = antlr.atn.PredictionMode.LL;
    parser._errHandler = new antlr.error.DefaultErrorStrategy();

    let tree;
    try {
        tree = parser.compilationUnit ? parser.compilationUnit() : parser.translationUnit();
    } catch (parseWalkError) { }

    if (tree) {
        const configurationListener = {
            // 1. Leave this strictly for debugging rule layers—do NOT save keys here
            enterEveryRule: function (ctx) {
                const ruleName = parser.ruleNames[ctx.ruleIndex];
                console.log(`Rule: ${ruleName} | Invoking State: ${ctx.invokingState}`);
            },
            exitEveryRule: function (ctx) { },

            // 2. This is where your true linear cursor scope processing lives
            visitTerminal: function (node) {
                const token = node.symbol; // The explicit atomic token element
                const ctx = node.parentCtx;
                const ruleName = parser.ruleNames[ctx.ruleIndex];

                const tokenStartChar = token.start;
                const tokenText = token.text;
                const tokenTypeString = lexer.constructor.symbolicNames[token.type];

                // CRITICAL FIX: Pass the precise leaf 'token' to the mapper, NOT the 'ctx' block!
                const generalScope = toRosettaToken(null, ruleName, lexer, parser, token, tokenStream);

                // Lock down the map with the isolated unique char index pointer
                semanticOverrides.set(tokenStartChar, generalScope);

                console.log(`Cursor at Char ${tokenStartChar} | Token: [${tokenTypeString}: "${tokenText}"] | Interpreted by Rule: ${ruleName}`);
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
    const unifiedSourceBuffer = _safePreprocess(sourceText, languageKey, onResolveInclude);
    const lexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!lexer) return [];

    const antlr = AntlrRegistry.antlr4;
    const tokenStream = new antlr.CommonTokenStream(lexer);

    tokenStream.fill();
    // Re-routed with both lexer and antlr parameters correctly populated!
    const [semanticOverrides, parser] = _extractSemanticOverrides(tokenStream, languageKey, onErrorFound, lexer, antlr);
    tokenStream.reset();

    return [tokenStream.tokens.map((token) => {
        if (token.type === antlr.Token.EOF) return null;

        const rawTypeName = _resolveTokenTypeName(lexer, token.type);
        const lowerType = rawTypeName.toLowerCase();

        // Check if our AST-Rule pass discovered a specialized structural override
        if (semanticOverrides.has(token.tokenIndex)) {
            const calculatedScope = semanticOverrides.get(token.tokenIndex);
            return _buildTokenPayload(token, rawTypeName, calculatedScope, lowerType, lexer, self.activeParserReference, self.activeContextReference);
        }

        // Standard token fallback translation matrix execution pass
        const ruleName = parser.ruleNames[token.ruleIndex];
        const baselineClassification = toRosettaToken(rawTypeName, ruleName, lexer, parser, token, tokenStream);
        return _buildTokenPayload(token, rawTypeName, baselineClassification, lowerType, lexer, null, null);
    }).filter(Boolean), lexer, parser];
}

function preprocessSourceText(sourceText, languageKey, onResolveInclude, visitedFiles = new Set()) {
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
                            const fullyExpandedHeader = preprocessSourceText(headerContents, languageKey, onResolveInclude, visitedFiles);
                            expandedText += `\n/* --- Start Unified Include: ${targetFileName} --- */\n`;
                            expandedText += fullyExpandedHeader;
                            expandedText += `\n/* --- End Unified Include: ${targetFileName} --- */\n`;
                        }
                    } catch (err) {
                        expandedText += `\n/* Missing Header Dependency: ${targetFileName} */\n`;
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