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



window.isModifierPressed = false
window.isDragging = false


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
