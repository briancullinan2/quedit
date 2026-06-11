



aceEditor.on("changeSession", function (e) {
    console.log("[ACE SESSION SWAP] New file context mounted. Re-binding tracking listeners.");

    // Clear out the old visual block marker from the dead session so it doesn't leave ghost artifacts
    if (currentBlockMarkerId !== null && e.oldSession) {
        e.oldSession.removeMarker(currentBlockMarkerId);
        currentBlockMarkerId = null;
    }

    // Bind your look-around listener directly onto the incoming fresh session selection layer
    bindBlockTrackerToSession(e.session);

    // Instant execution trigger so the block highlights the moment the new file flashes open
    onBlockTrackerCursorChange();
});


// Keep track of the active gutter line row to prevent erratic multi-firing updates
aceEditor.on('change', (delta) => {
    // 1. Get the real-time position from the editor instance
    const pos = aceEditor.getCursorPosition();

    // 2. Format a human-readable action description based on the event delta
    let changeType = "Code modified";
    if (delta.action === "insert") {
        changeType = delta.lines.length > 1 ? "Lines added" : "Inserted text";
    } else if (delta.action === "remove") {
        changeType = delta.lines.length > 1 ? "Lines deleted" : "Removed text";
    }

    const fileName = currentSession()
    // 3. Match the structural payload requirements for extractAceMetadata
    const actionPayload = {
        action_id: "ace_edit_action",
        action_description: changeType,
        fileName: fileName,                  // Assumes 'fileName' is accessible in your scope
        filePath: fileName,                  // Keeps it compatible with file path extraction splitting
        row: pos.row,                        // Pass raw index; extractAceMetadata adds +1 for display
        column: pos.column,
        delta: delta
    };

    appendHistoryItem(actionPayload, 'editor');

    debounceFileChange(aceEditor);
});

let lastTrackedRow = -1;
let lastTrackedColumn = -1;
let aceMoveDebounceTimer = null;

function detectAceEditorEvents(event) {
    if (!editor || !aceEditor.renderer) return null;

    const canvasX = event.clientX;
    const canvasY = event.clientY;

    // 1. Map mouse screen pixels directly to Ace internal character coordinates
    const screenPos = aceEditor.renderer.screenToTextCoordinates(canvasX, canvasY);
    const row = screenPos.row;
    const column = screenPos.column;

    // Skip recalculation if the mouse is hovering over the exact same character slot
    if (row === lastTrackedRow && column === lastTrackedColumn) {
        return previousAceUpdate;
    }

    lastTrackedRow = row;
    lastTrackedColumn = column;

    // 2. Get the precise string token sitting under the mouse
    const session = aceEditor.getSession();
    const token = session.getTokenAt(row, column);

    // Extract the full raw text line for debugging context
    const lineText = session.getLine(row);

    let tokenText = null;
    let tokenType = null;
    let isFunctionCall = false;

    if (token) {
        tokenText = token.value.trim();
        tokenType = token.type;

        // Peek ahead at the next token to check if it's an invocation paren
        const nextToken = session.getTokenAt(row, column + token.value.length);
        if (tokenType.includes("support.function") ||
            tokenType.includes("entity.name.function") ||
            (nextToken && nextToken.value.startsWith('('))) {
            isFunctionCall = true;
        }
    }

    // 3. CAPTURE ACTIVE COMPILER ERRORS FROM EXTENSION DATA TAGS
    let compilerError = null;
    const aceContainer = event.target.closest('.ace_editor');
    if (aceContainer) {
        compilerError = aceContainer.getAttribute('data-compiler-error');
    }

    // Convert internal zero-based indices to human-readable 1-based indices (+1)
    const humanLine = row + 1;
    const humanCol = column + 1;
    const database = owner.value + '/' + repository.value;

    let filePath = currentSession();
    if (!filePath && trees && trees[database]) {
        filePath = trees[database].nodesById[window.currentOpenFileId]?.path;
    }

    const updatePayload = {
        event,
        row: humanLine,
        column: humanCol,
        lineText,
        tokenText,
        tokenType,
        isFunctionCall,
        compilerError, // <-- Injected seamlessly into the tracking payload
        id: typeof window.currentOpenFileId !== 'undefined' && window.currentOpenFileId != null ? window.currentOpenFileId : 'unknown',
        file: filePath,
    };

    // Update global status readouts dynamically
    updateAceStatus(updatePayload);

    previousAceUpdate = updatePayload;
    return updatePayload;
}


let previousAceUpdate = null;
function onAceMouseMove(event) {
    // Immediate early exit if modifier isn't engaged to ensure completely zero lag typing
    //if (!event.ctrlKey && !event.metaKey) {
    //    return;
    //}

    if (aceMoveDebounceTimer) return;

    aceMoveDebounceTimer = setTimeout(() => {

        aceMoveDebounceTimer = null;
        if (window.aceEditor && event.target
            && (event.target === window.aceEditor.renderer.container
                || event.target.parentElement === window.aceEditor.renderer.container
                || event.target.closest('#editor'))
        ) {
            doAceEditorMouse(event)
            return
        }


        previousAceUpdate = detectAceEditorEvents(event);
    }, 100); // Efficient 100ms calculation window
}

editorContainer.addEventListener('mousemove', onAceMouseMove);

editorContainer.addEventListener('mouseup', () => {
    let hasClass = document.body.classList.contains('dragging')
    isDragging = false
    if (!window.isModifierPressed && hasClass)
        document.body.classList.remove('dragging')
    if (window.isModifierPressed && !hasClass)
        document.body.classList.add('dragging')
});

/**
 * Click handler execution block.
 * When a user clicks a function token with the modifier held, jump execution locations.
 */
editorContainer.addEventListener('mousedown', async (event) => {

    const telemetry = detectAceEditorEvents(event);
    if (!telemetry || !telemetry.tokenText) return;

    if (!event.ctrlKey && !event.metaKey) return;

    if (typeof writeLog === 'function') {
        writeLog(`Ace Intercept -> Token: ${telemetry.tokenText}, Line: ${telemetry.row}, Fn: ${telemetry.isFunctionCall}`);
    }

    debugger

    // --- THE JUMP ENGINE EXTENSION HOOK ---
    if (telemetry.isFunctionCall) {

        event.preventDefault();


        if (typeof lookupFunctionDefinition === 'function') {
            // Your future linker handler: parses function references across index trees
            await lookupFunctionDefinition(telemetry.tokenText, telemetry.fileId);
        } else {
            console.log(`Ready to link function definition for: ${telemetry.tokenText}`);
        }
    }
});


let lastTrackedGutterRow = null;


window.aceEditor.on("guttermouseout", function () {
    lastTrackedGutterRow = null;
    if (globalTooltip) {
        debugger
        globalTooltip.style.display = 'none';
    }
});



function doAceEditorMouse(e) {
    if (!globalTooltip) return;

    // 1. Calculate the active screen row focus block
    let canvasY = e.clientY;
    let row = window.aceEditor.renderer.screenToTextCoordinates(0, canvasY).row;

    // 2. Fetch the true, fully aggregated annotation state array directly from Ace
    const session = window.aceEditor.getSession();
    let allActiveAnnotations = session.getAnnotations() || [];

    // Filter down to error nodes matching this specific line focus pointer
    let activeErrorsOnLine = allActiveAnnotations.filter(function (anno) {
        return anno.row === row;
    });

    // If no diagnostics reside on this specific row, hide the global overlay panel cleanly
    if (activeErrorsOnLine.length === 0) {
        globalTooltip.style.display = 'none';
        globalTooltip.style.opacity = 0;
        globalTooltip.style.zIndex = -1;
        lastTrackedGutterRow = null;
        return;
    }

    // --- THE HASTY GATE ---
    // If the tooltip is already correctly positioned on this row, drop out out to save cycles
    if (row === lastTrackedGutterRow && globalTooltip.style.display === 'block') {
        return;
    }
    lastTrackedGutterRow = row;

    // 3. PACK & UNWRAP: Join multiple warning/error chunks on the same line into a clean string layout
    let combinedDiagnosticText = activeErrorsOnLine.map(function (anno) {
        // Strip away raw newline formatting if it's already a complex multiline string layout block
        let textContent = anno.text || "";
        let prefix = anno.type === "error" ? "❌ Error: " : (anno.type === "warning" ? "⚠️ Warning: " : "ℹ️ Info: ");

        return prefix + textContent;
    }).join("\n\n");

    // Populate the clean string straight into your global overlay element layout view
    globalTooltip.innerText = combinedDiagnosticText;

    // Apply the display viewport positions
    globalTooltip.style.position = 'absolute';
    globalTooltip.style.display = 'block';
    globalTooltip.style.opacity = 1;
    globalTooltip.style.zIndex = 99999;

    // Compute pixel positioning alignments against the editor's active layout grid
    var rowCoords = window.aceEditor.renderer.textToScreenCoordinates(row, 0);
    var gutterRect = window.aceEditor.renderer.$gutterLayer.element.getBoundingClientRect();
    var absoluteGutterRight = gutterRect.right;

    var correctedLeft = absoluteGutterRight + 10;
    var rowHeight = window.aceEditor.renderer.layerConfig.lineHeight || 19;
    var correctedTop = rowCoords.pageY + rowHeight;

    globalTooltip.style.left = correctedLeft + "px";
    globalTooltip.style.top = correctedTop + "px";
}


