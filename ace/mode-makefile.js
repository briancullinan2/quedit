define("ace/mode/makefile_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            
            var makeKeywords = "ifeq|ifneq|ifdef|ifndef|else|endif|include|-include|sinclude|" +
                               "define|endef|export|unexport|override|private|vpath";

            var makeFunctions = "subst|patsubst|strip|findstring|filter|filter-out|sort|word|wordlist|words|" +
                                "firstword|lastword|dir|notdir|suffix|basename|addsuffix|addprefix|join|" +
                                "wildcard|realpath|abspath|error|warning|info|origin|flavor|foreach|if|or|and|" +
                                "value|eval|file|call|shell";

            var keywordMapper = this.createKeywordMapper({
                "keyword.control.makefile": makeKeywords
            }, "identifier");

            this.$rules = {
                "start": [
                    {
                        token: "comment.line",
                        regex: "#.*$"
                    },
                    {
                        token: keywordMapper,
                        // Fixed: Changed (?> back to a safe JavaScript non-capturing group (?:
                        regex: "^\\s*\\b(?:ifeq|ifneq|ifdef|ifndef|else|endif|include|-include|sinclude|define|endef|export|unexport|override|private|vpath)\\b"
                    },
                    {
                        token: ["variable.assignment", "keyword.operator.assignment"],
                        regex: "^\\s*([A-Za-z0-9_\\-\\.]+)\\s*([::\\?\\+\\!]*=)"
                    },
                    {
                        token: ["entity.name.function.target", "punctuation.separator.target"],
                        regex: "^\\s*([^:\\t\\n=]+)\\s*(:)(?!=)"
                    },
                    {
                        token: ["punctuation.definition.variable", "support.function.builtin", "text"],
                        regex: "(\\x24\\x28)(" + makeFunctions + ")(\\s+)",
                        push: "function_arguments_paren"
                    },
                    {
                        token: ["punctuation.definition.variable", "support.function.builtin", "text"],
                        regex: "(\\x24\\x7b)(" + makeFunctions + ")(\\s+)",
                        push: "function_arguments_brace"
                    },
                    {
                        token: "variable.parameter",
                        regex: "\\x24\\x28[^\\x29]+\\x29|\\x24\\x7b[^\\x7d]+\\x7d"
                    },
                    {
                        token: "variable.language.automatic",
                        regex: "\\x24[@<\\^\\*\\?%\\+\\|]"
                    },
                    {
                        token: "string.interpolated.recipe",
                        regex: "^\\t.*$"
                    },
                    { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },
                    { token: "string", regex: "'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'" },
                    { token: "keyword.operator", regex: "\\x5c\\r?\\n" }
                ],
                "function_arguments_paren": [
                    { token: "punctuation.definition.variable", regex: "\\x29", next: "pop" },
                    { include: "start" },
                    { defaultToken: "string.argument" }
                ],
                "function_arguments_brace": [
                    { token: "punctuation.definition.variable", regex: "\\x7d", next: "pop" },
                    { include: "start" },
                    { defaultToken: "string.argument" }
                ]
            };
            
            this.normalizeRules();
        };
        
    r.inherits(s, i), t.MakefileHighlightRules = s;
});

define("ace/mode/makefile", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/makefile_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./makefile_highlight_rules").MakefileHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = "#";
        this.$indentWithTabs = true;
        this.$id = "ace/mode/makefile";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    window.require(["ace/mode/makefile"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();