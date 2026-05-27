

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
    if (!session.activeMarkerIds) {
        session.activeMarkerIds = []
    }
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
            data: {
                first: startRow || 0,
                last: lastRow
            }
        });
    }
}





function handleWorkerStreamHighlight(session, responseData) {
    if (!responseData || !responseData.tokenLinesChunk) return;

    const { tokenLinesChunk, annotationsChunk, startLine, endLine } = responseData;
    const bgTokenizer = session.bgTokenizer;

    // Convert 1-based editor bounds to 0-indexed internal array rows
    const startRow = startLine - 1;
    const endRow = endLine - 1;

    // --- LINEAR BOUNDARY OVERLAY LOOP ---
    // Iterate strictly through the modified block range to prevent skipping slots
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const lineTokens = tokenLinesChunk[rowIndex];

        if (Array.isArray(lineTokens)) {
            // Ace breaks completely if an array is empty []. 
            // If it's a blank line, give it a baseline plain text token type definition.
            if (lineTokens.length === 0) {
                bgTokenizer.lines[rowIndex] = [{ type: "text", value: "" }];
            } else {
                bgTokenizer.lines[rowIndex] = lineTokens;
            }

            // Invalidate the row's state layout frame explicitly
            bgTokenizer.states[rowIndex] = "start"; 
            bgTokenizer.fireUpdateEvent(rowIndex, rowIndex);
        }
        // If lineTokens is completely undefined for this index, we leave Ace's 
        // existing background tokenizer cache completely untouched!
    }

    // 2. Stitch Annotations safely
    if (Array.isArray(annotationsChunk)) {
        const currentAnnotations = session.getAnnotations() || [];
        const preservedAnnotations = currentAnnotations.filter(ann => 
            ann.row < startRow || ann.row > endRow
        );
        session.setAnnotations([...preservedAnnotations, ...annotationsChunk]);
    }
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
    if (!session.activeMarkerIds) {
        session.activeMarkerIds = []
    }
    session.activeMarkerIds.forEach(function (id) {
        session.removeMarker(id);
    });
    session.activeMarkerIds = [];
    if (!session.fileAnnotationsMap)
        session.fileAnnotationsMap = { system: [] }
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

    if(!session.workerAnnotations) {
        session.workerAnnotations = []
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

