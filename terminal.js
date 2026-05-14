
var term = new Terminal({
    convertEol: true,
    scrollback: 5000, // Increase this from the default 1000
    cursorBlink: true,
});
term.open(document.getElementById('terminal'));

const container = document.getElementById('terminal');




window.addEventListener('resize', () => {
    forceFit(term, container);

    updateMaxLines()
});
const loadedHistory = JSON.parse(localStorage.getItem('history') || '[]')
const commandHistory = loadedHistory instanceof Array ? loadedHistory : []
const loadedLog = JSON.parse(localStorage.getItem('terminal_log') || '[]');
term.write(loadedLog.join('\n\r'))
term.write('\n\r')
term.write('> ');

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
    const startRow = Math.max(0, endRow - 100);

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            // translateToString(true) trims trailing whitespace
            lines.push(line.translateToString(true));
        }
    }
    return lines;
}


async function triggerIncrementalSave() {
    const last100 = getInternalTerminalLog();
    localStorage.setItem('terminal_log', JSON.stringify(last100));
}



term.attachCustomKeyEventHandler((arg) => {



    if (arg.type === "keydown") {
        // Check for Ctrl (Windows/Linux) or Cmd (Mac)
        isModifierPressed = arg.ctrlKey || arg.metaKey;


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
            navigator.clipboard.readText().then(text => {
                if (text) {
                    // Filter the text to match your existing "Standard typing" 
                    // range (0x20 to 0x7e) to prevent control characters from
                    // corrupting your currentLine buffer.
                    const filtered = text.split('').filter(c =>
                        c >= String.fromCharCode(0x20) && c <= String.fromCharCode(0x7e)
                    ).join('');

                    cursorPosition += filtered.length
                    //currentLine += filtered;
                    //term.write(filtered);
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


let lastNewLine = false;

function specialWrite(msg) {
    if (!msg) return;

    term.write(msg)
    return

    if (msg.includes('memory access out of bounds')) {
        needsHeaders = true;
    }

    // 1. Save Position & Hide Cursor
    term.write('\x1b[s\x1b[?25l');

    const buffer = term.buffer.active;

    // 2. Inspect the "Live" Buffer state
    // We want the line the prompt is currently sitting on
    const absoluteRowIndex = buffer.baseY + buffer.cursorY;
    const currentRow = buffer.getLine(absoluteRowIndex);

    // Determine if the line ABOVE the prompt ended with a manual newline
    // We look at the line above (absoluteRowIndex - 1)
    const prevRow = buffer.getLine(absoluteRowIndex - 1);
    const prevLineIsWrapped = prevRow ? prevRow.isWrapped : false;

    // 3. Clear the User's Prompt Line
    // \r moves to col 0, \x1b[2K clears the line
    //term.write('\r\x1b[2K');

    // 4. The Backtrack Logic
    // If the previous line was NOT wrapped, it means we (the host) 
    // forced a newline there to draw the prompt. 
    // We jump back UP to append the new background data to that line.
    if (buffer.cursorY > 0 && !prevLineIsWrapped
        && !lastNewLine
    ) {
        term.write('\x1b[A'); // Move Cursor Up

        // Find the last non-empty character on that line to 'resume' writing
        const lastContent = prevRow.translateToString(true)
        const lastContentCol = lastContent.length;
        term.write(`\x1b[${lastContentCol + 1}G`); // Move to the end of text on that line
        const previousEndsWithNewline = lastContent.endsWith('\n\r') || lastContent.endsWith('\n');
        if (!previousEndsWithNewline)
            lastNewLine = lastContentCol
    }

    // 5. Write the message
    // If msg ends in \n, it will naturally move the cursor down
    term.write(msg.replaceAll(/\n|\n\r|\r\n/g, '\n\r'));

    // 6. Ensure Prompt is on a Fresh Line
    // If the log stream is still partial, we force a newline for the prompt
    const endsWithNewline = msg.endsWith('\n\r') || msg.endsWith('\n');
    if (!endsWithNewline) {
        term.write('\n\r');
        lastNewLine = false
    } else {
        lastNewLine = true
    }

    // 7. Redraw User State
    term.write('> ' + currentLine);

    // 8. Restore Cursor & Show
    const promptOffset = 2; // "> "
    term.write(`\r\x1b[${promptOffset + cursorPosition}C\x1b[?25h`);

    status.children[0].innerText = 'Status: ' + msg;
    triggerIncrementalSave();
}



term.onData(async data => {
    switch (data) {

        case '\r': // Enter
            if (currentLine.trim().length > 0) {
                commandHistory.push(currentLine);

                // If we exceed 10, remove the difference from the beginning
                if (commandHistory.length > 10) {
                    // .splice(start, deleteCount) 
                    commandHistory.splice(0, commandHistory.length - 10);
                }

                historyIndex = -1;
                localStorage.setItem('history', JSON.stringify(commandHistory));
            }

            triggerIncrementalSave()

            try {
                let thisLine = currentLine;
                currentLine = '';
                cursorPosition = 0;
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
    setTimeout(() => forceFit(term, container), 100);
});

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

// ANSI Escape Code Definitions
const colors = {
    reset: "\x1b[0m",
    log: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    info: "\x1b[36m", // Cyan
    gray: "\x1b[90m"  // Gray for timestamps/meta
};

const formatMessage = (level, args) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `${colors.gray}[${timestamp}]${colors.reset} ${colors[level]}[${level.toUpperCase()}]${colors.reset} `;

    const cache = new Set(); // To handle circular references

    const processed = args.map(arg => {
        // 1. Handle Errors (JSON.stringify ignores message/stack by default)
        if (arg instanceof Error) {
            return JSON.stringify({
                name: arg.name,
                message: arg.message,
                stack: arg.stack,
                ...arg // Get any custom properties you added
            }, (key, value) => {
                // 2. Prevent "Circular reference" crashes
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) return '[Circular]';
                    cache.add(value);
                }
                return value;
            }, 4);
        }
        return JSON.stringify(arg, (key, value) => {
            // 2. Prevent "Circular reference" crashes
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) return '[Circular]';
                cache.add(value);
            }
            return value;
        }, 4);
    });


    return `${prefix}${processed.join('\n\r')}\r\n`;
};

window.console.log = (...args) => {
    term.write(formatMessage('log', args));
    originalConsole.log.apply(console, args);
    triggerIncrementalSave()
};

window.console.warn = (...args) => {
    term.write(formatMessage('warn', args));
    originalConsole.warn.apply(console, args);
    triggerIncrementalSave()
};

window.console.error = (...args) => {
    term.write(formatMessage('error', args));
    originalConsole.error.apply(console, args);
    triggerIncrementalSave()
};

window.console.info = (...args) => {
    term.write(formatMessage('info', args));
    originalConsole.info.apply(console, args);
    triggerIncrementalSave()
};



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

const terminalContainer = document.getElementById('terminal');

terminalContainer.addEventListener('mousedown', async (event) => {
    if (!event.ctrlKey && !isModifierPressed) return;

    const rect = terminalContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const col = Math.floor(x / term._core._renderService.dimensions.css.cell.width);
    const row = Math.floor(y / term._core._renderService.dimensions.css.cell.height) + term.buffer.active.viewportY;

    // Only update cursor if the click is on the "active" input line
    const activeRow = term.buffer.active.baseY + term.buffer.active.cursorY;
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

    const lineText =
        term.buffer.active.getLine(row - 2)?.translateToString(true)
        + term.buffer.active.getLine(row - 1)?.translateToString(true)
        + term.buffer.active.getLine(row)?.translateToString(true)
        + term.buffer.active.getLine(row + 2)?.translateToString(true);
    if (lineText.trim().length == 0) return;


    // 3. Regex to find "filename.ext:line" or "filename.ext:line:col"
    // This matches standard compiler/error output formats
    const filePattern = /([\w\d\._\-\/]+\.\w+):(\d+)(?::(\d+))?/;
    const match = lineText.match(filePattern);

    if (match) {
        const filePath = match[1];
        const lineNumber = parseInt(match[2], 10);
        // TODO: whatever project the console output is initiated on
        let database = owner.value + '/' + repo.value
        let parts = database.split('/')
        let ownerName = parts.length == 2 ? parts[0] : owner.value
        let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

        if (!files[database][filePath]) return

        let sha = files[database][filePath].sha
        currentOpenFileId = sha
        await openFile(owner.value, repo.value, filePath, sha)
        editor.gotoLine(lineNumber, 0, true);
        editor.focus();
    }
});

function updateLineFromHistory(specificValue = null) {
    // 1. Erase current line in terminal: Move to start, clear to end
    term.write('\r\x1b[K> ');

    // 2. Update the buffer
    currentLine = specificValue !== null ? specificValue : commandHistory[historyIndex];

    // 3. Write the new line
    term.write(currentLine);
    cursorPosition = currentLine.length

}