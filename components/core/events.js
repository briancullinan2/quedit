

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

