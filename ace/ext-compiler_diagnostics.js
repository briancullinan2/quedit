ace.define("ace/ext/compiler_diagnostics", [
    "require",
    "exports",
    "module",
    "ace/config",
    "ace/lib/dom"
], function (require, exports, module) {
    "use strict";
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


    let CLEAN_ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;


    let config = require("../config");
    let dom = require("../lib/dom");

    function DiagnosticsBridge() {
        this.activeEditor = null;
        this.collectedLogLines = [];
        this.timer = null;
        this.delay = 250;

        // Core structural file diagnostic dictionary: { "code/game/g_main.c": [ ...annotations ] }
        this.fileAnnotationsMap = {};

        // Strict Clang/LCC compiler error pattern
        this.lccPattern = /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i;

        // Your comprehensive verbose file/line locator pattern
        this.fileNameRegex = FILE_NAME_REGEX;
    }

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

            let activeAnnotations = session.getAnnotations().filter(function (ann) {
                return ann.row === position.row;
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

        // 1. Reconstruct streaming chunks and strip control tags
        let cleanMegaString = this.collectedLogLines
            .map(function (item) { return typeof item === 'string' ? item : (item.text || ""); })
            .join("")
            .replace(CLEAN_ANSI, "");

        let consolidatedLines = cleanMegaString.split(/\r?\n/);

        // Reset our indexed state cache before performing a fresh compilation sweep scan
        this.fileAnnotationsMap = { "system": [] };

        for (let i = 0; i < consolidatedLines.length; i++) {
            let line = consolidatedLines[i].trim();
            if (!line) continue;

            // Catch standard compiler diagnostics
            let match = line.match(this.lccPattern);
            if (match) {
                let filePath = match[1].trim();
                let lineStr = match[2];
                let severity = match[3];
                let infoText = match[4];

                let lineNumber = parseInt(lineStr, 10) - 1;
                let isError = severity.toLowerCase() === 'error';

                // Ensure our multi-file dictionary bucket slot exists
                if (!this.fileAnnotationsMap[filePath]) {
                    this.fileAnnotationsMap[filePath] = [];
                }

                this.fileAnnotationsMap[filePath].push({
                    row: lineNumber,
                    column: 0,
                    text: infoText,
                    type: isError ? "error" : "warning"
                });
                continue;
            }

            // OPTIONAL: Catch byte references, map jumps, or cross-tool tracking logs
            // via your raw `this.fileNameRegex` pattern right here to build navigation coordinates!
        }

        // After compilation processes terminate, paint annotations on the current active view
        this.refreshActiveEditorView();
    };

    DiagnosticsBridge.prototype.refreshActiveEditorView = function () {
        if (!this.activeEditor) return;

        let session = this.activeEditor.getSession();

        // 1. THE FILE RESOLVER FIX: Restore your original session path sniffing routine
        let currentFile = window?.currentSession(window.currentOpenFileId || session.id, session)
            || window.currentOpenFileId || session.id || "";

        // 2. TEAR DOWN OLD MARKERS: Flush custom range highlights cleanly
        if (!this.activeMarkerIds) {
            this.activeMarkerIds = [];
        }
        for (let m = 0; m < this.activeMarkerIds.length; m++) {
            session.removeMarker(this.activeMarkerIds[m]);
        }
        this.activeMarkerIds = [];

        // Pull any standard standalone connection logs
        let systemAnnotations = this.fileAnnotationsMap["system"] || [];
        let targetAnnotations = [];

        // Find the matching file cache entry block by iterating keys or doing a suffix match
        let keys = Object.keys(this.fileAnnotationsMap);
        for (let i = 0; i < keys.length; i++) {
            let cachedFileKey = keys[i];
            if (cachedFileKey !== "system" && currentFile.endsWith(cachedFileKey)) {
                targetAnnotations = this.fileAnnotationsMap[cachedFileKey];
                break;
            }
        }

        // Merge connection state confirmations with targeted file annotations smoothly
        let finalAnnotations = systemAnnotations.concat(targetAnnotations);

        // RESTORED: This puts your gutter exclamation badges right back where they belong!
        session.setAnnotations(finalAnnotations);

        // 3. THE SQUIGGLY ENGINE: Run range highlights only if data exists
        if (targetAnnotations.length === 0) return;

        let Range = ace.require("ace/range").Range;

        for (let a = 0; a < targetAnnotations.length; a++) {
            let anno = targetAnnotations[a];
            let row = anno.row;

            // Extract the raw text line string to evaluate character lengths
            let lineText = session.getLine(row) || "";
            let startColumn = 0;
            let endColumn = lineText.length || 1;

            // Strip indent spacing away from the selection bounds
            let firstCharMatch = lineText.match(/^\s*/);
            if (firstCharMatch) {
                startColumn = firstCharMatch[0].length;
            }

            let markerRange = new Range(row, startColumn, row, endColumn);
            let markerClass = (anno.type === "error") ? "compiler-error-marker" : "compiler-warning-marker";

            // Inject line decorations directly into the character layer grid
            let markerId = session.addMarker(
                markerRange,
                markerClass,
                "text",
                false
            );

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






    let bridgeInstance = new DiagnosticsBridge();

    exports.log = function (msg) { bridgeInstance.log(msg); };
    exports.attachInstance = function (editor) { bridgeInstance.attach(editor); };
    exports.getBridge = function () { return bridgeInstance; };
});
