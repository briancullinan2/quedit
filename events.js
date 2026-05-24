async function onLoadCore() {
    isDevToolsOpen()
    await initializeFiletrees()
    // give other tools time to startup
    setTimeout(() => {
        renderHashCommand(window.location.hash.substring(1), true)
    }, 300);
}


function isDevToolsOpen() {
    const threshold = 160; // Cushion for window borders

    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    const hasClass = document.body.classList.contains('debugger')

    const debuggerIsOpen = widthThreshold || heightThreshold
    if (debuggerIsOpen && !hasClass)
        document.body.classList.add('debugger')
    else if (!debuggerIsOpen && hasClass)
        document.body.classList.remove('debugger')

    return widthThreshold || heightThreshold;
}

function onLoadTerminal() {
    // Force xterm panel element layout recalculations
    // this is the panel management stuff i didn't post to gemini
    //const wrapper = document.getElementById('terminal-container');
    //if (wrapper) wrapper.classList.remove('hidden');
    //if (wrapper) wrapper.classList.add('not-hidden');


    // TODO: insert xterm startup

    lineCount += terminalLog.reduce((sum, l) => {
        const text = l.text || l; // handles both structured objects and raw strings
        return sum + (text.match(/\n/g) || []).length;
    }, 0)

    // allow ux to adjust to class change and xterm to start
    setTimeout(() => {

        setTerminalAceTheme()
        forceFit()
        if (!window.terminalLoaded) {
            term.write(terminalLog.map(l => l.text || l).join(''))
            if (!terminalLoaded && terminalLog.length > 0)
                writePrompt()
            window.terminalLoaded = true
        }

    }, 200)

    // Execute internal scan loops matching your terminal selections
    setTimeout(() => {
        const searchInput = document.getElementById('search-terminal');
        if (typeof performSharedBufferScanInternal === 'function' && searchInput) {
            performSharedBufferScanInternal(searchInput.value);
        }
    }, 1000);
}

function onUnloadTerminal() {
    // That xterm "bs" is an event emitter notifying the process tree to close standard I/O streams.
    // Call it safely right here before the tab tears down.
    if (window.term?.dispose) window.term.dispose();
}

function onLoadEditor() {
    updateMaxLines()

    const themeSelector = document.getElementById('theme');
    if (themeSelector && window.ace) {
        setTheme(SettingsManager.get('editor', 'savedTheme'))
    }

    tryLoadingTerminalEditorBridge()
}


function tryLoadingTerminalEditorBridge() {

    if (!window.aceEditor || window.compilerDiagnostics /* already setup */) {
        return
    }

    // Force Ace to locate, download, and compile the extension module asynchronously
    ace.config.loadModule(["ext", "compiler_diagnostics"], function () {
        window.require(["ace/ext/compiler_diagnostics"], function (moduleExports) {
            if (!moduleExports) {
                console.error("[Ace Lazy] Failed to initialize compiler_diagnostics extension.");
                return;
            }

            // 1. Map the loaded module exports to your global tracking variable alias
            window.compilerDiagnostics = moduleExports;

            // 2. Attach the active editor instance to kick off mouse interceptors
            //setEditor(window.aceEditor);

            // 3. Populate the background bridge arrays from your master terminal logs cache
            window.diagnosticsBridge = moduleExports.getBridge(window.aceEditor?.getSession());
            diagnosticsBridge.collectedLogLines = terminalLog.map(log => log.text || log);
            diagnosticsBridge.triggerBridgeRefresh()
            console.log("[Ace Lazy] Compiler diagnostics overlay successfully linked.");
        });
    });
}


function hasChangedEditor() {
    if (!window.aceEditor) return false;
    const session = currentSession()
    let currentSha = window.currentOpenFileId
    if (currentSha.length !== 40 && currentSha.length !== 64) {
        currentSha = trees['#database'].nodesById[session]?.sha
    }

    // TODO: currentFileId or getSession() file path
    return window.currentFileChangesSha !== window.initialTextSha
        && window.currentFileChangesSha !== currentSha;
}

function hasChangesBuilder() {
    // TODO: check compiler state either from isCompiling? or something in worker API? i don't remember
    if (window.runningCommand) {
        return true
    }
    if (window.api) {
        window.api.terminate()
    }
    return false
}


function onLoadEngine() {
    // Contextual renderer engine picker from localStorage
    const preferredRenderer = SettingsManager.get('quake3e', 'preferredRendeer');
    if (preferredRenderer !== 'quake3e') {
        setTimeout(window.runTojiEngine, 100);
    } else {
        if (typeof window.runEngine === 'function') window.runEngine();
    }
}


function onLoadToji() {
    setTimeout(window.runTojiEngine, 100);
}

function onLoadPaint() {
    // TRICK WEBPACK MINI_PAINT: Intercept and force-resolve their internal Deferred initialization ready flag 
    // If miniPaint mapped its entry wrapper 'k' onto window scope:
    if (!window.GUI && typeof window.loadPaint === 'function') {
        window.loadPaint()
    }

    if (typeof window.hookMiniPaintIntercept === 'function') {
        window.hookMiniPaintIntercept();
    }
    if (window.AppConfig) {
        // 1. Force transparent grid background setting to true
        window.AppConfig.TRANSPARENCY = true

        // 2. Trigger a full canvas re-render to update the visual workspace layers
        //if (window.Layers && typeof window.Layers.render === 'function') {
        window.Layers.render();
        //}
        //window.GUI.render_main_gui()
    }

    updatePainter()

}

function hasChangesPaint() {
    // Replaced miniPaint's auto-attached event listener with an explicit module evaluation
    if (window.AppConfig && window.Layers && typeof window.Layers.is_layer_empty === 'function') {
        return window.AppConfig.layers.length > 1 || !window.Layers.is_layer_empty(window.AppConfig.layer.id);
    }
    return false;
}


document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Instantly resolve core application layouts, zips, and global filesystems
        await DependencyLoader.loadModule('core');

        SettingsManager.hydrateAll();

        //const currentTheme = IMPORT_SETTINGS.editor.savedTheme.get
        //    ? IMPORT_SETTINGS.editor.theme.get()
        //    : (document.getElementById(IMPORT_SETTINGS.editor.savedTheme.elementId)?.value 
        //    || IMPORT_SETTINGS.editor.savedTheme.default);

        // 3. Mount workspace split layout panel preference
        const userWorkspaceChoice = SettingsManager.get('core', 'workspaceDefault');

        await DependencyLoader.loadModule(userWorkspaceChoice);

    } catch (error) {
        console.error('Fatal Application Bootstrap Interruption:', error);
    }
});



window.addEventListener('beforeunload', async (event) => {
    let blockingModuleKey = null;
    let workIsUnsaved = false;

    // Scan every defined module inside the runtime to see if it claims unwritten states
    for (const [key, module] of Object.entries(IMPORT_MODULES)) {
        if (typeof module.hasChanges === 'function') {
            if (module.hasChanges()) {
                workIsUnsaved = true;
                blockingModuleKey = key;
                break; // Stop scanning on first conflict
            }
        }
    }

    if (workIsUnsaved) {
        // Gracefully route back to the panel that holds the un-saved work so the dev can see it
        const moduleConfig = IMPORT_MODULES[blockingModuleKey];
        if (moduleConfig && moduleConfig.panelId) {
            renderToolbarCommand(moduleConfig.panelId);
        }

        // Execute standard cleanup instructions if any were defined
        if (typeof IMPORT_MODULES[blockingModuleKey].onUnload === 'function') {
            IMPORT_MODULES[blockingModuleKey].onUnload();
        }

        // Trigger standard browser navigation confirmation overlay
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
});


let resizeDebounce = null
function resizeDebouncer() {
    if (resizeDebounce) return
    resizeDebounce = setTimeout(() => {
        if (window.forceFit)
            forceFit();
        if (window.updatePainter)
            updatePainter()

        isDevToolsOpen()
        // toji
        if (window.onResize)
            window.onResize()

        resizeDebounce = null

        debounceFileChange()

        if (window.aceEditor && window.terminalWrite && !window.compilerDiagnostics) {
            tryLoadingTerminalEditorBridge()
        }

        // don't need to do this on resize because its fixed now at 120ch
        //if (terminalWrapper.classList.contains('not-hidden')) {

        //    performSharedBufferScanInternal(searchTerminal.value)
        //performFilenameSearch()
        //}

    }, 500);
}

window.addEventListener('resize', resizeDebouncer);