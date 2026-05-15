const GITHUB_PREAMBLE = '\x1b[38;5;33m[GITHUB]\x1b[0m '
const FETCH_PREAMBLE = '\x1b[38;5;81m[FETCH]\x1b[0m '
const ERROR_PREAMBLE = '\x1b[38;5;202m[ERROR]\x1b[0m '


async function githubRequest(ownerName, repoName, url, authorize = true, buffer = false) {
    if (typeof localStorage != 'undefined')
        api.github_token = localStorage.getItem('github_token');

    PREAMBLE = GITHUB_PREAMBLE

    const fullUrl = `https://api.github.com/repos/${ownerName}/${repoName}`
        + (url.startsWith('/') || url.trim().length == 0 ? '' : '/') + url
    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: authorize && api.github_token ? {
                'Authorization': `Bearer ${api.github_token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            } : {
            }
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
        PREAMBLE = ERROR_PREAMBLE
        log("Failed to github: " + fullUrl, up);
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

async function githubGraphQL(query, variables = {}) {
    if (typeof localStorage != 'undefined')
        api.github_token = localStorage.getItem('github_token');

    const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${api.github_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data;
}

async function loadGitHubTree(repoOwner, repoName, branch) {

    try {
        let database = repoOwner + '/' + repoName
        const treeData = await githubRequest(repoOwner, repoName, `git/trees/${branch}?recursive=1`);

        // 2. Get the latest commit to get a "Build Date"
        const commitData = await githubRequest(repoOwner, repoName, `commits/${branch}`);
        const buildDate = new Date(commitData.commit.author.date);

        files[database] = treeData.tree.reduce((obj, a) => {
            // Attach the buildDate to every file as a fallback mtime
            a.timestamp = buildDate;
            obj[a.path] = a;
            return obj;
        }, {});

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




/**
 * Main Orchestrator: Instantiates an in-memory virtual filesystem cache
 * populated with accurate historical mtimes from Git history.
 */
async function loadGitHubTreeNew(repoOwner, repoName, branch) {
    const database = `${repoOwner}/${repoName}`;
    const branchName = branch || 'main';

    // We explicitly target the branch root via expression syntax to force complete recursion
    const expressionString = `${branchName}:`;

    const treeQuery = `
    query GetRecursiveTree($owner: String!, $name: String!, $expression: String!) {
      repository(owner: $owner, name: $name) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              path
              type
              oid
              object {
                ... on Blob { byteSize }
              }
            }
          }
        }
      }
    }`;

    try {
        // --- PHASE 1: Fetch the complete flat recursive file system structure ---
        const treeData = await githubGraphQL(treeQuery, {
            owner: repoOwner,
            name: repoName,
            expression: expressionString
        });

        const entries = treeData?.repository?.object?.entries;
        if (!entries) {
            throw new Error(`Could not resolve repository tree layout for branch: ${branchName}`);
        }

        // Create the base map inside memory
        if (typeof files[database] === 'undefined')
            files[database] = {};
        const filesToHydrate = [];

        for (const entry of entries) {
            const isFile = entry.type === 'blob';
            files[database][entry.path] = {
                path: entry.path,
                sha: entry.oid,
                type: isFile ? 'file' : 'dir',
                mode: isFile ? FS_FILE : FS_DIR,
                size: entry.object?.byteSize || 0,
                timestamp: null, // Will be populated in Phase 2
                parent: path.substring(0, path.lastIndexOf('/'))
            };

            if (isFile) {
                filesToHydrate.push(entry.path);
            } else {
                // Directories do not require historical commit logs, assign current execution fallback
                files[database][entry.path].timestamp = new Date();
            }
        }

        // --- PHASE 2: Dynamic Batch Log Hydration via GraphQL Aliasing ---
        // We chunk file updates to prevent generating a massive query payload that gets rejected
        const BATCH_SIZE = 50;
        const batchPromises = [];

        for (let i = 0; i < filesToHydrate.length; i += BATCH_SIZE) {
            const chunk = filesToHydrate.slice(i, i + BATCH_SIZE);
            batchPromises.push(hydrateFileMTimes(repoOwner, repoName, branchName, chunk, files[database]));
        }

        // Wait for all batch chunks to finish pulling history concurrently
        await Promise.all(batchPromises);

        return files[database];

    } catch (error) {
        console.error('Robust GitHub tree load failed:', error);
        throw error;
    }
}

/**
 * Compiles and runs an aliased GraphQL query targeting a specific array of paths.
 */
async function hydrateFileMTimes(owner, repo, branch, filePaths, targetCache) {
    if (filePaths.length === 0) return;

    // Dynamically build up the aliased fields inside the query block
    let aliasLines = '';
    filePaths.forEach((path, index) => {
        // GraphQL aliases must match standard naming constraints (no slashes, dots, or dashes)
        const safeAlias = `file_${index}`;
        aliasLines += `
        ${safeAlias}: ref(qualifiedName: $qualifiedBranch) {
          target {
            ... on Commit {
              history(first: 1, path: "${path}") {
                nodes {
                  committedDate
                }
              }
            }
          }
        }\n`;
    });

    const dynamicQuery = `
    query GetBatchedMTimes($owner: String!, $repo: String!, $qualifiedBranch: String!) {
      repository(owner: $owner, name: $repo) {
        ${aliasLines}
      }
    }`;

    const qualifiedBranch = branch.includes('refs/') ? branch : `refs/heads/${branch}`;

    try {
        const result = await githubGraphQL(dynamicQuery, {
            owner,
            repo,
            qualifiedBranch
        });

        const repoData = result?.repository;
        if (!repoData) return;

        // Loop back over the file paths and bind the returned commit logs to the original object references
        filePaths.forEach((path, index) => {
            const safeAlias = `file_${index}`;
            const historyNodes = repoData[safeAlias]?.target?.history?.nodes;

            if (historyNodes && historyNodes.length > 0) {
                // Map the authentic Git modification time from the latest commit targeting this path
                targetCache[path].timestamp = new Date(historyNodes[0].committedDate);
            } else {
                // Fallback safe assignment if no file mutations are tracked in current branch ref history
                targetCache[path].timestamp = new Date();
            }
        });

    } catch (err) {
        console.warn('Failed resolving batch historical mtimes, processing paths:', filePaths, err);
        // Fallback gracefully so an individual chunk failure doesn't brick the entire initialization process
        filePaths.forEach(path => {
            if (!targetCache[path].timestamp) targetCache[path].timestamp = new Date();
        });
    }
}


const github = {}
const trees = {}
const files = {}

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
        const selected = repoOwner + '/' + repoName

        //if (files[selected][filePath])
        //    FS.virtual[filePath] = files[selected][filePath]
        let record = await getRecord(DB_STORE_NAME, filePath, selected)
        FS.virtual[filePath] = record
        if (files[selected][filePath]
            && FS.virtual[filePath]
        )
            FS.virtual[filePath].timestamp = files[selected][filePath].timestamp


        if (!files[selected]) {
            let branch = getDefaultBranch(repoOwner, repoName)
            await loadGitHubTree(repoOwner, repoName, branch)
        }


        // TODO: IF GITHUB, ALWAYS UPDATE
        if (files[selected][filePath]) {

        }
        else if (record /*&& (record.sha == sha)*/) {
            if (api.memfs && !api.memfs.exists(filePath))
                api.memfs.addFile(filePath, record.contents)
            return record.contents
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
            timestamp: files[selected][filePath].timestamp,
            mode: FS_FILE,
            contents: bytes,
            path: filePath,
            sha: jsonResponse.sha,
            parent: filePath.substring(0, filePath.lastIndexOf('/'))
        }

        // async to filesystem
        // does it REALLY matter if it makes it? wont it just redownload?
        await putRecord(DB_STORE_NAME, FS.virtual[filePath], selected)

        if (api.memfs && !api.memfs.exists(filePath))
            api.memfs.addFile(filePath, bytes)

        return bytes
    } catch (e) {
        log(`Cache file error in ${filePath}\n\r${e.message}\n\r${e.stack || e.stacktrace}`)
        throw e
    }

}



async function downloadRepoZip(owner, repo, branch = 'master', database = null) {

    if (!database)
        database = owner + '/' + repo

    PREAMBLE = FETCH_PREAMBLE

    try {
        log(`Requesting archive from ${owner}/${repo}...`);

        const buffer = await githubRequest(owner, repo, `zipball/${branch}`, true, true);
        const zipPath = path.join(config.MOUNT_DIR, 'branch.zip');
        FS.virtual[zipPath] = {
            timestamp: new Date(),
            mode: FS_FILE,
            contents: data,
            path: zipPath,
            sha: await getGitShaBrowser(data),
            parent: zipPath.substring(0, zipPath.lastIndexOf('/'))
        };
        putRecord(DB_STORE_NAME, FS.virtual[zipPath], database)
        log(`Downloaded ${buffer.byteLength} bytes. Processing...`);

        // Use JSZip to hydrate FS.virtual
        const zip = new JSZip();
        const contents = await zip.loadAsync(buffer);

        const unzipPromises = [];

        contents.forEach((relativePath, file) => {
            if (file.dir) return;

            unzipPromises.push(file.async('uint8array').then(async data => {
                // Remove the top-level GitHub folder name (e.g., 'repo-master/')
                const cleanedPath = relativePath.substring(relativePath.indexOf('/') + 1);
                const fullPath = path.join(config.MOUNT_DIR, cleanedPath);

                FS.virtual[fullPath] = {
                    timestamp: new Date(),
                    mode: FS_FILE,
                    contents: data,
                    path: fullPath,
                    sha: await getGitShaBrowser(data),
                    parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
                };

                putRecord(DB_STORE_NAME, FS.virtual[fullPath], database)
            }));
        });

        await Promise.all(unzipPromises);
        log("Repository successfully mounted to virtual FS.");

    } catch (err) {
        PREAMBLE = ERROR_PREAMBLE
        log(`Failed to download repo: ${err.message}`);
    }
}

async function listReleases(owner, repo) {
    try {
        const releases = await githubRequest(owner, repo, 'releases');



        releases.forEach(release => {
            log(`Release: ${release.name} (${release.tag_name})`);

            // If you want the assets (like your compiled zip)
            release.assets.forEach(asset => {
                log(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
            });
        });

        return releases;
    } catch (err) {
        PREAMBLE = ERROR_PREAMBLE
        log("Failed to list releases: " + err);
    }
}

async function getAuthenticatedUser() {
    const token = localStorage.getItem('github_token');
    if (!token) return null;


    PREAMBLE = GITHUB_PREAMBLE


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
        log(`Authenticated as: ${userData.login}`);

        // You can now use userData.avatar_url, userData.name, etc.
        return userData;
    } catch (err) {
        PREAMBLE = ERROR_PREAMBLE
        log("Failed to fetch user data: " + err);
    }
}

