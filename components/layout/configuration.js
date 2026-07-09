const SCROLLBAR_WIDTH = 15

let TERMINATE = false


const tokenInput = document.getElementById('gh-token-input');
const modal = document.getElementById('token-modal');
const tokenForm = document.getElementById('token-form')
tokenForm.addEventListener('submit', (e) => {
    e.stopPropagation()
    e.preventDefault()
    saveToken();
    return false;
})
modal.addEventListener('click', e => {
    e.stopPropagation()
    e.preventDefault()
    if (e.target.classList.contains('save-token')) {
        saveToken()
    } else if (e.target.classList.contains('clear-token')) {
        clearToken()
    } else if (e.target.classList.contains('close-btn')) {
        modal.classList.add('hidden');
    }
    return false;
})

function updatePlaceholder() {
    let token = typeof api !== 'undefined' && api.github_token && api.github_token.length > 0
        ? api.github_token
        : localStorage.getItem('github_token')
    if (token) {
        // Show a masked version so the user knows it's set
        const masked = token.substring(0, 4) + "•".repeat(12);
        tokenInput.placeholder = `Currently set: ${masked}`;
        tokenInput.classList.add('has-token');
    } else {
        tokenInput.placeholder = "Enter ghp your token here...";
        tokenInput.classList.remove('has-token');
    }

    // because hideOpenPanels() hides it in the same sequence
    setTimeout(() => modal.classList.remove('hidden'), 200);
}

function saveToken() {
    localStorage.setItem('github_token', tokenInput.value.trim())
    //SettingsManager.applyValue(IMPORT_SETTINGS.core.githubToken, tokenInput.value.trim())
    if (window.api.github_token) {
        tokenInput.value = ''; // Clear input for security
        alert('Token saved to local storage.');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
}

function clearToken() {
    localStorage.removeItem('github_token');
    updatePlaceholder();
}

function createFrameRater(targetFps, callback) {
    const fpsInterval = 1000 / targetFps;

    const startTime = performance.now();
    let frameCount = 0;

    const eventStack = [];
    let isFlushing = false; // The single logic protector

    // Permanent heartbeat interval running from startup
    setInterval(() => {
        // Only trigger if items are waiting AND we aren't currently inside a paint cycle
        if (eventStack.length > 0 && !isFlushing) {

            // Shallow copy and clear the stack immediately
            const currentBatch = [...eventStack];
            eventStack.length = 0;

            requestAnimationFrame((paintTime) => {
                isFlushing = true; // Lock out the interval thread during execution

                frameCount++;
                const t = paintTime - startTime;

                try {
                    if (typeof callback === 'function') {
                        // Drain the batch execution. Isolate each callback so a
                        // single throw can't drop the rest of the batch.
                        for (let i = 0; i < currentBatch.length; i++) {
                            try {
                                callback(currentBatch[i], t, frameCount);
                            } catch (e) {
                                console.error('frame callback failed', e);
                            }
                        }
                    }
                } finally {
                    // Always release the lock, even if a callback throws, so the
                    // limiter can never freeze permanently.
                    isFlushing = false;
                }
            });
        }
    }, fpsInterval);

    return {
        requestFrameUpdate(e) {
            eventStack.push(e);
        }
    };
}



const TESTPATH_ROOTS = ['', 'demoq3/pak0.pk3dir', 'docs/demoq3/pak0.pk3dir'];

/**
 * High-level workspace resolver. Ingests raw window paths, hashes, or explicit links,
 * extracts line numbers, runs prefix multiplexing, scans active VFS/IDB spaces,
 * and maps the request to a final active file node.
 * * @param {string} [hintPath] - Optional explicit file path to search instead of window state.
 * @returns {Promise<Array>} [resolvedLocation, repositoryKey, fileNode, lineNumber]
 */
async function findFileTestPath(hintPath) {
    // 1. Gather all raw potential source context vectors
    const rawPathCandidates = [
        hintPath,
        window.location.hash?.substring(1),
        window.location.pathname?.substring(1)
    ].filter(loc => typeof loc === 'string' && loc.trim().length > 0);

    if (rawPathCandidates.length === 0) return [null, null, null, null];

    // 2. Extract line anchors and cross-multiply candidates against TESTPATH_ROOTS
    const lookupQueue = rawPathCandidates.flatMap(rawCandidate => {
        const hasColon = rawCandidate.includes(':');
        const cleanPathPart = hasColon ? rawCandidate.split(':')[0] : rawCandidate;
        const extractedLine = hasColon ? parseInt(rawCandidate.split(':').pop(), 10) : null;

        return TESTPATH_ROOTS.map(root => {
            const delimiter = (root.length > 0 && !root.endsWith('/')) ? '/' : '';
            return {
                testPath: root + delimiter + cleanPathPart,
                line: extractedLine
            };
        });
    });

    // 3. Compile list of repositories declared in your core settings
    const activeRepositories = [
        window.engineRepository,
        window.gameRepository,
        window.assetRepository,
        window.toolsRepository,
        window.tools2Repository,
        window.environmentRepository
    ].filter(Boolean);

    // 4. Processing Loop: Evaluate every path variation against every storage layer
    for (const item of lookupQueue) {
        let selectedRepo = null;
        let dbFile = null;
        const currentPath = item.testPath;

        // LAYER A: Check Memory-Cached Repositories
        for (const repoKey of activeRepositories) {
            // Dynamic on-demand lazy load if missing
            if (!files[repoKey]) {
                const parts = repoKey.split('/');
                const ownerName = parts.length === 2 ? parts[0] : window.owner.value;
                const repoName = parts.length === 2 ? parts[1] : (parts[0] || window.repository.value);
                try {
                    const branch = await getDefaultBranch(ownerName, repoName);
                    await loadGitHubTree(ownerName, repoName, branch);
                } catch (err) {
                    console.warn(`Dynamic tree resolve failure for: ${repoKey}`, err);
                    continue;
                }
            }

            if (files[repoKey] && files[repoKey][currentPath]) {
                dbFile = files[repoKey][currentPath];
                selectedRepo = repoKey;
                if (trees[repoKey]) trees[repoKey].values = [dbFile.sha];
                break;
            }
        }

        // LAYER B: Check Client IndexedDB Database Contexts
        if (!dbFile) {
            const databases = await getDatabaseMetadata();
            let dbMeta
            for (dbMeta of databases) {
                const testFileKey = `${dbMeta.key}/${currentPath}`;
                try {
                    if (trees['#database']?.nodesById[testFileKey]) {
                        dbFile = trees['#database'].nodesById[testFileKey];
                        selectedRepo = dbMeta.key;
                        break;
                    }
                    const record = await getRecord(DB_STORE_NAME, currentPath, dbMeta.key);
                    if (record) {
                        if (trees['#database']) trees['#database'].nodesById[testFileKey] = record;
                        FS.virtual[currentPath] = record;
                        dbFile = record;
                        selectedRepo = dbMeta.key;
                        break;
                    }
                } catch (e) {
                    if (typeof window.writeLog === 'function') window.writeLog(e.message);
                }
            }
            if (dbFile && trees['#database'] && typeof dbMeta !== 'undefined') {
                trees['#database'].values = [dbMeta.key];
            }
        }


        // If this round found a hit, return the composite metadata array immediately
        if (dbFile) {
            console.log(`[VFS Resolved] File: ${currentPath} | Line: ${item.line}`);
            return [currentPath, selectedRepo, dbFile, item.line];
        }
    }

    return [null, null, null, null];
}

window.isModifierPressed = false
window.isDragging = false




function setTheme(theme) {
    const themeName = theme.split('/').pop(); // Gets 'monokai' or 'dracula'

    for (let cn of document.body.classList) {
        if (cn.startsWith('theme-')) {
            document.body.classList.remove(cn)
        }
    }

    document.body.classList.add(`theme-${themeName.replace(/_/g, '-')}`);
    // Actually tell Ace to change its internal theme too
    if (typeof aceEditor !== 'undefined')
        aceEditor.setTheme(theme);
    savedTheme = theme
    // wait for update on page so it can scan for colors out of css
    if (window.syncThemeWithAce)
        setTimeout(() => {
            syncThemeWithAce()
        }, 500);

}


const statusBar = document.getElementById('statusbar')

function getFullScreenFit(defaultFactor = 0.25) {
    const isFull = fullScreenLayout()
    const tools = document.getElementById('toolbar').clientHeight
        + statusBar.clientHeight;
    const height = (window.innerHeight - tools) * defaultFactor
    return height
}

function fullScreenLayout() {
    const width = window.document.body.clientWidth - SCROLLBAR_WIDTH
        - (window.document.body.clientWidth < 800 ? 60 : 0);
    return width < 800
}

const ki = [];
for (let t = 0; t < 256; t++)
    ki[t] = (t < 16 ? "0" : "") + t.toString(16);
function generateUUID() {
    const t = 4294967295 * Math.random() | 0
        , e = 4294967295 * Math.random() | 0
        , i = 4294967295 * Math.random() | 0
        , n = 4294967295 * Math.random() | 0;
    return (ki[255 & t] + ki[t >> 8 & 255] + ki[t >> 16 & 255] + ki[t >> 24 & 255] + "-" + ki[255 & e] + ki[e >> 8 & 255] + "-" + ki[e >> 16 & 15 | 64] + ki[e >> 24 & 255] + "-" + ki[63 & i | 128] + ki[i >> 8 & 255] + "-" + ki[i >> 16 & 255] + ki[i >> 24 & 255] + ki[255 & n] + ki[n >> 8 & 255] + ki[n >> 16 & 255] + ki[n >> 24 & 255]).toUpperCase()
}


/*
=======================================================================
Sys_CompileJsToWasmRef

Dynamically generates a minimal, isolated WebAssembly module in memory
that binds a JavaScript function to a true native WASM execution vector.
=======================================================================
*/
function Sys_CompileJsToWasmRef(jsFunction, paramCount = 1) {
    // WebAssembly Opcode Constants
    const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
    const WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

    const SECTION_TYPE = 1;
    const SECTION_IMPORT = 2;
    const SECTION_EXPORT = 7;

    const TYPE_I32 = 0x7f;
    const TYPE_FUNC = 0x60;

    // 1. Build the Type Section payload: (i32, i32, ...) -> i32
    // Generates an exact parameter map matching the requested arity footprint
    const typePayload = [
        0x01,                      // Number of types defined in this section
        TYPE_FUNC,                 // Form: Regular function type definition
        paramCount,                // Parameter count (e.g., 1 for dllEntry, or more for traps)
        ...Array(paramCount).fill(TYPE_I32), // Fill parameter types as i32 scalars
        0x01,                      // Return count
        TYPE_I32                   // Return type: i32
    ];

    // 2. Build the Import Section payload: Imports "env.f" matching Type Index 0
    const importPayload = [
        0x01,                      // Number of imports
        0x03, 0x65, 0x6e, 0x76,    // Module Name String: "env"
        0x01, 0x66,                // Field Name String: "f"
        0x00,                      // Kind: External Function
        0x00                       // Type Index mapped to Type Slot 0
    ];

    // 3. Build the Export Section payload: Exports internal function 0 as "f"
    const exportPayload = [
        0x01,                      // Number of exports
        0x01, 0x66,                // Export Name String: "f"
        0x00,                      // Kind: External Function
        0x00                       // Function Index: 0 (The imported function)
    ];

    // Helper function to format sections with standard LEB128 length headers
    function createSection(sectionId, payload) {
        return [sectionId, ...encodeLEB128(payload.length), ...payload];
    }

    // Combine sections into a solid, structured byte sequence
    const totalModuleBytes = new Uint8Array([
        ...WASM_MAGIC,
        ...WASM_VERSION,
        ...createSection(SECTION_TYPE, typePayload),
        ...createSection(SECTION_IMPORT, importPayload),
        ...createSection(SECTION_EXPORT, exportPayload)
    ]);

    // Instantiate the custom binary sandbox container instantly on the main thread
    const transientModule = new WebAssembly.Module(totalModuleBytes);
    const transientInstance = new WebAssembly.Instance(transientModule, {
        env: { f: jsFunction }
    });

    // Extract the raw, certified WebAssembly execution handler
    return transientInstance.exports.f;
}

// Minimal LEB128 unsigned integer length packer utility
function encodeLEB128(value) {
    const bytes = [];
    do {
        let byte = value & 0x7F;
        value >>= 7;
        if (value !== 0) byte |= 0x80;
        bytes.push(byte);
    } while (value !== 0);
    return bytes;
}

