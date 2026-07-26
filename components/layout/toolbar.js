
async function renderToolbarCommand(buttonId, noBounce = false) {

    // ignore miniPaint file menu
    if (!buttonId || buttonId.startsWith('main_menu')) return true;

    switch (buttonId) {

        case 'compile':
            // Requires the compilation toolchain scripts
            await DependencyLoader.loadModule('build');
            if (configuration.value === 'tools') await buildTools(window.toolsRepository);
            else if (configuration.value === 'qvms') await buildQVM(window.gameRepositor);
            else await buildClient(window.engineRepository);
            break;

        case 'new':
        case 'save':
            // File manipulation operations depend directly on the Ace workspace state
            await DependencyLoader.loadModule('editor');
            if (buttonId === 'new') newFile();
            if (buttonId === 'save') saveFile();
            break;

        case 'play':
        case 'viewport-frame':
            // Dynamically switches graphics rendering contexts based on user setting
            const preferredRenderer = SettingsManager.get('q3', 'prefferedRenderer');
            await DependencyLoader.loadModule(preferredRenderer);
            break;


        case 'map':
            await clickFile(document.getElementById('map').value, 1, false, true)
            break;

        case 'paint':
        case 'paint-container':
            // Lazy load the full layout styles and script package for miniPaint
            await DependencyLoader.loadModule('paint');
            break;

        case 'github-login':
            updatePlaceholder();
            break;

        case 'historyMenu':
        case 'fileHistory':
            {
                if (historyMenu.classList.contains('show')) {
                    historyMenu.classList.remove('show');
                } else {
                    historyMenu.classList.add('show');
                }
                const absolutePos = fileHistory.getBoundingClientRect()
                historyMenu.style.top = (absolutePos.top + absolutePos.height) + 'px'
                historyMenu.style.left = absolutePos.left + 'px'
                break
            }

        case 'back':
            NavHistory.back();
            break;

        case 'next':
            NavHistory.forward();
            break;

        case 'settings':
            await DependencyLoader.loadModule('editor');
            settings();
            break;

        case 'reload':
        case 'repository':
        case 'owner':
            localStorage.setItem('default_repository', owner.value + '/' + repository.value);
            break
        case 'configuration':
        case 'theme':
            // Automatically identify the config field from the element interaction and apply it
            for (const [mod, settings] of Object.entries(IMPORT_SETTINGS)) {
                const match = Object.values(settings).find(c => c.elementId === buttonId);
                if (match) {
                    const el = document.getElementById(buttonId);
                    const val = (el.type === 'checkbox') ? el.checked : el.value;
                    localStorage.setItem(match.key, val);
                    if (typeof match.set === 'function') match.set(val);
                    break;
                }
            }
            break;

    }

    // Auto-save setting file shifts if active view config targets modify variables
    const interactiveStateKeys = [
        'configuration', 'wasi', 'theme', 'spawn', 'map', 'branch',
        'repository', 'owner', 'keybinding', 'reload', 'layout'
    ];
    if (typeof currentSession !== 'undefined' && interactiveStateKeys.includes(buttonId)) {
        let filename = currentSession();
        if (filename?.includes('settings.json')) {
            settings();
        }
    }

    // Handoff presentation layout transformations directly down the execution chain
    renderTabsCommand(buttonId, noBounce);

    return true
}


document.getElementById('toolbar').addEventListener('change', async (e) => {
    const closest = e.target.closest('[id],[name],[href]')
    return renderToolbarCommand(
        closest.id || closest.name || closest.href?.split('#').pop())

});


document.getElementById('toolbar').addEventListener('click', async (e) => {
    const closest = e.target.closest('[id],[name],[href]')
    if (closest.nodeName.toUpperCase() === 'SELECT')
        return
    const buttonId = closest.id || closest.name || closest.href?.split('#').pop()
    if (buttonId === 'layout' || buttonId === 'fullscreen') {
        e.preventDefault()
    }
    return renderToolbarCommand(buttonId)
});


window.addEventListener('click', (e) => {
    const closest = e.target.closest('[id],[name],[href]')
    if (!closest) return
    const buttonId = closest.id || closest.name || closest.href?.split('#').pop()
    if (buttonId !== 'fileHistory' && buttonId !== 'historyMenu') {
        historyMenu.classList.remove('show');
    }

    if (e.target.classList.contains('remove-search')) {
        e.target.parentElement.parentElement.remove()
    }

    if (e.target.classList.contains('load-sample-audio')) {
        PKAudioEditor.engine.LoadSample()
    }
})





function toggleDropdown() {
    historyMenu.classList.toggle("show");
}

function selectHistory(element) {
    // Handle your undo/redo state logic here
    console.log("Selected action:", element.querySelector('strong').innerText);

    // Close menu after selection
    historyMenu.classList.remove("show");
}

