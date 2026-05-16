const LINES_TO_SAVE = 1000
const LINES_TO_SCROLLBACK = 5000
const MAX_HISTORY_LENGTH = 20
const preterm = []
let terminalLoaded = false
var term = new Terminal({
    allowProposedApi: true,
    convertEol: true,
    scrollback: LINES_TO_SCROLLBACK, // Increase this from the default 1000
    cursorBlink: true,
});
term.open(document.getElementById('terminal'));
term.write('\n\r')

const container = document.getElementById('terminal');



let resizeDebounce = null
window.addEventListener('resize', () => {
    if (resizeDebounce) return
    resizeDebounce = setTimeout(() => {
        forceFit(term, container);
        updateMaxLines()
    }, 500);
});


const loadedHistory = JSON.parse(localStorage.getItem('history') || '[]')
const commandHistory = loadedHistory instanceof Array ? loadedHistory : []
const loadedLog = JSON.parse(localStorage.getItem('terminal_log') || '[]');


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


let incrementalDebouncer = null
async function triggerIncrementalSave() {
    if (incrementalDebouncer) {
        return
    }
    incrementalDebouncer = setTimeout(() => {
        const last1000 = getInternalTerminalLog();
        localStorage.setItem('terminal_log', JSON.stringify(last1000));
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

            performSearch(searchTerminal.value);


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


let searchAddonMarkers = [];
function performSearch(termToSearch, caseSensitive = false) {
    searchAddonMarkers.forEach(m => m.dispose());
    searchAddonMarkers = [];
    searchResults = [];

    const themeColors = getAceThemeColors();
    const buffer = term.buffer.active;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(termToSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    // Scan the entire buffer length
    for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (!line) continue;

        const lineText = line.translateToString();
        let match;

        while ((match = regex.exec(lineText)) !== null) {
            const x = match.index;
            const length = match[0].length;

            // CORRECT OFFSET CALCULATION:
            // registerMarker takes the distance from the current bottom of the buffer
            const marker = term.registerMarker(i - (buffer.baseY + buffer.cursorY));

            if (marker) {
                const decoration = term.registerDecoration({
                    marker,
                    x,
                    width: length,
                    layer: 'top',
                    backgroundColor: themeColors.foreground,
                    foregroundColor: themeColors.background,
                });

                decoration.onRender(element => {
                    element.style.pointerEvents = 'none';
                    element.classList.add('terminal-search-highlight');
                });

                searchAddonMarkers.push(decoration);
            }

            searchResults.push({ line: i, x: x + 1 });
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

// 3. Handle the 'stuck' blinker when focus shifts to other UI elements (like Ace)
// We use a slight delay to allow the focus transition to complete
window.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            // If we are still visible, we want the cursor to keep blinking 
            // even if the terminal technically lost focus to a sidebar
            refreshBlinker();
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



    if (arg.type === "keydown") {
        // Check for Ctrl (Windows/Linux) or Cmd (Mac)
        isModifierPressed = arg.ctrlKey || arg.metaKey;


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
            TERMINATE = true
            term.write('\n\rCTRL+C\n\r> ')
            cursorPosition = 0
            currentLine = ''
            debugger
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

let shadowLogBuffer = ""; // Stores the current partial line from background
let lastNewLine = true;   // Tracks if the last write finished a line


function specialWrite(msg) {
    if (!msg) return;
    if (msg.includes('memory access out of bounds')) {
        needsHeaders = true
    }

    if(!terminalLoaded) {
        preterm.push(msg)
        return
    }

    // 1. Hide Cursor & Move to Start of Prompt Block
    const promptWithCommand = '> ' + currentLine;
    const numLines = Math.ceil(promptWithCommand.length / term.cols) || 1;
    //term.write('\r\x1b[A');
    //term.write(shadowLogBuffer);
    term.write(msg)
    shadowLogBuffer = msg.split('\n').pop()
    // 6. Redraw the Prompt
    //term.write('\n\r')
    //term.write(promptWithCommand);

    // 7. Restore Cursor Position
    const totalOffset = 2 + cursorPosition;
    const targetLineFromTop = Math.floor(totalOffset / term.cols);
    const targetCol = totalOffset % term.cols;
    const moveUp = (numLines - 1) - targetLineFromTop;

    //if (moveUp > 0) term.write(`\x1b[${moveUp}A`);
    //term.write(`\r\x1b[${targetCol + 1}G\x1b[?25h`);
}


term.onData(async data => {
    switch (data) {

        case '\r': // Enter
            if (currentLine.trim().length > 0) {
                commandHistory.push(currentLine);

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
                term.write(e.toString() + '\r\n' + (e.stack || e.stacktrace) + '\r\n');
            }

            term.write('\r\n> ');

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
                commandHistory[historyIndex] = currentLine
                if (historyIndex === -1) historyIndex = commandHistory.length - 1;
                else if (historyIndex > 0) historyIndex--;
                updateLineFromHistory();
            }
            break;

        case '\u001b[B': // Down Arrow
            if (historyIndex !== -1) {
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


// Initial prompt
//term.write('> ');


function forceFit(term, container) {
    // 1. Get the internal dimension service (where Xterm 5 stores sizing)
    const core = term._core;
    const dims = core._renderService.dimensions;

    if (!dims || dims.css.cell.width === 0) {
        // The renderer isn't ready yet—try again in the next frame
        requestAnimationFrame(() => forceFit(term, container));
        return;
    }

    // 2. Calculate based on the parent's actual pixel size
    const scrollbarWidth = 15; // Standard buffer for the scrollbar
    const width = window.document.body.clientWidth - scrollbarWidth
        - (window.document.body.clientWidth < 800 ? 60 : 0);
    const height = width >= 800
        ? window.innerHeight
        //- document.getElementById('toolbar').clientHeight
        * 0.25
        : Math.max(window.innerHeight
            - document.getElementById('toolbar').clientHeight
            - document.getElementById('statusbar').clientHeight
            - document.getElementById('terminals').clientHeight
            - 2,
            term.buffer.active.baseY + term.rows
        );

    const cols = Math.max(2, Math.floor(width / dims.css.cell.width));
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

    var buttons = document.getElementById('terminals').children[0].children

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
            center: m.index + (m[0].length / 2) // Middle of the match for better accuracy
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
        text: lines[2].line.trim(),
        path: null,
        line: null,
        index: targetIndex - col, // Start of the clicked line
        center: targetIndex,      // Point of the click
        distance: 0,              // It's the only option, so distance is 0
        isFallback: true          // Useful flag for your UI
    }]

}


const terminalContainer = document.getElementById('terminal');

terminalContainer.addEventListener('mousedown', async (event) => {

    if (!event.ctrlKey || !isModifierPressed) return;

    event.preventDefault()

    const rect = terminalContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const col = Math.floor(x / term._core._renderService.dimensions.css.cell.width);
    const row = Math.floor(y / term._core._renderService.dimensions.css.cell.height) + term.buffer.active.viewportY;

    // Only update cursor if the click is on the "active" input line
    const activeRow = term.buffer.active.baseY + term.buffer.active.cursorY;

    const files = extractFiles(col, row);
    const lineText = files[0]?.text.trim()
        || term.buffer.active.getLine(row)?.translateToString(true)
    if (files.length === 0
        || lineText.length === 0
    ) return;



    // 3. Regex to find "filename.ext:line" or "filename.ext:line:col"
    // This matches standard compiler/error output formats
    const filePattern = /([\w\d\._\-\/]+\.\w+)\b(?::(\d+))?(?::(\d+))?[\n\r\s$]*/;
    const match = lineText.match(filePattern);
    const filePath = files[0].path
    const lineNumber = files[0].line

    if (files[0].path) {
        console.log(`File: ${files[0].path}, Line: ${files[0].line}`);
    }

    let history
    if (row === activeRow) {
        changeCursorPosition(event, x, y, activeRow, col, row, lineText, filePath, lineNumber)
    } else if ((history = commandHistory.findIndex(i => i.trim() === lineText.trim()))
        && history >= y
        || (history = commandHistory.findIndex(i => i.trim().includes(lineText.trim())))
        && history >= y
        || (history = commandHistory.findIndex(i => lineText.trim().includes(i.trim())))
        && history >= y
    ) {
        // if they click on a previous command with ctrl button, insert it into the current line
        historyIndex = history
        updateLineFromHistory()
    } else if (!files[0].isFallback) {

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


async function clickTerminalFile(event, x, y, activeRow, col, row, lineText, filePath, lineNumber) {

    let selected
    let dbFile
    if (!dbFile && files[engineRepo]) {
        dbFile = files[engineRepo][filePath]
        if (dbFile) {
            trees[engineRepo].values = [dbFile.sha];
            selected = engineRepo
        }
        renderTabsCommand('filelist')
    }
    if (!dbFile && files[gameRepo]) {
        dbFile = files[gameRepo][filePath]
        if (dbFile) {
            trees[gameRepo].values = [dbFile.sha];
            selected = gameRepo
        }
        renderTabsCommand('gamelist')
    }
    if (!dbFile && files[assetRepo]) {
        dbFile = files[assetRepo][filePath]
        if (dbFile) {
            trees[assetRepo].values = [dbFile.sha];
            selected = assetRepo
        }
        renderTabsCommand('assetlist')
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
    if (!dbFile && filePath.includes('build/')) {

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
            renderTabsCommand('database')
            trees['#database'].values = [item.key];
        }

    }


    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (!dbFile) dbFile = files[selected][filePath]


    if (!dbFile) return

    currentOpenFileId = dbFile.sha

    await openFile(ownerName, repoName, filePath, dbFile.sha, true /* record history */, false /* show file list */)
    if (lineNumber)
        editor.gotoLine(lineNumber, 0, true);
    editor.focus();

}



function updateLineFromHistory(specificValue = null) {
    // 1. Erase current line in terminal: Move to start, clear to end
    term.write('\r\x1b[K> ');

    // 2. Update the buffer
    currentLine = specificValue !== null ? specificValue : commandHistory[historyIndex];

    // 3. Write the new line
    term.write(currentLine);
    cursorPosition = currentLine.length

}