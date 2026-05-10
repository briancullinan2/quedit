const owner = document.getElementById('owner');
const repo = document.getElementById('repository');
const branch = document.getElementById('branch');


branch.addEventListener('change', (e) => {

    let fileList = 'engine_repository'
    if (!document.getElementById('gamelist').classList.contains('hidden'))
        fileList = 'game_repository'
    if (!document.getElementById('assetlist').classList.contains('hidden'))
        fileList = 'asset_repository'

    localStorage.setItem(fileList, owner.value + '/' + repo.value)
})





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
    savedToken = localStorage.getItem('github_token');

    if (savedToken && savedToken.length > 0) {
        // Show a masked version so the user knows it's set
        const masked = savedToken.substring(0, 4) + "•".repeat(12);
        tokenInput.placeholder = `Currently set: ${masked}`;
        tokenInput.classList.add('has-token');
    } else {
        tokenInput.placeholder = "Enter ghp_your_token_here...";
        tokenInput.classList.remove('has-token');
    }

    // because hideOpenPanels() hides it in the same sequence
    setTimeout(() => modal.classList.remove('hidden'), 200);
}

function saveToken() {
    savedToken = tokenInput.value.trim();
    if (savedToken) {
        localStorage.setItem('github_token', savedToken);
        tokenInput.value = ''; // Clear input for security
        updatePlaceholder();
        alert('Token saved to local storage.');
    }
    modal.classList.add('hidden');
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

        repo.appendChild(option);
        localStorage.setItem('repositories', Array.from(repo.children).map(c => c.value).join(';'))
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


async function setRepository(newRepo) {
    if (newRepo.trim().replace(/\/$|^\//, '').length == 0) return
    let parts = newRepo.split('/')
    let newOwner
    if (parts.length === 2) {
        newOwner = parts[0]
        newRepo = parts[1]
    }

    addRepoIfNotExists(newRepo)
    addOwnerIfNotExists(newOwner)
    if (newOwner === 'Quake3e') {
        console.error('Assertion: newOwner set to Quake3e should be ec- or briancullinan2')
        debugger
    }
    if (newOwner.trim())
        owner.value = newOwner;
    repo.value = newRepo;
    var branches = await getBranches(owner.value, repo.value)
    updateSelectOptions('branch', branches)
}

window.addEventListener('beforeunload', event => {
    event.preventDefault();
    event.returnValue = '';
});


let owners = localStorage.getItem('owners')?.split(';')
updateSelectOptions(owner, owners)
owner.value = localStorage.getItem('default_owner') || owners[0]
let repos = localStorage.getItem('repositories')?.split(';')
updateSelectOptions(repo, repos)
repo.value = localStorage.getItem('default_repository') || repos[0]


function renderToolbarCommand(buttonId) {
    let engineRepo = localStorage.getItem('engine_repository') || document.getElementById('filelist').dataset['repository'] || 'briancullinan2/Quake3e'

    if (buttonId == 'compile') {
        if (configuration.value == 'tools')
            return buildTools(toolsRepo)
        if (configuration.value == 'qvms')
            return buildQVM(gameRepo)
        return build(engineRepo)
    }

    if (buttonId == 'play')
        return run()

    if (buttonId == 'back')
        return NavHistory.back()

    if (buttonId == 'next')
        return NavHistory.forward()

    if (buttonId == 'new')
        return newFile()

    if (buttonId == 'save')
        return saveFile()

    if (buttonId == 'settings')
        return settings()

    if (buttonId == 'reload')
        localStorage.setItem('hot_reload', !!document.getElementById('reload').checked);

    if (buttonId == 'repository')
        localStorage.setItem('default_repository', repo.value)

    if (buttonId == 'owner')
        localStorage.setItem('default_owner', owner.value)

    if(currentSession().includes('settings.json'))
    {
        //saveFile()
        settings()
    }

    renderTabsCommand(buttonId)
}


document.getElementById('toolbar').addEventListener('change', async (e) => {
    renderToolbarCommand(
        e.target.href?.split('#').pop() || e.target.id)

});


document.getElementById('toolbar').addEventListener('click', async (e) => {
    renderToolbarCommand(
        e.target.href?.split('#').pop() || e.target.id)

});



let currentConfig = localStorage.getItem('configuration');
configuration.value = currentConfig
document.getElementById('reload').checked = localStorage.getItem('hot_reload') !== 'false';

configuration.addEventListener('change', async (e) => {
    localStorage.setItem('configuration', configuration.value);

});



function settings() {
    const database = owner.value + '/' + repo.value
    const filePath = 'settings.json' + (++tempCount)
    if (engineRepo.startsWith('Quake3e')) {
        console.error('Assertion owner set to Quake3e instead of briancullinan')
        debugger
    }
    const settings = JSON.stringify({
        configuration: currentConfig,
        engine_repository: engineRepo,
        game_repository: gameRepo,
        asset_repository: assetRepo,
        theme: savedTheme,
        github_token: savedToken,
        hot_reload: !!document.getElementById('reload').checked,
        repositories: Array.from(repo.children).map(c => c.value),
        owners: Array.from(owner.children).map(c => c.value),
        default_repository: repo.value,
        default_owner: owner.value,
    }, null, 4)
    const newSha = getGitShaBrowser(settings)
    if (files[database]) {
        files[database][filePath] = {
            timestamp: new Date(),
            mode: FS_FILE,
            contents: new TextEncoder().encode(settings),
            path: filePath,
            sha: newSha
        }
    }

    const session = getOrCreateAceSession(filePath, settings);
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();
    hideOpenPanels()
    document.getElementById('editor').classList.add('not-hidden')

}


function saveSettings(content) {
    try {
        var settings = JSON.parse(content)

        engineRepo = settings.engine_repository
        // TODO: make this a loop
        if (engineRepo.startsWith('Quake3e')) {
            console.error('Assertion engineRepo is Quake3e should start with ec- or briancullinan2')
            debugger
        }
        if (!engineRepo)
            localStorage.removeItem('engine_repository')
        else
            localStorage.setItem('engine_repository', engineRepo)
        if (!document.getElementById('filelist').classList.contains('hidden'))
            setRepository(engineRepo)

        gameRepo = settings.game_repository
        if (!gameRepo)
            localStorage.removeItem('game_repository')
        else
            localStorage.setItem('game_repository', gameRepo)
        if (!document.getElementById('filelist').classList.contains('hidden'))
            setRepository(gameRepo)

        assetRepo = settings.asset_repository
        if (!assetRepo)
            localStorage.removeItem('asset_repository')
        else
            localStorage.setItem('asset_repository', assetRepo)
        // TODO: set whatever were viewing, filelist
        if (!document.getElementById('filelist').classList.contains('hidden'))
            setRepository(assetRepo)

        savedTheme = settings.theme
        setTheme(settings.theme)

        savedToken = settings.github_token
        localStorage.setItem('github_token', savedToken)

        configuration.value = currentConfig = settings.configuration
        localStorage.setItem('configuration', currentConfig)

        document.getElementById('reload').checked = !!settings.hot_reload
        localStorage.setItem('hot_reload', !!settings.hot_reload)

        updateSelectOptions('owner', settings.owners || [])
        localStorage.setItem('owners', (settings.owners || []).join(';'))
        updateSelectOptions('repository', settings.repositories || [])
        localStorage.setItem('repositories', (settings.repositories || []).join(';'))
        
        localStorage.setItem('default_owner', settings.default_owner)
        owner.value = settings.default_owner
        localStorage.setItem('default_repository', settings.default_repository)
        repo.value = settings.default_repository
    }
    catch (e) {
        console.log(e)
    }

}


