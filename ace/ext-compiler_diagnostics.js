ace.define("ace/ext/compiler_diagnostics", [
    "require",
    "exports",
    "module",
    "ace/config",
    "ace/lib/dom"
], function (require, exports, module) {
    "use strict";

    // =====================================================================
    // 1. STABLE PATTERNS & PIPELINE REGISTRIES
    // =====================================================================
    const MONITOR_LCC = /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i;
    const CLEAN_ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

    // =====================================================================
    // 2. TOP-LEVEL GLOBAL PIPELINE MICRO-UTILITY FUNCTIONS
    // =====================================================================

    /**
     * Pure mapper that loops through text lines to run polymorphic regex matching pairs
     */
    function parseLineAnnotation(line) {
        let cleanLine = line.trim();
        if (!cleanLine) return;

        for (let p = 0; p < DIAGNOSTIC_PARSERS.length; p++) {
            let parser = DIAGNOSTIC_PARSERS[p];
            let match = cleanLine.match(parser.pattern);

            if (match) {
                let diagnostic = parser.resolve(match, this);
                if (diagnostic && diagnostic.filePath) {
                    let path = diagnostic.filePath;
                    if (!this.fileAnnotationsMap[path]) {
                        this.fileAnnotationsMap[path] = [];
                    }
                    this.fileAnnotationsMap[path].push({
                        row: diagnostic.row,
                        column: undefined, // Line-wide block indicator context
                        text: diagnostic.text,
                        type: diagnostic.type
                    });
                }
                break;
            }
        }
    }

    /**
     * Pure visual mapper parsing annotations into Ace DOM Range Markers (squigglies)
     */
    function drawAnnotationMarker(session, Range, anno) {
        let row = anno.row;
        let lineText = session.getLine(row) || "";

        let startColumn = (typeof anno.column === "number" && anno.column > 0) ? anno.column : 0;
        let endColumn = lineText.length || 1;

        // Skip indentation padding safely if no precise character token offset exists
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

    let bridgeInstance = new DiagnosticsBridge();

    exports.log = function (msg) { bridgeInstance.log(msg); };
    exports.attachInstance = function (editor) { bridgeInstance.attach(editor); };
    exports.getBridge = function () { return bridgeInstance; };
});


function DiagnosticsBridge() {
    this.activeEditor = null;
    this.collectedLogLines = [];
    this.timer = null;
    this.delay = 250;
    this.fileAnnotationsMap = { "system": [] };
    this.workerAnnotations = [];
}

DiagnosticsBridge.prototype.attach = function (editor) {
    // FIXED: Stripped dead gates and debugger loops to initialize tracking safely
    this.activeEditor = editor;
    this.initMouseInterceptors(editor);
    this.log("system:1: warning: Worker Error Reporting Connected");
};

DiagnosticsBridge.prototype.setWorkerAnnotations = function (annotationsArray) {
    this.workerAnnotations = annotationsArray || [];
    this.refreshActiveEditorView();
};

DiagnosticsBridge.prototype.applyCustomWorkerHighlights = function (tokenLines) {
    // FIXED: Stripped structural return gates to connect custom highlights
    if (!this.activeEditor || !tokenLines) return;

    let session = this.activeEditor.getSession();
    session.bgTokenizer.lines = tokenLines;
    session.bgTokenizer.fireUpdateEvent(0, tokenLines.length - 1);
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
            if (ann.row !== position.row) return false;
            if (typeof ann.column !== "number" || ann.column === 0) return true;
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
        .join("\n") // Enforce discrete trailing row breaks
        .replace(CLEAN_ANSI, "");

    let consolidatedLines = cleanMegaString.split(/\r?\n/);
    this.fileAnnotationsMap = { "system": [] };

    // Bind our context mapping safely to loop through regex matching definitions
    consolidatedLines.forEach(parseLineAnnotation.bind(this));

    this.refreshActiveEditorView();
};

DiagnosticsBridge.prototype.refreshActiveEditorView = function () {
    if (!this.activeEditor) return;

    let session = this.activeEditor.getSession();
    let currentFile = window?.currentSession(window.currentOpenFileId || session.id, session)
        || window.currentOpenFileId || session.id || "";

    // Flush stale markers safely from screen layer
    if (!this.activeMarkerIds) { this.activeMarkerIds = []; }
    for (let m = 0; m < this.activeMarkerIds.length; m++) {
        session.removeMarker(this.activeMarkerIds[m]);
    }
    this.activeMarkerIds = [];

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

    let finalAnnotations = systemAnnotations
        .concat(targetAnnotations)
        .concat(this.workerAnnotations);

    // Commit badges right to the editor gutter
    session.setAnnotations(finalAnnotations);

    if (finalAnnotations.length === 0) return;

    let Range = ace.require("ace/range").Range;

    // Render squigglies down the viewport via bound utility callback mechanics
    finalAnnotations.forEach(drawAnnotationMarker.bind(this, session, Range));
};

DiagnosticsBridge.prototype.clear = function () {
    this.collectedLogLines = ["system:1: warning: Worker Error Reporting Connected"];
    this.fileAnnotationsMap = {};
    if (this.activeEditor) {
        this.activeEditor.getSession().clearAnnotations();
    }
    this.refreshActiveEditorView();
};

// =====================================================================
// 4. LOWER BOUND ENGINE LOOKUPS
// =====================================================================

DiagnosticsBridge.prototype.lookupShaderFile = function (shaderName) {
    return "scripts/base.shader";
};

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

DiagnosticsBridge.prototype.findShaderByAssetDependency = function (assetPath) {
    let baseToken = assetPath.replace(/\.(tga|jpg)$/i, "");
    let activeFiles = Object.keys(sessionCache);
    for (let f = 0; f < activeFiles.length; f++) {
        let path = activeFiles[f];
        if (path.endsWith('.shader') && sessionCache[path].getValue().includes(baseToken)) {
            return path;
        }
    }
    return window.currentOpenFileId || "scripts/base.shader";
};
