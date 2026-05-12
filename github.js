

let savedToken
if(typeof localStorage != 'undefined')
 savedToken = localStorage.getItem('github_token');

async function githubRequest(ownerName, repoName, url, authorize = true, buffer = false) {
    if (!savedToken)
        savedToken = localStorage.getItem('github_token');

    const fullUrl = `https://api.github.com/repos/${ownerName}/${repoName}`
        + (url.startsWith('/') || url.trim().length == 0 ? '' : '/') + url
    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: authorize && savedToken ? {
                'Authorization': `Bearer ${savedToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            } : {}
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('UNAUTHORIZED_ACCESS');
            }
            throw new Error(`HTTP_ERROR: ${response.status}`);
        }

        if (buffer)
            return await response.arrayBuffer();
        return await response.json();
    } catch (up) {
        if (authorize && up.message === 'UNAUTHORIZED_ACCESS') {
            return await githubRequest(ownerName, repoName, url, false, buffer)
        }
        console.error("Failed to github: " + fullUrl, up);
        throw up
    }

}


async function getDefaultBranch(owner, repo) {
    const data = await githubRequest(owner, repo, '');
    return data.default_branch; // Usually "main" or "master"
}


async function getBranches(repoOwner, repoName) {

    try {
        const branches = await githubRequest(repoOwner, repoName, 'branches');;

        const defaultName = await getDefaultBranch(repoOwner, repoName)

        const sortedBranches = branches.sort((a, b) => {
            if (a.name === defaultName) return -1;
            if (b.name === defaultName) return 1;
            return a.name.localeCompare(b.name);
        });


        return branches;
    } catch (error) {
        console.error("Failed to fetch branches:", error);
        return [];
    }
}


async function loadGitHubTree(repoOwner, repoName, branch) {

    try {
        let database = repoOwner + '/' + repoName
        const data = await githubRequest(repoOwner, repoName, `git/trees/${branch}?recursive=1`);

        // Transform the flat GitHub 'tree' array into nested children
        files[database] = data.tree.reduce((obj, a, i, arr) => {
            obj[a.path] = a
            return obj
        }, {})

        var databases = await getDatabaseMetadata()
        if (databases.filter(d => d.key == database).length == 0
            || (await needsInstall(database, DB_SCHEME)).item3) {
            await deleteOldDatabase(database)
            await setupDatabase(database, DB_SCHEME)
        }

        return files[database]
    } catch (error) {
        console.error('Failed to load GitHub tree:', error);
    }

}



let github = {}
let trees = {}
let files = {}

async function loadFileTree(repoOwner, repoName, branch, selector) {

    try {
        let database = repoOwner + '/' + repoName

        files[selector] = await loadGitHubTree(repoOwner, repoName, branch)

        // Initialize Tree.js with the transformed data
        // Note: Use 'data' property instead of 'url' to provide the object directly
        trees[selector] = trees[database] = new Tree(selector, {
            data: convertFlatToNested(Object.values(files[selector])),
            autoOpen: false,
            closeDepth: 2,
        });

        //downloadRepoZip(repoOwner, repoName, branch)

    } catch (error) {
        console.error('Failed to load file list tree:', error);
    }
}

async function getGitShaBrowser(content) {
    const encoder = new TextEncoder();
    let contentBytes
    if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
        contentBytes = content
    }
    else {
        contentBytes = encoder.encode(content);
    }

    // Create header and convert to bytes
    const header = `blob ${contentBytes.byteLength}\0`;
    const headerBytes = encoder.encode(header);

    // Combine into a single Uint8Array
    const finalBytes = new Uint8Array(headerBytes.length + contentBytes.length);
    finalBytes.set(headerBytes);
    finalBytes.set(contentBytes, headerBytes.length);

    // Generate SHA-1 hash
    const hashBuffer = await crypto.subtle.digest('SHA-1', finalBytes);

    // Convert ArrayBuffer to Hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}



async function cacheFile(repoOwner, repoName, filePath, sha) {

    try {
        let record = await getRecord(DB_STORE_NAME, filePath, repoOwner + '/' + repoName)
        FS.virtual[filePath] = record
        if (record /*&& (record.sha == sha)*/) {
            const decoder = new TextDecoder();
            const str = decoder.decode(record.contents);
            return str
        }
    } catch (e) {
        console.error(e)
    }

    let jsonResponse = await githubRequest(repoOwner, repoName, `contents/${filePath}`)

    // --- DECODING LOGIC ---
    // GitHub wraps the file content in a JSON object and encodes it in Base64
    // We strip newlines and decode it back to a standard UTF-8 string
    let bytes;
    if (jsonResponse.encoding === 'base64') {
        // Decode base64 string to a binary string, then map to bytes
        const binString = atob(jsonResponse.content.replace(/\s/g, ''));
        bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
    } else {
        // Encode raw text to UTF-8 bytes
        bytes = new TextEncoder().encode(jsonResponse.content || "");
    }

    FS.virtual[filePath] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: bytes,
        path: filePath,
        sha: jsonResponse.sha
    }
    // async to filesystem
    // does it REALLY matter if it makes it? wont it just redownload?
    await putRecord(DB_STORE_NAME, FS.virtual[filePath], repoOwner + '/' + repoName)

    const decoder = new TextDecoder();
    const str = decoder.decode(bytes);
    return str
}

async function downloadRepoZip(owner, repo, branch = 'master', database = null) {

    if (!database)
        database = owner + '/' + repo

    const log = (msg) => {
        if (typeof term !== 'undefined') term.write(`\x1b[34m[FETCH]\x1b[0m ${msg}\r\n`);
        else console.log(msg);
    };

    try {
        log(`Requesting archive from ${owner}/${repo}...`);

        const buffer = await githubRequest(owner, repo, `zipball/${branch}`, true, true);
        const zipPath = path.join(config.MOUNT_DIR, 'branch.zip');
        FS.virtual[zipPath] = {
            timestamp: new Date(),
            mode: 33188,
            contents: data,
            path: zipPath
        };
        putRecord(DB_STORE_NAME, FS.virtual[zipPath], database)
        log(`Downloaded ${buffer.byteLength} bytes. Processing...`);

        // Use JSZip to hydrate FS.virtual
        const zip = new JSZip();
        const contents = await zip.loadAsync(buffer);

        const unzipPromises = [];

        contents.forEach((relativePath, file) => {
            if (file.dir) return;

            unzipPromises.push(file.async('uint8array').then(data => {
                // Remove the top-level GitHub folder name (e.g., 'repo-master/')
                const cleanedPath = relativePath.substring(relativePath.indexOf('/') + 1);
                const fullPath = path.join(config.MOUNT_DIR, cleanedPath);

                FS.virtual[fullPath] = {
                    timestamp: new Date(),
                    mode: 33188,
                    contents: data,
                    path: fullPath
                };
                putRecord(DB_STORE_NAME, FS.virtual[fullPath], database)
            }));
        });

        await Promise.all(unzipPromises);
        log("Repository successfully mounted to virtual FS.");

    } catch (err) {
        log(`\x1b[31m[ERROR]\x1b[0m Failed to download repo: ${err.message}`);
    }
}

async function listReleases(owner, repo) {
    try {
        const releases = await githubRequest(owner, repo, 'releases');

        releases.forEach(release => {
            console.log(`Release: ${release.name} (${release.tag_name})`);

            // If you want the assets (like your compiled zip)
            release.assets.forEach(asset => {
                console.log(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
            });
        });

        return releases;
    } catch (err) {
        console.error("Failed to list releases:", err);
    }
}

async function getAuthenticatedUser() {
    const token = localStorage.getItem('github_token');
    if (!token) return null;

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) {
            console.error("Token is invalid or expired.");
            return null;
        }

        const userData = await response.json();
        console.log(`Authenticated as: ${userData.login}`);

        // You can now use userData.avatar_url, userData.name, etc.
        return userData;
    } catch (err) {
        console.error("Failed to fetch user data:", err);
    }
}

