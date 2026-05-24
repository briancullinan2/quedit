const ROSETTA_RULE_MATRIX = {
    // =====================================================================
    // 1. SYSTEM BASE COMPILATION & TRANSLATION ROOTS (Clean Fallthroughs)
    // =====================================================================
    "compilationUnit": "text",
    "translationUnit": "text",
    "externalDeclaration": "text",

    // =====================================================================
    // 2. HARD STORAGE TYPES & MODIFIERS (.ace_storage .ace_type / .ace_modifier)
    // =====================================================================
    "typeSpecifier": "storage.type",              // void, char, int, long, float, double
    "typedefName": "storage.type",                // User custom-defined definitions
    "typeofSpecifier": "storage.type",
    "atomicTypeSpecifier": "storage.type",
    "enumSpecifier": "storage.type",
    "structOrUnionSpecifier": "storage.type",
    "structOrUnion": "storage.type",
    "vcSpecificModifer": "storage.type",          // __cdecl, __stdcall, __fastcall

    "storageClassSpecifier": "storage.modifier",  // static, register, auto, extern, typedef
    "typeQualifier": "storage.modifier",          // const, volatile, restrict, _Atomic
    "typeQualifierList": "storage.modifier",
    "alignmentSpecifier": "storage.modifier",     // Alignas
    "functionSpecifier": "storage.modifier",      // inline, _Noreturn
    "volatile_": "storage.modifier",

    // =====================================================================
    // 3. FUNCTION LABELS & SIGNATURES (.ace_entity .ace_name .ace_function)
    // =====================================================================
    "functionDefinition": "entity.name.function", // Function body entry
    "directDeclarator": "entity.name.function",   // Pinpoints signature declaration targets
    "methodDeclaration": "entity.name.function",
    "declarator": "entity.name.function",         // Catch-all fallthrough for function name resolution

    // High-decoration Specifier-to-Type Promotions
    "declarationSpecifiers": "storage.type",      // Paints entire type declaration blocks early
    "declarationSpecifier": "storage.type",
    "specifierQualifierList": "storage.type",
    "typeSpecifierQualifier": "storage.type",

    // Abstract Declarator structures (usually resolving to types inside cast blocks)
    "abstractDeclarator": "storage.type",
    "directAbstractDeclarator": "storage.type",
    "gccDeclaratorExtension": "storage.modifier",
    "initDeclaratorList": "text",
    "initDeclarator": "text",
    "pointer": "keyword.operator",                // Hyper-decoration: Forces asterisks (*) to paint as operators
    "functionBody": "text",

    // =====================================================================
    // 4. CORE FLOW CONTROL STATEMENTS (.ace_keyword .ace_control)
    // =====================================================================
    "selectionStatement": "keyword.control",      // if, else, switch
    "iterationStatement": "keyword.control",      // while, do, for
    "jumpStatement": "keyword.control",           // goto, continue, break, return
    "labeledStatement": "keyword.control",         // case, default
    "staticAssertDeclaration": "keyword.control", // _Static_assert
    "genericSelection": "keyword.control",        // _Generic

    // Fallback structural statement scopes
    "statement": "text",
    "compoundStatement": "text",
    "blockItemList": "text",
    "blockItem": "text",
    "expressionStatement": "text",
    "forCondition": "keyword.control",            // Highlights loop logic roots
    "forDeclaration": "text",
    "forExpression": "text",

    // =====================================================================
    // 5. VALUE CONSTANTS & LITERALS (.ace_constant .ace_numeric / .ace_language)
    // =====================================================================
    "constant": "constant.numeric",
    "predefinedConstant": "constant.language",    // true, false, nullptr
    "enumerationConstant": "variable.other.enum", // Painted explicitly apart from standard variables
    "enumerator": "variable.other.enum",

    "enumeratorList": "text",
    "initializer": "constant.numeric",            // Enforces right-hand assignment value glows
    "initializerList": "text",

    // =====================================================================
    // 6. EXPRESSIONS & OPERATOR WRAPPERS (.ace_keyword .ace_operator)
    // =====================================================================
    "expression": "text",
    "assignmentExpression": "keyword.operator",   // Captures compound operational zones safely
    "conditionalExpression": "keyword.operator",
    "constantExpression": "constant.numeric",
    "logicalOrExpression": "keyword.operator",
    "logicalAndExpression": "keyword.operator",
    "inclusiveOrExpression": "keyword.operator",
    "exclusiveOrExpression": "keyword.operator",
    "andExpression": "keyword.operator",
    "equalityExpression": "keyword.operator",
    "relationalExpression": "keyword.operator",
    "shiftExpression": "keyword.operator",
    "additiveExpression": "keyword.operator",
    "multiplicativeExpression": "keyword.operator",
    "castExpression": "storage.type",             // Treats variable type coercion blocks explicitly
    "unaryExpression": "keyword.operator",
    "postfixExpression": "text",
    "primaryExpression": "text",
    "exprList": "text",
    "argumentExpressionList": "variable.parameter", // Hyper-decoration: Colors function arguments distinctively
    "genericAssocList": "text",
    "genericAssociation": "text",

    // =====================================================================
    // 7. PARAMETERS & SIGNATURE ARGUMENTS (.ace_variable)
    // =====================================================================
    "parameterTypeList": "text",
    "parameterList": "variable.parameter",         // Colors function argument inputs in signature definitions
    "parameterDeclaration": "variable.parameter",  // Pinpoints standalone typed configuration params
    "identifierList": "variable.other",            // Forces fallbacks straight to recognizable variables

    // =====================================================================
    // 8. ATTRIBUTES & DIRECTIVES (.ace_meta .ace_tag)
    // =====================================================================
    "attributeDeclaration": "meta.tag",
    "attributeSpecifierSequence": "meta.tag",
    "attributeSpecifier": "meta.tag",            // [[attributes]]
    "attributeList": "meta.tag",
    "attribute": "meta.tag",
    "attributeToken": "meta.tag",
    "attributeArgumentClause": "meta.tag",
    "balancedTokenSequence": "text",
    "balancedToken": "text",

    // =====================================================================
    // 9. GNU PARSER EXTENSIONS & ASSEMBLER INLINES
    // =====================================================================
    "gnuArrayDesignator": "meta.tag",
    "gnuAttribute": "meta.tag",                   // __attribute__
    "gnuAttributeList": "meta.tag",
    "gnuAttributes": "meta.tag",
    "gnuSingleAttribute": "meta.tag",
    "asmStringLiteral": "string",
    "asmStatement": "keyword",                    // asm, __asm__ blocks
    "asmDefinition": "keyword",
    "asm_": "keyword",
    "asmQualifier": "keyword.control",
    "asmQualifierList": "keyword.control",
    "designation": "meta.tag",
    "designatorList": "meta.tag",
    "designator": "meta.tag",
    "gnuIdentifier": "variable.other",
    "asmArgument": "variable.other",
    "asmOperand": "variable.other",
    "asmOperands": "text",
    "asmClobbers": "text",
    "toplevelAsmArgument": "text",
    "simpleAsmExpr": "text"
};



function toRosettaToken(symbolicName, ruleName, lexer, parser, ctxOrToken, tokenStream) {
    // =====================================================================
    // 1. POLYMORPHIC ARGUMENT RESOLUTION (CRITICAL SAFETY COUPLING)
    // =====================================================================
    let typeInt = null;
    let literalText = "";
    let contextNode = null;
    let tokenChannel = 0; // Default channel (0 = code, 1 = hidden/comments)

    if (ctxOrToken) {
        // Capture context node safely for upstream AST tree walking
        contextNode = ctxOrToken.start ? ctxOrToken : (ctxOrToken.parent || null);

        if (typeof ctxOrToken.type === 'number') {
            typeInt = ctxOrToken.type;
            literalText = ctxOrToken.text || "";
            if (typeof ctxOrToken.channel === 'number') tokenChannel = ctxOrToken.channel;
        } else if (ctxOrToken.symbol && typeof ctxOrToken.symbol.type === 'number') {
            typeInt = ctxOrToken.symbol.type;
            literalText = ctxOrToken.symbol.text || "";
            if (typeof ctxOrToken.symbol.channel === 'number') tokenChannel = ctxOrToken.symbol.channel;
        } else if (ctxOrToken.start) {
            typeInt = ctxOrToken.start.type;
            literalText = ctxOrToken.start.text || "";
            if (typeof ctxOrToken.start.channel === 'number') tokenChannel = ctxOrToken.start.channel;
        }
    }

    if (typeInt === null && ctxOrToken && ctxOrToken.start && tokenStream && tokenStream.tokens) {
        const fallbackToken = tokenStream.tokens[ctxOrToken.start.tokenIndex];
        if (fallbackToken) {
            typeInt = fallbackToken.type;
            literalText = fallbackToken.text || "";
            if (typeof fallbackToken.channel === 'number') tokenChannel = fallbackToken.channel;
        }
    }

    const lexerCtor = lexer ? lexer.constructor : null;
    const lexerSymbolicName = (typeInt !== null && lexerCtor && lexerCtor.symbolicNames) ? lexerCtor.symbolicNames[typeInt] || "" : "";
    const lexerLiteralName = (typeInt !== null && lexerCtor && lexerCtor.literalNames) ? lexerCtor.literalNames[typeInt] || "" : "";

    symbolicName ||= lexerSymbolicName;

    // Helper utility to resolve active string tokens safely
    let baseClassification = "text";
    if (symbolicName && symbolicName.includes('.')) {
        baseClassification = symbolicName;
    }

    const lowerSymbol = lexerSymbolicName.toLowerCase();
    const lowerLiteral = literalText.toLowerCase();

    // =====================================================================
    // ELITE INTERCEPTOR: HIGHEST PRIORITY PREPROCESSOR DIRECTIVE SCANNER
    // =====================================================================
    if (
        lowerSymbol.includes('directive') ||
        lowerSymbol.includes('preproc') ||
        lowerLiteral.startsWith('#include') ||
        symbolicName === 'Directive'
    ) {
        // Build the mega descriptive target scope block
        baseClassification = "keyword.control.c_include.c_lang.c_reserved.has_precompiler";

        // Pull the filename right out of the brackets or strings safely
        const includeMatch = literalText.match(/#include\s*["<]([^">]+)[">]/);
        if (includeMatch && includeMatch[1]) {
            const targetHeader = includeMatch[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            baseClassification += `.import_target.header_${targetHeader}`;

            // Simulating a true dynamic workspace check: default missing check 
            // since you haven't wired up file system lookups for this header yet!
            const missingHeaders = (typeof window !== 'undefined' && window.__missingHeaders) ? window.__missingHeaders : null;
            if (!missingHeaders || !missingHeaders.has(includeMatch[1].trim())) {
                baseClassification += ".err_notfound.status_missing.annotation_required";
            } else {
                baseClassification += ".status_resolved";
            }
        } else {
            baseClassification += ".err_malformed_directive";
        }

        // Fast-path return: Bypass all punctuation/operator overrides completely!
        return assembleFinalMegaScope(baseClassification, lexerSymbolicName, ruleName, tokenChannel, typeInt, symbolicName);
    }

    // =====================================================================
    // STEP A: Map Structural Braces, Parentheses, and Punctuation 
    // =====================================================================
    if (['{', '('].includes(literalText)) baseClassification = "paren.lparen";
    else if (['}', ')'].includes(literalText)) baseClassification = "paren.rparen";
    else if ([',', ';', '.'].includes(literalText)) baseClassification = "punctuation.operator";
    else if (
        lexerLiteralName.startsWith("'") &&
        lexerLiteralName.endsWith("'") &&
        lexerLiteralName.length <= 5 && // Prevent keywords from tripping this macro check
        !["'int'", "'return'"].includes(lexerLiteralName.toLowerCase())
    ) {
        baseClassification = "keyword.operator";
    }
    else {
        // =====================================================================
        // STEP C: ADVANCED DECORATIVE TOKEN-BY-TOKEN MATCHING
        // =====================================================================
        const lowerSymbol = lexerSymbolicName.toLowerCase();
        const lowerLiteral = literalText.toLowerCase();

        if (lowerSymbol.includes('comment')) {
            baseClassification = "comment";
        } else if (lowerSymbol.includes('string')) {
            baseClassification = "string";
        }
        // ─── INSERT DIRECTIVE DETECTOR & DECORATOR AT THE TOP OF STEP C ───
        else if (lowerSymbol.includes('directive') || lowerLiteral.startsWith('#include') || lowerSymbol.includes('preproc')) {
            // Base Ace scope grouping for preprocessor entities
            baseClassification = "keyword.control.c_include.c_lang.c_reserved.has_precompiler";

            // Dynamic compiler asset resolve inspection:
            // Extract file string format from target text block (e.g. "stdio.h")
            const includeMatch = literalText.match(/#include\s*["<]([^">]+)[">]/);
            if (includeMatch && includeMatch[1]) {
                const targetHeader = includeMatch[1].trim();

                // Check if our file index map or preprocess loop threw a dependency lock
                // If the global workspace or token streams mark it missing, append error state flags
                if (typeof window !== 'undefined' && window.__missingHeaders && window.__missingHeaders.has(targetHeader)) {
                    baseClassification += ".err_notfound";
                }
            }
        }
        // 1. STORAGE MODIFIERS
        else if (
            ["static", "register", "auto", "extern", "typedef", "const", "volatile", "restrict", "inline", "_noreturn", "__cdecl", "__stdcall", "__fastcall"].includes(lowerLiteral) ||
            lowerSymbol.includes('storageclassspecifier') ||
            lowerSymbol.includes('typequalifier')
        ) {
            baseClassification = "storage.modifier";
        }
        // 2. HARD PRIMITIVES & TYPES
        else if (
            ["void", "char", "int", "float", "double", "bool", "long", "short", "signed", "unsigned", "size_t", "ssize_t", "intptr_t", "uintptr_t"].includes(lowerLiteral) ||
            lowerSymbol.includes('typespecifier') ||
            lowerSymbol === 'type_name' ||
            lexerSymbolicName === "Int"
        ) {
            baseClassification = "storage.type";
        }
        // 3. FLOW CONTROL KEYWORDS
        else if (
            ["if", "else", "switch", "while", "do", "for", "goto", "continue", "break", "return", "case", "default"].includes(lowerLiteral) ||
            lowerSymbol.includes('statement') ||
            lowerSymbol.includes('assert')
        ) {
            baseClassification = "keyword.control";
        }
        // 4. OTHER CORE LANGUAGE KEYWORDS
        else if (["struct", "union", "enum", "sizeof", "typeof", "alignof", "alignas", "asm", "__asm__"].includes(lowerLiteral)) {
            baseClassification = "keyword";
        }
        // 5. NUMERIC CONSTANTS
        else if (lowerSymbol.includes('constant') || lowerSymbol.includes('numeric') || lowerSymbol.includes('integer')) {
            baseClassification = "constant.numeric";
        }
        // 6. COMPLEX & WORD OPERATORS
        else if (
            lowerSymbol.includes('assign') ||
            lowerSymbol.includes('equal') ||
            lowerSymbol.includes('arrow') ||
            ["<=", ">=", "==", "!=", "&&", "||", "++", "--", "->", "+=", "-=", "*=", "/="].includes(literalText)
        ) {
            baseClassification = "keyword.operator";
        }
        // 7. INTELLIGENT IDENTIFIER & VARIABLE CONTEXT SIFTING
        else if (lowerSymbol === 'identifier' || ruleName === 'identifier') {
            baseClassification = "variable.other";

            // ─── ADD FUNCTION CALL LOOK-AHEAD ───
            // If we have a valid tokenStream and ctxOrToken is a token, check if the next token is an invocation paren '('
            if (tokenStream && tokenStream.tokens && ctxOrToken && typeof ctxOrToken.tokenIndex === 'number') {
                const nextToken = tokenStream.tokens[ctxOrToken.tokenIndex + 1];
                if (nextToken && nextToken.text === '(') {
                    baseClassification = "support.function";
                }
            }

            let current = contextNode;
            let foundMatch = baseClassification === "support.function"; // Prevent over-writing call site if found

            while (current && !foundMatch) {
                const currentRule = current.ruleName || (current.constructor ? current.constructor.name : "");
                const ruleStr = typeof currentRule === 'string' ? currentRule : "";

                if (ruleStr.includes("directDeclarator") || ruleStr.includes("functionDefinition") || ruleName === 'directDeclarator') {
                    baseClassification = "entity.name.function";
                    foundMatch = true;
                }
                else if (ruleStr.includes("postfixExpression") && (literalText === '.' || literalText === '->')) {
                    baseClassification = "variable.other.member";
                    foundMatch = true;
                }
                else if (ruleStr.includes("initDeclarator") || ruleStr.includes("parameterDeclaration") || ruleStr.includes("declarator")) {
                    baseClassification = "variable.parameter";
                    foundMatch = true;
                }
                current = current.parent;
            }

            if (!foundMatch && baseClassification === "text") {
                baseClassification = "variable.other";
            }
        }
        // =====================================================================
        // STEP B: Fallback Matrix Checking
        // =====================================================================
        else if (ruleName && ROSETTA_RULE_MATRIX[ruleName] && ROSETTA_RULE_MATRIX[ruleName] !== "text") {
            baseClassification = ROSETTA_RULE_MATRIX[ruleName];
        }
    }

    let rootScope = baseClassification.split('.')[0];
    if (rootScope === "text" || !rootScope) {
        baseClassification = "text" + (baseClassification.includes('.') ? baseClassification.substring(baseClassification.indexOf('.')) : '');
    }

    
    let cleanBase = baseClassification || "text";

    // Deconstruct and filter out any accidental concatenated 'type_' or string prefixes
    cleanBase = cleanBase
        .replace(/^type_text/, "text")
        .replace(/^type_keyword/, "keyword")
        .replace(/^type_comment/, "comment")
        .replace(/^type_storage/, "storage")
        .replace(/^type_support/, "support")
        .replace(/^type_constant/, "constant");

    const structuralParts = [cleanBase];

    // 2. Safely append metadata layers
    if (lexerSymbolicName && lexerSymbolicName !== "Text") {
        structuralParts.push(`lex_${lexerSymbolicName.toLowerCase()}`);
    }

    if (ruleName && ruleName !== "text") {
        structuralParts.push(`rule_${ruleName}`);
    }

    if (tokenChannel !== 0) {
        structuralParts.push(`chan_${tokenChannel}`);
    }

    if (typeInt !== null && !isNaN(typeInt)) {
        structuralParts.push(`idx_${typeInt}`);
    }

    // 3. Keep the raw grammar identifier clean and separate from the long string parameters
    const rawFallbackName = lexerSymbolicName || (symbolicName && !symbolicName.includes('.') ? symbolicName : 'symbol');
    const sanitizedRaw = rawFallbackName.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (sanitizedRaw && sanitizedRaw !== "text" && !sanitizedRaw.startsWith('keyword')) {
        structuralParts.push(`raw_${sanitizedRaw}`);
    }

    // Return the pristine, dot-separated mega-class string
    return structuralParts.join('.');
}

function assembleFinalMegaScope(baseClassification, lexerSymbolicName, ruleName, tokenChannel, typeInt, symbolicName) {
    const structuralParts = [baseClassification];

    if (lexerSymbolicName && lexerSymbolicName !== "Text") {
        structuralParts.push(`lex_${lexerSymbolicName.toLowerCase()}`);
    }

    if (ruleName && ruleName !== "text") {
        structuralParts.push(`rule_${ruleName}`);
    }

    if (tokenChannel !== 0) {
        structuralParts.push(`chan_${tokenChannel}`);
    }

    if (typeInt !== null && !isNaN(typeInt)) {
        structuralParts.push(`idx_${typeInt}`);
    }

    const sanitizedRaw = (symbolicName || 'symbol').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (sanitizedRaw && sanitizedRaw !== "text") {
        structuralParts.push(`raw_${sanitizedRaw}`);
    }

    return structuralParts.join('.');
}

function _resolveTokenTypeName(lexer, tokenType) {
    const Ctor = lexer.constructor;
    const symbolicNames = Ctor.symbolicNames || lexer.symbolicNames;
    const literalNames = Ctor.literalNames || lexer.literalNames;

    if (symbolicNames && symbolicNames[tokenType]) return symbolicNames[tokenType];
    if (literalNames && literalNames[tokenType]) return literalNames[tokenType];
    return `type_${tokenType}`;
}

/**
 * Builds the comprehensive token payload combined with verified grammar metadata
 */
function _buildTokenPayload(token, rawTypeName, classification, lowerType, lexer, parser, ctx) {
    const isComment = lowerType.includes('comment') || token.channel === 1;
    const isString = lowerType.includes('string') || lowerType.includes('literal') || classification.startsWith('string');

    const lexerCtor = lexer ? lexer.constructor : null;
    const tokenType = token.type;
    const ruleIndex = ctx ? ctx.ruleIndex : null;

    const trueLexerRuleName = (lexerCtor && lexerCtor.symbolicNames) ? lexerCtor.symbolicNames[tokenType] : "Text";

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
        rosettaScope: classification,

        // =====================================================================
        // UNIFIED COMPATIBILITY MATRIX DATA (ANTLR Grammar Blueprint)
        // =====================================================================
        tokenIndex: tokenType,
        tokenMode: (lexer && lexerCtor.modeNames) ? lexerCtor.modeNames[lexer._mode] : "default",
        tokenNames: (lexerCtor && lexerCtor.literalNames) ? lexerCtor.literalNames[tokenType] : null,
        tokenSymbol: (lexerCtor && lexerCtor.symbolicNames) ? lexerCtor.symbolicNames[tokenType] : null,
        tokenRule: trueLexerRuleName,

        symbolIndex: ruleIndex,
        symbolicName: (parser && ruleIndex !== null) ? parser.symbolicNames[ruleIndex] : null,
        literalName: (parser && ruleIndex !== null) ? parser.literalNames[ruleIndex] : null,
        ruleName: (parser && ruleIndex !== null) ? parser.ruleNames[ruleIndex] : null
    };
}