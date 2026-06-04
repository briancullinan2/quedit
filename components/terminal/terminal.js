const LINES_TO_SCROLLBACK = 5000

const terminalWrapper = document.getElementById('terminal-container')
const terminalContainer = document.getElementById('terminal')

// Internal state flags
let terminalLoaded = false;
let incrementalDebouncer = null;
let terminalsDebouncer = null;
let terminalPanelId = null;

// Setup active rendering frame limiters
window.terminalFrameLimiter = createFrameRater(25, (e, t, frame) => {
    e(t, frame);
});

// Instantiate Root Xterm Instance
const term = new Terminal({
    allowProposedApi: true,
    convertEol: true,
    scrollback: LINES_TO_SCROLLBACK,
    cursorBlink: true
});

// Open terminal session within the destination block
term.open(terminalContainer);
window.terminalLoaded = false;


// Utility to convert rgb/rgba strings to hex
function parseToHex(colorStr, backgroundStr = null) {
    if (!colorStr || typeof colorStr !== 'string') return colorStr;
    if (colorStr.startsWith('#')) return colorStr;

    const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!match) return colorStr;

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

    // OPTION A: If xterm fails to render transparency properly, 
    // flatten the color over the background color.
    if (backgroundStr && a < 1) {
        const bgMatch = backgroundStr.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (bgMatch) {
            const bgR = parseInt(bgMatch[1], 16);
            const bgG = parseInt(bgMatch[2], 16);
            const bgB = parseInt(bgMatch[3], 16);

            const blendedR = Math.round((1 - a) * bgR + a * r).toString(16).padStart(2, '0');
            const blendedG = Math.round((1 - a) * bgG + a * g).toString(16).padStart(2, '0');
            const blendedB = Math.round((1 - a) * bgB + a * b).toString(16).padStart(2, '0');
            return `#${blendedR}${blendedG}${blendedB}`;
        }
    }

    // OPTION B: Standard 8-digit hex conversion (#RRGGBBAA)
    const hexR = r.toString(16).padStart(2, '0');
    const hexG = g.toString(16).padStart(2, '0');
    const hexB = b.toString(16).padStart(2, '0');
    const hexA = Math.round(a * 255).toString(16).padStart(2, '0');

    return `#${hexR}${hexG}${hexB}`; // ${hexA}
}

/**
 * Pulls computed styles from the active editor container and mutates the xterm context theme layout.
 */
function syncThemeWithAce() {
    //const editorEle = document.querySelector('.ace_editor');
    //if (!editorEle) return;

    const style = getComputedStyle(document.body);
    const getAceVar = (name) => style.getPropertyValue(name).trim();

    const themeColors = {
        background: getAceVar('--ace-bg'),
        foreground: getAceVar('--ace-foreground'),
        gutter: getAceVar('--ace-gutter-bg'),
        selection: getAceVar('--ace-selection-bg'),
        pink: getAceVar('--ace-pink'),
        purple: getAceVar('--ace-purple'),
        blue: getAceVar('--ace-blue'),
        green: getAceVar('--ace-green')
    };

    const bgHex = parseToHex(themeColors.background);

    term.options.theme = {
        background: bgHex,
        foreground: parseToHex(themeColors.foreground),
        cursor: parseToHex(themeColors.foreground),
        selection: '#DEADBE',
        selectionBackground: '#DEADBE',
        selectionInactiveBackground: '#DEADBE',
        black: bgHex,
        white: parseToHex(themeColors.foreground),
        magenta: parseToHex(themeColors.pink),
        cyan: parseToHex(themeColors.purple),
        blue: parseToHex(themeColors.blue),
        green: parseToHex(themeColors.green),
        brightBlack: parseToHex(themeColors.gutter)
    };
}

/**
 * Forces standard rows and columns mapping algorithms across the container's responsive space.
 */
function forceFitLayout() {
    if (!terminalWrapper.classList.contains('not-hidden')) return;

    const core = term._core;
    const dims = core?._renderService?.dimensions;

    if (!dims || dims.css.cell.width === 0) {
        requestAnimationFrame(forceFitLayout);
        return;
    }

    const isFull = typeof fullScreenLayout === 'function' ? fullScreenLayout() : false;
    const targetWidth = isFull
        ? window.document.body.clientWidth - SCROLLBAR_WIDTH - 60
        : terminalWrapper.clientWidth - SCROLLBAR_WIDTH;

    const cols = Math.max(2, Math.floor(targetWidth / dims.css.cell.width), 120);

    const terminalsTabHeader = document.getElementById('terminals');
    const headerHeight = terminalsTabHeader ? terminalsTabHeader.clientHeight : 0;
    const targetHeight = (typeof getFullScreenFit === 'function' ? getFullScreenFit(0.99) : window.innerHeight) - headerHeight;

    const rows = Math.max(1, Math.floor(targetHeight / dims.css.cell.height));

    term.resize(cols, rows);
    renderMoved = true;
}

/**
 * Evaluates active browser tab focus, updating physical cursor blink routines safely.
 */
function refreshBlinkerState() {
    if (document.visibilityState !== 'visible') return;

    term.focus();
    const core = term._core;
    if (!term || !core) return;

    if (core._cursorBlinkContext) {
        core._cursorBlinkContext.restartInterval();
    }

    if (core.renderService) {
        core.renderService.refreshRows(0, term.rows - 1);
    } else if (term.refresh) {
        term.refresh(0, term.rows - 1);
    }
}


function tokenize(input) {
    // Regex matches words, or strings inside single/double quotes
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const tokens = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
        // match[1] is double-quoted content, match[2] is single-quoted
        // match[0] is the unquoted word
        tokens.push(match[1] || match[2] || match[0]);
    }
    return tokens;
}



function triggerIncrementalSave() {
    if (incrementalDebouncer) return;

    incrementalDebouncer = setTimeout(() => {
        if (typeof window.debounceTerminalStatus === 'function') {
            window.debounceTerminalStatus();
        }

        const searchInput = document.getElementById('search-terminal');
        if (searchInput && typeof window.scanVisibleViewport === 'function') {
            window.scanVisibleViewport(searchInput.value);
        }

        if (window.terminalLog) {
            const logs = window.terminalLog.slice(-LINES_TO_SAVE);
            localStorage.setItem('terminal_log', JSON.stringify(logs));
        }
        incrementalDebouncer = null;
    }, 1000);
}

const formatBytes = (bytes) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

/**
 * Switches viewport buffers according to chosen menu tab hashes.
 */
async function renderTerminalsCommand(panelId, noBounce = false) {
    if (!panelId || !TERMINALS.includes(panelId)) return;
    terminalPanelId = panelId;

    if (!noBounce && terminalsDebouncer) return;
    if (!noBounce) {
        terminalsDebouncer = setTimeout(() => {
            renderTerminalsCommand(terminalPanelId, true);
            terminalsDebouncer = null;
        }, 400);
        return;
    }

    const tabsHeader = document.getElementById('terminals');
    if (tabsHeader && tabsHeader.children[0]) {
        const buttons = tabsHeader.children[0].children;
        for (let button of buttons) {
            if (button.children[0]) button.children[0].classList.remove('active');
        }
    }

    const activeTarget = document.querySelector(`#terminals [href="#${panelId}"]`);
    if (activeTarget) activeTarget.classList.add('active');

    term.reset();

    if (panelId === 'soft') {
        term.options.scrollback = 0;
        window.cliRenderFrameLimiter = createFrameRater(10, captureRenderToTerminalCorner);
        window.cliRenderFrameLimiter.requestFrameUpdate();
        return;
    }

    if (window.terminalLog) {
        const errorBuffer = window.terminalLog
            .filter(l => panelId === 'all' || (l.text || l || '').match(/error/) || l.source === panelId || l.source?.includes(panelId))
            .map(l => (l.text || l || ''))
            .join('');
        term.write(errorBuffer);
    }
}

// Attach system listeners

const terminalsHeader = document.getElementById('terminals');
if (terminalsHeader) {
    terminalsHeader.addEventListener('click', (e) => {
        const targetHash = e.target.href?.split('#').pop();
        if (targetHash) renderTerminalsCommand(targetHash);
    });
}
