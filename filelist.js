
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
                    status: 0,
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
                status: 0,
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

    resizeDebouncer()

    // do way after terminal loads
    setTimeout(() => {
        performSharedBufferScanInternal(searchTerminal.value)
        //window.GUI.render_main_gui()
        window.Layers.render();
    }, 1000);

    setTimeout(() => {
        if (window.AppConfig) {
            // 1. Force transparent grid background setting to true
            window.AppConfig.TRANSPARENCY = true

            // 2. Trigger a full canvas re-render to update the visual workspace layers
            //if (window.Layers && typeof window.Layers.render === 'function') {
            window.Layers.render();
            //}
            //window.GUI.render_main_gui()
        }

        setTerminalAceTheme()
        term.write(loadedLog.map(l => l.text || l).join(''))
        if (loadedLog.length > 0)
            writePrompt()
        // Initial prompt
        terminalLoaded = true

        renderHashCommand(window.location.hash.substring(1), true)

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
                status: 0,
                state: {
                    open: false,
                    expanded: false
                },
                path: d.key,
                children: [{
                    id: `${d.key}/loading`,
                    text: 'Loading...',
                    status: 0,
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
            status: 0,
            state: {
                open: false,
                expanded: false
            },
            path: `Virtual Memory`,
            children: [{
                id: `Virtual Memory/loading`,
                text: 'Loading...',
                status: 0,
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

async function openImage(content, filePath) {
    const filename = filePath.split('/').pop();
    const dataUri = arrayBufferToDataUri(content, filePath);

    // 1. We MUST decode the image dimensions asynchronously first.
    // miniPaint needs width/height for Autoresize_canvas_action.
    const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            console.error("Failed to decode image data URI boundaries.");
            resolve({ width: 800, height: 600 }); // Sanity fallback
        };
        img.src = dataUri;
    });



    // 3. Extract your custom EXIF parser hook if available
    if ((filename.includes('.jpg') || filename.includes('.jpeg')) && window.Layers?.extract_exif) {
        try {
            const fakeFileObj = {
                name: filename,
                size: content.byteLength,
                type: 'image/jpeg',
                lastModified: Date.now()
            };
            layerSettings._exif = window.Layers.extract_exif(fakeFileObj)
        } catch (exifErr) {
            console.warn("EXIF extraction skipped:", exifErr);
        }
    }

    // 4. Verify state pipeline and build the formal Webpack constructor instances
    if (window.State && window.Actions) {
        try {

            var t = new Image;
            t.crossOrigin = "Anonymous"
            t.onload = function () {
                var e = {
                    name: "Data URL",
                    type: "image",
                    link: t,
                    width: t.width,
                    height: t.height,
                    width_original: t.width,
                    height_original: t.height
                };
                window.State.do_action(new window.Actions.Bundle_action("open_file_data_url", "Open File Data URL", [new window.Actions.Insert_layer_action(e), new window.Actions.Autoresize_canvas_action(t.width, t.height, null, !0, !0)])),
                    t.onload = function () {
                        //u.A.need_render = !0
                    }
            }
            t.onerror = function (e) {
                g().error("Sorry, image could not be loaded. Try copy image and paste it.")
            }
            t.src = dataUri

        } catch (err) {
            console.error("Failed executing miniPaint bundled actions:", err);
        }
    } else {
        console.error("miniPaint core engine references (window.State / window.Actions) are missing.");
    }
}

// Helper to keep the metadata block pristine
function getMimeTypeByExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    return map[ext] || 'image/png';
}


const imageEditor = document.getElementById('paint')


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
        try {
            let response = await fetch(filePath)
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    if (!content || content.length === 0) {
        try {
            let response = await fetch('https://quake.games/' + filePath)
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    if (!content || content.length === 0) {
        try {
            let response = await fetch('https://quake.games/' + filePath.replace('docs/', ''))
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    const byteView = new Uint8Array(content);
    // 1. Scan just the first 1024 bytes for binary characters before decoding everything
    const sampleBytes = byteView.subarray(0, 8192);
    const decoder = new TextDecoder();
    const sampleStr = decoder.decode(sampleBytes);

    let str
    const isImage = /\.(png|jpe?g|gif|webp)$/i.test(filePath);

    if (isImage) {
        setTimeout(() => {
            openImage(content, filePath)
        }, 500);

        // Optionally fall back to text hexDump or return early so Ace Editor doesn't choke
        str = "[Binary Image Layer Inserted]";
    } else if (hasSequentialBinaryRegex.test(sampleStr)) {
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
        hideOpenPanels(isImage)

    editorContainer.classList.remove('hidden')
    editorContainer.classList.add('not-hidden')

    if (isImage) {
        imageEditor.classList.remove('hidden')
        imageEditor.classList.add('not-hidden')
    }

    resizeDebouncer()

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
    if (!node) return

    const fileId = node.getAttribute('data-id'); // Assuming you set this
    //setTimeout(() => trees[selector].values = [fileId], 500)


    if (node && node.classList.contains('treejs-placeholder')) {
        const filePath = trees[selector].nodesById[fileId].path
        currentOpenFileId = fileId;
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
    'configuration', 'theme', 'repository',
    'wasi', 'theme', 'keybinding', 'reload',
    'branch', 'owner'
]

let toolbarTabDebounce = null
let latestPanelId = null
let previousPanelId = null
let debouncedPanelId = null
let previousFilelistId = null
let notFilelist = null

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

    if (panelId === 'terminal-container'
        || panelId === 'terminal'
        || panelId === 'compile'
    ) {
        setTimeout(() => {
            performSharedBufferScanInternal(searchTerminal.value)
        }, 1000);
    }

    if (panelId === 'database')
        showDatabases()

    if (panelId === 'viewport-frame'
        && !GL.canvas
    ) runTojiEngine()

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
            hadOpen = hideOpenPanels(FILELIST_IDS.includes(panelId) /* hide all if we are switching files lists */)
        }

        if (panel) {
            panel.classList.remove('hidden')
            panel.classList.add('not-hidden')
        }

        let previousNone = true
        let latestNone = true
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


        if (panelId === 'collapse'
            // nice side effect if they click the same list it also toggles
            || (panelId === previousFilelistId) // && !changedClass)
        ) {

            if (!hadOpen) {
                document.getElementById(previousFilelistId)?.classList.remove('hidden')
                document.getElementById(previousFilelistId)?.classList.add('not-hidden')
            } else {
                document.getElementById(previousFilelistId)?.classList.add('hidden')
                document.getElementById(previousFilelistId)?.classList.remove('not-hidden')
            }

        }

        // make sure not file list stays open, whatever exists other than a file list
        if (notFilelist) {
            if (latestPanelId !== notFilelist)
                previousPanelId = notFilelist
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

let panels = document.querySelectorAll('#paint, #token-modal, #viewport-frame, #terminal-container, #editor, #filesearch, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});



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


function hookMiniPaintIntercept() {
    const iframe = document.getElementById('myFrame');
    if (!iframe) return;

    const miniPaintWin = iframe.contentWindow;

    // Ensure miniPaint's module instances have finished setup on window load
    if (!miniPaintWin || !miniPaintWin.FileOpen) {
        setTimeout(hookMiniPaintIntercept, 100); // Poll briefly if not ready
        return;
    }

    // 1. Capture miniPaint's original file processor reference
    const originalLoadFileHandler = miniPaintWin.FileOpen.load_file_handler;

    console.log("Successfully intercepted miniPaint's FileOpen handler.");

    // 2. Overwrite the native method with your custom pipeline proxy
    miniPaintWin.FileOpen.load_file_handler = function (event) {
        // Handle variations of incoming events (File drop arrays vs native input changes)
        const files = event.target?.files || event.dataTransfer?.files;

        if (files && files.length > 0) {
            const file = files[0];
            const filename = file.name.toLowerCase();

            // Check A: Quick extension filter matching Quake 3 assets
            const isQuakeAsset = filename.endsWith('.bsp') ||
                filename.endsWith('.aas') ||
                filename.endsWith('.qvm') ||
                filename.endsWith('.md3') ||
                filename.endsWith('.dat');

            if (isQuakeAsset) {
                console.log(`Intercepted Quake 3 asset by extension: ${file.name}. Routing to custom engine...`);
                routeFileToQuakeEditor(file);
                return; // Stop execution here. miniPaint never touches it!
            }

            // Check B: Heavy verification via byte magic patterns (For files missing extensions)
            const reader = new FileReader();
            reader.onload = function (e) {
                const bytes = new Uint8Array(e.target.result);

                // Leverage your existing BINARY_DETECTOR block patterns
                if (isQuakeBinaryMagic(bytes)) {
                    console.log(`Intercepted Quake 3 asset by binary magic signature. Routing to custom engine...`);
                    routeFileToQuakeEditor(file);
                } else {
                    // It's a normal image! Hand it back down to miniPaint's native engine flow
                    originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
                }
            };

            // Read just the first 16 bytes for checking headers
            reader.readAsArrayBuffer(file.slice(0, 16));

        } else {
            // Fallback for empty/unrecognized input event routing loops
            originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
        }
    };
}

// Quick helper to evaluate header buffers using your existing magics
function isQuakeBinaryMagic(bytes) {
    const magicStr = Array.from(bytes.subarray(0, 4)).map(b => String.fromCharCode(b)).join('');
    // "IBSP" = Map, "IDP3" = Mesh, "EAAS" = Bot AI navigation
    return ['IBSP', 'IDP3', 'EAAS'].includes(magicStr) ||
        (bytes[0] === 0x44 && bytes[1] === 0x14 && bytes[2] === 0x72 && bytes[3] === 0x12); // QVM
}

