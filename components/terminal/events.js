

let debounceTerminalMouse = null;
let previousUpdate = null;



function extractFiles(col, row) {
    const buffer = term.buffer.active;
    const offsets = [-2, -1, 0, 1, 2];
    
    let unifiedText = '';
    const charMap = []; // Maps characters in unifiedText back to original { col, row }
    let absoluteMouseIndex = -1;

    // 1. Construct a continuous structural string and map every index back to layout slots
    offsets.forEach(off => {
        const currentRowIdx = row + off;
        const line = buffer.getLine(currentRowIdx);
        if (!line) return;

        const lineStr = line.translateToString(true);
        
        for (let x = 0; x < lineStr.length; x++) {
            // Track where the mouse lands inside this unified stream string block
            if (off === 0 && x === col) {
                absoluteMouseIndex = unifiedText.length;
            }
            
            unifiedText += lineStr[x];
            charMap.push({ col: x, row: currentRowIdx });
        }
        
        // Account for trailing row slice gap wrapping boundaries
        // If xterm wrapped the line naturally, do not append spacing
        if (line.isWrapped) {
            // Mouse could be at the boundary of a wrapped line
            if (off === 0 && col >= lineStr.length) {
                absoluteMouseIndex = unifiedText.length;
            }
        } else {
            // Explicit hard newline break: insert delimiter so regex matches don't cross rows
            if (off === 0 && col >= lineStr.length) {
                absoluteMouseIndex = unifiedText.length;
            }
            unifiedText += '\n';
            charMap.push({ col: lineStr.length, row: currentRowIdx });
        }
    });

    // 2. Scan unified string layout with the path parsing expression
    let fileMatch;
    FILE_NAME_REGEX.lastIndex = 0;

    while ((fileMatch = FILE_NAME_REGEX.exec(unifiedText)) !== null) {
        const startIdx = fileMatch.index;
        const endIdx = startIdx + fileMatch[0].length;

        // 3. STRICT GUARD: Check if the absolute mouse index falls directly within the match boundaries
        if (absoluteMouseIndex >= startIdx && absoluteMouseIndex < endIdx) {
            const fullPath = fileMatch[1];
            const lineNo = fileMatch[2] || fileMatch[3] || fileMatch[4];
            
            // Map the start character index of the match back to its terminal buffer slot
            const mappedStart = charMap[startIdx] || { col: 0, row };

            return [{
                path: fullPath,
                filename: fullPath ? fullPath.split('/').pop() : null,
                line: lineNo ? parseInt(lineNo, 10) : null,
                index: mappedStart.col,
                text: fileMatch[0],
                isFallback: false // Valid path hit underneath the precise cursor coordinates
            }];
        }
    }

    // 4. Fallback execution block if the cursor wasn't hovering over a matching token
    const baselineText = buffer.getLine(row)?.translateToString(true)?.trim() || "";
    return [{
        path: null,
        filename: null,
        line: null,
        index: 0,
        text: baselineText,
        isFallback: true
    }];
}



/**
 * Updates text layout nodes reflecting active pointer indexes inside the current bounding view.
 */
function updateTerminalStatus(col, row, activeRow, filePath, lineNumber, isFallback, historyIndexValue) {
    if (!statusBar) return;

    const buffer = term.buffer.active;
    const startRow = buffer.viewportY;
    const endRow = startRow + term.rows;
    const currentCursorPos = history ? cursorPosition : 0;

    statusBar.innerText = `Terminal: Mouse: ${col}x${row}, `
        + `Cursor: ${currentCursorPos}x${activeRow}, `
        + `Viewport: ${startRow}x${endRow}, `
        + (historyIndexValue !== null && historyIndexValue !== -1 ? `History: ${historyIndexValue}, ` : '')
        + (filePath && !isFallback ? lineNumber !== null ?
            `File: ${filePath}, Line: ${lineNumber}`
            : `File: ${filePath}`
            : '');
}

/**
 * Linear event parsing processor compiling cell structural metrics.
 */
function detectTerminalEvents(event, x, y, updateStatus = true) {
    const rect = terminalContainer.getBoundingClientRect();
    if (event) {
        x = x !== undefined ? x : (event.clientX - rect.left);
        y = y !== undefined ? y : (event.clientY - rect.top);
    }

    const dims = term._core._renderService.dimensions.css.cell;
    const col = Math.floor(x / dims.width);
    const row = Math.floor(y / dims.height) + term.buffer.active.viewportY;
    const activeRow = term.buffer.active.baseY + term.buffer.active.cursorY;

    const files = extractFiles(col, row);
    const lineText = files[0]?.text?.trim() || term.buffer.active.getLine(row)?.translateToString(true);

    let filePath, lineNumber, isFallback, fileIndex;
    if (lineText && files.length > 0) {
        filePath = files[0].path;
        lineNumber = files[0].line;
        fileIndex = files[0].index;
        isFallback = files[0].isFallback;
    }


    let historyIndexMatch = null;

    if (lineText) {
        // 1. Get the current command array from the history engine
        const cmdHistory = [...commandHistory];
        const trimmedLine = lineText.trim();

        if (trimmedLine.length > 0) {
            // 2. Find the last index matching exact, partial, or inverted sub-strings
            historyIndexMatch = cmdHistory.findLastIndex(i => {
                const trimmedCmd = i.trim();
                return trimmedCmd.length > 0 && (
                    trimmedCmd === trimmedLine ||
                    trimmedCmd.includes(trimmedLine) ||
                    trimmedLine.includes(trimmedCmd)
                );
            });
        }
    }

    if (updateStatus) {
        updateTerminalStatus(col, row, activeRow, filePath, lineNumber, isFallback, historyIndexMatch);
    }

    return {
        event, x, y, activeRow, col, row,
        lineText, filePath, lineNumber, fileIndex,
        isFallback, history: historyIndexMatch
    };
}

/**
 * Rate-limited movement scanner refreshing highlighted results and viewport matrices.
 */
function debounceTerminalStatus(event) {
    const rect = terminalContainer.getBoundingClientRect();
    let currentX = event ? event.clientX - rect.left : 0;
    let currentY = event ? event.clientY - rect.top : 0;

    if (previousUpdate && event) {
        previousUpdate.event = event;
        previousUpdate.x = currentX;
        previousUpdate.y = currentY;
    }

    // Native Camera Look Interceptor Linkage
    if (event && (window.isModifierPressed || document.pointerLockElement !== null) && typeof window.moveLookLocked === 'function') {
        window.moveLookLocked(event.movementX, event.movementY);
    }

    if (debounceTerminalMouse) return false;

    debounceTerminalMouse = setTimeout(() => {
        // Re-fire query updates from shared search input references cleanly
        const searchInput = document.getElementById('search-terminal');
        if (searchInput) {
            scanVisibleViewport(searchInput.value);
        }

        if (!previousUpdate && !event) {
            // No trace
        } else if (!previousUpdate) {
            previousUpdate = detectTerminalEvents(event, currentX, currentY);
        } else {
            previousUpdate = detectTerminalEvents(previousUpdate.event, previousUpdate.x, previousUpdate.y);
        }

        debounceTerminalMouse = null;
    }, 200);

    return false;
}

/**
 * Click evaluation routing panel tracking.
 */
async function handleMouseDown(event) {
    event.preventDefault();
    const rect = terminalContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const data = detectTerminalEvents(event, x, y);

    // Path Click Navigation Handler
    if (data.filePath && !data.isFallback) {
        if (typeof writeLog === 'function') {
            writeLog(`File: ${data.filePath}, Line: ${data.lineNumber}, Fallback: ${data.isFallback}`);
        }
        if (typeof navigateFile === 'function') {
            await navigateFile(data.filePath, data.lineNumber);
        }
        return false;
    }

    // Split Layout Component Drag Checker
    const softTab = document.querySelector('#terminals a[href="#soft"].active');
    if (softTab !== null && data.row === window.targetStartY && data.col > window.targetStartX && data.col < window.targetStartX + window.targetWidth) {
        isDragging = true;
        document.body.classList.add('dragging');
    }

    if (!event.ctrlKey && !event.metaKey && !window.isModifierPressed) return false;

    // Command Prompt Input Locus Shifting
    if (data.row === data.activeRow && history) {
        changeCursorPosition(data.col);
    } else if (data.history !== null && data.history !== -1 && history) {
        setHistoryIndex(data.history);
        updateLineFromHistory();
    }

    return false;
}

// Attach Event Listeners internally to completely clean up parent runtime loop dependencies
terminalContainer.addEventListener('mousemove', debounceTerminalStatus);
terminalContainer.addEventListener('mousedown', handleMouseDown);
term.onScroll(debounceTerminalStatus);

window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('dragging');
});


term.attachCustomKeyEventHandler((arg) => {
    // Trigger save and status updates instantly across inputs
    debounceTerminalStatus();
    if (typeof window.triggerIncrementalSave === 'function') {
        window.triggerIncrementalSave();
    }

    if (arg.type === "keydown" || arg.type === "keyup") {
        if (typeof window.updateModifierPressed === 'function') {
            window.updateModifierPressed(arg);
        }
    }

    if (arg.type === "keydown") {

        // --- Ctrl+F: Focus Search Box ---
        if (window.isModifierPressed && arg.code === "KeyF") {
            if (arg.preventDefault) arg.preventDefault();
            const searchTerminal = document.getElementById('search-terminal');
            if (searchTerminal) {
                searchTerminal.focus();
                const selection = term.getSelection();
                if (selection) searchTerminal.value = selection;
                if (search) search.trigger();
            }
        }

        // --- Ctrl+C: Copy / Cancel ---
        if (window.isModifierPressed && arg.code === "KeyC") {
            const selection = term.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection);
                return false;
            }
            term.write('\n\rCTRL+C');
            window.TERMINATE = true;
            if (window.building) term.write('\n\rStopping build...');
            writePrompt();
            setCursorPosition(0);
            setCurrentLine('');
        }

        // --- Backspace: Inline Redraw Splicer ---
        if (arg.code === "Backspace") {
            if (arg.preventDefault) arg.preventDefault();

            if (cursorPosition > 0) {
                const leftSide = currentLine.slice(0, cursorPosition - 1);
                const rightSide = currentLine.slice(cursorPosition);

                setCurrentLine(leftSide + rightSide);
                setCursorPosition(cursorPosition - 1);

                if (term.buffer.active.cursorX === 0) {
                    term.write(`\x1b[A\x1b[${term.cols}C`);
                } else {
                    term.write('\b');
                }

                term.write('\x1b[s');
                term.write(rightSide + '\x1b[K');
                term.write('\x1b[u');
            }
            return false;
        }

        // --- Ctrl+V: Paste Filter Loop ---
        if (window.isModifierPressed && arg.code === "KeyV") {
            if (arg.preventDefault) arg.preventDefault();

            navigator.clipboard.readText().then(text => {
                if (text) {
                    const filtered = text.split('').filter(c =>
                        c >= String.fromCharCode(0x20) && c <= String.fromCharCode(0x7e)
                    ).join('');

                    setCursorPosition(cursorPosition + filtered.length);
                    setCurrentLine(currentLine + filtered);
                    term.write(filtered);
                }
            }).catch(err => console.error('Paste failed: ', err));
            return false;
        }
    }
    return true;
});

// ==========================================
// RAW STREAM DATA INTERCEPTOR (Typing & Game Controls)
// ==========================================
term.onData(async data => {
    // Game Engine Vector Controls Interception (w, a, s, d, Space)
    if (typeof window.pressed !== 'undefined' && data.length === 1) {
        const lowerChar = data.toLowerCase();

        if (['w', 'a', 's', 'd', ' '].includes(lowerChar)) {
            let targetKeyCode = lowerChar === ' ' ? 32 : lowerChar.toUpperCase().charCodeAt(0);

            window.pressed[targetKeyCode] = true;
            self.terminalTimers = self.terminalTimers || {};
            clearTimeout(self.terminalTimers[targetKeyCode]);

            self.terminalTimers[targetKeyCode] = setTimeout(() => {
                window.pressed[targetKeyCode] = false;
            }, 120);

            if (lowerChar === ' ' && typeof window.playerMover !== 'undefined') {
                window.playerMover.jump();
            }
            return; // Guard statement: blocks insertion into command text array
        }
    }


    switch (data) {
        case '\r': // Enter / Return
            let committedCommand = '';

            if (currentLine.trim().length > 0) {
                // Capture the text straight out of the commit pipeline 
                committedCommand = commitLine(currentLine);

                if (typeof terminalWrite === 'function') {
                    terminalWrite(committedCommand + '\n\r', 'user-input', true);
                }
            } else {
                // Fallback for when the user hits enter on an empty line
                commitLine('');
            }

            if (typeof window.triggerIncrementalSave === 'function') {
                window.triggerIncrementalSave();
            }

            try {
                window.lastNewLine = true;
                term.write('\n\r');

                // Pass the guaranteed, non-empty, frozen command string down to your parser
                if (typeof handleCommand === 'function') {
                    await handleCommand(committedCommand);
                }
            } catch (e) {
                if (typeof terminalWrite === 'function') {
                    terminalWrite(e.toString() + '\r\n' + (e.stack || e.stacktrace) + '\r\n');
                }
            }

            writePrompt();
            break;

        case '\u001b[A': // Up Arrow
            navigateHistory('up');
            break;

        case '\u001b[B': // Down Arrow
            navigateHistory('down');
            break;

        case '\u001b[D': // Left Arrow
            if (cursorPosition > 0) {
                setCursorPosition(cursorPosition - 1);
                term.write('\u001b[D');
            }
            break;

        case '\u001b[C': // Right Arrow
            if (cursorPosition < currentLine.length) {
                setCursorPosition(cursorPosition + 1);
                term.write('\u001b[C');
            }
            break;

        case '\u001b[H': // Home
        case '\u001bOH':
            if (cursorPosition > 0) {
                term.write(`\u001b[${cursorPosition}D`);
                setCursorPosition(0);
            }
            break;

        case '\u001b[F': // End
        case '\u001bOF':
            if (cursorPosition < currentLine.length) {
                term.write(`\u001b[${currentLine.length - cursorPosition}C`);
                setCursorPosition(currentLine.length);
            }
            break;

        case '\u001b[5~': // Page Up
            term.scrollLines(-Math.floor(term.rows / 2));
            break;

        case '\u001b[6~': // Page Down
            term.scrollLines(Math.floor(term.rows / 2));
            break;

        default: // Standard Type Splicing Pass
            if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e)) {
                const leftSide = currentLine.slice(0, cursorPosition);
                const rightSide = currentLine.slice(cursorPosition);

                setCurrentLine(leftSide + data + rightSide);
                setCursorPosition(cursorPosition + data.length);

                if (rightSide.length === 0) {
                    term.write(data);
                } else {
                    term.write(data + rightSide);
                    term.write(`\x1b[${rightSide.length}D`);
                }
            }
    }
    debounceTerminalStatus();
});

