ace.define("ace/ext/compiler_diagnostics", [
    "require",
    "exports",
    "module",
    "ace/config",
    "ace/lib/dom"
], function (require, exports, module) {
    "use strict";

    // Add these to your Diagnostic Bridge configuration
    const DIAGNOSTIC_PARSERS = [
        {
            name: "clang_lcc",
            // Matches: code/game/g_main.c:25: error: missing semi-colon
            pattern: /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i,
            resolve: function (match, bridge) {
                return {
                    filePath: match[1].trim(),
                    row: parseInt(match[2], 10) - 1,
                    type: match[3].toLowerCase() === 'error' ? 'error' : 'warning',
                    text: match[4].trim()
                };
            }
        },
        {
            name: "quake_shader_parser",
            // Matches: WARNING: expecting '{', found 'INVALID' instead in shader 'textures/gothic/floor'
            // Or: WARNING: unknown general shader parameter 'bad_keyword' in 'scripts/sfx.shader'
            pattern: /WARNING:\s*([^'\n]+)'\s*instead\s*in\s*shader\s*'([^']+)'|WARNING:\s*unknown\s*general\s*shader\s*parameter\s*'([^']+)'\s*in\s*'([^']+)'/i,
            resolve: function (match, bridge) {
                // Check which capture group hit based on the Printf outputs in ParseShader
                let infoText = match[1] ? `Expecting '{', found '${match[1]}'` : `Unknown general shader parameter '${match[3]}'`;
                let shaderOrFile = match[2] || match[4];

                // Shaders are named by texture path, but we map them to their script definition file
                let filePath = shaderOrFile.endsWith('.shader') ? shaderOrFile : bridge.lookupShaderFile(shaderOrFile);

                return {
                    filePath: filePath,
                    row: bridge.findLineInFile(filePath, match[2] || match[3]) || 0, // Fallback locator strategy
                    type: "warning",
                    text: infoText
                };
            }
        },
        {
            name: "quake_asset_missing",
            // Matches: Couldn't find image file for shader gfx/2d/sunflare
            // Or: WARNING: models/mapobjects/energy.tga not present, using .jpg instead
            pattern: /(?:Couldn't find image file for shader|WARNING:)\s*([^\s\n]+)(?:\s*not present)?/i,
            resolve: function (match, bridge) {
                let assetPath = match[1];
                // Identify which shader is crying about the missing asset texture dependency
                let filePath = bridge.findShaderByAssetDependency(assetPath);

                return {
                    filePath: filePath,
                    row: bridge.findLineInFile(filePath, assetPath) || 0,
                    type: "error",
                    text: `Missing Asset Dependency: Could not resolve binary path for [${assetPath}]`
                };
            }
        },
        {
            name: "quake_skin_failure",
            // Matches: Torso skin load failure: models/players/doom/upper_red.skin
            pattern: /(Leg|Torso|Head)\s*skin\s*load\s*failure:\s*([^\s\n]+)/i,
            resolve: function (match, bridge) {
                let component = match[1];
                let skinFile = match[2];
                return {
                    filePath: skinFile,
                    row: 0, // Skin files are often single line registrations, highlight header
                    type: "error",
                    text: `${component} model segment mapping failed to bind cleanly.`
                };
            }
        }
    ];

    // Simulating x-mode (verbose regex) by joining an array of strings with comments
    const FILE_NAME_REGEX = new RegExp([
        '(?:',
        // Group 1: Captures full URLs or relative/absolute file paths
        '([a-z]+://[^\\s:]+|[\\w\\d._\\-/]+\\.[\\w\\d._\\-]+)',
        ')',
        '(?:',
        // Line capture variations
        '(?:,\\s*Line:\\s*(\\d+))', // Handles "File: path, Line: 324"
        '|',
        '(?::(\\d+))',              // Handles "path:324"
        ')?',
        '(?::(\\d+))?'                  // Handles secondary column offsets if present "path:324:10"
    ].join(''), 'gi');

    let MONITOR_LCC = /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i;

    let CLEAN_ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;


    let config = require("../config");
    let dom = require("../lib/dom");
    function DiagnosticsBridge() {
        this.activeEditor = null;
        this.collectedLogLines = [];
        this.timer = null;
        this.delay = 250;

        this.fileAnnotationsMap = { "system": [] };

        this.workerAnnotations = [];

        this.lccPattern = MONITOR_LCC;
        this.fileNameRegex = FILE_NAME_REGEX;
    }

    DiagnosticsBridge.prototype.setWorkerAnnotations = function (annotationsArray) {
        // Cache the worker payload safely away from string clobber loops
        this.workerAnnotations = annotationsArray || [];

        // Trigger the view layer synchronization
        this.refreshActiveEditorView();
    };

    DiagnosticsBridge.prototype.attach = function (editor) {
        this.activeEditor = editor;
        this.initMouseInterceptors(editor);
        this.log("system:1: warning: Worker Error Reporting Connected");
    };
    DiagnosticsBridge.prototype.initMouseInterceptors = function (editor) {
        let _self = this;
        editor.on("mousemove", function (e) {
            let position = e.getDocumentPosition();
            let session = editor.getSession();
            let container = editor.container;

            container.removeAttribute('data-compiler-error');
            container.removeAttribute('data-navigation-target');

            // 1. LOOSE HIT-BOX FILTER: Catch any error on this row
            let activeAnnotations = session.getAnnotations().filter(function (ann) {
                if (ann.row !== position.row) return false;

                // If the annotation doesn't have a specific column, or it's 0, it applies line-wide
                if (typeof ann.column !== "number" || ann.column === 0) return true;

                // If it DOES have a column, let's create a friendly 4-character padding threshold 
                // so the user doesn't have to pixel-perfectly target a single character
                return position.column >= (ann.column - 4);
            });

            if (activeAnnotations.length > 0) {
                let tooltipText = activeAnnotations.map(function (ann) {
                    return "[" + ann.type.toUpperCase() + "] " + ann.text;
                }).join('\n');

                container.setAttribute('data-compiler-error', tooltipText);
                editor.renderer.getMouseEventTarget().style.cursor = "text";
                return;
            }

            let token = session.getTokenAt(position.row, position.column);
            if (token && (token.type === "storage.type" || token.type === "entity.name.function")) {
                container.setAttribute('data-navigation-target', token.value);
                editor.renderer.getMouseEventTarget().style.cursor = "pointer";
                return;
            }

            editor.renderer.getMouseEventTarget().style.cursor = "text";
        });

        editor.on("mouseleave", function () {
            editor.container.removeAttribute('data-compiler-error');
            editor.container.removeAttribute('data-navigation-target');
        });
    };

    DiagnosticsBridge.prototype.log = function (message) {
        if (!message) return;
        let lines = message.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            let cleanLine = lines[i].trim();
            if (cleanLine) {
                this.collectedLogLines.push(cleanLine);
            }
        }
        this.triggerDebouncedUpdate();
    };

    DiagnosticsBridge.prototype.clear = function () {
        this.collectedLogLines = ["system:1: warning: Worker Error Reporting Connected"];
        if (this.activeEditor) {
            this.activeEditor.getSession().clearAnnotations();
        }
        this.triggerDebouncedUpdate();
    };

    DiagnosticsBridge.prototype.triggerDebouncedUpdate = function () {
        let _self = this;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            _self.processAnnotations();
        }, this.delay);
    };

    DiagnosticsBridge.prototype.processAnnotations = function () {
        let cleanMegaString = this.collectedLogLines
            .map(function (item) { return typeof item === 'string' ? item : (item.text || ""); })
            .join("")
            .replace(CLEAN_ANSI, "");

        let consolidatedLines = cleanMegaString.split(/\r?\n/);
        this.fileAnnotationsMap = { "system": [] };

        for (let i = 0; i < consolidatedLines.length; i++) {
            let line = consolidatedLines[i].trim();
            if (!line) continue;

            // Iterate through all polymorphic layout engines
            for (let p = 0; p < DIAGNOSTIC_PARSERS.length; p++) {
                let parser = DIAGNOSTIC_PARSERS[p];
                let match = line.match(parser.pattern);

                if (match) {
                    let diagnostic = parser.resolve(match, this);
                    if (diagnostic && diagnostic.filePath) {
                        let path = diagnostic.filePath;
                        if (!this.fileAnnotationsMap[path]) {
                            this.fileAnnotationsMap[path] = [];
                        }
                        this.fileAnnotationsMap[path].push({
                            row: diagnostic.row,
                            column: undefined, // Tell the view layer that this error has NO known explicit token position
                            text: diagnostic.text,
                            type: diagnostic.type
                        });
                    }
                    break; // Handled by this parser rule, break inner loop execution
                }
            }
        }

        // Refresh annotations visually across the active viewport interface
        this.refreshActiveEditorView();
    };

    DiagnosticsBridge.prototype.refreshActiveEditorView = function () {
        if (!this.activeEditor) return;

        let session = this.activeEditor.getSession();

        let currentFile = window?.currentSession(window.currentOpenFileId || session.id, session)
            || window.currentOpenFileId || session.id || "";

        // Clear old DOM visual elements safely
        if (!this.activeMarkerIds) { this.activeMarkerIds = []; }
        for (let m = 0; m < this.activeMarkerIds.length; m++) {
            session.removeMarker(this.activeMarkerIds[m]);
        }
        this.activeMarkerIds = [];

        // Extract terminal engine annotations
        let systemAnnotations = this.fileAnnotationsMap["system"] || [];
        let targetAnnotations = [];

        let keys = Object.keys(this.fileAnnotationsMap);
        for (let i = 0; i < keys.length; i++) {
            let cachedFileKey = keys[i];
            if (cachedFileKey !== "system" && currentFile.endsWith(cachedFileKey)) {
                targetAnnotations = this.fileAnnotationsMap[cachedFileKey];
                break;
            }
        }

        // COMBINE THE WORLD STATES: 
        // Merge terminal stream errors AND raw background worker syntax rules cleanly!
        let finalAnnotations = systemAnnotations
            .concat(targetAnnotations)
            .concat(this.workerAnnotations);

        // Apply the full aggregated layout to the gutter badges
        session.setAnnotations(finalAnnotations);

        // Render the underline squigglies across all active arrays
        if (finalAnnotations.length === 0) return;

        let Range = ace.require("ace/range").Range;

        for (let a = 0; a < finalAnnotations.length; a++) {
            let anno = finalAnnotations[a];
            var row = anno.row;
            let lineText = session.getLine(row) || "";

            // FIX: Only use the explicit column if it is a valid, positive, non-zero number coordinate
            var startColumn = (typeof anno.column === "number" && anno.column > 0) ? anno.column : 0;
            var endColumn = lineText.length || 1;

            // If we don't have a targeted sub-character column offset, skip the indentation spaces safely
            if (typeof anno.column !== "number" || anno.column === 0) {
                let firstCharMatch = lineText.match(/^\s*/);
                if (firstCharMatch) {
                    startColumn = firstCharMatch[0].length;
                }
            }

            let markerRange = new Range(row, startColumn, row, endColumn);
            let markerClass = (anno.type === "error") ? "compiler-error-marker" : "compiler-warning-marker";

            let markerId = session.addMarker(markerRange, markerClass, "text", false);
            this.activeMarkerIds.push(markerId);
        }
    };
    DiagnosticsBridge.prototype.fileAnnotations = function (cachedFileKey) {
        return fileAnnotationsMap[cachedFileKey].slice(0);
    }

    DiagnosticsBridge.prototype.clear = function () {
        this.collectedLogLines = ["system:1: warning: Worker Error Reporting Connected"];
        this.fileAnnotationsMap = {};
        if (this.activeEditor) {
            this.activeEditor.getSession().clearAnnotations();
        }
        this.triggerDebouncedUpdate();
    };


    /**
     * Resolves a global shader definition target (e.g., "textures/gothic/floor")
     * back to the specific .shader file inside the virtual file system index.
     */
    DiagnosticsBridge.prototype.lookupShaderFile = function (shaderName) {
        // In your file structure index, look inside your script caches
        // Fallback safely if no match:
        return "scripts/base.shader";
    };

    /**
     * Searches the raw text contents of an open script tab buffer to find the 
     * approximate token line number when the engine omits an absolute row index.
     */
    DiagnosticsBridge.prototype.findLineInFile = function (filePath, token) {
        if (!sessionCache[filePath]) return 0;
        let text = sessionCache[filePath].getValue();
        let lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(token)) {
                return i;
            }
        }
        return 0;
    };

    /**
     * Scans shader definitions to find out which script tab is referencing a failing asset file.
     */
    DiagnosticsBridge.prototype.findShaderByAssetDependency = function (assetPath) {
        // Strips extensions to match base maps cleanly
        let baseToken = assetPath.replace(/\.(tga|jpg)$/i, "");

        let activeFiles = Object.keys(sessionCache);
        for (let f = 0; f < activeFiles.length; f++) {
            let path = activeFiles[f];
            if (path.endsWith('.shader')) {
                if (sessionCache[path].getValue().includes(baseToken)) {
                    return path;
                }
            }
        }
        return window.currentOpenFileId || "scripts/base.shader";
    };



    let bridgeInstance = new DiagnosticsBridge();

    exports.log = function (msg) { bridgeInstance.log(msg); };
    exports.attachInstance = function (editor) { bridgeInstance.attach(editor); };
    exports.getBridge = function () { return bridgeInstance; };
});
