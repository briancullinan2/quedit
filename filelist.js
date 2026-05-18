
const convertFlatToNested = (data) => {
    return data.reduce((acc, item) => {
        const parts = item.path.split('/');
        let currentLevel = acc;

        parts.forEach((part, i) => {
            let existingPath = currentLevel.find(node => node.text === part);

            if (!existingPath) {
                existingPath = {
                    id: `${item.sha}`,
                    text: part,
                    state: {
                        open: false,
                        expanded: false
                    },
                    path: item.path,
                    sha: item.sha
                };
                if (i < parts.length - 1 || item.type === 'tree') {
                    existingPath.children = [];
                }
                currentLevel.push(existingPath);
            }
            if (!existingPath.children)
                return
            currentLevel = existingPath.children;
        });

        return sortNodes(acc);
    }, []);
};


const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
        const aHasChildren = Array.isArray(a.children);
        const bHasChildren = Array.isArray(b.children);

        // 1. Sort by "Folder-ness" (true/false)
        if (aHasChildren && !bHasChildren) return -1;
        if (!aHasChildren && bHasChildren) return 1;

        // 2. Then sort alphabetically by text
        return a.text.localeCompare(b.text);
    });

    // 3. Recurse into children
    nodes.forEach(node => {
        if (node.children) sortNodes(node.children);
    });

    return nodes;
};


const loadedDatabases = {}
let engineRepo = 'briancullinan2/Quake3e'
let gameRepo = 'ec-/baseq3a'
let assetRepo = null
let toolsRepo = 'briancullinan2/q3lcc'
let toolsRepo2 = 'ec-/q3asm'

async function initializeFiletrees() {
    if (window.location.pathname) {
        await setRepository(window.location.pathname.trim().replace(/\/$|^\//, ''))
    }


    engineRepo = localStorage.getItem('engine_repository') || engineRepo;

    let parts = engineRepo?.split('/') || document.getElementById('filelist').dataset['repository']?.split('/')

    if (parts) {
        let newRepo = parts.length == 2 ? parts[1] : parts[0] || repo.value
        let newOwner = parts.length == 2 ? parts[0] : owner.value
        let branches = await getBranches(newOwner, newRepo)
        updateSelectOptions('branch', branches)
        if (newOwner && newRepo)
            await loadFileTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')
    }

    gameRepo = localStorage.getItem('game_repository') || gameRepo;

    let parts2 = gameRepo?.split('/') || document.getElementById('gamelist').dataset['repository']?.split('/')
    if (parts2) {

        let newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repo.value
        let newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
        let branches2 = await getBranches(newOwner2, newRepo2)

        if (newOwner2 && newRepo2)
            await loadFileTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')
    }


    assetRepo = localStorage.getItem('asset_repository') || assetRepo;

    let parts3 = assetRepo?.split('/') || document.getElementById('assetlist').dataset['repository']?.split('/')

    if (parts3) {

        let newRepo3 = parts3.length == 2 ? parts3[1] : parts3[0] || repo.value
        let newOwner3 = parts3.length == 2 ? parts3[0] : owner.value
        let branches3 = await getBranches(newOwner3, newRepo3)

        if (newOwner3 && newRepo3)
            await loadFileTree(newOwner3, newRepo3, branches3[0]?.name || 'main', '#assetlist')

    }

    await showDatabases()

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const folderId = target.getAttribute('data-id');

                // Check if the node just became expanded
                if (target.classList.contains('treejs-node__open')) {
                    expandDatabaseTree(target, folderId)
                }
            }
        });
    });



    // Observe the tree container for any class changes on nodes
    observer.observe(document.querySelector('#database'), {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
}

let hasUntared = false

async function untarFrontent() {

    PREAMBLE = TAR_PREAMBLE
    const response = await fetch('/sysroot.tar', {
        mode: 'cors',
        credentials: 'omit',
    });
    const tar = new API.Tar(await response.arrayBuffer(), log);
    const count = await tar.untar(this.memfs);
    writeLog(`${count} files read.`);
    hasUntared = true

}


let treeLoading = false
let refreshTree = null

async function expandDatabaseTree(target, folderId) {
    const parts = folderId.split('/')
    const database = folderId.startsWith('Virtual Memory') ? 'Virtual Memory' : (parts[0] + '/' + parts[1])
    const baseDir = parts.slice(2).join('/')
    const dirPath = baseDir.substring(0, baseDir.lastIndexOf('/'));
    const parentDir = database + (dirPath.trim().length > 0 ? ('/' + dirPath) : '')

    if (!target.classList.contains('treejs-node__open')) return
    if (!trees['#database'].nodesById[folderId]) return
    // if (loadedDatabases[folderId]) return


    try {

        // prevent mutation from triggering again when tree loads
        if (treeLoading) return
        treeLoading = true


        if (!hasUntared) {
            //await untarFrontent()
        }

        if (!files[database]) {
            let parts = database.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }

        let resultSet = {}
        let resultKeys = []
        if (database === 'Virtual Memory') {
            resultSet = FS.virtual
            resultKeys = Object.keys(FS.virtual)
        }
        else {

            let result = await queryIndex(DB_STORE_NAME, 'parent', baseDir, null, null, database)
            for (let r of result) {
                files[database][r.path] = FS.virtual[r.path] = r
            }
            let result2 = await queryIndex(DB_STORE_NAME, 'parent', baseDir + '/', null, null, database)
            for (let r of result2) {
                files[database][r.path] = FS.virtual[r.path] = r
            }

            resultSet = Object.values(files[database])
                .reduce((a, r) => {
                    a[r.path] = r
                    return a
                }, {})
            resultKeys = Object.keys(resultSet)
        }


        const childrenKeys = resultKeys.filter(path => {
            // Must start with the folder path
            let firstMatch = baseDir === '/' || baseDir === '' || path.startsWith(baseDir + '/')
            if (!firstMatch) return false;

            // Get the portion after the folder name
            const relativePath = path.substring(baseDir.length + 1);

            // It's an immediate child if there are no more slashes 
            // (or it's a directory ending in a single slash)
            const slashIndex = relativePath.indexOf('/');
            return slashIndex === -1 || slashIndex === relativePath.length - 1;
        });


        const newChildren = childrenKeys.map(path => {
            const node = resultSet[path];
            const isDir = node.mode === FS_DIR; // Use your constant or (node.mode >> 12) === ST_DIR
            const name = path.split('/').pop() || path;

            let newNode = {
                id: database + (path.length === 0 || path[0] === '/' ? '' : '/') + path,
                text: name,
                path: path,
                parent: trees['#database'].nodesById[folderId],
                state: { open: false, expanded: false },
                // If it's a directory, give it a dummy child so it's expandable
                children: isDir ? [{ text: 'Loading...', id: `${path}/loading` }] : null
            };

            loadedDatabases[newNode.id] = trees['#database'].nodesById[newNode.id] = newNode

            let searchParent = loadedDatabases[parentDir].children
            let parentIndex = searchParent.findIndex(n => n.id === newNode.id)
            if (parentIndex > -1)
                searchParent[parentIndex] = newNode


            return newNode
        });

        if (newChildren.length === 0)
            newChildren.push({ text: 'Empty...', id: `${folderId}/empty` })

        sortNodes(newChildren)

        loadedDatabases[folderId].children = trees['#database'].nodesById[folderId].children = newChildren

    } catch (err) {
        console.error("Failed to load tree node: " + err.message + '\n\r' + (err.stack || err.stacktrace));
        loadedDatabases[folderId] = [{ text: 'Error loading files', id: 'err' }];
    }


    // ASYNC!
    showDatabases(folderId)


    if (refreshTree)
        clearTimeout(refreshTree)
    refreshTree = setTimeout(async () => {
        // give tree time to load and render
        trees['#database'].values = [] // [folderId]
        const node = trees['#database'].nodesById[folderId];

        if (node) {
            trees['#database'].open(node);
        }
        setTimeout(() => {
            // give expand time to animate without mutation
            treeLoading = false
        }, 300)
    }, 200)
}




document.addEventListener('DOMContentLoaded', async (event) => {

    await initializeFiletrees();
    forceFit();
    updateMaxLines()

    renderHashCommand(window.location.hash.substring(1), true)

    resizeDebouncer()

    // do way after terminal loads
    setTimeout(() => {
        performSharedBufferScanInternal()
    }, 1000);

    setTimeout(() => {
        term.write(loadedLog.map(l => l.text || l).join(''))
        if (loadedLog.length > 0)
            writePrompt()
        // Initial prompt
        terminalLoaded = true
    }, 200);
});





async function showDatabases(folderId) {
    let databases = await getDatabaseMetadata()


    const topDatabases = []
    for (let d of databases) {

        if (!loadedDatabases[d.key]) {
            loadedDatabases[d.key] = {
                id: `${d.key}`,
                text: d.key,
                state: {
                    open: false,
                    expanded: false
                },
                path: d.key,
                children: [{
                    id: `${d.key}/loading`,
                    text: 'Loading...',
                    state: {
                        open: false,
                        expanded: false
                    },
                    path: d.key + '/' + 'loading',
                }]
            }
        }

        topDatabases.push(loadedDatabases[d.key])
    }


    if (!loadedDatabases[`Virtual Memory`]) {
        loadedDatabases[`Virtual Memory`] = {
            id: `Virtual Memory`,
            text: `Virtual Memory`,
            state: {
                open: false,
                expanded: false
            },
            path: `Virtual Memory`,
            children: [{
                id: `Virtual Memory/loading`,
                text: 'Loading...',
                state: {
                    open: false,
                    expanded: false
                },
                path: `Virtual Memory/loading`,
            }]
        }
    }

    topDatabases.push(loadedDatabases['Virtual Memory'])


    if (!trees['#database']) {

        trees['#database'] = new Tree('#database', {

            data: topDatabases,
            autoOpen: false,
            closeDepth: null,
        });
    } else if (folderId) {
        trees['#database'].options.data = topDatabases
        trees['#database'].renderPartial(folderId)
    } else {
        //trees['#database'].options.data = topDatabases
        //trees['#database'].render(trees['#database'].options.data)
    }
}



function loadTree(database, cursor) {
    if (!cursor) {
        return resolve()
    }
    // already exists on filesystem, 
    //   it must have come with page
    if (files[database][cursor.path]
        && files[database][cursor.path].timestamp
        > cursor.timestamp) {
        // embedded file is newer, start with that
        return
    }

    files[database][cursor.path] = {
        timestamp: cursor.timestamp,
        mode: cursor.mode,
        contents: cursor.contents,
        path: cursor.path,
        sha: cursor.sha,
        parent: cursor.parent,
    }
}




function getQVMHeader(sampleBytes, content, filePath) {



    // 1. Read QVM Header Magic Number (0x12721444 or 'qvm\x12')
    // Standard QVM headers start with Magic (4 bytes), Instruction Count (4 bytes), 
    // Code Offset/Length (4), Data Offset/Length (4), Lit Offset/Length (4), BSS Length (4)
    const isQVM = sampleBytes[0] === 0x44 && sampleBytes[1] === 0x14 && sampleBytes[2] === 0x72 && sampleBytes[3] === 0x12;

    let infoStack = `QVM file detected (${content.length} bytes)\n`;
    infoStack += `========================================================================\n`;

    if (isQVM && sampleBytes.length >= 24) {
        // Parse 32-bit Little Endian integers from the QVM header metadata
        const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
        const instructionCount = view.getUint32(4, true);
        const codeLength = view.getUint32(8, true);
        const dataLength = view.getUint32(12, true);
        const litLength = view.getUint32(16, true);
        const bssLength = view.getUint32(20, true);

        // Render the compilation metadata block
        infoStack += `Output filename:      ${filePath}\n`;
        infoStack += `Compiler Sequence:    pass #1: define -> pass #2: compile -> pass #3: define -> pass #4: compile\n`;
        infoStack += `------------------------------------------------------------------------\n`;
        infoStack += `Code Segment size:    ${codeLength.toString().padEnd(10)} bytes\n`;
        infoStack += `Data Segment size:    ${dataLength.toString().padEnd(10)} bytes\n`;
        infoStack += `Lit Segment size:     ${litLength.toString().padEnd(10)} bytes\n`;
        infoStack += `BSS Segment size:     ${bssLength.toString().padEnd(10)} bytes (Uninitialized Data)\n`;
        infoStack += `Instruction Count:    ${instructionCount.toString().padEnd(10)}\n`;
        infoStack += `------------------------------------------------------------------------\n`;
        infoStack += `Status:               Successfully mapped binary targets.\n`;
    } else {
        infoStack += `Format:               Unknown Raw Binary Data\n`;
    }

    //const hexRows = hexDump(sampleBytes, content, filePath)

    return infoStack
}



function hexDump(sampleBytes, content, filePath) {
    let infoStack

    if (filePath.includes('.qvm')) {
        infoStack = getQVMHeader(sampleBytes, content, filePath)
    } else {
        infoStack = `Binary file detected (${content.length} bytes)\n`;
    }

    infoStack += `========================================================================\n\n`;
    infoStack += `Raw Header Hex View (First ${sampleBytes.length} bytes):\n`;
    infoStack += `------------------------------------------------------------------------\n`;

    let hexRows = [];
    for (let i = 0; i < sampleBytes.length; i += 16) {
        let chunk = [];
        for (let j = 0; j < 16; j++) {
            if (i + j < sampleBytes.length) {
                let byteHex = sampleBytes[i + j].toString(16).padStart(2, '0').toUpperCase();
                chunk.push(byteHex);
            }
        }

        // Add visual split column delimiter at byte index 8
        if (chunk.length > 8) {
            chunk.splice(8, 0, "|");
        }

        // Pad out short rows at the end of the data chunk sample
        let hexLine = chunk.join(" ");
        let offset = i.toString(16).padStart(4, '0').toUpperCase();
        hexRows.push(`0x${offset}:  ${hexLine}`);
    }

    let str = infoStack + hexRows.join("\n");

    return str
}





const hasSequentialBinaryRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]{3,}/;

let openFileDebounce = null
let latestOpenRequest = null
async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true, hidePanels = true, noBounce = false) {

    latestOpenRequest = () => openFile(repoOwner, repoName, filePath, sha, recordHistory, hidePanels, true)
    if (!noBounce && openFileDebounce) return
    if (!noBounce) {
        openFileDebounce = setTimeout(() => {
            latestOpenRequest()
            openFileDebounce = null
        }, 400);
        return
    }

    api.github_token = localStorage.getItem('github_token');

    let content = await cacheFile(repoOwner, repoName, filePath, sha, true);
    if (!content || content.length === 0) {
        let response = await fetch(filePath)
        content = await response.arrayBuffer()
    }
    const byteView = new Uint8Array(content);
    // 1. Scan just the first 1024 bytes for binary characters before decoding everything
    const sampleBytes = byteView.subarray(0, 1024);
    const decoder = new TextDecoder();
    const sampleStr = decoder.decode(sampleBytes);

    let str
    if (hasSequentialBinaryRegex.test(sampleStr)) {
        str = hexDump(sampleBytes, content, filePath)
    } else {
        // Standard plain text file path
        str = decoder.decode(content);
    }



    // 2. Ace Session
    const session = getOrCreateAceSession(filePath, str);
    const mode = getModeByFilename(filePath);
    session.setMode(mode);
    editor.setSession(session);


    if (hidePanels)
        hideOpenPanels()

    resizeDebouncer()

    editorContainer.classList.remove('hidden')
    editorContainer.classList.add('not-hidden')

    // 3. Record it in history if this isn't a "Back/Forward" action
    let selector = document.getElementById('filename')
    if (recordHistory) {
        let placeholder = selector.children[0]
        if (placeholder.value == '')
            placeholder.remove()
        if (!selector.querySelector(`[value="${filePath}"]`)) {
            const option = document.createElement('option');

            option.value = filePath;
            option.textContent = filePath;

            //if (filePath === selector.value) {
            option.selected = true;
            //}

            if (selector.children.length > 0)
                selector.insertBefore(option, selector.children[0]);
            else
                selector.appendChild(option);
        }
        const pos = editor.getCursorPosition();
        NavHistory.push(sha, pos.row, pos.column);
        history.pushState({ location: window.location.toString() }, filePath, '#' + filePath)
    }
    else {
        selector.value == filePath
    }
    selector.parentElement.setAttribute('placeholder', 'Current file: ' + filePath)
}


let hashDebounce = null
function renderHashCommand(fileName, noBounce = false) {

    if (hashDebounce) {
        clearTimeout(hashDebounce)
    }
    if (!noBounce) {
        hashDebounce = setTimeout(() => renderHashCommand(fileName, true), 100)
        return
    }

    let database = owner.value + '/' + repo.value
    if (files[database]) {
        const filePath = files[database][fileName]?.path
        if (filePath) {
            const fileId = files[database][fileName].sha
            currentOpenFileId = fileId;
            trees[database].values = [fileId];
            openFile(owner.value, repo.value, filePath, fileId, false);
        }
    }

    if (document.getElementById('toolbar')
        .querySelector(`[href="#${fileName}"]`)) {
        renderToolbarCommand(fileName)
    }
    // ALREADY CALLED BY renderToolbarCommand
    else if (document.getElementById('tabs')
        .querySelector(`[href="#${fileName}"]`)) {
        renderTabsCommand(fileName || 'filelist')
    }

    if (document.getElementById('terminals')
        .querySelector(`[href="#${fileName}"]`)) {
        renderTerminalsCommand(fileName)
    }
}


window.addEventListener('popstate', (event) => {
    renderHashCommand(window.location.hash.substring(1))
});



function treeHandler(selector, e) {
    const node = e.target.closest('.treejs-node');
    if (node && node.classList.contains('treejs-placeholder')) {
        const fileId = node.getAttribute('data-id'); // Assuming you set this
        const filePath = trees[selector].nodesById[fileId].path
        currentOpenFileId = fileId;
        trees[selector].values = [fileId];
        let selected = owner.value + '/' + repo.value
        let nodeDB
        if (nodeDB = node.getAttribute('data-database')) {
            selected = nodeDB
        }
        if (node.closest('#filelist')) {
            selected = engineRepo
        }
        if (node.closest('#gamelist')) {
            selected = gameRepo
        }
        if (node.closest('#assetRepo')) {
            selected = assetRepo
        }
        if (node.closest('#database')) {
            let parent = node.closest('#database > div > ul > li[data-id]')
            if (nodeDB = parent.getAttribute('data-id'))
                selected = nodeDB

        }

        const parts = selected.split('/')
        const newRepo = parts.length == 2 ? parts[1] : parts[0] || repo.value
        const newOwner = parts.length == 2 ? parts[0] : owner.value

        openFile(newOwner, newRepo, filePath, trees[selector].nodesById[fileId].sha);
    }
}

document.getElementById('filelist').addEventListener('click', treeHandler.bind(null, '#filelist'));
document.getElementById('gamelist').addEventListener('click', treeHandler.bind(null, '#gamelist'));
document.getElementById('assetlist').addEventListener('click', treeHandler.bind(null, '#assetlist'));
document.getElementById('database').addEventListener('click', treeHandler.bind(null, '#database'));



function getDocumentPanelFromClickId(panelId) {

    let panelDocumentId = panelId
    if (panelId === 'play' || panelId === 'run' || panelId === 'reload'
        || panelId === 'spawn' || panelId === 'map'
    )
        panelDocumentId = 'viewport-frame'
    if (panelId === 'compile' || panelId === 'build')
        panelDocumentId = 'terminal'
    if (panelId === 'new' || panelId === 'filename' || panelId === 'settings')
        panelDocumentId = 'editor'


    // write the panel id as if they clicked directly on the folder list
    if (panelId === 'owner' || panelId === 'branch'
        || panelId === 'repository'
    ) {
        // TODO: the opposite of below, match selected repos up with 
        //  their possible already set file tree
        if (engineRepo === owner.value + '/' + repo.value)
            panelId = 'filelist'
        if (gameRepo === owner.value + '/' + repo.value)
            panelId = 'gamelist'
        if (assetRepo === owner.value + '/' + repo.value)
            panelId = 'assetlist'
        if (toolsRepo === owner.value + '/' + repo.value
            || toolsRepo2 === owner.value + '/' + repo.value
        )
            panelId = panelDocumentId = 'database'
    }

    return [panelId, panelDocumentId]
}


const DOESNT_AFFECT_UI = [
    'github', 'back', 'next', 'fullscreen',
    'layout', 'share', 'pause', 'stop', 'save',
    'configuration', 'theme', 'configuration',
    'wasi', 'theme', 'keybinding', 'collapse' // detected above
]

let toolbarTabDebounce = null
let latestPanelId = null
let previousPanelId = null
let debouncedPanelId = null
let previousFilelistId = null
function renderTabsCommand(panelId, noBounce = false, hidePanels = true) {

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

    let database = owner.value + '/' + repo.value

    const [reasignedPanelId, panelDocumentId] = getDocumentPanelFromClickId(panelId)
    const panel = document.getElementById(panelDocumentId)

    // react repo and owner controls to selected filelist
    if (panel) {
        let newRepo = panel.dataset['repository']
        if (panelId === 'filelist')
            newRepo = engineRepo || localStorage.getItem('engine_repository') || newRepo
        if (panelId === 'gamelist')
            newRepo = gameRepo || localStorage.getItem('game_repository') || newRepo
        if (panelId === 'assetlist')
            newRepo = assetRepo || localStorage.getItem('asset_repository') || newRepo

        if (newRepo)
            setRepository(newRepo || database)
    }

    if (panelId == 'database')
        showDatabases()

    if (panelId === 'viewport-frame'
        && !GL.canvas
    ) run()

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

    if (!DOESNT_AFFECT_UI.includes(panelId)) {
        let hadOpen = false
        if (hidePanels) {
            hadOpen = hideOpenPanels(FILELIST_IDS.includes(panelId) /* hide all if we are switching files lists */)
        }

        if (panel) {
            panel.classList.remove('hidden')
            panel.classList.add('not-hidden')
        }

        if (changedClass) {
            updateBodyPanelIds()
        }

        let previousNone = true
        let latestNone = true
        let notFilelist = null
        for (let filelistId of FILELIST_IDS) {
            if (previousPanelId === filelistId) {
                previousFilelistId = filelistId
                previousNone = false
            } else if (latestPanelId === filelistId) {
                previousFilelistId = filelistId
                latestNone = false
            }
        }

        // defect from over compensating for class names not changing latestPanelId above created a defect here
        if (latestNone) {
            notFilelist = latestPanelId
        }
        else if (previousNone) {
            notFilelist = previousPanelId
        }


        if (panelId === 'collapse') {

            if (!hadOpen) {
                document.getElementById(previousFilelistId)?.classList.remove('hidden')
                document.getElementById(previousFilelistId)?.classList.add('not-hidden')
            }

        }

        // make sure not file list stays open
        
        if (notFilelist) {

            document.getElementById(notFilelist)?.classList.remove('hidden')
            document.getElementById(notFilelist)?.classList.add('not-hidden')
        }

    }

    if (panelId !== 'collapse') {
        document.querySelector(`#tabs [href="#${panelDocumentId}"]`)?.classList.add('active')
    }

    resizeDebouncer()
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
        document.body.classList.add('previous-' + previousPanelId)
    if (latestPanelId)
        document.body.classList.add('panel-' + latestPanelId)


}


const FILELIST_IDS = ['filesearch', 'filelist', 'gamelist', 'assetlist', 'database']

let panels = document.querySelectorAll('#token-modal, #viewport-frame, #terminal-container, #editor, #filesearch, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});



function hideOpenPanels(all = true) {
    let hasOpen = false;

    let buttons = document.getElementById('tabs').children[0].children

    for (let button of buttons) {
        //if(!button.)
        button.children[0].classList.remove('active')
    }

    for (let panel of panels) {
        if (latestPanelId === panel) continue
        if (FILELIST_IDS.includes(panel.id)) {
            hasOpen = true
            if(!all) continue
        }
        if (!panel.classList.contains('hidden')) {
            panel.classList.add('hidden')
        }
        panel.classList.remove('not-hidden')
    }
    return hasOpen
}


