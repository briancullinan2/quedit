/// <reference path="../bundle/global.d.ts" />

/** @type {WorkerGlobalScope & { api?: { github_token?: string | null | undefined } }} */
const workerSelf2 = self;

if(!workerSelf2.api)
{
	workerSelf2.api = {
		github_token: null
	};
}

importScripts('/components/core/preambles.js');
importScripts('/components/core/local.js');
importScripts('/components/engine/sys_fs.js');
importScripts('/components/filelist/github.js');


async function pushLocalChangesToGitHub(repoOwner, repoName, branch, commitMessage, staging)
{
	// 1. Fetch current branch parent pointer references
	const commitData = await self.githubRequest(repoOwner, repoName, `commits/${branch}`);
	const parentCommitSha = commitData.sha;
	const baseTreeSha = commitData.commit.tree.sha;

	// 2. Get the exact same staging layout calculated dynamically
	staging ||= await calculateStagedChanges(repoOwner, repoName, branch);

	if(staging.treeEntries.length === 0)
	{
		console.log("No discrete variations detected between local working layer and remote branch head.");
		return null;
	}

	// 3. Process and write actual network Blobs only for items in the staging entries
	const treeChanges = [];
	debugger;
	for(const entry of staging.treeEntries)
	{
		console.log(`Uploading changed file blob: ${entry.path}`);
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
	await self.loadGitHubTree(repoOwner, repoName, branch);
	return newCommitSha;
}


/**
 * Creates a raw binary blob structure on GitHub's structural servers.
 */
async function createGitHubBlob(owner, repo, contents)
{
	let base64Content;
	if(contents instanceof Uint8Array)
	{
		base64Content = btoa(String.fromCharCode.apply(null, contents));
	} else if(contents instanceof ArrayBuffer)
	{
		base64Content = btoa(String.fromCharCode.apply(null, new Uint8Array(contents)));
	} else
	{
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

	if(!result.ok) throw new Error(`Blob generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Builds an explicit Git Tree description configuration map array structure.
 */
async function createGitHubTree(owner, repo, baseTreeSha, treeChanges)
{
	const payload = {
		base_tree: baseTreeSha,
		tree: treeChanges
	};

	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Tree generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Writes an immutable Commit signature referencing the state of a compiled structural tree.
 */
async function createGitHubCommit(owner, repo, message, treeSha, parentCommitShas)
{
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

	if(!result.ok) throw new Error(`Commit generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Patches the structural reference point pointer configuration for a remote branch layout.
 */
async function updateBranchReference(owner, repo, branch, commitSha)
{
	const payload = {
		sha: commitSha,
		force: false // Set to true only if resetting historical chains
	};

	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
		method: 'PATCH',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Failed updating reference branch path: ${result.status}`);
	return await result.json();
}

/**
 * Internal parsing token helper targeting local context variables inside workers
 */
function getGitHubHeaders()
{
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
 * Dynamically loads and respects a root-level .gitignore file via glob matching.
 */
async function calculateStagedChanges(repoOwner, repoName, branch, listDeleted = false)
{
	const selected = `${repoOwner}/${repoName}`;

	// 1. Ensure the remote baseline tree layout skeleton is hydrated locally
	if(!self.filesRepo[selected])
	{
		await self.loadGitHubTree(repoOwner, repoName, branch);
	}
	const remoteTree = self.filesRepo[selected] || {};

	const changes = {
		modified: [],   // { path, localSha, remoteSha }
		added: [],      // { path, localSha }
		deleted: [],    // Remote files completely missing from local IndexedDB storage
		treeEntries: [] // Structured changes array targeting subsequent Git Trees compilation API passes
	};

	const foundLocalPaths = new Set();
	const ignoreRules = [];

	try
	{
		// 2. Open up the repository's dedicated IndexedDB storage space
		const db = await getDB(selected);
		if(!db.objectStoreNames.contains(DB_STORE_NAME))
		{
			db.close();
			console.log(`Target store ${DB_STORE_NAME} not allocated yet for database: ${selected}`);
			return changes;
		}

		// --- PHASE 1: PARSE .GITIGNORE FROM IDB CACHE ---
		// Attempt to extract raw .gitignore record directly out of your IDB store
		let gitignoreRecord = null;
		try
		{
			gitignoreRecord = await self.cacheFile(repoOwner, repoName, '.gitignore');
		} catch(e)
		{
			// Non-fatal if .gitignore doesn't exist yet
			debugger;
		}

		if(gitignoreRecord)
		{
			let ignoreText = "";
			if(gitignoreRecord instanceof Uint8Array)
			{
				ignoreText = new TextDecoder().decode(gitignoreRecord);
			} else if(gitignoreRecord instanceof ArrayBuffer)
			{
				ignoreText = new TextDecoder().decode(new Uint8Array(gitignoreRecord));
			} else
			{
				ignoreText = gitignoreRecord || "";
			}

			// Split file content into clean rules
			ignoreText.split(/\r?\n/).forEach(line =>
			{
				const trimmed = line.trim();
				// Omit blank lines and commented targets
				if(!trimmed || trimmed.startsWith('#')) return;

				try
				{
					// Adapt your worker's native glob translation rule engine
					const ruleRegex = globToRegex(trimmed, false);
					ignoreRules.push(ruleRegex);
				} catch(err)
				{
					console.warn(`Failed compiling ignore pattern [${trimmed}]:`, err);
				}
			});
			console.log(`Loaded ${ignoreRules.length} compiled pattern matching masks from root .gitignore`);
		}


		const ruleRegex1 = globToRegex(dirs.ENGINE_DEBUG + '/**', false);
		ignoreRules.push(ruleRegex1);

		const ruleRegex2 = globToRegex(dirs.ENGINE_RELEASE + '/**', false);
		ignoreRules.push(ruleRegex2);

		// Inline matcher to evaluate structural patterns
		const isIgnored = (path) =>
		{
			// Hardcoded sanity fallbacks alongside dynamic rules
			if(path.includes('tmp/') || path.includes('/bin/') || path.includes('/obj/'))
			{
				return true;
			}
			return ignoreRules.some(regex =>
			{
				regex.lastIndex = 0;
				return regex.test(path);
			});
		};

		// --- PHASE 2: SCAN LOCAL INDEXEDDB RECORDS ---
		await readAll(selected, async (fileRecord) =>
		{
			if(!fileRecord || !fileRecord.path) return;

			const filePath = fileRecord.path;

			if((fileRecord.mode >> 12) !== self.ST_FILE) return;

			// Run item directly through combined glob evaluation
			if(isIgnored(filePath)) return;

			foundLocalPaths.add(filePath);

			const contents = fileRecord.contents;
			if(!contents) return;

			// Resolve local hash context via optimized fallback routing
			let localSha = fileRecord.sha;
			if(!localSha)
			{
				localSha = await self.getGitShaBrowser(contents);
			}

			const remoteRecord = remoteTree[filePath];

			if(!remoteRecord)
			{
				// File exists locally in IDB but is absent on GitHub
				changes.added.push({ path: filePath, sha: localSha });
				changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
			} else if(remoteRecord.sha !== localSha)
			{
				// File shifted away from remote baseline branch tracking points
				changes.modified.push({ path: filePath, localSha, remoteSha: remoteRecord.sha });
				changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
			}
		});

		// --- PHASE 3: IDENTIFY DELETIONS FROM REMOTE ---
		if(listDeleted)
		{
			for(const [remotePath, remoteRecord] of Object.entries(remoteTree))
			{
				if(remoteRecord.type === 'tree') continue;

				// Skip verification tracking if the file matches dynamic ignore patterns
				if(isIgnored(remotePath)) continue;

				if(!foundLocalPaths.has(remotePath))
				{
					changes.deleted.push({ path: remotePath });

					// Formulate deletion entries for the Git Data Tree mapping array
					changes.treeEntries.push({
						path: remotePath,
						mode: '100644',
						type: 'blob',
						sha: null
					});
				}
			}
		}

	} catch(err)
	{
		console.error(`Failed compiling status check tracking matrix for ${selected}:`, err);
		throw err;
	}

	return changes;
}


self.onmessage = async function (e)
{

	// --- ROUTE A: GET STAGING STATUS (Safe / Read-Only) ---
	if(e.data.type === 'COMMIT_STATUS_CHECK')
	{
		const { owner, repo, branch, callbackId, gitHubToken } = e.data;
		if(api)
		{
			api.github_token = gitHubToken;
		}
		try
		{
			const stagingDetails = await calculateStagedChanges(owner, repo, branch);
			self.postMessage({
				type: 'staging_status',
				status: 'SUCCESS',
				modified: stagingDetails.modified.map(f => f.path),
				added: stagingDetails.added.map(f => f.path),
				callbackId
			});
		} catch(err)
		{
			if(err instanceof Error)
			{
				self.postMessage({ type: 'staging_status', status: 'ERROR', error: err.message, callbackId });
			}
		}
		return;
	}

	// --- ROUTE B: EXECUTE DESTRUCTIVE COMMIT PUSH ---
	if(e.data.type === 'COMMIT_PUSH')
	{
		const { owner, repo, branch, message, callbackId, gitHubToken } = e.data;
		if(api)
		{
			api.github_token = gitHubToken;
		}
		try
		{
			const finalSha = await pushLocalChangesToGitHub(owner, repo, branch, message);
			self.postMessage({ type: 'commit_status', status: 'SUCCESS', sha: finalSha, callbackId });
		} catch(err)
		{
			if(err instanceof Error)
			{
				self.postMessage({ type: 'commit_status', status: 'ERROR', error: err.message, callbackId });
			}
		}
		return;
	}
};
