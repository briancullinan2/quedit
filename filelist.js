
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
            if(!existingPath.children)
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

async function initializeFiletrees() {
    if (window.location.pathname) {
        await setRepository(window.location.pathname.trim().replace(/\/$|^\//, ''))
    }


    var engineRepo = localStorage.getItem('engine_repository');

    var parts = engineRepo?.split('/') || document.getElementById('filelist').dataset['repository']?.split('/')

    if (parts) {
        var newRepo = parts.length == 2 ? parts[1] : parts[0] || repo.value
        var newOwner = parts.length == 2 ? parts[0] : owner.value
        var branches = await getBranches(newOwner, newRepo)
        updateSelectOptions('branch', branches)
        if (newOwner && newRepo)
            await loadGitHubTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')
    }

    var gameRepo = localStorage.getItem('game_repository');

    var parts2 = gameRepo?.split('/') || document.getElementById('gamelist').dataset['repository']?.split('/')
    if (parts2) {

        var newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repo.value
        var newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
        var branches2 = await getBranches(newOwner2, newRepo2)

        if (newOwner2 && newRepo2)
            await loadGitHubTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')
    }


    var assetRepo = localStorage.getItem('asset_repository');

    var parts3 = assetRepo?.split('/') || document.getElementById('assetlist').dataset['repository']?.split('/')

    if (parts3) {

        var newRepo3 = parts3.length == 2 ? parts3[1] : parts3[0] || repo.value
        var newOwner3 = parts3.length == 2 ? parts3[0] : owner.value
        var branches3 = await getBranches(newOwner3, newRepo3)

        if (newOwner3 && newRepo3)
            await loadGitHubTree(newOwner3, newRepo3, branches3[0]?.name || 'main', '#assetlist')

    }

    await showDatabases()

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;

                // Check if the node just became expanded
                if (target.classList.contains('treejs-node__open')) {
                    const folderId = target.getAttribute('data-id');

                    if(!trees['#database'].nodesById[folderId]) return

                    try {
                        if(loadedDatabases[folderId]) return

                        await readAll(folderId, loadTree.bind(null, folderId))
                        const newChildren = convertFlatToNested(Object.values(files[folderId]));

                        loadedDatabases[folderId] = newChildren;
                    } catch (err) {
                        console.error("Failed to load tree node:", err);
                        loadedDatabases[folderId] = [{ text: 'Error loading files', id: 'err' }];
                    }

                    await showDatabases()

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


document.addEventListener('DOMContentLoaded', async (event) => {

    await initializeFiletrees();

    renderHashCommand(window.location.hash.substring(1))

});



let tempCount = 1;
async function newFile() {
    const session = getOrCreateAceSession('temp' + (++tempCount), '');
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();

}




async function showDatabases() {
    var databases = await getDatabaseMetadata()


    var newData = databases.map((d, i) => ({
        id: `${d.key}`,
        text: d.key,
        state: {
            open: false,
            expanded: false
        },
        path: d.key,
        children: loadedDatabases[d.key] 
        ? loadedDatabases[d.key] 
        : [{
            id: `${d.key}`,
            text: 'Loading...',
            state: {
                open: false,
                expanded: false
            },
            path: d.key + '/' + 'loading',
        }]
    }))

    if (!trees['#database']) {

        trees['#database'] = new Tree('#database', {

            data: newData,
            autoOpen: false,
            closeDepth: 1,
        });
    }
    else {
        trees['#database'].options.data = newData
        trees['#database'].render(trees['#database'].options.data)
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
    //term.write('\n\rLoading: ' + cursor.path + '\n\r');

    files[database][cursor.path] = {
        timestamp: cursor.timestamp,
        mode: cursor.mode,
        contents: cursor.contents,
        path: cursor.path,
        sha: cursor.sha
    }
}


async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true) {
    savedToken = localStorage.getItem('github_token');

    var content = await cacheFile(repoOwner, repoName, filePath, sha)

    // 2. Ace Session
    const session = getOrCreateAceSession(filePath, content);
    const mode = getModeByFilename(filePath);
    session.setMode(mode);
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();
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
    const filePath = files[database][fileName]?.path
    if (filePath) {
        const fileId = files[database][fileName].sha
        currentOpenFileId = fileId;
        trees[database].values = [fileId];
        openFile(owner.value, repo.value, filePath, fileId, false);

    }
    else if (document.getElementById('toolbar')
        .querySelector(`[href*="${fileName}"]`)) {
        renderToolbarCommand(fileName)
    }
    else if (document.getElementById('tabs')
        .querySelector(`[href*="${fileName}"]`)) {
        renderTabsCommand(fileName || 'filelist')
    }
    else if (document.getElementById('terminals')
        .querySelector(`[href*="${fileName}"]`)) {
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
        openFile(owner.value, repo.value, filePath, trees[selector].nodesById[fileId].sha);
    }
}

document.getElementById('filelist').addEventListener('click', treeHandler.bind(null, '#filelist'));
document.getElementById('gamelist').addEventListener('click', treeHandler.bind(null, '#gamelist'));
document.getElementById('assetlist').addEventListener('click', treeHandler.bind(null, '#assetlist'));



function renderTabsCommand(panelId) {

    if(!panelId) return
    //    panelId = 'filelist'

    if (panelId == 'collapse') {
        let hasOpen = hideOpenPanels()
        if (!hasOpen)
            document.getElementById('filelist').classList.remove('hidden')
    }
    else if (panelId) {

        hideOpenPanels()

        document.querySelector(`#tabs [href*="${panelId}"]`).classList.add('active')

        var panel = document.getElementById(panelId)
        panel.classList.remove('hidden')
        panel.classList.add('not-hidden')

        var repo = panel.dataset['repository']
        if (panelId == 'filelist')
            repo = localStorage.getItem('engine_repository') || repo
        if (panelId == 'gamelist')
            repo = localStorage.getItem('game_repository') || repo
        if (panelId == 'assetlist')
            repo = localStorage.getItem('asset_repository') || repo

        if (repo)
            setRepository(repo)

        if(panelId == 'database')
            showDatabases()

    }


}




var panels = document.querySelectorAll('#filesearch, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});


function hideOpenPanels() {
    var hasOpen = false;

    var buttons = document.getElementById('tabs').children[0].children

    document.getElementById('viewport-frame').classList.remove('not-hidden')
    document.getElementById('editor').classList.remove('not-hidden')
    document.getElementById('terminal-container').classList.remove('not-hidden')

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


