'use strict';

const api = {
    github_token: null
}

console.log('🔴 [SW-TRACE] Initial script execution block started.');

// Import the Blazor-generated assets manifest
try {
    console.log('🔗 [SW-TRACE] Attempting script import: /components/core/local.js');
    self.importScripts('/components/core/local.js');

    console.log('🔗 [SW-TRACE] Attempting script import: /components/core/extensions.js');
    self.importScripts('/components/core/extensions.js');

    console.log('🔗 [SW-TRACE] Attempting script import: /components/filelist/github.js');
    self.importScripts('/components/filelist/github.js');

    console.log('✅ [SW-TRACE] Global helper extensions imported successfully.');
} catch (e) {
    console.error('❌ [SW-CRITICAL] Script imports blew up immediately:', e);
}

// Blazor Filter Settings
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/];
const offlineAssetsExclude = [/service-worker-assets\.js$|^service-worker/];

const ST_FILE = 8;
const ST_DIR = 4;
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6);
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT;
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT;



async function mkdirp(path) {

    console.log(`📂 [SW-FS] mkdirp invoked for path: "${path}"`);

    // Split and filter out empty segments to prevent unintended double slashes
    let segments = path.split(/\/|\\/gi).filter(Boolean);
    console.log(`📂 [SW-FS] Path segments isolated for calculation:`, segments);

    // Loop through segments to build the directory tree sequentially
    for (let i = 1; i <= segments.length; i++) {
        let dir = '/' + segments.slice(0, i).join('/');
        console.log(`📂 [SW-FS] Making structural directory layer: "${dir}"`);

        // Safely extract the parent directory path
        let lastSlashIndex = dir.lastIndexOf('/');
        let parentDir = lastSlashIndex === 0 ? '/' : dir.substring(0, lastSlashIndex);

        try {
            await putRecord(DB_STORE_NAME, {
                path: dir,
                timestamp: new Date(),
                mode: FS_DIR,
                parent: parentDir
            }, DB_NAME);
            console.log(`✅ [SW-FS] Directory committed to IndexedDB: "${dir}"`);
        } catch (dbErr) {
            console.error(`❌ [SW-DATABASE] mkdirp failed to store record for "${dir}":`, dbErr);
        }
    }
}


async function fetchAsset(url, key) {
    console.log(`🌐 [SW-NET] fetchAsset initiated. URL: "${url}" | Internal Key: "${key}"`);
    const timeoutSignal = AbortSignal.timeout(10000);
    let response;

    try {
        if (typeof (url) == 'string') {
            console.log(`🌐 [SW-NET] Launching string-type fetch request. Cache: no-store, Mode: no-cors for URL: "${url}"`);
            response = await fetch(url, {
                cache: 'no-store',
                credentials: 'omit',
                mode: 'no-cors',
                signal: timeoutSignal
            });
        } else {
            console.log(`🌐 [SW-NET] Launching direct Request object pass-through fetch for URL: "${url.url || url}"`);
            response = await fetch(url);
        }

        console.log(`🌐 [SW-NET] Fetch response received for "${key}". Status: ${response.status} (${response.statusText}) | Type: ${response.type}`);

        if (response.redirected || response.type == 'opaqueredirect') {
            if (!url.includes('index.html')) {
                console.warn(`⚠️ [SW-WARN] Asset file was intercepted by a REDIRECT payload: ${url} -> Target: ${response.url}`);
            }
            const newHeaders = new Headers(response.headers);
            newHeaders.set('X-Service-Worker-Handled', 'true');
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
        let dirPath = localKey.substring(0, localKey.lastIndexOf('/'))

        console.log(`📂 [SW-FS] Staging VFS mapping coordinates. localKey: "${localKey}" | dirPath: "${dirPath}"`);

        await mkdirp(dirPath);

        console.log(`💾 [SW-DATABASE] Writing payload binary content into IndexedDB Store: "${DB_STORE_NAME}" -> Target Key: "${localKey}"`);
        if (!localKey.includes('.')) {
            debugger
            console.error("WHAT THE FUCK IS WRONG WITH YOU? " + key)
        }
        await putRecord(DB_STORE_NAME, {
            path: localKey,
            timestamp: new Date(),
            mode: FS_FILE,
            contents: new Uint8Array(content),
            parent: dirPath
        }, DB_NAME);
        console.log(`✅ [SW-DATABASE] Successfully wrote "${localKey}" to local storage block.`);

        const newHeaders = new Headers(response.headers);
        newHeaders.set('X-Service-Worker-Handled', 'true');

        isOffline = false;

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
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

/* --- Blazor Template Events with your Logic --- */


let assetLookup = null;

async function installAssets() {
    console.log('⚙️ [SW-INSTALL] Executing asset installer verification.');

    try {
        const databases = await getDatabaseMetadata();
        console.log('⚙️ [SW-INSTALL] Extracted internal IndexedDB metadata dictionaries:', databases);
        const shouldInstall = (await needsInstall(DB_NAME, DB_SCHEME)).item3
        if (databases.filter(d => d.key == DB_NAME).length == 0
            || shouldInstall) {
            console.warn(`⚠️ [SW-DATABASE] Target database "${DB_NAME}" missing. Initializing core database maps now.`);
            await deleteOldDatabase(DB_NAME)
            await setupDatabase(DB_NAME, DB_SCHEME);
            console.log(`✅ [SW-DATABASE] Target database infrastructure initialized cleanly.`);
        }
    } catch (dbSetupErr) {
        console.error('❌ [SW-DATABASE] Database lookup/instantiation failure loop caught:', dbSetupErr);
    }

    console.log('⚙️ [SW-INSTALL] Compiling module path strings from global IMPORT arrays...');
    const uniqueAssets = [
        ...new Set([...Object.values(IMPORT_CSS).flatMap(o => o), ...Object.values(IMPORT_JS).flatMap(o => o)])
    ];
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
            const files = await getRecord(DB_STORE_NAME, localName, DB_NAME);
            if (files && files.contents) {
                console.log(`✨ [SW-CACHE-HIT] Asset already mapped locally inside DB. Skipping download for: "${localName}"`);
                return;
            }
        } catch (e) {
            console.error(`❌ [SW-DATABASE] Failed to execute cache validation lookup for "${localName}":`, e);
        }

        try {
            console.log(`📥 [SW-INSTALL] Cache miss or empty binary payload. Triggering download request routing for: "${asset}"`);
            return await fetchAsset(asset, localName).catch(e => {
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
        console.log(`🚀 [SW-LIFECYCLE] Closing existing handle to database instance "${DB_NAME}" for clean boot state reset.`);
        try {
            console.log('⚙️ [SW-ASYNC] Running scheduled installAssets post-activation validation routine.');
            await installAssets();
            return self.clients.claim();
        } catch (e) {
            console.error('❌ [SW-CRITICAL] Failure encountered during core activation block execution routine:', err);
            return self.clients.claim(); // Fallback strategy to keep lifecycle moving forward
        }
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
    const now = Date.now();
    if (now - lastConnectivityCheck < 10000) {
        console.log(`⏱️ [SW-HEARTBEAT] Suppressing status execution check. Last check occurred less than 10000ms ago.`);
        return;
    }
    lastConnectivityCheck = now;
    console.log('⏱️ [SW-HEARTBEAT] Executing connectivity status/version analysis check rules...');

    try {
        if (!localVersion) {
            console.log(`🔍 [SW-HEARTBEAT] localVersion variable empty. Attempting database index fallback restoration reading from '/base/components/core/history.css'`);
            const versionFile = await getRecord(DB_STORE_NAME, '/base/components/core/history.css', DB_NAME);
            localVersion = versionFile ? versionFile.timestamp : null;
            console.log(`🔍 [SW-HEARTBEAT] Fallback lookup complete. Restored DB timestamp state:`, localVersion);
        }
    } catch (e) {
        console.error('❌ [SW-HEARTBEAT] Fallback layout file restoration retrieval operation failed:', e);
    }

    try {
        const parts = DB_NAME.split('/');
        const ownerName = parts[0];
        const repoName = parts[1];
        console.log(`🌐 [SW-HEARTBEAT] Routing target parsing parameters -> Owner: "${ownerName}" | Repo: "${repoName}"`);

        const branch = await getDefaultBranch(ownerName, repoName);
        console.log(`🌐 [SW-HEARTBEAT] Resolved Remote Repo target branch checkpoint identifier: "${branch}"`);

        const latestFileTime = await getBranchVersion(ownerName, repoName, branch);
        console.log(`🌐 [SW-HEARTBEAT] Timestamps comparison values -> Local: ${localVersion ? new Date(localVersion).toISOString() : 'NULL'} | Remote GitHub Branch: ${latestFileTime ? new Date(latestFileTime).toISOString() : 'NULL'}`);

        if (localVersion && latestFileTime > localVersion) {
            console.warn('⚠️ [SW-OUT-OF-SYNC] Remote version changes detected on repository root branch! Initiating destructive workspace purge sequence.');

            console.log(`🗑️ [SW-PURGE] Dropping local IndexedDB database blocks: "${DB_NAME}"`);
            await deleteOldDatabase(DB_NAME);
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
        api.github_token = event.data.github_token

        if (!localVersion) {
            console.log(`🔍 [SW-MESSAGE] Variable placeholder empty. Fetching mapping timestamp fallback data from history.css tracking nodes...`);
            const versionFile = await getRecord(DB_STORE_NAME, '/base/components/core/history.css', DB_NAME);
            localVersion = versionFile ? versionFile.timestamp : 'unknown';
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

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html',
            'X-Service-Worker-Handled': 'true',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
    });
}

self.addEventListener('fetch', event => {
    // We immediately drop out logs for heavy graphics asset polling to avoid spamming 
    // the console with binary chunks when the engine is active
    const isAssetQuery = event.request.url.includes('/components/paint/') || event.request.url.includes('/components/map-editor/');

    if (event.request.method !== 'GET') return;

    if (!isOffline && event.request.url.includes('version.json')) {
        console.log('⚡ [SW-FETCH] Route is "version.json" and engine is ONLINE. Bypassing worker completely. Handing off to network.');
        return;
    }

    let url = stripIgnoredUrlParameters(event.request.url, ignoreUrlParametersMatching);
    const isNavigation = event.request.mode === 'navigate';
    let assetUrl = assetLookup != null ? assetLookup.get(url) : null;

    if (!assetUrl && isNavigation) {
        if (!isAssetQuery) console.log(`⚡ [SW-FETCH] Intercepted navigation route layout ("${url}"). Defaulting routing target to "index.html".`);
        assetUrl = 'index.html';
    }

    if (!assetUrl) {
        // Fallthrough route
        return;
    }

    assetUrl = assetUrl.replace(/^\/?assets\/|^\//ig, '')
    const localName = '/base' + (assetUrl.startsWith('/') ? '' : '/') + assetUrl;
    const contentType = getMimeType(assetUrl);

    if (!isAssetQuery) {
        console.log(`⚡ [SW-FETCH] Fetch event pipeline actively processing intercept -> Request URL: "${event.request.url}" | Matched Internal Asset Target: "${assetUrl}"`);
    }

    event.respondWith((async () => {
        if (!isAssetQuery) console.log(`⚡ [SW-FETCH-ASYNC] Running execution worker lifecycle block wrapper for target asset: "${assetUrl}"`);

        // 1. Run the heartbeat check
        await checkStatus();

        // 2. Network Check First Strategy
        if (assetUrl && !isOffline) {
            try {
                if (!isAssetQuery) console.log(`🌐 [SW-FETCH-NET] Attempting primary network acquisition route pipeline for asset: "${assetUrl}"`);
                const response = await fetchAsset(event.request, assetUrl);
                if (response.ok) {
                    if (!isAssetQuery) console.log(`🌐 [SW-FETCH-NET] Network fetch succeeded (200/304 validation check passed) for: "${assetUrl}"`);
                    return response;
                }
            } catch (netErr) {
                console.error(`⚠️ [SW-FETCH-NET] Network acquisition fallback route failed or threw error for "${assetUrl}":`, netErr);
            }
        }

        // 3. Fallback: Local VFS DB retrieval
        if (assetUrl) {
            try {
                if (!isAssetQuery) console.log(`💾 [SW-FETCH-STORE] Attempting VFS database block read for key name: "${localName}"`);
                const files = await getRecord(DB_STORE_NAME, localName, DB_NAME);

                if (files && files.contents) {
                    if (!isAssetQuery) console.log(`✨ [SW-FETCH-STORE] VFS Cache match found! Compiling local response frame wrapper for: "${localName}" [MIME: ${contentType}]`);
                    const newHeaders = new Headers();
                    newHeaders.set('Content-Type', contentType);
                    newHeaders.set('X-Service-Worker-Handled', 'true');

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
    return 'application/octet-stream';
}

console.log('🔴 [SW-TRACE] Script evaluation complete. Listeners successfully bound to background process threads.');