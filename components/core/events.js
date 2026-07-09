

const IMPORT_MODULES = {
    core: {
        css: IMPORT_CSS['core'],
        js: IMPORT_JS['core'],
        onLoad: onLoadCore
    },

    terminal: {
        panelId: 'terminal-container',
        css: IMPORT_CSS['terminal'],
        js: IMPORT_JS['terminal'],
        //onLoad: onLoadTerminal, //xterm.onRender
        onUnload: onUnloadTerminal
    },

    editor: {
        panelId: 'editor',
        js: IMPORT_JS['editor'],
        // Dynamic SHA tracking for modifications
        onLoad: onLoadEditor,
        hasChanges: hasChangedEditor
    },

    build: {
        js: IMPORT_JS['build'],
        hasChanges: hasChangesBuilder
    },

    quake3e: {
        panelId: 'viewport-frame',
        js: IMPORT_JS['quake3e'],
        onLoad: onLoadEngine
    },

    toji: {
        panelId: 'viewport-frame',
        js: IMPORT_JS['toji'],
        onLoad: onLoadToji
    },

    paint: {
        panelId: 'paint-container',
        css: IMPORT_CSS['paint'],
        js: IMPORT_JS['paint'],
        onLoad: onLoadPaint,
        hasChanges: hasChangesPaint
    },


    nunu: {
        panelId: 'nunu',
        js: IMPORT_JS['nunu'],
        css: IMPORT_CSS['nunu'],
        onLoad: () => window.nunu.initialize()
    },

    audio: {
        panelId: 'audio-editor',
        js: IMPORT_JS['audio'],
        css: IMPORT_CSS['audio'],
    }
};




// One-time terminal startup. This is only invoked by ensureTerminalStarted()
// (terminal.js), which guarantees the panel is visible and xterm has a valid
// cell size before we run -- so there is no setTimeout guesswork here. Ordering
// is preserved by dumping the backlog first and only flipping
// window.terminalLoaded (the live-write gate in logging.js) afterwards, so live
// log lines can't interleave ahead of the backlog.
function onLoadTerminal() {
    lineCount += terminalLog.reduce((sum, l) => {
        const text = l.text || l; // handles both structured objects and raw strings
        return sum + (text.match(/\n/g) || []).length;
    }, 0)

    syncThemeWithAce()
    forceFitLayout(true)

    // Dump the buffered backlog, then draw the prompt once it has been written.
    // terminalLoaded is flipped synchronously right after queueing the backlog
    // so that live log lines (logging.js) queue into xterm's ordered write
    // buffer behind the backlog instead of being dropped or interleaved.
    window.terminalFrameLimiter.requestFrameUpdate(() => {
        const backlog = terminalLog.map(l => l.text || l).join('');
        const hadBacklog = terminalLog.length > 0;
        term.write(backlog, () => { if (hadBacklog) writePrompt(); });
        window.terminalLoaded = true;
    });

    terminalContainer.focus()

    // Kick off the initial viewport scan on the render queue.
    window.terminalFrameLimiter.requestFrameUpdate(() => {
        const searchInput = document.getElementById('search-terminal');
        if (typeof scanVisibleViewport === 'function' && searchInput) {
            scanVisibleViewport(searchInput.value);
        }
    });
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




function hasChangedEditor() {
    if (!window.aceEditor) return false;
    const session = currentSession()
    let currentSha = window.currentOpenFileId
    if (currentSha && currentSha.length !== 40 && currentSha.length !== 64) {
        currentSha = trees['#database'].nodesById[session]?.sha
    }

    // TODO: currentFileId or getSession() file path
    return window.currentOpenFileId !== window.initialTextSha
        && window.currentOpenFileId !== currentSha;
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
    const preferredRenderer = SettingsManager.get('quake3e', 'preferredRenderer');
    if (preferredRenderer !== 'quake3e') {
        setTimeout(window.runTojiEngine, 100);
    } else {
        setTimeout(window.runEngine, 100);
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

        await manageServiceWorker()

        //const currentTheme = IMPORT_SETTINGS.editor.savedTheme.get
        //    ? IMPORT_SETTINGS.editor.theme.get()
        //    : (document.getElementById(IMPORT_SETTINGS.editor.savedTheme.elementId)?.value
        //    || IMPORT_SETTINGS.editor.savedTheme.default);

        // 3. Mount workspace split layout panel preference
        const userWorkspaceChoice = SettingsManager.get('core', 'workspaceDefault');

        await DependencyLoader.loadModule(userWorkspaceChoice);

    } catch (error) {
        debugger
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
            renderToolbarCommand(moduleConfig.panelId, true);
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
        if (window.forceFitLayout)
            forceFitLayout();
        if (window.updatePainter)
            updatePainter()

        isDevToolsOpen()
        // toji
        if (window.onResize)
            window.onResize()

        resizeDebounce = null

        if (typeof debounceFileChange !== 'undefined')
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



function updateModifierPressed(e) {
    window.isModifierPressed = e.ctrlKey || e.metaKey;
    window.isShiftPressed = e.shiftKey;

    const hasClass = document.body.classList.contains('modifier')

    // TODO: set engine to 1 FPS if debugger is open, not only because it runs
    //   slower but the nature of debugging is seeing the frames
    if (!window.isModifierPressed && hasClass)
        document.body.classList.remove('modifier')
    if (window.isModifierPressed && !hasClass)
        document.body.classList.add('modifier')


    const hasShift = document.body.classList.contains('shift')
    if (!window.isShiftPressed && hasShift)
        document.body.classList.remove('shift')
    if (window.isShiftPressed && !hasShift)
        document.body.classList.add('shift')


    isDevToolsOpen()
}


window.addEventListener('keydown', async (e) => {
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
    if (window.isShiftPressed && window.isModifierPressed
        && (e.key === 'f' || e.key === 'F')) {
        if (!document.getElementById('searchlist').classList.contains('not-hidden'))
            await renderTabsCommand('searchlist')
        setTimeout(() => search.focus(), 500)
        e.preventDefault();
    }
});


window.addEventListener('keyup', (e) => {
    updateModifierPressed(e)
})

