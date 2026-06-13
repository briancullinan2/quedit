



function getDocumentPanelFromClickId(panelId) {

    let panelDocumentId = panelId
    if (panelId === 'play' || panelId === 'run' || panelId === 'reload'
        || panelId === 'spawn'
    )
        panelDocumentId = 'viewport-frame'
    if (panelId === 'compile' || panelId === 'build' || panelId === 'terminal')
        panelDocumentId = 'terminal-container'
    if (panelId === 'new' || panelId === 'settings')
        panelDocumentId = 'editor'


    // write the panel id as if they clicked directly on the folder list
    if (panelId === 'owner' || panelId === 'branch'
        || panelId === 'repository'
    ) {
        // TODO: the opposite of below, match selected repos up with 
        //  their possible already set file tree
        if (engineRepository === owner.value + '/' + repository.value)
            panelId = 'filelist'
        if (gameRepository === owner.value + '/' + repository.value)
            panelId = 'gamelist'
        if (assetRepository === owner.value + '/' + repository.value)
            panelId = 'assetlist'
        if (toolsRepository === owner.value + '/' + repository.value
            || tools2Repository === owner.value + '/' + repository.value
        )
            panelId = panelDocumentId = 'database'
    }

    if (panelId === 'collapse')
        panelDocumentId = latestFilelistId || 'filelist'

    if (TERMINALS.includes(panelId))
        panelDocumentId = 'terminal-container'

    return [panelId, panelDocumentId]
}


const DOESNT_AFFECT_UI = [
    'github-login', 'back', 'next', 'fullscreen',
    'layout', 'share', 'pause', 'stop', 'save',
    'configuration', 'theme', 'repository',
    'wasi', 'theme', 'keybinding', 'reload',
    'branch', 'owner', 'toolbar', 'fileHistory',
    'map', 'spawn'
    
]

let toolbarTabDebounce = null
let latestPanelId = 'editor'
let previousPanelId = null
let debouncedPanelId = null
let previousFilelistId = null
let latestFilelistId = 'filelist'
let notFilelist = 'editor'
let previousNotFilelistId = null

async function renderTabsCommand(panelId, noBounce = false, hidePanels = true) {

    if (!panelId) return

    // helps always use the latest submitted id, even though latest and previous are tracked separately below
    debouncedPanelId = panelId

    if (!noBounce && toolbarTabDebounce) return
    if (!noBounce) {
        toolbarTabDebounce = setTimeout(() => {
            renderTabsCommand(debouncedPanelId, true, hidePanels)
            toolbarTabDebounce = null
        }, 400)
        return
    }

    let database = owner.value + '/' + repository.value

    const [reasignedPanelId, panelDocumentId] = getDocumentPanelFromClickId(panelId)
    const panel = document.getElementById(panelDocumentId)


    let changedClass = false
    if (!DOESNT_AFFECT_UI.includes(panelId)) {
        // don't record as a state
        if (panel && panelId != 'collapse') {
            // prevent duplication and swaping
            if (latestPanelId !== previousPanelId
                && latestPanelId !== panel.id
            ) {
                previousPanelId = latestPanelId
                changedClass = true
            }
            if (latestPanelId !== panel.id) {
                latestPanelId = panel.id
                changedClass = true
            }
        }
    }

    if (!DOESNT_AFFECT_UI.includes(panelId)
        && !panelId.startsWith('main_menu')
    ) {
        let hadOpen = false
        if (hidePanels) {
            // hide all if we are switching files lists
            if (FILELIST_IDS.includes(panelId)) {
                hadOpen = hideOpenPanels(true)
            }
            else
                // or if the user manually changed pages and the new page is not a file list
                hadOpen = hideOpenPanels(changedClass)
        }


        let latestNotFilelist = true
        let previousNotFilelist = true
        if (FILELIST_IDS.includes(previousPanelId)) {
            previousFilelistId = previousPanelId
            previousNotFilelist = false
        }
        if (FILELIST_IDS.includes(latestPanelId)) {
            previousFilelistId = latestFilelistId
            latestFilelistId = latestPanelId
            latestNotFilelist = false
        }



        // defect from over compensating for class names not changing latestPanelId above created a defect here
        if (latestNotFilelist) {
            notFilelist = latestPanelId
        }
        else if (previousNotFilelist) {
            notFilelist = previousPanelId
        }


        const latestFileElement = document.getElementById(latestFilelistId)
        if (latestFileElement
            && panelId === latestFilelistId
            && latestFilelistId !== previousFilelistId
        ) {
            latestFileElement.classList.remove('hidden')
            latestFileElement.classList.add('not-hidden')
        } else if (latestFileElement
            && (panelId === 'collapse' && panelDocumentId === latestFilelistId)
            || panelId === latestFilelistId) {
            if (hadOpen && !latestFileElement.classList.contains('hidden')) {
                latestFileElement.classList.add('hidden')
                latestFileElement.classList.remove('not-hidden')
            } else if (!hadOpen && !latestFileElement.classList.contains('not-hidden')) {
                latestFileElement.classList.remove('hidden')
                latestFileElement.classList.add('not-hidden')
            }
        } else if (panel) {
            panel.classList.remove('hidden')
            panel.classList.add('not-hidden')
        }


        // make sure not file list stays open, whatever exists other than a file list
        if (notFilelist) {
            if (latestPanelId !== notFilelist) {
                previousPanelId = notFilelist
            }
            document.getElementById(notFilelist)?.classList.remove('hidden')
            document.getElementById(notFilelist)?.classList.add('not-hidden')
        }

        if (changedClass) {
            updateBodyPanelIds()
        }

    }

    if (panelId !== 'collapse') {
        document.querySelector(`#tabs [href="#${panelDocumentId}"]`)?.classList.add('active')
    }



    // finally do reactive stuff

    resizeDebouncer()

    // react repo and owner controls to selected filelist
    if (panel) {
        let newRepo = panel.dataset['repository']
        if (panelId === 'filelist')
            newRepo = SettingsManager.get('core', 'engineRepository')
        if (panelId === 'gamelist')
            newRepo = SettingsManager.get('core', 'gameRepository')
        if (panelId === 'assetlist')
            newRepo = SettingsManager.get('core', 'assetRepository')

        if (newRepo)
            setRepository(newRepo || database)
    }


    if (panelId === 'audio-editor') {
        await DependencyLoader.loadModule('audio');
    }

    if (panelId === 'nunu') {
        await DependencyLoader.loadModule('nunu');
    }

    if (panelId === 'editor') {
        await DependencyLoader.loadModule('editor');
    }

    if (panelId === 'paint' || panelId === 'terminal' || panelId === 'compile') {
        await DependencyLoader.loadModule('paint');
    }

    if (panelId === 'terminal-container' || panelId === 'terminal' || panelId === 'compile') {
        // Dynamically guarantee terminal dependencies are present, then trigger its scan
        await DependencyLoader.loadModule('terminal');
    }

    // 5. Database presentation hook
    if (panelId === 'database' && typeof showDatabases === 'function') {
        showDatabases();
    }

    if (panelId === 'searchlist') {
        setTimeout(() => search.focus(), 200)
    } 

    // 6. Direct Canvas engine engine boot check
    if ((panelId === 'viewport-frame' || panelId === 'play') && !window.GL?.canvas) {
        // Read the user preference to decide if we pull down Toji's WebGL files or the native WASM engine
        const preferredRenderer = SettingsManager.get('quake3e', 'preferredRenderer');

        if (preferredRenderer !== 'quake3e') {
            await DependencyLoader.loadModule('toji');
        } else {
            await DependencyLoader.loadModule('quake3e');
        }
    }

    if (TERMINALS.includes(panelId)) {
        if (typeof renderTerminalsCommand === 'undefined') {
            await DependencyLoader.loadModule('terminal');
            setTimeout(() => renderTerminalsCommand(panelId, true), 400)
        } else {
            renderTerminalsCommand(panelId, true)
        }
    }
}




function hideOpenPanels(all = true) {
    let hadOpen = false;

    let buttons = document.getElementById('tabs').children[0].children

    for (let button of buttons) {
        //if(!button.)
        button.children[0].classList.remove('active')
    }

    for (let panel of panels) {


        if (!panel.classList.contains('hidden')) {
            if (FILELIST_IDS.includes(panel.id)) {
                hadOpen = true
            }
            if (!all && !hadOpen)
                continue
        }

        if (latestPanelId === panel) continue
        panel.classList.add('hidden')
        panel.classList.remove('not-hidden')
    }
    return hadOpen
}



function updateBodyPanelIds() {

    for (let cn of document.body.classList) {
        if (cn.startsWith('panel-')) {
            document.body.classList.remove(cn)
        }
    }


    for (let cn of document.body.classList) {
        if (cn.startsWith('previous-')) {
            document.body.classList.remove(cn)
        }
    }

    if (previousPanelId)
        document.body.classList.add('previous-' + (previousNotFilelistId || previousPanelId))
    if (latestPanelId)
        document.body.classList.add('panel-' + latestPanelId)

    updateEditorLineIds()

}






function updateEditorLineIds() {

    for (let cn of document.body.classList) {
        if (cn.startsWith('line-')) {
            document.body.classList.remove(cn)
        }
    }

    for (let cn of document.body.classList) {
        if (cn.startsWith('error-')
            || cn.startsWith('warning-')
        ) {
            document.body.classList.remove(cn)
        }
    }


    for (let cn of document.body.classList) {
        if (cn.startsWith('hash-')) {
            document.body.classList.remove(cn)
        }
    }


    if (window.aceEditor) {
        let currentLine = window.aceEditor.getCursorPosition()
        document.body.classList.add('line-' + (currentLine.row + 1))
        document.body.classList.add('hash-' + window.previousHashLineNumber || 0)
        if (currentLine.row + 1 === window.previousHashLineNumber)
            document.body.classList.add('line-match')
        const session = window.aceEditor.getSession()
        if (session.getAnnotations) {
            var matches = session.getAnnotations().filter(function (ann) {
                return ann.row === currentLine.row
                //&& ann.type === 'error';
            })
            if (matches.length > 0) {
                document.body.classList.add(matches[0].type + '-' + currentLine.row)
            }
        }
    }


}





let hashDebounce = null
async function renderHashCommand(fileName, noBounce = false) {


    if (hashDebounce) {
        clearTimeout(hashDebounce)
    }
    if (!noBounce) {
        hashDebounce = setTimeout(() => renderHashCommand(fileName, true), 100)
        return
    }

    if (document.getElementById('toolbar')
        .querySelector(`[href="#${fileName}"]`)) {
        renderToolbarCommand(fileName)
        return
    }
    // ALREADY CALLED BY renderToolbarCommand
    else if (document.getElementById('tabs')
        .querySelector(`[href="#${fileName}"]`)) {
        renderTabsCommand(fileName || 'filelist')
        return
    }

    if (document.getElementById('terminals')
        .querySelector(`[href="#${fileName}"]`)) {
        // give UX time to adjust to class change
        setTimeout(() => {
            //if (window.renderTerminalsCommand)
            renderTabsCommand(fileName)
        }, 200)
        return
    }

    const [filePath, selected, dbFile, lineNumber] = await findFileTestPath(fileName)

    window.previousHashLineNumber = lineNumber

    if (selected && !filePath)
        navigateFile(selected, lineNumber, true, false, false)
    else if (filePath)
        navigateFile(filePath, lineNumber, true, false, false)

}


