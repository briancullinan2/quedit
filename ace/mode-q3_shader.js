define("ace/mode/q3_shader_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            
            // Global properties and Map compiler instructions (case-insensitive checks)
            const globalDirectives = "surfaceparm|cull|tesssize|deformVertexes|fogparms|fogonly|skyparms|" +
                                     "q3map_surfacelight|q3map_lightimage|q3map_[a-zA-Z0-9_]+|qer_editorimage|qer_nocarve|qer_[a-zA-Z0-9_]+";

            // Stage-specific directives
            const stageDirectives = "map|clampmap|animMap|videoMap|blendFunc|blendfunc|rgbGen|alphaGen|tcMod|tcGen|depthFunc|depthWrite|alphaFunc";

            // OpenGL Blend modes constants
            const glConstants = "GL_ONE|GL_ZERO|GL_DST_COLOR|GL_SRC_COLOR|GL_ONE_MINUS_DST_COLOR|GL_ONE_MINUS_SRC_COLOR|" +
                                "GL_DST_ALPHA|GL_SRC_ALPHA|GL_ONE_MINUS_DST_ALPHA|GL_ONE_MINUS_SRC_ALPHA";

            // Known Engine Surface parameters
            const surfaceParms = "metalsteps|nolightmap|noimpact|trans|nonsolid|fog|lava|slime|water|sky|nodrop|slick|nodlight|" +
                                 "playerclip|monsterclip|shotclip|origin|antiportal|skip|lightfilter|alphashadow|hint|structural|detail";

            // Waveform and texture coordinate manipulators
            const modifiers = "identity|wave|sin|square|triangle|sawtooth|inversesawtooth|noise|turb|scale|scroll|stretch|transform|rotate|disable";

            this.$rules = {
                "start": [
                    // Single line C++ comments
                    { token: "comment", regex: "\\/\/.*$" },
                    
                    // Main Shader Definition Header / Filepaths (e.g. textures/eerie/floor)
                    { token: "entity.name.tag", regex: "^[a-zA-Z0-9_\\-\\/.\\$]+$" },
                    
                    // Braces
                    { token: "paren.lparen", regex: "{" },
                    { token: "paren.rparen", regex: "}" },
                    
                    // Texture references / Image assets paths
                    { token: "string.path", regex: "\\b[a-zA-Z0-9_\\-\\/.]+\\.(?:tga|jpg|png|pcx)\\b" },
                    
                    // Internal functional assets keywords (like $lightmap or $whiteimage)
                    { token: "variable.language", regex: "\\$[a-zA-Z0-9_]+" },
                    
                    // Core Keywords / Directives 
                    { 
                        token: "keyword.control", 
                        regex: "\\b(?:" + globalDirectives + "|" + stageDirectives + ")\\b",
                        caseInsensitive: true
                    },
                    
                    // GL Blend state parameters
                    { 
                        token: "constant.language", 
                        regex: "\\b(?:" + glConstants + ")\\b",
                        caseInsensitive: true
                    },
                    
                    // Fixed Values / Waveforms / Math triggers
                    { 
                        token: "support.function", 
                        regex: "\\b(?:" + modifiers + ")\\b",
                        caseInsensitive: true
                    },
                    
                    // Surface Parameter Flags
                    { 
                        token: "support.constant", 
                        regex: "\\b(?:" + surfaceParms + ")\\b",
                        caseInsensitive: true
                    },
                    
                    // Numeric parameters (floating values, negatives, scalars)
                    { token: "constant.numeric", regex: "\\b-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\b" }
                ]
            };
            
            this.normalizeRules();
        };
    r.inherits(s, i), t.Q3ShaderHighlightRules = s;
});

define("ace/mode/q3_shader", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_shader_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_shader_highlight_rules").Q3ShaderHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = "//";
        this.$id = "ace/mode/q3_shader";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    window.require(["ace/mode/q3_shader"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();
