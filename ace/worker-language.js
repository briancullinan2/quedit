/*
 * Copyright 2026 WebAssembly Community Group participants
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Load your single-file unified compiler bundle
//self.importScripts('antlr-languages.bundle.js');

let port;
const AntlrRegistry = self.AntlrLanguages;
class TokenVisitor {
    static _resolveTokenTypeName(lexer, tokenType) {
        const vocabulary = lexer.vocabulary ||
            lexer.constructor.vocabulary ||
            lexer.constructor ||
            (lexer.literalNames ? lexer : null);

        if (vocabulary) {
            if (typeof vocabulary.getSymbolicName === 'function') {
                return vocabulary.getSymbolicName(tokenType) || `type_${tokenType}`;
            } else if (vocabulary.symbolicNames && vocabulary.symbolicNames[tokenType]) {
                return vocabulary.symbolicNames[tokenType];
            }
        }
        return `type_${tokenType}`;
    }


    /**
     * Extracts tokens on a specific target line number by advancing the stream pointer.
     */
    static getTokensForLine(sourceText, languageKey, targetLine) {
        const lexer = TokenVisitor.createLexerInstance(sourceText, languageKey);
        if (!lexer) return [];

        const lineTokens = [];
        let token = lexer.nextToken();

        while (token.type !== AntlrRegistry.antlr4.Token.EOF) {
            if (token.line > targetLine) {
                break;
            }

            if (token.line === targetLine) {
                lineTokens.push({
                    text: token.text,
                    type: TokenVisitor._resolveTokenTypeName(lexer, token.type),
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


    
    /**
     * Resolves and flattens all internal #include dependencies recursively,
     * building a unified virtual source stream before running the parser diagnostics.
     * * @param {string} sourceText - The entry-point file text buffer
     * @param {string} languageKey - Target engine language tracker ("c" / "cpp")
     * @param {function} onResolveInclude - Callback matching: (fileName) => returns file text string
     * @param {Set<string>} visitedFiles - Protection tracker against infinite circular includes
     */
    static preprocessSourceText(sourceText, languageKey, onResolveInclude, visitedFiles = new Set()) {
        // If we don't have an asset locator callback, step out and return the raw source text
        if (typeof onResolveInclude !== 'function') return sourceText;

        const lexer = TokenVisitor.createLexerInstance(sourceText, languageKey);
        if (!lexer) return sourceText;

        let expandedText = "";
        let token = lexer.nextToken();
        const antlr = self.AntlrLanguages.antlr4;

        while (token.type !== antlr.Token.EOF) {
            const rawTypeName = TokenVisitor._resolveTokenTypeName(lexer, token.type);

            // Look for custom preprocessor channels or literal text matching our directive rules
            if (rawTypeName === 'Directive' || token.text.trim().startsWith('#include')) {
                const includeMatch = token.text.match(/#include\s*["<]([^">]+)[">]/);

                if (includeMatch && includeMatch[1]) {
                    const targetFileName = includeMatch[1].trim();

                    // Guard clause: Avoid infinite lock loops if headers circularly import each other
                    if (!visitedFiles.has(targetFileName)) {
                        visitedFiles.add(targetFileName);

                        try {
                            // FIRE THE HOOK: Fetch the raw string contents from your IDE mesh registry!
                            const headerContents = onResolveInclude(targetFileName);

                            if (headerContents) {
                                // RECURSIVE DEEP RESOLVE: Process any nested #includes inside this header file
                                const fullyExpandedHeader = TokenVisitor.preprocessSourceText(
                                    headerContents,
                                    languageKey,
                                    onResolveInclude,
                                    visitedFiles
                                );

                                // Append the processed block text into the main memory stream
                                expandedText += `\n/* --- Start Unified Include: ${targetFileName} --- */\n`;
                                expandedText += fullyExpandedHeader;
                                expandedText += `\n/* --- End Unified Include: ${targetFileName} --- */\n`;
                            }
                        } catch (resolverError) {
                            console.warn(`[Preprocessor] Failed to resolve virtual header target [${targetFileName}]:`, resolverError);
                            expandedText += `\n/* Missing Header Dependency: ${targetFileName} */\n`;
                        }
                    }
                } else {
                    // It's a standard directive like #define or #ifdef, append it normally
                    expandedText += token.text;
                }
            } else {
                // Regular source code characters, push them right into the tracking stream
                expandedText += token.text;
            }

            token = lexer.nextToken();
        }

        return expandedText;
    }

    /**
     * Upgraded token verification manager with integrated on-demand asset tracking
     */
    static getAllTokens(sourceText, languageKey, onErrorFound, onResolveInclude) {
        // 1. RUN THE VIRTUAL PREPROCESSOR PASSTHROUGH
        // Aggregates all your custom structs, macro dimensions, and types into a single buffer string!
        let unifiedSourceBuffer = sourceText;
        try {
            unifiedSourceBuffer = TokenVisitor.preprocessSourceText(sourceText, languageKey, onResolveInclude);
        } catch (e) {
            console.error("[Preprocessor Crisis] Virtual assembly layer collapsed:", e);
        }

        // 2. Instantiate the lexer over the fully unified, combined string buffer layout
        const lexer = TokenVisitor.createLexerInstance(unifiedSourceBuffer, languageKey);
        if (!lexer) return [];

        const antlr = self.AntlrLanguages.antlr4;
        const tokenStream = new antlr.CommonTokenStream(lexer);

        // 3. PARSER SYNTAX ERROR HOOK
        if (typeof onErrorFound === 'function') {
            const parserName = `${languageKey}_${languageKey.charAt(0).toUpperCase() + languageKey.slice(1)}Parser`;
            let ParserCtor = self.AntlrLanguages[parserName];

            if (!ParserCtor) {
                if (languageKey === 'c') ParserCtor = self.AntlrLanguages.c_CParser;
                if (languageKey === 'cpp') ParserCtor = self.AntlrLanguages.cpp_CPP14Parser;
            }

            if (ParserCtor) {
                const parser = new ParserCtor(tokenStream);
                parser.removeErrorListeners();
                parser.addErrorListener({
                    syntaxError: function (recognizer, offendingSymbol, line, column, msg, e) {
                        onErrorFound({ line, column, message: msg });
                    }
                });

                try {
                    if (typeof parser.compilationUnit === 'function') {
                        parser.compilationUnit();
                    } else if (typeof parser.translationUnit === 'function') {
                        parser.translationUnit();
                    }
                } catch (parseWalkError) { }
            }
        }

        // 4. Return the flat token collection sequence back to the primary UI thread
        tokenStream.reset();
        lexer.reset();

        const allTokens = [];
        let token = lexer.nextToken();

        while (token.type !== antlr.Token.EOF) {
            const rawTypeName = TokenVisitor._resolveTokenTypeName(lexer, token.type);
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


    /**
     * Scans all channels simultaneously to generate precise code-collapsing coordinates
     * @param {string} sourceText 
     * @param {string} languageKey 
     * @returns {Array<object>} - Array of fold regions { startRow, endRow, type }
     */
    static getFoldRegions(sourceText, languageKey) {
        const lexer = TokenVisitor.createLexerInstance(sourceText, languageKey);
        if (!lexer) return [];

        const folds = [];

        // Tracking stacks for structural matching pairs
        const braceStack = [];
        const preprocessorStack = [];

        // Manual low-level token extraction bypassing standard stream channel filtering
        let token = lexer.nextToken();

        while (token.type !== AntlrRegistry.antlr4.Token.EOF) {
            const typeName = TokenVisitor._resolveTokenTypeName(lexer, token.type);
            const row = token.line - 1; // Convert to 0-indexed values for Ace Editor

            // --- 1. Track Block Braces (Standard structural scope folding) ---
            if (typeName === 'OpenCurlyBracket' || token.text === '{') {
                braceStack.push(row);
            }
            else if (typeName === 'CloseCurlyBracket' || token.text === '}') {
                if (braceStack.length > 0) {
                    const startRow = braceStack.pop();
                    if (row > startRow) { // Only fold if it spans multi-line scopes
                        folds.push({ startRow, endRow: row, type: 'brace' });
                    }
                }
            }

            // --- 2. Track Preprocessor Directives (Your custom toggles!) ---
            // Matches tokens generated by our custom channel maps or raw text signatures
            if (token.text.startsWith('#if') || token.text.startsWith('#ifdef')) {
                preprocessorStack.push(row);
            }
            else if (token.text.startsWith('#endif')) {
                if (preprocessorStack.length > 0) {
                    const startRow = preprocessorStack.pop();
                    if (row > startRow) {
                        folds.push({ startRow, endRow: row, type: 'preprocessor' });
                    }
                }
            }

            // --- 3. Track Multi-line Block Comments (Natively on HIDDEN channels) ---
            // If the grammar routes block comments to channel 1 (HIDDEN), they appear here automatically!
            if (token.channel === 1 || typeName === 'BlockComment' || typeName === 'MULTI_LINE_COMMENT') {
                const textLines = token.text.split('\n');
                if (textLines.length > 1) {
                    folds.push({
                        startRow: row,
                        endRow: row + textLines.length - 1,
                        type: 'comment'
                    });
                }
            }

            token = lexer.nextToken();
        }

        return folds;
    }

    /**
     * Dynamically maps language strings to bundled lexer prototype wrappers
     */
    static createLexerInstance(sourceText, languageKey) {
        // Resolve keys matching your safe namespacing (e.g. "c", "javascript", "python3")
        const lexerName = `${languageKey}_${languageKey.charAt(0).toUpperCase() + languageKey.slice(1)}Lexer`;
        let LexerCtor = AntlrRegistry[lexerName];

        // Specific subfolder mapping overrides fallback hooks
        if (!LexerCtor) {
            if (languageKey === 'c') LexerCtor = AntlrRegistry['cpp_CLexer'];
            if (languageKey === 'cpp') LexerCtor = AntlrRegistry['cpp_CPP14Lexer'];
            if (languageKey === 'python') LexerCtor = AntlrRegistry['python3_Python3Lexer'];
        }

        if (!LexerCtor) {
            console.error(`[Worker] Requested language definition context '${languageKey}' not found in bundle.`);
            return null;
        }

        // =====================================================================
        // THE BULLETPROOF INPUT STREAM RESOLVER
        // =====================================================================
        const antlr = AntlrRegistry.antlr4;
        let chars;

        try {
            if (antlr.CharStreams && typeof antlr.CharStreams.fromString === 'function') {
                // Modern v4.11+ factory standard
                chars = antlr.CharStreams.fromString(sourceText);
            } else if (typeof antlr.CharStream === 'function') {
                // Alternative variant class standard
                chars = new antlr.CharStream(sourceText);
            } else if (typeof antlr.InputStream === 'function') {
                // Legacy fallback standard
                chars = new antlr.InputStream(sourceText);
            } else {
                // Emergency fallback: If the export layer is locked down, use the core basic fallback string stream
                chars = new antlr.error.InputStream(sourceText);
            }
        } catch (e) {
            console.error("[Worker] Failed to instantiate ANTLR input stream wrapper:", e);
            return null;
        }

        try {
            // If the Lexer target contains our lightweight browser-safe normalizer, run it!
            if (LexerCtor.normalizeInputStream && typeof LexerCtor.normalizeInputStream === 'function') {
                chars = LexerCtor.normalizeInputStream(chars);
            } else if (LexerCtor.prototype && Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream) {
                // Check one step up the inheritance link if sitting on the parent base class
                chars = Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream(chars);
            }

            return new LexerCtor(chars);
        } catch (e) {
            console.error("[Worker] Failed to construct Lexer instance mapping:", e);
            return null;
        }
    }
}

/**
 * Message Routing Pipeline Interface
 */
/*
const onAnyMessage = async event => {
    const { id, data, responseId } = event.data;

    switch (id) {
        case 'constructor':
            // Establish runtime thread message channels
            port = event.data.data;
            port.onmessage = onAnyMessage;
            self.language = language = {
                lineToken: async (text, language, line) => await self.onmessage({ id: 'lineToken', data: { text, language, line } }),
                getAllTokens: async (text, language) => await self.onmessage({ id: 'lineToken', data: { text, language } })
            }

        case 'lineToken': {
            let output = null;
            try {
                // data payload maps: { text: "...", language: "cpp", line: 42 }
                output = TokenVisitor.getTokensForLine(data.text, data.language, data.line);
            } catch (e) {
                output = { error: e.toString(), stack: e.stack };
            } finally {
                port.postMessage({ id: 'runAsync', responseId, data: output });
            }
            break;
        }

        case 'tokens': {
            let output = null;
            try {
                // data payload maps: { text: "...", language: "javascript" }
                output = TokenVisitor.getAllTokens(data.text, data.language);
            } catch (e) {
                output = { error: e.toString(), stack: e.stack };
            } finally {
                port.postMessage({ id: 'runAsync', responseId, data: output });
            }
            break;
        }

        case 'folds': {
            let output = null;
            try {
                // data payload maps: { text: "...", language: "c" }
                output = TokenVisitor.getFoldRegions(data.text, data.language);
            } catch (e) {
                output = { error: e.toString(), stack: e.stack };
            } finally {
                port.postMessage({ id: 'runAsync', responseId, data: output });
            }
            break;
        }

        default:
            if (port) {
                port.postMessage({ id: 'done', responseId, data: true });
            }
            break;

    }
};

self.onmessage = onAnyMessage;
*/
