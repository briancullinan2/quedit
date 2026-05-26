
const LINES_TO_SAVE = 1000
const MAX_HISTORY_LENGTH = 20
const PROMPT = "> "



let historyIndex = -1;
let currentLine = '';
let cursorPosition = 0;

// Self-contained hydration loop from disk
let commandHistory = [];
try {
    const stored = localStorage.getItem('history');
    commandHistory = stored ? JSON.parse(stored) : [];
} catch (e) {
    console.error('Failed to load command history from localStorage:', e);
}

/**
 * Helper to invoke the structural state mutation callback hooks.
 */
function notifyState() {
    if (typeof onStateChange === 'function') {
        onStateChange({ currentLine, cursorPosition, historyIndex, commandHistory });
    }
}

/**
 * Standard visual prompt writer.
 */
function writePrompt() {
    term.write(`\n\r${PROMPT}`);
}

/**
 * Determines if the active interactive baseline represents a pending command line prompt.
 */
function getLastLineIsInput() {
    const buffer = term.buffer.active;
    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = endRow - 3;

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            let lineStr = line.translateToString(true);
            if (lineStr === PROMPT || lineStr === PROMPT.trim() || lineStr.trim() === '>') {
                return true;
            }
        }
    }
    return false;
}

/**
 * Pulls plain text snapshots relative to insertion cursors.
 */
function getInternalTerminalLog() {
    const lines = [];
    const buffer = term.buffer.active;
    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = Math.max(0, endRow - LINES_TO_SAVE);

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            lines.push(line.translateToString(true));
        }
    }
    return lines;
}

/**
 * Robust horizontal cell tracker reconstructing proper ANSI formatting.
 */
function getInternalTerminalLogColored() {
    const lines = [];
    const buffer = term.buffer.active;
    const endRow = buffer.baseY + buffer.cursorY;
    const startRow = Math.max(0, endRow - linesToSave);

    for (let i = startRow; i <= endRow; i++) {
        const line = buffer.getLine(i);
        if (line) {
            let lineString = '';
            let currentFg = -1;
            let currentBg = -1;

            for (let x = 0; x < line.length; x++) {
                const cell = line.getCell(x);
                if (!cell) continue;

                const char = cell.getChars();
                const fg = cell.getFgColor();
                const bg = cell.getBgColor();

                if (fg !== currentFg || bg !== currentBg) {
                    let ansiSequence = '\x1b[0m'; // Start clear reset

                    if (cell.isFgPalette() || cell.isFgRGB()) {
                        ansiSequence += `\x1b[38;5;${fg}m`;
                    } else if (fg >= 0 && fg < 16) {
                        ansiSequence += `\x1b[${fg < 8 ? fg + 30 : fg + 82}m`;
                    }

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

            if (currentFg !== -1 || currentBg !== -1) {
                lineString += '\x1b[0m';
            }

            const cleanLine = lineString.replace(/\s+(\x1b\[0m)?$/, '$1');
            lines.push(cleanLine);
        }
    }
    return lines;
}

/**
 * Mutates input content lines and swaps physical cursor buffers up/down.
 */
function updateLineFromHistory(specificValue = null) {
    if (currentLine === PROMPT + commandHistory[historyIndex]) {
        debugger;
    }

    // Wipe existing trace line completely, backup 1 step
    term.write('\r\x1b[K\x1b[A');
    writePrompt();

    currentLine = specificValue !== null ? specificValue : (commandHistory[historyIndex] || '');
    term.write(currentLine);
    cursorPosition = currentLine.length;

    notifyState();
}



function commitLine(lineText) {
    const trimmed = lineText.trim();
    if (trimmed.length > 0) {
        commandHistory.push(lineText);

        if (commandHistory.length > MAX_HISTORY_LENGTH) {
            commandHistory.splice(0, commandHistory.length - 10);
        }

        localStorage.setItem('history', JSON.stringify(commandHistory));
    }

    // Capture the line text we are about to destroy internally
    const completedLine = currentLine;

    // Safely clear out internal state indicators
    historyIndex = -1;
    currentLine = '';
    cursorPosition = 0;
    
    notifyState();

    // Return the preserved string value up the execution chain
    return completedLine;
}


/**
 * Arrow mapping shortcuts routing up/down state shifts.
 */
function navigateHistory(direction) {
    if (commandHistory.length === 0) return;

    if (direction === 'up') {
        if (currentLine.trim().length > 0) {
            commandHistory[historyIndex] = currentLine;
        }
        if (historyIndex === -1) {
            historyIndex = commandHistory.length - 1;
        } else if (historyIndex > 0) {
            historyIndex--;
        }
        updateLineFromHistory();
    }
    else if (direction === 'down') {
        if (historyIndex !== -1) {
            if (currentLine.trim().length > 0) {
                commandHistory[historyIndex] = currentLine;
            }
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                updateLineFromHistory();
            } else {
                historyIndex = -1;
                updateLineFromHistory(commandHistory[-1] || '');
            }
        }
    }
}

/**
 * Modifies cursor placement tracking matrices when users physically tap or click structural areas.
 */
function changeCursorPosition(col) {
    const promptLength = PROMPT.length;
    let newPos = col - promptLength;

    newPos = Math.max(0, Math.min(newPos, currentLine.length));
    cursorPosition = newPos;

    // Carry cursor position shifts across terminal display surfaces securely
    term.write(`\x1b[G\x1b[${promptLength + cursorPosition}C`);

    notifyState();
}


