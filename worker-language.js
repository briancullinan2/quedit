/**
 * Copyright 2026 WebAssembly Community Group participants
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

let port;
const AntlrRegistry = self.AntlrLanguages;

// =====================================================================
// 1. UNIFIED CORE PIPELINE LOOKUP DICTIONARIES
// =====================================================================

const ROSETTA_STORAGE_TYPES = new Set([
    'Void', 'Char', 'Short', 'Int', 'Long', 'Float', 'Double', 'Signed', 'Unsigned', 'Bool',
    'Auto', 'Constexpr', 'Extern', 'Register', 'function', 'ThreadLocal', 'Typedef',
    'Struct', 'Union', 'Enum', 'Const', 'Restrict', 'Volatile_1', 'Volatile_2', '_Atomic', '_Complex'
]);

const ROSETTA_KEYWORDS = new Set([
    'Break', 'Case', 'Continue', 'Default', 'Do', 'Else', 'For', 'Goto', 'If', 'Inline',
    'Return', 'Switch', 'While', '_Noreturn', 'function_assert', 'Sizeof', 'Alignof',
    'Countof', 'Maxof', 'Minof', 'Attribute', 'Asm_1', 'Asm_2', 'Asm_3'
]);

// =====================================================================
// 2. GLOBAL SYSTEM MICRO-UTILITY CORE
// =====================================================================

function _resolveTokenTypeName(lexer, tokenType) {
    const vocabulary = lexer.vocabulary || lexer.constructor.vocabulary || lexer.constructor || (lexer.literalNames ? lexer : null);
    if (vocabulary) {
        if (typeof vocabulary.getSymbolicName === 'function') {
            return vocabulary.getSymbolicName(tokenType) || `type_${tokenType}`;
        } else if (vocabulary.symbolicNames && vocabulary.symbolicNames[tokenType]) {
            return vocabulary.symbolicNames[tokenType];
        }
    }
    return `type_${tokenType}`;
}

function toRosettaToken(antlrSymbolicName, languageKey) {
    if (!antlrSymbolicName) return "text";

    if (antlrSymbolicName.startsWith("'") && antlrSymbolicName.endsWith("'")) {
        return "keyword.operator";
    }

    const tokenKey = antlrSymbolicName.trim();
    const lowerKey = tokenKey.toLowerCase();

    if (ROSETTA_STORAGE_TYPES.has(tokenKey)) return "storage";
    if (ROSETTA_KEYWORDS.has(tokenKey)) return "keyword";
    if (['IntegerConstant', 'DigitSequence', 'FloatingConstant'].includes(tokenKey)) return "constant.numeric";
    if (lowerKey.includes('predefinedconstant') || ["'true'", "'false'", "'nullptr'"].includes(antlrSymbolicName)) return "constant.language";
    if (['StringLiteral', 'CharacterConstant'].includes(tokenKey)) return "string";
    if (tokenKey === 'LineDirective') return "meta.tag";
    if (lowerKey.includes('comment') || tokenKey === 'BlockComment') return "comment";
    if (tokenKey === 'Identifier') return "variable";

    return "text";
}

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
        if (antlr.CharStreams && typeof antlr.CharStreams.fromString === 'function') {
            chars = antlr.CharStreams.fromString(sourceText);
        } else if (typeof antlr.CharStream === 'function') {
            chars = new antlr.CharStream(sourceText);
        } else {
            chars = new antlr.InputStream(sourceText);
        }

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

// =====================================================================
// 3. SERVICE RUNNERS (FUNCTIONAL REFACTOR)
// =====================================================================

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

// =====================================================================
// 4. PIPELINE PACKET ROUTING CONTROLLER
// =====================================================================


function getAllTokens(sourceText, languageKey, onErrorFound, onResolveInclude) {
    // 1. FIXED: Calling plain global micro-utility safely
    const unifiedSourceBuffer = _safePreprocess(sourceText, languageKey, onResolveInclude);

    // 2. Instantiate the lexer engine over the layout
    const lexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!lexer) return [];

    const antlr = self.AntlrLanguages.antlr4;
    const tokenStream = new antlr.CommonTokenStream(lexer);

    // Fill the stream completely to cache indices cleanly
    tokenStream.fill();

    // 3. Run the Error-Tolerant Parse Tree Walk to extract overrides
    const semanticOverrides = _extractSemanticOverrides(
        tokenStream,
        languageKey,
        onErrorFound,
        antlr
    );

    // Ensure the stream index state is reset back to zero before mapping properties
    tokenStream.reset();

    // 4. Map flat stream arrays to Rosetta web-safe CSS classifications
    return _mapTokensToRosettaScopes(tokenStream, lexer, semanticOverrides, antlr);
}


const executePipelineAction = async (event) => {
    const { id, data, responseId } = event.data;
    if (!id) return;

    let output = null;
    try {
        if (id === 'constructor') {
            port = event.data.data;
            port.onmessage = executePipelineAction;
            return;
        }

        if (id === 'lineToken') {
            output = getTokensForLine(data.text, data.language, data.line);
        } else if (id === 'tokens') {
            // FIXED: Do not pass non-serializable properties down the message pipe.
            // Route data strings and leverage internal local callbacks or bound ports.
            output = getAllTokens(data.text, data.language, data.onErrorFound, data.onResolveInclude);
        } else if (id === 'folds') {
            output = getFoldRegions(data.text, data.language);
        }

        if (port) {
            port.postMessage({ id: 'runAsync', responseId, data: output });
        }
    } catch (e) {
        if (port) {
            port.postMessage({ id: 'runAsync', responseId, data: { error: e.toString(), stack: e.stack } });
        }
    }
}


self.addEventListener('message', executePipelineAction);



function _safePreprocess(sourceText, languageKey, onResolveInclude) {
    try {
        // FIXED: Mapping directly to your flat file preprocessing function
        return preprocessSourceText(sourceText, languageKey, onResolveInclude);
    } catch (e) {
        console.error("[Preprocessor Crisis] Virtual assembly layer collapsed:", e);
        return sourceText;
    }
}

function _mapTokensToRosettaScopes(tokenStream, lexer, semanticOverrides, antlr) {
    // Traverse the cold token cache securely
    const tokenArray = tokenStream.tokens || [];

    return tokenArray.map((token) => {
        if (token.type === antlr.Token.EOF) return null;

        const rawTypeName = _resolveTokenTypeName(lexer, token.type);
        const lowerType = rawTypeName.toLowerCase();

        // 1. Check parser structural overrides first
        if (semanticOverrides.has(token.tokenIndex)) {
            const typeOverride = semanticOverrides.get(token.tokenIndex);
            return _buildTokenPayload(token, rawTypeName, typeOverride, lowerType);
        }

        // 2. Fallback to basic grammar lexography classifications
        let semanticClassification = "text";
        if (rawTypeName.startsWith("'")) {
            semanticClassification = "keyword.operator";
        } else if (['int', 'float', 'double', 'char', 'void', 'bool'].includes(lowerType) || lowerType.includes('storage')) {
            semanticClassification = "storage";
        } else if (lowerType.includes('comment') || token.channel === 1) {
            semanticClassification = "comment";
        } else if (lowerType.includes('string') || lowerType.includes('literal') || lowerType.includes('characterconstant')) {
            semanticClassification = "string";
        } else if (lowerType.includes('keyword') || ['if', 'for', 'while', 'return', 'break', 'switch', 'case', 'else'].includes(lowerType)) {
            semanticClassification = "keyword";
        } else if (rawTypeName === 'Identifier') {
            semanticClassification = "variable";
        }

        return _buildTokenPayload(token, rawTypeName, semanticClassification, lowerType);
    }).filter(Boolean);
}

function _buildTokenPayload(token, rawTypeName, classification, lowerType) {
    const isComment = lowerType.includes('comment') || token.channel === 1;
    const isString = lowerType.includes('string') || lowerType.includes('literal') || classification === 'string';

    return {
        text: token.text,
        type: rawTypeName,
        textType: isComment ? 'comment' : (isString ? 'string' : 'code'),
        spellCheckable: isComment || isString,
        line: token.line,
        column: token.column,
        start: token.start,
        stop: token.stop,
        channel: token.channel,
        rosettaScope: classification // Clean, single CSS scope ready for Ace Editor rendering
    };
}

function _extractSemanticOverrides(tokenStream, languageKey, onErrorFound, antlr) {
    const semanticOverrides = new Map();

    const parserName = `${languageKey}_${languageKey.charAt(0).toUpperCase() + languageKey.slice(1)}Parser`;
    let ParserCtor = self.AntlrLanguages[parserName];
    if (!ParserCtor && languageKey === 'c') ParserCtor = self.AntlrLanguages.c_CParser;
    if (!ParserCtor && languageKey === 'cpp') ParserCtor = self.AntlrLanguages.cpp_CPP14Parser;

    if (!ParserCtor) return semanticOverrides;

    const parser = new ParserCtor(tokenStream);

    // --- THE FAILSAFE CONFIGURATIONS ---
    parser.removeErrorListeners();
    if (typeof onErrorFound === 'function') {
        parser.addErrorListener({
            syntaxError: (recognizer, offendingSymbol, line, column, msg, e) => {
                onErrorFound({ line, column, message: msg });
            }
        });
    }

    // CRITICAL 1: Set the prediction mode to deep LL optimization.
    // This forces the engine to run full lookahead calculations rather than giving up early (SLL)
    parser._interp.predictionMode = antlr.atn.PredictionMode.LL;

    // CRITICAL 2: Ensure we use DefaultErrorStrategy instead of BailErrorStrategy.
    // DefaultErrorStrategy executes token insertion and deletion recovery dynamically mid-parse.
    parser._errHandler = new antlr.DefaultErrorStrategy();

    // Execute the parse pass
    let tree;
    try {
        tree = parser.compilationUnit ? parser.compilationUnit() : parser.translationUnit();
    } catch (parseWalkError) {
        // Suppress complete crash logs; whatever survived inside the tree will be walked
    }

    // Walk whatever structural fragments survived the parse loop
    if (tree) {
        const ParseTreeListener = function () {
            antlr.tree.ParseTreeListener.call(this);
            return this;
        };
        ParseTreeListener.prototype = Object.create(antlr.tree.ParseTreeListener.prototype);

        // Map function declarations safely
        ParseTreeListener.prototype.enterDirectDeclarator = function (ctx) {
            if (ctx.Identifier() && ctx.getText().includes('(')) {
                semanticOverrides.set(ctx.Identifier().symbol.tokenIndex, 'function');
            }
        };

        // Map type definitions safely
        ParseTreeListener.prototype.enterTypedefName = function (ctx) {
            if (ctx.Identifier()) {
                semanticOverrides.set(ctx.Identifier().symbol.tokenIndex, 'type');
            }
        };

        const walker = new antlr.tree.ParseTreeWalker();
        walker.walk(new ParseTreeListener(), tree);
    }

    return semanticOverrides;
}

function getAllTokens(sourceText, languageKey, onErrorFound, onResolveInclude) {
    let unifiedSourceBuffer = sourceText;
    try {
        unifiedSourceBuffer = preprocessSourceText(sourceText, languageKey, onResolveInclude);
    } catch (e) { }

    const lexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!lexer) return [];

    const antlr = AntlrRegistry.antlr4;
    const tokenStream = new antlr.CommonTokenStream(lexer);

    if (typeof onErrorFound === 'function') {
        const parserName = `${languageKey}_${languageKey.charAt(0).toUpperCase() + languageKey.slice(1)}Parser`;
        let ParserCtor = AntlrRegistry[parserName] || (languageKey === 'c' ? AntlrRegistry.c_CParser : (languageKey === 'cpp' ? AntlrRegistry.cpp_CPP14Parser : null));

        if (ParserCtor) {
            const parser = new ParserCtor(tokenStream);
            parser.removeErrorListeners();
            parser.addErrorListener({
                syntaxError: (recognizer, offendingSymbol, line, column, msg) => {
                    onErrorFound({ line, column, message: msg });
                }
            });
            try {
                if (typeof parser.compilationUnit === 'function') parser.compilationUnit();
                else if (typeof parser.translationUnit === 'function') parser.translationUnit();
            } catch (pErr) { }
        }
    }

    tokenStream.reset();
    lexer.reset();

    const allTokens = [];
    let token = lexer.nextToken();

    while (token.type !== antlr.Token.EOF) {
        const rawTypeName = _resolveTokenTypeName(lexer, token.type);
        const lowerType = rawTypeName.toLowerCase();
        const isComment = lowerType.includes('comment') || token.channel === 1;
        const isString = lowerType.includes('string') || lowerType.includes('literal_string') || lowerType.includes('text');

        allTokens.push({
            text: token.text,
            type: rawTypeName,
            line: token.line,
            column: token.column,
            start: token.start,
            stop: token.stop,
            channel: token.channel,
            spellCheckable: isComment || isString,
            textType: isComment ? 'comment' : (isString ? 'string' : 'code')
        });
        token = lexer.nextToken();
    }
    return allTokens;
}
