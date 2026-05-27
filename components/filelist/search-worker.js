// search-worker.js
importScripts('/components/core/local.js');
importScripts('/components/filelist/github.js');



function openIDB(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Pulls all files from IndexedDB to scan locally in memory
 */
async function getAllLocalFiles(activeRepositories) {
    const allFiles = [];
    
    // Scan across all registered repository DB namespaces
    for (const dbName of activeRepositories) {
        try {
            const db = await openIDB(dbName);
            if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
                db.close();
                debugger
                continue;
            }
            
            await new Promise((resolve, reject) => {
                const tx = db.transaction(DB_STORE_NAME, 'readonly');
                const store = tx.objectStore(DB_STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    // Normalize records to ensure they carry their source repository identifier
                    const records = request.result.map(file => ({
                        ...file,
                        repoSource: dbName,
                        // Ensure contents are text strings if stored as array buffers/blobs
                        textContent: file.contents instanceof Uint8Array 
                            ? new TextDecoder().decode(file.contents) 
                            : (file.contents || '')
                    }));
                    allFiles.push(...records);
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
            db.close();
        } catch (err) {
            console.warn(`Worker IDB fetch skipped for ${dbName}:`, err);
        }
    }
    return allFiles;
}

/**
 * Dispatches the safe GitHub global query pass
 */
async function searchGitHubCode(query, activeRepositories, token) {
    // If no scopes are ready, drop out
    if (activeRepositories.length === 0) return [];
    
    // Use the first active repository context to scope the code query space safely
    const primaryRepo = activeRepositories[0];
    const queryString = `${query} repo:${primaryRepo}`;
    const fullUrl = `https://api.github.com/search/code?q=${encodeURIComponent(queryString)}`;

    const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(fullUrl, { headers });
        if (!response.ok) return [];
        const data = await response.json();
        
        return (data.items || []).map(item => ({
            path: item.path,
            sha: item.sha,
            repoSource: primaryRepo,
            matchText: `Remote Instance (Index Pointer: ${item.sha.substring(0, 7)})`,
            isRemote: true
        }));
    } catch (err) {
        console.error("Worker remote GitHub fetch aborted:", err);
        return [];
    }
}

// =========================================================================
// MAIN WORKER SWITCHBOARD INTERCEPTOR
// =========================================================================
self.onmessage = async function(e) {
    const { query, activeRepositories, gitHubToken, caseSensitive } = e.data;
    
    if (!query || query.length < 2) {
        return self.postMessage({ type: 'clear', results: [] });
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    // 1. Fetch unified array elements across all IndexedDB stores concurrently
    const localFiles = await getAllLocalFiles(activeRepositories || []);

    // -----------------------------------------------------------------
    // PASS 1: Fast Filename Path String Search
    // -----------------------------------------------------------------
    const pathResults = [];
    for (const file of localFiles) {
        regex.lastIndex = 0;
        if (regex.test(file.path)) {
            pathResults.push({
                path: file.path,
                sha: file.sha,
                repoSource: file.repoSource,
                line: 1,
                matchText: `[Filename Match] ${file.path}`,
                isDirty: !!self.FS?.virtual?.[file.path] // Check against tracking state
            });
        }
    }
    // Stream early match frames up to the UI thread layout immediately
    self.postMessage({ type: 'paths', results: pathResults });

    // -----------------------------------------------------------------
    // PASS 2: Deep File Content String Parsing Loop
    // -----------------------------------------------------------------
    const contentResults = [];
    for (const file of localFiles) {
        const text = file.textContent;
        if (!text) continue;

        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            const upToMatch = text.substring(0, match.index);
            const lineParts = upToMatch.split('\n');
            const lineNo = lineParts.length;
            
            const rawLineText = text.split('\n')[lineNo - 1] || '';
            const trimmedLineText = rawLineText.trim();
            
            // Calculate exactly where the match starts inside the trimmed row string
            // by subtracting the leading whitespace offset length
            const leadingWhitespaceLength = rawLineText.length - rawLineText.trimStart().length;
            const matchIndexInLine = lineParts[lineParts.length - 1].length - leadingWhitespaceLength;

            contentResults.push({
                path: file.path,
                sha: file.sha,
                repoSource: file.repoSource,
                line: lineNo,
                matchIndex: Math.max(0, matchIndexInLine), // <-- The index inside the trimmed snippet
                matchLength: match[0].length,              // <-- Length of the matched token
                matchText: trimmedLineText,
                isDirty: false
            });

            if (contentResults.length > 500) break;
        }
    }
    self.postMessage({ type: 'contents', results: contentResults });

    // -----------------------------------------------------------------
    // PASS 3: Remote Network Gateway Interceptor Sync
    // -----------------------------------------------------------------
    if (gitHubToken) {
        const remoteResults = await searchGitHubCode(query, activeRepositories || [], gitHubToken);
        self.postMessage({ type: 'github', results: remoteResults });
    }
};