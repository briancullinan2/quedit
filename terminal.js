
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
                term.write(e.toString())
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

const CWD = ''

async function handleCommand(input) {
    const database = owner.value + '/' + repo.value
    const tokens = tokenize(input.trim());


    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    if (tokens.length === 0) return;

    const [command, ...args] = tokens;

    const commands = {
        mount: async (argv) => {
            let selected = argv[0] || database
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

            await readAll(selected)
        },
        ls: async (argv) => {
            let selected = toolsRepo || database
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

            if (!files[selected]) {
                let branch = await getDefaultBranch(ownerName, repoName)
                await loadGitHubTree(ownerName, repoName, branch)
            }

            const flags = {
                recursive: argv.includes('-R'),
                human: argv.includes('-h'),
                flat: argv.includes('-1')
            };

            // Assuming FS.virtual.readdir returns objects with {name, size, type}
            const entries = Object.values(FS.virtual)
                .concat(Object.values(files[selected] || {}) || [])
                .filter(p => {
                    if (!p.path) {
                        debugger
                    }
                    let compare = CWD
                    let startMatch = false
                    let subMatch = false
                    if (compare.trim().length == 0)
                        compare = '/'
                    if (!compare.endsWith('/'))
                        compare += '/'

                    let path = p.path
                    if (!path.startsWith('/'))
                        path = '/' + path
                    if (path.startsWith(compare))
                        startMatch = true
                    if (flags.recursive || path.substring(compare.length).indexOf('/') === -1)
                        subMatch = true
                    return startMatch && (flags.recursive || subMatch)
                });


            if (flags.flat) {
                entries.forEach(e => term.writeln(e.path));
            } else {
                // Calculate column width for alignment
                const maxName = Math.max(...entries.map(e => e.path.length), 10);

                term.writeln(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE`);
                term.writeln('-'.repeat(maxName + 20));

                entries.forEach(e => {
                    const size = e.contents ? flags.human ? formatBytes(e.contents.length) : e.contents.length.toString() : '0B';
                    const nameStr = e.path.padEnd(maxName + 2);
                    const sizeStr = size.padEnd(10);
                    const color = e.mode === FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

                    term.writeln(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}`);
                });
            }
        },
        help: () => {
            term.write('Available commands: help, clear, build, set');
        },
        hello: async (argv) => {
            const name = argv[0] || 'User';
            let user = (await getAuthenticatedUser()).login
            term.write(`Hello, ${user || name}!`);
        },

        build: async (argv) => {
            const mode = argv[0] || 'release';

            let selected = argv[1] || engineRepo || database
            if (mode === 'q3lcc'
                || mode === 'q3rcc'
                || mode === 'q3cpp'
                || mode === 'lburg'
                || mode === 'asm'
                || mode === 'tools'
            )
                selected = argv[1] || toolsRepo
            if (mode === 'release'
                || mode === 'debug'
                || mode === 'stringify'
                || mode === 'shaders'
                || mode === 'client'
                || mode === 'engine'
                || mode === 'server'
            )
                selected = argv[1] || engineRepo

            if (mode === 'cgame'
                || mode === 'game'
                || mode === 'uid'
                || mode === 'qvms'
            )
                selected = argv[1] || gameRepo

            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
            if (selected && !files[selected]) {
                let branch = await getDefaultBranch(ownerName, repoName)
                await loadGitHubTree(ownerName, repoName, branch)
            }




            if (mode === 'q3lcc'
                || mode === 'q3rcc'
                || mode === 'q3cpp'
                || mode === 'lburg'
                || mode === 'asm'
            )
                configuration.value = 'tools'
            else if (configuration.querySelector(`[value="${mode}"]`))
                configuration.value = mode

            else if (mode === 'cgame'
                || mode === 'game'
                || mode === 'uid'
            )
                configuration.value = 'qvms'
            else if (mode === 'release'
                || mode === 'debug'
                || mode === 'stringify'
                || mode === 'shaders'
                || mode === 'client'
                || mode === 'engine'
                || mode === 'server'
            )
                configuration.value = 'release'
            else if (mode) {
                let modes = Array.from(configuration.children).map(m => m.value)
                term.write(`Valid modes ${modes.join('|')}: ${mode} given.`);
                return;
            }



            term.write(`Starting ${mode} build...\n\r`);

            if (mode === 'q3lcc')
                return await buildLCC(selected)
            if (mode === 'q3rcc')
                return await buildRCC(selected)
            if (mode === 'q3cpp')
                return await buildCPP(selected)
            if (mode === 'lburg')
                return await buildLBurg(selected)
            if (mode == 'asm')
                return await buildAsmTool(selected)

            if (mode == 'game')
                return await buildGame(selected)
            if (mode == 'cgame')
                return await buildCGame(selected)
            if (mode == 'ui')
                return await buildUI(selected)

            if (mode === 'stringify')
                return await buildStringify(selected)
            if (mode === 'shaders')
                return await buildShaders(selected)
            if (mode === 'client')
                return await buildClient(selected)


            if (configuration.value === 'qvms')
                return await buildQVM(selected)
            if (configuration.value === 'tools')
                return await buildTools(selected)

            build(selected);
        },
        header: async (argv) => {
            let selected = toolsRepo || argv[1] || database
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
            let headers = [argv[0]]

            if (!argv[0])
                headers = [...lccToolHeaders]

            if (!files[selected]) {
                let branch = await getDefaultBranch(ownerName, repoName)
                await loadGitHubTree(ownerName, repoName, branch)
            }

            for (let header of headers) {
                let sha = files[selected][header].sha

                await cacheFile(ownerName, repoName, header, sha);
                await api.header(ownerName, repoName, header, selected)
            }
        },
        compile: async (argv) => {
            let selected = toolsRepo || argv[1] || database
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

            if (!files[selected]) {
                let branch = await getDefaultBranch(ownerName, repoName)
                await loadGitHubTree(ownerName, repoName, branch)
            }

            let sha = files[selected][argv[0]].sha

            let contents = await cacheFile(ownerName, repoName, argv[0], sha);

            let obj = CONFIGURATION + '/' + argv[0].replace('.c', '.o')

            return await api.compile({
                CFLAGS: [
                    ...LCC_CFLAGS, `-Icode`, `-Isrc`,
                    '-o', obj, argv[0]
                ],
                contents: contents,
                width: term.cols,
                input: argv[0],
                database,
                obj
            })
        },
        clang: async (argv) => {
            let file = currentSession()
            return await api.compile({
                CFLAGS: argv,
                contents: editor.getValue(),
                width: term.cols,
                input: file,
                database,
                obj: file ? CONFIGURATION + '/' + file.replace('.c', '.o') : ''
            })
        },
        run: async (argv) => {

            let thisDatabase = database
            if (argv[0].includes('lburg')
                || argv[0].includes('q3lcc')
            )
                thisDatabase = toolsRepo

            return await api.run({
                tool: argv[0],
                args: argv,
                thisDatabase,
            })
        },
        'lburg': async (argv) => {
            let selected = toolsRepo || argv[1] || database
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

            if (!files.selected) {
                let branch = await getDefaultBranch(ownerName, repoName)
                await loadGitHubTree(ownerName, repoName, branch)
            }

            let CONFIGURATION = configuration.value == 'release'
                ? dirs.ENGINE_RELEASE
                : dirs.ENGINE_DEBUG


            let paths = [
                argv[0] || 'src/dagcheck.md',
                argv[1] || path.join(CONFIGURATION, argv[0] ? argv[0].replace('.md', '.c') : 'src/dagcheck.c'),
            ]

            await cacheFile(ownerName, repoName, paths[0], (files[selected][paths[0]] || {}).sha);


            let args = [
                'lburg.js.wasm',
                ...paths,
                ...argv.slice(2)
            ]

            return await api.run({
                tool: 'lburg.js.wasm',
                args: args,
                database: selected,
                paths: paths
            })
        },
        clone: async (argv) => {
            let selected = argv[0] || toolsRepo || 'briancullinan2/quedit'
            let parts = selected.split('/')
            let ownerName = parts.length == 2 ? parts[0] : owner.value
            let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

            var branch = argv[1]
            if (!branch) {
                branch = await getDefaultBranch(ownerName, repoName)
            }
            await loadGitHubTree(ownerName, repoName, branch)

            term.write('Checked out: ' + branch + ' from ' + ownerName + '/' + repoName);

            // TODO: switch to aux filelist and display
        },
        'lcc': (argv) => commands['clang'](argv),
        'rcc': (argv) => commands['clang'](argv),
        'ld': (argv) => commands['clang'](argv),
        'cc1': (argv) => commands['clang'](argv),
        'as': (argv) => commands['clang'](argv),
        'cpp': (argv) => commands['clang'](argv),
        'clang++': (argv) => commands['clang'](argv),
        'wasm-ld': async (argv) => {
            return await api.link({
                LDFLAGS: argv,
                database,
            })
        },
        reser: () => term.reset(),
        clear: () => term.clear(),

    };

    if (commands[command]) {
        await commands[command](args);
    } else {
        term.write(`Command not found: ${command}`);
    }
}


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
            return {
                name: arg.name,
                message: arg.message,
                stack: arg.stack,
                ...arg // Get any custom properties you added
            };
        }
        return arg;
    });

    const output = JSON.stringify(processed, (key, value) => {
        // 2. Prevent "Circular reference" crashes
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
        }
        return value;
    }, 2);

    return `${prefix}${output}\r\n`;
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