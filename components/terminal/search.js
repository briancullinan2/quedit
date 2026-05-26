


const searchTerminal = document.getElementById('search-terminal');

let searchIndex = -1;
let searchResults = [];
let searchAddonMarkers = [];
let fileUnderlineMarkers = [];
let debounceTimeout = null;

/**
 * Completely wipes visual decorations and empties current result arrays.
 */
function clearSearch() {
    searchIndex = -1;
    searchResults = [];

    searchAddonMarkers.forEach(decoration => decoration.dispose());
    fileUnderlineMarkers.forEach(decoration => decoration.dispose());

    searchAddonMarkers = [];
    fileUnderlineMarkers = [];
}

/**
 * Scans ONLY the currently visible rows within the terminal's active viewport,
 * registering decorators on matches.
 * * @param {string} termToSearch - Token snippet query string.
 * @param {boolean} [caseSensitive=false] - Toggle strict case tracking flags.
 */
function scanVisibleViewport(termToSearch, caseSensitive = false) {
    // Clear past frame markers cleanly before reconstructing layout indices
    searchAddonMarkers.forEach(m => m.dispose());
    fileUnderlineMarkers.forEach(m => m.dispose());
    searchAddonMarkers = [];
    fileUnderlineMarkers = [];
    searchResults = [];

    const buffer = term.buffer.active;
    const activeRowMarkerOffset = buffer.baseY + buffer.cursorY;

    // Establish boundaries for scanning visible lines
    let startRow = buffer.viewportY;

    // Split-pane terminal adjustments fallback hook
    const softTab = document.querySelector('#terminals a[href="#soft"].active');
    if (softTab !== null) {
        startRow = buffer.viewportY + (term.rows / 2);
    }
    const endRow = startRow + term.rows;

    // Initialize literal pattern search matching boundaries
    let searchRegex = null;
    if (termToSearch && termToSearch.trim().length > 0) {
        const flags = caseSensitive ? 'g' : 'gi';
        searchRegex = new RegExp(termToSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }

    const themeColors = typeof getThemeColors === 'function' ? getThemeColors() : null;

    // Single linear lookup pass through current viewport rows
    for (let i = startRow; i < endRow; i++) {
        const line = buffer.getLine(i);
        if (!line) continue;

        const lineText = line.translateToString(true);
        const relativeMarkerDistance = i - activeRowMarkerOffset;

        // ==========================================
        // PASS A: Extract & Underline Valid File Paths
        // ==========================================
        let fileMatch;
        FILE_NAME_REGEX.lastIndex = 0;
        while ((fileMatch = FILE_NAME_REGEX.exec(lineText)) !== null) {
            const x = fileMatch.index;
            const length = fileMatch[0].length;

            const marker = term.registerMarker(relativeMarkerDistance);
            if (marker) {
                const decoration = term.registerDecoration({
                    marker,
                    x,
                    width: length,
                    layer: 'top'
                });

                if (decoration) {
                    decoration.onRender(element => {
                        element.style.pointerEvents = 'none';
                        element.classList.add('terminal-file-underline');
                    });
                    fileUnderlineMarkers.push(decoration);
                }
            }
        }


        // ==========================================
        // PASS B: Text Highlight Splicer
        // ==========================================
        if (searchRegex) {
            let searchMatch;
            searchRegex.lastIndex = 0;

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
                        backgroundColor: themeColors?.foreground || '#ffffff',
                        foregroundColor: themeColors?.background || '#000000',
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

/**
 * UI Status placeholder mutation layer.
 */
function updatesearchTerminalPlaceholder() {
    if (!searchTerminal || !searchTerminal.parentElement) return;

    const parent = searchTerminal.parentElement;
    if (searchTerminal.value.length <= 2) {
        parent.setAttribute('placeholder', 'Search...');
    } else if (searchResults.length === 0) {
        parent.setAttribute('placeholder', 'Search (0 results)...');
    } else {
        parent.setAttribute('placeholder', `Search (${searchIndex + 1}/${searchResults.length})...`);
    }
}

/**
 * Primary event processing pipe hooked up to key down updates.
 */
function executeFindQuery(event) {
    if (event && event.key === 'Enter') {
        event.preventDefault();
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const queryValue = searchTerminal.value;

        if (queryValue.length > 2) {
            scanVisibleViewport(queryValue);

            if (searchResults.length > 0) {
                if (event && event.key === 'Enter' && event.shiftKey) {
                    // Reverse cycle
                    searchIndex = (searchIndex <= 0) ? searchResults.length - 1 : searchIndex - 1;
                } else if (event && event.key === 'Enter') {
                    // Forward cycle
                    searchIndex = (searchIndex >= searchResults.length - 1) ? 0 : searchIndex + 1;
                } else {
                    // Snap tracking locus straight to closest visible line index 
                    const currentScroll = searchIndex > -1 && searchResults[searchIndex]
                        ? searchResults[searchIndex].line
                        : term.buffer.active.baseY;

                    let nearest = searchResults.findIndex(res => res.line >= currentScroll);
                    searchIndex = (nearest !== -1) ? nearest : 0;
                }

                term.scrollToLine(searchResults[searchIndex].line);
            }
        } else {
            clearSearch();
        }

        updatesearchTerminalPlaceholder();
    }, 250);
}

// Bind DOM listener explicitly to manage input changes internally
if (searchTerminal) {
    searchTerminal.addEventListener('keydown', executeFindQuery);
}
