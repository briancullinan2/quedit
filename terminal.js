
//const DIFFERENTIATE_SAVED = false
const LINES_TO_SAVE = 1000
const LINES_TO_SCROLLBACK = 5000
const MAX_HISTORY_LENGTH = 20
const SCROLLBAR_WIDTH = 15
let terminalLoaded = false
const terminalContainer = document.getElementById('terminal')
const term = new Terminal({
    allowProposedApi: true,
    convertEol: true,
    scrollback: LINES_TO_SCROLLBACK, // Increase this from the default 1000
    cursorBlink: true,
    //overviewRulerWidth: true,
    //theme: {
    //    background: '#000000', // Matches your theme color background
    //}
});
term.open(terminalContainer);


let resizeDebounce = null
function resizeDebouncer() {
    if (resizeDebounce) return
    resizeDebounce = setTimeout(() => {
        forceFit();
        updateMaxLines()
        if (imageEditor.classList.contains('not-hidden')) {
            //window.GUI.render_main_gui()
            setTimeout(() => {
                //window.GUI.render_main_gui()
            }, 500)
        }
        resizeDebounce = null

    }, 500);
}



window.addEventListener('resize', resizeDebouncer);


const loadedHistory = JSON.parse(localStorage.getItem('history') || '[]')
const commandHistory = loadedHistory instanceof Array ? loadedHistory : []
const loadedLog = JSON.parse(localStorage.getItem('terminal_log') || '[]');
if (loadedLog.length === 0)
    writePrompt()

let lineCount = loadedLog.reduce((sum, l) => {
    const text = l.text || l; // handles both structured objects and raw strings
    return sum + (text.match(/\n/g) || []).length;
}, 0);


let lastPartialLine = ''

function terminalWrite(message, source, skipActualWrite = false) {
    if (!message) {
        debugger
        return
    }
    let render = message
    if (!message.endsWith('\n\r') && !message.endsWith('\n')) {
        let parts = message.split(/\n\r*/)
        lastPartialLine = parts.pop()
        render = parts.join('\n\r')
    }

    if (lastPartialLine) {
        lastPartialLine = ''
        render = lastPartialLine + render
    }

    lineCount += (message.match(/\n/g) || []).length
    loadedLog.push({ render: render.includes('\n') ? forceLineWrap(render, term.cols) : '', source: source, text: message, index: loadedLog.length, line: lineCount })

    if (!terminalLoaded) {
        return
    }

    if (!skipActualWrite)
        term.write(message)
}

function forceLineWrap(text, maxCharsPerRow = 80) {
    const rows = [];
    let currentLine = '';
    let visibleCount = 0;

    // Tokenize text into individual printable characters vs ANSI sequences
    // Matches standard ANSI codes: \x1b[...m
    const tokenRegex = /(\x1b\[[0-9;]*[a-zA-Z])|([\s\S])/g;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
        const [token, ansiCode, printableChar] = match;

        if (ansiCode) {
            // Invisible color tag—pass it into the line buffer for free
            currentLine += ansiCode;
        } else {
            // Printable text character
            if (printableChar === '\n') {
                // Hard break found naturally in stream, push and reset
                rows.push(currentLine);
                currentLine = '';
                visibleCount = 0;
            } else {
                currentLine += printableChar;
                visibleCount++;

                if (visibleCount >= maxCharsPerRow) {
                    // Artificial limit hit! Wrap to next segment line
                    rows.push(currentLine);
                    currentLine = '';
                    visibleCount = 0;
                }
            }
        }
    }

    // Flush remaining stray items in the text buffer
    if (currentLine.length > 0) {
        rows.push(currentLine);
    }

    return rows.join('\n\r');
}

let historyIndex = -1;
let currentLine = '';
let cursorPosition = 0;
let isModifierPressed


function getLastLineIsInput() {
    const buffer = term.buffer.active;
    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = endRow - 3;
    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            let lineStr = line.translateToString(true)
            if (lineStr === '> ' || lineStr === '>' || lineStr.trim() == '>')
                return true
        }
    }
    return false;
}


function getInternalTerminalLog() {
    const lines = [];
    const buffer = term.buffer.active;

    // Determine the range: last 100 lines relative to the viewport/insertion point
    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = Math.max(0, endRow - LINES_TO_SAVE);

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            // translateToString(true) trims trailing whitespace
            lines.push(line.translateToString(true));
        }
    }
    return lines;
}

function getInternalTerminalLogColored() {
    const lines = [];
    const buffer = term.buffer.active;

    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = Math.max(0, endRow - LINES_TO_SAVE);

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            let lineString = '';
            let currentFg = -1; // Track active ANSI state to optimize string size
            let currentBg = -1;

            // Iterate through every horizontal character slot in the terminal row
            for (let x = 0; x < line.length; x++) {
                const cell = line.getCell(x);
                if (!cell) continue;

                const char = cell.getChars();
                const fg = cell.getFgColor();
                const bg = cell.getBgColor();

                // If colors changed, inject the correct ANSI control sequence
                if (fg !== currentFg || bg !== currentBg) {
                    let ansiSequence = '\x1b[0m'; // Start with a clear reset

                    // Reconstruct 256-color or standard foreground if explicit
                    if (cell.isFgPalette() || cell.isFgRGB()) {
                        ansiSequence += `\x1b[38;5;${fg}m`;
                    } else if (fg >= 0 && fg < 16) {
                        // Standard 16 terminal colors fallback
                        ansiSequence += `\x1b[${fg < 8 ? fg + 30 : fg + 82}m`;
                    }

                    // Reconstruct background colors
                    if (cell.isBgPalette() || cell.isBgRGB()) {
                        ansiSequence += `\x1b[48;5;${bg}m`;
                    } else if (bg >= 0 && bg < 16) {
                        ansiSequence += `\x1b[${bg < 8 ? bg + 40 : bg + 92}m`;
                    }

                    lineString += ansiSequence;
                    currentFg = fg;
                    currentBg = bg;
                }

                lineString += char;
            }

            // Always add a final reset tag to the end of a row line so styles don't bleed
            if (currentFg !== -1 || currentBg !== -1) {
                lineString += '\x1b[0m';
            }

            // Trim trailing empty spaces matching translateToString(true)'s behavior
            // while making sure we don't accidentally cut our trailing ANSI reset tag
            const cleanLine = lineString.replace(/\s+(\x1b\[0m)?$/, '$1');
            lines.push(cleanLine);
        }
    }
    return lines;
}


let incrementalDebouncer = null
async function triggerIncrementalSave() {
    if (incrementalDebouncer) {
        return
    }
    incrementalDebouncer = setTimeout(() => {
        debounceTerminalStatus()
        performSharedBufferScanInternal(searchTerminal.value)
        const lines = loadedLog.slice(-LINES_TO_SAVE)
        //const last1000 = DIFFERENTIATE_SAVED 
        //? getInternalTerminalLog() : getInternalTerminalLogColored();
        localStorage.setItem('terminal_log', JSON.stringify(lines));
        incrementalDebouncer = null
    }, 1000)
}

let searchIndex = -1;
let searchResults = [];
let debounceTimeout;

const searchTerminal = document.getElementById('search-terminal');

// Helper to clear existing search highlights or state
function clearSearch() {
    searchIndex = -1;
    searchResults = [];
    searchAddonMarkers.forEach(decoration => {
        // This cleans up both the decoration and the associated marker
        decoration.dispose();
    });
    searchAddonMarkers = [];
}

searchTerminal.addEventListener('keydown', triggerFind);


function triggerFind(e) {
    if (e && e.key === 'Enter') {
        e.preventDefault();

    }

    // 2. Debounced search for real-time results (optional, cancels on new input)
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        if (searchTerminal.value.length > 2) {

            performSharedBufferScanInternal(searchTerminal.value);


            const termToFind = searchTerminal.value;
            if (!termToFind) return;

            if (searchResults.length > 0) {
                if (e && e.key === 'Enter' && e.shiftKey) {
                    // Move Backwards
                    searchIndex = (searchIndex <= 0) ? searchResults.length - 1 : searchIndex - 1;
                } else if (e && e.key === 'Enter') {
                    // Move Forwards
                    searchIndex = (searchIndex >= searchResults.length - 1) ? 0 : searchIndex + 1;
                } else {
                    // Find result nearest to current scroll view
                    const currentScroll = searchIndex > -1
                        && searchResults[searchIndex]
                        ? searchResults[searchIndex].line
                        : term.buffer.active.baseY;

                    // Find the first result that is at or after the current scroll position
                    let nearest = searchResults.findIndex(res => res.line >= currentScroll);

                    // If no results are below the current scroll, wrap to the last result 
                    // or keep it at the top (0) depending on preference.
                    searchIndex = (nearest !== -1) ? nearest : 0;
                }

                // Scroll the terminal display buffer to the result
                // xterm.js rows are indexed from the top of the buffer
                term.scrollToLine(searchResults[searchIndex].line);
            }

        } else {
            clearSearch();
        }




        if (searchTerminal.value.length <= 2)
            searchTerminal.parentElement.setAttribute('placeholder', 'Search...')
        if (searchResults.length === 0)
            searchTerminal.parentElement.setAttribute('placeholder', 'Search (0 results)...')
        else
            searchTerminal.parentElement.setAttribute('placeholder', 'Search (' + (searchIndex + 1) + '/' + searchResults.length + ')...')

    }, 250);
}

// Shared Global Decoration Tracking Repositories
let searchAddonMarkers = [];
let fileUnderlineMarkers = [];
let globalScanDebounceTimer = null;


function performSharedBufferScanInternal(termToSearch, caseSensitive = false) {
    // 1. Wipe out all previous marker decoration nodes cleanly
    searchAddonMarkers.forEach(m => m.dispose());
    fileUnderlineMarkers.forEach(m => m.dispose());
    searchAddonMarkers = [];
    fileUnderlineMarkers = [];
    searchResults = [];

    const buffer = term.buffer.active;
    const activeRowMarkerOffset = buffer.baseY + buffer.cursorY;

    // 2. Setup Regex Parsers
    let searchRegex = null;
    if (termToSearch && termToSearch.trim().length > 0) {
        const flags = caseSensitive ? 'g' : 'gi';
        searchRegex = new RegExp(termToSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }

    // Your working file pattern logic
    const fileRegex = /([\w\d\._\-\/]+\.\w+)\b(?::(\d+))?(?::(\d+))?/g;

    // 3. Scan Entire Active Terminal Buffer Length Row-by-Row
    for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (!line) continue;

        const lineText = line.translateToString(true);
        const relativeMarkerDistance = i - activeRowMarkerOffset;

        // ==========================================
        // PASS A: Extract & Underline Valid File Paths
        // ==========================================
        let fileMatch;
        fileRegex.lastIndex = 0; // Reset state tracker for global flag loop
        while ((fileMatch = fileRegex.exec(lineText)) !== null) {
            const x = fileMatch.index;
            const length = fileMatch[0].length;

            const marker = term.registerMarker(relativeMarkerDistance);
            if (marker) {
                const decoration = term.registerDecoration({
                    marker,
                    x,
                    width: length,
                    layer: 'top',
                    //backgroundColor: 'rgba(0, 0, 0, 0)'
                });

                if (decoration) {
                    decoration.onRender(element => {
                        // Keeps link targets completely clickable underneath
                        element.style.pointerEvents = 'none';
                        element.classList.add('terminal-file-underline');
                    });
                    fileUnderlineMarkers.push(decoration);
                }
            }
        }

        // ==========================================
        // PASS B: Execute Literal Text Search Highlighting
        // ==========================================
        if (searchRegex) {
            let searchMatch;
            searchRegex.lastIndex = 0;
            const themeColors = getAceThemeColors();

            while ((searchMatch = searchRegex.exec(lineText)) !== null) {
                const x = searchMatch.index;
                const length = searchMatch[0].length;

                const marker = term.registerMarker(relativeMarkerDistance);
                if (marker) {
                    const decoration = term.registerDecoration({
                        marker,
                        x,
                        width: length,
                        layer: 'top',
                        backgroundColor: themeColors.foreground,
                        foregroundColor: themeColors.background,
                    });

                    if (decoration) {
                        decoration.onRender(element => {
                            element.style.pointerEvents = 'none';
                            element.classList.add('terminal-search-highlight');
                        });
                        searchAddonMarkers.push(decoration);
                    }
                }
                searchResults.push({ line: i, x: x + 1 });
            }
        }
    }
}



function refreshBlinker() {
    if (document.visibilityState === 'visible') {
        // Force xterm to think it is focused
        term.focus();

        if (!term || !term._core) return;

        if (document.visibilityState === 'visible') {
            // 2. Force internal focus state
            term.focus();

            // 3. Restart the blink interval timer
            if (term._core._cursorBlinkContext) {
                term._core._cursorBlinkContext.restartInterval();
            }

            // 4. THE FIX: Use the public-facing or stable internal refresh
            // This forces the terminal to re-evaluate what needs to be drawn
            if (term._core.renderService) {
                // This triggers a full refresh of all layers safely
                term._core.renderService.refreshRows(0, term.rows - 1);
            } else if (term.refresh) {
                // Fallback for older versions
                term.refresh(0, term.rows - 1);
            }
        }
    }
};

// 1. Watch for browser tab/window switching
document.addEventListener('visibilitychange', refreshBlinker);

// 2. Watch for clicks back into the window from other apps
window.addEventListener('focus', refreshBlinker);
terminalContainer.addEventListener('click', refreshBlinker);
terminalContainer.addEventListener('focus', refreshBlinker);

// 3. Handle the 'stuck' blinker when focus shifts to other UI elements (like Ace)
// We use a slight delay to allow the focus transition to complete
window.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            // If we are still visible, we want the cursor to keep blinking 
            // even if the terminal technically lost focus to a sidebar
            refreshBlinker();
            term.clearSelection();
        }
    }, 100);
});




function highlightWithAnsi(x, y, text) {
    term.write(`\x1b[${y};${x}H\x1b[7m${text}\x1b[27m`);
}

/**
 * Uses ANSI Escape Codes to jump to a position and "overprint" with inverted colors
 */
function highlightMatch(x, y, text) {
    // Save cursor position
    term.write('\x1b[s');

    // Move to Y;X, apply Inverse (7m), write text, Reset (0m)
    term.write(`\x1b[${y};${x}H\x1b[7m${text}\x1b[0m`);

    // Restore cursor position
    term.write('\x1b[u');
}


term.attachCustomKeyEventHandler((arg) => {

    debounceTerminalStatus()

    if (arg.type === "keydown" || arg.type === "keyup")
        isModifierPressed = arg.ctrlKey || arg.metaKey;

    if (arg.type === "keydown") {
        // Check for Ctrl (Windows/Linux) or Cmd (Mac)


        if (isModifierPressed && arg.code === "KeyF") {
            if (arg.preventDefault) arg.preventDefault();
            searchTerminal.focus()
            let selection = term.getSelection()
            if (selection)
                searchTerminal.value = selection
            triggerFind()
        }


        // --- Ctrl+C: Copy ---
        if (isModifierPressed && arg.code === "KeyC") {
            const selection = term.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection);
                return false;
            }
            triggerIncrementalSave()
            term.write('\n\rCTRL+C')

            TERMINATE = true
            if (building) {
                term.write('\n\rStopping build...')
            }
            writePrompt()
            cursorPosition = 0
            currentLine = ''
        }


        if (arg.code === "Backspace") {
            if (arg.preventDefault) arg.preventDefault();

            // Use cursorPosition as the source of truth for logic
            if (cursorPosition > 0) {
                // 1. Logic: Slice the string at the current cursor
                const leftSide = currentLine.slice(0, cursorPosition - 1);
                const rightSide = currentLine.slice(cursorPosition);
                currentLine = leftSide + rightSide;
                cursorPosition--;

                // 2. Terminal View: Move back and redraw
                const cursorX = term.buffer.active.cursorX;

                if (cursorX === 0) {
                    // Case: We are at the start of a wrapped line, move UP
                    // \x1b[A (Up), \x1b[G (Column 0), \x1b[nC (Move right to end)
                    term.write(`\x1b[A\x1b[${term.cols}C`);
                } else {
                    // Case: Standard movement back
                    term.write('\b');
                }

                // 3. The "Fancy" Splicing Redraw
                // \x1b[s: Save position
                // \x1b[K: Erase to end of line (kills ghost characters)
                // \x1b[u: Restore position
                term.write('\x1b[s');
                term.write(rightSide + '\x1b[K');
                term.write('\x1b[u');
            }

            return false;
        }

        // --- Ctrl+V: Paste ---
        if (isModifierPressed && arg.code === "KeyV") {
            if (arg.preventDefault) arg.preventDefault();

            navigator.clipboard.readText().then(text => {
                if (text) {
                    // Filter the text to match your existing "Standard typing" 
                    // range (0x20 to 0x7e) to prevent control characters from
                    // corrupting your currentLine buffer.
                    const filtered = text.split('').filter(c =>
                        c >= String.fromCharCode(0x20) && c <= String.fromCharCode(0x7e)
                    ).join('');

                    cursorPosition += filtered.length
                    currentLine += filtered;
                    term.write(filtered);
                }
            }).catch(err => {
                // Clipboard access might be denied by the browser
                console.error('Paste failed: ', err);
            });
            return false; // Prevent xterm from seeing the keypress
        }
    }
    return true;
});


let alreadyWroteDetached = false;

function specialWrite(msg) {
    if (!msg) return;
    if (msg.includes('memory access out of bounds')) {
        needsHeaders = true
    }

    if (!runningCommand && !detachedConsole && !alreadyWroteDetached) {
        detachedConsole = true
        PREAMBLE = WARN_PREAMBLE
        console.warn('\n\rDetached console, awaiting terminate...')
    }
    let skipTerminal = false
    if (msg.includes('Assertion failed: lookup.node')) {
        skipTerminal = true
    }
    if (!skipTerminal)
        terminalWrite(msg)
    triggerIncrementalSave()
}


term.onData(async data => {
    switch (data) {

        case '\r': // Enter
            if (currentLine.trim().length > 0) {
                commandHistory.push(currentLine);
                terminalWrite(currentLine + '\n\r', 'user-input', true)

                // If we exceed 10, remove the difference from the beginning
                if (commandHistory.length > MAX_HISTORY_LENGTH) {
                    // .splice(start, deleteCount) 
                    commandHistory.splice(0, commandHistory.length - 10);
                }

                localStorage.setItem('history', JSON.stringify(commandHistory));
            }

            triggerIncrementalSave()

            try {

                lastNewLine = true
                historyIndex = -1;
                let thisLine = currentLine;
                currentLine = '';
                cursorPosition = 0;
                term.write('\n\r')

                await handleCommand(thisLine);
            } catch (e) {
                terminalWrite(e.toString() + '\r\n' + (e.stack || e.stacktrace) + '\r\n');
            }

            writePrompt()

            break;

        /*
    case '\u007f': // Backspace (DEL)
        if (cursorPosition > 0) {
            const leftSide = currentLine.slice(0, cursorPosition - 1);
            const rightSide = currentLine.slice(cursorPosition);
            currentLine = leftSide + rightSide;
            cursorPosition--;

            term.write('\b'); // Move back to the char we want to erase
            term.write('\x1b[s'); // Save position
            // Write the rest of the line + \x1b[K to wipe the old trailing char
            term.write(rightSide + '\x1b[K');
            term.write('\x1b[u'); // Restore to the gap
        }
        break;
        */

        case '\u001b[A': // Up Arrow
            if (commandHistory.length > 0) {
                if (currentLine.trim().length > 0)
                    commandHistory[historyIndex] = currentLine
                if (historyIndex === -1) historyIndex = commandHistory.length - 1;
                else if (historyIndex > 0) historyIndex--;
                updateLineFromHistory();
            }
            break;

        case '\u001b[B': // Down Arrow
            if (historyIndex !== -1) {
                if (currentLine.trim().length > 0)
                    commandHistory[historyIndex] = currentLine
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    updateLineFromHistory();
                } else {
                    historyIndex = -1;
                    updateLineFromHistory(commandHistory[-1] || ''); // Clear if we go past the end
                }
            } else {

            }
            break;

        case '\u001b[D': // Left Arrow
            if (cursorPosition > 0) {
                cursorPosition--;
                term.write('\u001b[D'); // Move terminal cursor left
            }
            break;

        case '\u001b[C': // Right Arrow
            if (cursorPosition < currentLine.length) {
                cursorPosition++;
                term.write('\u001b[C'); // Move terminal cursor right
            }
            break;

        case '\u001b[H': // Home (May also be \u001b[1~ depending on terminal mode)
        case '\u001bOH':
            if (cursorPosition > 0) {
                // Move back by cursorPosition steps
                term.write(`\u001b[${cursorPosition}D`);
                cursorPosition = 0;
            }
            break;

        case '\u001b[F': // End (May also be \u001b[4~)
        case '\u001bOF':
            if (cursorPosition < currentLine.length) {
                // Move forward to the end of the line
                term.write(`\u001b[${currentLine.length - cursorPosition}C`);
                cursorPosition = currentLine.length;
            }
            break;

        case '\u001b[5~': // Page Up
            // Usually scrolls the terminal buffer
            term.scrollLines(-Math.floor(term.rows / 2));
            break;

        case '\u001b[6~': // Page Down
            // Usually scrolls the terminal buffer
            term.scrollLines(Math.floor(term.rows / 2));
            break;

        default: // Standard typing
            if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e)) {
                const leftSide = currentLine.slice(0, cursorPosition);
                const rightSide = currentLine.slice(cursorPosition);
                currentLine = leftSide + data + rightSide;
                cursorPosition += data.length;

                if (rightSide.length === 0) {
                    term.write(data);
                } else {
                    // REDRAW with cleaning
                    term.write(data + rightSide);
                    // Move back exactly rightSide.length
                    term.write(`\x1b[${rightSide.length}D`);

                    // Optional: If you see flickering, wrap the above in save/restore 
                    // and add \x1b[K at the end of the rightSide write.
                }
            }
    }
    debounceTerminalStatus()
});


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


const formatBytes = (bytes) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};



function forceFit() {
    // 1. Get the internal dimension service (where Xterm 5 stores sizing)
    const core = term._core;
    const dims = core._renderService.dimensions;

    if (!dims || dims.css.cell.width === 0) {
        // The renderer isn't ready yet—try again in the next frame
        requestAnimationFrame(forceFit);
        return;
    }

    const isFull = fullScreenLayout()
    let width = isFull
        ? window.document.body.clientWidth - SCROLLBAR_WIDTH - 60
        : document.getElementById('terminal-container').clientWidth - SCROLLBAR_WIDTH;
    const cols = Math.max(2, Math.floor(width / dims.css.cell.width), 120);
    //if (isFull) {
    //    term.resize(cols, term.buffer.active.baseY + term.rows);
    //    return
    //}
    const height = getFullScreenFit(1.01)
        // isFull ? 0.99 : 0.25)
        - document.getElementById('terminals').clientHeight
    const rows = Math.max(1, Math.floor(height / dims.css.cell.height));

    // 3. Force the resize
    term.resize(cols, rows);
}



term.onRender(() => {
    // Now the core services are guaranteed to exist
    //setTimeout(() => forceFit(term, container), 200);
});



function renderTerminalsCommand(panelId) {

    if (!panelId) return

    let buttons = document.getElementById('terminals').children[0].children

    for (let button of buttons) {
        button.children[0].classList.remove('active')
    }

    document.querySelector(`#terminals [href="#${panelId}"]`).classList.add('active')

}


document.getElementById('terminals').addEventListener('click', async (e) => {

    renderTerminalsCommand(e.target.href?.split('#').pop())

});


function extractFiles(col, row) {
    const offsets = [-2, -1, 0, 2];
    const lines = offsets.map(off => ({
        off,
        text: term.buffer.active.getLine(row + off)?.translateToString(true) || ""
    }));

    // 1. Build the full string
    const lineText = lines.map(l => l.text).join('\n\r');

    // 2. Calculate the targetIndex (where the click happened in lineText)
    let targetIndex = 0;
    for (const line of lines) {
        if (line.off === 0) { // Offset 0 is the actual 'row' clicked
            targetIndex += col;
            break;
        }
        // Add the length of the line and the 2 characters for '\n\r'
        targetIndex += line.text.length + 2;
    }

    // 3. Match all and sort
    const filePattern = /([\w\d\._\-\/]+\.\w+)\b(?::(\d+))?(?::(\d+))?/g;
    const matches = [
        ...lineText.matchAll(filePattern)].map(m => Object.assign({
            path: m[1],
            line: m[2] ? parseInt(m[2], 10) : null,
            index: m.index,
            center: m.index + (m[0].length / 2), // Middle of the match for better accuracy
            isFallback: false
        }, lines[(lineText.substring(0, m.index).match(/\n/g) || []).length]));


    const sortedMatches = matches
        .map(match => ({
            ...match,
            distance: Math.abs(match.center - targetIndex)
        }))
        .sort((a, b) => a.distance - b.distance);

    // 2. Return the sorted list (closest file is at index 0)
    if (sortedMatches.length > 0)
        return sortedMatches;

    return [{
        off: 0,
        text: lines[2].line?.trim(),
        path: null,
        line: null,
        index: targetIndex - col, // Start of the clicked line
        center: targetIndex,      // Point of the click
        distance: 0,              // It's the only option, so distance is 0
        isFallback: true          // Useful flag for your UI
    }]

}


function detectTerminalEvents(event, x, y, updateStatus = true) {
    const rect = terminalContainer.getBoundingClientRect();
    if (event) {
        x ||= event.clientX - rect.left;
        y ||= event.clientY - rect.top;
    }

    const col = Math.floor(x / term._core._renderService.dimensions.css.cell.width);
    const row = Math.floor(y / term._core._renderService.dimensions.css.cell.height) + term.buffer.active.viewportY;

    // Only update cursor if the click is on the "active" input line
    const activeRow = term.buffer.active.baseY + term.buffer.active.cursorY;

    const files = extractFiles(col, row);
    const lineText = files[0]?.text?.trim()
        || term.buffer.active.getLine(row)?.translateToString(true)

    let filePath
    let lineNumber
    let isFallback
    if (lineText && files.length > 0) {
        // 3. Regex to find "filename.ext:line" or "filename.ext:line:col"
        // This matches standard compiler/error output formats
        const filePattern = /([\w\d\._\-\/]+\.\w+)\b(?::(\d+))?(?::(\d+))?[\n\r\s$]*/;
        const match = lineText.match(filePattern);
        filePath = files[0].path
        lineNumber = files[0].line
        isFallback = files[0].isFallback
    }


    let history = null

    if (lineText) {
        if ((history = commandHistory
            .findLastIndex(i => i.trim().length > 0 && i.trim() === lineText.trim()))
            && history >= y
            || (history = commandHistory
                .findLastIndex(i => i.trim().length > 0 && i.trim().includes(lineText.trim())))
            && history >= y
            || (history = commandHistory.
                findLastIndex(i => i.trim().length > 0 && lineText.trim().includes(i.trim())))
            && history >= y
        ) {
            // if they click on a previous command with ctrl button, insert it into the current line
        }
    }

    if (updateStatus) {
        updateTerminalStatus(event, x, y, activeRow, col, row, lineText, filePath, lineNumber, isFallback, history)
    }


    return {
        event,
        x, y, activeRow,
        col, row,
        lineText, filePath, lineNumber,
        isFallback,
        history,
    }

}


let debounceTerminalMouse = null
let previousUpdate = null
async function debounceTerminalStatus(event) {

    //if (!event.ctrlKey && !event.metaKey && !isModifierPressed) return false;



    const rect = terminalContainer.getBoundingClientRect();
    if (previousUpdate && event) {
        previousUpdate.event = event
        previousUpdate.x = event.clientX - rect.left;
        previousUpdate.y = event.clientY - rect.top;
    }

    if (debounceTerminalMouse) return false

    debounceTerminalMouse = setTimeout(() => {

        if (!previousUpdate && !event) {
            // do nothing
        }
        else if (!previousUpdate) {
            previousUpdate = detectTerminalEvents(
                event, event.clientX - rect.left, event.clientY - rect.top)
        } else {
            previousUpdate = detectTerminalEvents(
                previousUpdate.event, previousUpdate.x, previousUpdate.y)
        }


        debounceTerminalMouse = null
    }, 200)


    return false
}

function updateTerminalStatus(event, x, y, activeRow, col, row, lineText, filePath, lineNumber, isFallback, history) {

    statusBar.innerText = `Terminal: Mouse: ${col}x${row}, `
        + `Cursor: ${cursorPosition}x${activeRow}, `
        + (history !== null && history !== -1 ? `History: ${history}, ` : '')
        + (filePath && !isFallback ? lineNumber !== null ?
            `File: ${filePath}, Line: ${lineNumber}`
            : `File: ${filePath}`
            : '')

}

terminalContainer.addEventListener('mousemove', debounceTerminalStatus);




terminalContainer.addEventListener('mousedown', async (event) => {

    if (!event.ctrlKey && !event.metaKey && !isModifierPressed) return false;

    event.preventDefault()
    const rect = terminalContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const {
        activeRow, col, row,
        lineText, filePath, lineNumber,
        isFallback, history,
    } = detectTerminalEvents(event, x, y)

    if (filePath) {
        writeLog(`File: ${filePath}, Line: ${lineNumber}, Fallback: ${isFallback}`);
    }


    if (row === activeRow) {
        changeCursorPosition(event, x, y, activeRow, col, row, lineText, filePath, lineNumber)
    } else if (history !== null && history !== -1) {
        historyIndex = history
        updateLineFromHistory()
    } else if (filePath && !isFallback) {
        await clickTerminalFile(event, x, y, activeRow, col, row, lineText, filePath, lineNumber)
    }

    return false
});


function changeCursorPosition(event, x, y, activeRow, col, row, lineText, filePath, lineNumber) {
    if (row === activeRow) {
        const promptLength = 2; // Adjust based on your actual prompt (e.g., "> ")
        let newPos = col - promptLength;

        // Constrain the position within the bounds of the actual text
        newPos = Math.max(0, Math.min(newPos, currentLine.length));

        // Sync internal state
        cursorPosition = newPos;

        // Move terminal cursor physically
        // \x1b[G moves to col 0, then we move right by the prompt + index
        term.write(`\x1b[G\x1b[${promptLength + cursorPosition}C`);
    }
}


let terminalClickDebouncer = null

async function clickTerminalFile(event, x, y, activeRow, col, row, lineText, filePath, lineNumber, noBounce = false) {

    let selected
    let dbFile

    if (terminalClickDebouncer) {
        clearTimeout(terminalClickDebouncer)
    }
    if (!noBounce) {
        terminalClickDebouncer = setTimeout(() => clickTerminalFile(event, x, y, activeRow, col, row, lineText, filePath, lineNumber, true), 500)
        return
    }


    // do this once now to full reset
    hideOpenPanels()
    latestPanelId = previousPanelId = 'editor' // switch from terminal automatically

    if (!dbFile && files[engineRepo]) {
        dbFile = files[engineRepo][filePath]
        if (dbFile) {
            trees[engineRepo].values = [dbFile.sha];
            selected = engineRepo
            renderTabsCommand('filelist', true, false)
        }
    }
    if (!dbFile && files[gameRepo]) {
        dbFile = files[gameRepo][filePath]
        if (dbFile) {
            trees[gameRepo].values = [dbFile.sha];
            selected = gameRepo
            renderTabsCommand('gamelist', true, false)
        }
    }
    if (!dbFile && files[assetRepo]) {
        dbFile = files[assetRepo][filePath]
        if (dbFile) {
            trees[assetRepo].values = [dbFile.sha];
            selected = assetRepo
            renderTabsCommand('assetlist', true, false)
        }
    }

    if (!dbFile) {
        if (!files[toolsRepo]) {
            let parts = toolsRepo.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }
        if (files[toolsRepo][filePath]) {
            selected = toolsRepo
            dbFile = files[toolsRepo][filePath]
        }
    }


    if (!dbFile) {
        if (!files[toolsRepo2]) {
            let parts = toolsRepo2.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }
        if (files[toolsRepo2][filePath]) {

            selected = toolsRepo2
            dbFile = files[toolsRepo2][filePath]
        }
    }


    // TODO: FS.virtual for IDB access and database
    if (!dbFile) {

        dbFile = FS.virtual[filePath]
        let databases = await getDatabaseMetadata()
        let item
        for (item of databases) {

            if (trees['#database'].nodesById[item.key + '/' + filePath]) {
                dbFile = trees['#database'].nodesById[item.key + '/' + filePath]
                selected = item.key
                break;
            }

            let record = await getRecord(DB_STORE_NAME, filePath, item.key)
            if (record) {
                dbFile = trees['#database'].nodesById[item.key + '/' + filePath]
                    = FS.virtual[filePath] = record
                selected = item.key
                break;
            }
        }

        if (dbFile) {
            renderTabsCommand('database', true, false)
            trees['#database'].values = [item.key];
        }

    }

    if (!dbFile || !selected) {
        writeLog('File not found: ' + filePath)
        return
    }

    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (!dbFile) dbFile = files[selected][filePath]

    if (!dbFile) return

    currentOpenFileId = dbFile.sha

    await openFile(ownerName, repoName, filePath, dbFile.sha, true /* record history */, false /* show file list */)
    setTimeout(() => {
        editorContainer.classList.remove('hidden')
        editorContainer.classList.add('not-hidden')

        if (lineNumber)
            editor.gotoLine(lineNumber, 0, true);
        editor.focus();
        latestPanelId = 'editor'
    }, 500)
    resizeDebouncer()
}


function writePrompt() {
    term.write('\n\r> ')
}




function updateLineFromHistory(specificValue = null) {
    const buffer = term.buffer.active
    //let currentLine = buffer.getLine(buffer.baseY + buffer.cursorY)

    if (currentLine === '> ' + commandHistory[historyIndex]) {
        debugger
    }
    term.write('\r\x1b[K\x1b[A');
    writePrompt()

    // 2. Update the buffer
    currentLine = specificValue !== null ? specificValue : commandHistory[historyIndex];

    // 3. Write the new line
    term.write(currentLine);
    cursorPosition = currentLine.length

}

