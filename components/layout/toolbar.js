
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

        case 'terminal':
        case 'terminal-container':
            // Spins up Virtual Terminal I/O environments
            await DependencyLoader.loadModule('terminal');
            break;
        case 'nunu':
            await DependencyLoader.loadModule('nunu');
            break;
        case 'paint':
        case 'paint-container':
            // Lazy load the full layout styles and script package for miniPaint
            await DependencyLoader.loadModule('paint');
            break;

        case 'github':
            updatePlaceholder();
            break;

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
        'repository', 'owner', 'keybinding', 'filename', 'reload'
    ];
    if (typeof currentSession !== 'undefined' && interactiveStateKeys.includes(buttonId)) {
        let filename = currentSession();
        if (filename?.includes('settings.json')) {
            settings();
        }
    }

    // Handoff presentation layout transformations directly down the execution chain
    renderTabsCommand(buttonId, noBounce);
}


document.getElementById('toolbar').addEventListener('change', async (e) => {
    return renderToolbarCommand(
        e.target.id || e.target.name || e.target.href?.split('#').pop())

});


document.getElementById('toolbar').addEventListener('click', async (e) => {
    if (e.target.nodeName.toUpperCase() === 'SELECT')
        return
    return renderToolbarCommand(
        e.target.id || e.target.name || e.target.href?.split('#').pop())

});

const globalTooltip = document.getElementById('global-tooltip')

window.addEventListener('mousemove', e => {
    if (!e.target) return

    let targetEl = null
    let targetText = ""

    // 1. ISOLATED CHECK: Look for attributes assigned dynamically by our native plugin layer
    const aceContainer = e.target.closest('.ace_editor');
    if (aceContainer) {
        // Pull error string markers
        targetText ||= aceContainer.getAttribute('data-compiler-error');

        // Pull code reference definition markers
        var navSymbol = aceContainer.getAttribute('data-navigation-target');
        if (navSymbol) {
            targetText = `Go to reference for definition: "${navSymbol}"`;
        }

        if (targetText) {
            targetEl = aceContainer;
        }
        return
    }

    // 2. STANDARD MINIPAINT DOM ATTR FALLBACKS
    if (!targetText) {
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
        if (e.target.parentElement && e.target.parentElement.getAttribute('popovertarget')) {
            targetEl = e.target.parentElement
        }
    }

    globalTooltip.innerText = targetText

    if (!targetEl || !targetText) {
        globalTooltip.style.display = 'none';
        globalTooltip.style.opacity = 0;
        globalTooltip.style.zIndex = -1;
        return;
    }

    globalTooltip.style.display = 'block';
    globalTooltip.style.opacity = 1;
    globalTooltip.style.visibility = 'visible';
    globalTooltip.style.zIndex = 1000;

    // Fluid position layout tracking for tracking paths cleanly under cursor coordinates
    if (aceContainer) {
        globalTooltip.style.top = (e.clientY + 15) + 'px';
        globalTooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - globalTooltip.clientWidth - 20) + 'px';
    } else {
        const rect = targetEl.getBoundingClientRect();
        globalTooltip.style.top = (rect.top + targetEl.clientHeight) + 'px'
        globalTooltip.style.left = Math.min(rect.left + targetEl.clientWidth, window.innerWidth - globalTooltip.clientWidth - 20) + 'px'
    }
});

