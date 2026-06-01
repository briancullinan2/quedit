

const imageEditor = document.getElementById('paint')


let openFileDebounce = null
let latestOpenRequest = null
async function openFile(repoOwner, repoName, filePath, sha, recordHistory = true, hidePanels = true, noBounce = false) {

    latestOpenRequest = () => openFile(repoOwner, repoName, filePath, sha, recordHistory, hidePanels, true)
    if (!noBounce && openFileDebounce) return
    if (!noBounce) {
        openFileDebounce = setTimeout(() => {
            latestOpenRequest()
            openFileDebounce = null
        }, 400);
        return
    }

    let content = await cacheFile(repoOwner, repoName, filePath, sha, true);
    if (!content || content.length === 0) {
        try {
            let response = await fetch(filePath, {
                mode: 'cors',
                credentials: 'omit',
            })
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    if (!content || content.length === 0) {
        try {
            let response = await fetch('https://quake.games/' + filePath, {
                mode: 'cors',
                credentials: 'omit',
            })
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    if (!content || content.length === 0) {
        try {
            let response = await fetch('https://quake.games/' + filePath.replace('docs/', ''), {
                mode: 'cors',
                credentials: 'omit',
            })
            if (response.ok)
                content = await response.arrayBuffer()
        } catch (e) {
        }
    }
    const byteView = new Uint8Array(content);
    // 1. Scan just the first 1024 bytes for binary characters before decoding everything
    const sampleBytes = byteView.subarray(0, 8192);
    const decoder = new TextDecoder();
    const sampleStr = decoder.decode(sampleBytes);

    let str
    let image = isImage(filePath)
    if (image) {
        setTimeout(async () => {
            await DependencyLoader.loadModule('paint');
            openImage(content, filePath)
        }, 200);

        // Optionally fall back to text hexDump or return early so Ace Editor doesn't choke
        latestPanelId = latestNotFilelist = 'paint'
        if (typeof getOrCreateAceSession !== 'undefined')
            previousNotFilelistId = 'editor'
        else
            previousNotFilelistId = null
        str = "[Binary Image Layer Inserted]";
    } else if (hasSequentialBinaryRegex.test(sampleStr)) {
        if (filePath.endsWith('.bsp')) {
            // TODO: also open toji bsp viewer like the image editor
            setTimeout(async () => {
                const viewport = document.getElementById('viewport')
                await DependencyLoader.loadModule('toji');
                let mapFile = filePath.split('/').pop().split('.')[0]
                let gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);
                initMap(gl, mapFile)
            }, 200)
            latestPanelId = latestNotFilelist = 'viewport-frame'
        }


        previousNotFilelistId = 'editor'
        str = hexDump(sampleBytes, content, filePath)
    } else {
        if (filePath.endsWith('.c') || filePath.endsWith('.h'))
            setTimeout(async () => {
                if (window.compilerDiagnostics) {
                    const bridge = window.compilerDiagnostics.getBridge();
                    bridge.refreshActiveEditorView(session);
                }
            }, 200)
        // Standard plain text file path
        str = decoder.decode(content);
    }


    if (hidePanels)
        hideOpenPanels(image)

    updateBodyPanelIds()


    if (typeof getOrCreateAceSession !== 'undefined') {
        // 2. Ace Session
        const session = getOrCreateAceSession(filePath, str);
        //const mode = getModeByFilename(filePath);
        //session.setMode(mode);
        aceEditor.setSession(session);

        editorContainer.classList.remove('hidden')
        editorContainer.classList.add('not-hidden')
    } else if (image) {
        previousPanelId = null
    }

    if (image) {
        imageEditor.classList.remove('hidden')
        imageEditor.classList.add('not-hidden')
    }

    if (filePath.endsWith('.bsp')) {
        const viewportWrapper = document.getElementById('viewport-frame')
        viewportWrapper.classList.remove('hidden')
        viewportWrapper.classList.add('not-hidden')
    }
    resizeDebouncer()

    // 3. Record it in history if this isn't a "Back/Forward" action
    if (recordHistory) {
        recordFileHistory(filePath, sha)
    }
    else {
        document.getElementById('filename').value == filePath
    }
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
                            actionsBuffer.push(new window.Actions.Delete_layer_action(existingLayers[i].id));
                        }
                    }

                    // Step B: Set the canvas dimensions cleanly for a pristine scene file boundary
                    actionsBuffer.push(new window.Actions.Prepare_canvas_action({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        clear: true
                    }));

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

                    actionsBuffer.push(new window.Actions.Insert_layer_action(layerPayload));

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








function hookMiniPaintIntercept() {
    const iframe = document.getElementById('myFrame');
    if (!iframe) return;

    const miniPaintWin = iframe.contentWindow;

    // Ensure miniPaint's module instances have finished setup on window load
    if (!miniPaintWin || !miniPaintWin.FileOpen) {
        setTimeout(hookMiniPaintIntercept, 100); // Poll briefly if not ready
        return;
    }

    // 1. Capture miniPaint's original file processor reference
    const originalLoadFileHandler = miniPaintWin.FileOpen.load_file_handler;

    console.log("Successfully intercepted miniPaint's FileOpen handler.");

    // 2. Overwrite the native method with your custom pipeline proxy
    miniPaintWin.FileOpen.load_file_handler = function (event) {
        // Handle variations of incoming events (File drop arrays vs native input changes)
        const files = event.target?.files || event.dataTransfer?.files;

        if (files && files.length > 0) {
            const file = files[0];
            const filename = file.name.toLowerCase();

            // Check A: Quick extension filter matching Quake 3 assets
            const isQuakeAsset = filename.endsWith('.bsp') ||
                filename.endsWith('.aas') ||
                filename.endsWith('.qvm') ||
                filename.endsWith('.md3') ||
                filename.endsWith('.dat');

            if (isQuakeAsset) {
                console.log(`Intercepted Quake 3 asset by extension: ${file.name}. Routing to custom engine...`);
                routeFileToQuakeEditor(file);
                return; // Stop execution here. miniPaint never touches it!
            }

            // Check B: Heavy verification via byte magic patterns (For files missing extensions)
            const reader = new FileReader();
            reader.onload = function (e) {
                const bytes = new Uint8Array(e.target.result);

                // Leverage your existing BINARY_DETECTOR block patterns
                if (isQuakeBinaryMagic(bytes)) {
                    console.log(`Intercepted Quake 3 asset by binary magic signature. Routing to custom engine...`);
                    routeFileToQuakeEditor(file);
                } else {
                    // It's a normal image! Hand it back down to miniPaint's native engine flow
                    originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
                }
            };

            // Read just the first 16 bytes for checking headers
            reader.readAsArrayBuffer(file.slice(0, 16));

        } else {
            // Fallback for empty/unrecognized input event routing loops
            originalLoadFileHandler.call(miniPaintWin.FileOpen, event);
        }
    };
}





// Helper to keep the metadata block pristine
function getMimeTypeByExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    return map[ext] || 'image/png';
}




let fileClickDebouncer = null

async function clickFile(filePath, lineNumber, noBounce = false, noHide = false) {

    if (fileClickDebouncer) {
        clearTimeout(fileClickDebouncer)
    }
    if (!noBounce) {
        fileClickDebouncer = setTimeout(() => clickFile(filePath, lineNumber, true, noHide), 500)
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

    await openFile(ownerName, repoName, filePath, dbFile.sha, false /* record history */, false /* show file list */, true)
    recordFileHistory(filePath, dbFile.sha, lineNumber)
    if (typeof editorContainer !== 'undefined') {
        setTimeout(() => {
            editorContainer.classList.remove('hidden')
            editorContainer.classList.add('not-hidden')

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
async function navigateFile(filePath, lineNumber, noBounce = false, noHide = false) {

    if (fileNavigationDebouncer) {
        clearTimeout(fileNavigationDebouncer)
    }
    if (!noBounce) {
        fileNavigationDebouncer = setTimeout(() => navigateFile(filePath, lineNumber, true, noHide), 500)
        return
    }

    if (filePath.startsWith('/'))
        filePath = filePath.substring(1)
    const [selected, dbFile] = await clickFile(filePath, lineNumber, true, noHide)

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



