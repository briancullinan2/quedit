const SCROLLBAR_WIDTH = 15

let TERMINATE = false


function updateSelectOptions(elementId, items, selectedValue = 'main') {
    const selector = elementId instanceof Element ? elementId : document.getElementById(elementId);
    if (!selector) return;

    // 1. Clear existing options
    selector.innerHTML = '';

    // 2. Create and append new options
    items.forEach(item => {
        // Handle both simple strings or GitHub branch objects
        const name = typeof item === 'object' ? item.name : item;
        const option = document.createElement('option');

        option.value = name;
        option.textContent = name;

        if (name === selectedValue) {
            option.selected = true;
        }

        selector.appendChild(option);
    });

    // 3. Force layout recalculation 
    // This helps with the "wont shrink" issue if the new text is shorter
    selector.style.minWidth = '0';
}



const tokenInput = document.getElementById('gh-token-input');
const modal = document.getElementById('token-modal');

function updatePlaceholder() {
    if (api.github_token && api.github_token.length > 0) {
        // Show a masked version so the user knows it's set
        const masked = api.github_token.substring(0, 4) + "•".repeat(12);
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
    SettingsManager.applyValue(IMPORT_SETTINGS.core.githubToken, tokenInput.value.trim())
    if (window.api.github_token) {
        tokenInput.value = ''; // Clear input for security
        alert('Token saved to local storage.');
    }
}

function clearToken() {
    localStorage.removeItem('github_token');
    updatePlaceholder();
}


function addRepoIfNotExists(newRepo) {

    if (newRepo.includes('briancullinan2')) {
        console.error('Assertion repo name is briancullinan2')
        debugger
    }

    if (newRepo.trim().length > 0 && !document.querySelector(`#repository option[value="${newRepo}"]`)) {
        const option = document.createElement('option');

        option.value = newRepo;
        option.textContent = newRepo;
        //option.selected = true;

        repo.appendChild(option);
        localStorage.setItem('repositories', Array.from(repo.children).map(c => c.value).join(';'))
    }
}


function addOwnerIfNotExists(newOwner) {
    if (newOwner.includes('Quake3e')) {
        console.error('Assertion owner name is Quake3e should be briancullinan2')
        debugger
    }

    if (newOwner && newOwner.trim().length > 0 && !document.querySelector(`#owner option[value="${newOwner}"]`)) {
        const option = document.createElement('option');

        option.value = newOwner;
        option.textContent = newOwner;
        option.selected = true;

        owner.appendChild(option);
        localStorage.setItem('owners', Array.from(owner.children).map(c => c.value).join(';'))
    }
}


async function setRepository(newRepo) {
    if (newRepo.trim().replace(/\/$|^\//, '').length == 0) return
    let parts = newRepo.split('/')
    let newOwner
    if (parts.length === 2) {
        newOwner = parts[0]
        newRepo = parts[1]
    }

    addRepoIfNotExists(newRepo)
    addOwnerIfNotExists(newOwner)
    if (newOwner === 'Quake3e') {
        console.error('Assertion: newOwner set to Quake3e should be ec- or briancullinan2')
        debugger
    }
    if (newOwner.trim())
        owner.value = newOwner;
    repository.value = newRepo;
    const branches = await getBranches(owner.value, repository.value)
    updateSelectOptions('branch', branches)
}


/**
 * Creates a functional frame rate limiter with a callback.
 * @param {number} targetFps - The desired frames per second.
 * @param {function} callback - Function called on render: (event, t, frame) => {}
 * @returns {object} An interface containing the requestFrameUpdate function.
 */
function createFrameRater(targetFps, callback) {
    const fpsInterval = 1000 / targetFps;

    // State variables held securely in the closure scope
    let lastDrawTime = performance.now();
    let needsRender = false;
    let currentEvent = null;
    let frameCount = 0;
    let startTime = lastDrawTime;

    // The looping tick function
    function tick(currentTime) {
        requestAnimationFrame(tick);

        const elapsed = currentTime - lastDrawTime;

        if (needsRender && elapsed >= fpsInterval) {
            // Keep timing consistent over long periods
            lastDrawTime = currentTime - (elapsed % fpsInterval);
            needsRender = false;
            frameCount++;

            // Calculate total elapsed time 't' since the rater started
            const t = currentTime - startTime;

            // Execute the user-provided callback with the requested parameters
            if (typeof callback === 'function') {
                callback(currentEvent, t, frameCount);
            }
        }
    }

    // Kick off the loop immediately
    requestAnimationFrame(tick);

    // Return only the public API method needed by external tools/mouse events
    return {
        requestFrameUpdate(e) {
            needsRender = true;
            currentEvent = e;
        }
    };
}


