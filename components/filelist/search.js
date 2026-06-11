function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
                  data-owner="${escapeHtml(owner)}"
                  data-repo-name="${escapeHtml(repoName)}"
                  data-path="${escapeHtml(group.path)}"
                  data-sha="${escapeHtml(firstSha)}">${escapeHtml(group.path)}</span>
            <span class="search-repo-badge">${escapeHtml(group.repo)}</span>
            <span class="bx bx-trash remove-search" placeholder="Remove result" popovertarget="global-popup"></span>
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

                displayCode = `${escapeHtml(startText)}<mark class="search-highlight">${escapeHtml(highlightedToken)}</mark>${escapeHtml(endText)}`;
            } else {
                displayCode = escapeHtml(match.matchText);
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
