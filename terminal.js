
var term = new Terminal({convertEol: true});
term.open(document.getElementById('terminal'));

const container = document.getElementById('terminal');

window.addEventListener('resize', () => {
    forceFit(term, container);
});
let currentLine = '';

term.onData(data => {
    switch (data) {
        case '\r': // Enter
            term.write('\r\n');
            handleCommand(currentLine);
            currentLine = ''; // Reset the buffer
            term.write('\r\n> '); // New prompt
            break;
        case '\u007f': // Backspace (DEL)
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                // Move cursor back, print space to clear, move cursor back again
                term.write('\b \b');
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

function handleCommand(command) {
    if (command.trim() === 'help') {
        term.write('Available commands: help, clear, hello');
    } else if (command.trim() === 'hello') {
        term.write('Hello, Brian!');
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
    const width = container.clientWidth - scrollbarWidth;
    const height = container.clientHeight;

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

