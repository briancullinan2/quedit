

const imageEditor = document.getElementById('paint')

let openFileDebounce = null;
let latestOpenRequest = null;

async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true, hidePanels = true, noBounce = false) {

    latestOpenRequest = () => openFile(repoOwner, repoName, filePath, sha, recordHistory, hidePanels, true);
    if (!noBounce && openFileDebounce) return;
    if (!noBounce) {
        openFileDebounce = setTimeout(() => {
            latestOpenRequest();
            openFileDebounce = null;
        }, 400);
        return;
    }

    let content = await cacheFile(repoOwner, repoName, filePath, sha, true);
    if (!content || content.length === 0) {
        const urls = [
            filePath,
            'https://quake.games/' + filePath,
            'https://quake.games/' + filePath.replace('docs/', '')
        ];
        for (const url of urls) {
            try {
                let response = await fetch(url, { mode: 'cors', credentials: 'omit' });
                if (response.ok) {
                    content = await response.arrayBuffer();
                    break;
                }
            } catch (e) { /* silent fail, try next hook */ }
        }
    }

    if (!content || content.length === 0) return;

    const byteView = new Uint8Array(content);
    const sampleBytes = byteView.subarray(0, 8192);
    const decoder = new TextDecoder();
    const sampleStr = decoder.decode(sampleBytes);

    let str;
    let isImageFile = AssetInspector.isActuallyImage(sampleBytes, filePath);
    let isMapFile = AssetInspector.isActuallyMap(sampleBytes, sampleStr, filePath);

    // 1. Process Payload Types
    if (isImageFile) {
        latestPanelId = latestNotFilelist = 'paint';
        previousNotFilelistId = null;
        str = "[Binary Image Layer Inserted]";
    } else if (isMapFile) {
        // Execute extracted function module
        await openMap(content, filePath, sampleBytes);
        str = hexDump(sampleBytes, content, filePath);
    } else if (hasSequentialBinaryRegex.test(sampleStr)) {
        previousNotFilelistId = 'editor';
        str = hexDump(sampleBytes, content, filePath);
    } else {
        str = decoder.decode(content);
    }

    // 2. Load Visual Resource Engines
    if (isImageFile) {
        await DependencyLoader.loadModule('paint');
        setTimeout(async () => {
            if (typeof openImage === 'function') openImage(content, filePath);
        }, 200);
        previousPanelId = null;
    } else {
        // Keep text editor ready for Hex Dump view or standard source maps
        await DependencyLoader.loadModule('editor');
    }

    if (hidePanels) {
        hideOpenPanels(isImageFile || isMapFile);
    }

    updateBodyPanelIds();

    // 3. UI Layer Routing and Display State Updates
    const viewportWrapper = document.getElementById('viewport-frame');

    if (isImageFile) {
        imageEditor.classList.remove('hidden');
        imageEditor.classList.add('not-hidden');
    } else if (typeof getOrCreateAceSession !== 'undefined') {
        const session = getOrCreateAceSession(filePath, str);
        if (session.getMode()?.$id?.includes('antrl_worker')) {
            setTimeout(async () => {
                if (window.compilerDiagnostics) {
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
    if (isMapFile && viewportWrapper) {
        viewportWrapper.classList.remove('hidden');
        viewportWrapper.classList.add('not-hidden');
    } else if (viewportWrapper && !viewportWrapper.classList.contains('hidden')) {
        // If switching away to another non-map text file, hide the viewport safely
        viewportWrapper.classList.add('hidden');
        viewportWrapper.classList.remove('not-hidden');
    }

    resizeDebouncer();

    if (recordHistory) {
        recordFileHistory(filePath, sha);
    }
}


async function openMap(content, filePath, sampleBytes) {
    // 1. Precise check: Fallback to extension check if binary detector isn't matching perfectly
    const isBsp = BINARY_DETECTOR.bsp.match(sampleBytes) || filePath.endsWith('.bsp');
    if (!isBsp) return false;

    // Set panel identification tracks
    latestPanelId = latestNotFilelist = 'viewport-frame';
    previousNotFilelistId = 'editor';

    // Fire viewport module injections asynchronously safely out of blocking cycle
    setTimeout(async () => {
        const viewport = document.getElementById('viewport');
        const mapFile = filePath.split('/').pop().split('.')[0];

        const preferredRenderer = SettingsManager.get('quake3e', 'preferredRenderer');

        if (preferredRenderer === 'toji') {
            await DependencyLoader.loadModule('toji');
            let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);
            if (typeof initMap === 'function') {
                initMap(gl, mapFile);
            }
        } else if (preferredRenderer === 'nunu') {
            await DependencyLoader.loadModule('nunu');
            // Add custom nunuStudio initialization hooks here if needed
        } else {
            // Default fallback: 'quake3e'
            await DependencyLoader.loadModule('quake3e');
        }
    }, 200);

    return true;
}




async function openImage(content, filePath) {
    const filename = filePath.split('/').pop();
    const dataUri = arrayBufferToDataUri(content, filePath);

    // Guarantee the asset is parsed and miniPaint has committed actions before resolving
    await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            console.log(`[VFS Media] Decoded dimensions: ${img.naturalWidth}x${img.naturalHeight}`);

            // 1. Process EXIF hooks inline while the image memory context is active
            if ((filename.includes('.jpg') || filename.includes('.jpeg')) && window.Layers?.extract_exif) {
                try {
                    const fakeFileObj = {
                        name: filename,
                        size: content.byteLength,
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    };
                    window.layerSettings = window.layerSettings || {};
                    window.layerSettings._exif = window.Layers.extract_exif(fakeFileObj);
                } catch (exifErr) {
                    console.warn("EXIF extraction skipped:", exifErr);
                }
            }

            // 2. Dispatch straight into miniPaint engine pipeline using the SAME image object instance reference
            if (window.State && window.Actions) {
                try {
                    const actionsBuffer = [];

                    // Step A: Accumulate layer deletion actions to flush current document state cleanly
                    if (window.Layers && typeof window.Layers.get_layers === 'function') {
                        const existingLayers = window.Layers.get_layers();
                        // Loop backwards to cleanly handle splicing indices out of the state trees
                        for (let i = existingLayers.length - 1; i >= 0; i--) {
                            window.State.do_action(new window.Actions.Delete_layer_action(existingLayers[i].id));
                        }
                    }


                    // Step B: Set the canvas dimensions cleanly for a pristine scene file boundary
                    //actionsBuffer.push(new window.Actions.Prepare_canvas_action({
                    //    width: img.naturalWidth,
                    //    height: img.naturalHeight,
                    //    clear: true
                    //}));

                    // Step C: Construct the baseline payload for our incoming image layer
                    const layerPayload = {
                        name: filename || "Data URL",
                        type: "image",
                        link: img, // Pass the already loaded element directly
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        width_original: img.naturalWidth,
                        height_original: img.naturalHeight,
                        x: 0,
                        y: 0
                    };

                    // actionsBuffer.push(new window.Actions.Insert_layer_action(layerPayload));

                    // Step D: Commit the entire atomic change sequence via a single history bundle
                    window.State.do_action(
                        new window.Actions.Bundle_action("open_file_data_url", "Open File Data URL", [
                            new window.Actions.Insert_layer_action(layerPayload),
                            new window.Actions.Autoresize_canvas_action(img.naturalWidth, img.naturalHeight, null, true, true)
                        ])
                    );

                } catch (err) {
                    console.error("Failed executing miniPaint bundled actions:", err);
                }
            } else {
                console.error("miniPaint core engine references missing during canvas load cycle.");
            }

            resolve(); // Resolution gate unlocked
        };

        img.onerror = (e) => {
            console.error("Failed to decode image data stream.");
            if (window.g && typeof window.g().error === 'function') {
                window.g().error("Sorry, image could not be loaded.");
            }
            resolve(); // Avoid locking parent execution context threads on crash limits
        };

        // Fire single data stream translation pass
        img.src = dataUri;
    });
}


let hasUntared = false

async function untarFrontent() {

    PREAMBLE = TAR_PREAMBLE
    const response = await fetch('/sysroot.tar', {
        mode: 'cors',
        credentials: 'omit',
    });
    const tar = new API.Tar(await response.arrayBuffer(), log);
    const count = await tar.untar(this.memfs);
    writeLog(`${count} files read.`);
    hasUntared = true

}




async function downloadFile(repoOwner, repoName, filename) {
    ((d, s, k, n) => {
        let r = indexedDB.open(d);
        r.onsuccess = () => r.result.transaction(s).objectStore(s).get(k).onsuccess = e => {
            let d = e.target.result;
            if (!d)
                return console.error('Key not found');
            let b = d instanceof Blob
                ? d
                : new Blob([typeof d === 'object' ? JSON.stringify(d, null, 2) : d], { type: 'application/octet-stream' }),
                a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = n; a.click()
        }
    })(repoOwner + '/' + repoName, DB_STORE_NAME, filename, filename.split('/').pop());
}










// Helper to keep the metadata block pristine
function getMimeTypeByExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    return map[ext] || 'image/png';
}




let fileClickDebouncer = null

async function clickFile(filePath, lineNumber, noBounce = false, noHide = false, recordHistory = true) {

    if (fileClickDebouncer) {
        clearTimeout(fileClickDebouncer)
    }
    if (!noBounce) {
        fileClickDebouncer = setTimeout(() => clickFile(filePath, lineNumber, true, noHide, recordHistory), 500)
        return
    }

    let whatTheFuck = await findFileTestPath(filePath)
    selected = whatTheFuck[1]
    dbFile = whatTheFuck[2]
    if (dbFile) {
        filePath = whatTheFuck[0]
    }


    if (!dbFile || !selected) {
        writeLog('File not found: ' + filePath)
        return [,]
    }

    // do this once now to full reset
    if (!noHide)
        hideOpenPanels()
    latestPanelId = previousPanelId = 'editor' // switch from terminal automatically

    const parts = selected.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    if (!dbFile) dbFile = files[selected][filePath]

    if (!dbFile) return [null, selected]

    window.currentOpenFileId = dbFile.sha

    await openFile(ownerName, repoName, filePath, dbFile.sha, recordHistory /* record history */, false /* show file list */, true)
    if (recordHistory) {
        recordFileHistory(filePath, dbFile.sha, lineNumber)
    }
    if (typeof editorContainer !== 'undefined'
        && editorContainer.classList.contains('not-hidden')
    ) {
        setTimeout(() => {
            aceEditor.focus();
            if (lineNumber)
                aceEditor.gotoLine(lineNumber, 0, true);
            latestPanelId = 'editor'
        }, 1000)
    }
    resizeDebouncer()
    return [selected, dbFile]
}


let fileNavigationDebouncer
async function navigateFile(filePath, lineNumber, noBounce = false, noHide = false, recordHistory = true) {

    if (fileNavigationDebouncer) {
        clearTimeout(fileNavigationDebouncer)
    }
    if (!noBounce) {
        fileNavigationDebouncer = setTimeout(() => navigateFile(filePath, lineNumber, true, noHide, recordHistory), 500)
        return
    }

    if (filePath.startsWith('/'))
        filePath = filePath.substring(1)
    const [selected, dbFile] = await clickFile(filePath, lineNumber, true, noHide, recordHistory)

    if (!selected) return

    hideOpenPanels()

    if (selected === engineRepository)
        renderTabsCommand('filelist', true, false)
    if (selected === gameRepository)
        renderTabsCommand('gamelist', true, false)
    if (selected === assetRepository)
        renderTabsCommand('assetlist', true, false)
    if (selected === toolsRepository)
        renderTabsCommand('database', true, false)
    if (selected === tools2Repository)
        renderTabsCommand('database', true, false)


}



