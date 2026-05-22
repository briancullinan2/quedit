
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
    let skipTerminal = false
    if (msg.includes('Assertion failed: lookup.node')) {
        debugger
        skipTerminal = true
    }
    if (!msg.includes) debugger
    if (msg.includes && msg.includes('TypeError:')) debugger
    let formatted = formatMessage(PREAMBLE, [msg, ...args])
    if ((!window.api || window.api.worker) && window.terminalWrite && !skipTerminal) terminalWrite(formatted);
    if (typeof api.hostWrite != 'undefined' && !window.api.worker) api.hostWrite(formatted);
    if (typeof originalConsole != 'undefined') originalConsole.log(msg, ...args);
    else console.log(msg, ...args)
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
    if (window.terminalWrite) terminalWrite(formatted);
    else if (typeof api.hostWrite != 'undefined' && !window.api.worker) api.hostWrite(formatted);
    if (typeof originalConsole != 'undefined') originalConsole.log(...args);
};

self.console.warn = (...args) => {
    const formatted = formatMessage('warn', args);
    if (window.terminalWrite) terminalWrite(formatted);
    else if (typeof api.hostWrite != 'undefined' && !window.api.worker) api.hostWrite(formatted);
    if (typeof originalConsole != 'undefined') originalConsole.warn(...args);
};

self.console.error = (...args) => {
    const formatted = formatMessage('error', args);
    if (window.terminalWrite) terminalWrite(formatted);
    else if (typeof api.hostWrite != 'undefined' && !window.api.worker) api.hostWrite(formatted);
    if (typeof originalConsole != 'undefined') originalConsole.error(...args);
};

self.console.info = (...args) => {
    const formatted = formatMessage('info', args);
    if (window.terminalWrite) terminalWrite(formatted);
    else if (typeof api.hostWrite != 'undefined' && !window.api.worker) api.hostWrite(formatted);
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

