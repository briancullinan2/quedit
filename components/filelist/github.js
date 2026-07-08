/// <reference path="../bundle/github.d.ts" />


async function githubRequest(ownerName, repoName, url, authorize = true, buffer = false)
{
	if(typeof SettingsManager != 'undefined' && window.api)
		window.api.github_token = SettingsManager.get('core', 'githubToken');

	PREAMBLE = GITHUB_PREAMBLE;

	const fullUrl = `https://api.github.com/repos/${ownerName}/${repoName}`
		+ (url.startsWith('/') || url.trim().length == 0 ? '' : '/') + url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
	try
	{
		const headers = {
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		};

		let token = typeof api !== 'undefined'
			? api.github_token
			: localStorage.getItem('github_token');

		// Only add auth if explicitly requested AND we have a token
		if(authorize && token)
		{
			// Using 'token ' works universally for both classic and fine-grained PATs
			headers['Authorization'] = `Bearer  ${token}`;
		} else if(!token)
		{
		}

		const response = await fetch(fullUrl, {
			method: 'GET',
			//mode: 'cors',
			//credentials: 'omit',
			headers: headers
		});

		if(!response.ok)
		{
			if(response.status === 401
				|| response.status === 403
			)
			{
				throw new Error('UNAUTHORIZED_ACCESS');
			}
			throw new Error(`HTTP_ERROR: ${response.status}`);
		}

		if(buffer)
			return await response.arrayBuffer();
		return await response.json();
	} catch(up)
	{
		if(authorize && up.message === 'UNAUTHORIZED_ACCESS')
		{
			return await githubRequest(ownerName, repoName, url, false, buffer);
		} else if(up.message === 'UNAUTHORIZED_ACCESS')
		{
		}
		PREAMBLE = ERROR_PREAMBLE;
		console.error("Failed to github: " + fullUrl, up);
		throw up;
	}

}


let defaultBranches = {};
async function getDefaultBranch(owner, repo)
{
	if(defaultBranches[owner + '/' + repo]) return defaultBranches[owner + '/' + repo];
	const data = await githubRequest(owner, repo, '');
	defaultBranches[owner + '/' + repo] = data.default_branch;
	return data.default_branch; // Usually "main" or "master"
}

async function getBranchVersion(owner, repo, branch)
{
	// Fallback to default branch if not specified
	branch ||= await getDefaultBranch(owner, repo);

	// 1. Query the specific branch endpoint
	const branchData = await githubRequest(owner, repo, `/branches/${branch}`);

	// 2. Extract the date string from the latest commit on that branch
	const dateString = branchData.commit.commit.author.date;

	// 3. Parse into a JavaScript Date object
	const buildDate = new Date(dateString);

	return buildDate;
}


async function getBranches(repoOwner, repoName)
{

	try
	{
		const branches = await githubRequest(repoOwner, repoName, 'branches');;

		const defaultName = await getDefaultBranch(repoOwner, repoName);

		const sortedBranches = branches.sort((a, b) =>
		{
			if(a.name === defaultName) return -1;
			if(b.name === defaultName) return 1;
			return a.name.localeCompare(b.name);
		});


		return branches;
	} catch(error)
	{
		console.error("Failed to fetch branches:", error);
		return [];
	}
}



async function githubGraphQL(query, variables = {})
{

	let token = typeof api !== 'undefined'
		? api.github_token
		: SettingsManager.get('core', 'githubToken');


	const response = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer  ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables })
	});

	const result = await response.json();
	if(result.errors) throw new Error(result.errors[0].message);
	return result.data;
}


const mapFiles = {
	"": "Current map"
};

async function loadGitHubTree(repoOwner, repoName, branch)
{

	try
	{
		let database = repoOwner + '/' + repoName;
		const treeData = await githubRequest(repoOwner, repoName, `git/trees/${branch}?recursive=1`);

		// 2. Get the latest commit to get a "Build Date"
		const commitData = await githubRequest(repoOwner, repoName, `commits/${branch}`);
		const buildDate = new Date(commitData.commit.author.date);

		files[database] = treeData.tree.reduce((obj, a) =>
		{
			// Attach the buildDate to every file as a fallback mtime
			if(a.path.toLowerCase().includes('.map') || a.path.toLowerCase().includes('.bsp'))
			{
				if(!mapFiles[a.path])
				{
					mapFiles[a.path] = a.path.split('/').pop();
				}
			}
			a.timestamp = buildDate;
			obj[a.path] = a;
			return obj;
		}, {});

		let databases = await getDatabaseMetadata();
		if(databases.filter(d => d.key == database).length == 0
			|| (await needsInstall(database, DB_SCHEME)).item3)
		{
			await deleteOldDatabase(database);
			await setupDatabase(database, DB_SCHEME);
		}

		if(Object.keys(mapFiles).length > 1 && typeof updateSelectOptions !== 'undefined')
		{
			updateSelectOptions('map', mapFiles);
		}

		return files[database];
	} catch(error)
	{
		console.error('Failed to load GitHub tree:', error);
	}

}


/**
 * Main Orchestrator: Instantiates an in-memory virtual filesystem cache
 * populated with accurate historical mtimes from Git history via recursive GraphQL.
 * * @param {string} repoOwner - The owner of the GitHub repository.
 * @param {string} repoName - The repository name.
 * @param {string} branch - The branch target (defaults to 'main').
 * @param {string} initialPath - Optional directory subdirectory path to scope the initialization tree.
 */
async function loadGitHubTreeNew(repoOwner, repoName, branch, initialPath = '')
{
	const database = `${repoOwner}/${repoName}`;
	const branchName = branch || 'main';

	const treeQuery = `
    query GetFolderEntries($owner: String!, $name: String!, $expression: String!) {
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

	try
	{
		// Initialize the tracking database allocation if it hasn't happened yet
		if(typeof files[database] === 'undefined')
		{
			files[database] = {};
		}

		const filesToHydrate = [];

		// --- PHASE 1: Breadth-First Search Queue Recursion ---
		// Seed our queue with the initial explicit target path
		const directoryQueue = [initialPath];

		while(directoryQueue.length > 0)
		{
			const currentSubPath = directoryQueue.shift();

			// Format Git expression rule: "branch:" for root, or "branch:path/to/dir"
			const expressionString = currentSubPath === ''
				? `${branchName}:`
				: `${branchName}:${currentSubPath}`;

			const treeData = await githubGraphQL(treeQuery, {
				owner: repoOwner,
				name: repoName,
				expression: expressionString
			});

			const entries = treeData?.repository?.object?.entries;
			if(!entries)
			{
				// If a subfolder fails, log it and continue instead of crashing the entire build run
				console.warn(`Could not resolve repository sub-tree entries at expression: ${expressionString}`);
				continue;
			}

			for(const entry of entries)
			{
				const isFile = entry.type === 'blob';

				// Map out the flat file cache signature
				files[database][entry.path] = {
					path: entry.path,
					sha: entry.oid,
					type: isFile ? 'file' : 'dir',
					mode: isFile ? FS_FILE : FS_DIR,
					size: entry.object?.byteSize || 0,
					timestamp: null, // Will be hydrated later if file
					parent: entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : ''
				};

				if(isFile)
				{
					filesToHydrate.push(entry.path);
				} else
				{
					// Set directory runtime fallback timestamp
					files[database][entry.path].timestamp = new Date();
					// Push the newly uncovered subdirectory straight into the queue loop to look deeper
					directoryQueue.push(entry.path);
				}
			}
		}

		// --- PHASE 2: Dynamic Batch Log Hydration via GraphQL Aliasing ---
		const BATCH_SIZE = 50;
		const batchPromises = [];

		for(let i = 0; i < filesToHydrate.length; i += BATCH_SIZE)
		{
			const chunk = filesToHydrate.slice(i, i + BATCH_SIZE);
			batchPromises.push(hydrateFileMTimes(repoOwner, repoName, branchName, chunk, files[database]));
		}

		// Concurrently populate file modification records across all chunks
		await Promise.all(batchPromises);

		return files[database];

	} catch(error)
	{
		console.error('Robust GraphQL recursive tree load failed:', error);
		throw error;
	}
}


/**
 * Compiles and runs an aliased GraphQL query targeting a specific array of paths.
 */
async function hydrateFileMTimes(owner, repo, branch, filePaths, targetCache)
{
	if(filePaths.length === 0) return;

	// Dynamically build up the aliased fields inside the query block
	let aliasLines = '';
	filePaths.forEach((path, index) =>
	{
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

	try
	{
		const result = await githubGraphQL(dynamicQuery, {
			owner,
			repo,
			qualifiedBranch
		});

		const repoData = result?.repository;
		if(!repoData) return;

		// Loop back over the file paths and bind the returned commit logs to the original object references
		filePaths.forEach((path, index) =>
		{
			const safeAlias = `file_${index}`;
			const historyNodes = repoData[safeAlias]?.target?.history?.nodes;

			if(historyNodes && historyNodes.length > 0)
			{
				// Map the authentic Git modification time from the latest commit targeting this path
				targetCache[path].timestamp = new Date(historyNodes[0].committedDate);
			} else
			{
				// Fallback safe assignment if no file mutations are tracked in current branch ref history
				targetCache[path].timestamp = new Date();
			}
		});

	} catch(err)
	{
		console.warn('Failed resolving batch historical mtimes, processing paths:', filePaths, err);
		// Fallback gracefully so an individual chunk failure doesn't brick the entire initialization process
		filePaths.forEach(path =>
		{
			if(!targetCache[path].timestamp) targetCache[path].timestamp = new Date();
		});
	}
}


async function getGitSha256Browser(content)
{
    const encoder = new TextEncoder();
    let contentBytes;

    if(content instanceof Uint8Array)
    {
        contentBytes = content;
    } else if(content instanceof ArrayBuffer)
    {
        // Wrap the raw ArrayBuffer in a Uint8Array view so it has a .length property
        contentBytes = new Uint8Array(content);
    } else
    {
        contentBytes = encoder.encode(content);
    }

    // Create Git blob header using .byteLength for accuracy
    const header = `blob ${contentBytes.byteLength}\0`;
    const headerBytes = encoder.encode(header);

    // Combine using .byteLength to support all binary types safely
    const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
    finalBytes.set(headerBytes);
    finalBytes.set(contentBytes, headerBytes.byteLength);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', finalBytes);

    // Convert ArrayBuffer to Hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function getGitShaBrowser(content)
{
	const encoder = new TextEncoder();
	let contentBytes;

	if(content instanceof Uint8Array)
	{
		contentBytes = content;
	} else if(content instanceof ArrayBuffer)
	{
		// Wrap the raw ArrayBuffer in a Uint8Array view so it has a .length property
		contentBytes = new Uint8Array(content);
	} else
	{
		contentBytes = encoder.encode(content);
	}

	// Create Git blob header using .byteLength for accuracy
	const header = `blob ${contentBytes.byteLength}\0`;
	const headerBytes = encoder.encode(header);

	// Combine using .byteLength to support all binary types safely
	const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
	finalBytes.set(headerBytes);
	finalBytes.set(contentBytes, headerBytes.byteLength);

	// Generate SHA-1 hash
	const hashBuffer = await crypto.subtle.digest('SHA-1', finalBytes);

	// Convert ArrayBuffer to Hex string
	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

async function cacheFile(repoOwner, repoName, filePath, sha, forceReload = false)
{
	return await debounceRecords(DB_STORE_NAME, 'path', filePath, sha, forceReload, repoOwner + '/' + repoName, 'cache');
}


async function cacheFileInternal(repoOwner, repoName, filePath, sha, forceReload = false)
{

	const selected = repoOwner + '/' + repoName;
	try
	{


		// TODO: this once from front end or backend, but not both
		if(!files[selected])
		{
			let branch = await getDefaultBranch(repoOwner, repoName);
			await loadGitHubTree(repoOwner, repoName, branch);
		}

		if(!FS.virtual[filePath]
			|| !FS.virtual[filePath].contents
			|| !FS.virtual[filePath].contents.length === 0
		)
		{
			FS.virtual[filePath] = await getRecord(DB_STORE_NAME, filePath, selected);
		}
		if(files[selected][filePath] && FS.virtual[filePath])
		{
			if(FS.virtual[filePath].timestamp > files[selected][filePath].timestamp)
			{
				console.info(`Skipping changed (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			}
			//FS.virtual[filePath].timestamp = files[selected][filePath].timestamp
		}

		try
		{
			if(typeof api !== 'undefined' && api.memfs && FS.virtual[filePath] && !api.memfs.exists(filePath))
				api.memfs.addFile(filePath, FS.virtual[filePath].contents);
		} catch(e)
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(filePath.includes('tmp/')
			|| filePath.includes(dirs.ENGINE_RELEASE)
			|| filePath.includes(dirs.ENGINE_DEBUG))
		{
			if(FS.virtual[filePath])
			{
				console.info(`Already compiled (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			}
			else
			{
				console.info(`Skipping output (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return null;
			}
		}


		// TODO: only continue if the file is in github
		const shouldDownload = files[selected] && files[selected][filePath];


		// TODO: IF GITHUB, ALWAYS UPDATE
		if(!shouldDownload && FS.virtual[filePath])
		{
			if(filePath.includes('.syms'))
			{
				debugger;
				console.error('No you fucking dont: ' + filePath);
			}
			console.info(`Already have cached (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		}

		if(!shouldDownload)
		{
			console.info(`Skipping unimportant (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return null;
		}


		// TODO: use this to indicate whether we should update against file change time
		if(!forceReload && FS.virtual[filePath])
		{
			console.info(`Skipping important (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		} else
		{
			console.info(`Downloading important (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		}


		let jsonResponse = await githubRequest(repoOwner, repoName, `contents/${filePath}`);

		// --- DECODING LOGIC ---
		// GitHub wraps the file content in a JSON object and encodes it in Base64
		// We strip newlines and decode it back to a standard UTF-8 string
		let bytes;
		if(jsonResponse.encoding === 'base64')
		{
			// Decode base64 string to a binary string, then map to bytes
			const binString = atob(jsonResponse.content.replace(/\s/g, ''));
			bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
		} else
		{
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
		};


		// async to filesystem
		// does it REALLY matter if it makes it? wont it just redownload?
		await putRecord(DB_STORE_NAME, FS.virtual[filePath], selected);

		try
		{

			if(typeof api !== 'undefined' && api.memfs && !api.memfs.exists(filePath))
				api.memfs.addFile(filePath, bytes);

		} catch(e)
		{
			console.warn(`Memfs Error: ${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		console.info(`Downloaded fresh (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);

		return bytes;
	} catch(e)
	{
		console.error(`Cache file error in ${filePath}`);
		if(!e.message.includes('HTTP_ERROR:'))
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(files[selected][filePath])
			return files[selected][filePath].contents;
		throw e;
	}

}



async function downloadRepoZip(owner, repo, branch = 'master', database = null)
{

	if(!database)
		database = owner + '/' + repo;

	PREAMBLE = FETCH_PREAMBLE;

	try
	{
		console.info(`Requesting archive from ${owner}/${repo}...`);

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
		putRecord(DB_STORE_NAME, FS.virtual[zipPath], database);
		console.info(`Downloaded ${buffer.byteLength} bytes. Processing...`);

		// Use JSZip to hydrate FS.virtual
		const zip = new JSZip();
		const contents = await zip.loadAsync(buffer);

		const unzipPromises = [];

		contents.forEach((relativePath, file) =>
		{
			if(file.dir) return;

			unzipPromises.push(file.async('uint8array').then(async data =>
			{
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

				putRecord(DB_STORE_NAME, FS.virtual[fullPath], database);
			}));
		});

		await Promise.all(unzipPromises);
		console.info("Repository successfully mounted to virtual FS.");

	} catch(err)
	{
		PREAMBLE = ERROR_PREAMBLE;
		console.error(`Failed to download repo: ${err.message}`);
	}
}

async function listReleases(owner, repo)
{
	try
	{
		const releases = await githubRequest(owner, repo, 'releases');



		releases.forEach(release =>
		{
			console.info(`Release: ${release.name} (${release.tag_name})`);

			// If you want the assets (like your compiled zip)
			release.assets.forEach(asset =>
			{
				console.info(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
			});
		});

		return releases;
	} catch(err)
	{
		PREAMBLE = ERROR_PREAMBLE;
		console.error("Failed to list releases: " + err);
	}
}

async function getAuthenticatedUser()
{
	const token = SettingsManager.get('core', 'githubToken');
	if(!token) return null;


	PREAMBLE = GITHUB_PREAMBLE;


	try
	{
		const response = await fetch('https://api.github.com/user', {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if(response.status === 401)
		{
			console.error("Token is invalid or expired.");
			return null;
		}

		const userData = await response.json();
		console.info(`Authenticated as: ${userData.login}`);

		// You can now use userData.avatar_url, userData.name, etc.
		return userData;
	} catch(err)
	{
		PREAMBLE = ERROR_PREAMBLE;
		console.error("Failed to fetch user data: " + err);
	}
}


async function searchGitHubRepositories(query, ownerName, repoName)
{
	let queryString = query;

	// Append qualifiers cleanly inside the q parameter value
	if(ownerName && repoName)
	{
		queryString += ` repo:${ownerName}/${repoName}`;
	} else if(ownerName)
	{
		queryString += ` user:${ownerName}`;
	}

	// Now safely encode the entire combined query string
	const fullUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(queryString)}`;

	let token = typeof api !== 'undefined'
		? api.github_token
		: localStorage.getItem('github_token');

	const headers = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};

	if(token)
	{
		headers['Authorization'] = `Bearer  ${token}`;
	}

	const response = await fetch(fullUrl, {
		//mode: 'cors',
		//credentials: 'omit',
		headers
	});
	if(!response.ok) throw new Error(`Search failed: ${response.status}`);

	const data = await response.json();
	return data.items; // Array of matched repository objects containing names, owners, and shas
}


/**
 * Dispatches the safe GitHub global query pass
 */
async function searchGitHubCode(query, activeRepositories, token)
{
	// If no scopes are ready, drop out
	if(activeRepositories.length === 0) return [];

	// Use the first active repository context to scope the code query space safely
	const primaryRepo = activeRepositories[0];
	const queryString = `${query} repo:${primaryRepo}`;
	const fullUrl = `https://api.github.com/search/code?q=${encodeURIComponent(queryString)}`;

	const headers = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
	if(token)
	{
		headers['Authorization'] = `Bearer  ${token}`;
	}

	try
	{
		const response = await fetch(fullUrl, {
			//mode: 'cors',
			//credentials: 'omit',
			headers
		});
		if(!response.ok) return [];
		const data = await response.json();

		return (data.items || []).map(item => ({
			path: item.path,
			sha: item.sha,
			repoSource: primaryRepo,
			matchText: `Remote Instance (Index Pointer: ${item.sha.substring(0, 7)})`,
			isRemote: true
		}));
	} catch(err)
	{
		console.error("Worker remote GitHub fetch aborted:", err);
		return [];
	}
}



(function (root)
{

	const exportsObject = {
		defaultBranches,
		mapFiles,
		githubRequest,
		getDefaultBranch,
		getBranchVersion,
		getBranches,
		githubGraphQL,
		loadGitHubTree,
		loadGitHubTreeNew,
		hydrateFileMTimes,
		getGitShaBrowser,
		cacheFile,
		cacheFileInternal,
		downloadRepoZip,
		listReleases,
		getAuthenticatedUser,
		searchGitHubRepositories,
		searchGitHubCode
	};

	// 1. CommonJS Node environment
	if(typeof module !== 'undefined' && module.exports)
	{
		module.exports = exportsObject;
	}
	// 2. Bare exports environment
	else if(typeof exports !== 'undefined')
	{
		Object.assign(exports, exportsObject);
	}
	// 3. Web Worker context (Classic or Module)
	else if(typeof self !== 'undefined' && typeof self.importScripts === 'function')
	{
		Object.assign(self || root || {}, exportsObject);
	}
	// 4. Standard Browser UI Thread fallback
	else
	{
		Object.assign(root || {}, exportsObject);
	}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

