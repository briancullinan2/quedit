const ROSETTA_RULE_MATRIX = {
    // =====================================================================
    // 1. SYSTEM BASE COMPILATION & TRANSLATION ROOTS (Fallthrough to text)
    // =====================================================================
    "compilationUnit": "text",
    "translationUnit": "text",
    "externalDeclaration": "text",

    // =====================================================================
    // 2. HARD STORAGE TYPES & MODIFIERS (.ace_storage .ace_type)
    // =====================================================================
    "typeSpecifier": "storage.type",              // void, char, int, long, float, double
    "typedefName": "storage.type",                // Validated user custom defined types
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

    // =====================================================================
    // 3. FUNCTION LABELS & SYMBOL OVERRIDES (.ace_entity .ace_name .ace_function)
    // =====================================================================
    "functionDefinition": "entity.name.function", // Triggers target function entry labeling
    "directDeclarator": "entity.name.function",   // Pinpoints signature declaration targets
    "methodDeclaration": "entity.name.function",

    // Explicit Fallthroughs: Prevent structural wrappers from clobbering inner variables
    "declarationSpecifiers": "text",
    "declarationSpecifier": "text",
    "specifierQualifierList": "text",
    "typeSpecifierQualifier": "text",
    "declarator": "text",
    "abstractDeclarator": "text",
    "directAbstractDeclarator": "text",
    "gccDeclaratorExtension": "text",
    "initDeclaratorList": "text",
    "initDeclarator": "text",
    "pointer": "text",
    "functionBody": "text",

    // =====================================================================
    // 4. CORE FLOW CONTROL STATEMENTS (.ace_keyword .ace_control)
    // =====================================================================
    "selectionStatement": "keyword.control",      // if, else, switch
    "iterationStatement": "keyword.control",      // while, do, for
    "jumpStatement": "keyword.control",           // goto, continue, break, return
    "labeledStatement": "keyword.control",        // case, default
    "staticAssertDeclaration": "keyword.control", // _Static_assert

    // Core structural statements must pass through to allow tokens to paint naturally
    "statement": "text",
    "compoundStatement": "text",
    "blockItemList": "text",
    "blockItem": "text",
    "expressionStatement": "text",
    "forCondition": "text",
    "forDeclaration": "text",
    "forExpression": "text",

    // =====================================================================
    // 5. VALUE CONSTANTS & LITERALS (.ace_constant)
    // =====================================================================
    "constant": "constant.numeric",
    "predefinedConstant": "constant.language",    // true, false, nullptr
    "enumerationConstant": "variable.other",
    "enumerator": "variable.other",

    "enumeratorList": "text",
    "initializer": "text",
    "initializerList": "text",

    // =====================================================================
    // 6. EXPRESSIONS & OPERATORS (Fallthrough to preserve .ace_keyword.operator)
    // =====================================================================
    "expression": "text",
    "assignmentExpression": "text",
    "conditionalExpression": "text",
    "constantExpression": "text",
    "logicalOrExpression": "text",
    "logicalAndExpression": "text",
    "inclusiveOrExpression": "text",
    "exclusiveOrExpression": "text",
    "andExpression": "text",
    "equalityExpression": "text",
    "relationalExpression": "text",
    "shiftExpression": "text",
    "additiveExpression": "text",
    "multiplicativeExpression": "text",
    "castExpression": "text",
    "unaryExpression": "text",
    "postfixExpression": "text",
    "primaryExpression": "text",
    "exprList": "text",
    "argumentExpressionList": "text",
    "genericAssocList": "text",
    "genericAssociation": "text",
    "genericSelection": "keyword.control",        // _Generic

    // =====================================================================
    // 7. PARAMETERS & SIGNATURE ARGUMENTS (Fallthrough to preserve raw fields)
    // =====================================================================
    "parameterTypeList": "text",
    "parameterList": "text",
    "parameterDeclaration": "text",              // Let fallback label parameters as identifiers
    "identifierList": "text",

    // =====================================================================
    // 8. ATRIBUTES & DIRECTIVES (.ace_meta .ace_tag)
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
    "gnuIdentifier": "text",
    "asmArgument": "text",
    "asmOperand": "text",
    "asmOperands": "text",
    "asmClobbers": "text",
    "toplevelAsmArgument": "text",
    "simpleAsmExpr": "text",
    "volatile_": "storage.modifier"
};

function toRosettaToken(symbolicName, ruleName, lexer, parser, ctxOrToken, tokenStream) {
    // =====================================================================
    // 1. POLYMORPHIC ARGUMENT RESOLUTION (CRITICAL SAFETY COUPLING)
    // =====================================================================
    let typeInt = null;
    let literalText = "";

    if (ctxOrToken) {
        if (typeof ctxOrToken.type === 'number') {
            // It's a localized Token object (worker-antlr.js / line 168)
            typeInt = ctxOrToken.type;
            literalText = ctxOrToken.text || "";
        } else if (ctxOrToken.symbol && typeof ctxOrToken.symbol.type === 'number') {
            // It's a Terminal Leaf Node from the walker
            typeInt = ctxOrToken.symbol.type;
            literalText = ctxOrToken.symbol.text || "";
        } else if (ctxOrToken.start) {
            // It's a multi-token ParserRuleContext branch layout
            typeInt = ctxOrToken.start.type;
            literalText = ctxOrToken.start.text || "";
        }
    }

    // Fallback: If tokenStream was provided and we have a valid context index, ensure indices align
    if (typeInt === null && ctxOrToken && ctxOrToken.start && tokenStream && tokenStream.tokens) {
        const fallbackToken = tokenStream.tokens[ctxOrToken.start.tokenIndex];
        if (fallbackToken) {
            typeInt = fallbackToken.type;
            literalText = fallbackToken.text || "";
        }
    }

    // Resolve static constructor array naming definitions safely
    const lexerSymbolicName = (typeInt !== null && lexer && lexer.constructor.symbolicNames) ? lexer.constructor.symbolicNames[typeInt] || "" : "";
    const lexerLiteralName = (typeInt !== null && lexer && lexer.constructor.literalNames) ? lexer.constructor.literalNames[typeInt] || "" : "";
    
    // Assign structural fallback naming target tracking
    symbolicName ||= lexerSymbolicName;

    // =====================================================================
    // STEP A: Map Structural Braces, Parentheses, and Punctuation 
    // =====================================================================
    if (['{', '('].includes(literalText)) return "paren.lparen";
    if (['}', ')'].includes(literalText)) return "paren.rparen";
    if ([',', ';', '.'].includes(literalText)) return "punctuation.operator";

    // Explicit check for lexer operator syntax string symbols (e.g. "'+'", "'='")
    if (lexerLiteralName.startsWith("'") && lexerLiteralName.endsWith("'")) {
        return "keyword.operator";
    }

    // =====================================================================
    // STEP B: Process Core Data Types & Structural Configurations
    // =====================================================================
    // Prioritize Matrix rules if they aren't configured to fall back to generic text
    if (ruleName && ROSETTA_RULE_MATRIX[ruleName] && ROSETTA_RULE_MATRIX[ruleName] !== "text") {
        return ROSETTA_RULE_MATRIX[ruleName];
    }

    // =====================================================================
    // STEP C: Lexer Token-by-Token Match via Array Definitions
    // =====================================================================
    const lowerSymbol = lexerSymbolicName.toLowerCase();

    if (lowerSymbol.includes('comment')) return "comment";
    if (lowerSymbol.includes('string')) return "string";
    if (lowerSymbol.includes('constant') || lowerSymbol.includes('numeric') || lowerSymbol === 'int' || lowerSymbol.includes('integer')) {
        // Force the keyword 'int' inside a specifier to flag as a type element
        if (lexerSymbolicName === "Int" && ruleName === "typeSpecifier") {
            return "storage.type"; 
        }
        return "constant.numeric";
    }

    // Match control block language structures
    if (["Return", "If", "Else", "While", "For"].includes(lexerSymbolicName) || ["return", "if", "else", "while", "for"].includes(literalText)) {
        return "keyword";
    }

    if (lowerSymbol === 'identifier') {
        // Context-aware identifier mapping
        if (ruleName === 'directDeclarator') return "entity.name.function"; // e.g. "main"
        return "identifier";
    }

    // Ultimate fallback match rule
    return "text";
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