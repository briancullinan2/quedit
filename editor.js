
let tempCount = 1;



const statusBar = document.getElementById('statusbar')
const sessionCache = {};

function getOrCreateAceSession(fileId, content) {
    if (sessionCache[fileId]) {
        return sessionCache[fileId];
    }

    const session = ace.createEditSession(content);

    // Bind the workspace file identifier permanently
    session.workspaceFileId = fileId;

    const mode = getModeByFilename(fileId);
    session.setMode(mode);
    
    
    ace.config.loadModule(["mode", "antlr_worker"], function () {
        require(["ace/mode/antlr_worker"], function (mod) {
            // Instantiate our clean worker bridge passing the session
            var worker = new mod.AntlrWorker(session);
            
            // Derive a language identity tag from the file suffix (e.g., 'c', 'cpp', 'js')
            const ext = fileId.split('.').pop().toLowerCase();
            
            // Inform the backend thread what language grammar template to execute
            //debugger
            worker.setLanguageTarget(ext, fileId);
        });
    });
    

    if (fileId.endsWith('.c') || fileId.endsWith('.h')) {
        session.setTabSize(4);
    }

    sessionCache[fileId] = session;
    return session;
}

function currentSession() {
    return Object.keys(sessionCache).find(k => sessionCache[k] === aceEditor.getSession())
}


const editorWrapper = document.getElementById('editor-container')
const editorContainer = document.getElementById('editor')
const initialCode = document.getElementById('editor').textContent
let aceEditor = window.aceEditor = ace.edit("editor");
aceEditor.setTheme(window.savedTheme);
aceEditor.renderer.setShowGutter(true);
aceEditor.renderer.$gutterLayer.setShowLineNumbers(true)
aceEditor.renderer.$loop.schedule(aceEditor.renderer.CHANGE_GUTTER);
aceEditor.setOptions({
    // Core cursor placement optimizations
    scrollPastEnd: 0.9,       // Keeps cursor centered when adding new code at EOF
    showPrintMargin: true,
    navigateWithinSoftTabs: true,
    printMarginColumn: 80
    //animatedScroll: true,
    //autoScrollEditorIntoView: false,
})
const session = getOrCreateAceSession('temp' + (++tempCount) + '.c', initialCode);
aceEditor.setSession(session);
getGitShaBrowser(aceEditor.getValue()).then(sha => {
    window.initialTextSha = window.currentOpenFileId = sha
})

updateMaxLines()


function setTheme(theme) {
    const themeName = theme.split('/').pop(); // Gets 'monokai' or 'dracula'

    for (let cn of document.body.classList) {
        if (cn.startsWith('theme-')) {
            document.body.classList.remove(cn)
        }
    }

    document.body.classList.add(`theme-${themeName.replace(/_/g, '-')}`);
    // Actually tell Ace to change its internal theme too
    aceEditor.setTheme(theme);
    savedTheme = theme
    // wait for update on page so it can scan for colors out of css
    if (window.setTerminalAceTheme)
        setTimeout(() => {
            setTerminalAceTheme()
        }, 500);

}

// Utility to convert rgb/rgba strings to hex
function parseToHex(colorStr, backgroundStr = null) {
    if (!colorStr || typeof colorStr !== 'string') return colorStr;
    if (colorStr.startsWith('#')) return colorStr;

    const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!match) return colorStr;

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

    // OPTION A: If xterm fails to render transparency properly, 
    // flatten the color over the background color.
    if (backgroundStr && a < 1) {
        const bgMatch = backgroundStr.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (bgMatch) {
            const bgR = parseInt(bgMatch[1], 16);
            const bgG = parseInt(bgMatch[2], 16);
            const bgB = parseInt(bgMatch[3], 16);

            const blendedR = Math.round((1 - a) * bgR + a * r).toString(16).padStart(2, '0');
            const blendedG = Math.round((1 - a) * bgG + a * g).toString(16).padStart(2, '0');
            const blendedB = Math.round((1 - a) * bgB + a * b).toString(16).padStart(2, '0');
            return `#${blendedR}${blendedG}${blendedB}`;
        }
    }

    // OPTION B: Standard 8-digit hex conversion (#RRGGBBAA)
    const hexR = r.toString(16).padStart(2, '0');
    const hexG = g.toString(16).padStart(2, '0');
    const hexB = b.toString(16).padStart(2, '0');
    const hexA = Math.round(a * 255).toString(16).padStart(2, '0');

    return `#${hexR}${hexG}${hexB}`; // ${hexA}
}


let navTimer;

aceEditor.on("changeSelection", function () {
    // FIX: If the user is selecting a block of text, do not interrupt them
    //if (!aceEditor.selection.isEmpty()) return; 

    if (typeof NavHistory !== 'undefined' && NavHistory.isNavigating) return;

    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
        const pos = aceEditor.getCursorPosition();
        const currentFile = typeof window.currentOpenFileId !== 'undefined' ? window.currentOpenFileId : null;

        // Ground coordinates to human 1-based format inside tracking tables
        const humanRow = pos.row + 1;
        const humanCol = pos.column + 1;

        const lastPoint = NavHistory.stack[NavHistory.index];
        if (!lastPoint || lastPoint.fileId !== currentFile || Math.abs(lastPoint.row - humanRow) > 5) {
            NavHistory.push(currentFile, humanRow, humanCol);
        }
        window.updateEditorLineIds()
    }, 500);
});

aceEditor.on('change', () => {
    debounceFileChange(window.aceEditor);
})

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
            window.currentFileChangesSha = await window.getGitShaBrowser(currentContent);
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
        openFile(owner.value, repository.value, filePath, trees[database].nodesById[point.fileId].sha, false);

        aceEditor.gotoLine(point.row + 1, point.column);
    }
};

function updateModifierPressed(e) {
    isModifierPressed = e.ctrlKey || e.metaKey;

    const hasClass = document.body.classList.contains('modifier')

    // TODO: set engine to 1 FPS if debugger is open, not only because it runs
    //   slower but the nature of debugging is seeing the frames
    if (!isModifierPressed && hasClass)
        document.body.classList.remove('modifier')
    if (isModifierPressed && !hasClass)
        document.body.classList.add('modifier')
}


window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') NavHistory.back();
    if (e.altKey && e.key === 'ArrowRight') NavHistory.forward();
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
    if (e.key === 'Escape') {
        modal.classList.add('hidden')
    }
    updateModifierPressed(e)
});


window.addEventListener('keyup', (e) => {
    updateModifierPressed(e)
})

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

    if (filePath.includes('settings.json'))
        saveSettings(content)
}

function fullScreenLayout() {
    const width = window.document.body.clientWidth - SCROLLBAR_WIDTH
        - (window.document.body.clientWidth < 800 ? 60 : 0);
    return width < 800
}

function getFullScreenFit(defaultFactor = 0.25) {
    const isFull = fullScreenLayout()
    const tools = document.getElementById('toolbar').clientHeight
        + statusBar.clientHeight;
    const height = (window.innerHeight - tools) * defaultFactor
    return height
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


function updatePainter() {
    if (imageEditor.classList.contains('not-hidden') && typeof window.GUI !== 'undefined') {
        const height = getFullScreenFit(1)
        window.GUI.set_size(window.innerWidth - 60, height);
        window.Layers.render();
        window.GUI.prepare_canvas()
        //window.GUI.render_main_gui()
    }

}


/**
 * Ace Editor Real-Time Interaction and Telemetry Linker
 * Tracks token context beneath cursor on hotkey modifier hold.
 */

// Global tracking references for throttling layout updates
let lastTrackedRow = -1;
let lastTrackedColumn = -1;
let aceMoveDebounceTimer = null;
/**
 * Main event processor for Ace mouse movements.
 * Converts screen positions into exact buffer coordinates.
 */
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
    if (!filePath && window.trees && window.trees[database]) {
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
let previousAceUpdate = null;
function onAceMouseMove(event) {
    // Immediate early exit if modifier isn't engaged to ensure completely zero lag typing
    //if (!event.ctrlKey && !event.metaKey) {
    //    return;
    //}

    if (aceMoveDebounceTimer) return;

    aceMoveDebounceTimer = setTimeout(() => {
        previousAceUpdate = detectAceEditorEvents(event);
        aceMoveDebounceTimer = null;
    }, 100); // Efficient 100ms calculation window
}

// =========================================================================
// EVENT REGISTRATION AND ATTACHMENTS
// =========================================================================

// Attach to the main content container renderer canvas layer of the Ace architecture
editorWrapper.addEventListener('mousemove', onAceMouseMove);

/**
 * Click handler execution block.
 * When a user clicks a function token with the modifier held, jump execution locations.
 */
editorWrapper.addEventListener('mousedown', async (event) => {

    // Intercept standard focus adjustments
    event.preventDefault();

    const telemetry = detectAceEditorEvents(event);
    if (!telemetry || !telemetry.tokenText) return;

    if (!event.ctrlKey && !event.metaKey) return;

    if (typeof writeLog === 'function') {
        writeLog(`Ace Intercept -> Token: ${telemetry.tokenText}, Line: ${telemetry.row}, Fn: ${telemetry.isFunctionCall}`);
    }

    debugger

    // --- THE JUMP ENGINE EXTENSION HOOK ---
    if (telemetry.isFunctionCall) {
        if (typeof lookupFunctionDefinition === 'function') {
            // Your future linker handler: parses function references across index trees
            await lookupFunctionDefinition(telemetry.tokenText, telemetry.fileId);
        } else {
            console.log(`Ready to link function definition for: ${telemetry.tokenText}`);
        }
    }
});

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
let lastTrackedGutterRow = null;


// Clear out our row state cache whenever the mouse rolls out of the gutter strip completely
window.aceEditor.on("guttermouseout", function () {
    lastTrackedGutterRow = null;
    if (globalTooltip) {
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

