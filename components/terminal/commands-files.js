

async function ls(argv, database)
{
	let selected = toolsRepository || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	if(!filesRepo[selected])
	{
		let branch = await getDefaultBranch(ownerName, repoName);
		await loadGitHubTree(ownerName, repoName, branch);
	}

	const flags = {
		recursive: argv.includes('-R'),
		human: argv.includes('-h'),
		flat: argv.includes('-1')
	};

	// Assuming FS.virtual.readdir returns objects with {name, size, type}
	const entries = Object.values(FS.virtual)
		.concat(Object.values(filesRepo[selected] || {}) || [])
		.filter(p =>
		{
			if(!p.path)
			{
				debugger;
			}
			let compare = CWD;
			let startMatch = false;
			let subMatch = false;
			if(compare.trim().length == 0)
				compare = '/';
			if(!compare.endsWith('/'))
				compare += '/';

			let path = p.path;
			if(!path.startsWith('/'))
				path = '/' + path;
			if(path.startsWith(compare))
				startMatch = true;
			if(flags.recursive || path.substring(compare.length).indexOf('/') === -1)
				subMatch = true;
			return startMatch && (flags.recursive || subMatch);
		});


	if(flags.flat)
	{
		entries.forEach(e => terminalWrite(e.path + '\n\r'));
	} else
	{
		// Calculate column width for alignment
		const maxName = Math.max(...entries.map(e => e.path.length), 10);

		terminalWrite(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE\n\r`);
		terminalWrite('-'.repeat(maxName + 20) + '\n\r');

		entries.forEach(e =>
		{
			const size = e.contents ? flags.human ? formatBytes(e.contents.length) : e.contents.length.toString() : '0B';
			const nameStr = e.path.padEnd(maxName + 2);
			const sizeStr = size.padEnd(10);
			const color = e.mode === FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

			terminalWrite(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}\n\r`);
		});
	}
}



async function remove(argv, database)
{
	const metas = await getDatabaseMetadata();
	const databases = [database].concat(metas.map(m => m.key));
	const filename = argv[0];

	const queryTarget = argv.join(' ');
	const caseSensitiveActive = argv.includes('-c');
	const cleanQuery = queryTarget.replace(/-c\s*/g, '').trim();


	// Synchronize your search status tracking states so that fallback mirrors stay coherent
	latestQueryVal = cleanQuery;
	lastExecutedQueryVal = cleanQuery;

	// Set up our execution promise callback resolver right before dispatching messages
	const searchPromise = new Promise((resolve, reject) =>
	{
		terminalCommandDeferred = { resolve, reject };

		// Safety timeout watchdog to prevent terminal lockups if background threads hang
		setTimeout(() =>
		{
			if(terminalCommandDeferred)
			{
				resolve([]);
				terminalCommandDeferred = null;
			}
		}, 8000);
	});

	// Fire payload directly down to your background indexing threads
	searchWorker.postMessage({
		query: cleanQuery,
		caseSensitive: caseSensitiveActive,
		gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
		activeRepositories: databases.filter(Boolean)
	});

	const groupedMatches = await searchPromise;
	const rx = globToRegex(filename);


	await Promise.all(groupedMatches.map(async group =>
	{
		if(rx.test(group.path))
		{
			terminalWrite(`Removing ${group.path} on ${group.repo}\n\r`);
			await deleteRecord(DB_STORE_NAME, group.path, group.repo);
		}
	}));

	for(let path of Object.keys(FS.virtual))
	{
		if(rx.test(path))
		{
			delete FS.virtual[filename];
			terminalWrite(`Removing ${filename} from memory\n\r`);
		}
	}

	try
	{
		await api.remove(filename);
	} catch(e)
	{

	}
}




function openCommand(argv, database)
{
	let selected = toolsRepository || argv[1] || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;
	let fileName = argv[0];
	// TODO: I did this backwards, i should have had the terminal click execute the command, and put it in history
	navigateFile(fileName, null);

}

function edit(argv)
{
	return open(argv);
}



/**
 * Asynchronous terminal worker searching interface gateway.
 * Maps over the shared background worker registry.
 */
async function find(argv)
{
	// Reconstruct query argument string securely if user input spans unquoted spaces
	const queryTarget = argv.join(' ');
	const caseSensitiveActive = argv.includes('-c');
	const cleanQuery = queryTarget.replace(/-c\s*/g, '').trim();

	if(!cleanQuery || cleanQuery.length < 2)
	{
		terminalWrite(`\x1b[1;38;5;196mError:\x1b[0m Search query parameter context must span at least 2 characters.\n\r`);
		return;
	}

	terminalWrite(`\x1b[38;5;242m[Worker Thread] Querying repositories for matching traces: "${cleanQuery}"...\x1b[0m\n\r`);

	// Synchronize your search status tracking states so that fallback mirrors stay coherent
	latestQueryVal = cleanQuery;
	lastExecutedQueryVal = cleanQuery;

	// Set up our execution promise callback resolver right before dispatching messages
	const searchPromise = new Promise((resolve, reject) =>
	{
		terminalCommandDeferred = { resolve, reject };

		// Safety timeout watchdog to prevent terminal lockups if background threads hang
		setTimeout(() =>
		{
			if(terminalCommandDeferred)
			{
				resolve([]);
				terminalCommandDeferred = null;
			}
		}, 8000);
	});

	// Fire payload directly down to your background indexing threads
	searchWorker.postMessage({
		query: cleanQuery,
		caseSensitive: caseSensitiveActive,
		gitHubToken: localStorage.getItem('github_token') || window.api?.github_token,
		activeRepositories: [
			window.engineRepository,
			window.gameRepository,
			window.assetRepository,
			window.toolsRepository,
			window.tools2Repository,
			window.environmentRepository
		].filter(Boolean)
	});

	// Put the terminal command router thread to sleep until the worker completes its pass
	const groupedMatches = await searchPromise;

	if(groupedMatches.length === 0)
	{
		terminalWrite(`\n\r\x1b[1;38;5;208m[!] 0 results returned matching parameter targets.\x1b[0m\n\r`);
		return;
	}

	// =========================================================================
	// HIGH-DENSITY TERMINAL TELEMETRY LAYOUT RENDERING
	// =========================================================================
	terminalWrite(`\n\r\x1b[1;38;5;118m=== WORKSPACE SEARCH RESULTS (${groupedMatches.length} files hit) ===\x1b[0m\n\r`);

	groupedMatches.forEach(group =>
	{
		// Output file header block track info
		terminalWrite(`\x1b[1;38;5;45m📁 repo: [${group.repo}] -> ${group.path}\x1b[0m\n\r`);

		// Render explicit line hits if deep content results exist
		if(group.localMatches.length > 0)
		{
			group.localMatches.forEach(match =>
			{
				const lineLabel = `   Line ${match.line}: `.padEnd(14);
				// Highlight structural text highlights
				terminalWrite(`\x1b[38;5;246m${lineLabel}\x1b[0m \x1b[38;5;253m${match.matchText}\x1b[0m\n\r`);
			});
		} else
		{
			// It was a pure filename path match structure or direct glob reference match hit
			terminalWrite(`   \x1b[38;5;242m=> structural path pattern footprint match verified\x1b[0m\n\r`);
		}

		// Micro boundary rule lines isolating file targets
		terminalWrite(`\x1b[38;5;236m${'-'.repeat(80)}\x1b[0m\n\r`);
	});

	terminalWrite(`\n\rSearch operations completed successfully.\n\r`);
}

