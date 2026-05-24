

// =====================================================================
// TEXT & SYNTAX-LEVEL DETERMINATIONS WATERFALL REGISTRY
// =====================================================================
const TEXT_LANGUAGE_DETECTOR_WATERFALL = [
    // ─── 1. BINARY & VIRTUAL MACHINE CORE SIGNATURES ───
    { id: "wat", match: (s, b) => s.trim().startsWith('(module') || s.includes('(func ') || s.includes('(import "env"') },
    { id: "wasm", match: (s, b) => b?.[0] === 0x00 && b?.[1] === 0x61 && b?.[2] === 0x73 && b?.[3] === 0x6D },
    { id: "qvm", match: (s, b) => b?.[0] === 0x44 && b?.[1] === 0x14 && b?.[2] === 0x72 && b?.[3] === 0x12 },
    { id: "bsp", match: (s, b) => b?.[0] === 0x49 && b?.[1] === 0x42 && b?.[2] === 0x53 && b?.[3] === 0x50 }, // "IBSP"
    { id: "md3", match: (s, b) => b?.[0] === 0x49 && b?.[1] === 0x44 && b?.[2] === 0x50 && b?.[3] === 0x33 }, // "IDP3"

    // ─── 2. TEXT STRUCTURAL & DOMAIN SPECIFIC LAYOUTS ───
    { id: "quakemap", match: (s, b) => s.includes('// entity ') && s.includes('"classname"') && s.includes(' brushes') },
    { id: "json", match: (s, b) => s.trim().startsWith('{') && s.includes('":') && (s.includes('",') || s.includes('"\n') || s.trim().endsWith('}')) },
    { id: "html", match: (s, b) => /<!doctype\s+html|<\/html>|<body|<script/i.test(s) },
    { id: "xml", match: (s, b) => s.trim().startsWith('<?xml') || (s.includes('</') && /<[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+/i.test(s)) },
    { id: "graphql", match: (s, b) => s.includes('query ') || s.includes('mutation ') || s.includes('type ') && s.includes(' {') && !s.includes(';') },
    { id: "css3", match: (s, b) => s.includes('{') && s.includes('}') && s.includes(':') && s.includes(';') && !s.includes('function ') && !s.includes('let ') },
    { id: "csv", match: (s, b) => s.split('\n').slice(0, 3).every(l => l.split(',').length > 2 && !l.includes('{') && !l.includes(';')) },
    { id: "toml", match: (s, b) => s.includes('[') && s.includes(']') && s.includes('=') && !s.includes('{') && !s.includes(';') && !s.includes('function') },
    { id: "properties", match: (s, b) => s.split('\n').every(l => !l.trim() || l.trim().startsWith('#') || l.trim().startsWith('!') || l.includes('=')) && s.includes('=') && !s.includes('{') },

    // ─── 3. DEVOPS, ANNOTATIONS & SYSTEM SCHEMAS ───
    { id: "terraform", match: (s, b) => s.includes('resource "') || s.includes('variable "') || s.includes('provider "') || s.includes('output "') },
    { id: "protobuf3", match: (s, b) => s.includes('syntax = "proto3"') || s.includes('message ') && s.includes(' = ') && s.includes(';') },
    { id: "cmake", match: (s, b) => s.includes('cmake_minimum_required') || s.includes('project(') || s.includes('add_executable(') },
    { id: "webidl", match: (s, b) => s.includes('interface ') && s.includes('attribute ') && s.includes(';') },

    // ─── 4. RELATIONAL DATABASES & DIALECTS (SQL) ───
    { id: "plsql", match: (s, b) => /create\s+or\s+replace\s+(?:procedure|function|package|trigger)/i.test(s) || s.toLowerCase().includes('begin') && s.toLowerCase().includes('exception') },
    { id: "tsql", match: (s, b) => s.toLowerCase().includes('declare @') || s.toLowerCase().includes('exec ') || s.toLowerCase().includes('with nocount') },
    { id: "postgresql", match: (s, b) => s.toLowerCase().includes('$$ language plpgsql') || s.toLowerCase().includes('returns trigger as') },
    { id: "sqlite", match: (s, b) => s.toLowerCase().includes('autoincrement') || s.toLowerCase().includes('create table if not exists') },

    // ─── 5. LOW-LEVEL ASSEMBLERS (ASM MATRIX) ───
    { id: "masm", match: (s, b) => s.toLowerCase().includes('.model ') || s.toLowerCase().includes('.code') || s.toLowerCase().includes('proc near') || s.toLowerCase().includes('endp') },
    { id: "asm6502", match: (s, b) => s.toLowerCase().includes('lda #') || s.toLowerCase().includes('sta $') || s.toLowerCase().includes('jmp $') },
    { id: "asm8080", match: (s, b) => s.toLowerCase().includes('mvi a,') || s.toLowerCase().includes('lxi h,') || s.toLowerCase().includes('cpi ') },
    { id: "asm8086", match: (s, b) => s.toLowerCase().includes('mov ax,') || s.toLowerCase().includes('int 21h') || s.toLowerCase().includes('segment') },
    { id: "asmz80", match: (s, b) => s.toLowerCase().includes('ld a,') || s.toLowerCase().includes('ld hl,') || s.toLowerCase().includes('djnz ') },
    { id: "pdp7", match: (s, b) => s.toLowerCase().includes('lac ') || s.toLowerCase().includes('dac ') || s.toLowerCase().includes('dzm ') },

    // ─── 6. AUTOMATED SHELLS, REGEX & SPECIAL RUNTIMES ───
    { id: "powershell", match: (s, b) => s.toLowerCase().includes('write-output') || s.toLowerCase().includes('get-process') || s.includes('$global:') || s.includes('param(') },
    { id: "bash", match: (s, b) => s.startsWith('#!') && (s.includes('bin/bash') || s.includes('bin/sh')) || s.includes('export ') && s.includes('local ') },
    { id: "pcre", match: (s, b) => s.startsWith('/') && s.endsWith('/') && (s.includes('\\d') || s.includes('\\w') || s.includes('(?:') || s.includes('(?=')) },
    { id: "xsdregex", match: (s, b) => s.includes('\\p{Is') || s.includes('[\\c]') },

    // ─── 7. HEAVY SCRIPTING & SCRIPT-BASED ENGINES ───
    { id: "python3", match: (s, b) => s.includes('def ') && s.includes(':') && (s.includes('import ') || s.includes('print(')) && !s.includes('{') && !s.includes(';') },
    { id: "python2", match: (s, b) => s.includes('def ') && s.includes(':') && /print\s+["'].*["']/i.test(s) && !s.includes('{') },
    { id: "php", match: (s, b) => s.includes('<?php') || s.includes('?>') || s.includes('$_GET') || s.includes('$_POST') || s.includes('echo ') && s.includes(';') },
    { id: "lua", match: (s, b) => s.includes('local ') && s.includes('function(') || s.includes('end') && s.includes('local ') || s.includes('require(') && s.includes('local') },

    // ─── 8. FRONT-END SCRIPTING LAYERS (JS/TS) ───
    { id: "jsx", match: (s, b) => s.includes('import ') && s.includes('from ') && s.includes('return (') && s.includes('</') },
    { id: "typescript", match: (s, b) => s.includes('import ') && s.includes('from ') && (s.includes('interface ') || s.includes('type ') || s.includes('as ') || s.includes('private ') || s.includes(': string') || s.includes(': number') || s.includes(': any')) },
    { id: "javascript", match: (s, b) => s.includes('const ') || s.includes('let ') || s.includes('var ') || s.includes('function ') || s.includes('import ') && s.includes('from ') || s.includes('require(') },

    // ─── 9. TYPED ARCHITECTURAL COMPILER SYSTEMS (JAVA & RUST) ───
    { id: "rust", match: (s, b) => s.includes('fn main()') || s.includes('pub struct ') || s.includes('impl ') || s.includes('use std::') || s.includes('let mut ') || s.includes('fn ') && s.includes('->') },
    { id: "java9", match: (s, b) => s.includes('module ') && s.includes('requires ') && s.includes('exports ') },
    { id: "java8", match: (s, b) => s.includes('public class ') && s.includes('public static void main') || s.includes('import java.') },
    { id: "java", match: (s, b) => s.includes('public class ') && s.includes('System.out.print') },

    // ─── 10. UNREAL / GAME PLAY SCENE MANAGEMENT ───
    { id: "unreal_angelscript", match: (s, b) => s.includes('UPROPERTY(') || s.includes('UFUNCTION(') || s.includes('class A') && s.includes(' : AActor') },
    { id: "angelscript", match: (s, b) => s.includes('class ') && s.includes('void ') && s.includes('::') && !s.includes('#include') && !s.includes('using namespace') },

    // ─── 11. HARD NATIVE LOW-LEVEL COMPILERS (C++ vs C DETERMINATION) ───
    { id: "csharp", match: (s, b) => s.includes('using System;') || s.includes('namespace ') && s.includes('public class ') && s.includes('{') && s.includes('get;') && s.includes('set;') },
    { id: "cpp", match: (s, b) => s.includes('#include <iostream>') || s.includes('std::cout') || s.includes('using namespace std;') || s.includes('::') && s.includes('class ') || s.includes('public:') || s.includes('template<typename') },

    // Explicit Fallthrough to Base C if none of the modern object enhancements matched
    { id: "c", match: (s, b) => s.includes('#include') || s.includes('printf(') || s.includes('struct ') || s.includes('int main(') || s.includes('NULL') || s.includes('extern ') }
];



function autodetectLanguage(fileText, fileBuffer) {
    const textContent = fileText || "";
    const cleanBuffer = fileBuffer || (typeof Uint8Array !== 'undefined' ? new Uint8Array(0) : []);

    // Sequentially execute the array matches; returns the first absolute hit or defaults to text
    const matchedLanguageNode = TEXT_LANGUAGE_DETECTOR_WATERFALL.find(lang => lang.match(textContent, cleanBuffer));

    const resolvedLanguageId = matchedLanguageNode ? matchedLanguageNode.id : "text";
    console.log(`[AUTODETECT SUCCESS] File classified cleanly as: ${resolvedLanguageId}`);

    return resolvedLanguageId;
}



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


const ROSETTA_CROSS_LANGUAGE_MAPPING = {
    // =====================================================================
    // 1. HIGHER-LEVEL PARSER EXPR/RULE CONTEXTS (Parser Rules -> C Rules)
    // =====================================================================
    "json": ["compilationUnit", "translationUnit"],
    "obj": ["compoundStatement"],                        // Scoped brace blocks '{ ... }'
    "pair": ["assignmentExpression", "initDeclarator"],  // 'Key: Value' maps to assignments or initializers
    "jsonKey": ["Identifier", "typedefName"],            // Structural naming identifiers
    "jsonValue": ["primaryExpression", "constant"],      // Base terminal values and literal atoms
    "arr": ["initializerList"],                          // Nested array values map to C literal array brackets

    // =====================================================================
    // 2. LEXER TERMINAL CORES (Lexer Rules -> C Lexer Keys / Token Names)
    // =====================================================================
    "STRING": ["StringLiteral", "CharacterConstant"],
    "NUMBER": ["IntegerConstant", "FloatingConstant", "DigitSequence"],
    "WS": ["Whitespace", "Newline"],

    // Literal value constants mapped directly down to static C primitives
    "true": ["True_"],
    "false": ["False_"],
    "null": ["Nulptr"],

    // Structural JSON dividers mapped to matching C punctuators
    "{": ["LeftBrace"],
    "}": ["RightBrace"],
    "[": ["LeftBracket"],
    "]": ["RightBracket"],
    ":": ["Colon"],
    ",": ["Comma"],

    // =====================================================================
    // 3. SUB-ELEMENT LEXICAL FRAGMENTS (Internal Layout Construction)
    // =====================================================================
    "ESC": ["EscapeSequence", "SimpleEscapeSequence"],
    "UNICODE": ["UniversalCharacterName", "HexQuad"],
    "HEX": ["HexadecimalDigit"],
    "SAFECODEPOINT": ["Nondigit", "Digit"],
    "INT": ["DecimalConstant", "OctalConstant"],
    "EXP": ["ExponentPart", "BinaryExponentPart"]
};


// Compiled straight from your CSS tokens to prioritize class positions natively
const ACE_COLORED_CLASSES = [
    "keyword",
    "meta",
    "constant",
    "invalid",
    "support",
    "storage",
    "string",
    "comment",
    "heading",
    "variable",
    "function" // Explicitly included to guarantee rendering dominance
];


const ROSETTA_NEIGHBORHOOD_ASSOCIATIONS = {
    // =====================================================================
    // 1. SYSTEM BASE COMPILATION & PRECOMPILER PIPELINES (6.10)
    // =====================================================================
    "match.intercept.directive.precompiler.import": (t, s) => {
        if (!t.tokenSymbol?.toLowerCase().includes('directive') && !t.tokenRule?.toLowerCase().includes('preproc') && !t.text?.startsWith('#') && !t.ruleHistory?.some(r => r.toLowerCase().includes('directive'))) return null;
        let tag = "keyword.control.import.directive";
        const match = t.text?.match(/(?:#include|import|require)\s*["<]([^">]+)[">]/);
        if (match?.[1]) {
            const cleanTarget = match[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const win = typeof window !== 'undefined' ? window : null;
            return tag + `.target_${cleanTarget}` + ((!win?.__missingHeaders || win.__missingHeaders.has(match[1].trim())) ? ".status_resolved" : ".status_missing.annotation_required");
        }
        return tag + ".err_malformed";
    },

    // =====================================================================
    // 2. EXPRESSIONS, FUNCTION INVOCATIONS, & BUILT-INS (6.5)
    // =====================================================================
    "is_function_call": (t, s) => (!t.tokenSymbol?.includes('Identifier') && t.tokenRule !== 'Identifier') ? null : (s?.[t.tokenIndex + 1]?.text === '(' || ['LeftParen'].includes(s?.[t.tokenIndex + 1]?.tokenSymbol) || t.ruleHistory?.some(r => ['postfixexpression', 'primaryexpression'].includes(r.toLowerCase()))) ? "function.support.function" : null,

    "is_member_access": (t, s) => (!t.tokenSymbol?.includes('Identifier')) ? null : (['.', '->'].includes(s?.[t.tokenIndex - 1]?.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('postfixexpression') && ['.', '->'].includes(s?.[t.tokenIndex - 1]?.text))) ? "variable.other.member" : null,

    "is_pointer_indirection": (t, s) => (!['*', '^'].includes(t.text)) ? null : (s?.[t.tokenIndex + 1]?.tokenSymbol?.includes('Identifier') || ['const', 'volatile', 'restrict'].includes(s?.[t.tokenIndex + 1]?.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('pointer'))) ? "keyword.operator.pointer" : null,

    "is_generic_selection": (t, s) => (t.text === '_Generic' || t.ruleHistory?.some(r => r.toLowerCase().includes('generic'))) ? "keyword.control.generic" : (s?.[t.tokenIndex - 1]?.text === ':' && s?.[t.tokenIndex - 3]?.text === '_Generic') ? "constant.library.generic_assoc" : null,

    "is_builtin_intrinsic": (t, s) => (t.text?.startsWith('__builtin_') || ['__func__', '__FUNCTION__', '__PRETTY_FUNCTION__'].includes(t.text)) ? "support.function.builtin" : null,

    // =====================================================================
    // 3. DECLARATIONS, DEFINITIONS, & SIGNATURE PINPOINTS (6.7)
    // =====================================================================
    "is_function_definition": (t, s) => (!t.tokenSymbol?.includes('Identifier')) ? null : (s?.[t.tokenIndex + 1]?.text === '(' && (t.ruleHistory?.some(r => ['directdeclarator', 'functiondefinition', 'declarator'].includes(r.toLowerCase())) || s?.slice(Math.max(0, t.tokenIndex - 4), t.tokenIndex).some(p => ['int', 'char', 'void', 'float', 'double', 'long', 'short', 'signed', 'unsigned'].includes(p.text?.toLowerCase()) || p.tokenSymbol?.includes('Type') || p.tokenSymbol?.includes('Storage')))) ? "function.entity.name.function" : null,

    "is_parameter_declaration": (t, s) => (!t.tokenSymbol?.includes('Identifier')) ? null : (t.ruleHistory?.some(r => ['parameter', 'declaration', 'argument'].includes(r.toLowerCase())) || (s?.slice(Math.max(0, t.tokenIndex - 10), t.tokenIndex).some(p => p.text === '(' || p.text === ',') && s?.slice(t.tokenIndex + 1, t.tokenIndex + 5).some(n => n.text === ')' || n.text === ','))) ? "variable.parameter" : null,

    "is_typedef_definition": (t, s) => (!t.tokenSymbol?.includes('Identifier')) ? null : (t.ruleHistory?.some(r => r.toLowerCase().includes('typedef')) || s?.slice(Math.max(0, t.tokenIndex - 8), t.tokenIndex).some(p => p.text === 'typedef')) ? "storage.type.typedef_alias" : null,

    "is_type_specifier_keyword": (t, s) => (['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', '_Complex', '__m128', '__m128d', '__m128i', '_Atomic'].includes(t.text) || t.ruleHistory?.some(r => ['typespecifier', 'typename', 'type'].includes(r.toLowerCase())) || t.tokenSymbol?.toLowerCase().includes('type')) ? "storage.type" : null,

    "is_storage_class_modifier": (t, s) => (['auto', 'constexpr', 'extern', 'register', 'static', 'typedef', 'const', 'volatile', 'restrict', 'inline', '_Noreturn'].includes(t.text) || t.ruleHistory?.some(r => ['storageclassspecifier', 'typequalifier', 'functionspecifier', 'storage', 'qualifier', 'modifier'].includes(r.toLowerCase())) || t.tokenSymbol?.toLowerCase().includes('storage') || t.tokenSymbol?.toLowerCase().includes('qualifier') || t.tokenSymbol?.toLowerCase().includes('modifier')) ? "storage.modifier" : null,

    // =====================================================================
    // 4. COMPOSITES, STRUCTURE DESIGNATORS, & ENUMS (6.7.2)
    // =====================================================================
    "is_composite_layout": (t, s) => (['struct', 'union', 'enum'].includes(t.text) || t.ruleHistory?.some(r => ['structorunionspecifier', 'enumspecifier'].includes(r.toLowerCase()))) ? "storage.type.composite" : null,

    "is_designated_initializer": (t, s) => (t.tokenSymbol?.includes('Identifier') && (t.ruleHistory?.some(r => r.toLowerCase().includes('designat')) || (s?.[t.tokenIndex - 1]?.text === '.' && s?.slice(Math.max(0, t.tokenIndex - 4), t.tokenIndex).some(p => p.text === '{' || p.text === ',')))) ? "variable.other.member.designator" : null,

    "is_enum_constant": (t, s) => (t.tokenSymbol?.includes('Identifier') && (t.ruleHistory?.some(r => r.toLowerCase().includes('enumerator')) || ((s?.[t.tokenIndex + 1]?.text === '=' || s?.[t.tokenIndex + 1]?.text === ',' || s?.[t.tokenIndex + 1]?.text === '}') && s?.slice(Math.max(0, t.tokenIndex - 15), t.tokenIndex).some(p => p.text === 'enum')))) ? "constant.library.enum" : null,

    // =====================================================================
    // 5. ATTRIBUTES, DIRECTIVES, & INLINE ASSEMBLERS (GCC / GNU / MSVC)
    // =====================================================================
    "is_attribute_annotation": (t, s) => (['__attribute__', '__declspec'].includes(t.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('attribute')) || s?.[t.tokenIndex - 1]?.text === '[[' || s?.[t.tokenIndex - 2]?.text === '[[') ? "meta.tag.annotation" : null,

    "is_inline_assembly": (t, s) => (t.text?.toLowerCase() === 'asm' || ['__asm', '__asm__'].includes(t.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('asm'))) ? "keyword.control.assembly" : (s?.slice(Math.max(0, t.tokenIndex - 5), t.tokenIndex).some(p => p.text?.toLowerCase() === 'asm')) ? "variable.other.assembly_payload" : null,

    "is_calling_convention": (t, s) => (['__cdecl', '__clrcall', '__stdcall', '__fastcall', '__thiscall', '__vectorcall'].includes(t.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('vcspecificmodifer'))) ? "storage.modifier.calling_convention" : null,

    // =====================================================================
    // 6. STATEMENTS, CONTROL FLOW, & LABELS (6.8)
    // =====================================================================
    "is_control_statement": (t, s) => (['if', 'else', 'switch', 'while', 'do', 'for', 'goto', 'continue', 'break', 'return'].includes(t.text) || t.ruleHistory?.some(r => ['statement', 'selectionstatement', 'iterationstatement', 'jumpstatement'].includes(r.toLowerCase())) || t.tokenSymbol?.toLowerCase().includes('statement') || t.tokenSymbol?.toLowerCase().includes('control') || t.tokenSymbol?.toLowerCase().includes('loop') || t.tokenSymbol?.toLowerCase().includes('branch')) ? "keyword.control" : null,

    "is_case_default_label": (t, s) => (['case', 'default'].includes(t.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('labeledstatement'))) ? "keyword.control.label" : null,

    "is_code_label_assertion": (t, s) => (t.tokenSymbol?.includes('Identifier') && s?.[t.tokenIndex + 1]?.text === ':' && !['case', 'default'].includes(s?.[t.tokenIndex - 1]?.text)) ? "entity.name.label" : (t.text === '__label__') ? "keyword.control.label_declaration" : null,

    // =====================================================================
    // 7. ENCLOSURES, STRUCTURAL PUNCTUATION & ANNOTATIONS
    // =====================================================================
    "is_structural_opening": (t, s) => (['{', '(', '['].includes(t.text)) ? "punctuation.enclosure.opening" : null,

    "is_structural_closing": (t, s) => (['}', ')', ']'].includes(t.text)) ? "punctuation.enclosure.closing" : null,

    "is_structural_separator": (t, s) => ([',', ';', '.'].includes(t.text)) ? "punctuation.separator" : null,

    "is_code_comment": (t, s) => (t.tokenRule?.toLowerCase().includes('comment') || t.tokenSymbol?.toLowerCase().includes('comment') || t.channel === 1) ? "comment" : null,

    "is_fallback_operator_literal": (t, s) => (t.tokenRule?.startsWith("'") && t.tokenRule?.length <= 5) ? "keyword.operator" : null,

    // =====================================================================
    // 8. MULTI-LANGUAGE JSON MAPPING HOOKS & LEAF LEAVES
    // =====================================================================
    "is_json_key": (t, s) => (t.ruleName === 'jsonKey' || t.ruleHistory?.some(r => r.toLowerCase().includes('jsonkey')) || (t.tokenSymbol?.toLowerCase().includes('string') && s?.[t.tokenIndex + 1]?.text === ':')) ? "variable.key" : null,

    "is_json_value": (t, s) => (t.ruleName === 'jsonValue' || t.ruleHistory?.some(r => r.toLowerCase().includes('jsonvalue')) || (s?.[t.tokenIndex - 1]?.text === ':' && !t.tokenSymbol?.includes('Identifier'))) ? "string.value" : null,

    "is_constant_numeric_literal": (t, s) => (['IntegerConstant', 'FloatingConstant', 'CharacterConstant', 'DigitSequence'].includes(t.tokenRule) || ['true', 'false', 'nullptr', 'NULL'].includes(t.text) || t.ruleHistory?.some(r => r.toLowerCase().includes('constant')) || t.tokenSymbol?.toLowerCase().includes('constant') || t.tokenSymbol?.toLowerCase().includes('numeric') || t.tokenSymbol?.toLowerCase().includes('digit')) ? "constant.numeric" : null,

    "is_catchall_variable_fallback": (t, s) => (t.tokenSymbol?.includes('Identifier') || t.tokenRule === 'Identifier' || t.ruleName === 'identifier') ? "variable.other" : null
};


function toRosettaNonRecursive(ruleName, lexerSymbolicName) {
    const parts = [];
    if (ruleName && ROSETTA_RULE_MATRIX[ruleName]) {
        ROSETTA_RULE_MATRIX[ruleName].split('.').forEach(p => parts.push(p));
    }
    if (lexerSymbolicName && ROSETTA_LEXER_MATRIX[lexerSymbolicName]) {
        ROSETTA_LEXER_MATRIX[lexerSymbolicName].split('.').forEach(p => parts.push(p));
    }
    return parts.length > 0 ? parts.join('.') : "text";
}


function structuralPartsAccumulatorPush(array, tag) {
    if (!tag) return;
    tag.split('.').forEach(atom => {
        if (atom && !array.includes(atom)) {
            array.push(atom);
        }
    });
}


function toRosettaToken(symbolicName, ruleName, lexer, parser, ctxOrToken, tokenStream) {
    console.log(`[STREAM PIPELINE] Processing token context via global stream index lookup.`);

    // 1. Setup localized token parsing payload state natively
    const state = {
        symbolicName: symbolicName || "", ruleName: ruleName || "",
        typeInt: null, literalText: "", tokenChannel: 0,
        lexerSymbolicName: "", lexerLiteralName: "",
        tokenIndex: null, ruleHistory: []
    };

    if (ctxOrToken) {
        state.symbolicName = ctxOrToken.symbolicName || ctxOrToken.tokenSymbol || ctxOrToken.tokenRule || state.symbolicName;
        state.ruleName = ctxOrToken.ruleName || state.ruleName;
        state.typeInt = typeof ctxOrToken.tokenType === 'number' ? ctxOrToken.tokenType :
            (typeof ctxOrToken.type === 'number' ? ctxOrToken.type : null);
        state.literalText = ctxOrToken.text || "";
        state.tokenChannel = typeof ctxOrToken.channel === 'number' ? ctxOrToken.channel : 0;
        state.tokenIndex = typeof ctxOrToken.tokenIndex === 'number' ? ctxOrToken.tokenIndex : null;
        state.ruleHistory = ctxOrToken.ruleHistory || [];
    }

    const vocab = lexer?.vocabulary || lexer?.constructor?.vocabulary;
    if (vocab && state.typeInt !== null) {
        state.lexerSymbolicName = vocab.getSymbolicName(state.typeInt) || "";
        state.lexerLiteralName = vocab.getLiteralName(state.typeInt) || "";
    }
    state.symbolicName ||= state.lexerSymbolicName;

    const structuralParts = [];

    // 2. Ingest Flat Non-Recursive Core Categories First
    const coreBaseClass = toRosettaNonRecursive(state.ruleName, state.lexerSymbolicName);
    coreBaseClass.split('.').forEach(p => structuralPartsAccumulatorPush(structuralParts, p));

    const activeStreamTokens = tokenStream?.tokens || tokenStream || [];
    if (state.tokenIndex !== null && activeStreamTokens.length > 0) {

        // Assemble unified configuration payload structure
        const evaluationPayload = {
            tokenIndex: state.tokenIndex,
            tokenSymbol: state.symbolicName,
            tokenRule: state.lexerSymbolicName,
            ruleName: state.ruleName,
            text: state.literalText,
            channel: state.tokenChannel,
            ruleHistory: state.ruleHistory // ◄ Feeds structural history directly to the matcher metrics
        };

        for (const associationKey in ROSETTA_NEIGHBORHOOD_ASSOCIATIONS) {
            const matchResult = ROSETTA_NEIGHBORHOOD_ASSOCIATIONS[associationKey](evaluationPayload, activeStreamTokens);
            if (matchResult) {
                matchResult.split('.').forEach(p => structuralPartsAccumulatorPush(structuralParts, p));
            }
        }
    }

    // 4. Trace the Ancestral Rule Matrix Hierarchy sequentially
    if (state.ruleHistory && state.ruleHistory.length > 0) {
        state.ruleHistory.forEach(ancestorRule => {
            // Unpack dynamic multi-language crossings safely
            if (ROSETTA_CROSS_LANGUAGE_MAPPING[ancestorRule]) {
                ROSETTA_CROSS_LANGUAGE_MAPPING[ancestorRule].forEach(crossCKey => {
                    const nonRecCross = toRosettaNonRecursive(crossCKey, null);
                    if (nonRecCross !== "text") nonRecCross.split('.').forEach(p => structuralPartsAccumulatorPush(structuralParts, p));
                });
            }
            // Append standard base rules if matched
            const nonRecAncestor = toRosettaNonRecursive(ancestorRule, null);
            if (nonRecAncestor !== "text") {
                nonRecAncestor.split('.').forEach(p => structuralPartsAccumulatorPush(structuralParts, p));
            }
        });
    }

    // Remove text keywords from active tokens lists if a specialized class is present
    let finalTokens = structuralParts.filter((item, idx) => structuralParts.indexOf(item) === idx);
    if (finalTokens.length > 1 && finalTokens.includes("text")) {
        finalTokens = finalTokens.filter(t => t !== "text");
    }
    if (finalTokens.includes("key") || finalTokens.includes("jsonkey") || state.ruleName === 'jsonKey') {
        // Purge all leaked C storage components, expression statements, and numerical operators
        finalTokens = finalTokens.filter(t => ![
            "keyword", "constant", "storage", "type", "operator",
            "assignmentexpression", "compoundstatement", "numeric", "text"
        ].includes(t.toLowerCase()));

        // Ensure variable dominance is locked down at the front line
        if (!finalTokens.includes("variable")) finalTokens.unshift("variable");
    }
    // If we are looking at an explicit JSON literal string value context
    else if (state.ruleName === 'jsonValue' && finalTokens.includes("string")) {
        // Strip out cross-language leaks like numeric constants or operator states
        finalTokens = finalTokens.filter(t => !["constant", "numeric", "operator", "keyword"].includes(t.toLowerCase()));
        if (!finalTokens.includes("string")) finalTokens.unshift("string");
    }
    // 5. Enforce Theme Dominance Layer Order Sorting
    for (let i = ACE_COLORED_CLASSES.length - 1; i >= 0; i--) {
        const targetClass = ACE_COLORED_CLASSES[i];
        if (finalTokens.includes(targetClass)) {
            const classIndex = finalTokens.indexOf(targetClass);
            finalTokens.splice(classIndex, 1);
            finalTokens.unshift(targetClass);
        }
    }

    // Append debugger metadata fields onto output trace blocks
    if (state.lexerSymbolicName) finalTokens.push(`lex_${state.lexerSymbolicName.toLowerCase()}`);
    if (state.ruleName) finalTokens.push(`rule_${state.ruleName.toLowerCase()}`);
    if (state.tokenChannel !== 0) finalTokens.push(`chan_${state.tokenChannel}`);
    if (state.typeInt !== null) finalTokens.push(`idx_${state.typeInt}`);

    return finalTokens.join('.');
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

    const tokenType = token.type;
    const ruleIndex = ctx ? ctx.ruleIndex : null;

    // Extract vocabulary managers natively from the runtime engine instances
    const lexerVocab = lexer?.vocabulary || lexer?.constructor?.vocabulary;
    const parserVocab = parser?.vocabulary || parser?.constructor?.vocabulary;

    // Resolve the clean, authentic symbolic rule names via the vocabulary contracts
    const trueLexerRuleName = lexerVocab ? lexerVocab.getSymbolicName(tokenType) : "Text";

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
        // UNIFIED COMPATIBILITY MATRIX DATA (FIXED ANTLR RUNTIME ALIGNMENT)
        // =====================================================================
        tokenIndex: typeof token.tokenIndex === 'number' ? token.tokenIndex : null, // ◄ Physical index in file stream
        tokenType: tokenType,                                                       // ◄ The ANTLR numerical ID (e.g., 134)
        tokenMode: lexer && lexer.constructor?.modeNames ? lexer.constructor.modeNames[lexer._mode] : "default",

        // Vocabulary lookups resolve names correctly by absolute vocabulary contract bounds
        tokenNames: lexerVocab ? lexerVocab.getLiteralName(tokenType) : null,
        tokenSymbol: lexerVocab ? lexerVocab.getSymbolicName(tokenType) : null,
        tokenRule: trueLexerRuleName,

        symbolIndex: ruleIndex,
        symbolicName: (parserVocab && ruleIndex !== null) ? parserVocab.getSymbolicName(ruleIndex) : null,
        literalName: (parserVocab && ruleIndex !== null) ? parserVocab.getLiteralName(ruleIndex) : null,
        ruleName: (parser && ruleIndex !== null && parser.ruleNames) ? parser.ruleNames[ruleIndex] : null
    };
}



const ROSETTA_BLOCK_ASSOCIATIONS = {
    // ─── C-STYLE LANGUAGES: BRACE MATCHING WITH TYPE HEADERS ───
    c: {
        open: /^[ \t]*(?:static\s+|inline\s+|extern\s+)?(?:[\w\d_*]+[ \t]+)+[\w\d_*]+\s*\([^)]*\)\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    cpp: {
        open: /^[ \t]*(?:template\s*<[^>]*>\s*)?(?:class|struct|namespace|(?:(?:inline\s+|static\s+|virtual\s+)?[\w\d_:<>]+\s+)+[\w\d_*~]+)\s*(?:\([^)]*\))?\s*(?::\s*[\w\d_:<>, ]+)?\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    csharp: {
        open: /^[ \t]*(?:public|private|protected|internal|static|async|virtual|override|partial\s+)*(?:class|struct|interface|namespace|enum|(?:[\w\d_:<>]+\s+)+[\w\d_]+)\s*(?:\([^)]*\))?\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    java: {
        open: /^[ \t]*(?:public|private|protected|static|final|native|synchronized|abstract\s+)*(?:class|interface|enum|(?:[\w\d_:<>]+\s+)+[\w\d_]+)\s*\([^)]*\)\s*(?:throws\s+[\w\d_, ]+)?\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    angelscript: {
        open: /^[ \t]*(?:class|interface|shared|abstract|(?:(?:private|protected|inline)?\s*[\w\d_*@<>]+\s+)+[\w\d_*]+)\s*\([^)]*\)\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },

    // ─── WEB ENGINEERING & SCRIPTS ───
    javascript: {
        open: /^[ \t]*(?:async\s+)?function\s*[\w\d_*]*\s*\([^)]*\)|^[ \t]*(?:const|let|var)\s+[\w\d_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|^[ \t]*(?:public|private|static|async\s+)?[\w\d_]+\s*\([^)]*\)\s*\{/gm,
        close: "{}",
        isKeywordClose: false
    },
    typescript: {
        open: /^[ \t]*(?:export\s+)?(?:async\s+)?function\s*[\w\d_*]*\s*\([^)]*\)|^[ \t]*(?:interface|type|class|namespace)\s+[\w\d_]+|^[ \t]*(?:public|private|protected|static|readonly|async\s+)*[\w\d_]+\s*\([^)]*\)\s*[:\w\d_<>]*\s*\{/gm,
        close: "{}",
        isKeywordClose: false
    },
    html: {
        open: /<([a-zA-Z1-6]+)(?:\s+[^>]*)*>/gm,
        close: "xml", // Forces an explicit tag name stack tracker
        isKeywordClose: false
    },
    xml: {
        open: /<([a-zA-Z0-9_.:-]+)(?:\s+[^>]*)*>/gm,
        close: "xml",
        isKeywordClose: false
    },
    css3: {
        open: /^[ \t]*[.#\w\d_:\s,>+~[\]*=-]+\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    json: {
        open: /"[\w\d_]+"\s*:\s*\{|\[/gm,
        close: "{}",
        isKeywordClose: false
    },

    // ─── KEYWORD-BOUNDED SCRIPTING LAYERS ───
    lua: {
        open: /^[ \t]*(?:local\s+)?function\s+[\w\d_.]+\s*\([^)]*\)|^[ \t]*while\s+.*do\b|^[ \t]*for\s+.*do\b|^[ \t]*if\s+.*then\b/gm,
        close: /\b(end)\b/i,
        isKeywordClose: true
    },
    python3: {
        open: /^[ \t]*(?:def|class)\s+[\w\d_]+\s*(?:\([^)]*\))?\s*:/gm,
        close: "indent", // Python closes when indentation levels decrease
        isKeywordClose: false
    },
    python2: {
        open: /^[ \t]*(?:def|class)\s+[\w\d_]+\s*(?:\([^)]*\))?\s*:/gm,
        close: "indent",
        isKeywordClose: false
    },
    php: {
        open: /^[ \t]*(?:public|private|protected|static|final\s+)*function\s+[\w\d_]+\s*\([^)]*\)\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    rust: {
        open: /^[ \t]*(?:pub\s*(?:\([^)]*\))?\s*)?(?:unsafe\s+)?(?:async\s+)?(?:fn|struct|enum|impl|trait|mod)\b[^\{]*/gm,
        close: "{}",
        isKeywordClose: false
    },
    golang: {
        open: /^[ \t]*func\s*(?:\([^)]*\))?\s*[\w\d_]*\s*\([^)]*\)[^\{]*/gm,
        close: "{}",
        isKeywordClose: false
    },

    // ─── UTILITIES & DATA CONFIGURATIONS ───
    terraform: {
        open: /^[ \t]*(?:resource|variable|provider|output|module|locals)\s+[^\{]*/gm,
        close: "{}",
        isKeywordClose: false
    },
    protobuf3: {
        open: /^[ \t]*(?:message|service|enum)\s+[\w\d_]+\s*(?=\{)/gm,
        close: "{}",
        isKeywordClose: false
    },
    cmake: {
        open: /\b(function|macro|foreach|while|if)\s*\(/gim,
        close: /\b(endfunction|endmacro|endforeach|endwhile|endif)\s*\(/gim,
        isKeywordClose: true
    },
    powershell: {
        open: /^[ \t]*function\s+[\w\d_-]+\s*(?=\{|\(|[ \t\n]|$)/gim,
        close: "{}",
        isKeywordClose: false
    },
    bash: {
        open: /^[ \t]*function\s+[\w\d_-]+|[\w\d_-]+\s*\(\s*\)\s*\{|^\s*\b(if|for|while|case)\b/gm,
        close: /\b(fi|done|esac|\})\b/gm,
        isKeywordClose: true
    },
    sql: {
        open: /\b(create\s+or\s+replace\s+(?:procedure|function|package|trigger)|begin)\b/gim,
        close: /\b(end)\b/gim,
        isKeywordClose: true
    },
    wat: {
        open: /\((module|func|type|import|export|table|memory|global)\b/gm,
        close: "()",
        isKeywordClose: false
    },
    quakemap: {
        open: /^[ \t]*\(\s*[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+\s*\)/gm, // Brushes open on face declarations
        close: "{}",
        isKeywordClose: false
    }
};

// Mirror baseline aliases natively
ROSETTA_BLOCK_ASSOCIATIONS['plsql'] = ROSETTA_BLOCK_ASSOCIATIONS['sql'];
ROSETTA_BLOCK_ASSOCIATIONS['tsql'] = ROSETTA_BLOCK_ASSOCIATIONS['sql'];
ROSETTA_BLOCK_ASSOCIATIONS['postgresql'] = ROSETTA_BLOCK_ASSOCIATIONS['sql'];
ROSETTA_BLOCK_ASSOCIATIONS['sqlite'] = ROSETTA_BLOCK_ASSOCIATIONS['sql'];


function extractCurrentBlock(codeStr, lineNumber, langId) {
    const lines = codeStr.split('\n');
    const totalLines = lines.length;

    // Fallback safely to plaintext if language mappings are absent
    const rules = ROSETTA_BLOCK_ASSOCIATIONS[langId] || { open: null, close: "{}", isKeywordClose: false };
    if (!rules.open) {
        return { text: codeStr, startLine: 1, endLine: totalLines, startIndex: 0, endIndex: codeStr.length };
    }

    // Build the character line offset indexes array for positional lookup
    const lineOffsets = [];
    let currentOffset = 0;
    lines.forEach(line => {
        lineOffsets.push(currentOffset);
        currentOffset += line.length + 1; // Accumulate char count plus trailing newline
    });

    const cursorLineIndex = Math.min(Math.max(1, lineNumber), totalLines) - 1;
    let foundHeaderIdx = -1;
    let matchOffset = -1;

    // 1. SCAN UPWARD: Locate the closest active block header boundary
    for (let l = cursorLineIndex; l >= 0; l--) {
        rules.open.lastIndex = 0;
        const lineText = lines[l];
        const match = rules.open.exec(lineText);

        if (match) {
            foundHeaderIdx = l;
            matchOffset = lineOffsets[l] + match.index;
            break;
        }
    }

    // If no header matches above the cursor line, return the absolute global file bounds
    if (foundHeaderIdx === -1) {
        return { text: codeStr, startLine: 1, endLine: totalLines, startIndex: 0, endIndex: codeStr.length };
    }

    // 2. SCAN DOWNWARD: Trace the depth counter limits until the block balances out
    let depth = 0;
    let endLineIdx = foundHeaderIdx;
    let endCharOffset = matchOffset;
    let blockStarted = false;

    // Handle HTML/XML explicit Tag Stack tracking systems
    let xmlTagName = null;
    if (rules.close === "xml") {
        rules.open.lastIndex = 0;
        const tagMatch = rules.open.exec(lines[foundHeaderIdx]);
        xmlTagName = tagMatch ? tagMatch[1] : null;
    }

    for (let l = foundHeaderIdx; l < totalLines; l++) {
        const text = lines[l];
        endLineIdx = l;

        // Python block validation: Closes out whenever an indentation drop occurs
        if (rules.close === "indent") {
            const currentIndent = text.search(/\S/);
            const headerIndent = lines[foundHeaderIdx].search(/\S/);
            if (blockStarted && currentIndent !== -1 && currentIndent <= headerIndent) {
                endLineIdx = Math.max(foundHeaderIdx, l - 1);
                endCharOffset = lineOffsets[endLineIdx] + lines[endLineIdx].length;
                break;
            }
            if (currentIndent !== -1 && l > foundHeaderIdx) blockStarted = true;
            endCharOffset = lineOffsets[l] + text.length;
            continue;
        }

        // Standard Text Character/Brace Token Stream Balancer
        if (!rules.isKeywordClose) {
            const openChar = rules.close[0] || '{';
            const closeChar = rules.close[1] || '}';

            for (let c = 0; c < text.length; c++) {
                const char = text[c];
                if (char === openChar) { depth++; blockStarted = true; }
                else if (char === closeChar) { depth--; }

                if (blockStarted && depth <= 0) {
                    endCharOffset = lineOffsets[l] + c + 1;
                    break;
                }
            }
        }
        // Keyword Token Match Balancer (e.g., Lua `if ... then` -> `end`, bash `if` -> `fi`)
        else {
            rules.open.lastIndex = 0;
            if (rules.open.test(text)) { depth++; blockStarted = true; }

            rules.close.lastIndex = 0;
            if (rules.close.test(text)) { depth--; }

            if (blockStarted && depth <= 0) {
                endCharOffset = lineOffsets[l] + text.length;
                break;
            }
        }

        if (blockStarted && depth <= 0) break;
        endCharOffset = lineOffsets[l] + text.length;
    }

    // Return the packaged functional block payload slice
    return {
        text: codeStr.slice(matchOffset, endCharOffset),
        startLine: foundHeaderIdx + 1,
        endLine: endLineIdx + 1,
        startIndex: matchOffset,
        endIndex: endCharOffset
    };
}



/**
 * Agnostic ANTLR Visitor that dynamically captures multi-line code blocks 
 * across any grammar based on universal rule structural names.
 */
class AntlrBlockCollectorVisitor {
    constructor(parser) {
        this.parser = parser;
        this.blocks = [];
        
        // Explicit list of known block-defining rule signatures across your 40 languages
        this.blockRuleIdentifiers = new Set([
            "compoundstatement", "functionbody", "blockitemlist", "block",
            "obj", "arr", "initializerlist", "memberdeclarationlist",
            "statement", "selectionstatement", "iterationstatement",
            "asmdatapayload", "assembly_payload", "methoddeclaration"
        ]);
    }

    /**
     * Entry execution hook to scan the generated AST
     */
    collect(tree) {
        if (!tree) return this.blocks;
        this.visit(tree);
        return this.blocks;
    }

    /**
     * Recursive structural tree walker node pass
     */
    visit(ctx) {
        if (!ctx) return;

        if (ctx.ruleIndex !== undefined) {
            const rawRuleName = this.parser.ruleNames[ctx.ruleIndex];
            const lowerRuleName = rawRuleName ? rawRuleName.toLowerCase() : "";

            // If the current node represents a multi-line structural container boundary
            if (this.blockRuleIdentifiers.has(lowerRuleName) && ctx.start && ctx.stop) {
                const startToken = ctx.start;
                const endToken = ctx.stop;

                const startLine = startToken.line;
                const endLine = endToken.line;

                // Only log and harvest blocks that span across multiple line rows
                if (startLine < endLine) {
                    this.blocks.push({
                        ruleName: rawRuleName,
                        startLine: startLine,
                        endLine: endLine,
                        startIndex: startToken.start,
                        endIndex: endToken.stop + 1
                    });
                }
            }
        }

        // Deep-walk through all child tree node branches sequentially
        if (ctx.children && ctx.children.length > 0) {
            for (let i = 0; i < ctx.children.length; i++) {
                this.visit(ctx.children[i]);
            }
        }
    }
}