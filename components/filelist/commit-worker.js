
const api = {
    github_token: null
}

importScripts('/components/core/preambles.js');
importScripts('/components/core/logging.js');
importScripts('/components/core/local.js');
importScripts('/components/filelist/github.js');


async function pushLocalChangesToGitHub(repoOwner, repoName, branch, commitMessage) {
    // 1. Fetch current branch parent pointer references
    const commitData = await githubRequest(repoOwner, repoName, `commits/${branch}`);
    const parentCommitSha = commitData.sha;
    const baseTreeSha = commitData.commit.tree.sha;

    // 2. Get the exact same staging layout calculated dynamically
    const staging = await calculateStagedChanges(repoOwner, repoName, branch);

    if (staging.treeEntries.length === 0) {
        writeLog("No discrete variations detected between local working layer and remote branch head.");
        return null;
    }

    // 3. Process and write actual network Blobs only for items in the staging entries
    const treeChanges = [];
    for (const entry of staging.treeEntries) {
        writeLog(`Uploading changed file blob: ${entry.path}`);
        const blobSha = await createGitHubBlob(repoOwner, repoName, entry.contents);

        treeChanges.push({
            path: entry.path,
            mode: '100644',
            type: 'blob',
            sha: blobSha
        });
    }

    // 4. Construct the tree, commit, and bump branch ref
    const newTreeSha = await createGitHubTree(repoOwner, repoName, baseTreeSha, treeChanges);
    const newCommitSha = await createGitHubCommit(repoOwner, repoName, commitMessage, newTreeSha, [parentCommitSha]);
    await updateBranchReference(repoOwner, repoName, branch, newCommitSha);

    // 5. Hard alignment flush
    await loadGitHubTree(repoOwner, repoName, branch);
    return newCommitSha;
}


/**
 * Creates a raw binary blob structure on GitHub's structural servers.
 */
async function createGitHubBlob(owner, repo, contents) {
    let base64Content;
    if (contents instanceof Uint8Array) {
        base64Content = btoa(String.fromCharCode.apply(null, contents));
    } else if (contents instanceof ArrayBuffer) {
        base64Content = btoa(String.fromCharCode.apply(null, new Uint8Array(contents)));
    } else {
        base64Content = btoa(unescape(encodeURIComponent(contents)));
    }

    const payload = {
        content: base64Content,
        encoding: 'base64'
    };

    // Altering method behavior via an ad-hoc custom fetch context or extended payload wrapping
    const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers: getGitHubHeaders(),
        body: JSON.stringify(payload)
    });

    if (!result.ok) throw new Error(`Blob generation failed with status: ${result.status}`);
    const data = await result.json();
    return data.sha;
}

/**
 * Builds an explicit Git Tree description configuration map array structure.
 */
async function createGitHubTree(owner, repo, baseTreeSha, treeChanges) {
    const payload = {
        base_tree: baseTreeSha,
        tree: treeChanges
    };

    const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers: getGitHubHeaders(),
        body: JSON.stringify(payload)
    });

    if (!result.ok) throw new Error(`Tree generation failed with status: ${result.status}`);
    const data = await result.json();
    return data.sha;
}

/**
 * Writes an immutable Commit signature referencing the state of a compiled structural tree.
 */
async function createGitHubCommit(owner, repo, message, treeSha, parentCommitShas) {
    const payload = {
        message: message,
        tree: treeSha,
        parents: parentCommitShas
    };

    const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers: getGitHubHeaders(),
        body: JSON.stringify(payload)
    });

    if (!result.ok) throw new Error(`Commit generation failed with status: ${result.status}`);
    const data = await result.json();
    return data.sha;
}

/**
 * Patches the structural reference point pointer configuration for a remote branch layout.
 */
async function updateBranchReference(owner, repo, branch, commitSha) {
    const payload = {
        sha: commitSha,
        force: false // Set to true only if resetting historical chains
    };

    const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers: getGitHubHeaders(),
        body: JSON.stringify(payload)
    });

    if (!result.ok) throw new Error(`Failed updating reference branch path: ${result.status}`);
    return await result.json();
}

/**
 * Internal parsing token helper targeting local context variables inside workers
 */
function getGitHubHeaders() {
    let token = typeof api !== 'undefined' ? api.github_token : localStorage.getItem('github_token');
    return {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Compares IndexedDB local storage data against the remote tree cache 
 * to calculate unstaged modifications, new additions, or deletions.
 * Purely structural / execution dry-run phase.
 */
async function calculateStagedChanges(repoOwner, repoName, branch) {
    const selected = `${repoOwner}/${repoName}`;

    // 1. Ensure the remote baseline tree layout skeleton is hydrated locally
    if (!files[selected]) {
        await loadGitHubTree(repoOwner, repoName, branch);
    }
    const remoteTree = files[selected] || {};

    const changes = {
        modified: [],   // { path, localSha, remoteSha }
        added: [],      // { path, localSha }
        deleted: [],    // Remote files completely missing from local IndexedDB storage
        treeEntries: [] // Structured changes array targeting subsequent Git Trees compilation API passes
    };

    // Track matching local paths to identify deletions downstream
    const foundLocalPaths = new Set();

    try {
        // 2. Open up the repository's dedicated IndexedDB storage space
        const db = await getDB(selected);
        if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
            db.close();
            writeLog(`Target store ${DB_STORE_NAME} not allocated yet for database: ${selected}`);
            return changes;
        }

        // 3. Scan flat file array entries inside IDB concurrently via readAll loop
        await readAll(selected, async (fileRecord) => {
            if (!fileRecord || !fileRecord.path) return;

            const filePath = fileRecord.path;

            // Skip build/temporary outputs early
            if (filePath.includes('tmp/') || filePath.includes('/bin/') || filePath.includes('/obj/')) {
                return;
            }

            foundLocalPaths.add(filePath);

            // Fetch binary array elements out of record storage layer
            const contents = fileRecord.contents;
            if (!contents) return;

            // Resolve local hash context via optimized fallback routing
            let localSha = fileRecord.sha;
            if (!localSha) {
                localSha = await getGitShaBrowser(contents);
            }

            const remoteRecord = remoteTree[filePath];

            if (!remoteRecord) {
                // File exists locally in IDB but is absent on GitHub
                changes.added.push({ path: filePath, sha: localSha });
                changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
            } else if (remoteRecord.sha !== localSha) {
                // File shifted away from remote baseline branch tracking points
                changes.modified.push({ path: filePath, localSha, remoteSha: remoteRecord.sha });
                changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
            }
        });

        // 4. PASS 2: Compare remote paths with local paths to discover deletions
        for (const [remotePath, remoteRecord] of Object.entries(remoteTree)) {
            // Ignore directories tracked inside the flat mapping skeleton if they pop up
            if (remoteRecord.type === 'tree') continue;

            // Skip temporary directory outputs if indexed remotely
            if (remotePath.includes('tmp/') || remotePath.includes('/bin/') || remotePath.includes('/obj/')) {
                continue;
            }

            if (!foundLocalPaths.has(remotePath)) {
                changes.deleted.push({ path: remotePath });

                // Formulate deletion entries for the Git Data Tree mapping array
                // By providing a path definition with a null sha/value, GitHub removes it from the tree point reference.
                changes.treeEntries.push({
                    path: remotePath,
                    mode: '100644',
                    type: 'blob',
                    sha: null
                });
            }
        }

    } catch (err) {
        console.error(`Failed compiling status check tracking matrix for ${selected}:`, err);
        throw err;
    }

    return changes;
}


self.onmessage = async function (e) {

    // --- ROUTE A: GET STAGING STATUS (Safe / Read-Only) ---
    if (e.data.type === 'COMMIT_STATUS_CHECK') {
        const { owner, repo, branch, callbackId, gitHubToken } = e.data;
        api.github_token = gitHubToken
        try {
            const stagingDetails = await calculateStagedChanges(owner, repo, branch);
            self.postMessage({
                type: 'staging_status',
                status: 'SUCCESS',
                modified: stagingDetails.modified.map(f => f.path),
                added: stagingDetails.added.map(f => f.path),
                callbackId
            });
        } catch (err) {
            self.postMessage({ type: 'staging_status', status: 'ERROR', error: err.message, callbackId });
        }
        return;
    }

    // --- ROUTE B: EXECUTE DESTRUCTIVE COMMIT PUSH ---
    if (e.data.type === 'COMMIT_PUSH') {
        const { owner, repo, branch, message, callbackId, gitHubToken } = e.data;
        api.github_token = gitHubToken
        try {
            const finalSha = await pushLocalChangesToGitHub(owner, repo, branch, message);
            self.postMessage({ type: 'commit_status', status: 'SUCCESS', sha: finalSha, callbackId });
        } catch (err) {
            self.postMessage({ type: 'commit_status', status: 'ERROR', error: err.message, callbackId });
        }
        return;
    }
}