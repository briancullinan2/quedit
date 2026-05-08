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

const q3eCommonHeaders = [
  // --- QCommon (The Engine Core) ---
  "qcommon/q_shared.h",
  "qcommon/q_platform.h",
  "qcommon/qcommon.h",    // The "God" header for the engine
  "qcommon/qfiles.h",     // File format definitions (.bsp, .md3, etc.)
  "qcommon/surfaceflags.h", // Shared world/surface bitflags
  "qcommon/unzip.h",      // Internal PK3/Zip handling
  "qcommon/cm_local.h",
  "qcommon/cm_public.h",

  // --- Client & Server ---
  "client/client.h",      // Client-side engine state
  "server/server.h",      // Server-side engine state

  // --- Renderer (Internal) ---
  "renderer2/tr_local.h",  // Core renderer internal state
  "renderercommon/tr_public.h", // Public interface to the renderer
  "renderer2/qgl.h",       // OpenGL function pointers/wrappers

  // --- BotLib ---
  "botlib/botlib.h",      // Core bot library interface
  "botlib/be_aas.h",      // Area Awareness System (Navigation)
  "botlib/be_ai_char.h",  // Bot characteristics/personality

  // --- Shared / Game Layer ---
  "game/g_public.h",      // Engine <-> Game VM interface
  "game/bg_public.h",     // Shared Game/CGame logic (physics, items)
  "cgame/cg_public.h",    // Engine <-> CGame VM interface
  
  // --- UI Layer ---
  "ui/ui_public.h",       // Engine <-> UI VM interface
  //"q3_ui/ui_local.h",     // Classic Q3 UI local definitions

  // --- System Layer ---
  //"sys/sys_local.h",      // System-specific (Win/Linux) low-level stuff
  //"sys/sys_loadlib.h"     // Dynamic library loading
].map(file => path.join(config.MOUNT_DIR, file));

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
    let startTime = Date.now()
    FS.isSyncing = 1
    // FIX FOR "QKEY could not open" ERROR
    FS.virtual['home'] = {
        timestamp: new Date(),
        mode: FS_DIR,
    }
    console.log('sync started at ', new Date())

    await readAll(owner.value + '/' + repo.value, loadEntry)
    let tookTime = Date.now() - startTime

    console.log('sync completed', new Date())
    console.log('sync took',
        (tookTime > 60 * 1000 ? (Math.floor(tookTime / 1000 / 60) + ' minutes, ') : '')
        + Math.floor(tookTime / 1000) % 60 + ' seconds, '
        + (tookTime % 1000) + ' milliseconds')

    FS.isSyncing = 0

    term.write('\n\r')

    await downloadHeaders(q3eCommonHeaders)

    await api.upload(owner.value + '/' + repo.value)

    for(let obj of [...clientObjects, ...commonObjects])
    {

        try {
            let content = await cacheFile(owner.value, repo.value, obj)
            
            term.write('\n\r')
            let filename = obj //obj.split('/').pop()
            let result = await api.compile({
                contents: content, 
                width: term.cols, 
                input: filename, 
                obj: filename.replace('.c', '.o')
            })

        } catch {}

    }


}

async function downloadHeaders(headers, batchSize = 10) {
    const ownerVal = owner.value;
    const repoVal = repo.value;

    // Process in chunks to avoid slamming the network/API
    for (let i = 0; i < headers.length; i += batchSize) {
        const batch = headers.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (header) => {
            try {
                // cacheFile handles the storage logic
                await cacheFile(ownerVal, repoVal, header);
            } catch (e) {
                console.warn(`Failed to cache ${header}:`, e);
            }
        }));
        
        console.log(`Finished batch ${Math.ceil((i + batchSize) / batchSize)}`);
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

