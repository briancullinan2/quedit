

const imageEditor = document.getElementById('paint');

let openFileDebounce = null;
let latestOpenRequest = null;

async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true, hidePanels = true, noBounce = false)
{

	latestOpenRequest = () => openFile(repoOwner, repoName, filePath, sha, recordHistory, hidePanels, true);
	if(!noBounce && openFileDebounce) return;
	if(!noBounce)
	{
		openFileDebounce = setTimeout(() =>
		{
			latestOpenRequest();
			openFileDebounce = null;
		}, 400);
		return;
	}

	let content = await cacheFile(repoOwner, repoName, filePath, sha, true);
	if(!content || content.length === 0)
	{
		const urls = [
			filePath,
			'https://quake.games/' + filePath,
			'https://quake.games/' + filePath.replace('docs/', '')
		];
		for(const url of urls)
		{
			try
			{
				let response = await fetch(url, { mode: 'cors', credentials: 'omit' });
				if(response.ok)
				{
					content = await response.arrayBuffer();
					break;
				}
			} catch(e) { /* silent fail, try next hook */ }
		}
	}

	if(!content || content.length === 0) return;

	const byteView = new Uint8Array(content);
	const sampleBytes = byteView.subarray(0, 8192);
	const decoder = new TextDecoder();
	const sampleStr = decoder.decode(sampleBytes);

	let str;
	let isImageFile = AssetInspector.isActuallyImage(sampleBytes, filePath);
	let isMapFile = AssetInspector.isActuallyMap(sampleBytes, sampleStr, filePath);

	// 1. Process Payload Types
	if(isImageFile)
	{
		latestPanelId = latestNotFilelist = 'paint';
		previousNotFilelistId = null;
		str = "[Binary Image Layer Inserted]";
	} else if(isMapFile)
	{
		// Execute extracted function module
		await openMap(content, filePath, sampleBytes);
		str = hexDump(sampleBytes, content, filePath);
	} else if(hasSequentialBinaryRegex.test(sampleStr))
	{
		previousNotFilelistId = 'editor';
		str = hexDump(sampleBytes, content, filePath);
	} else
	{
		str = decoder.decode(content);
	}

	// 2. Load Visual Resource Engines
	if(isImageFile)
	{
		await DependencyLoader.loadModule('paint');
		setTimeout(async () =>
		{
			if(typeof openImage === 'function') openImage(content, filePath);
		}, 200);
		previousPanelId = null;
	} else
	{
		// Keep text editor ready for Hex Dump view or standard source maps
		await DependencyLoader.loadModule('editor');
	}

	if(hidePanels)
	{
		hideOpenPanels(isImageFile || isMapFile);
	}

	updateBodyPanelIds();

	// 3. UI Layer Routing and Display State Updates
	const viewportWrapper = document.getElementById('viewport-frame');

	if(isImageFile)
	{
		imageEditor.classList.remove('hidden');
		imageEditor.classList.add('not-hidden');
	} else if(typeof getOrCreateAceSession !== 'undefined')
	{
		const session = getOrCreateAceSession(filePath, str);
		if(session.getMode()?.$id?.includes('antlr_worker'))
		{
			setTimeout(async () =>
			{
				if(window.compilerDiagnostics)
				{
					const bridge = window.compilerDiagnostics.getBridge();
					bridge.refreshActiveEditorView(session);
				}
			}, 500);
		}
		aceEditor.setSession(session);

		// Keep editor visible even if map is rendering, allowing multi-canvas/split behaviors
		editorContainer.classList.remove('hidden');
		editorContainer.classList.add('not-hidden');
	}

	// Handle Viewport Container assignment safely without wiping active styles
	if(isMapFile && viewportWrapper)
	{
		viewportWrapper.classList.remove('hidden');
		viewportWrapper.classList.add('not-hidden');
	} else if(viewportWrapper && !viewportWrapper.classList.contains('hidden'))
	{
		// If switching away to another non-map text file, hide the viewport safely
		viewportWrapper.classList.add('hidden');
		viewportWrapper.classList.remove('not-hidden');
	}

	resizeDebouncer();

	if(recordHistory)
	{
		recordFileHistory(filePath, sha);
	}
}

async function openMap(content, filePath, sampleBytes)
{
	// =========================================================================
	// TIER 1: IMMEDIATE INTERCEPTION & DEPENDENCY RESOLUTION
	// =========================================================================
	const isBsp = BINARY_DETECTOR.bsp.match(sampleBytes) || filePath.endsWith('.bsp');
	if(!isBsp) return false;

	// Set panel identification tracks immediately to avoid UI popping
	latestPanelId = latestNotFilelist = 'viewport-frame';
	previousNotFilelistId = 'editor';

	const mapFile = filePath.split('/').pop().split('.')[0];
	let preferredRenderer = SettingsManager.get('quake3e', 'preferredRenderer');

	// Pre-hydrate heavy engine modules immediately instead of inside the timeout
	if(document.getElementById('nunu').classList.contains('not-hidden'))
	{
		preferredRenderer = 'nunu';
	} else if(document.getElementById('viewport-frame').classList.contains('not-hidden'))
	{
		if(typeof initMap === 'function')
		{
			preferredRenderer = 'toji';
		} else if(typeof initEngine === 'function')
		{
			preferredRenderer = 'quake3e';
		}
	}

	if(preferredRenderer === 'toji')
	{
		await DependencyLoader.loadModule('toji');
	} else if(preferredRenderer === 'nunu')
	{
		await DependencyLoader.loadModule('nunu');
	} else
	{
		// Default fallback: 'quake3e' WebAssembly runtime core
		await DependencyLoader.loadModule('quake3e');
	}

	// =========================================================================
	// TIER 2: DEFERRED VIEWPORT MOUNTING & RUNTIME ENGINE INITIALIZATION
	// =========================================================================
	setTimeout(async () =>
	{
		if(preferredRenderer === 'toji')
		{
			const viewport = document.getElementById('viewport');
			let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);
			if(typeof initMap === 'function')
			{
				initMap(gl, mapFile, content);
			}
		}
		else if(preferredRenderer === 'nunu')
		{
			// Native editor pipeline unblocked by Devin
			if(typeof importBSP === 'function')
			{
				await importBSP(mapFile, content);
			}
		}
		else
		{
			// Native Quake3e WebAssembly runtime implementation
			if(typeof Cbuf_AddText === 'function' && typeof stringToAddress === 'function')
			{
				// Safely pipe the raw map load command alongside subsystem resets straight into the engine core
				const bspCommand = `map ${mapFile} ; fs_restart ; vid_restart ;\n`;
				Cbuf_AddText(stringToAddress(bspCommand));
			} else
			{
				console.error("Quake3e runtime bindings or stringToAddress pointer allocation missing.");
			}
		}
	}, 200);

	return true;
}



let hasUntared = false;

async function untarFrontent()
{

	const response = await fetch('/sysroot.tar', {
		mode: 'cors',
		credentials: 'omit',
	});
	const tar = new API.Tar(await response.arrayBuffer(), log);
	const count = await tar.untar(this.memfs);
	console.log(`${count} files read.`);
	hasUntared = true;

}




async function downloadFile(repoOwner, repoName, filename)
{
	((d, s, k, n) =>
	{
		let r = indexedDB.open(d);
		r.onsuccess = () => r.result.transaction(s).objectStore(s).get(k).onsuccess = e =>
		{
			let d = e.target.result;
			if(!d)
				return console.error('Key not found');
			let b = d instanceof Blob
				? d
				: new Blob([typeof d === 'object' ? JSON.stringify(d, null, 2) : d], { type: 'application/octet-stream' }),
				a = document.createElement('a');
			a.href = URL.createObjectURL(b);
			a.download = n; a.click();
		};
	})(repoOwner + '/' + repoName, DB_STORE_NAME, filename, filename.split('/').pop());
}










// Helper to keep the metadata block pristine
function getMimeTypeByExtension(filename)
{
	const ext = filename.split('.').pop().toLowerCase();
	const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
	return map[ext] || 'image/png';
}




let fileClickDebouncer = null;

async function clickFile(filePath, lineNumber, noBounce = false, noHide = false, recordHistory = true)
{

	if(fileClickDebouncer)
	{
		clearTimeout(fileClickDebouncer);
	}
	if(!noBounce)
	{
		fileClickDebouncer = setTimeout(() => clickFile(filePath, lineNumber, true, noHide, recordHistory), 500);
		return;
	}

	let whatTheFuck = await findFileTestPath(filePath);
	selected = whatTheFuck[1];
	dbFile = whatTheFuck[2];
	if(dbFile)
	{
		filePath = whatTheFuck[0];
	}


	if(!dbFile || !selected)
	{
		console.log('File not found: ' + filePath);
		return [,];
	}

	// do this once now to full reset
	if(!noHide)
		hideOpenPanels();
	latestPanelId = previousPanelId = 'editor'; // switch from terminal automatically

	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	if(!dbFile) dbFile = files[selected][filePath];

	if(!dbFile) return [null, selected];

	window.currentOpenFileId = dbFile.sha;

	await openFile(ownerName, repoName, filePath, dbFile.sha, recordHistory /* record history */, false /* show file list */, true);
	if(recordHistory)
	{
		recordFileHistory(filePath, dbFile.sha, lineNumber);
	}
	if(typeof editorContainer !== 'undefined'
		&& editorContainer.classList.contains('not-hidden')
	)
	{
		setTimeout(() =>
		{
			aceEditor.focus();
			if(lineNumber)
				aceEditor.gotoLine(lineNumber, 0, true);
			latestPanelId = 'editor';
		}, 1000);
	}
	resizeDebouncer();
	return [selected, dbFile];
}


let fileNavigationDebouncer;
async function navigateFile(filePath, lineNumber, noBounce = false, noHide = false, recordHistory = true)
{

	if(fileNavigationDebouncer)
	{
		clearTimeout(fileNavigationDebouncer);
	}
	if(!noBounce)
	{
		fileNavigationDebouncer = setTimeout(() => navigateFile(filePath, lineNumber, true, noHide, recordHistory), 500);
		return;
	}

	if(filePath.startsWith('/'))
		filePath = filePath.substring(1);
	const [selected, dbFile] = await clickFile(filePath, lineNumber, true, noHide, recordHistory);

	if(!selected) return;

	if(!noHide)
	{
		hideOpenPanels();
	}

	if(selected === engineRepository)
		renderTabsCommand('filelist', true, false);
	if(selected === gameRepository)
		renderTabsCommand('gamelist', true, false);
	if(selected === assetRepository)
		renderTabsCommand('assetlist', true, false);
	if(selected === toolsRepository)
		renderTabsCommand('database', true, false);
	if(selected === tools2Repository)
		renderTabsCommand('database', true, false);


}



