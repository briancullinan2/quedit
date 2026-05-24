const ROSETTA_RULE_MATRIX = {
    // =====================================================================
    // 1. SYSTEM BASE COMPILATION & TRANSLATION ROOTS (Clean Fallthroughs)
    // =====================================================================
    "compilationUnit": "text",
    "translationUnit": "text",
    "externalDeclaration": "text",

    // =====================================================================
    // 2. HARD STORAGE TYPES & MODIFIERS (.ace_storage / .ace_type)
    // =====================================================================
    "typeSpecifier": "storage.type",               // void, char, int, long, float, double
    "typedefName": "storage.type",                 // User custom-defined definitions
    "typeofSpecifier": "storage.type",
    "typeofSpecifierArgument": "storage.type",
    "atomicTypeSpecifier": "storage.type",
    "enumSpecifier": "storage.type",
    "enumTypeSpecifier": "storage.type",
    "structOrUnionSpecifier": "storage.type",
    "structOrUnion": "storage.type",
    "vcSpecificModifer": "storage.type",           // __cdecl, __stdcall, __fastcall
    "typeName": "storage.type",

    "storageClassSpecifier": "storage",            // static, register, auto, extern, typedef
    "typeQualifier": "storage",                    // const, volatile, restrict, _Atomic
    "typeQualifierList": "storage",
    "alignmentSpecifier": "storage",               // Alignas
    "functionSpecifier": "storage",                // inline, _Noreturn
    "volatile_": "storage",

    // =====================================================================
    // 3. FUNCTION LABELS & SIGNATURES (.ace_function)
    // =====================================================================
    "functionDefinition": "function",              // Function body entry
    "directDeclarator": "function",                // Pinpoints signature declaration targets
    "methodDeclaration": "function",
    "declarator": "function",                      // Catch-all fallthrough for function name resolution

    // High-decoration Specifier-to-Type Promotions
    "declarationSpecifiers": "storage.type",       // Paints entire type declaration blocks early
    "declarationSpecifier": "storage.type",
    "specifierQualifierList": "storage.type",
    "typeSpecifierQualifier": "storage.type",

    // Abstract Declarator structures (resolving to types inside cast blocks)
    "abstractDeclarator": "storage.type",
    "directAbstractDeclarator": "storage.type",
    "gccDeclaratorExtension": "storage",
    "initDeclaratorList": "text",
    "initDeclarator": "text",
    "pointer": "keyword.operator",                 // Forces asterisks (*) to paint as operators
    "functionBody": "text",
    "declarationList": "text",

    // =====================================================================
    // 4. CORE CONTROL FLOW STATEMENTS (.ace_keyword .ace_control)
    // =====================================================================
    "selectionStatement": "keyword.control",       // if, else, switch
    "iterationStatement": "keyword.control",       // while, do, for
    "jumpStatement": "keyword.control",            // goto, continue, break, return
    "labeledStatement": "keyword.control",         // case, default
    "staticAssertDeclaration": "keyword.control",  // _Static_assert
    "genericSelection": "keyword.control",         // _Generic

    // Fallback structural statement scopes
    "statement": "text",
    "compoundStatement": "text",
    "blockItemList": "text",
    "blockItem": "text",
    "expressionStatement": "text",
    "forCondition": "keyword.control",             // Highlights loop logic roots
    "forDeclaration": "text",
    "forExpression": "text",

    // =====================================================================
    // 5. VALUE CONSTANTS & LITERALS (.ace_constant .ace_numeric / .ace_library)
    // =====================================================================
    "constant": "constant.numeric",
    "predefinedConstant": "constant.buildin",      // true, false, nullptr -> ace_constant ace_buildin
    "enumerationConstant": "constant.library",     // Enums map directly to library green styles
    "enumerator": "constant.library",
    "enumeratorList": "text",
    "initializer": "constant.numeric",             // Enforces right-hand assignment value glows
    "initializerList": "text",

    // =====================================================================
    // 6. EXPRESSIONS & OPERATOR WRAPPERS (.ace_keyword .ace_operator)
    // =====================================================================
    "expression": "text",
    "assignmentExpression": "keyword.operator",    // Captures compound operational zones safely
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
    "castExpression": "storage.type",              // Treats variable type coercion blocks explicitly
    "unaryExpression": "keyword.operator",
    "postfixExpression": "text",
    "primaryExpression": "text",
    "exprList": "text",
    "argumentExpressionList": "variable",          // Maps function inputs directly to eclipse purple variable
    "genericAssocList": "text",
    "genericAssociation": "text",

    // =====================================================================
    // 7. PARAMETERS & SIGNATURE ARGUMENTS (.ace_variable)
    // =====================================================================
    "parameterTypeList": "text",
    "parameterList": "variable",                   // Colors function argument inputs in signature definitions
    "parameterDeclaration": "variable",            // Pinpoints standalone typed configuration params
    "identifierList": "variable",                  // Forces fallbacks straight to recognizable variables

    // =====================================================================
    // 8. ATTRIBUTES & DIRECTIVES (.ace_tag / .ace_meta)
    // =====================================================================
    "attributeDeclaration": "meta.tag",
    "attributeSpecifierSequence": "meta.tag",
    "attributeSpecifier": "meta.tag",              // [[attributes]]
    "attributeList": "meta.tag",
    "attribute": "meta.tag",
    "attributeToken": "meta.tag",
    "attributeArgumentClause": "meta.tag",
    "balancedTokenSequence": "text",
    "balancedToken": "text",

    // =====================================================================
    // 9. GNU PARSER EXTENSIONS & ASSEMBLER INLINES (.ace_tag / .ace_keyword)
    // =====================================================================
    "gnuArrayDesignator": "meta.tag",
    "gnuAttribute": "meta.tag",                    // __attribute__
    "gnuAttributeList": "meta.tag",
    "gnuAttributes": "meta.tag",
    "gnuSingleAttribute": "meta.tag",
    "asmStringLiteral": "string",
    "asmStatement": "keyword",                     // asm, __asm__ blocks
    "asmDefinition": "keyword",
    "asm_": "keyword",
    "asmQualifier": "keyword.control",
    "asmQualifierList": "keyword.control",
    "designation": "meta.tag",
    "designatorList": "meta.tag",
    "designator": "meta.tag",
    "gnuIdentifier": "variable",
    "asmArgument": "variable",
    "asmOperand": "variable",
    "asmOperands": "text",
    "asmClobbers": "text",
    "toplevelAsmArgument": "text",
    "simpleAsmExpr": "text",


    // =====================================================================
    // 10. JAVASCRIPT OBJECT NOTATION (JSON) GRAMMAR MAPPING CORRELATION
    // =====================================================================
    "json": "text",                                // Base payload root -> ace_text
    "obj": "compoundStatement",                    // '{...}' acts like brace scopes -> ace_text (Structural wrapper)
    "pair": "assignmentExpression",                // "key": value tracks like operations -> ace_keyword ace_operator
    "arr": "initializerList",                      // [...] mirrors literal matrices -> ace_text
    "value": "primaryExpression",                  // Evaluates to structural data atoms -> ace_text
    "STRING": "string",                            // Encapsulated text data -> ace_string
    "NUMBER": "constant.numeric",                   // Signed decimal/exponential points -> ace_constant ace_numeric
    "jsonKey": "variable",
    "jsonValue": "string",
    "ws": "text",                                  // Maps 'WS' tokens directly to native ace_text
    "type_text": "text",
};
const GRAMMAR_CLASSIFIER_MATRIX = {

    // =====================================================================
    // 1. COMPILATION UNIT ROOTS & GLOBAL TRANSLATION ENGINES
    // =====================================================================
    "compilationUnit": "ast.root.compilation_unit.entry",
    "translationUnit": "ast.scope.translation_unit.global",
    "externalDeclaration": "ast.declaration.external_scope.wrapper",

    // =====================================================================
    // 2. DATA CONSTANTS, LITERALS & ENUMERATIVE LEAVES
    // =====================================================================
    "constant": "literal.numeric_or_char.evaluation.leaf",
    "predefinedConstant": "literal.boolean_or_null.state.leaf",
    "enumerationConstant": "symbol.identifier.enum_member.reference",
    "enumerator": "declaration.enum_member.allocation",
    "enumeratorList": "collection.enum_members.sequence",

    // =====================================================================
    // 3. EXPRESSION TREES, OPERATORS, & EVALUATION LOOPS
    // =====================================================================
    "primaryExpression": "expression.terminal.atom.evaluator",
    "exprList": "collection.expressions.arguments.sequence",
    "genericSelection": "expression.conditional.static_compile_time.switch",
    "genericAssocList": "collection.generic_associations.sequence",
    "genericAssociation": "expression.branch.generic_match.case",
    "postfixExpression": "expression.evaluator.postfix.root",
    "argumentExpressionList": "collection.expressions.function_call_inputs.sequence",
    "unaryExpression": "expression.evaluator.unary.root",
    "castExpression": "expression.coercion.type_cast.root",
    "multiplicativeExpression": "expression.algebraic.mathematical.multiplication_level",
    "additiveExpression": "expression.algebraic.mathematical.addition_level",
    "shiftExpression": "expression.bitwise.shift.operations",
    "relationalExpression": "expression.logical.comparison.relational",
    "equalityExpression": "expression.logical.comparison.equality",
    "andExpression": "expression.bitwise.conjunction.and",
    "exclusiveOrExpression": "expression.bitwise.disjunction.xor",
    "inclusiveOrExpression": "expression.bitwise.disjunction.or",
    "logicalAndExpression": "expression.logical.short_circuit.conjunction",
    "logicalOrExpression": "expression.logical.short_circuit.disjunction",
    "conditionalExpression": "expression.conditional.ternary.evaluation",
    "assignmentExpression": "expression.mutation.assignment.evaluator",
    "expression": "expression.sequence.comma_delimited.root",
    "constantExpression": "expression.static.compile_time.evaluator",

    // =====================================================================
    // 4. STORAGE SPECS, DECLARATION SPECIFIERS & MODIFIERS
    // =====================================================================
    "declaration": "statement.declaration.variable_or_type.root",
    "declarationSpecifiers": "collection.type_and_storage_modifiers.sequence",
    "declarationSpecifier": "modifier.storage_or_type.qualifier.wrapper",
    "initDeclaratorList": "collection.variable_initializers.sequence",
    "initDeclarator": "declaration.variable.instance_allocator",
    "storageClassSpecifier": "modifier.linkage_and_scope.storage_class",
    "typeSpecifier": "type.descriptor.primitive_or_composite.identity",
    "typeQualifier": "modifier.mutability_and_visibility.qualifier",
    "functionSpecifier": "modifier.function_behavior.optimization_hint",
    "alignmentSpecifier": "modifier.memory_layout.alignment_boundary",
    "typeQualifierList": "collection.type_qualifiers.sequence",

    // =====================================================================
    // 5. COMPOSITE STRUCTURES, UNIONS & MEMORY FIELDS
    // =====================================================================
    "structOrUnionSpecifier": "type.composite.struct_or_union.declaration",
    "structOrUnion": "type.composite.layout_mode.keyword",
    "memberDeclarationList": "collection.field_declarations.struct_or_union.sequence",
    "memberDeclaration": "declaration.field.struct_or_union.allocator",
    "specifierQualifierList": "collection.field_type_specifiers.sequence",
    "typeSpecifierQualifier": "modifier.field.type_or_qualifier.wrapper",
    "memberDeclaratorList": "collection.field_declarators.sequence",
    "memberDeclarator": "declaration.field_instance.allocator",
    "enumSpecifier": "type.composite.enumeration.declaration",
    "enumTypeSpecifier": "type.composite.enum_underlying_type.wrapper",
    "atomicTypeSpecifier": "type.modifier.atomic_concurrency.wrapper",
    "typeofSpecifier": "type.dynamic.typeof_evaluation.query",
    "typeofSpecifierArgument": "type.dynamic.typeof_target.operand",

    // =====================================================================
    // 6. DECLARATORS, SIGNATURE PINPOINTS & POINTER LAYOUTS
    // =====================================================================
    "declarator": "signature.declarator.root",
    "directDeclarator": "signature.direct_declarator.identifier_or_nest",
    "pointer": "signature.pointer.indirection_layers",
    "parameterTypeList": "signature.parameter_types.prototype_descriptor",
    "parameterList": "collection.parameters.prototype_sequence",
    "parameterDeclaration": "declaration.parameter.signature_argument",
    "typeName": "type.descriptor.declaration.identity",
    "abstractDeclarator": "signature.abstract_declarator.anonymous_root",
    "directAbstractDeclarator": "signature.abstract_declarator.anonymous_nested",
    "typedefName": "type.user_defined.alias_reference",
    "initializer": "value.mutation.initializer.assignment_payload",
    "initializerList": "collection.initializers.array_or_struct.sequence",
    "designation": "value.mapping.designated_initializer.prefix",
    "designatorList": "collection.designators.sequence",
    "designator": "value.mapping.field_or_index.selector",

    // =====================================================================
    // 7. ASSERTIONS, ATTRIBUTES & COMPILE-TIME ANNOTATIONS
    // =====================================================================
    "staticAssertDeclaration": "assertion.compile_time.static_assert",
    "attributeDeclaration": "annotation.compiler.attribute_specifier_statement",
    "attributeSpecifierSequence": "collection.annotations.attributes.sequence",
    "attributeSpecifier": "annotation.compiler.attribute_wrapper",
    "attributeList": "collection.individual_attributes.sequence",
    "attribute": "annotation.compiler.attribute_node",
    "attributeToken": "annotation.compiler.attribute_identity_key",
    "attributeArgumentClause": "annotation.compiler.attribute_payload.arguments",
    "balancedTokenSequence": "collection.balanced_tokens.sequence",
    "balancedToken": "structural.balanced_token.enclosure_or_leaf",

    // =====================================================================
    // 8. FLOW CONTROL, BRANCHING, & SCOPED STATEMENTS
    // =====================================================================
    "statement": "statement.executable.root_wrapper",
    "labeledStatement": "statement.control.jump_target.label_or_case",
    "compoundStatement": "statement.scope.code_block.local_enclosure",
    "blockItemList": "collection.statements_or_declarations.sequence",
    "blockItem": "statement.scoped.block_element.wrapper",
    "expressionStatement": "statement.executable.expression_evaluation",
    "selectionStatement": "statement.control.conditional.branching_if_or_switch",
    "iterationStatement": "statement.control.loop.iteration_while_do_for",
    "forCondition": "statement.control.loop_header.bounds_evaluation",
    "forDeclaration": "declaration.loop_local.variable_allocator",
    "forExpression": "expression.loop_iteration.mutation_step",
    "jumpStatement": "statement.control.flow_break.jump_commands",

    // =====================================================================
    // 9. FUNCTION DEFINITIONS & BODY ENCLOSURES
    // =====================================================================
    "functionDefinition": "declaration.function.implementation.root",
    "declarationList": "collection.legacy_k_and_r.declarations.sequence",
    "functionBody": "statement.scope.function_body.enclosure",
    "identifierList": "collection.identifiers.parameter_names.sequence",

    // =====================================================================
    // 10. GNU COMPILER EXTENSIONS & INLINE ASSEMBLER (GCC)
    // =====================================================================
    "gnuArrayDesignator": "value.mapping.gcc.array_range_designator",
    "gnuIdentifier": "symbol.identifier.gcc.macro_or_label_reference",
    "asmArgument": "assembly.inline.argument_mapping.payload",
    "asmClobbers": "collection.assembly.register_clobber_targets",
    "asmDefinition": "assembly.inline.expression.definition",
    "asm_": "assembly.inline.execution.keyword_variants",
    "toplevelAsmArgument": "assembly.inline.global_scope.payload",
    "asmOperand": "assembly.inline.register_operand.binding",
    "asmOperands": "collection.assembly.operands_sequence",
    "asmQualifier": "assembly.inline.modifier.execution_mode",
    "volatile_": "modifier.volatile_execution.keyword_variants",
    "asmQualifierList": "collection.assembly.qualifiers.sequence",
    "asmStatement": "statement.assembly.inline_code_block",
    "asmStringLiteral": "literal.string.assembly.instruction_text",
    "gccDeclaratorExtension": "signature.modifier.gcc.declarator_extension",
    "gnuAttribute": "annotation.compiler.gcc.attribute_node",
    "gnuAttributeList": "collection.gcc.attributes.sequence",
    "gnuAttributes": "collection.gcc.attributes.multi_sequence",
    "gnuSingleAttribute": "annotation.compiler.gcc.attribute_leaf_token",
    "simpleAsmExpr": "assembly.inline.basic_expression",

    // =====================================================================
    // 11. VISUAL C++ EXTENSIONS (MSVC Linkage calling conventions)
    // =====================================================================
    "vcSpecificModifer": "modifier.calling_convention.msvc.interop_linkage"
};
const ROSETTA_LEXER_MATRIX = {
    // --- Compiler Extensions & Intrinsic Built-Ins ---
    "Attribute": "meta.attribute.gcc.extension.compiler.specific.annotation",
    "KW__builtin_offsetof": "function.builtin.offsetof.macro.native.compiler.support",
    "KW__builtin_va_arg": "function.builtin.va_arg.arguments.variable.compiler.support",
    "KW__builtin_choose_expr": "function.builtin.choose_expr.evaluation.conditional.compiler.support",
    "KW__builtin_types_compatible_p": "function.builtin.types_compatible_p.checking.type.compiler.support",
    "KW__builtin_tgmath": "function.builtin.tgmath.mathematics.type_generic.compiler.support",
    "KW__builtin_complex": "function.builtin.complex.numbers.algebraic.compiler.support",
    "KW__cdecl": "preprocessor.calling_convention.cdecl.linkage.modifier.meta",
    "KW__clrcall": "preprocessor.calling_convention.clrcall.managed.modifier.meta",
    "KW__declspec": "preprocessor.storage_class.declspec.microsoft.modifier.meta",
    "KW__extension__": "preprocessor.extension.gnu.silence_warnings.modifier.meta",
    "KW__fastcall": "preprocessor.calling_convention.fastcall.optimization.modifier.meta",
    "KW__m128": "preprocessor.datatype.vector.simd.intrinsic.meta",
    "KW__m128d": "preprocessor.datatype.vector.double.simd.intrinsic.meta",
    "KW__m128i": "preprocessor.datatype.vector.integer.simd.intrinsic.meta",
    "KW__stdcall": "preprocessor.calling_convention.stdcall.api.modifier.meta",
    "KW__thiscall": "preprocessor.calling_convention.thiscall.oop.modifier.meta",
    "KW__vectorcall": "preprocessor.calling_convention.vectorcall.simd.modifier.meta",
    "KW__real__": "preprocessor.operator.real_part.complex.extraction.meta",
    "KW__imag__": "preprocessor.operator.imag_part.complex.extraction.meta",
    "KW__func__": "preprocessor.identifier.local.string.name.function.meta",
    "KW__FUNCTION__": "preprocessor.identifier.macro.string.name.function.meta",
    "KW__PRETTY_FUNCTION__": "preprocessor.identifier.decorated.string.name.function.meta",

    // --- Explicit Operators & Assembly Scopes ---
    "Alignas": "align.operator.keyword",
    "Alignof": "align.operator.keyword",
    "Maxof": "gnu.operator.keyword",
    "Minof": "gnu.operator.keyword",
    "Countof": "gnu.operator.keyword",
    "Asm_1": "assembly.control.keyword",
    "Asm_2": "assembly.control.keyword",
    "Asm_3": "assembly.control.keyword",

    // --- Hard Datatype Primitives ---
    "Bool": "c.type.storage",
    "Char": "c.type.storage",
    "Double": "c.type.storage",
    "Float": "c.type.storage",
    "Int": "c.type.storage",
    "Long": "c.type.storage",
    "Short": "c.type.storage",
    "Signed": "c.type.storage",
    "Unsigned": "c.type.storage",
    "Void": "c.type.storage",
    "Atomic": "c.type.storage",
    "BitInt": "c.type.storage",
    "Complex": "c.type.storage",
    "Decimal128": "c.type.storage",
    "Decimal32": "c.type.storage",
    "Decimal64": "c.type.storage",
    "Imaginary": "c.type.storage",

    // --- Storage Scope Qualifiers ---
    "Auto": "auto.modifier.storage",
    "Const": "c.modifier.storage",
    "Constexpr": "c.modifier.storage",
    "Inline": "c.modifier.storage",
    "Register": "c.modifier.storage",
    "Restrict": "c.modifier.storage",
    "Static": "c.modifier.storage",
    "Volatile_1": "c.modifier.storage",
    "Volatile_2": "c.modifier.storage",
    "ThreadLocal": "c.modifier.storage",
    "Noreturn": "c.modifier.storage",
    "Extern": "extern.modifier.storage",

    // --- Complex Structure Allocators ---
    "Enum": "structure.type.storage",
    "Struct": "structure.type.storage",
    "Union": "structure.type.storage",
    "Typedef": "structure.type.storage",

    // --- State Constants & Evaluations ---
    "False_": "c.language.constant",
    "True_": "c.language.constant",
    "Nulptr": "c.language.constant",
    "Deprecated": "deprecated.invalid",
    "Sizeof": "expression.operator.keyword",
    "Static_assert": "expression.operator.keyword",
    "StaticAssert": "expression.operator.keyword",
    "Typeof": "expression.operator.keyword",
    "Typeof_unqual": "expression.operator.keyword",

    // --- Branching & Iteration Control Keywords ---
    "Break": "c.control.keyword",
    "Continue": "c.control.keyword",
    "Do": "c.control.keyword",
    "Else": "c.control.keyword",
    "For": "c.control.keyword",
    "Goto": "c.control.keyword",
    "If": "c.control.keyword",
    "Label": "c.control.keyword",
    "Return": "c.control.keyword",
    "Switch": "c.control.keyword",
    "While": "c.control.keyword",
    "Generic": "c.control.keyword",
    "Case": "case.control.keyword",
    "Default": "case.control.keyword",

    // --- Structural Delimiters & Punctuation Sections ---
    "LeftParen": "parens.section.punctuation",
    "RightParen": "parens.section.punctuation",
    "LeftBracket": "brackets.section.punctuation",
    "RightBracket": "brackets.section.punctuation",
    "LeftBrace": "braces.section.punctuation",
    "RightBrace": "braces.section.punctuation",
    "Semi": "comma_semicolon.terminator.punctuation",
    "Comma": "comma_semicolon.terminator.punctuation",

    // --- Mathematical Operator Sets ---
    "Less": "comparison.operator.keyword",
    "LessEqual": "comparison.operator.keyword",
    "Greater": "comparison.operator.keyword",
    "GreaterEqual": "comparison.operator.keyword",
    "Equal": "comparison.operator.keyword",
    "NotEqual": "comparison.operator.keyword",
    "Plus": "arithmetic.operator.keyword",
    "PlusPlus": "arithmetic.operator.keyword",
    "Minus": "arithmetic.operator.keyword",
    "MinusMinus": "arithmetic.operator.keyword",
    "Star": "arithmetic.operator.keyword",
    "Div": "arithmetic.operator.keyword",
    "Mod": "arithmetic.operator.keyword",

    // --- Bitwise & Logical Evaluation Symbols ---
    "And": "logical.operator.keyword",
    "Or": "logical.operator.keyword",
    "AndAnd": "logical.operator.keyword",
    "OrOr": "logical.operator.keyword",
    "Caret": "logical.operator.keyword",
    "Not": "logical.operator.keyword",
    "Tilde": "logical.operator.keyword",
    "LeftShift": "logical.operator.keyword",
    "RightShift": "logical.operator.keyword",
    "Question": "ternary.operator.keyword",
    "Colon": "ternary.operator.keyword",

    // --- Variable Mutations & Assignment Symbols ---
    "Assign": "assignment.operator.keyword",
    "StarAssign": "assignment.operator.keyword",
    "DivAssign": "assignment.operator.keyword",
    "ModAssign": "assignment.operator.keyword",
    "PlusAssign": "assignment.operator.keyword",
    "MinusAssign": "assignment.operator.keyword",
    "LeftShiftAssign": "assignment.operator.keyword",
    "RightShiftAssign": "assignment.operator.keyword",
    "AndAssign": "assignment.operator.keyword",
    "XorAssign": "assignment.operator.keyword",
    "OrAssign": "assignment.operator.keyword",

    // --- Field References & Object Traversal ---
    "Arrow": "member.operator.keyword",
    "Dot": "member.operator.keyword",
    "Ellipsis": "parameters.definition.punctuation",

    // --- Atomic Text Values & Constants ---
    "Identifier": "identifier.other.variable",
    "DigitSequence": "integer.numeric.constant",
    "IntegerConstant": "integer.numeric.constant",
    "FloatingConstant": "float.numeric.constant",
    "CharacterConstant": "c.character.constant",
    "StringLiteral": "c.double.quoted.string",

    // --- Channels, Hidden Whitespace, and Code Documentation ---
    "MultiLineMacro": "macro.preprocessor.meta",
    "LineDirective": "macro.preprocessor.meta",
    "Directive": "macro.preprocessor.meta",
    "Whitespace": "whitespace.text",
    "Newline": "whitespace.text",
    "BlockComment": "c.block.comment",
    "LineComment": "double_slash.line.comment"
};

const LEXER_FUNCTIONAL_CLASSIFIER_MATRIX = {

    // =====================================================================
    // 1. COMPILER INTRINSICS, EXTENSIONS & CALLING CONVENTIONS
    // =====================================================================
    "Attribute": "compiler_extension.gcc.attribute.annotation",
    "KW__builtin_offsetof": "compiler_intrinsic.macro.offsetof",
    "KW__builtin_va_arg": "compiler_intrinsic.macro.variable_arguments",
    "KW__builtin_choose_expr": "compiler_intrinsic.evaluation.static_conditional",
    "KW__builtin_types_compatible_p": "compiler_intrinsic.evaluation.type_checking",
    "KW__builtin_tgmath": "compiler_intrinsic.mathematics.type_generic",
    "KW__builtin_complex": "compiler_intrinsic.algebraic.complex_numbers",
    "KW__cdecl": "calling_convention.x86.cdecl.modifier",
    "KW__clrcall": "calling_convention.managed.clrcall.modifier",
    "KW__declspec": "compiler_extension.msvc.storage_class.declspec",
    "KW__extension__": "compiler_extension.gcc.silence_warnings.meta",
    "KW__fastcall": "calling_convention.x86.fastcall.modifier",
    "KW__m128": "datatype.vector.simd.128bit_float",
    "KW__m128d": "datatype.vector.simd.128bit_double",
    "KW__m128i": "datatype.vector.simd.128bit_integer",
    "KW__stdcall": "calling_convention.x86.stdcall.modifier",
    "KW__thiscall": "calling_convention.x86.thiscall.modifier",
    "KW__vectorcall": "calling_convention.simd.vectorcall.modifier",
    "KW__real__": "operator.complex_numbers.real_part.extractor",
    "KW__imag__": "operator.complex_numbers.imag_part.extractor",
    "KW__func__": "literal.string.local_function_name.predefined",
    "KW__FUNCTION__": "literal.string.local_function_name.macro",
    "KW__PRETTY_FUNCTION__": "literal.string.decorated_function_name.macro",

    // =====================================================================
    // 2. MEMORY LAYOUT, ALIGNMENT, BOUNDS & STORAGE COMMANDS
    // =====================================================================
    "Alignas": "keyword.modifier.memory_layout.alignment_specifier",
    "Alignof": "keyword.operator.memory_layout.alignment_query",
    "Maxof": "keyword.operator.numerical_limits.maximum_bound",
    "Minof": "keyword.operator.numerical_limits.minimum_bound",
    "Countof": "keyword.operator.array_bounds.element_capacity",
    "Sizeof": "keyword.operator.memory_allocation.byte_size",
    "Auto": "keyword.modifier.storage_class.automatic_lifetime",
    "Extern": "keyword.modifier.storage_class.external_linkage",
    "Register": "keyword.modifier.storage_class.hardware_register",
    "Static": "keyword.modifier.storage_class.static_linkage",
    "Typedef": "keyword.declaration.type_alias.root",
    "ThreadLocal": "keyword.modifier.storage_class.thread_local_lifetime",

    // =====================================================================
    // 3. HARD SPECIFIER PRIMITIVES & TYPE QUALIFIERS
    // =====================================================================
    "Bool": "datatype.primitive.boolean",
    "Char": "datatype.primitive.character",
    "Double": "datatype.primitive.floating_point.double_precision",
    "Float": "datatype.primitive.floating_point.single_precision",
    "Int": "datatype.primitive.integer.basic",
    "Long": "datatype.primitive.integer.extended_precision",
    "Short": "datatype.primitive.integer.reduced_precision",
    "Signed": "datatype.modifier.sign.explicit_signed",
    "Unsigned": "datatype.modifier.sign.explicit_unsigned",
    "Void": "datatype.primitive.empty_placeholder",
    "Atomic": "datatype.qualifier.concurrency.atomic_thread_fence",
    "BitInt": "datatype.primitive.integer.arbitrary_width_precise",
    "Complex": "datatype.modifier.algebraic.complex_floating_point",
    "Decimal128": "datatype.primitive.floating_point.ieee_decimal128",
    "Decimal32": "datatype.primitive.floating_point.ieee_decimal32",
    "Decimal64": "datatype.primitive.floating_point.ieee_decimal64",
    "Imaginary": "datatype.modifier.algebraic.imaginary_floating_point",
    "Const": "datatype.qualifier.mutability.read_only",
    "Constexpr": "datatype.qualifier.mutability.compile_time_constant",
    "Restrict": "datatype.qualifier.pointer_aliasing.optimization_hint",
    "Volatile_1": "datatype.qualifier.memory_visibility.volatile_access",
    "Volatile_2": "datatype.qualifier.memory_visibility.volatile_access_alias",

    // =====================================================================
    // 4. COMPLEX ARCHITECTURAL TYPE STRUCTURES
    // =====================================================================
    "Enum": "datatype.composite.enumeration.keyword",
    "Struct": "datatype.composite.structure_layout.keyword",
    "Union": "datatype.composite.overlapping_union_layout.keyword",
    "Typeof": "datatype.query.dynamic_typeof.keyword",
    "Typeof_unqual": "datatype.query.dynamic_typeof_unqualified.keyword",

    // =====================================================================
    // 5. CONTROL FLOW, ITERATION & BRANCHING KEYWORDS
    // =====================================================================
    "Break": "keyword.control.flow.loop_or_switch_break",
    "Continue": "keyword.control.flow.loop_iteration_continue",
    "Do": "keyword.control.flow.loop_do_while_entry",
    "Else": "keyword.control.flow.conditional_else_branch",
    "For": "keyword.control.flow.loop_for_counter_entry",
    "Goto": "keyword.control.flow.arbitrary_jump_goto",
    "If": "keyword.control.flow.conditional_if_entry",
    "Return": "keyword.control.flow.subroutine_exit_return",
    "Switch": "keyword.control.flow.multi_branch_switch_entry",
    "While": "keyword.control.flow.loop_while_conditional_entry",
    "Case": "keyword.control.branch.switch_case_label",
    "Default": "keyword.control.branch.switch_default_label",
    "Generic": "keyword.control.branch.compile_time_generic_switch",

    // =====================================================================
    // 6. FUNCTION BEHAVIORS, ANNOTATIONS & INLINE ASSEMBLERS
    // =====================================================================
    "Inline": "keyword.modifier.function_linkage.inline_hint",
    "Noreturn": "keyword.modifier.function_behavior.noreturn_attribute",
    "Asm_1": "keyword.assembly.inline_block.standard",
    "Asm_2": "keyword.assembly.inline_block.msvc_variant",
    "Asm_3": "keyword.assembly.inline_block.gcc_variant",
    "Deprecated": "keyword.annotation.compiler_diagnostic.deprecated_target",
    "Label": "keyword.declaration.gcc.local_label_assertion",
    "Static_assert": "keyword.assertion.compile_time.static_assert_c11",
    "StaticAssert": "keyword.assertion.compile_time.static_assert_alias",

    // =====================================================================
    // 7. STATE CONSTANTS & LITERAL DATA LEAVES
    // =====================================================================
    "True_": "literal.boolean.constant_true",
    "False_": "literal.boolean.constant_false",
    "Nulptr": "literal.pointer.null_reference_constant",
    "Identifier": "symbol.identifier.reference_or_declaration.name",
    "DigitSequence": "token.sub_component.raw_digits_sequence",
    "IntegerConstant": "literal.numeric.integer.value",
    "FloatingConstant": "literal.numeric.floating_point.value",
    "CharacterConstant": "literal.character.encoded_byte.value",
    "StringLiteral": "literal.string.escaped_array.value",

    // =====================================================================
    // 8. STRUCTURAL ENCLOSURES, DELIMITERS & TERMINATORS
    // =====================================================================
    "LeftParen": "punctuation.enclosure.grouping.opening_parenthesis",
    "RightParen": "punctuation.enclosure.grouping.closing_parenthesis",
    "LeftBracket": "punctuation.enclosure.array_index.opening_bracket",
    "RightBracket": "punctuation.enclosure.array_index.closing_bracket",
    "LeftBrace": "punctuation.enclosure.scope_block.opening_brace",
    "RightBrace": "punctuation.enclosure.scope_block.closing_brace",
    "Semi": "punctuation.terminator.statement_semicolon",
    "Comma": "punctuation.separator.expression_list_comma",
    "Colon": "punctuation.separator.label_or_ternary_colon",

    // =====================================================================
    // 9. MATHEMATICAL, BITWISE & LOGICAL OPERATORS
    // =====================================================================
    "Less": "operator.logical.comparison.less_than",
    "LessEqual": "operator.logical.comparison.less_than_or_equal",
    "Greater": "operator.logical.comparison.greater_than",
    "GreaterEqual": "operator.logical.comparison.greater_than_or_equal",
    "Equal": "operator.logical.comparison.identity_equality",
    "NotEqual": "operator.logical.comparison.identity_inequality",
    "AndAnd": "operator.logical.short_circuit.conjunction",
    "OrOr": "operator.logical.short_circuit.disjunction",
    "Not": "operator.logical.boolean_negation",
    "Plus": "operator.algebraic.mathematical.addition_or_unary_plus",
    "PlusPlus": "operator.mutation.increment.pre_or_post",
    "Minus": "operator.algebraic.mathematical.subtraction_or_unary_minus",
    "MinusMinus": "operator.mutation.decrement.pre_or_post",
    "Star": "operator.algebraic.mathematical.multiplication_or_pointer_indirection",
    "Div": "operator.algebraic.mathematical.division",
    "Mod": "operator.algebraic.mathematical.modulus_remainder",
    "LeftShift": "operator.bitwise.shift.left",
    "RightShift": "operator.bitwise.shift.right",
    "And": "operator.bitwise.conjunction_or_address_of",
    "Or": "operator.bitwise.inclusive_disjunction",
    "Caret": "operator.bitwise.exclusive_disjunction_xor",
    "Tilde": "operator.bitwise.one_complement_inversion",
    "Question": "operator.conditional.ternary.query",

    // =====================================================================
    // 10. MUTATION VARIABLES & COMPOUND ASSIGNMENTS
    // =====================================================================
    "Assign": "operator.mutation.assignment.direct",
    "StarAssign": "operator.mutation.assignment.compound_multiplication",
    "DivAssign": "operator.mutation.assignment.compound_division",
    "ModAssign": "operator.mutation.assignment.compound_modulus",
    "PlusAssign": "operator.mutation.assignment.compound_addition",
    "MinusAssign": "operator.mutation.assignment.compound_subtraction",
    "LeftShiftAssign": "operator.mutation.assignment.compound_left_shift",
    "RightShiftAssign": "operator.mutation.assignment.compound_right_shift",
    "AndAssign": "operator.mutation.assignment.compound_bitwise_and",
    "XorAssign": "operator.mutation.assignment.compound_bitwise_xor",
    "OrAssign": "operator.mutation.assignment.compound_bitwise_or",

    // =====================================================================
    // 11. TRAVERSAL COMPONENT POINTERS & FIELDS
    // =====================================================================
    "Arrow": "operator.member_access.pointer_dereference_arrow",
    "Dot": "operator.member_access.direct_structure_dot",
    "Ellipsis": "punctuation.signature.variadic_parameter_ellipsis",

    // =====================================================================
    // 12. PREPROCESSOR STREAMS & COMPILER META PIPELINES
    // =====================================================================
    "MultiLineMacro": "preprocessor.stream.gcc_multiline_macro.hidden",
    "LineDirective": "preprocessor.stream.line_control_directive.isolated_channel",
    "Directive": "preprocessor.stream.generic_compiler_directive.hidden",
    "Whitespace": "preprocessor.layout.whitespace.hidden",
    "Newline": "preprocessor.layout.line_break.hidden",
    "BlockComment": "preprocessor.documentation.multi_line_comment.hidden",
    "LineComment": "preprocessor.documentation.single_line_comment.hidden"
};



const ROSETTA_INTERCEPTOR_RULES = {
    "match.intercept.validator.dependency.dynamic.precompiler.has.reserved.clang.cinclude.control.keyword": (state) => {
        if (!state.literalText.startsWith('#include') && !state.lowerSymbol.includes('directive')) return null;
        
        let base = "keyword.control.c_include.c_lang.c_reserved.has_precompiler";
        const includeMatch = state.literalText.match(/#include\s*["<]([^">]+)[">]/);
        if (includeMatch?.[1]) {
            const targetHeader = includeMatch[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            base += `.import_target.header_${targetHeader}`;
            const missingHeaders = (typeof window !== 'undefined') ? window.__missingHeaders : null;
            base += (!missingHeaders || !missingHeaders.has(includeMatch[1].trim()))
                ? ".err_notfound.status_missing.annotation_required"
                : ".status_resolved";
            return base;
        }
        return base + ".err_malformed_directive";
    },

    "match.intercept.override.descriptor.key.property.json.purple.variable": (state) => {
        if (state.lowerSymbol.includes('comment')) return null;
        return (['jsonkey', 'pair', 'pair_key'].includes(state.lowerRule) || state.ruleName === 'jsonKey') ? "variable" : null;
    },

    "match.intercept.override.payload.value.literal.json.blue.string": (state) => {
        return (['jsonvalue', 'json_value'].includes(state.lowerRule) || state.ruleName === 'jsonValue') ? "string" : null;
    },
    
    "match.intercept.delimiter.opening.structural.lparen.paren": (state) => {
        return ['{', '('].includes(state.literalText) ? "paren.lparen" : null;
    },

    "match.intercept.delimiter.closing.structural.rparen.paren": (state) => {
        return ['}', ')'].includes(state.literalText) ? "paren.rparen" : null;
    },

    "match.intercept.array.character.sequence.literal.quoted.string": (state) => {
        if (state.baseClassification === "variable" || ['jsonkey', 'pair_key'].includes(state.lowerRule)) return "variable";
        return state.lowerSymbol.includes('string') ? "string" : null;
    },

    "match.intercept.separator.statement.inline.operator.punctuation": (state) => {
        return [',', ';', '.'].includes(state.literalText) ? "punctuation.operator" : null;
    },

    "match.intercept.fallback.expression.literal.character.operator.keyword": (state) => {
        return (state.lexerLiteralName.startsWith("'") && state.lexerLiteralName.length <= 5) ? "keyword.operator" : null;
    },

    "match.intercept.line.or.block.annotation.code.source.italic.comment": (state) => {
        return state.lowerSymbol.includes('comment') ? "comment" : null;
    },

    "match.intercept.specifier.linkage.and.qualifier.scope.modifier.storage": (state) => {
        return (state.lowerSymbol.includes('storage') || state.lowerSymbol.includes('qualifier')) ? "storage.modifier" : null;
    },

    "match.intercept.structures.allocated.and.datatype.primitive.type.storage": (state) => {
        return (state.lowerSymbol.includes('type') || state.lowerSymbol === 'type_name') ? "storage.type" : null;
    },

    "match.intercept.statements.assertion.and.looping.branching.control.keyword": (state) => {
        return (state.lowerSymbol.includes('statement') || state.lowerSymbol.includes('control') || state.lowerSymbol.includes('assert')) ? "keyword.control" : null;
    },

    "match.intercept.declarations.architectural.and.builtins.compiler.native.keyword": (state) => {
        return ['struct', 'union', 'enum', 'sizeof', 'typeof', 'alignof', 'alignas', 'asm'].includes(state.lowerLiteral) ? "keyword" : null;
    },

    "match.intercept.literal.binary.or.hex.point.floating.integer.numeric.constant": (state) => {
        return (state.lowerSymbol.includes('constant') || state.lowerSymbol.includes('numeric')) ? "constant.numeric" : null;
    },

    "match.intercept.symbols.mutation.and.assignment.logical.mathematical.operator.keyword": (state) => {
        return (state.lowerSymbol.includes('assign') || state.lowerSymbol.includes('operator') || state.lowerSymbol.includes('arrow')) ? "keyword.operator" : null;
    },

    "match.intercept.walker.tree.ancestor.ast.and.context.symbol.intelligent.other.variable": (state) => {
        if (!state.lowerSymbol.includes('identifier') && state.ruleName !== 'identifier') return null;
        if (state.tokenStream?.tokens && typeof state.ctxOrToken?.tokenIndex === 'number') {
            if (state.tokenStream.tokens[state.ctxOrToken.tokenIndex + 1]?.text === '(') return "support.function";
        }
        let current = state.contextNode;
        while (current) {
            const ruleStr = String(current.ruleName || current.constructor?.name || "");
            if (ruleStr.includes("directDeclarator") || ruleStr.includes("functionDefinition")) return "entity.name.function";
            if (ruleStr.includes("postfixExpression") && ['.', '->'].includes(state.literalText)) return "variable.other.member";
            if (ruleStr.includes("initDeclarator") || ruleStr.includes("parameterDeclaration") || ruleStr.includes("declarator")) return "variable.parameter";
            current = current.parent;
        }
        return "variable.other";
    },

    "match.intercept.lookup.configuration.static.fallback.matrix.rule.rosetta": (state) => {
        return (state.ruleName && ROSETTA_RULE_MATRIX[state.ruleName] !== "text") ? ROSETTA_RULE_MATRIX[state.ruleName] : null;
    }
};


const ARGUMENT_INTERCEPT_SCHEMAS = {
    "argument.resolution.worker.payload.interception.schema": (state) => {
        const payload = state.ctxOrToken;
        if (!payload) return;
        
        state.symbolicName = payload.symbolicName || payload.tokenSymbol || payload.tokenRule || state.symbolicName;
        state.ruleName = payload.ruleName || state.ruleName;
        state.typeInt = typeof payload.type === 'number' ? payload.type : (payload.tokenIndex ?? state.typeInt);
        state.literalText = payload.text || state.literalText;
        state.tokenChannel = typeof payload.channel === 'number' ? payload.channel : state.tokenChannel;
        state.contextNode = payload.start ? payload : (payload.parent || state.contextNode);

        // Flatten nested class name resolution checks
        if (!state.ruleName && typeof payload.type === 'string') {
            state.ruleName = payload.type.match(/rule_([a-zA-Z0-9_-]+)/)?.[1] || "";
        }
        if (!state.ruleName) {
            state.ruleName = payload.textType || "";
        }
    }
};

const POST_PROCESS_SCHEMAS = {
    "classification.root.scope.isolation.and.text.fallback.schema": (state) => {
        if (!state.baseClassification.split('.')[0] || state.baseClassification.startsWith("text")) {
            state.baseClassification = "text" + (state.baseClassification.includes('.') ? state.baseClassification.substring(state.baseClassification.indexOf('.')) : '');
        }
    },
    "classification.prefix.token.type.deconstruction.schema": (state) => {
        if (state.baseClassification.startsWith("entity.name.function") || state.baseClassification === "function") return "function";
        return state.baseClassification.replace(/^type_(text|keyword|comment|storage|support|constant)/, "$1");
    },
    "classification.json.key.value.strict.override.schema": (state) => {
        if (['jsonkey', 'pair_key', 'pair'].includes(state.lowerRule)) return "variable";
        if (['jsonvalue', 'json_value'].includes(state.lowerRule)) return "string";
        return state.cleanBase;
    }
};

const SERIALIZATION_METADATA_SCHEMAS = {
    "serialization.layer.base.classification.append.schema": ({ parts, cleanBase }) => parts.push(cleanBase),
    "serialization.layer.antlr.lexer.symbolic.name.append.schema": ({ parts, lexerSymbolicName }) => {
        if (lexerSymbolicName && lexerSymbolicName !== "Text") parts.push(`lex_${lexerSymbolicName.toLowerCase()}`);
    },
    "serialization.layer.antlr.parser.rule.name.append.schema": ({ parts, ruleName }) => {
        if (ruleName && !["text", "jsonKey"].includes(ruleName)) parts.push(`rule_${ruleName}`);
    },
    "serialization.layer.token.channel.stream.index.append.schema": ({ parts, tokenChannel }) => {
        if (tokenChannel !== 0) parts.push(`chan_${tokenChannel}`);
    },
    "serialization.layer.lexer.integer.type.identity.append.schema": ({ parts, typeInt }) => {
        if (typeInt !== null && !isNaN(typeInt)) parts.push(`idx_${typeInt}`);
    },
    "serialization.layer.raw.sanitized.grammar.identifier.append.schema": ({ parts, symbolicName, lexerSymbolicName }) => {
        const raw = (lexerSymbolicName || symbolicName || 'symbol').toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (raw && raw !== "text" && !raw.startsWith('keyword')) parts.push(`raw_${raw}`);
    }
};


function toRosettaToken(symbolicName, ruleName, lexer, parser, ctxOrToken, tokenStream) {
    // 1. Build unified normalized state object with native parameters mapped instantly
    const tokenState = {
        symbolicName: symbolicName || "", ruleName: ruleName || "",
        lexer: lexer, parser: parser, ctxOrToken: ctxOrToken, tokenStream: tokenStream,
        typeInt: null, literalText: "", tokenChannel: 0, contextNode: null,
        baseClassification: "text", cleanBase: "text", lowerRule: "", lowerSymbol: "", lowerLiteral: ""
    };

    // 2. Normalize and compute payload layer fields across worker bridges
    ARGUMENT_INTERCEPT_SCHEMAS["argument.resolution.worker.payload.interception.schema"](tokenState);

    const ctor = lexer?.constructor;
    tokenState.lexerSymbolicName = tokenState.typeInt !== null ? (ctor?.symbolicNames?.[tokenState.typeInt] || "") : "";
    tokenState.lexerLiteralName = tokenState.typeInt !== null ? (ctor?.literalNames?.[tokenState.typeInt] || "") : "";
    tokenState.symbolicName ||= tokenState.lexerSymbolicName;
    
    // Normalize casing for direct matching
    tokenState.lowerRule = tokenState.ruleName.toLowerCase();
    tokenState.lowerSymbol = tokenState.symbolicName.toLowerCase();
    tokenState.lowerLiteral = tokenState.literalText.toLowerCase();

    // 3. Fast-path cross-reference using the comprehensive language dictionaries
    let mapped = false;
    if (tokenState.ruleName && ROSETTA_RULE_MATRIX[tokenState.ruleName]) {
        tokenState.baseClassification = ROSETTA_RULE_MATRIX[tokenState.ruleName];
        mapped = true;
    } else if (tokenState.lexerSymbolicName && ROSETTA_LEXER_MATRIX[tokenState.lexerSymbolicName]) {
        tokenState.baseClassification = ROSETTA_LEXER_MATRIX[tokenState.lexerSymbolicName];
        mapped = true;
    }

    // 4. Interception Engine Overrides Pass
    const eliteInterceptors = [
        "match.intercept.validator.dependency.dynamic.precompiler.has.reserved.clang.cinclude.control.keyword",
        "match.intercept.override.descriptor.key.property.json.purple.variable",
        "match.intercept.override.payload.value.literal.json.blue.string",
        "match.intercept.walker.tree.ancestor.ast.and.context.symbol.intelligent.other.variable"
    ];

    for (const key of eliteInterceptors) {
        const res = ROSETTA_INTERCEPTOR_RULES[key](tokenState);
        if (res !== null) {
            tokenState.baseClassification = res;
            if (key === "match.intercept.validator.dependency.dynamic.precompiler.has.reserved.clang.cinclude.control.keyword") {
                return assembleFinalMegaScope(tokenState);
            }
            mapped = true;
            break;
        }
    }

    if (!mapped) {
        for (const key in ROSETTA_INTERCEPTOR_RULES) {
            if (eliteInterceptors.includes(key)) continue;
            if (key === "match.intercept.line.or.block.annotation.code.source.italic.comment" && tokenState.tokenChannel !== 1 && !tokenState.lowerSymbol.includes('comment')) continue;

            const res = ROSETTA_INTERCEPTOR_RULES[key](tokenState);
            if (res !== null) {
                tokenState.baseClassification = res;
                break;
            }
        }
    }

    // 5. Scoping Post-Processing Pipeline
    POST_PROCESS_SCHEMAS["classification.root.scope.isolation.and.text.fallback.schema"](tokenState);
    tokenState.cleanBase = POST_PROCESS_SCHEMAS["classification.prefix.token.type.deconstruction.schema"](tokenState);
    tokenState.cleanBase = POST_PROCESS_SCHEMAS["classification.json.key.value.strict.override.schema"](tokenState);

    // 6. Output Asset Construction Packing
    const parts = [];
    for (const schemaKey in SERIALIZATION_METADATA_SCHEMAS) {
        SERIALIZATION_METADATA_SCHEMAS[schemaKey]({ 
            parts, 
            cleanBase: tokenState.cleanBase, 
            lexerSymbolicName: tokenState.lexerSymbolicName, 
            ruleName: tokenState.ruleName, 
            tokenChannel: tokenState.tokenChannel, 
            typeInt: tokenState.typeInt, 
            symbolicName: tokenState.symbolicName 
        });
    }

    return parts.join('.');
}



function assembleFinalMegaScope({ baseClassification, lexerSymbolicName, ruleName, tokenChannel, typeInt, symbolicName }) {
    const structuralParts = [baseClassification];

    if (lexerSymbolicName && lexerSymbolicName !== "Text") {
        structuralParts.push(`lex_${lexerSymbolicName.toLowerCase()}`);
    }

    if (ruleName && ruleName !== "text") {
        structuralParts.push(`rule_${ruleName}`);
    }

    // Explicitly serializes channels correctly instead of passing text layout defaults
    if (typeof tokenChannel === 'number') {
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