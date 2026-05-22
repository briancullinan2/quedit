ace.define("ace/ext/compiler_diagnostics", [
    "require", 
    "exports", 
    "module", 
    "ace/config", 
    "ace/lib/dom"
], function(require, exports, module) {
    "use strict";

    var config = require("../config");
    var dom = require("../lib/dom");

    function DiagnosticsBridge() {
        this.activeEditor = null;
        this.collectedLogLines = [];
        this.timer = null;
        this.delay = 250; 
        this.lccPattern = /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i;
    }

    DiagnosticsBridge.prototype.attach = function(editor) {
        this.activeEditor = editor;
        this.initMouseInterceptors(editor);
        this.log("system:1: warning: Worker Error Reporting Connected");
    };

    DiagnosticsBridge.prototype.initMouseInterceptors = function(editor) {
        var _self = this;
        editor.on("mousemove", function(e) {
            var position = e.getDocumentPosition();
            var session = editor.getSession();
            var container = editor.container;

            container.removeAttribute('data-compiler-error');
            container.removeAttribute('data-navigation-target');

            var activeAnnotations = session.getAnnotations().filter(function(ann) {
                return ann.row === position.row;
            });

            if (activeAnnotations.length > 0) {
                var tooltipText = activeAnnotations.map(function(ann) {
                    return "[" + ann.type.toUpperCase() + "] " + ann.text;
                }).join('\n');

                container.setAttribute('data-compiler-error', tooltipText);
                editor.renderer.getMouseEventTarget().style.cursor = "text";
                return;
            }

            var token = session.getTokenAt(position.row, position.column);
            if (token && (token.type === "storage.type" || token.type === "entity.name.function")) {
                container.setAttribute('data-navigation-target', token.value);
                editor.renderer.getMouseEventTarget().style.cursor = "pointer";
                return;
            }

            editor.renderer.getMouseEventTarget().style.cursor = "text";
        });

        editor.on("mouseleave", function() {
            editor.container.removeAttribute('data-compiler-error');
            editor.container.removeAttribute('data-navigation-target');
        });
    };

    DiagnosticsBridge.prototype.log = function(message) {
        if (!message) return;
        var lines = message.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var cleanLine = lines[i].trim();
            if (cleanLine) {
                this.collectedLogLines.push(cleanLine);
            }
        }
        this.triggerDebouncedUpdate();
    };

    DiagnosticsBridge.prototype.clear = function() {
        this.collectedLogLines = ["system:1: warning: Worker Error Reporting Connected"];
        if (this.activeEditor) {
            this.activeEditor.getSession().clearAnnotations();
        }
        this.triggerDebouncedUpdate();
    };

    DiagnosticsBridge.prototype.triggerDebouncedUpdate = function() {
        var _self = this;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(function() {
            _self.processAnnotations();
        }, this.delay);
    };

    DiagnosticsBridge.prototype.processAnnotations = function() {
        debugger
        if (!this.activeEditor) return;

        var session = this.activeEditor.getSession();
        var currentOpenFile = window.currentOpenFileId || "";
        var annotations = [];

        for (var i = 0; i < this.collectedLogLines.length; i++) {
            var match = this.collectedLogLines[i].match(this.lccPattern);
            if (!match) continue;

            var filePath = match[1];
            var lineStr = match[2];
            var severityType = match[3];
            var infoText = match[4];

            if (filePath !== "system" && currentOpenFile && !currentOpenFile.endsWith(filePath)) {
                continue;
            }

            var lineNumber = parseInt(lineStr, 10) - 1;
            var isError = severityType.toLowerCase() === 'error';

            annotations.push({
                row: lineNumber,
                column: 0,
                text: infoText,
                type: isError ? "error" : "warning"
            });
        }

        session.setAnnotations(annotations);
    };

    var bridgeInstance = new DiagnosticsBridge();

    exports.log = function(msg) { bridgeInstance.log(msg); };
    exports.clear = function() { bridgeInstance.clear(); };
    exports.attachInstance = function(editor) { bridgeInstance.attach(editor); };
    exports.getBridge = function() { return bridgeInstance; };
});
