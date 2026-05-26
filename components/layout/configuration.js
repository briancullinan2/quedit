const SCROLLBAR_WIDTH = 15

let TERMINATE = false


function updateSelectOptions(elementId, items, selectedValue = 'main') {
    const selector = elementId instanceof Element ? elementId : document.getElementById(elementId);
    if (!selector) return;

    // 1. Clear existing options
    selector.innerHTML = '';

    // 2. Create and append new options
    items.forEach(item => {
        // Handle both simple strings or GitHub branch objects
        const name = typeof item === 'object' ? item.name : item;
        const option = document.createElement('option');

        option.value = name;
        option.textContent = name;

        if (name === selectedValue) {
            option.selected = true;
        }

        selector.appendChild(option);
    });

    // 3. Force layout recalculation 
    // This helps with the "wont shrink" issue if the new text is shorter
    selector.style.minWidth = '0';
}



const tokenInput = document.getElementById('gh-token-input');
const modal = document.getElementById('token-modal');

function updatePlaceholder() {
    let token = typeof api !== 'undefined' && api.github_token && api.github_token.length > 0
        ? api.github_token
        : localStorage.getItem('github_token')
    if (token) {
        // Show a masked version so the user knows it's set
        const masked = token.substring(0, 4) + "•".repeat(12);
        tokenInput.placeholder = `Currently set: ${masked}`;
        tokenInput.classList.add('has-token');
    } else {
        tokenInput.placeholder = "Enter ghp your token here...";
        tokenInput.classList.remove('has-token');
    }

    // because hideOpenPanels() hides it in the same sequence
    setTimeout(() => modal.classList.remove('hidden'), 200);
}

function saveToken() {
    localStorage.setItem('github_token', tokenInput.value.trim())
    //SettingsManager.applyValue(IMPORT_SETTINGS.core.githubToken, tokenInput.value.trim())
    if (window.api.github_token) {
        tokenInput.value = ''; // Clear input for security
        alert('Token saved to local storage.');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
}

function clearToken() {
    localStorage.removeItem('github_token');
    updatePlaceholder();
}


function addRepoIfNotExists(newRepo) {
    if (!newRepo || newRepo.includes('briancullinan2')) {
        console.error('Assertion repo name is briancullinan2')
        debugger
        return
    }

    if (newRepo.trim().length > 0 && !document.querySelector(`#repository option[value="${newRepo}"]`)) {
        const option = document.createElement('option');

        option.value = newRepo;
        option.textContent = newRepo;
        //option.selected = true;

        repository.appendChild(option);
        localStorage.setItem('repositories', Array.from(repository.children).map(c => c.value).join(';'))
    }
}


function addOwnerIfNotExists(newOwner) {
    if (newOwner.includes('Quake3e')) {
        console.error('Assertion owner name is Quake3e should be briancullinan2')
        debugger
        return
    }

    if (newOwner && newOwner.trim().length > 0 && !document.querySelector(`#owner option[value="${newOwner}"]`)) {
        const option = document.createElement('option');

        option.value = newOwner;
        option.textContent = newOwner;
        option.selected = true;

        owner.appendChild(option);
        localStorage.setItem('owners', Array.from(owner.children).map(c => c.value).join(';'))
    }
}


function parseRepository(newRepo) {
    if (newRepo.trim().replace(/\/$|^\//, '').length == 0) {
        return [,]
    }
    const parts = newRepo.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    return [ownerName, repoName]
}

function configureRepository(newRepo) {
    const [ownerName, repoName] = parseRepository(newRepo)
    if (!ownerName || ownerName.length === 0 || !repoName || repoName.length === 0)
        return

    addRepoIfNotExists(repoName)
    addOwnerIfNotExists(ownerName)

    return [ownerName, repoName]
}

async function setRepository(newRepo) {
    const [ownerName, repoName] = configureRepository(newRepo)
    if (ownerName === 'Quake3e' || ownerName === '') {
        console.error('Assertion: newOwner set to Quake3e should be ec- or briancullinan2')
        debugger
    }
    if (!ownerName || ownerName.trim() === '' || !repoName || repoName.trim === '') return
    if (ownerName && ownerName.trim())
        owner.value = ownerName;
    if (repoName)
        repository.value = repoName;
    const branches = await getBranches(owner.value, repository.value)
    updateSelectOptions('branch', branches)
}


/**
 * Creates a functional frame rate limiter with a callback.
 * @param {number} targetFps - The desired frames per second.
 * @param {function} callback - Function called on render: (event, t, frame) => {}
 * @returns {object} An interface containing the requestFrameUpdate function.
 */
function createFrameRater(targetFps, callback) {
    const fpsInterval = 1000 / targetFps;

    // State variables held securely in the closure scope
    let lastDrawTime = performance.now();
    let needsRender = false;
    let currentEvent = null;
    let frameCount = 0;
    let startTime = lastDrawTime;

    // The looping tick function
    function tick(currentTime) {
        requestAnimationFrame(tick);

        const elapsed = currentTime - lastDrawTime;

        if (needsRender && elapsed >= fpsInterval) {
            // Keep timing consistent over long periods
            lastDrawTime = currentTime - (elapsed % fpsInterval);
            needsRender = false;
            frameCount++;

            // Calculate total elapsed time 't' since the rater started
            const t = currentTime - startTime;

            // Execute the user-provided callback with the requested parameters
            if (typeof callback === 'function') {
                callback(currentEvent, t, frameCount);
            }
        }
    }

    // Kick off the loop immediately
    requestAnimationFrame(tick);

    // Return only the public API method needed by external tools/mouse events
    return {
        requestFrameUpdate(e) {
            needsRender = true;
            currentEvent = e;
        }
    };
}

const TESTPATH_ROOTS = ['', 'demoq3/pak0.pk3dir', 'docs/demoq3/pak0.pk3dir'];

/**
 * High-level workspace resolver. Ingests raw window paths, hashes, or explicit links, 
 * extracts line numbers, runs prefix multiplexing, scans active VFS/IDB spaces, 
 * and maps the request to a final active file node.
 * * @param {string} [hintPath] - Optional explicit file path to search instead of window state.
 * @returns {Promise<Array>} [resolvedLocation, repositoryKey, fileNode, lineNumber]
 */
async function findFileTestPath(hintPath) {
    // 1. Gather all raw potential source context vectors
    const rawPathCandidates = [
        hintPath,
        window.location.hash?.substring(1),
        window.location.pathname?.substring(1)
    ].filter(loc => typeof loc === 'string' && loc.trim().length > 0);

    if (rawPathCandidates.length === 0) return [null, null, null, null];

    // 2. Extract line anchors and cross-multiply candidates against TESTPATH_ROOTS
    const lookupQueue = rawPathCandidates.flatMap(rawCandidate => {
        const hasColon = rawCandidate.includes(':');
        const cleanPathPart = hasColon ? rawCandidate.split(':')[0] : rawCandidate;
        const extractedLine = hasColon ? parseInt(rawCandidate.split(':').pop(), 10) : null;

        return TESTPATH_ROOTS.map(root => {
            const delimiter = (root.length > 0 && !root.endsWith('/')) ? '/' : '';
            return {
                testPath: root + delimiter + cleanPathPart,
                line: extractedLine
            };
        });
    });

    // 3. Compile list of repositories declared in your core settings
    const activeRepositories = [
        window.engineRepository,
        window.gameRepository,
        window.assetRepository,
        window.toolsRepository,
        window.tools2Repository
    ].filter(Boolean);

    // 4. Processing Loop: Evaluate every path variation against every storage layer
    for (const item of lookupQueue) {
        let selectedRepo = null;
        let dbFile = null;
        const currentPath = item.testPath;

        // LAYER A: Check Memory-Cached Repositories
        for (const repoKey of activeRepositories) {
            // Dynamic on-demand lazy load if missing
            if (!files[repoKey]) {
                const parts = repoKey.split('/');
                const ownerName = parts.length === 2 ? parts[0] : window.owner.value;
                const repoName = parts.length === 2 ? parts[1] : (parts[0] || window.repository.value);
                try {
                    const branch = await getDefaultBranch(ownerName, repoName);
                    await loadGitHubTree(ownerName, repoName, branch);
                } catch (err) {
                    console.warn(`Dynamic tree resolve failure for: ${repoKey}`, err);
                    continue;
                }
            }

            if (files[repoKey] && files[repoKey][currentPath]) {
                dbFile = files[repoKey][currentPath];
                selectedRepo = repoKey;
                if (trees[repoKey]) trees[repoKey].values = [dbFile.sha];
                break;
            }
        }

        // LAYER B: Check Client IndexedDB Database Contexts
        if (!dbFile) {
            const databases = await getDatabaseMetadata();
            let dbMeta
            for (dbMeta of databases) {
                const testFileKey = `${dbMeta.key}/${currentPath}`;
                try {
                    if (trees['#database']?.nodesById[testFileKey]) {
                        dbFile = trees['#database'].nodesById[testFileKey];
                        selectedRepo = dbMeta.key;
                        break;
                    }
                    const record = await getRecord(DB_STORE_NAME, currentPath, dbMeta.key);
                    if (record) {
                        if (trees['#database']) trees['#database'].nodesById[testFileKey] = record;
                        FS.virtual[currentPath] = record;
                        dbFile = record;
                        selectedRepo = dbMeta.key;
                        break;
                    }
                } catch (e) {
                    if (typeof window.writeLog === 'function') window.writeLog(e.message);
                }
            }
            if (dbFile && trees['#database'] && typeof dbMeta !== 'undefined') {
                trees['#database'].values = [dbMeta.key];
            }
        }

        // LAYER C: Parse Inline Explicit Repository Invocations ("owner/repo/path")
        /*
        if (!dbFile) {
            const pathParts = currentPath.split('/');
            const pathOwner = pathParts.length >= 2 ? pathParts[0] : null;
            const pathRepo = pathParts.length >= 2 ? pathParts[1] : pathParts[0];

            if (pathOwner && pathRepo && !pathOwner.includes('.') && !pathRepo.includes('.')) {
                const dynamicRepoKey = `${pathOwner}/${pathRepo}`;
                if (!files[dynamicRepoKey]) {
                    try {
                        const branch = await getDefaultBranch(pathOwner, pathRepo);
                        await loadGitHubTree(pathOwner, pathRepo, branch);
                    } catch (e) {}
                }
                if (files[dynamicRepoKey]) {
                    selectedRepo = dynamicRepoKey;
                    const strippedPath = pathParts.slice(2).join('/');
                    if (files[selectedRepo][strippedPath]) {
                        dbFile = files[selectedRepo][strippedPath];
                    }
                }
            }
        }
        */

        // If this round found a hit, return the composite metadata array immediately
        if (dbFile) {
            console.log(`[VFS Resolved] File: ${currentPath} | Line: ${item.line}`);
            return [currentPath, selectedRepo, dbFile, item.line];
        }
    }

    return [null, null, null, null];
}

window.isModifierPressed = false
window.isDragging = false
