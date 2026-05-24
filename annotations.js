/**
 * Ace Top-Level Pipeline Engine Manager
 */
let activeEditor = null
function PipelineManager(options) {
    options = options || {};

    // TODO:
    //this.clear = clear.bind(this, session)
    if (!window.annotations)
        window.annotations = this
    else
        console.log("[Annotations] You don't need more than one of these.")

    return this
}

PipelineManager.prototype.clear = clear
PipelineManager.prototype.mergeTokens = mergeTokens
PipelineManager.prototype.syncTokensToAce = syncTokensToAce
PipelineManager.prototype.handleWorkerHighlight = handleWorkerHighlight
PipelineManager.prototype.handleWorkerAnnotate = handleWorkerAnnotate
PipelineManager.prototype.refreshActiveEditorView = refreshActiveEditorView

// Context bindings
PipelineManager.prototype.setEditor = function (editor) {
    activeEditor = editor;
}
PipelineManager.prototype.setFileAnnotations = function (session, key, list) {
    session.fileAnnotationsMap[key] = list;
}
PipelineManager.prototype.getState = function () {
    return state;
}

/**
 * Completely purges all highlighting, markers, and annotations from the editor
 */
function clear(session) {
    session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();

    // Remove active visual line highlights
    session.activeMarkerIds.forEach(function (markerId) {
        session.removeMarker(markerId);
    });
    session.activeMarkerIds = [];
    session.workerAnnotations = [];
    session.fileAnnotationsMap = { system: [] };
    session.tokenCache = [];

    // Clear gutter panels
    session.clearAnnotations()
    session.setAnnotations([]);

    // Reset Ace's background layout tokens
    if (session.bgTokenizer) {
        session.bgTokenizer.lines = [];
        session.bgTokenizer.fireUpdateEvent(0, 0);
    }
}

/**
 * Merges incoming token adjustments into the existing cache on a per-line basis
 * Perfect for partial worker delta updates
 */
function mergeTokens(session, newLinesMap, startRow, endRow) {
    startRow = startRow !== undefined ? startRow : 0;
    endRow = endRow !== undefined ? endRow : Object.keys(newLinesMap).length - 1;

    let keys = Object.keys(newLinesMap);
    for (let i = 0; i < keys.length; i++) {
        let row = parseInt(keys[i], 10);
        if (row >= startRow && row <= endRow) {
            session.tokenCache[row] = newLinesMap[row];
        }
    }

    syncTokensToAce(startRow, endRow);
}
/**
 * Flushes the local state cache out to the active Ace session viewport
 */
function syncTokensToAce(session, startRow, endRow) {
    session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();
    if (!session || !session.tokenCache.length) return;

    if (session.bgTokenizer) {
        // Overwrite Ace's target cache window directly
        session.bgTokenizer.lines = session.tokenCache;

        let lastRow = endRow !== undefined ? endRow : session.tokenCache.length - 1;
        
        session.bgTokenizer.fireUpdateEvent(startRow || 0, lastRow);
        
        // CRITICAL FIX: Ace expects 'first' and 'last', NOT 'firstRow' and 'lastRow'
        session._emit("tokenizerUpdate", { 
            first: startRow || 0, 
            last: lastRow 
        });
    }
}

// =====================================================================
// 2. INCOMING PIPELINE INTERCEPTORS
// =====================================================================

/**
 * Responds to high-fidelity ANTLR background worker highlighting events
 */
function handleWorkerHighlight(session, e) {
    // The Cancellation Gate (Prevents UI repaint thrashing during structural views)
    if (window.currentActiveLayoutMode === 'navigation-override' || window.preventHighlightPaint) {
        return;
    }

    let incomingLines = e.data.tokenLines || e.data.antlrTokensByLine;
    if (!incomingLines) return;

    // Semantic Transformation Pass
    let enrichedTokenLines = incomingLines.map(function (rowTokens) {
        if (!rowTokens) return rowTokens;

        return rowTokens.map(function (token) {
            // Feature A: Flag tracking markers inside comments
            if (token.type === 'comment' && token.value.includes('TODO')) {
                token.type += " spelling-error task-marker";
            }

            // Feature B: Enrich matching compiled interactive Quake 3 symbols
            if (token.type === 'entity.name.function' && window.clickableSymbolsMap?.[token.value]) {
                token.type += " clickable-engine-symbol";
            }

            return token;
        });
    });

    // Atomic swap into our local cache engine, then render
    session.tokenCache = enrichedTokenLines;
    syncTokensToAce(session, 0, enrichedTokenLines.length - 1);
}

/**
 * Handles incoming background worker annotations
 */
function handleWorkerAnnotate(session, e) {
    session.workerAnnotations = e.data || [];
    refreshActiveEditorView(session);
}

/**
 * Refreshes annotations, gutter highlights, and line markers synchronously
 */
function refreshActiveEditorView(session) {
    session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();

    let currentFile = window?.currentSession?.(window.currentOpenFileId || session.id, session)
        || window.currentOpenFileId || session.id || "";

    // Strip previous drawing layers
    session.activeMarkerIds.forEach(function (id) {
        session.removeMarker(id);
    });
    session.activeMarkerIds = [];

    let systemAnnotations = session.fileAnnotationsMap["system"] || [];
    let targetAnnotations = [];

    let keys = Object.keys(session.fileAnnotationsMap);
    for (let i = 0; i < keys.length; i++) {
        let cachedFileKey = keys[i];
        if (cachedFileKey !== "system" && currentFile.endsWith(cachedFileKey)) {
            targetAnnotations = session.fileAnnotationsMap[cachedFileKey];
            break;
        }
    }

    // Combine everything into a single layout array
    let finalAnnotations = systemAnnotations
        .concat(targetAnnotations)
        .concat(session.workerAnnotations);

    // Map subtle styles directly onto the metadata prior to passing to Ace
    finalAnnotations.forEach(function (anno) {
        if (anno.isLintingTip) {
            // Inject custom class definitions for light, non-distractible gray text
            anno.className = "ace_gutter_annotation_tip lint-subtle-gray";
        }
    });

    session.setAnnotations(finalAnnotations);
    if (finalAnnotations.length === 0) return;

    let Range = ace.require("ace/range").Range;
    finalAnnotations.forEach(function (anno) {
        if (typeof drawAnnotationMarker === "function") {
            drawAnnotationMarker.call(session, session, Range, anno);
        }
    });
}