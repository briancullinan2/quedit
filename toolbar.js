const owner = document.getElementById('owner');
const repo = document.getElementById('repository');
const branch = document.getElementById('branch');
const configuration = document.getElementById('configuration')





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
    api.github_token = localStorage.getItem('github_token');

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
    api.github_token = tokenInput.value.trim();
    if (api.github_token) {
        localStorage.setItem('github_token', api.github_token);
        tokenInput.value = ''; // Clear input for security
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
    const branches = await getBranches(owner.value, repo.value)
    updateSelectOptions('branch', branches)
}

window.addEventListener('beforeunload', event => {
    event.preventDefault();
    event.returnValue = '';
});


let owners = localStorage.getItem('owners')?.split(';')
if (!owners || owners.length == 0) owners = ['briancullinan2', 'ec-']
updateSelectOptions(owner, owners)
owner.value = localStorage.getItem('default_owner') || owners[0]
let repos = localStorage.getItem('repositories')?.split(';')
if (!repos || repos.length == 0) repos = ['Quake3e', 'baseq3a']
updateSelectOptions(repo, repos)
repo.value = localStorage.getItem('default_repository') || repos[0]


async function renderToolbarCommand(buttonId) {
    let engineRepo = localStorage.getItem('engine_repository') || document.getElementById('filelist').dataset['repository'] || 'briancullinan2/Quake3e'

    if (!buttonId) return
    if (buttonId.startsWith('main_menu'))
        return true

    if (buttonId === 'compile') {
        if (configuration.value == 'tools')
            await buildTools(toolsRepo)
        else if (configuration.value == 'qvms')
            await buildQVM(gameRepo)
        else
            await buildClient(engineRepo)
    }

    if (buttonId === 'github')
        updatePlaceholder()

    if (buttonId === 'play')
        //runEngine()

        if (buttonId === 'back')
            NavHistory.back()

    if (buttonId === 'next')
        NavHistory.forward()

    if (buttonId === 'new')
        newFile()

    if (buttonId === 'save')
        saveFile()

    if (buttonId === 'settings')
        settings()

    if (buttonId === 'reload')
        localStorage.setItem('hot_reload', !!document.getElementById('reload').checked);

    if (buttonId === 'repository')
        localStorage.setItem('default_repository', repo.value)

    if (buttonId === 'owner')
        localStorage.setItem('default_owner', owner.value)

    if (buttonId === 'configuration')
        localStorage.setItem('configuration', configuration.value);

    if (buttonId === 'theme')
        setTheme(theme.value)

    if (buttonId === 'branch') {

        // don't change a repo if it's already set to one of
        //   defined repos, just let filelist display it

    }

    if (buttonId === 'fullscreen') {
        // TODO: request from window
    }

    if (buttonId === 'configuration'
        || buttonId === 'wasi'
        || buttonId === 'theme'
        || buttonId === 'spawn'
        || buttonId === 'map'
        || buttonId === 'branch'
        || buttonId === 'repository'
        || buttonId === 'owner'
        || buttonId === 'keybinding'
        || buttonId === 'filename'
        || buttonId === 'reload'
    ) {
        let filename = currentSession()
        if (filename?.includes('settings.json')) {
            //saveFile()
            settings()
        }
    }

    // already debounced above
    renderTabsCommand(buttonId)
}


document.getElementById('toolbar').addEventListener('change', async (e) => {
    return renderToolbarCommand(
        e.target.id || e.target.href?.split('#').pop())

});


document.getElementById('toolbar').addEventListener('click', async (e) => {
    return renderToolbarCommand(
        e.target.id || e.target.href?.split('#').pop())

});



let currentConfig = localStorage.getItem('configuration');
configuration.value = currentConfig
document.getElementById('reload').checked = localStorage.getItem('hot_reload') !== 'false';

configuration.addEventListener('change', async (e) => {


});



async function settings() {
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
        github_token: api.github_token,
        hot_reload: !!document.getElementById('reload').checked,
        repositories: Array.from(repo.children).map(c => c.value),
        owners: Array.from(owner.children).map(c => c.value),
        default_repository: repo.value,
        default_owner: owner.value,
        keybinding: keybinding.value,
        history: commandHistory
    }, null, 4)
    const newSha = await getGitShaBrowser(settings)
    if (files[database]) {
        files[database][filePath] = {
            timestamp: new Date(),
            mode: FS_FILE,
            contents: new TextEncoder().encode(settings),
            path: filePath,
            sha: newSha,
            parent: filePath.substring(0, filePath.lastIndexOf('/'))
        }
    }

    const session = getOrCreateAceSession(filePath, settings);
    editor.setSession(session);

    hideOpenPanels()

    editorContainer.classList.add('not-hidden')
    editorContainer.classList.remove('hidden')
}

function saveSettings(content) {
    try {
        let settings = JSON.parse(content)

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

        savedKeybinding = settings.keybinding
        keybinding.value = settings.keybinding
        localStorage.setItem('keybinding', api.keybinding)
        if (!savedKeybinding || savedKeybinding == 'null')
            editor.setKeyboardHandler(null);
        else
            editor.setKeyboardHandler(settings.keybinding);

        api.github_token = settings.github_token
        localStorage.setItem('github_token', api.github_token)

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

        commandHistory.splice(0, history.length);
        for (let cmd of settings.history)
            if (cmd.trim().length > 0)
                commandHistory.push(cmd)
        localStorage.setItem('history', JSON.stringify(commandHistory instanceof Array ? commandHistory || [] : []))
    }
    catch (e) {
        PREAMBLE = EDITOR_PREAMBLE
        writeLog(`${e.message}\n\r${e.stack || e.stacktrace}`)
    }

}


const globalTooltip = document.getElementById('global-tooltip')
window.addEventListener('mousemove', e => {
    if (!e.target) return

    let targetEl = null
    let targetText = ""
    targetText ||= e.target.getAttribute('placeholder')
    targetText ||= e.target.getAttribute('alt')
    targetText ||= e.target.getAttribute('data-tooltip')
    targetText ||= e.target.getAttribute('title')

    if (!targetText && e.target.parentElement) {
        targetText ||= e.target.parentElement.getAttribute('placeholder')
        targetText ||= e.target.parentElement.getAttribute('alt')
        targetText ||= e.target.parentElement.getAttribute('data-tooltip')
        targetText ||= e.target.parentElement.getAttribute('title')
    }

    if (e.target.getAttribute('popovertarget')) {
        targetEl = e.target
    }
    if (e.target.parentElement && e.target.parentElement.getAttribute('popovertarget'))
        targetEl = e.target.parentElement

    globalTooltip.innerText = targetText

    if (!targetEl || !targetText) return

    const rect = targetEl.getBoundingClientRect();
    globalTooltip.style.top = (rect.top + targetEl.clientHeight) + 'px'
    globalTooltip.style.left = (rect.left + targetEl.clientWidth) + 'px'

})

