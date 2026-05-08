/**
 * Quake3e Build Configuration Script - Browser Version
 */

// 1. Implementation of path.join for the browser
const path = {
    join: (...parts) => {
        return parts
            .map((part, index) => {
                if (index > 0) return part.replace(/^\//, ''); // Strip leading slash
                return part.replace(/\/$/, ''); // Strip trailing slash
            })
            .filter(part => part.length > 0)
            .join('/');
    }
};

const COMPILE_PLATFORM = 'wasm';
const COMPILE_ARCH = 'js';

const config = {
    BUILD_CLIENT: 1,
    BUILD_SERVER: 1,
    USE_SDL: 1,
    USE_CURL: 1,
    USE_LOCAL_HEADERS: 0,
    USE_SYSTEM_JPEG: 0,
    USE_OGG_VORBIS: 1,
    USE_VULKAN: 0,
    USE_OPENGL: 0,
    USE_OPENGL2: 1,
    RENDERER_DEFAULT: "opengl2",
    CNAME: "quake3e",
    DNAME: "quake3e.ded",
    MOUNT_DIR: "code",
    BUILD_DIR: "build",
};

const dirs = {
    BD: path.join(config.BUILD_DIR, `debug-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
    BR: path.join(config.BUILD_DIR, `release-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
    CDIR: path.join(config.MOUNT_DIR, "client"),
    SDIR: path.join(config.MOUNT_DIR, "server"),
    CMDIR: path.join(config.MOUNT_DIR, "qcommon"),
    R1DIR: path.join(config.MOUNT_DIR, "renderer"),
    R2DIR: path.join(config.MOUNT_DIR, "renderer2"),
    RVDIR: path.join(config.MOUNT_DIR, "renderervk"),
};

// replicatng the file structure for the linker
const clientObjects = [
    "cl_cgame.c", "cl_cin.c", "cl_console.c", "cl_input.c",
    "cl_keys.c", "cl_main.c", "cl_net_chan.c", "cl_parse.c",
    "cl_scrn.c", "cl_ui.c", "cl_avi.c", "cl_jpeg.c"
].map(file => path.join(dirs.CDIR, file));

const commonObjects = [
    "cm_load.c", "cm_patch.c", "cm_polylib.c", "cm_test.c", "cm_trace.c",
    "cmd.c", "common.c", "cvar.c", "files.c", "md4.c", "md5.c", "msg.c"
].map(file => path.join(dirs.CMDIR, file));

function getBaseFlags() {
    let flags = ["-Wall", "-Wimplicit", "-Wstrict-prototypes"];

    if (config.USE_SYSTEM_JPEG) flags.push("-DUSE_SYSTEM_JPEG");
    if (config.USE_CURL) flags.push("-DUSE_CURL");

    // Web-specific requirements
    if (COMPILE_PLATFORM === 'emscripten') {
        flags.push("-s USE_SDL=2", "-s ALLOW_MEMORY_GROWTH=1", "-s ASSERTIONS=1");
    }

    return flags;
}

async function build() {

    savedToken = localStorage.getItem('github_token');

    if (!savedToken)
        return alert("Must enter Github token first by clicking the doorway on the right.")


    // Log directly to your xterm.js instance if available
    const output = [
        `Building ${config.CNAME} for ${COMPILE_PLATFORM} (${COMPILE_ARCH})`,
        `Flags: ${getBaseFlags().join(' ')}`,
        `Total source files mapped: ${[...clientObjects, ...commonObjects].length}`
    ];

    output.forEach(line => {
        if (typeof term !== 'undefined') {
            term.write(`\x1b[32m[BUILD]\x1b[0m ${line}\r\n`);
        } else {
            console.log(line);
        }
    });

    // init database
    await readAll(owner.value, repo.value)

    term.write('\n\r')

    for(let obj of [...clientObjects, ...commonObjects])
    {

        let content = await cacheFile(owner.value, repo.value, obj)

        term.write('\n\r')
        let filename = obj.split('/').pop()
        let result = await api.compile({
            contents: content, 
            width: term.cols, 
            input: filename, 
            obj: filename.replace('.c', '.o')
        })

        
    }


}


const ST_FILE = 8
const ST_DIR = 4
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6)
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT

const FS = {
    virtual: {},
}

function loadEntry(cursor) {
    if (!cursor) {
        return resolve()
    }
    if (cursor.key.endsWith('default.cfg')) {
        FS.hadDefault = cursor.key
    }
    // already exists on filesystem, 
    //   it must have come with page
    if (FS.virtual[cursor.key]
        && FS.virtual[cursor.key].timestamp
        > cursor.value.timestamp) {
        // embedded file is newer, start with that
        return cursor.continue()
    }
    FS.virtual[cursor.key] = {
        timestamp: cursor.value.timestamp,
        mode: cursor.value.mode,
        contents: cursor.value.contents,
        path: cursor.value.path
    }
    return cursor.continue()
}


async function readAll(owner, repo) {
    let startTime = Date.now()
    FS.isSyncing = 1
    // FIX FOR "QKEY could not open" ERROR
    FS.virtual['home'] = {
        timestamp: new Date(),
        mode: FS_DIR,
    }
    console.log('sync started at ', new Date())
    let databases = await getDatabaseMetadata()
    if (databases.filter(d => d.key == owner + '/' + repo).length == 0
        || (await needsInstall(owner + '/' + repo, DB_SCHEME)).item3) {
        await deleteOldDatabase(owner + '/' + repo)
        await setupDatabase(owner + '/' + repo, DB_SCHEME)
    }
    let db = await getDB(owner + '/' + repo)
    let transaction = db.transaction([DB_STORE_NAME], 'readonly')
    let objStore = transaction.objectStore(DB_STORE_NAME)
    let tranCursor = objStore.openCursor()
    await new Promise(function (resolve) {
        tranCursor.onsuccess = function (event) {
            let cursor = event.target.result
            if (!cursor) {
                return resolve()
            }
            loadEntry(cursor)
        }
        tranCursor.onerror = function (error) {
            console.error(error)
            resolve(error)
        }
    })

    transaction.commit()
    let tookTime = Date.now() - startTime

    console.log('sync completed', new Date())
    console.log('sync took',
        (tookTime > 60 * 1000 ? (Math.floor(tookTime / 1000 / 60) + ' minutes, ') : '')
        + Math.floor(tookTime / 1000) % 60 + ' seconds, '
        + (tookTime % 1000) + ' milliseconds')

    FS.isSyncing = 0

}


async function cacheFile(repoOwner, repoName, filePath, sha) {
    savedToken = localStorage.getItem('github_token');

    try {
        let record = await getRecord(DB_STORE_NAME, filePath, repoOwner + '/' + repoName)
        if(record && record.sha == sha)
        {
            const decoder = new TextDecoder();
            const str = decoder.decode(record.contents);
            return str
        }
    } catch (e) {
        console.error(e)
    }

    const rawUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    let result = await fetch(rawUrl, {
        method: 'GET',
        headers: savedToken ? {
            'Authorization': `Bearer ${savedToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        } : {}
    })

    if (!result.ok) throw new Error(`HTTP error! status: ${result.status}`);

    const jsonResponse = await result.json();

    // --- DECODING LOGIC ---
    // GitHub wraps the file content in a JSON object and encodes it in Base64
    // We strip newlines and decode it back to a standard UTF-8 string
    let bytes;
    if (jsonResponse.encoding === 'base64') {
        // Decode base64 string to a binary string, then map to bytes
        const binString = atob(jsonResponse.content.replace(/\s/g, ''));
        bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
    } else {
        // Encode raw text to UTF-8 bytes
        bytes = new TextEncoder().encode(jsonResponse.content || "");
    }

    FS.virtual[filePath] = {
      timestamp: new Date(),
      mode: FS_FILE,
      contents: bytes,
      path: filePath,
      sha: jsonResponse.sha
    }
    // async to filesystem
    // does it REALLY matter if it makes it? wont it just redownload?
    await putRecord(DB_STORE_NAME, FS.virtual[filePath], repoOwner + '/' + repoName)

    const decoder = new TextDecoder();
    const str = decoder.decode(bytes);
    return str
}

