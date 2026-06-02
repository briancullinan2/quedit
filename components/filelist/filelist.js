

const loadedDatabases = {}


let treeLoading = false
let refreshTree = null

async function expandDatabaseTree(target, folderId) {
    const parts = folderId.split('/')
    const database = folderId.startsWith('Virtual Memory') ? 'Virtual Memory' : (parts[0] + '/' + parts[1])
    const baseDir = folderId.startsWith('Virtual Memory') ? parts.slice(1).join('/') : parts.slice(2).join('/')
    const dirPath = baseDir.substring(0, baseDir.lastIndexOf('/'));
    const parentDir = database + (dirPath.trim().length > 0 ? ('/' + dirPath) : '')

    if (!target.classList.contains('treejs-node__open')) return
    if (!trees['#database'].nodesById[folderId]) return
    if (folderId.endsWith('[Recursive]')) return
    // if (loadedDatabases[folderId]) return


    try {

        // prevent mutation from triggering again when tree loads
        if (treeLoading) return
        treeLoading = true


        if (!hasUntared) {
            //await untarFrontent()
        }

        if (!files[database] && database !== 'Virtual Memory') {
            const parts = database.split('/')
            const ownerName = parts.length == 2 ? parts[0] : owner.value
            const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }

        let resultSet = {}
        let resultKeys = []
        if (database === 'Virtual Memory') {
            resultSet = FS.virtual
            resultKeys = Object.keys(FS.virtual)
            // TODO: query backend worker for IT's virtual memory, then ready it off the store or out of post message
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

function recordFileHistory(filePath, sha, lineNumber = null) {
    let selector = document.getElementById('filename')
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

    if (typeof aceEditor !== 'undefined') {
        const pos = aceEditor.getCursorPosition();
        NavHistory.push(sha, pos.row, pos.column);
    }
    if (lineNumber)
        history.pushState({ location: window.location.toString() }, filePath, '#' + filePath + ':' + lineNumber)
    else
        history.pushState({ location: window.location.toString() }, filePath, '#' + filePath)
    selector.parentElement.setAttribute('placeholder', 'Current file: ' + filePath)
}




window.addEventListener('popstate', (event) => {
    renderHashCommand(window.location.hash.substring(1))
});

window.addEventListener('hashchange', (event) => {
    //renderHashCommand(window.location.hash.substring(1))
});



function treeHandler(selector, e) {
    const node = e.target.closest('.treejs-node');
    if (!node) return

    const fileId = node.getAttribute('data-id'); // Assuming you set this
    //setTimeout(() => trees[selector].values = [fileId], 500)

    if (fileId.endsWith['[Recursive]']) {
        return
    }

    if (node && node.classList.contains('treejs-placeholder')) {
        const filePath = trees[selector].nodesById[fileId].path
        window.currentOpenFileId = trees[selector].nodesById[fileId].sha;

        let selected = owner.value + '/' + repository.value
        let nodeDB
        if (nodeDB = node.getAttribute('data-database')) {
            selected = nodeDB
        }
        if (node.closest('#filelist')) {
            selected = engineRepository
        }
        if (node.closest('#gamelist')) {
            selected = gameRepository
        }
        if (node.closest('#assetRepo')) {
            selected = assetRepository
        }
        if (node.closest('#database')) {
            let parent = node.closest('#database > div > ul > li[data-id]')
            if (nodeDB = parent.getAttribute('data-id'))
                selected = nodeDB

        }
        if (node.closest('#github')) {
            let parent = node.closest('#github > div > ul > li[data-id]')
            if (nodeDB = parent.getAttribute('data-id'))
                selected = nodeDB

        }

        const parts = selected.split('/')
        const newRepo = parts.length == 2 ? parts[1] : parts[0] || repository.value
        const newOwner = parts.length == 2 ? parts[0] : owner.value

        openFile(newOwner, newRepo, filePath, trees[selector].nodesById[fileId].sha);
    }
}


document.getElementById('github').addEventListener('click', treeHandler.bind(null, '#github'));
document.getElementById('filelist').addEventListener('click', treeHandler.bind(null, '#filelist'));
document.getElementById('gamelist').addEventListener('click', treeHandler.bind(null, '#gamelist'));
document.getElementById('assetlist').addEventListener('click', treeHandler.bind(null, '#assetlist'));
document.getElementById('database').addEventListener('click', treeHandler.bind(null, '#database'));



const FILELIST_IDS = ['searchlist', 'filelist', 'gamelist', 'assetlist', 'database', 'github']

let panels = document.querySelectorAll('#nunu, #paint, #token-modal, #viewport-frame, #terminal-container, #editor, #searchlist, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});


async function initializeFiletrees() {
    const newRepository = window.location.pathname?.trim().replace(/\/$|^\//, '')
    if (newRepository.length > 0) {
        await setRepository(newRepository)
    } else if (window.location.hash.includes('/')
        // TODO: make a caveat for #database??
        && !window.location.hash.includes('.') // don't try this on filenames
    ) {
        await setRepository(window.location.hash.substring(1))
    }


    engineRepository = SettingsManager.get('core', 'engineRepository')

    const parts = engineRepository?.split('/') || document.getElementById('filelist').dataset['repository']?.split('/')

    if (parts && parts[0]) {
        let newRepo = parts.length == 2 ? parts[1] : parts[0] || repository.value
        let newOwner = parts.length == 2 ? parts[0] : owner.value
        let branches = await getBranches(newOwner, newRepo)
        updateSelectOptions('branch', branches)
        if (newOwner && newRepo)
            await loadFileTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')
    }

    gameRepository = SettingsManager.get('core', 'gameRepository')

    const parts2 = gameRepository?.split('/') || document.getElementById('gamelist').dataset['repository']?.split('/')
    if (parts2 && parts2[0]) {

        let newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repository.value
        let newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
        let branches2 = await getBranches(newOwner2, newRepo2)

        if (newOwner2 && newRepo2)
            await loadFileTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')
    }


    assetRepository = SettingsManager.get('core', 'assetRepository')

    const parts3 = assetRepository?.split('/') || document.getElementById('assetlist').dataset['repository']?.split('/')

    if (parts3 && parts3[0]) {

        let newRepo3 = parts3.length == 2 ? parts3[1] : parts3[0] || repository.value
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


    await showGithubTree()

    const observer2 = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const folderId = target.getAttribute('data-id');

                // Check if the node just became expanded
                if (target.classList.contains('treejs-node__open')) {
                    expandGithubTree(target, folderId)
                }
            }
        });
    });

    // Observe the tree container for any class changes on nodes
    observer2.observe(document.querySelector('#github'), {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
}

const loadedGithubTreeNodes = {};
let githubTreeLoading = false;
let refreshGithubTree = null;

/**
 * Renders the top-level repository list inside the #github sidebar panel element.
 */
async function showGithubTree(folderId) {
    // 1. Gather all unique repo contexts defined in your environment settings
    const repoCollection = new Set([
        SettingsManager.get('core', 'engineRepository'),
        SettingsManager.get('core', 'gameRepository'),
        SettingsManager.get('core', 'assetRepository')
    ].filter(Boolean)); // Strip out undefined or empty configs

    const topRepositories = [];

    for (const repoKey of repoCollection) {
        if (!loadedGithubTreeNodes[repoKey]) {
            loadedGithubTreeNodes[repoKey] = {
                id: repoKey,
                text: repoKey, // e.g. "owner/repo-name"
                status: 0,
                state: { open: false, expanded: false },
                path: repoKey,
                // Give it an immediate dummy loading block so it renders an expander icon arrow
                children: [{
                    id: `${repoKey}/loading`,
                    text: 'Loading...',
                    status: 0,
                    state: { open: false, expanded: false },
                    path: `${repoKey}/loading`
                }]
            };
        }
        topRepositories.push(loadedGithubTreeNodes[repoKey]);
    }

    // 2. Initialize or incrementally patch partial nodes on the Tree instance layout target
    if (!trees['#github']) {
        trees['#github'] = new Tree('#github', {
            data: topRepositories,
            autoOpen: false,
            closeDepth: null
        });
    } else if (folderId) {
        trees['#github'].options.data = topRepositories;
        trees['#github'].renderPartial(folderId);
    }
}


const githubWorker = new Worker('/components/filelist/commit-worker.js');

// Track active callback resolvers for our async tree nodes
const pendingTreeRequests = {};

githubWorker.onmessage = function (e) {
    const { type, status, modified, added, error, callbackId } = e.data;

    if (type === 'staging_status') {
        const request = pendingTreeRequests[callbackId];
        if (!request) return;

        delete pendingTreeRequests[callbackId];

        if (status === 'SUCCESS') {
            // Forward the dirty file arrays directly into the layout compiler
            buildGithubTreeFromStaging(request.target, request.folderId, { modified, added });
        } else {
            console.error("Worker status check failed:", error);
            const folderId = request.folderId;
            loadedGithubTreeNodes[folderId].children = [{ text: 'Error tracking files', id: `${folderId}/err` }];
            finalizeGithubTreeExpansion(folderId);
        }
    }

    if (type === 'commit_status') {
        // Handle your post-commit layout resets here
        writeLog(`Commit response signature: ${status}`);
    }
};

async function expandGithubTree(target, folderId) {
    const parts = folderId.split('/');
    const database = `${parts[0]}/${parts[1]}`; // Isolate owner/repo segment

    if (!target.classList.contains('treejs-node__open')) return;
    if (!trees['#github'].nodesById[folderId]) return;

    try {
        if (githubTreeLoading) return;
        githubTreeLoading = true;

        // Ensure remote baseline structure is populated locally 
        if (!files[database]) {
            let branch = await getDefaultBranch(parts[0], parts[1]);
            await loadGitHubTree(parts[0], parts[1], branch);
        }

        // --- LAYER A: REPOSITORY LEVEL ROOT ---> IMMEDIATE STRUCTURAL INJECTION
        if (parts.length === 2) {
            let newChildren = [
                {
                    id: `${database}/Modified`,
                    text: 'Modified',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Modified/loading` }]
                },
                {
                    id: `${database}/Added`,
                    text: 'Added',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Added/loading` }]
                },
                {
                    id: `${database}/Staged`,
                    text: 'Staged',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Staged/loading` }]
                }
            ];

            loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = newChildren;
            showGithubTree(folderId);
            finalizeGithubTreeExpansion(folderId);
        }

        // --- LAYER B: STATUS SUB-CATEGORIES ---> MESSAGE HANDOFF
        const callbackId = `tree_sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // Cache the execution arguments to process when onmessage fires
        pendingTreeRequests[callbackId] = { target, folderId };

        // Query the worker dry-run staging verification pipeline
        githubWorker.postMessage({
            type: 'COMMIT_STATUS_CHECK',
            owner: parts[0],
            repo: parts[1],
            branch: await getDefaultBranch(parts[0], parts[1]),
            gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
            callbackId: callbackId
        });

    } catch (err) {
        console.error("Failed handling async root branch dependencies:", err);
        loadedGithubTreeNodes[folderId].children = [{ text: 'Error connecting to worker', id: `${folderId}/err` }];
        finalizeGithubTreeExpansion(folderId);
    }
}




function buildGithubTreeFromStaging(target, folderId, stagingDetails) {
    const parts = folderId.split('/');
    const database = `${parts[0]}/${parts[1]}`;

    // --- MODE A: REPOSITORY ROOT LEVEL EXPANSION (parts.length === 2) ---
    if (parts.length === 2) {
        // We compile the three fixed parent nodes, seeding their children lists immediately 
        // by passing down deeper virtual folder IDs to our own parsing logic.
        const modifiedChildren = compileStagingLevelChildren(`${folderId}/Modified`, '', stagingDetails.modified || []);
        const addedChildren = compileStagingLevelChildren(`${folderId}/Added`, '', stagingDetails.added || []);
        const stagedChildren = []; // Explicit staged hook destination

        const rootCategories = [
            {
                id: `${database}/Modified`,
                text: `Modified (${stagingDetails.modified.length})`,
                status: 0,
                state: { open: false, expanded: false },
                children: modifiedChildren.length > 0 ? modifiedChildren : [{ text: 'Empty...', id: `${database}/Modified/empty` }]
            },
            {
                id: `${database}/Added`,
                text: `Added (${stagingDetails.added.length})`,
                status: 0,
                state: { open: false, expanded: false },
                children: addedChildren.length > 0 ? addedChildren : [{ text: 'Empty...', id: `${database}/Added/empty` }]
            },
            {
                id: `${database}/Staged`,
                text: 'Staged (0)',
                status: 0,
                state: { open: false, expanded: false },
                children: stagedChildren.length > 0 ? stagedChildren : [{ text: 'Empty...', id: `${database}/Staged/empty` }]
            }
        ];

        // Register the static categories into the node lookup dictionary
        rootCategories.forEach(catNode => {
            loadedGithubTreeNodes[catNode.id] = trees['#github'].nodesById[catNode.id] = catNode;
        });

        loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = rootCategories;

        showGithubTree(folderId);
        finalizeGithubTreeExpansion(folderId);
        return;
    }

    // --- MODE B: NESTED CATEGORY OR SUBDIRECTORY EXPANSION ---
    const statusCategory = parts[2];          // 'Modified', 'Added', or 'Staged'
    const baseDir = parts.slice(3).join('/'); // Subdirectory extraction path

    let matchingPaths = [];
    if (statusCategory === 'Modified') {
        matchingPaths = stagingDetails.modified || [];
    } else if (statusCategory === 'Added') {
        matchingPaths = stagingDetails.added || [];
    }

    // Process deep folder layouts dynamically 
    const dynamicChildren = compileStagingLevelChildren(folderId, baseDir, matchingPaths);
    loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = dynamicChildren;

    showGithubTree(folderId);
    finalizeGithubTreeExpansion(folderId);
}


/**
 * Pure parsing helper to structure a group of paths for a specific UI node location point.
 */
function compileStagingLevelChildren(folderId, baseDir, matchingPaths) {
    const newChildren = [];
    const directoriesFound = new Set();
    const absoluteFilesFound = [];

    matchingPaths.forEach(path => {
        let matchesDirPrefix = baseDir === '' ? true : path.startsWith(baseDir + '/');
        if (!matchesDirPrefix) return;

        const relativePart = baseDir === '' ? path : path.substring(baseDir.length + 1);
        const nextSlashIdx = relativePart.indexOf('/');

        if (nextSlashIdx === -1) {
            absoluteFilesFound.push(path);
        } else {
            directoriesFound.add(relativePart.substring(0, nextSlashIdx));
        }
    });

    // 1. Compile Directories
    directoriesFound.forEach(dirName => {
        const computedPath = baseDir === '' ? dirName : `${baseDir}/${dirName}`;
        const nodeId = `${folderId}/${dirName}`;

        const dirNode = {
            id: nodeId,
            text: dirName,
            path: computedPath,
            status: 0,
            state: { open: false, expanded: false },
            children: [{ text: 'Loading...', id: `${nodeId}/loading` }]
        };

        loadedGithubTreeNodes[nodeId] = trees['#github'].nodesById[nodeId] = dirNode;
        newChildren.push(dirNode);
    });

    // 2. Compile Files
    absoluteFilesFound.forEach(path => {
        const name = path.split('/').pop() || path;
        const nodeId = `${folderId}/${name}`;

        const fileNode = {
            id: nodeId,
            text: name,
            path: path,
            status: 0,
            state: { open: false, expanded: false },
            children: null
        };

        loadedGithubTreeNodes[nodeId] = trees['#github'].nodesById[nodeId] = fileNode;
        newChildren.push(fileNode);
    });

    if (newChildren.length > 0) {
        sortNodes(newChildren);
    }

    return newChildren;
}



function finalizeGithubTreeExpansion(folderId) {
    if (refreshGithubTree) clearTimeout(refreshGithubTree);
    refreshGithubTree = setTimeout(async () => {
        trees['#github'].values = [];
        const node = trees['#github'].nodesById[folderId];
        if (node) {
            trees['#github'].open(node);
        }
        setTimeout(() => { githubTreeLoading = false; }, 300);
    }, 200);
}

