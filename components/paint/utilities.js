

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



