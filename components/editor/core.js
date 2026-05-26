

function onBlockTrackerCursorChange() {
    if (typeof NavHistory !== 'undefined' && NavHistory.isNavigating) return;

    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
        const session = aceEditor.getSession();
        const pos = aceEditor.getCursorPosition();
        const currentFile = typeof window.currentOpenFileId !== 'undefined' ? window.currentOpenFileId : null;

        const humanRow = pos.row + 1;
        const humanCol = pos.column + 1;

        const lastPoint = typeof NavHistory !== 'undefined' ? NavHistory.stack[NavHistory.index] : null;
        if (!lastPoint || lastPoint.fileId !== currentFile || Math.abs(lastPoint.row - humanRow) > 5) {
            if (typeof NavHistory !== 'undefined') NavHistory.push(currentFile, humanRow, humanCol);
        }

        if (typeof window.updateEditorLineIds === 'function') {
            window.updateEditorLineIds();
        }

        // Emit block range calculations natively to the active web worker thread
        if (session && session.$worker && session.$worker.$worker) {
            session.$worker.$worker.postMessage({
                event: "calculateActiveBlockRange",
                data: { lineNumber: humanRow }
            });

            session.$worker.$worker.postMessage({
                event: "getFoldRegions",
                data: { fileId: session.workspaceFileId }
            });
        }

    }, 150);
}

function bindBlockTrackerToSession(session) {
    if (!session || !session.selection) return;

    // Remove any pre-existing tracker handle on this session to prevent duplicate fire leaks
    session.selection.off("changeCursor", onBlockTrackerCursorChange);

    // Bind the execution frame cleanly
    session.selection.on("changeCursor", onBlockTrackerCursorChange);
}
