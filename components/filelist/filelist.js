

const loadedDatabases = {}


let treeLoading = false
let refreshTree = null

async function expandDatabaseTree(target, folderId) {
    const parts = folderId.split('/')
    const database = folderId.startsWith('Virtual Memory') ? 'Virtual Memory' : (parts[0] + '/' + parts[1])
    const baseDir = folderId.startsWith('Virtual Memory') ? parts.slice(1).join('/') : parts.slice(2).join('/')
    const dirPath = baseDir.substring(0, baseDir.lastIndexOf('/'));
    const parentDir = database + (dirPath.trim().length > 0 ? ('/' + dirPath) : '')

    if (!target.classList.contains('treejs-node__open')) return
    if (!trees['#database'].nodesById[folderId]) return
    if (folderId.endsWith('[Recursive]')) return
    // if (loadedDatabases[folderId]) return


    try {

        // prevent mutation from triggering again when tree loads
        if (treeLoading) return
        treeLoading = true


        if (!hasUntared) {
            //await untarFrontent()
        }

        if (!files[database] && database !== 'Virtual Memory') {
            const parts = database.split('/')
            const ownerName = parts.length == 2 ? parts[0] : owner.value
            const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }

        let resultSet = {}
        let resultKeys = []
        if (database === 'Virtual Memory') {
            resultSet = FS.virtual
            resultKeys = Object.keys(FS.virtual)
            // TODO: query backend worker for IT's virtual memory, then ready it off the store or out of post message
        }
        else {

            let result = await queryIndex(DB_STORE_NAME, 'parent', baseDir, null, null, database)
            for (let r of result) {
                files[database][r.path] = FS.virtual[r.path] = r
            }
            let result2 = await queryIndex(DB_STORE_NAME, 'parent', baseDir + '/', null, null, database)
            for (let r of result2) {
                files[database][r.path] = FS.virtual[r.path] = r
            }

            resultSet = Object.values(files[database])
                .reduce((a, r) => {
                    a[r.path] = r
                    return a
                }, {})
            resultKeys = Object.keys(resultSet)
        }


        const childrenKeys = resultKeys.filter(path => {
            // Must start with the folder path
            let firstMatch = baseDir === '/' || baseDir === '' || path.startsWith(baseDir + '/')
            if (!firstMatch) return false;

            // Get the portion after the folder name
            const relativePath = path.substring(baseDir.length + 1);

            // It's an immediate child if there are no more slashes 
            // (or it's a directory ending in a single slash)
            const slashIndex = relativePath.indexOf('/');
            return slashIndex === -1 || slashIndex === relativePath.length - 1;
        });


        const newChildren = childrenKeys.map(path => {
            const node = resultSet[path];
            const isDir = node.mode === FS_DIR; // Use your constant or (node.mode >> 12) === ST_DIR
            const name = path.split('/').pop() || path;

            let newNode = {
                id: database + (path.length === 0 || path[0] === '/' ? '' : '/') + path,
                text: name,
                path: path,
                parent: trees['#database'].nodesById[folderId],
                status: 0,
                state: { open: false, expanded: false },
                // If it's a directory, give it a dummy child so it's expandable
                children: isDir ? [{ text: 'Loading...', id: `${path}/loading` }] : null
            };

            loadedDatabases[newNode.id] = trees['#database'].nodesById[newNode.id] = newNode

            let searchParent = loadedDatabases[parentDir].children
            let parentIndex = searchParent.findIndex(n => n.id === newNode.id)
            if (parentIndex > -1)
                searchParent[parentIndex] = newNode


            return newNode
        });

        if (newChildren.length === 0)
            newChildren.push({ text: 'Empty...', id: `${folderId}/empty` })

        sortNodes(newChildren)

        loadedDatabases[folderId].children = trees['#database'].nodesById[folderId].children = newChildren

    } catch (err) {
        console.error("Failed to load tree node: " + err.message + '\n\r' + (err.stack || err.stacktrace));
        loadedDatabases[folderId] = [{ text: 'Error loading files', id: 'err' }];
    }


    // ASYNC!
    showDatabases(folderId)


    if (refreshTree)
        clearTimeout(refreshTree)
    refreshTree = setTimeout(async () => {
        // give tree time to load and render
        trees['#database'].values = [] // [folderId]
        const node = trees['#database'].nodesById[folderId];

        if (node) {
            trees['#database'].open(node);
        }
        setTimeout(() => {
            // give expand time to animate without mutation
            treeLoading = false
        }, 300)
    }, 200)
}




async function showDatabases(folderId) {
    let databases = await getDatabaseMetadata()


    const topDatabases = []
    for (let d of databases) {

        if (!loadedDatabases[d.key]) {
            loadedDatabases[d.key] = {
                id: `${d.key}`,
                text: d.key,
                status: 0,
                state: {
                    open: false,
                    expanded: false
                },
                path: d.key,
                children: [{
                    id: `${d.key}/loading`,
                    text: 'Loading...',
                    status: 0,
                    state: {
                        open: false,
                        expanded: false
                    },
                    path: d.key + '/' + 'loading',
                }]
            }
        }

        topDatabases.push(loadedDatabases[d.key])
    }


    if (!loadedDatabases[`Virtual Memory`]) {
        loadedDatabases[`Virtual Memory`] = {
            id: `Virtual Memory`,
            text: `Virtual Memory`,
            status: 0,
            state: {
                open: false,
                expanded: false
            },
            path: `Virtual Memory`,
            children: [{
                id: `Virtual Memory/loading`,
                text: 'Loading...',
                status: 0,
                state: {
                    open: false,
                    expanded: false
                },
                path: `Virtual Memory/loading`,
            }]
        }
    }

    topDatabases.push(loadedDatabases['Virtual Memory'])


    if (!trees['#database']) {

        trees['#database'] = new Tree('#database', {

            data: topDatabases,
            autoOpen: false,
            closeDepth: null,
        });
    } else if (folderId) {
        trees['#database'].options.data = topDatabases
        trees['#database'].renderPartial(folderId)
    } else {
        //trees['#database'].options.data = topDatabases
        //trees['#database'].render(trees['#database'].options.data)
    }
}



function loadTree(database, cursor) {
    if (!cursor) {
        return resolve()
    }
    // already exists on filesystem, 
    //   it must have come with page
    if (files[database][cursor.path]
        && files[database][cursor.path].timestamp
        > cursor.timestamp) {
        // embedded file is newer, start with that
        return
    }

    files[database][cursor.path] = {
        timestamp: cursor.timestamp,
        mode: cursor.mode,
        contents: cursor.contents,
        path: cursor.path,
        sha: cursor.sha,
        parent: cursor.parent,
    }
}



const NavHistory = {
    stack: [],
    index: -1,
    isNavigating: false,

    // Call this whenever a file is opened or a "jump" happens
    push(fileId, row, column) {
        if (this.isNavigating) return;

        // If we were in the middle of the stack and did a new action, 
        // truncate the "forward" history (standard browser behavior)
        if (this.index < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.index + 1);
        }

        this.stack.push({ fileId, row, column });
        this.index = this.stack.length - 1;
    },

    back() {
        if (this.index > 0) {
            this.isNavigating = true;
            this.index--;
            this.apply();
            this.isNavigating = false;
        }
    },

    forward() {
        if (this.index < this.stack.length - 1) {
            this.isNavigating = true;
            this.index++;
            this.apply();
            this.isNavigating = false;
        }
    },

    apply() {
        const point = this.stack[this.index];
        let database = owner.value + '/' + repository.value
        const filePath = trees[database].nodesById[point.fileId].path
        window.currentOpenFileId = point.fileId; debugger
        trees[database].values = [point.fileId];
        debugger
        openFile(owner.value, repository.value, filePath, trees[database].nodesById[point.fileId].sha, false);

        aceEditor.gotoLine(point.row + 1, point.column);
    }
};


function recordFileHistory(filePath, sha, lineNumber = null) {
    // 1. Extract the raw filename from the path string (e.g., "docs/demoq3/ares.cfg" -> "ares.cfg")
    const fileNameMatch = filePath.match(/[^/\\#]+$/);
    const fileName = fileNameMatch ? fileNameMatch[0] : filePath;

    // 2. Resolve the final targeted row coordinates safely
    let targetLine = lineNumber;
    if (lineNumber === null && typeof aceEditor !== 'undefined') {
        targetLine = aceEditor.getCursorPosition().row + 1;
    }

    // 3. Build a slick, descriptive title string based on whether we have a target line
    const dynamicTitle = targetLine
        ? `${fileName} : ${targetLine} · Q3IDE`
        : `${fileName} · Q3IDE`;

    // 4. Force the active browser tab title to refresh explicitly
    document.title = dynamicTitle;

    if (typeof aceEditor !== 'undefined') {
        const pos = aceEditor.getCursorPosition();
        const finalLineNumber = targetLine !== null ? targetLine : (pos.row + 1);

        appendHistoryItem({
            filePath: filePath,
            sha: sha,
            row: pos.row,
            column: pos.column,
            lineNumber: finalLineNumber
        }, "file");

        NavHistory.push(sha, pos.row, pos.column);

        const hashRoute = `#${filePath}:${finalLineNumber}`;
        // Pass our newly formatted dynamicTitle directly into the history frame state context
        history.pushState({ location: window.location.toString(), title: dynamicTitle }, dynamicTitle, hashRoute);
    } else {
        const fallbackHash = '#' + filePath + (lineNumber ? ':' + lineNumber : '');
        history.pushState({ location: window.location.toString(), title: dynamicTitle }, dynamicTitle, fallbackHash);
    }
}



function extractNunuMetadata(actionObj) {
    // Default fallback configurations
    let icon = "🧊";
    let title = actionObj.action_description || "3D Object Change";
    let desc = "Engine modification recorded.";

    const actions = actionObj.actions || [];

    if (actions.length > 0) {
        // --- CASE 1: Spatial/Attribute Move Transform Data ---
        // (Identified by sub-actions containing "attribute", "newValue", "oldValue")
        if (actions[0].attribute !== undefined) {
            icon = "🚀";

            // Collect all transformed properties (e.g., ["x", "y", "z"])
            const targetAttributes = actions.map(a => a.attribute);
            const objectType = actions[0].object?.type || "Object3D";

            // Safely grab structural position arrays from the first modification descriptor
            const currentPos = actions[0].object || { x: 0, y: 0, z: 0 };

            if (targetAttributes.includes('x') && targetAttributes.includes('y') && targetAttributes.includes('z')) {
                title = `Translate ${objectType}`;
                desc = `Moved to Position: [${currentPos.x}, ${currentPos.y}, ${currentPos.z}]`;
            } else {
                // Individual fallback parameter modifications
                title = `Modify ${objectType}`;
                desc = actions.map(a => `${a.attribute}: ${a.oldValue} ➡️ ${a.newValue}`).join(' | ');
            }
        }

        // --- CASE 2: Complex Mesh / Object Insertion Elements ---
        // (Identified by multi-type structures containing geometry/resource keys)
        else {
            // Locate the core mesh/object descriptor block (typically the one with a target 'type')
            const meshNode = actions.find(a => a.type !== undefined) || actions[0];
            const geometryNode = actions.find(a => a.category === "geometries" || a.resource !== undefined);

            icon = "➕";

            const entityName = meshNode.name ? `"${meshNode.name}"` : "Entity";
            const entityType = meshNode.type || "Object3D";
            title = `Insert ${entityType}: ${entityName}`;

            if (meshNode.position) {
                const p = meshNode.position;
                desc = `Placed at [${p.x}, ${p.y}, ${p.z}]`;
            } else if (geometryNode?.resource?.type) {
                desc = `Geometry structure: ${geometryNode.resource.type}`;
            } else {
                desc = `UUID: ${meshNode.uuid ? meshNode.uuid.slice(0, 8) : 'N/A'}`;
            }
        }
    }

    return { icon, title, desc };
}




function extractAceMetadata(actionObj) {
    const fileName = actionObj.filePath ? actionObj.filePath.split('/').pop() : (actionObj.fileName || "Unknown File");
    const displayPath = actionObj.filePath || fileName;
    const row = actionObj.row !== undefined ? actionObj.row : 0;
    const column = actionObj.column !== undefined ? actionObj.column : 0;

    // Default configuration for core file actions
    let icon = "📄";
    let title = fileName;
    let desc = `Line ${row + 1}, Col ${column} — ${displayPath}`;

    // 1. Capture Active Text/Code Modifications
    if (actionObj.action_id === "ace_edit_action" || actionObj.delta) {
        icon = "📝";

        // Use the descriptive string generated by the listener if available
        title = actionObj.action_description || "Code Modified";

        const delta = actionObj.delta;
        if (delta) {
            const lineCount = delta.lines?.length || 1;
            const contextText = lineCount > 1 ? `${lineCount} lines` : `col ${column}`;
            desc = `${fileName} — ${delta.action === "remove" ? "Removed" : "Inserted"} at line ${row + 1} (${contextText})`;
        } else {
            desc = `Line ${row + 1}, Col ${column} — ${fileName}`;
        }
    }
    // 2. Capture Pure File State Changes / Navigation Events
    else if (actionObj.action_id === "file_action") {
        icon = "📄";
        title = fileName;
        desc = `Line ${row + 1}, Col ${column} — ${displayPath}`;
    }

    return { icon, title, desc };
}



function extractPaintMetadata(actionObj) {
    const subAction = actionObj.actions_to_do?.[0];
    const settings = subAction?.settings;
    const refLayer = subAction?.reference_layer;

    let icon = "🎨";
    let title = actionObj.action_description || "Graphics Modification";
    let desc = `UUID: ${actionObj.uuid ? actionObj.uuid.slice(0, 8) : 'N/A'}`;

    // 1. Capture Top Level Brush Creations
    if (actionObj.action_id === "new_brush_layer") {
        icon = "🖌️";
        title = "New Brush Layer";
        if (settings?.params) {
            desc = `Size: ${settings.params.size}px | Color: ${settings.color || 'none'}`;
        }
    }
    // 2. Capture Active Brush Vector Modifications/Strokes
    else if (actionObj.action_id === "update_brush_layer") {
        icon = "✍️";
        title = refLayer?.name || "Update Brush Layer";

        // Count coordinate arrays dynamically to give a useful description
        const strokeCount = settings?.data?.length || refLayer?.data?.length || 0;
        const dimensions = refLayer ? ` (${Math.round(refLayer.width)}x${Math.round(refLayer.height)}px)` : "";

        desc = `Modified ${strokeCount} vector paths${dimensions}`;
    }
    // 3. Capture General Core Layer Updates
    else if (subAction?.action_id === "update_layer") {
        icon = "🔄";

        // Fall back gracefully to reference_layer values if settings properties are empty
        const layerName = settings?.name || refLayer?.name || "Layer";
        const layerType = settings?.type || refLayer?.type || "Unknown";
        const layerOrder = settings?.order !== undefined ? settings.order : (refLayer?.order !== undefined ? refLayer.order : "N/A");

        title = `Update Layer: ${layerName}`;
        desc = `Type: ${layerType} | Order position: ${layerOrder}`;
    }

    return { icon, title, desc };
}





function extractAudioMetadata(actionObj) {
    const trackName = actionObj.trackName || actionObj.fileName || "Untitled Audio";
    const operation = actionObj.operation || "Audio Edit"; // e.g., 'Cut', 'Gain', 'Normalize', 'Fade In'

    // Default fallback configurations
    let icon = "🎵";
    let title = `${operation}: ${trackName}`;
    let desc = "Audio track modified.";

    // Format timestamps cleanly if byte regions or track selections exist
    if (actionObj.startRegion !== undefined && actionObj.endRegion !== undefined) {
        const start = Number(actionObj.startRegion).toFixed(2);
        const end = Number(actionObj.endRegion).toFixed(2);
        desc = `Region: ${start}s to ${end}s (${(end - start).toFixed(2)}s selection)`;
    } else if (actionObj.duration) {
        desc = `Total track length: ${Number(actionObj.duration).toFixed(2)}s`;
    } else if (actionObj.action_description) {
        desc = actionObj.action_description;
    }

    // Contextual icon assignment based on common DAW / AudioMass processes
    const opLower = operation.toLowerCase();
    if (opLower.includes('cut') || opLower.includes('crop') || opLower.includes('trim')) {
        icon = "✂️";
    } else if (opLower.includes('volume') || opLower.includes('gain') || opLower.includes('fade')) {
        icon = "🔊";
    } else if (opLower.includes('effect') || opLower.includes('delay') || opLower.includes('reverb')) {
        icon = "🎛️";
    } else if (opLower.includes('reverse') || opLower.includes('invert')) {
        icon = "⏪";
    }

    return { icon, title, desc };
}



const fileHistory = document.getElementById('fileHistory');
const historyMenu = document.getElementById('historyMenu');
historyMenu.innerHTML = ''
function appendHistoryItem(actionData, type = "paint") {
    if (!historyMenu) return;

    if (historyMenu.children.length === 1 && historyMenu.children[0].getAttribute('value') === '') {
        historyMenu.children[0].remove();
    }

    // 1. Resolve raw details based on incoming type string
    let meta = { icon: "⚡", title: "Action Captured", desc: "System update logged." };

    if (type === 'editor') {
        meta = extractAceMetadata(actionData);
    } else if (type === 'nunu') {
        meta = extractNunuMetadata(actionData);
    } else if (type === 'audio') {
        meta = extractAudioMetadata(actionData);
    } else if (type === "paint") {
        meta = extractPaintMetadata(actionData);
    } else if (type === "file") {
        meta = {
            icon: "📄",
            title: actionData.filePath.split('/').pop(),
            desc: `Line ${actionData.row + 1}, Col ${actionData.column} — ${actionData.filePath}`
        };
    }

    // --- NEW: Generate standard 12-hour timestamp format (e.g., "10:42 AM") ---
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // 2. Create the list node item atomically
    const li = document.createElement('li');
    li.className = "history-item undo";
    li.userData = actionData;

    // --- NEW: Set data attributes for easy state recovery later ---
    li.setAttribute('data-icon', meta.icon);
    li.setAttribute('data-title', meta.title);
    li.setAttribute('data-time', timeString);

    // 3. Inject the template payload strings
    li.innerHTML = `
        <div class="item-header">
            <span class="action-icon">${meta.icon}</span>
            <strong>${meta.title}</strong>
        </div>
        <p class="item-desc">${meta.desc} <span class="item-time-stamp">(${timeString})</span></p>
    `;

    // 4. Prepend it to the top of the history list stack
    if (historyMenu.children.length > 0) {
        historyMenu.insertBefore(li, historyMenu.children[0]);
    } else {
        historyMenu.appendChild(li);
    }

    // --- NEW: Automate visual synchronization to the active trigger button ---
    updateTriggerButtonValue(meta.icon, meta.title, timeString);
}



function updateTriggerButtonValue(icon, title, timeStr) {
    const trigger = document.getElementById('fileHistory');
    if (!trigger) return;

    const valueContainer = trigger.querySelector('.selected-value');
    if (valueContainer) {
        // Keeps your look clean: Render custom emoji icon alongside the title string and timestamp
        valueContainer.innerHTML = `
            <span class="trigger-icon-wrapper">${icon}</span>
            <span>${title} (${timeStr})</span>
        `;
    }
}



window.addEventListener('popstate', (event) => {
    renderHashCommand(window.location.hash.substring(1))
});

window.addEventListener('hashchange', (event) => {
    //renderHashCommand(window.location.hash.substring(1))
});



function treeHandler(selector, e) {
    const node = e.target.closest('.treejs-node');
    if (!node) return

    const fileId = node.getAttribute('data-id'); // Assuming you set this
    //setTimeout(() => trees[selector].values = [fileId], 500)

    if (fileId.endsWith['[Recursive]']) {
        return
    }

    if (node && node.classList.contains('treejs-placeholder')) {
        const filePath = trees[selector].nodesById[fileId].path
        window.currentOpenFileId = trees[selector].nodesById[fileId].sha;

        let selected = owner.value + '/' + repository.value
        let nodeDB
        if (nodeDB = node.getAttribute('data-database')) {
            selected = nodeDB
        }
        if (node.closest('#filelist')) {
            selected = engineRepository
        }
        if (node.closest('#gamelist')) {
            selected = gameRepository
        }
        if (node.closest('#assetRepo')) {
            selected = assetRepository
        }
        if (node.closest('#database')) {
            let parent = node.closest('#database > div > ul > li[data-id]')
            if (nodeDB = parent.getAttribute('data-id'))
                selected = nodeDB

        }
        if (node.closest('#github')) {
            let parent = node.closest('#github > div > ul > li[data-id]')
            if (nodeDB = parent.getAttribute('data-id'))
                selected = nodeDB

        }

        const parts = selected.split('/')
        const newRepo = parts.length == 2 ? parts[1] : parts[0] || repository.value
        const newOwner = parts.length == 2 ? parts[0] : owner.value

        openFile(newOwner, newRepo, filePath, trees[selector].nodesById[fileId].sha);
    }
}


document.getElementById('github').addEventListener('click', treeHandler.bind(null, '#github'));
document.getElementById('filelist').addEventListener('click', treeHandler.bind(null, '#filelist'));
document.getElementById('gamelist').addEventListener('click', treeHandler.bind(null, '#gamelist'));
document.getElementById('assetlist').addEventListener('click', treeHandler.bind(null, '#assetlist'));
document.getElementById('database').addEventListener('click', treeHandler.bind(null, '#database'));



const FILELIST_IDS = ['searchlist', 'filelist', 'gamelist', 'assetlist', 'database', 'github']

let panels = document.querySelectorAll('#audio-editor, #nunu, #paint, #token-modal, #viewport-frame, #terminal-container, #editor, #searchlist, #filelist, #gamelist, #assetlist, #database, #github')

document.getElementById('tabs').addEventListener('click', async (e) => {

    renderTabsCommand(e.target.href?.split('#').pop())

});


async function initializeFiletrees() {
    const newRepository = window.location.pathname?.trim().replace(/\/$|^\//, '')
    if (newRepository.length > 0) {
        await setRepository(newRepository)
    } else if (window.location.hash.includes('/')
        // TODO: make a caveat for #database??
        && !window.location.hash.includes('.') // don't try this on filenames
    ) {
        await setRepository(window.location.hash.substring(1))
    }


    engineRepository = SettingsManager.get('core', 'engineRepository')

    const parts = engineRepository?.split('/') || document.getElementById('filelist').dataset['repository']?.split('/')

    if (parts && parts[0]) {
        let newRepo = parts.length == 2 ? parts[1] : parts[0] || repository.value
        let newOwner = parts.length == 2 ? parts[0] : owner.value
        let branches = await getBranches(newOwner, newRepo)
        updateSelectOptions('branch', branches)
        if (newOwner && newRepo)
            await loadFileTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')
    }

    gameRepository = SettingsManager.get('core', 'gameRepository')

    const parts2 = gameRepository?.split('/') || document.getElementById('gamelist').dataset['repository']?.split('/')
    if (parts2 && parts2[0]) {

        let newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repository.value
        let newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
        let branches2 = await getBranches(newOwner2, newRepo2)

        if (newOwner2 && newRepo2)
            await loadFileTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')
    }


    assetRepository = SettingsManager.get('core', 'assetRepository')

    const parts3 = assetRepository?.split('/') || document.getElementById('assetlist').dataset['repository']?.split('/')

    if (parts3 && parts3[0]) {

        let newRepo3 = parts3.length == 2 ? parts3[1] : parts3[0] || repository.value
        let newOwner3 = parts3.length == 2 ? parts3[0] : owner.value
        let branches3 = await getBranches(newOwner3, newRepo3)

        if (newOwner3 && newRepo3)
            await loadFileTree(newOwner3, newRepo3, branches3[0]?.name || 'main', '#assetlist')

    }

    await showDatabases()

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const folderId = target.getAttribute('data-id');

                // Check if the node just became expanded
                if (target.classList.contains('treejs-node__open')) {
                    expandDatabaseTree(target, folderId)
                }
            }
        });
    });

    // Observe the tree container for any class changes on nodes
    observer.observe(document.querySelector('#database'), {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });


    await showGithubTree()

    const observer2 = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const folderId = target.getAttribute('data-id');

                // Check if the node just became expanded
                if (target.classList.contains('treejs-node__open')) {
                    expandGithubTree(target, folderId)
                }
            }
        });
    });

    // Observe the tree container for any class changes on nodes
    observer2.observe(document.querySelector('#github'), {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
}

const loadedGithubTreeNodes = {};
let githubTreeLoading = false;
let refreshGithubTree = null;

/**
 * Renders the top-level repository list inside the #github sidebar panel element.
 */
async function showGithubTree(folderId) {
    // 1. Gather all unique repo contexts defined in your environment settings
    const repoCollection = new Set([
        SettingsManager.get('core', 'engineRepository'),
        SettingsManager.get('core', 'gameRepository'),
        SettingsManager.get('core', 'assetRepository')
    ].filter(Boolean)); // Strip out undefined or empty configs

    const topRepositories = [];

    for (const repoKey of repoCollection) {
        if (!loadedGithubTreeNodes[repoKey]) {
            loadedGithubTreeNodes[repoKey] = {
                id: repoKey,
                text: repoKey, // e.g. "owner/repo-name"
                status: 0,
                state: { open: false, expanded: false },
                path: repoKey,
                // Give it an immediate dummy loading block so it renders an expander icon arrow
                children: [{
                    id: `${repoKey}/loading`,
                    text: 'Loading...',
                    status: 0,
                    state: { open: false, expanded: false },
                    path: `${repoKey}/loading`
                }]
            };
        }
        topRepositories.push(loadedGithubTreeNodes[repoKey]);
    }

    // 2. Initialize or incrementally patch partial nodes on the Tree instance layout target
    if (!trees['#github']) {
        trees['#github'] = new Tree('#github', {
            data: topRepositories,
            autoOpen: false,
            closeDepth: null
        });
    } else if (folderId) {
        trees['#github'].options.data = topRepositories;
        trees['#github'].renderPartial(folderId);
    }
}


const githubWorker = new Worker('/components/filelist/commit-worker.js');

// Track active callback resolvers for our async tree nodes
const pendingTreeRequests = {};

githubWorker.onmessage = function (e) {
    const { type, status, modified, added, error, callbackId } = e.data;

    if (type === 'staging_status') {
        const request = pendingTreeRequests[callbackId];
        if (!request) return;

        delete pendingTreeRequests[callbackId];

        if (status === 'SUCCESS') {
            // Forward the dirty file arrays directly into the layout compiler
            buildGithubTreeFromStaging(request.target, request.folderId, { modified, added });
        } else {
            console.error("Worker status check failed:", error);
            const folderId = request.folderId;
            loadedGithubTreeNodes[folderId].children = [{ text: 'Error tracking files', id: `${folderId}/err` }];
            finalizeGithubTreeExpansion(folderId);
        }
    }

    if (type === 'commit_status') {
        // Handle your post-commit layout resets here
        writeLog(`Commit response signature: ${status}`);
    }
};

async function expandGithubTree(target, folderId) {
    const parts = folderId.split('/');
    const database = `${parts[0]}/${parts[1]}`; // Isolate owner/repo segment

    if (!target.classList.contains('treejs-node__open')) return;
    if (!trees['#github'].nodesById[folderId]) return;

    try {
        if (githubTreeLoading) return;
        githubTreeLoading = true;

        // Ensure remote baseline structure is populated locally 
        if (!files[database]) {
            let branch = await getDefaultBranch(parts[0], parts[1]);
            await loadGitHubTree(parts[0], parts[1], branch);
        }

        // --- LAYER A: REPOSITORY LEVEL ROOT ---> IMMEDIATE STRUCTURAL INJECTION
        if (parts.length === 2) {
            let newChildren = [
                {
                    id: `${database}/Modified`,
                    text: 'Modified',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Modified/loading` }]
                },
                {
                    id: `${database}/Added`,
                    text: 'Added',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Added/loading` }]
                },
                {
                    id: `${database}/Staged`,
                    text: 'Staged',
                    status: 0,
                    state: { open: false, expanded: false },
                    children: [{ text: 'Loading...', id: `${database}/Staged/loading` }]
                }
            ];

            loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = newChildren;
            showGithubTree(folderId);
            finalizeGithubTreeExpansion(folderId);
        }

        // --- LAYER B: STATUS SUB-CATEGORIES ---> MESSAGE HANDOFF
        const callbackId = `tree_sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // Cache the execution arguments to process when onmessage fires
        pendingTreeRequests[callbackId] = { target, folderId };

        // Query the worker dry-run staging verification pipeline
        githubWorker.postMessage({
            type: 'COMMIT_STATUS_CHECK',
            owner: parts[0],
            repo: parts[1],
            branch: await getDefaultBranch(parts[0], parts[1]),
            gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
            callbackId: callbackId
        });

    } catch (err) {
        console.error("Failed handling async root branch dependencies:", err);
        loadedGithubTreeNodes[folderId].children = [{ text: 'Error connecting to worker', id: `${folderId}/err` }];
        finalizeGithubTreeExpansion(folderId);
    }
}




function buildGithubTreeFromStaging(target, folderId, stagingDetails) {
    const parts = folderId.split('/');
    const database = `${parts[0]}/${parts[1]}`;

    // --- MODE A: REPOSITORY ROOT LEVEL EXPANSION (parts.length === 2) ---
    if (parts.length === 2) {
        // We compile the three fixed parent nodes, seeding their children lists immediately 
        // by passing down deeper virtual folder IDs to our own parsing logic.
        const modifiedChildren = compileStagingLevelChildren(`${folderId}/Modified`, '', stagingDetails.modified || []);
        const addedChildren = compileStagingLevelChildren(`${folderId}/Added`, '', stagingDetails.added || []);
        const stagedChildren = []; // Explicit staged hook destination

        const rootCategories = [
            {
                id: `${database}/Modified`,
                text: `Modified (${stagingDetails.modified.length})`,
                status: 0,
                state: { open: false, expanded: false },
                children: modifiedChildren.length > 0 ? modifiedChildren : [{ text: 'Empty...', id: `${database}/Modified/empty` }]
            },
            {
                id: `${database}/Added`,
                text: `Added (${stagingDetails.added.length})`,
                status: 0,
                state: { open: false, expanded: false },
                children: addedChildren.length > 0 ? addedChildren : [{ text: 'Empty...', id: `${database}/Added/empty` }]
            },
            {
                id: `${database}/Staged`,
                text: 'Staged (0)',
                status: 0,
                state: { open: false, expanded: false },
                children: stagedChildren.length > 0 ? stagedChildren : [{ text: 'Empty...', id: `${database}/Staged/empty` }]
            }
        ];

        // Register the static categories into the node lookup dictionary
        rootCategories.forEach(catNode => {
            loadedGithubTreeNodes[catNode.id] = trees['#github'].nodesById[catNode.id] = catNode;
        });

        loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = rootCategories;

        showGithubTree(folderId);
        finalizeGithubTreeExpansion(folderId);
        return;
    }

    // --- MODE B: NESTED CATEGORY OR SUBDIRECTORY EXPANSION ---
    const statusCategory = parts[2];          // 'Modified', 'Added', or 'Staged'
    const baseDir = parts.slice(3).join('/'); // Subdirectory extraction path

    let matchingPaths = [];
    if (statusCategory === 'Modified') {
        matchingPaths = stagingDetails.modified || [];
    } else if (statusCategory === 'Added') {
        matchingPaths = stagingDetails.added || [];
    }

    // Process deep folder layouts dynamically 
    const dynamicChildren = compileStagingLevelChildren(folderId, baseDir, matchingPaths);
    loadedGithubTreeNodes[folderId].children = trees['#github'].nodesById[folderId].children = dynamicChildren;

    showGithubTree(folderId);
    finalizeGithubTreeExpansion(folderId);
}


/**
 * Pure parsing helper to structure a group of paths for a specific UI node location point.
 */
function compileStagingLevelChildren(folderId, baseDir, matchingPaths) {
    const newChildren = [];
    const directoriesFound = new Set();
    const absoluteFilesFound = [];

    matchingPaths.forEach(path => {
        let matchesDirPrefix = baseDir === '' ? true : path.startsWith(baseDir + '/');
        if (!matchesDirPrefix) return;

        const relativePart = baseDir === '' ? path : path.substring(baseDir.length + 1);
        const nextSlashIdx = relativePart.indexOf('/');

        if (nextSlashIdx === -1) {
            absoluteFilesFound.push(path);
        } else {
            directoriesFound.add(relativePart.substring(0, nextSlashIdx));
        }
    });

    // 1. Compile Directories
    directoriesFound.forEach(dirName => {
        const computedPath = baseDir === '' ? dirName : `${baseDir}/${dirName}`;
        const nodeId = `${folderId}/${dirName}`;

        const dirNode = {
            id: nodeId,
            text: dirName,
            path: computedPath,
            status: 0,
            state: { open: false, expanded: false },
            children: [{ text: 'Loading...', id: `${nodeId}/loading` }]
        };

        loadedGithubTreeNodes[nodeId] = trees['#github'].nodesById[nodeId] = dirNode;
        newChildren.push(dirNode);
    });

    // 2. Compile Files
    absoluteFilesFound.forEach(path => {
        const name = path.split('/').pop() || path;
        const nodeId = `${folderId}/${name}`;

        const fileNode = {
            id: nodeId,
            text: name,
            path: path,
            status: 0,
            state: { open: false, expanded: false },
            children: null
        };

        loadedGithubTreeNodes[nodeId] = trees['#github'].nodesById[nodeId] = fileNode;
        newChildren.push(fileNode);
    });

    if (newChildren.length > 0) {
        sortNodes(newChildren);
    }

    return newChildren;
}



function finalizeGithubTreeExpansion(folderId) {
    if (refreshGithubTree) clearTimeout(refreshGithubTree);
    refreshGithubTree = setTimeout(async () => {
        trees['#github'].values = [];
        const node = trees['#github'].nodesById[folderId];
        if (node) {
            trees['#github'].open(node);
        }
        setTimeout(() => { githubTreeLoading = false; }, 300);
    }, 200);
}

