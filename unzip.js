/**
 * Unzips a buffer and hydrates the virtual filesystem
 * @param {ArrayBuffer} buffer - The zip/pk3 file data
 * @param {string} rootPath - Where to mount in the virtual FS (e.g., 'baseq3')
 */
async function unzipToVirtualFS(buffer, rootPath = 'baseq3', database = null) {
    if(!database)
        database = owner.value + '/' + repo.value
    const zip = new JSZip();
    const contents = await zip.loadAsync(buffer);
    
    const log = (msg) => {
        if (typeof term !== 'undefined') term.write(`\x1b[35m[UNZIP]\x1b[0m ${msg}\r\n`);
        else console.log(msg);
    };

    log(`Extracting files to ${rootPath}...`);

    const promises = [];

    contents.forEach((relativePath, file) => {
        if (file.dir) return; // Skip directories, we handle them via path logic

        const fullPath = path.join(rootPath, relativePath);
        
        const promise = file.async('uint8array').then(async data => {
            // Mapping to your existing FS.virtual structure
            FS.virtual[fullPath] = {
                timestamp: new Date(),
                mode: FS_FILE, // Standard file mode (ST_FILE)
                contents: data,
                path: fullPath,
                sha: await getGitShaBrowser(data),
                parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
            };
            getGitShaBrowser(data).then(sha => FS.virtual[fullPath].sha = sha)
            log(`Extracted: ${relativePath}`);
            putRecord(DB_STORE_NAME, FS.virtual[fullPath], database)
        });
        
        promises.push(promise);
    });

    await Promise.all(promises);
    log("Unzip complete.");
}

