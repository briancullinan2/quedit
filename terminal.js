
var term = new Terminal({ convertEol: true });
term.open(document.getElementById('terminal'));

const container = document.getElementById('terminal');




window.addEventListener('resize', () => {
    forceFit(term, container);

    updateMaxLines()
});
let history = [];
let historyIndex = -1;
let currentLine = '';


term.attachCustomKeyEventHandler((arg) => {
    if (arg.type === "keydown") {
        // Check for Ctrl (Windows/Linux) or Cmd (Mac)
        const isModifierPressed = arg.ctrlKey || arg.metaKey;

        // --- Ctrl+C: Copy ---
        if (isModifierPressed && arg.code === "KeyC") {
            const selection = term.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection);
                return false;
            }
            term.write('CTRL+C\n\r> ')
            currentLine = ''

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

term.onData(async data => {
    switch (data) {
        case '\r': // Enter
            if (currentLine.trim().length > 0) {
                history.push(currentLine); // Save to history
                historyIndex = -1; // Reset index
            }
            term.write('\r\n');
            try {
                let thisLine = currentLine
                currentLine = ''
                await handleCommand(thisLine);
            } catch (e) {
                term.write(e.toString() + '\r\n' + (e.stack || e.stacktrace) + '\r\n')
            }
            term.write('\r\n> '); // New prompt
            break;

        case '\u007f': // Backspace (DEL)
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                // Move cursor back, print space to clear, move cursor back again
                term.write('\b \b');
            }
            break;

        case '\u001b[A': // Up Arrow
            if (history.length > 0) {
                if (historyIndex === -1) historyIndex = history.length - 1;
                else if (historyIndex > 0) historyIndex--;

                updateLineFromHistory();
            }
            break;

        case '\u001b[B': // Down Arrow
            if (historyIndex !== -1) {
                if (historyIndex < history.length - 1) {
                    historyIndex++;
                    updateLineFromHistory();
                } else {
                    historyIndex = -1;
                    updateLineFromHistory(""); // Clear if we go past the end
                }
            }
            break;

        default: // Standard typing
            // Only echo and buffer printable characters
            if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e)) {
                currentLine += data;
                term.write(data);
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
};

window.console.warn = (...args) => {
    term.write(formatMessage('warn', args));
    originalConsole.warn.apply(console, args);
};

window.console.error = (...args) => {
    term.write(formatMessage('error', args));
    originalConsole.error.apply(console, args);
};

window.console.info = (...args) => {
    term.write(formatMessage('info', args));
    originalConsole.info.apply(console, args);
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
    // 1. Convert pixel click to row/column
    const coords = term.selectionManager?._model.selectionStart || [0, 0];
    // A cleaner way using xterm's internal mouse report:
    const rect = terminalContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate row and col based on character dimensions
    const col = Math.floor(x / term._core._renderService.dimensions.css.cell.width);
    const row = Math.floor(y / term._core._renderService.dimensions.css.cell.height) + term.buffer.active.viewportY;

    // 2. Grab the text from the clicked line
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
    currentLine = specificValue !== null ? specificValue : history[historyIndex];

    // 3. Write the new line
    term.write(currentLine);
}