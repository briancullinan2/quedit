// @ts-check


/** @type {import('./widget.d').TerminalCommandGitWindow} */
const commandGitSelf = /** @type {any} */ (self);


/**
 * @param {string[]} argv
 */
async function clone(argv)
{
	const selected = argv[0] || commandGitSelf.toolsRepository || 'briancullinan2/quedit';
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : commandGitSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || commandGitSelf.RepositoryToolbar?.repository?.value;

	/** @type {string | undefined} */
	let branch = argv[1];
	if(!branch && ownerName && repoName)
	{
		branch = await commandGitSelf.getDefaultBranch?.(ownerName, repoName);
	}
	if(ownerName && repoName && branch)
	{
		await commandGitSelf.loadGitHubTree?.(ownerName, repoName, branch);
	}

	commandGitSelf.terminalWrite?.('Checked out: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

	//TODO: await readAll(selected)
}

commandGitSelf.clone = clone;


/**
 * Executes terminal 'status' layout profiling pass
 * @param {string[]} args
 */
async function statusCommand(args)
{
	// Fall back to engine target context if no path argument is supplied directly
	let repoPath = args[0] || commandGitSelf.settingsManager?.get('github', 'engineRepository');
	if(!repoPath)
	{
		console.log("Error: Missing repository configuration context path mapping rules.");
		return;
	}

	const parts = repoPath.split('/');
	if(parts.length !== 2)
	{
		console.log(`Error: Invalid target repository definition standard format [${repoPath}]. Use owner/repo.`);
		return;
	}

	const owner = parts[0];
	const repo = parts[1];
	const branch = await commandGitSelf.getDefaultBranch?.(owner, repo);

	console.log(`Calculating changes for ${owner}/${repo} on branch [${branch}]...`);

	try
	{
		const githubStateService = commandGitSelf.GithubService.getInstance();
		const response = await githubStateService.executeCommand({
			type: 'COMMIT_STATUS_CHECK',
			owner,
			repo,
			branch,
			gitHubToken: localStorage.getItem('github_token') || commandGitSelf.api?.github_token
		});

		const { modified = [], added = [], deleted = [] } = response;
		const totalChanges = modified.length + added.length + deleted.length;

		if(totalChanges === 0)
		{
			console.log(`On branch ${branch}\nYour branch is up to date with origin.\n\nnothing to commit, working tree clean`);
			return;
		}

		console.log(`On branch ${branch}\nChanges tracking matrix compiled:\n`);

		if(modified.length > 0)
		{
			console.log("  Modified files:");
			modified.forEach(p => console.log(`     modified:   ${p}`));
			console.log("");
		}

		if(added.length > 0)
		{
			console.log("  Untracked / Added files:");
			added.forEach(p => console.log(`     new file:   ${p}`));
			console.log("");
		}

		if(deleted.length > 0)
		{
			console.log("  Deleted files:");
			deleted.forEach(p => console.log(`     deleted:    ${p}`));
			console.log("");
		}
	} catch(err)
	{
		if(err instanceof Error)
		{
			console.log(`Status check aborted: ${err.message || err}`);
		}
	}
}

commandGitSelf.statusCommand = statusCommand;

/**
 * Executes terminal 'push' network transaction pass
 * @param {string[]} args
 */
async function push(args)
{
	const commitMessage = args[0];
	if(!commitMessage || commitMessage.trim().length === 0)
	{
		console.log("Error: A non-empty descriptive commit message string target parameter is required.");
		return;
	}

	let repoPath = args[1] || commandGitSelf.settingsManager?.get('github', 'engineRepository');
	const parts = repoPath.split('/');
	const owner = parts[0];
	const repo = parts[1];
	const branch = await commandGitSelf.getDefaultBranch?.(owner, repo);

	console.log(`Assembling commit data layout package context structures to push directly...`);

	try
	{
		const githubStateService = commandGitSelf.GithubService.getInstance();
		const response = await githubStateService.executeCommand({
			type: 'COMMIT_PUSH',
			owner,
			repo,
			branch,
			message: commitMessage,
			gitHubToken: localStorage.getItem('github_token') || commandGitSelf.api?.github_token
		});

		console.log(`\nCommit verification success! Head reference synchronized cleanly.`);
		if(response.sha)
		{
			console.log(`New Remote Commit OID: ${response.sha}`);
		}

		// Optional: Re-render matching UI subtrees to reflect reset modifications state
		for(let widget of commandGitSelf.mainDock?.widgets() ?? [])
		{
			if(widget.constructor.name === 'GithubListWidget' && commandGitSelf.trees?.[repoPath])
			{
				/** @type {import('../filelist/widget-github').GithubListWidget} */
				const githubTree = /** @type {any} */ (widget);
				/** @type {HTMLElement} */
				const node = /** @type {any} */ (githubTree.node.querySelector('[data-id="${repoPath}"]'));
				if(node)
				{
					githubTree.expandDatabaseTree(node, repoPath);
				}
				break;
			}
		}
	} catch(err)
	{
		if(err instanceof Error)
		{
			console.log(`\nPush execution sequence bricked: ${err.message || err}`);
		}
	}
}

commandGitSelf.push = push;

