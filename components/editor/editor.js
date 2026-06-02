
let tempCount = 1;



const sessionCache = {};

function getOrCreateAceSession(fileId, content) {
    if (sessionCache[fileId]) {
        return sessionCache[fileId];
    }

    const session = ace.createEditSession(content);

    // Bind the workspace file identifier permanently
    session.workspaceFileId = fileId;
    getGitShaBrowser(content).then(sha => {
        window.initialTextSha = window.currentOpenFileId = sha
    })

    const mode = getModeByFilename(fileId);
    session.setMode(mode);

    bindBlockTrackerToSession(aceEditor.getSession());


    /*
    ace.config.loadModule(["mode", "antlr_worker"], function () {
        require(["ace/mode/antlr_worker"], function (mod) {
            // Instantiate our clean worker bridge passing the session
            var worker = new mod.AntlrWorker(session);
            
            // Derive a language identity tag from the file suffix (e.g., 'c', 'cpp', 'js')
            const ext = fileId.split('.').pop().toLowerCase();
            worker.setLanguageTarget(ext, fileId);
            
            // Inform the backend thread what language grammar template to execute
            
        });
    });
    */


    if (fileId.endsWith('.c') || fileId.endsWith('.h')) {
        session.setTabSize(4);
    }

    sessionCache[fileId] = session;
    return session;
}

function currentSession() {
    return Object.keys(sessionCache).find(k => sessionCache[k] === aceEditor.getSession())
}


ace.config.set('basePath', './ace')
const editorContainer = document.getElementById('editor')
const initialCode = document.getElementById('editor').textContent
const aceEditor = window.aceEditor = ace.edit("editor");
aceEditor.setTheme(window.savedTheme);
aceEditor.renderer.setShowGutter(true);
aceEditor.renderer.$gutterLayer.setShowLineNumbers(true)
aceEditor.renderer.$loop.schedule(aceEditor.renderer.CHANGE_GUTTER);
aceEditor.setOptions({
    // Core cursor placement optimizations
    scrollPastEnd: 0.9,       // Keeps cursor centered when adding new code at EOF
    showPrintMargin: true,
    navigateWithinSoftTabs: true,
    printMarginColumn: 80,
    foldStyle: 'markbegin',
    showFoldWidgets: true,
    fadeFoldWidgets: false,
    //animatedScroll: true,
    //autoScrollEditorIntoView: false,
})
const session = getOrCreateAceSession('temp' + (++tempCount) + '.c', initialCode);
aceEditor.setSession(session);

updateMaxLines()

let currentBlockMarkerId = null;
let lastRenderedBoundsKey = ""; // State tracking anchor to prevent redundant paint steps



function handleWorkerBlockHighlight(session, responseData) {
    if (!responseData) return;

    const { startLine, endLine } = responseData;
    if (!startLine || !endLine) return;

    // Create an atomic validation key representational snapshot
    const boundsKey = `${startLine}:${endLine}`;

    // TARGET EFFICIENCY GATE: If the active stream hasn't shifted structural boundaries,
    // bail out instantly. This saves thousands of microsecond paint operations while typing.
    if (boundsKey === lastRenderedBoundsKey) {
        return;
    }
    lastRenderedBoundsKey = boundsKey;

    const aceRange = ace.require("ace/range").Range;

    // Clear the old background marker layout overlay cleanly
    if (currentBlockMarkerId !== null) {
        session.removeMarker(currentBlockMarkerId);
        currentBlockMarkerId = null;
    }

    // Convert values back to Ace's internal 0-indexed column system
    // Selects lines cleanly from the first character column to max line length boundary bounds
    const highlightRange = new aceRange(startLine - 1, 0, endLine - 1, Number.MAX_SAFE_INTEGER);

    // Inject background marker layer (class name targets your theme high-contrast CSS style sheet)
    currentBlockMarkerId = session.addMarker(
        highlightRange,
        "ace_active_block_scope_highlight",
        "fullLine"
    );
}




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


const NavHistory = {
    stack: [],
    index: -1,
    isNavigating: false,

    // Call this whenever a file is opened or a "jump" happens
    push(fileId, row, column) {
        if (this.isNavigating) return;

        // If we were in the middle of the stack and did a new action, 
        // truncate the "forward" history (standard browser behavior)
        if (this.index < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.index + 1);
        }

        this.stack.push({ fileId, row, column });
        this.index = this.stack.length - 1;
    },

    back() {
        if (this.index > 0) {
            this.isNavigating = true;
            this.index--;
            this.apply();
            this.isNavigating = false;
        }
    },

    forward() {
        if (this.index < this.stack.length - 1) {
            this.isNavigating = true;
            this.index++;
            this.apply();
            this.isNavigating = false;
        }
    },

    apply() {
        const point = this.stack[this.index];
        let database = owner.value + '/' + repository.value
        const filePath = trees[database].nodesById[point.fileId].path
        window.currentOpenFileId = point.fileId; debugger
        trees[database].values = [point.fileId];
        debugger
        openFile(owner.value, repository.value, filePath, trees[database].nodesById[point.fileId].sha, false);

        aceEditor.gotoLine(point.row + 1, point.column);
    }
};


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
 * Ace Editor Real-Time Interaction and Telemetry Linker
 * Tracks token context beneath cursor on hotkey modifier hold.
 */

// Global tracking references for throttling layout updates

/**
 * Updates your shared application status bar layout element
 */
function updateAceStatus(data) {
    if (!statusBar) return;
    if (!data) {
        statusBar.innerText = "Editor: Idle";
        return;
    }

    const cursor = aceEditor.getCursorPosition();
    const cursorLine = cursor.row + 1;
    const cursorCol = cursor.column + 1;

    const tokenInfo = data.tokenText
        ? `Token: "${data.tokenText}" [${data.tokenType}]${data.isFunctionCall ? ' (Function Call)' : ''}, `
        : '';

    // 4. FORMAT ERROR BANNER TEXT
    // If a compiler error is present on this line, append a bold visual flag 
    // to instantly warn the user inside the status layer.
    const errorInfo = data.compilerError
        ? ` ⚠️  ${data.compilerError.replace(/\n/g, ' | ')}, `
        : '';

    statusBar.innerText = `Editor: Mouse: ${data.row}x${data.column}, `
        + `Cursor: ${cursorLine}x${cursorCol}, `
        + tokenInfo
        + errorInfo // Displays smoothly across the bottom line sequence
        + `File: ${data.file}, ID: ${data.id}`;


    /*
    const aceContainer = event.target.closest('.ace_editor');

    if (aceContainer && aceContainer.env) {
        const diagnosticsModule = ace.require("ace/ext/compiler_diagnostics");
        if (diagnosticsModule) {
            const bridge = diagnosticsModule.getBridge();
            
            // Confirm this specific DOM node belongs to our active tracking channel
            if (bridge.activeEditor === aceContainer.env.editor) {
                // Read or mutate the raw state context variables straight from your script
                let rawLines = bridge.collectedLogLines;
                let currentRegexPattern = bridge.lccPattern;
            }
        }
    }
    */
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

// Keep track of the active gutter line row to prevent erratic multi-firing updates



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



