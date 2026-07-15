
let tempCount = 1;



const sessionCache = {};

updateMaxLines()

let currentBlockMarkerId = null;
let lastRenderedBoundsKey = ""; // State tracking anchor to prevent redundant paint steps





aceEditor.commands.addCommand({
    name: "save",
    bindKey: { win: "Ctrl-S", mac: "Command-S" },
    exec: function (editor) {
        saveFile()
    }
});


let currentFileShaDebouncer = null
function debounceFileChange(editor, delay = 1000) {
    if (currentFileShaDebouncer) {
        return
    }

    currentFileShaDebouncer = setTimeout(async () => {
        if (!aceEditor) return;

        try {
            const currentContent = aceEditor.getValue();
            // Calculate the SHA asynchronously in the background
            window.currentOpenFileId = await window.getGitShaBrowser(currentContent);
            currentFileShaDebouncer = null
        } catch (err) {
            console.error("Failed to compute file SHA during debounce:", err);
        }
    }, delay);
}

/*
ace.config.loadModule("ace/keybinding/vim", function(m) {
    let Vim = m.CodeMirror.Vim;
    Vim.defineEx("quit", "q", function(cm) {
        // Your logic to close the editor, tab, or window
        writeLog("User requested quit");
    });
});

// Load the Vim module to access the Status Bar attachment
ace.config.loadModule("ace/keyboard/vim", function(m) {
    let VimApi = m.CodeMirror.Vim;
    // Some versions of Ace require this manual attachment:

    // This tells Ace to pipe ":commands" and "INSERT/NORMAL" modes to your div
    aceEditor.setOption("showPrintMargin", false); // Optional cleanup

    // If using the official status bar extension:
    // let StatusBar = ace.require("ace/ext/statusbar").StatusBar;
    // let aceStatusBar = new StatusBar(editor, statusBar);
});

*/



async function newFile() {
    const session = getOrCreateAceSession('temp' + (++tempCount), '');
    aceEditor.setSession(session);
    hideOpenPanels()
    resizeDebouncer()
    editorContainer.classList.add('not-hidden')
    editorContainer.classList.remove('hidden')

}


async function saveFile() {
    const database = owner.value + '/' + repository.value
    const filePath = currentSession()
    if (!filePath)
        filePath = trees[database].nodesById[window.currentOpenFileId].path
    const content = aceEditor.getValue()
    const newSha = await getGitShaBrowser(content)
    FS.virtual[filePath] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new TextEncoder().encode(content),
        path: filePath,
        sha: newSha,
        parent: filePath.substring(0, filePath.lastIndexOf('/'))
    }
    window.currentOpenFileId = newSha
    if (files[database]) {
        await putRecord(DB_STORE_NAME, FS.virtual[filePath], database)
        if (files[database][filePath])
            files[database][filePath].sha = newSha
        else
            files[database][filePath] = FS.virtual[filePath]
        trees[database].nodesById[newSha] = files[database][filePath]
    }

    if (filePath.includes('settings') && filePath.endsWith('.json'))
        saveSettings(content)
}


function updateMaxLines() {

    if (!editorContainer.classList.contains('not-hidden'))
        return

    const lineHeight = aceEditor.renderer.lineHeight;
    //const availableHeight = editorWrapper.clientHeight;

    // Calculate how many lines fit in that space
    const isFull = fullScreenLayout()
    const realHeight = getFullScreenFit(1.01)
    //const height = getFullScreenFit(1.01) // isFull ? 0.99 : 0.75) // opposite terminal 0.25
    //let calculatedMax = aceEditor.getValue().split('\n').length
    // add scroll to bottom of files
    //    + (height * 0.25 / lineHeight)
    //if (!isFull) {
    //calculatedMax = Math.floor(height / lineHeight);
    //}
    //aceEditor.setOptions({
    //    maxLines: calculatedMax,
    //    minLines: calculatedMax
    //});
    editorContainer.style.height = `${realHeight}px`;
    aceEditor.resize();
    aceEditor.renderer.updateFull();

}


/**
 * Throttle handler to guard performance during heavy mouse drag/sweep gestures
 */


// =========================================================================
// EVENT REGISTRATION AND ATTACHMENTS
// =========================================================================

// Attach to the main content container renderer canvas layer of the Ace architecture


aceEditor.commands.addCommand({
    name: "forceSystemCopy",
    bindKey: { win: "Ctrl-C", mac: "Command-C" },
    exec: function (editor) {
        const range = aceEditor.getSelectionRange();
        if (range && !range.isEmpty()) {
            let selectedText = aceEditor.session.getTextRange(range);

            if (selectedText) {
                // FIX: Strip out null bytes (\x00) and dangerous low-ASCII control characters (0-31)
                // except for normal layout formatting like tabs (\t), line feeds (\n), and carriage returns (\r)
                selectedText = selectedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

                navigator.clipboard.writeText(selectedText).then(() => {
                    console.log("Sanitized range copy successful.");
                }).catch(err => {
                    console.error("Clipboard API blocked: ", err);
                });
            }
        }
    }
});



function forceEditorFoldByLine(targetStartLine) {
    const session = aceEditor.getSession();
    const rowIdx = targetStartLine - 1; // Convert human tree line back to 0-indexed row

    // Force Ace to calculate the range bounds using our ANTLR visitor logic
    const range = session.getFoldWidgetRange(rowIdx);
    if (range) {
        // Add the fold natively, collapsing the target section instantly
        session.addFold("...", range);
    }
}

/**
 * Ingests computed worker fold scopes and applies them straight onto the Ace Gutter
 * @param {Ace.EditSession} aceSession
 * @param {string} sourceText
 * @param {string} languageKey
 */
async function syncCodeCollapsing(aceSession, sourceText, languageKey) {
    try {
        // 1. Fetch multi-channel structural folds asynchronously from the worker
        const foldRegions = await window.languageApi.runAsync('folds', {
            text: sourceText,
            language: languageKey
        });

        // 2. Clear out archaic stale folds to avoid conflict drift
        aceSession.clearFolds();

        // 3. Inject computed regions directly into Ace's background layout manager
        foldRegions.forEach(region => {
            try {
                // Ace dynamic native fold insertion: addFold(message, range)
                // Range parameters: (startRow, startColumn, endRow, endColumn)
                aceSession.addFold(
                    "...",
                    new ace.Range(region.startRow, 0, region.endRow, 1000)
                );
            } catch (e) {
                // Suppress overlaps if user is in the middle of writing open fragments
            }
        });
    } catch (err) {
        console.error("[Ace Collapsing Engine] Synchronization failure:", err);
    }
}


function executeGlobalWorkspaceCollapse() {
    const session = aceEditor.getSession();
    const blocks = session.antlrDiscoveredFoldBlocks || [];

    // Sort backwards from the bottom of the file up to preserve nested index integrity
    const processingQueue = [...blocks].sort((a, b) => b.startLine - a.startLine);

    processingQueue.forEach(block => {
        const rowIdx = block.startLine - 1;
        const range = session.getFoldWidgetRange(rowIdx);
        if (range) {
            try {
                session.addFold("...", range);
            } catch (e) {
                // Safe bypass if parent blocks already wrapped and swallowed the sub-range
            }
        }
    });
}



