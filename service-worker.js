'use strict';

const api = {
    github_token: null
}
const ERROR_PREAMBLE = '\x1b[38;5;196m[ERROR]\x1b[0m ';       // Intense Crimson Red
const GITHUB_PREAMBLE = '\x1b[38;5;27m[GITHUB]\x1b[0m ';      // Deep Brand Blue

console.log('🔴 [SW-TRACE] Initial script execution block started.');

// Helper to load a script from IDB VFS and evaluate it in the worker context
async function importScriptFromVFS(assetUrl) {
    assetUrl = assetUrl.replace(/^\/?assets\/|^\//ig, '');
    const localName = '/base' + (assetUrl.startsWith('/') ? '' : '/') + assetUrl;

    console.log(`💾 [SW-INIT] Attempting VFS database extraction for script: "${localName}"`);

    const fileRecord = await getRecord(DB_STORE_NAME, localName, api.environmentRepository);

    if (!fileRecord || !fileRecord.contents) {
        throw new Error(`Script "${localName}" not found in IndexedDB VFS.`);
    }

    // Decode the Uint8Array binary array into a raw text string
    const decoder = new TextDecoder('utf-8');
    const scriptText = decoder.decode(fileRecord.contents);

    // Execute the script globally inside the Service Worker context
    // This accomplishes exactly what importScripts() does synchronously
    globalThis.eval(scriptText);
    console.log(`✨ [SW-INIT] Successfully evaluated script from VFS: "${localName}"`);
}

// Orchestrator to attempt standard import, falling back to VFS if offline
async function initializeCoreScripts() {
    const scriptsToLoad = [
        '/components/core/local.js',
        '/components/core/extensions.js',
        '/components/filelist/github.js'
    ];

    for (const script of scriptsToLoad) {
        try {
            console.log(`🔗 [SW-TRACE] Attempting native script import: ${script}`);
            // Try standard synchronous network import first
            self.importScripts(script);
            console.log(`✅ [SW-TRACE] Imported natively: ${script}`);
        } catch (netError) {
            console.warn(`⚠️ [SW-WARN] Native import failed for ${script}. Swapping to VFS fallback engine...`, netError);
            try {
                // Network failed (offline), extract out of IndexedDB VFS instead
                await importScriptFromVFS(script);
            } catch (vfsError) {
                console.error(`❌ [SW-CRITICAL] Total collapse. Failed to load ${script} from Network AND VFS:`, vfsError);
            }
        }
    }
}

// Execute the bootloader process
initializeCoreScripts();



const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/];
const offlineAssetsExclude = [/service-worker-assets\.js$|^service-worker/];

const ST_FILE = 8;
const ST_DIR = 4;
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6);
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT;
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT;


// Global in-memory cache to prevent concurrent mkdirp race conditions
const createdDirectories = new Set();

async function mkdirp(path) {
    let segments = path.split(/\/|\\/gi).filter(Boolean);

    // Build the path layers sequentially
    for (let i = 1; i <= segments.length; i++) {
        const dir = '/' + segments.slice(0, i).join('/');

        // If this directory layer was already created in this lifecycle loop, skip it entirely!
        if (createdDirectories.has(dir)) {
            continue;
        }

        const lastSlashIndex = dir.lastIndexOf('/');
        const parentDir = lastSlashIndex === 0 ? '/' : dir.substring(0, lastSlashIndex);

        console.log(`📂 [SW-FS] Safely writing isolated directory block: "${dir}"`);

        try {
            await putRecord(DB_STORE_NAME, {
                path: dir,
                timestamp: new Date(),
                mode: FS_DIR,
                parent: parentDir
            }, api.environmentRepository);

            // Mark it as safely committed to avoid parallel thrashing
            createdDirectories.add(dir);
        } catch (dbErr) {
            console.error(`❌ [SW-DATABASE] mkdirp failed to store record for "${dir}":`, dbErr);
        }
    }
}

function getHeaders(response) {
    const newHeaders = new Headers(response?.headers);
    newHeaders.set('X-Service-Worker-Handled', 'true');
    newHeaders.set('Content-Security-Policy', "script-src 'self' 'unsafe-eval' 'sha256-iN7wpJdxHlpujRppkOA8N0+Mzp0ZqZr3lCtxM00Y63c='; worker-src 'self' blob:;");
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return newHeaders
}

async function fetchAsset(urlInput, key, selected) {
    selected ||= api.environmentRepository

    if (!urlInput) {
        debugger;
        console.error('HOW DID YOU FUCK THIS UP?');
        throw new Error('HOW DID YOU FUCK THIS UP?');
    }

    // Extract the string URL immediately, regardless of what was passed in
    const urlString = typeof urlInput === 'string' ? urlInput : urlInput.url;

    console.log(`🌐 [SW-NET] fetchAsset initiated. URL: "${urlString}" | Internal Key: "${key}"`);
    const timeoutSignal = AbortSignal.timeout(10000);
    let response;

    try {
        if (typeof urlInput === 'string') {
            console.log(`🌐 [SW-NET] Launching string-type fetch request. Cache: no-store for URL: "${urlString}"`);
            response = await fetch(urlInput, {
                cache: 'no-store',
                credentials: 'omit',
                signal: timeoutSignal
            });
        } else {
            console.log(`🌐 [SW-NET] Launching direct Request object pass-through fetch for URL: "${urlString}"`);
            // If passing a Request object, clone it if it's going to be reused or has a body
            response = await fetch(urlInput);
        }

        console.log(`🌐 [SW-NET] Fetch response received for "${key}". Status: ${response.status} (${response.statusText}) | Type: ${response.type}`);

        if (response.redirected || response.type === 'opaqueredirect') {
            // FIXED: Using the guaranteed string variable here
            if (!urlString.includes('index.html')) {
                console.warn(`⚠️ [SW-WARN] Asset file was intercepted by a REDIRECT payload: ${urlString} -> Target: ${response.url}`);
            }
            const newHeaders = getHeaders(response);
            newHeaders.set('Location', response.url);

            console.log(`🔄 [SW-NET] Fabricating 302 redirection response bridge for "${key}"`);
            isOffline = false;

            return new Response(null, {
                status: 302,
                statusText: response.statusText,
                url: response.url,
                headers: newHeaders
            });
        }

        if (!response.ok && response.type !== 'opaque') {
            console.error(`❌ [SW-NET] Response evaluation failed validation checks for "${key}". Status code is bad.`);
            throw new Error(`Request for ${key} failed with status: ${response.status}`);
        }

        console.log(`📦 [SW-BUFFER] Cloning fetch response body stream safely to avoid consumption locks for "${key}"`);
        let content = await response.clone().arrayBuffer();
        console.log(`📦 [SW-BUFFER] ArrayBuffer extraction complete for "${key}". Length: ${content.byteLength} bytes.`);

        key = key.replace(/^\/?base\/|^\/?assets\/|^\//ig, '');
        let localKey = '/base' + (key.startsWith('/') ? '' : '/') + key;
        let dirPath = localKey.substring(0, localKey.lastIndexOf('/'));

        console.log(`📂 [SW-FS] Staging VFS mapping coordinates. localKey: "${localKey}" | dirPath: "${dirPath}"`);

        await mkdirp(dirPath);

        console.log(`💾 [SW-DATABASE] Writing payload binary content into IndexedDB Store: "${DB_STORE_NAME}" -> Target Key: "${localKey}"`);
        if (!localKey.includes('.')) {
            debugger;
            console.error("WHAT THE FUCK IS WRONG WITH YOU? " + key);
        }
        const isGithubContents = urlString.includes('api.github.com') && urlString.includes('/contents/')
        if (!isGithubContents) {
            await putRecord(DB_STORE_NAME, {
                path: localKey,
                timestamp: new Date(),
                mode: FS_FILE,
                contents: new Uint8Array(content),
                parent: dirPath
            }, selected);
            console.log(`✅ [SW-DATABASE] Successfully wrote "${localKey}" to local storage block.`);
        }

        isOffline = false;

        return new Response(content, {
            status: response.status,
            statusText: response.statusText,
            headers: getHeaders(response)
        });

    } catch (err) {
        console.error(`❌ [SW-CATCH] Exception intercepted inside fetchAsset for "${key}":`, err);

        if (!navigator.onLine || err instanceof TypeError) {
            console.warn(`⚠️ [SW-STATUS] Network state evaluated as OFFLINE. Flagging environment status state.`);
            isOffline = true;
        }

        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            console.error(`⏱️ [SW-TIMEOUT] Asset fetching operation timed out (>10000ms threshold) for: "${key}"`);
        }

        console.log(`🔺 [SW-CATCH] Re-throwing error to maintain execution bubble guarantees.`);
        throw err;
    }
}


let assetLookup = null;

async function installAssets() {
    console.log('⚙️ [SW-INSTALL] Executing asset installer verification.');

    if (!api.environmentRepository) {
        debugger
        throw new Error('Learn how to code fucking dumbass.')
    }

    try {
        const databases = await getDatabaseMetadata();
        console.log('⚙️ [SW-INSTALL] Extracted internal IndexedDB metadata dictionaries:', databases);
        const shouldInstall = (await needsInstall(api.environmentRepository, DB_SCHEME)).item3
        if (databases.filter(d => d.key == api.environmentRepository).length == 0
            || shouldInstall) {
            console.warn(`⚠️ [SW-DATABASE] Target database "${api.environmentRepository}" missing. Initializing core database maps now.`);
            await deleteOldDatabase(api.environmentRepository)
            await setupDatabase(api.environmentRepository, DB_SCHEME);
            console.log(`✅ [SW-DATABASE] Target database infrastructure initialized cleanly.`);
        }
    } catch (dbSetupErr) {
        console.error('❌ [SW-DATABASE] Database lookup/instantiation failure loop caught:', dbSetupErr);
    }

    console.log(`⚙️ [SW-INSTALL] Deduplication complete. Found ${uniqueAssets.length} total base assets to evaluate.`);

    const assets = uniqueAssets
        .filter(asset => {
            const isIncluded = offlineAssetsInclude.some(pattern => pattern.test(asset));
            if (!isIncluded) console.log(`🗑️ [SW-FILTER] Asset excluded (failed inclusion whitelist match): "${asset}"`);
            return isIncluded;
        })
        .filter(asset => {
            const isExcluded = offlineAssetsExclude.some(pattern => pattern.test(asset));
            if (isExcluded) console.log(`🚫 [SW-FILTER] Asset excluded (hit explicit blacklist regex): "${asset}"`);
            return !isExcluded;
        });

    console.log(`⚙️ [SW-INSTALL] Filtering finalized. ${assets.length} out of ${uniqueAssets.length} assets queued for download.`);

    return await Promise.all(assets.map(async asset => {
        asset = asset.replace(/^\/?assets\//ig, '')
        let localName = '/base' + (asset.startsWith('/') ? '' : '/') + asset;
        if (!localName.includes('.')) {
            debugger
            console.error("WHAT THE FUCK IS WRONG WITH YOU? " + key)
        }
        console.log(`🔍 [SW-CACHE-CHECK] Checking if asset exists inside IndexedDB cache: "${localName}"`);

        try {
            const files = await getRecord(DB_STORE_NAME, localName, api.environmentRepository);
            if (files && files.contents) {
                console.log(`✨ [SW-CACHE-HIT] Asset already mapped locally inside DB. Skipping download for: "${localName}"`);
                return;
            }
        } catch (e) {
            console.error(`❌ [SW-DATABASE] Failed to execute cache validation lookup for "${localName}":`, e);
        }

        try {
            console.log(`📥 [SW-INSTALL] Cache miss or empty binary payload. Triggering download request routing for: "${asset}"`);
            return await fetchAsset(asset, localName, api.environmentRepository).catch(e => {
                console.error(`❌ [SW-INSTALL] Target download execution block failed for asset "${asset}":`, e);
                console.warn("Offline asset failed: " + asset);
            });
        } catch (e) {
            console.error(`❌ [SW-INSTALL] Synchronous catch block hit for download processor pipeline for "${asset}":`, e);
            console.warn("Offline asset failed: " + asset);
        }
    }));
}




self.addEventListener('install', event => {
    console.info('🚀 [SW-LIFECYCLE] --- INSTALL EVENT TRIGGERED ---');

    event.waitUntil((async () => {

        if (!localVersion || !api.environmentRepository) {
            await lookupLocalVersion()
        }

        console.log('🚀 [SW-LIFECYCLE] Install waitUntil execution promise chain starting.');
        try {
            await installAssets();
            console.log('🚀 [SW-LIFECYCLE] installAssets layout execution loop completed successfully.');
        } catch (installErr) {
            console.error('❌ [SW-CRITICAL] Asset pre-installation chain failed to complete:', installErr);
        }

        console.log('🚀 [SW-LIFECYCLE] Executing self.skipWaiting() to destroy active zombie worker layers.');
        self.skipWaiting();
    })());
});


self.addEventListener('activate', event => {
    console.info('🚀 [SW-LIFECYCLE] --- ACTIVATE EVENT TRIGGERED ---');

    event.waitUntil((async () => {

        if (!localVersion || !api.environmentRepository) {
            await lookupLocalVersion()
        }

        console.log(`🚀 [SW-LIFECYCLE] Closing existing handle to database instance "${api.environmentRepository}" for clean boot state reset.`);
        try {
            console.log('⚙️ [SW-ASYNC] Running scheduled installAssets post-activation validation routine.');
            await installAssets();
        } catch (err) {
            console.error('❌ [SW-CRITICAL] Failure encountered during core activation block execution routine:', err);
        }
        return self.clients.claim(); // Fallback strategy to keep lifecycle moving forward
    })());
});

// Global state for the singleton worker
let lastConnectivityCheck = 0;
let isOffline = false;
let connectivityLog = [];

let localVersion = null;

// Wrapping execution in a function context to track the state safely
(async function inspectRegistrationState() {
    console.log('🔍 [SW-BOOT-CHECK] Inspecting active background service worker registration objects...');
    // Small delay to ensure registration mapping bindings are fully parsed by the runtime
    await new Promise(r => setTimeout(r, 0));

    if (self.registration && self.registration.active != null) {
        const scriptUrl = self.registration.active.scriptURL;
        console.log('🔍 [SW-BOOT-CHECK] Active Worker Registration detected. Metadata details payload:', self.registration.active);
        console.log(`🔍 [SW-BOOT-CHECK] Script target parsing URL mapping string: "${scriptUrl}"`);

        try {
            const url = new URL(scriptUrl);
            const timestampStr = url.searchParams.get('t');
            if (timestampStr) {
                localVersion = new Date(parseInt(timestampStr, 10));
                console.log(`⏳ [SW-BOOT-CHECK] Decoded local timestamp version mapping from script URL parameters: ${localVersion.toISOString()}`);
            } else {
                console.log('🔍 [SW-BOOT-CHECK] No search parameter timestamp version string matches found ("?t=" missing).');
            }
        } catch (urlErr) {
            console.error('❌ [SW-BOOT-CHECK] URL parsing engine choked on parsing script URL components:', urlErr);
        }
    } else {
        console.log('🔍 [SW-BOOT-CHECK] self.registration.active is currently NULL or evaluating as empty.');
    }
})();

let needsRefresh = false;

async function checkStatus() {
    if (!navigator.onLine) {
        console.log(`⏱️ [SW-HEARTBEAT] Browser context reports completely OFFLINE. Aborting live API updates check.`);
        isOffline = true;
        return;
    }

    const now = Date.now();
    if (now - lastConnectivityCheck < 10000) {
        console.log(`⏱️ [SW-HEARTBEAT] Suppressing status execution check. Last check occurred less than 10000ms ago.`);
        return;
    }
    lastConnectivityCheck = now;
    console.log('⏱️ [SW-HEARTBEAT] Executing connectivity status/version analysis check rules...');

    try {

        if (!localVersion || !api.environmentRepository) {
            await lookupLocalVersion()
        }

    } catch (e) {
        console.error('❌ [SW-HEARTBEAT] Fallback layout file restoration retrieval operation failed:', e);
    }

    try {
        const parts = api.environmentRepository.split('/');
        const ownerName = parts[0];
        const repoName = parts[1];
        console.log(`🌐 [SW-HEARTBEAT] Routing target parsing parameters -> Owner: "${ownerName}" | Repo: "${repoName}"`);

        const branch = await getDefaultBranch(ownerName, repoName);
        console.log(`🌐 [SW-HEARTBEAT] Resolved Remote Repo target branch checkpoint identifier: "${branch}"`);

        const latestFileTime = await getBranchVersion(ownerName, repoName, branch);
        console.log(`🌐 [SW-HEARTBEAT] Timestamps comparison values -> Local: ${localVersion ? new Date(localVersion).toISOString() : 'NULL'} | Remote GitHub Branch: ${latestFileTime ? new Date(latestFileTime).toISOString() : 'NULL'}`);

        if (localVersion && latestFileTime > localVersion) {
            console.warn('⚠️ [SW-OUT-OF-SYNC] Remote version changes detected on repository root branch! Initiating destructive workspace purge sequence.');

            console.log(`🗑️ [SW-PURGE] Dropping local IndexedDB database blocks: "${api.environmentRepository}"`);
            await deleteOldDatabase(api.environmentRepository);
            console.log(`🗑️ [SW-PURGE] Database wipe finished.`);

            console.warn('🚀 [SW-LIFECYCLE] Executing self.registration.unregister() to purge active browser cache handlers...');
            await self.registration.unregister();
            console.log('🚀 [SW-LIFECYCLE] Service Worker deregistration completed successfully.');

            needsRefresh = true;
        } else {
            console.log('✨ [SW-HEARTBEAT] Version signature hashes verified as matching or local cache layer is fresh.');
        }

        isOffline = false;

    } catch (err) {
        console.warn('⚠️ [SW-HEARTBEAT] Connectivity or Version pipeline verification request check collapsed:', err);
        if (!navigator.onLine || err instanceof TypeError) {
            console.warn('⚠️ [SW-STATUS] Network connection drop discovered via physical interface check flags.');
            isOffline = true;
        }
    }
}

async function lookupLocalVersion() {
    const databases = await getDatabaseMetadata();

    console.log(`🔍 [SW-MESSAGE] Variable placeholder empty. Fetching mapping timestamp fallback data from history.css tracking nodes...`);

    let newestVersionFile = null;
    let chosenRepo = api.environmentRepository;

    // 1. Concurrently query all databases for the settings file
    const lookups = databases.map(async (db) => {
        try {
            // Assuming getRecord takes a database identifier or repository reference as the 3rd argument
            const versionFile = await getRecord(DB_STORE_NAME, '/base/settings.json', db.key || db);
            return { versionFile, repo: db.key || db };
        } catch (e) {
            // Silently ignore individual database failures so one broken DB doesn't crash the loop
            return null;
        }
    });

    const results = await Promise.all(lookups);

    // 2. Loop through the results to find the most recent copy based on timestamp
    for (const result of results) {
        if (!result || !result.versionFile) continue;

        if (!newestVersionFile || result.versionFile.timestamp > newestVersionFile.timestamp) {
            newestVersionFile = result.versionFile;
            chosenRepo = result.repo || DB_NAME;
        }
    }

    // 3. Process the newest file found (if any)
    if (newestVersionFile) {
        try {
            const settings = JSON.parse(new TextDecoder().decode(newestVersionFile.contents));
            localVersion = settings.environment_version;
            api.environmentRepository = settings.environment_repository || chosenRepo;
            api.github_token = settings.github_token
        } catch (e) {
            console.log(`⚠️ [SW-MESSAGE] Version lookup failed, using fallback: ${localVersion}`);
            console.error(e);
            localVersion ||= newestVersionFile.timestamp || 'unknown';
            api.environmentRepository = chosenRepo;
        }
    } else {
        console.log(`⚠️ [SW-MESSAGE] No version file found across any databases. Fallback: ${localVersion}`);
    }
}


self.addEventListener('message', async (event) => {
    console.log('✉️ [SW-MESSAGE] Incoming communication frame received inside message event listener.', event.data);

    if (event.data && event.data.type === 'DEREGISTER') {
        console.warn('✉️ [SW-MESSAGE] Command route identified: DEREGISTER intercept request processed.');

        await self.registration.unregister();
        needsRefresh = true;

        if (event.ports && event.ports[0]) {
            console.log('✉️ [SW-MESSAGE] Sending confirmation payload reply back through requested transmission channel message port.');
            event.ports[0].postMessage({
                type: 'DEREGISTERED',
                version: localVersion
            });
        }
    }
    else if (event.data && event.data.type === 'GET_VERSION') {
        console.log('✉️ [SW-MESSAGE] Command route identified: GET_VERSION parameter data report request.');

        if (!localVersion || !api.environmentRepository) {
            await lookupLocalVersion()
        }

        if (event.ports && event.ports[0]) {
            console.log(`✉️ [SW-MESSAGE] Dispatching configuration report data frame. Version string: ${localVersion}`);
            event.ports[0].postMessage({
                type: 'VERSION_REPORT',
                version: localVersion
            });
        }

        console.log('✉️ [SW-MESSAGE] Queueing secondary checkStatus validation task routine...');
        checkStatus();
    }
});

let ignoreUrlParametersMatching = [/^utm_|^t=/];

let stripIgnoredUrlParameters = function (originalUrl, ignoreUrlParametersMatching) {
    let url = new URL(originalUrl);
    url.hash = '';

    console.log(`🔗 [SW-URL-STRIP] Raw query parsing calculation executing for string: "${originalUrl}"`);

    url.search = url.search.slice(1)
        .split('&')
        .map(function (kv) {
            return kv.split('=');
        })
        .filter(function (kv) {
            return ignoreUrlParametersMatching.every(function (ignoredRegex) {
                const matchFound = ignoredRegex.test(kv[0]);
                if (matchFound) console.log(`🔗 [SW-URL-STRIP] Truncating parameter match from route payload: "${kv[0]}"`);
                return !matchFound;
            });
        })
        .map(function (kv) {
            return kv.join('=');
        })
        .join('&');

    const cleanResult = url.pathname.replace(/^\//ig, '') + url.search;
    console.log(`🔗 [SW-URL-STRIP] URL normalization output completed. Clean internal routing path: "${cleanResult}"`);
    return cleanResult;
};

function manufactureRefreshResponse() {
    console.log('🧱 [SW-HTML-FACTORY] Constructing virtual execution sandbox refresh document bridge...');
    const html = `
    <!DOCTYPE html>
    <html>
        <head><title>Updating...</title></head>
        <body>
            <script>
                console.log("🔄 [CLIENT-SIDE] Executing absolute location replacement reload script from SW virtual payload.");
                window.location = '/' + window.location.pathname + "?t=" + Date.now();
            </script>
        </body>
    </html>
`;

    const newHeaders = getHeaders()
    newHeaders.set('Content-Type', 'text/html')
    return new Response(html, {
        headers: newHeaders
    });
}



console.log('⚙️ [SW-INSTALL] Compiling module path strings from global IMPORT arrays...');
const uniqueAssets = [
    'index.html',
    '/components/core/extensions.js',
    '/components/core/events.js',
    '/components/core/modules.js',
    '/components/theme/boxicons.ttf',
    '/components/theme/boxicons.woff',
    '/components/theme/boxicons.woff2',
    ...new Set([
        ...Object.values(IMPORT_CSS).flatMap(o => o),
        ...Object.values(IMPORT_JS).flatMap(o => o)
    ])
].map(path => path.replace(/^\/?assets\/|^\//ig, '')); // Normalize paths to omit leading slashes\


self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const isAssetQuery = event.request.url.includes('/components/') || event.request.url.includes('/ace/');

    if (!isOffline && event.request.url.includes('version.json')) {
        console.log('⚡ [SW-FETCH] Route is "version.json" and engine is ONLINE. Bypassing worker completely. Handing off to network.');
        return;
    }

    // 2. Convert absolute browser URLs into relative path keys
    // e.g., "http://localhost:8080/components/core/local.js" -> "components/core/local.js"
    const requestUrlObj = new URL(event.request.url);
    const relativePath = requestUrlObj.pathname.replace(/^\//, ''); // Strip leading slash

    const isNavigation = event.request.mode === 'navigate';
    let assetUrl = null;
    let selected = api.environmentRepository
    let isGithubContents = false

    // 3. Evaluate if this file belongs to our explicit VFS Manifest
    if (uniqueAssets.includes(relativePath) || isAssetQuery) {
        assetUrl = relativePath;
    } else if (isNavigation) {
        if (!isAssetQuery) console.log(`⚡ [SW-FETCH] Intercepted navigation route layout ("${event.request.url}"). Defaulting routing target to "index.html".`);
        assetUrl = 'index.html';
    } else if (requestUrlObj.hostname === 'api.github.com') {
        const gitHubMatch = requestUrlObj.pathname.match(/^\/repos\/([^\/]+)\/([^\/]+)\/?(.*)$/i);

        if (gitHubMatch) {
            const [_, owner, repo, restOfRoute] = gitHubMatch;

            // Set targeted database context dynamically to the owner/repo string
            selected = `${owner}/${repo}`;

            // Normalize empty queries (like a base repository layout call) to 'index'
            const routeKey = restOfRoute || 'index';

            // Escape path characters into a clean flat sequence file key
            const escapedRoute = routeKey.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            assetUrl = `${escapedRoute}.json`;
            isGithubContents = restOfRoute.startsWith('contents/')
            if(relativePath.includes('git/trees')) {
                debugger
            }
        }
    }

    // If it's not a framework asset we care about, skip processing entirely and pass to normal network
    if (!assetUrl) {
        return;
    }

    // Normalize target variable structure safely
    assetUrl = assetUrl.replace(/^\/?assets\/|^\//ig, '');
    const localName = (!isGithubContents ? '/base' : '') + (assetUrl.startsWith('/') ? '' : '/') + assetUrl;
    const contentType = getMimeType(assetUrl);

    if (!isAssetQuery) {
        console.log(`⚡ [SW-FETCH] Fetch event pipeline actively processing intercept -> Request URL: "${event.request.url}" | Matched Internal Asset Target: "${assetUrl}"`);
    }

    event.respondWith((async () => {
        if (!isAssetQuery) console.log(`⚡ [SW-FETCH-ASYNC] Running execution worker lifecycle block wrapper for target asset: "${assetUrl}"`);

        // 1. Run the heartbeat check
        checkStatus();

        // 2. Network Check First Strategy
        if (!isOffline) {
            try {
                if (!isAssetQuery) console.log(`🌐 [SW-FETCH-NET] Attempting primary network acquisition route pipeline for asset: "${assetUrl}"`);
                const response = await fetchAsset(event.request, assetUrl, selected);
                if (response.ok) {
                    if (!isAssetQuery) console.log(`🌐 [SW-FETCH-NET] Network fetch succeeded (200/304 validation check passed) for: "${assetUrl}"`);
                    return response;
                }
            } catch (netErr) {
                console.error(`⚠️ [SW-FETCH-NET] Network acquisition fallback route failed or threw error for "${assetUrl}":`, netErr);
            }
        }

        // 3. Fallback: Local VFS DB retrieval
        try {
            if (!isAssetQuery) console.log(`💾 [SW-FETCH-STORE] Attempting VFS database block read for key name: "${localName}"`);
            const files = await getRecord(DB_STORE_NAME, localName, selected);

            if (files && files.contents) {
                if (!isAssetQuery) console.log(`✨ [SW-FETCH-STORE] VFS Cache match found! Compiling local response frame wrapper for: "${localName}" [MIME: ${contentType}]`);
                const newHeaders = getHeaders();
                newHeaders.set('Content-Type', contentType);

                return new Response(files.contents, {
                    status: 200,
                    statusText: 'OK',
                    headers: newHeaders
                });
            } else {
                if (!isAssetQuery) console.warn(`⚠️ [SW-FETCH-STORE] Database lookup returned empty body or missing index reference pointer for: "${localName}"`);
            }
        } catch (dbReadErr) {
            console.error(`❌ [SW-FETCH-STORE] VFS IndexedDB reader wrapper crash occurred for key "${localName}":`, dbReadErr);
        }

        // 4. Absolute Final Emergency Fallback
        console.warn(`🚨 [SW-FETCH-FALLBACK] Both live network and local IndexedDB lookup points failed for "${assetUrl}". Launching direct un-cached pass-through fetch call execution wrapper.`);
        return fetch(event.request);
    })());
});

function getMimeType(url) {
    if (url.endsWith('.wasm')) return 'application/wasm';
    if (url.endsWith('.js')) return 'application/javascript';
    if (url.endsWith('.json')) return 'application/json';
    if (url.endsWith('.html')) return 'text/html';
    if (url.endsWith('.css')) return 'text/css';
    if (url.endsWith('.ttf')) return 'font/ttf';
    if (url.endsWith('.woff')) return 'font/woff';
    if (url.endsWith('.woff2')) return 'font/woff2';
    return 'application/octet-stream';
}

console.log('🔴 [SW-TRACE] Script evaluation complete. Listeners successfully bound to background process threads.');