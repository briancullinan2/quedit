

async function clone(argv)
{
	const selected = argv[0] || toolsRepository || 'briancullinan2/quedit';
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	const branch = argv[1];
	if(!branch)
	{
		branch = await getDefaultBranch(ownerName, repoName);
	}
	await loadGitHubTree(ownerName, repoName, branch);

	terminalWrite('Checked out: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

	//TODO: await readAll(selected)
}




/**
 * Executes terminal 'status' layout profiling pass
 */
async function status(args, flags)
{
	// Fall back to engine target context if no path argument is supplied directly
	let repoPath = args[0] || SettingsManager.get('core', 'engineRepository');
	if(!repoPath)
	{
		writeLog("Error: Missing repository configuration context path mapping rules.");
		return;
	}

	const parts = repoPath.split('/');
	if(parts.length !== 2)
	{
		writeLog(`Error: Invalid target repository definition standard format [${repoPath}]. Use owner/repo.`);
		return;
	}

	const owner = parts[0];
	const repo = parts[1];
	const branch = await getDefaultBranch(owner, repo);
	const callbackId = `term_status_${Date.now()}`;

	writeLog(`Calculating changes for ${owner}/${repo} on branch [${branch}]...`);

	return new Promise((resolve) =>
	{
		// Register an ad-hoc one-off message trap on your persistent background worker
		const handleMessage = (e) =>
		{
			if(e.data.callbackId !== callbackId || e.data.type !== 'staging_status') return;

			githubWorker.removeEventListener('message', handleMessage);
			const { status, modified, added, deleted, error } = e.data;

			if(status !== 'SUCCESS')
			{
				writeLog(`Status check aborted: ${error || 'Unknown execution variance'}`);
				return resolve();
			}

			const totalChanges = (modified?.length || 0) + (added?.length || 0) + (deleted?.length || 0);

			if(totalChanges === 0)
			{
				writeLog(`On branch ${branch}\nYour branch is up to date with origin.\n\nnothing to commit, working tree clean`);
				return resolve();
			}

			writeLog(`On branch ${branch}\nChanges tracking matrix compiled:\n`);

			// Pretty print variations mapping standard colors or markers
			if(modified && modified.length > 0)
			{
				writeLog("  Modified files:");
				modified.forEach(p => writeLog(`     modified:   ${p}`));
				writeLog("");
			}

			if(added && added.length > 0)
			{
				writeLog("  Untracked / Added files:");
				added.forEach(p => writeLog(`     new file:   ${p}`));
				writeLog("");
			}

			if(deleted && deleted.length > 0)
			{
				writeLog("  Deleted files:");
				deleted.forEach(p => writeLog(`     deleted:    ${p}`));
				writeLog("");
			}

			resolve();
		};

		githubWorker.addEventListener('message', handleMessage);

		githubWorker.postMessage({
			type: 'COMMIT_STATUS_CHECK',
			owner,
			repo,
			branch,
			gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
			callbackId
		});
	});
}

/**
 * Executes terminal 'push' network transaction pass
 */
async function push(args, flags)
{
	const commitMessage = args[0];
	if(!commitMessage || commitMessage.trim().length === 0)
	{
		writeLog("Error: A non-empty descriptive commit message string target parameter is required.");
		return;
	}

	let repoPath = args[1] || SettingsManager.get('core', 'engineRepository');
	const parts = repoPath.split('/');
	const owner = parts[0];
	const repo = parts[1];
	const branch = await getDefaultBranch(owner, repo);
	const callbackId = `term_push_${Date.now()}`;

	writeLog(`Assembling commit data layout package context structures to push directly...`);

	return new Promise((resolve) =>
	{
		const handleMessage = (e) =>
		{
			if(e.data.callbackId !== callbackId || e.data.type !== 'commit_status') return;

			githubWorker.removeEventListener('message', handleMessage);
			const { status, sha, error } = e.data;

			if(status === 'SUCCESS')
			{
				writeLog(`\nCommit verification success! Head reference synchronized cleanly.`);
				writeLog(`New Remote Commit OID: ${sha}`);

				// Optional: Re-render matching UI subtrees to reflect reset modifications state
				if(trees['#github'] && loadedGithubTreeNodes[repoPath])
				{
					// Force an instant re-sync evaluation tree updates pass
					expandGithubTree(document.querySelector(`[data-id="${repoPath}"]`), repoPath);
				}
			} else
			{
				writeLog(`\nPush execution sequence bricked: ${error}`);
			}
			resolve();
		};

		githubWorker.addEventListener('message', handleMessage);

		githubWorker.postMessage({
			type: 'COMMIT_PUSH',
			owner,
			repo,
			branch,
			message: commitMessage,
			gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
			callbackId
		});
	});
}
