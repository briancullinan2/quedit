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
    if (api.github_token && api.github_token.length > 0) {
        // Show a masked version so the user knows it's set
        const masked = api.github_token.substring(0, 4) + "•".repeat(12);
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
    }
}

function clearToken() {
    localStorage.removeItem('github_token');
    updatePlaceholder();
}


function addRepoIfNotExists(newRepo) {
    if (newRepo.includes('briancullinan2')) {
        console.error('Assertion repo name is briancullinan2')
        debugger
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

function configureRepository(newRepo) {
    if (newRepo.trim().replace(/\/$|^\//, '').length == 0) {
        return [,]
    }
    const parts = newRepo.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    addRepoIfNotExists(repoName)
    addOwnerIfNotExists(ownerName)
    return [ownerName, repoName]
}

async function setRepository(newRepo) {
    const [ownerName, repoName] = configureRepository(newRepo)
    if (ownerName === 'Quake3e') {
        console.error('Assertion: newOwner set to Quake3e should be ec- or briancullinan2')
        debugger
    }
    if (ownerName && ownerName.trim())
        owner.value = ownerName;
    if (repoName)
        repository.value = repoName;
    if (!ownerName || ownerName.trim() === '' || !repoName || repoName.trim === '') return
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




async function findTestFilepath(filePath) {

    let selected
    let dbFile


    if (!dbFile && files[engineRepository]) {
        dbFile = files[engineRepository][filePath]
        if (dbFile) {
            trees[engineRepository].values = [dbFile.sha];
            selected = engineRepository
        }
    }
    if (!dbFile && files[gameRepository]) {
        dbFile = files[gameRepository][filePath]
        if (dbFile) {
            trees[gameRepository].values = [dbFile.sha];
            selected = gameRepository
        }
    }
    if (!dbFile && files[assetRepository]) {
        dbFile = files[assetRepository][filePath]
        if (dbFile) {
            trees[assetRepository].values = [dbFile.sha];
            selected = assetRepository
        }
    }

    if (!dbFile) {
        if (!files[toolsRepository]) {
            const parts = toolsRepository.split('/')
            const ownerName = parts.length == 2 ? parts[0] : owner.value
            const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }
        if (files[toolsRepository][filePath]) {
            selected = toolsRepository
            dbFile = files[toolsRepository][filePath]
        }
    }


    if (!dbFile) {
        if (!files[tools2Repository]) {
            const parts = tools2Repository.split('/')
            const ownerName = parts.length == 2 ? parts[0] : owner.value
            const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }
        if (files[tools2Repository][filePath]) {

            selected = tools2Repository
            dbFile = files[tools2Repository][filePath]
        }
    }


    // TODO: FS.virtual for IDB access and database
    if (!dbFile) {

        dbFile = FS.virtual[filePath]
        // TODO: make this a kind of API setting thing
        let databases = await getDatabaseMetadata()
        let item

        for (item of databases) {
            const testFile = item.key + '/' + filePath

            if (trees['#database'].nodesById[testFile]) {
                dbFile = trees['#database'].nodesById[testFile]
                selected = item.key
                break;
            }

            let record = await getRecord(DB_STORE_NAME, filePath, item.key)
            if (record) {
                dbFile = trees['#database'].nodesById[testFile]
                    = FS.virtual[filePath] = record
                selected = item.key
                break;
            }
        }


        if (dbFile) {
            trees['#database'].values = [item.key];
        }

    }


    const pathParts = filePath.split('/')
    const pathOwner = pathParts.length == 2 ? pathParts[0] : null
    const pathRepo = pathParts.length == 2 ? pathParts[1] : pathParts[0]

    if (pathOwner && pathRepo
        && !pathOwner.includes('.') && !pathRepo.includes('.')
    ) {
        if (!files[pathOwner + '/' + pathRepo]) {
            let branch = await getDefaultBranch(pathOwner, pathRepo)
            await loadGitHubTree(pathOwner, pathRepo, branch)
        }
        if (files[pathOwner + '/' + pathRepo])
            selected = pathOwner + '/' + pathRepo

        filePath = pathParts.slice(2).join('/')

        for (let location of TEST_LOCATIONS) {
            let rewrittenPath = location + (location.length > 0 && !location.endsWith('/') ? '/' : '') + filePath
            dbFile = files[selected][rewrittenPath]
            if (dbFile) break
        }
    }


    return [selected, dbFile]
}


const TEST_LOCATIONS = ['', 'demoq3/pak0.pk3dir', 'docs/demoq3/pak0.pk3dir']

let fileClickDebouncer = null

async function clickFile(filePath, lineNumber, noBounce = false, noHide = false) {

    if (fileClickDebouncer) {
        clearTimeout(fileClickDebouncer)
    }
    if (!noBounce) {
        fileClickDebouncer = setTimeout(() => clickFile(filePath, lineNumber, true, noHide), 500)
        return
    }

    let selected
    let dbFile


    for (let location of TEST_LOCATIONS) {
        let rewrittenPath = location + (location.length > 0 && !location.endsWith('/') ? '/' : '') + filePath
        let [selected2, dbFile2] = await findTestFilepath(rewrittenPath)
        selected = selected2
        dbFile = dbFile2
        if (dbFile) {
            filePath = rewrittenPath
            break
        }
    }


    if (!dbFile || !selected) {
        writeLog('File not found: ' + filePath)
        return [,]
    }

    // do this once now to full reset
    if (!noHide)
        hideOpenPanels()
    latestPanelId = previousPanelId = 'editor' // switch from terminal automatically

    const parts = selected.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    if (!dbFile) dbFile = files[selected][filePath]

    if (!dbFile) return [null, selected]

    currentOpenFileId = dbFile.sha

    await openFile(ownerName, repoName, filePath, dbFile.sha, true /* record history */, false /* show file list */)
    setTimeout(() => {
        editorContainer.classList.remove('hidden')
        editorContainer.classList.add('not-hidden')

        if (lineNumber)
            aceEditor.gotoLine(lineNumber, 0, true);
        aceEditor.focus();
        latestPanelId = 'editor'
    }, 500)
    resizeDebouncer()
    return [selected, dbFile]
}



async function navigateFile(filePath, lineNumber, noBounce = false, noHide = false) {

    const [selected, dbFile] = await clickFile(filePath, lineNumber, noBounce, noHide)

    if (!selected) return

    hideOpenPanels()

    if (selected === engineRepository)
        renderTabsCommand('filelist', true, false)
    if (selected === gameRepository)
        renderTabsCommand('gamelist', true, false)
    if (selected === assetRepository)
        renderTabsCommand('assetlist', true, false)
    if (selected === toolsRepository)
        renderTabsCommand('database', true, false)
    if (selected === tools2Repository)
        renderTabsCommand('database', true, false)


}

