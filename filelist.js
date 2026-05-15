
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


    engineRepo = localStorage.getItem('engine_repository');

    let parts = engineRepo?.split('/') || document.getElementById('filelist').dataset['repository']?.split('/')

    if (parts) {
        let newRepo = parts.length == 2 ? parts[1] : parts[0] || repo.value
        let newOwner = parts.length == 2 ? parts[0] : owner.value
        let branches = await getBranches(newOwner, newRepo)
        engineRepo = newOwner + '/' + newRepo
        updateSelectOptions('branch', branches)
        if (newOwner && newRepo)
            await loadFileTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')
    }

    gameRepo = localStorage.getItem('game_repository');

    let parts2 = gameRepo?.split('/') || document.getElementById('gamelist').dataset['repository']?.split('/')
    if (parts2) {

        let newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repo.value
        let newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
        let branches2 = await getBranches(newOwner2, newRepo2)
        gameRepo = newOwner2 + '/' + newRepo2

        if (newOwner2 && newRepo2)
            await loadFileTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')
    }


    assetRepo = localStorage.getItem('asset_repository');

    let parts3 = assetRepo?.split('/') || document.getElementById('assetlist').dataset['repository']?.split('/')

    if (parts3) {

        let newRepo3 = parts3.length == 2 ? parts3[1] : parts3[0] || repo.value
        let newOwner3 = parts3.length == 2 ? parts3[0] : owner.value
        let branches3 = await getBranches(newOwner3, newRepo3)
        assetRepo = newOwner3 + '/' + newRepo3

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

const TAR_PREAMBLE = '\x1b[38;5;202m[TAR]\x1b[0m '

async function untarFrontent() {

    PREAMBLE = TAR_PREAMBLE
    const response = await fetch('/sysroot.tar', {
        mode: 'cors',
        credentials: 'omit',
    });
    const tar = new API.Tar(await response.arrayBuffer(), log);
    const count = await tar.untar(this.memfs);
    log(`${count} files read.`);
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
            await untarFrontent()
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
                FS.virtual[r.path] = r
            }
            let result2 = await queryIndex(DB_STORE_NAME, 'parent', baseDir + '/', null, null, database)
            for (let r of result2) {
                FS.virtual[r.path] = r
            }

            resultSet = result.concat(result2).reduce((a, r) => {
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
            const isDir = node.mode === FS_DIR; // Use your constant or (node.mode >> 12) == ST_DIR
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

    renderHashCommand(window.location.hash.substring(1))

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


async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true, hidePanels = true) {
    api.github_token = localStorage.getItem('github_token');

    let content = await cacheFile(repoOwner, repoName, filePath, sha)
    const decoder = new TextDecoder();
    const str = decoder.decode(content);

    // 2. Ace Session
    const session = getOrCreateAceSession(filePath, str);
    const mode = getModeByFilename(filePath);
    session.setMode(mode);
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();
    if (hidePanels)
        hideOpenPanels()
    document.getElementById('editor').classList.add('not-hidden')

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
}


let hashDebounce = null
function renderHashCommand(fileName, noBounce = false) {

    if (hashDebounce) {
        clearTimeout(hashDebounce)
    }
    if (!noBounce) {
        hashDebounce = setTimeout(() => renderHashCommand(fileName, true), 500)
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

    if (document.getElementById('tabs')
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
            if(nodeDB = parent.getAttribute('data-id'))
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


function renderTabsCommand(panelId) {

    if (!panelId) return
    //    panelId = 'filelist'

    let database = owner.value + '/' + repo.value

    if (panelId == 'collapse') {
        let hasOpen = hideOpenPanels()
        if (!hasOpen)
            document.getElementById('filelist').classList.remove('hidden')
    }
    else if (panelId) {

        hideOpenPanels()

        document.querySelector(`#tabs [href="#${panelId}"]`)?.classList.add('active')

        let panel = document.getElementById(panelId)
        if (panel) {
            panel.classList.remove('hidden')
            panel.classList.add('not-hidden')

            let newRepo = panel.dataset['repository']
            if (panelId == 'filelist')
                newRepo = localStorage.getItem('engine_repository') || newRepo
            if (panelId == 'gamelist')
                newRepo = localStorage.getItem('game_repository') || newRepo
            if (panelId == 'assetlist')
                newRepo = localStorage.getItem('asset_repository') || newRepo

            if (newRepo)
                setRepository(newRepo || database)
        }


        if (panelId == 'database')
            showDatabases()

        if (panelId == 'viewport-frame'
            && !GL.canvas
        ) run()
    }


}




let panels = document.querySelectorAll('#filesearch, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});


function hideOpenPanels() {
    let hasOpen = false;

    let buttons = document.getElementById('tabs').children[0].children

    document.getElementById('viewport-frame').classList.remove('not-hidden')
    document.getElementById('editor').classList.remove('not-hidden')
    document.getElementById('terminal-container').classList.remove('not-hidden')

    modal.classList.add('hidden')

    for (let button of buttons) {
        button.children[0].classList.remove('active')
    }

    for (let panel of panels) {
        if (!panel.classList.contains('hidden')) {
            panel.classList.add('hidden')
            panel.classList.remove('not-hidden')
            hasOpen = true
        }
    }
    return hasOpen
}


