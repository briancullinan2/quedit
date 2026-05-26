
const colors = {
    reset: "\x1b[0m",
    log: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    info: "\x1b[36m", // Cyan
    gray: "\x1b[90m"  // Gray for timestamps/meta
};



let PREAMBLE = TOOLS_PREAMBLE

function writeLog(msg, ...args) {
    let skipTerminal = false;
    if (msg.includes('Assertion failed: lookup.node')) {
        debugger;
        skipTerminal = true;
    }
    if (msg.includes && msg.includes('TypeError:')) debugger;

    // Unpack structural extensions
    const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();

    // source metadata matching array payload options
    const source = [
        category,          // <-- "build", "network", "worker"
        ...trailingFiles,     // <-- ['make', 'shared', 'worker']
        func,
        rawFile.split('/').pop().replace('.js', ''),
        rawFile
    ];

    if (trailingFiles.includes('github')) {
        // network tracing intercept block hook...
    }

    let formatted = formatMessage(PREAMBLE, [msg, ...args]);

    if ((!window.api || window.api.worker) && window.terminalWrite && !skipTerminal) {
        terminalWrite(formatted, source);
    }
    if (typeof api !== 'undefined' && typeof api.hostWrite !== 'undefined' && !api.worker) {
        api.hostWrite(formatted, source);
    }
    if (typeof originalConsole !== 'undefined') {
        originalConsole.log(msg, source, ...args);
    } else {
        console.log(msg, ...args);
    }
}

function formatMessageItem(cache, arg) {
    if (cache.has(arg)) return '[Circular]';
    cache.add(arg);
    // 1. Handle Errors (JSON.stringify ignores message/stack by default)
    if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n\r${arg.stack || arg.stacktrace}\n\r${formatMessageItem(cache, { ...arg })}`;
    }


    if (typeof arg === 'string') {
        return arg.trim()
    }
    if (typeof arg === 'object' && Object.keys(arg).length === 0) {
        return (arg.name || arg.constructor.name || typeof arg) + ' ' + '{empty}'
    }


    return (arg.name || arg.constructor.name || typeof arg) + ' ' + JSON.stringify(arg, (key, value) => {
        // 2. Prevent "Circular reference" crashes
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
        }
        return value;
    }, 4);
}
// ANSI Escape Code Definitions

const formatMessage = (level, args) => {
    const timestamp = new Date().toLocaleTimeString();
    const LOCAL_PREAMBLE = level.includes('\x1b') ? level : `${colors[level] || colors.gray}[${level.toUpperCase()}]${colors.reset} `
    const prefix = `${colors.gray}[${timestamp}]${LOCAL_PREAMBLE}${colors.reset}`;

    const cache = new Set(); // To handle circular references

    const processed = args.map(formatMessageItem.bind(null, cache));


    return `${prefix}${processed.join('\n\r')}\r\n`;
};

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

self.console.log = (...args) => {
    const formatted = formatMessage('log', args);
    const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
    const source = [category, 'log', ...trailingFiles, func,
        rawFile.split('/').pop().replace('.js', ''), rawFile
    ];
    if (window.terminalWrite) terminalWrite(formatted, source);
    if (typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
    if (typeof originalConsole != 'undefined') originalConsole.log(...args);
};

self.console.warn = (...args) => {
    const formatted = formatMessage('warn', args);
    const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
    const source = [category, 'log', ...trailingFiles, func,
        rawFile.split('/').pop().replace('.js', ''), rawFile
    ];
    if (window.terminalWrite) terminalWrite(formatted, source);
    if (typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
    if (typeof originalConsole != 'undefined') originalConsole.warn(...args);
};

self.console.error = (...args) => {
    const formatted = formatMessage('error', args);
    const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
    const source = [category, 'log', ...trailingFiles, func,
        rawFile.split('/').pop().replace('.js', ''), rawFile
    ];
    if (window.terminalWrite) terminalWrite(formatted, source);
    if (typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
    if (typeof originalConsole != 'undefined') originalConsole.error(...args);
};

self.console.info = (...args) => {
    const formatted = formatMessage('info', args);
    const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
    const source = [category, 'log', ...trailingFiles, func,
        rawFile.split('/').pop().replace('.js', ''), rawFile
    ];
    if (window.terminalWrite) terminalWrite(formatted, source);
    if (typeof api !== 'undefined' && typeof api.hostWrite != 'undefined' && !api.worker) api.hostWrite(formatted, source);
    if (typeof originalConsole != 'undefined') originalConsole.info(...args);
};



let lineCount = 0;
let lastPartialLine = ''

function terminalWrite(message, source, skipActualWrite = false) {
    if (!message) return;

    let render = message;
    if (!message.endsWith('\n\r') && !message.endsWith('\n')) {
        const parts = message.split(/\n\r*/);
        lastPartialLine = parts.pop();
        render = parts.join('\n\r');
    }

    if (lastPartialLine) {
        lastPartialLine = '';
        render = lastPartialLine + render;
    }

    window.lineCount += (message.match(/\n/g) || []).length;

    // 2. Core Fix: Pipe log data directly to our clean extension block
    if (window.compilerDiagnostics) {
        window.compilerDiagnostics.log(message);
    }

    // Retain only structural diagnostic logging metadata mapping for the master array
    if (window.terminalLog) {
        window.terminalLog.push({
            render: render.includes('\n') ? forceLineWrap(render, 120) : '',
            source: source,
            text: message,
            index: window.terminalLog.length,
            line: lineCount
        });
    }

    if (!window.terminalLoaded) return;

    if (term && !skipActualWrite && terminalWrapper.classList.contains('not-hidden')) {
        term.write(message);
        triggerIncrementalSave();
    }
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


function specialWrite(msg, source) {
    if (!msg) return;

    // 1. Core Fix: Clear old marks instantly via the native module API
    if (msg.includes('q3lcc -v') && window.compilerDiagnostics) {
        window.compilerDiagnostics.clear();
    }

    if (msg.includes('memory access out of bounds')) {
        needsHeaders = true;
    }

    if (!window.runningCommand) {
        window.runningCommand = true;
        if (!window.detachedConsole && !window.alreadyWroteDetached) {
            window.detachedConsole = true;
            PREAMBLE = WARN_PREAMBLE;
            debugger
            console.warn('\n\rDetached console, awaiting terminate...');
        }
    }

    let skipTerminal = false;
    if (msg.includes('Assertion failed: lookup.node')) {
        skipTerminal = true;
    }
    if (!skipTerminal && window.terminalWrite) {
        window.terminalWrite(msg, source);
    }
}



// Mapping system to identify active runtime environments based on trailing stack files
const PIPELINE_CATEGORIES = {
    'make': 'build',
    'compiler': 'build',
    'linker': 'build',
    'github': 'network',
    'p2p': 'network',
    'worker': 'worker',
    'shared': 'build'
};

function getCalleeInfoFromStackTrace() {
    try {
        throw new Error();
    } catch (error) {
        if (!error.stack) return ['unknown', [], 'unknown'];
        const stackLines = error.stack.split('\n');

        const parseLine = (line) => {
            let match = line.match(/at\s+([^\s(]+)\s+\((.+):[0-9]+:[0-9]+\)/);
            if (match) return { func: match[1], file: match[2] };

            match = line.match(/at\s+(.+):[0-9]+:[0-9]+/);
            if (match) return { func: 'global', file: match[1] };

            return null;
        };

        // Identify internal logger context dynamically (e.g., logging.js)
        let currentFile = null;
        for (let i = 0; i < stackLines.length; i++) {
            const parsed = parseLine(stackLines[i]);
            if (parsed) {
                currentFile = parsed.file;
                break;
            }
        }

        let immediateCalleeFunc = null;
        let immediateCalleeFile = null;
        const trailingFiles = [];
        const uniqueNames = new Set();

        // Scan the entire call stack structure
        for (let i = 0; i < stackLines.length; i++) {
            const parsed = parseLine(stackLines[i]);
            if (!parsed) continue;

            // Skip internal wrapper functions inside the logging script itself
            if (parsed.file === currentFile) continue;

            // The first file we hit outside of logging.js is our immediate caller
            if (!immediateCalleeFunc) {
                immediateCalleeFunc = parsed.func;
                immediateCalleeFile = parsed.file;
            }

            // Isolate clean script names (e.g., "file:///path/make.js" -> "make")
            const scriptName = parsed.file.split('/').pop().replace('.js', '');

            if (!uniqueNames.has(scriptName)) {
                uniqueNames.add(scriptName);
                trailingFiles.push(scriptName);
            }
        }

        // Determine the process category by looking up the captured trace names in our dictionary
        let matchedCategory = 'unknown';
        for (const name of trailingFiles) {
            if (PIPELINE_CATEGORIES[name]) {
                matchedCategory = PIPELINE_CATEGORIES[name];
                break; // Break early to preserve highest-priority origin tracking (top-down)
            }
        }

        return [
            immediateCalleeFunc || 'global',
            trailingFiles,
            matchedCategory,
            immediateCalleeFile || 'unknown'
        ];
    }
}

