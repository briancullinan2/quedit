/// <reference path="../bundle/global.d.ts" />



const formatBytes = (bytes) =>
{
	if(bytes === 0) return '0B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

async function ls(argv, database)
{
	let selected = window.toolsRepository || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;

	if(!window.filesRepo[selected])
	{
		let branch = await window.getDefaultBranch(ownerName, repoName);
		await window.loadGitHubTree(ownerName, repoName, branch);
	}

	const flags = {
		recursive: argv.includes('-R'),
		human: argv.includes('-h'),
		flat: argv.includes('-1')
	};

	// Assuming FS.virtual.readdir returns objects with {name, size, type}
	const entries = Object.values(window.FS.virtual)
		.concat(Object.values(window.filesRepo[selected] || {}) || [])
		.filter(p =>
		{
			if(!p)
			{
				return false;
			}
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
		entries.forEach(e =>
		{
			if(!e) return;
			terminalWrite(e.path + '\n\r');
		});
	} else
	{
		// Calculate column width for alignment
		const maxName = Math.max(...entries.map(e =>
		{
			if(!e) return 0;
			return e.path.length;
		}), 10);

		terminalWrite(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE\n\r`);
		terminalWrite('-'.repeat(maxName + 20) + '\n\r');

		entries.forEach(e =>
		{
			if(!e) return;
			const size = e.contents ? flags.human ? formatBytes(e.contents.length) : e.contents.length.toString() : '0B';
			const nameStr = e.path.padEnd(maxName + 2);
			const sizeStr = size.padEnd(10);
			const color = e.mode === self.FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

			terminalWrite(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}\n\r`);
		});
	}
}


async function remove(argv, database)
{
	if(!argv.length || !argv[0])
	{
		terminalWrite(`\x1b[1;38;5;196mError:\x1b[0m Target filename or glob pattern required.\n\r`);
		return;
	}

	const caseSensitiveActive = argv.includes('-c');
	const filteredArgs = argv.filter(arg => arg !== '-c');
	const filename = filteredArgs[0];
	const cleanQuery = filteredArgs.join(' ').trim();

	if(!cleanQuery || cleanQuery.length < 2)
	{
		terminalWrite(`\x1b[1;38;5;196mError:\x1b[0m Search target must span at least 2 characters.\n\r`);
		return;
	}

	// Resolve target databases
	const metas = await window.getDatabaseMetadata?.() || [];
	const targetDatabases = [database, ...metas.map((m) => m.key)].filter(Boolean);

	terminalWrite(`\x1b[38;5;242m[Worker Thread] Locating candidate files for removal matching: "${cleanQuery}"...\x1b[0m\n\r`);

	let timerId = null;

	// Dispatch query through shared service
	const { callbackId, promise } = self.searchService.search(
		{
			query: cleanQuery,
			caseSensitive: caseSensitiveActive,
			activeRepositories: targetDatabases
		},
		undefined,
		'cli-remove'
	);

	// Watchdog safety timeout
	const watchdogPromise = new Promise((resolve) =>
	{
		timerId = setTimeout(() =>
		{
			self.searchService.cancelSearch(callbackId);
			resolve([]);
		}, 8000);
	});

	const groupedMatches = await Promise.race([promise, watchdogPromise]);

	if(timerId) clearTimeout(timerId);

	const rx = self.globToRegex(filename);

	// 1. Purge matching records across repositories
	await Promise.all(
		groupedMatches.map(async (group) =>
		{
			if(rx.test(group.path))
			{
				terminalWrite(`Removing ${group.path} on ${group.repo}\n\r`);
				await self.deleteRecord(self.DB_STORE_NAME, group.path, group.repo);
			}
		})
	);

	// 2. Clear matching in-memory entries from FS.virtual
	const virtualFS = self.FS?.virtual;
	if(virtualFS)
	{
		for(const path of Object.keys(virtualFS))
		{
			if(rx.test(path))
			{
				delete virtualFS[path];
				terminalWrite(`Removing ${path} from memory\n\r`);
			}
		}
	}

	// 3. Notify remote storage backend
	try
	{
		await window.api?.remove?.(filename);
	} catch(e)
	{
		// Silently swallow backend removal errors if unhandled
	}

	terminalWrite(`\x1b[38;5;118mRemove operation finished.\x1b[0m\n\r`);
}



function openCommand(argv, database)
{
	let selected = self.toolsRepository || argv[1] || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : self.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || self.RepositoryToolbar?.repository?.value;
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
 * Stream-renders results as they arrive while keeping the promise alive until complete.
 */
async function find(argv)
{
	const caseSensitiveActive = argv.includes('-c');
	const filteredArgs = argv.filter(arg => arg !== '-c');
	const cleanQuery = filteredArgs.join(' ').trim();

	if(!cleanQuery || cleanQuery.length < 2)
	{
		terminalWrite(`\x1b[1;38;5;196mError:\x1b[0m Search query parameter context must span at least 2 characters.\n\r`);
		return;
	}

	terminalWrite(`\x1b[38;5;242m[Worker Thread] Querying repositories for matching traces: "${cleanQuery}"...\x1b[0m\n\r`);

	let knownPathsCount = 0;
	let timerId = null;

	const renderIncrementalResults = (groupedMatches) =>
	{
		if(groupedMatches.length === 0 || groupedMatches.length <= knownPathsCount)
		{
			return;
		}

		const newGroups = groupedMatches.slice(knownPathsCount);
		knownPathsCount = groupedMatches.length;

		newGroups.forEach(group =>
		{
			terminalWrite(`\x1b[1;38;5;45m📁 repo: [${group.repo}] -> ${group.path}\x1b[0m\n\r`);

			if(group.localMatches.length > 0)
			{
				group.localMatches.forEach(match =>
				{
					const lineLabel = `   Line ${match.line}: `.padEnd(14);
					terminalWrite(`\x1b[38;5;246m${lineLabel}\x1b[0m \x1b[38;5;253m${match.matchText}\x1b[0m\n\r`);
				});
			} else
			{
				terminalWrite(`   \x1b[38;5;242m=> structural path pattern footprint match verified\x1b[0m\n\r`);
			}

			terminalWrite(`\x1b[38;5;236m${'-'.repeat(80)}\x1b[0m\n\r`);
		});
	};

	const { callbackId, promise } = self.searchService.search(
		{
			query: cleanQuery,
			caseSensitive: caseSensitiveActive
		},
		(partialResults) =>
		{
			renderIncrementalResults(partialResults);
		},
		'cli-find'
	);

	const watchdogPromise = new Promise((resolve) =>
	{
		timerId = setTimeout(() =>
		{
			self.searchService.cancelSearch(callbackId);
			resolve([]);
		}, 8000);
	});

	terminalWrite(`\n\r\x1b[1;38;5;118m=== WORKSPACE SEARCH RESULTS STREAM ===\x1b[0m\n\r`);

	const finalResults = await Promise.race([promise, watchdogPromise]);

	if(timerId) clearTimeout(timerId);

	if(knownPathsCount === 0)
	{
		terminalWrite(`\n\r\x1b[1;38;5;208m[!] 0 results returned matching parameter targets.\x1b[0m\n\r`);
	} else
	{
		terminalWrite(`\n\rSearch operations completed successfully (${knownPathsCount} total files matched).\n\r`);
	}
}
