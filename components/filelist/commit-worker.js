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
 * Compares FS.virtual with the remote tree cache to calculate unstaged/staged changes.
 * Does NOT hit the network for blob creation. Purely architectural.
 */
async function calculateStagedChanges(repoOwner, repoName, branch) {
    const selected = `${repoOwner}/${repoName}`;

    if (!files[selected]) {
        await loadGitHubTree(repoOwner, repoName, branch);
    }
    const remoteTree = files[selected] || {};

    const changes = {
        modified: [],   // { path, localSha, remoteSha }
        added: [],      // { path, localSha }
        deleted: [],    // Explicitly tracked if your system handles deletions
        treeEntries: [] // Pre-formatted array for Git Data API if we proceed
    };

    for (const [filePath, fileRecord] of Object.entries(FS.virtual)) {
        if (!fileRecord || !fileRecord.contents) continue;

        // Skip temporary compile artifacts or engine-specific release dumps early
        if (filePath.includes('tmp/') || filePath.includes('/bin/') || filePath.includes('/obj/')) {
            continue;
        }

        const localSha = await getGitShaBrowser(fileRecord.contents);
        const remoteRecord = remoteTree[filePath];

        if (!remoteRecord) {
            changes.added.push({ path: filePath, sha: localSha });
            changes.treeEntries.push({ path: filePath, sha: localSha, contents: fileRecord.contents });
        } else if (remoteRecord.sha !== localSha) {
            changes.modified.push({ path: filePath, localSha, remoteSha: remoteRecord.sha });
            changes.treeEntries.push({ path: filePath, sha: localSha, contents: fileRecord.contents });
        }
    }

    return changes;
}



self.onmessage = async function (e) {

    // --- ROUTE A: GET STAGING STATUS (Safe / Read-Only) ---
    if (e.data.type === 'COMMIT_STATUS_CHECK') {
        const { owner, repo, branch, callbackId } = e.data;
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
        const { owner, repo, branch, message, callbackId } = e.data;
        try {
            const finalSha = await pushLocalChangesToGitHub(owner, repo, branch, message);
            self.postMessage({ type: 'commit_status', status: 'SUCCESS', sha: finalSha, callbackId });
        } catch (err) {
            self.postMessage({ type: 'commit_status', status: 'ERROR', error: err.message, callbackId });
        }
        return;
    }
}