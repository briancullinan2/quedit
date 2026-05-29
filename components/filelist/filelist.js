

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
    const pos = aceEditor.getCursorPosition();
    NavHistory.push(sha, pos.row, pos.column);
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

        const parts = selected.split('/')
        const newRepo = parts.length == 2 ? parts[1] : parts[0] || repository.value
        const newOwner = parts.length == 2 ? parts[0] : owner.value

        openFile(newOwner, newRepo, filePath, trees[selector].nodesById[fileId].sha);
    }
}

document.getElementById('filelist').addEventListener('click', treeHandler.bind(null, '#filelist'));
document.getElementById('gamelist').addEventListener('click', treeHandler.bind(null, '#gamelist'));
document.getElementById('assetlist').addEventListener('click', treeHandler.bind(null, '#assetlist'));
document.getElementById('database').addEventListener('click', treeHandler.bind(null, '#database'));



const FILELIST_IDS = ['searchlist', 'filelist', 'gamelist', 'assetlist', 'database']

let panels = document.querySelectorAll('#paint, #token-modal, #viewport-frame, #terminal-container, #editor, #searchlist, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});

const searchWorker = new Worker('/components/filelist/search-worker.js');

// Track concurrent worker transactions completely independently
const activeSearchTransactions = new Map();
let terminalCommandDeferred = null; 

searchWorker.onmessage = function (e) {
    const { type, results, callbackId, query } = e.data;

    if (type === 'clear') {
        activeSearchTransactions.delete(callbackId);
        handleSearchWorkerResponse([], query);

        if (terminalCommandDeferred && terminalCommandDeferred.callbackId === callbackId) {
            terminalCommandDeferred.resolve([]);
            terminalCommandDeferred = null;
        }
        return;
    }

    // 1. Initialize or pull the isolated aggregation state bucket for this specific transaction
    if (!activeSearchTransactions.has(callbackId)) {
        activeSearchTransactions.set(callbackId, {
            paths: [],
            contents: [],
            github: []
        });
    }
    
    const txn = activeSearchTransactions.get(callbackId);
    txn[type] = results;

    // 2. Flatten only the results belonging strictly to this callback ID
    const flatCombined = [
        ...txn.paths,
        ...txn.contents,
        ...txn.github
    ];

    // 3. Perform standard grouping map normalization
    const groupedMap = new Map();
    flatCombined.forEach(item => {
        const key = `${item.repoSource}:${item.path}`;
        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                path: item.path,
                repo: item.repoSource,
                localMatches: [],
                remoteMatches: []
            });
        }

        const group = groupedMap.get(key);
        if (item.isRemote) {
            group.remoteMatches.push(item);
        } else {
            if (!group.localMatches.some(l => l.line === item.line && l.matchText === item.matchText)) {
                group.localMatches.push(item);
            }
        }
    });

    const finalGroupedArray = Array.from(groupedMap.values());

    // 4. Determine Routing Destination
    if (terminalCommandDeferred && terminalCommandDeferred.callbackId === callbackId) {
        // If this matches the terminal command track, resolve only when deep content loop checks complete
        if (type === 'contents' || finalGroupedArray.length === 0) {
            terminalCommandDeferred.resolve(finalGroupedArray);
            terminalCommandDeferred = null;
            activeSearchTransactions.delete(callbackId); // Cleanup allocation trace
        }
    } else {
        // Hand standard UI/Sidebar keystroke queries down to the HTML layout engine
        handleSearchWorkerResponse(finalGroupedArray, query);
    }
};

// Bind the handler cleanly to your search element
const searchInput = document.getElementById('search');
const searchStatus = document.getElementById('search-status');

function handleSearchWorkerResponse(incomingGroupedResults, rawQueryUsed) {
    const container = document.getElementById('search-results');

    if (incomingGroupedResults.length > 0) {
        window.searchResultHistoryStack = window.searchResultHistoryStack.filter(h => h.query !== rawQueryUsed);
        window.searchResultHistoryStack.push({
            query: rawQueryUsed,
            resultsSnapshot: incomingGroupedResults
        });

        if (window.searchResultHistoryStack.length > 10) {
            window.searchResultHistoryStack.shift();
        }

        searchInput.parentElement.setAttribute('placeholder', `${incomingGroupedResults.length} matches for: "${rawQueryUsed}"`);
        renderSearchResults(incomingGroupedResults);
        return;
    }

    if (incomingGroupedResults.length === 0) {
        const lastValidState = window.searchResultHistoryStack[window.searchResultHistoryStack.length - 1];

        if (lastValidState) {
            searchInput.parentElement.setAttribute('placeholder', '❌ 0 results found for ' + rawQueryUsed);
            renderSearchResults(lastValidState.resultsSnapshot, lastValidState.query);
        } else {
            searchInput.parentElement.setAttribute('placeholder', `❌ 0 search results found for "${rawQueryUsed}"`);
            container.innerHTML = `<div class="empty-placeholder">No assets matching workspace parameters.</div>`;
        }
    }
}

let federatedSearchTimer = null;
let latestQueryVal = null;
let lastExecutedQueryVal = null;
window.searchResultHistoryStack = [];

function triggerFederatedSearch(queryVal) {
    latestQueryVal = queryVal;
    if (federatedSearchTimer) return;
    runLockingCycle();
}

function runLockingCycle() {
    federatedSearchTimer = setTimeout(() => {
        if (!latestQueryVal || latestQueryVal.trim().length < 2) {
            federatedSearchTimer = null;
            return;
        }

        if (latestQueryVal === lastExecutedQueryVal) {
            federatedSearchTimer = null;
            return;
        }

        lastExecutedQueryVal = latestQueryVal;

        // Tag UI interactions with an explicit 'sidebar' tracking string
        searchWorker.postMessage({
            callbackId: 'ui-sidebar-search',
            query: latestQueryVal,
            caseSensitive: false,
            gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
            activeRepositories: [
                window.engineRepository,
                window.gameRepository,
                window.assetRepository,
                window.toolsRepository,
                window.tools2Repository
            ].filter(Boolean)
        });

        federatedSearchTimer = null;

        if (latestQueryVal !== lastExecutedQueryVal) {
            runLockingCycle();
        }
    }, 300);
}

searchInput.addEventListener('keydown', async (e) => {
    // 1. Intercept explicit execution submissions (Enter key)
    if (e.key === 'Enter') {
        e.preventDefault(); // Stop native form layouts from flashing the page

        const currentQuery = searchInput.value.trim();
        if (currentQuery.length >= 2) {
            // Force an immediate layout clear and lock bypass to override the throttling gates
            if (window.federatedSearchTimer) {
                clearTimeout(window.federatedSearchTimer);
                window.federatedSearchTimer = null;
            }

            // Fire the query instantly
            searchWorker.postMessage({
                query: currentQuery,
                caseSensitive: false,
                gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
                activeRepositories: [
                    window.engineRepository,
                    window.gameRepository,
                    window.assetRepository,
                    window.toolsRepository,
                    window.tools2Repository
                ].filter(Boolean)
            });
        }
        return;
    }

    // 2. Continuous Typing Interceptor Pass
    // Use a minor microtask delay to let the browser naturally update the input value string 
    // inside the DOM element node object before evaluating its length
    setTimeout(() => {
        const currentQuery = searchInput.value.trim();

        // Peek directly into your search history stack memory layer to check active density
        const lastHistoryState = window.searchResultHistoryStack?.[window.searchResultHistoryStack.length - 1];
        const activeResultCount = lastHistoryState?.resultsSnapshot?.length || 0;

        // STRATEGY CONDITION GATE: 
        // If the screen is empty (0 matches) OR the user cleared out the field, 
        // continuously trigger the lead-locking query pass loop to narrow down typos.
        // If we have a thick stack of valid results, return instantly and wait for 'Enter'.
        if (activeResultCount === 0 || currentQuery.length < 2) {
            triggerFederatedSearch(currentQuery);
        }
    }, 0);
});


function renderSearchResults(groupedItems, lastValidQuery) {
    const container = document.getElementById('search-results');
    if (!container) return;

    container.innerHTML = '';

    if (lastValidQuery) {
        container.innerHTML = `
            <div class="search-history-fallback-breadcrumb">
                Showing last valid state for: <strong>"${lastValidQuery}"</strong> 
                <span class="typo-trace-tag">(Broken at: "+${brokenDiffText}")</span>
            </div>
        `;
    } else if (!groupedItems || groupedItems.length === 0) {
        container.innerHTML = '<div class="empty-placeholder">No matching workspace references found.</div>';
        return;
    }

    groupedItems.forEach(group => {
        const card = document.createElement('div');
        card.className = 'search-card';

        const filename = group.path.split('/').pop();
        const [owner, repoName = ''] = group.repo.split('/');
        const firstSha = group.localMatches[0]?.sha || '';

        // 1. Render Header with dataset metadata tags attached directly to elements
        const header = document.createElement('div');
        header.className = 'search-card-header';
        header.innerHTML = `
            <span class="search-file-path" popovertarget="global-popup" placeholder="${group.path}"
                  data-owner="${Utils.escapeHtml(owner)}"
                  data-repo-name="${Utils.escapeHtml(repoName)}"
                  data-path="${Utils.escapeHtml(group.path)}"
                  data-sha="${Utils.escapeHtml(firstSha)}">${Utils.escapeHtml(group.path)}</span>
            <span class="search-repo-badge">${Utils.escapeHtml(group.repo)}</span>
            <span class="bx bx-trash" placeholder="Remove result" popovertarget="global-popup" onclick="this.parentElement.parentElement.remove()"></span>
        `;
        card.appendChild(header);

        // 2. Render Card Body
        const body = document.createElement('div');
        body.className = 'search-card-body';

        const allMatches = [...group.localMatches, ...group.remoteMatches];
        allMatches.forEach(match => {
            const row = document.createElement('div');
            row.className = 'search-match-row';

            // Store metadata inside structural dataset properties for event extraction passes
            row.dataset.owner = owner;
            row.dataset.repoName = repoName;
            row.dataset.path = group.path;
            row.dataset.sha = match.sha;
            row.dataset.line = match.line;

            const isFilenameHit = match.matchText.startsWith('[Filename Match]');
            row.dataset.isFilenameHit = isFilenameHit;

            let displayCode = '';
            if (isFilenameHit) {
                displayCode = `<span class="filename-match-tag">📄 Filename match: "${filename}"</span>`;
            } else if (match.matchIndex !== undefined) {
                let startText = match.matchText.substring(0, match.matchIndex);
                const highlightedToken = match.matchText.substring(match.matchIndex, match.matchIndex + match.matchLength);
                const endText = match.matchText.substring(match.matchIndex + match.matchLength);

                const MAX_PRE_MATCH_CHARS = 25;
                if (startText.length > MAX_PRE_MATCH_CHARS) {
                    startText = '…' + startText.substring(startText.length - MAX_PRE_MATCH_CHARS);
                }

                displayCode = `${Utils.escapeHtml(startText)}<mark class="search-highlight">${Utils.escapeHtml(highlightedToken)}</mark>${Utils.escapeHtml(endText)}`;
            } else {
                displayCode = Utils.escapeHtml(match.matchText);
            }

            row.innerHTML = `
                <div class="search-line-number">${isFilenameHit ? '—' : match.line}</div>
                <div class="search-match-text">${displayCode}</div>
            `;

            body.appendChild(row);
        });

        card.appendChild(body);
        container.appendChild(card);
    });
}


let debouceSearchClick = null
let filePathEl
let matchRowEl
// Run this initialization ONCE at startup
document.getElementById('search-results')?.addEventListener('click', searchResultsClick);


async function searchResultsClick(event, noBounce = false) {
    const target = event.target;
    filePathEl ||= target.closest('.search-file-path');
    matchRowEl ||= target.closest('.search-match-row');


    if (!filePathEl && !matchRowEl) return

    if (!noBounce && debouceSearchClick) return

    if (!debouceSearchClick) {
        debouceSearchClick = setTimeout(() => {
            searchResultsClick(event, true)
            debouceSearchClick = null
            filePathEl = null
            matchRowEl = null
        }, 400)
        return
    }

    // ─── CASE A: CLICKED A REPO FILE HEADER PATH ───
    if (filePathEl) {
        window.clickFile(
            filePathEl.dataset.owner,
            filePathEl.dataset.repoName,
            filePathEl.dataset.path,
            filePathEl.dataset.sha,
            true
        );
        return;
    }

    // ─── CASE B: CLICKED AN INDIVIDUAL MATCH ROW ───
    if (matchRowEl) {
        const isFilenameHit = matchRowEl.dataset.isFilenameHit === 'true';
        const lineNum = parseInt(matchRowEl.dataset.line, 10);

        await window.openFile(
            matchRowEl.dataset.owner,
            matchRowEl.dataset.repoName,
            matchRowEl.dataset.path,
            matchRowEl.dataset.sha,
            true, /* record in history */
            true, /* hide other panels */
            true  /* no bounce because we added it here */
        );

        if (!isFilenameHit && window.aceEditor) {
            setTimeout(() => {
                window.aceEditor.gotoLine(lineNum, 0, true);
            }, 200);
        }
    }
}



// Simple HTML text escaping helper mapping system tags to raw codes safely
const Utils = {
    escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};