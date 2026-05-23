define("ace/mode/antlr_worker", ["require", "exports", "module", "ace/worker/worker_client"], function (require, exports, module) {
    var WorkerClient = require("ace/worker/worker_client").WorkerClient;

    function AntlrWorker(session) {
        var baseOrigin = window.location.origin;
        var targetUrl = baseOrigin + "/ace/worker-antlr.js";

        // Internal cache tracking active range highlights for this worker instance
        this.activeMarkerIds = [];

        // Inherit base communications
        WorkerClient.call(this, ["ace"], "ace/mode/antlr_worker_actions", "AntlrWorker", targetUrl);

        var aceBasePath = ace.config.get("basePath") || (baseOrigin + "/ace/");
        if (aceBasePath.slice(-1) !== "/") {
            aceBasePath += "/";
        }

        // Dynamically inject worker-base.js context
        if (this.$worker) {
            this.$worker.postMessage({
                command: "importScripts",
                args: [
                    baseOrigin + '/preambles.js',
                    baseOrigin + '/parsers.js',
                    aceBasePath + "worker-base.js",
                    baseOrigin + '/antlr-languages.bundle.js',
                    baseOrigin + "/worker-language.js"
                ]
            });
        }

        // Bind our single parameter 'session' object here
        this.attachToDocument(session);

        // Reference to the active instance context for helper methods
        var self = this;
        // Inside mode-antlr_worker.js
        this.on("annotate", function (e) {
            // Dynamically retrieve the active global diagnostics manager instance
            var compilerDiagnostics = ace.require("ace/ext/compiler_diagnostics");
            if (compilerDiagnostics && compilerDiagnostics.getBridge) {
                var bridge = compilerDiagnostics.getBridge();

                // Pass the metrics cleanly into the unified caching container
                debugger
                bridge.setWorkerAnnotations(e.data);
            } else {
                // Fallback baseline override if the bridge module isn't loaded yet
                session.setAnnotations(e.data);
            }
        });

        this.on("highlight", function (e) {
            var compilerDiagnostics = ace.require("ace/ext/compiler_diagnostics");
            if (compilerDiagnostics && compilerDiagnostics.getBridge) {
                var bridge = compilerDiagnostics.getBridge();

                // Pass your custom line-token matrix directly to our screen hijacker!
                bridge.applyCustomWorkerHighlights(e.data.tokenLines);
            }
        });

        this.on("terminate", function () {
            session.clearAnnotations();
            for (var m = 0; m < self.activeMarkerIds.length; m++) {
                session.removeMarker(self.activeMarkerIds[m]);
            }
            self.activeMarkerIds = [];
        });

        // Custom setter pipeline method
        this.setLanguageTarget = function (langKey, fileId) {
            this.$worker.postMessage({
                command: "setLanguageContext",
                args: [langKey, fileId]
            });
        };
    }

    var oop = require("ace/lib/oop");
    oop.inherits(AntlrWorker, WorkerClient);

    exports.AntlrWorker = AntlrWorker;
});