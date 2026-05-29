function initEnvironment(ENGINE) {
    if (!ENV.table) {
        const importTable = new WebAssembly.Table({
            initial: 2000,
            element: 'anyfunc',
            maximum: 10000
        })
        ENV.table = ENV.__indirect_function_table = importTable
    }
    if (!ENV.memory) {
        ENV.memory = new WebAssembly.Memory({
            initial: 4096,
            maximum: 32000,
            /* 'shared': true */
        })
        ENV.__memory_base = 50331648
    }

    // weird stuff WebAssembly requires
    ENV.env = ENV.wasi_snapshot_preview1 = ENV
    ENV.imports = ENV

    // set window module because of LEGACY SDL audio
    ENGINE.Module = ENV

    Object.assign(ENV, ENGINE)
    let startKeys = Object.keys(ENGINE)
    let startValues = Object.values(ENGINE)
    updateGlobalFunctions(ENGINE) // ASSIGN STD, FS, GL, ETC
    for (let i = 0; i < startKeys.length; i++) {
        updateGlobalFunctions(startValues[i])
    }

    // THIS IS ALSO KIND OF A TEST THAT WINDOW.INIT WORKS
    NET.cacheBuster = Date.now() // for comparing times

    Object.assign(ENV.wasi_unstable, ENV)
    return ENV
}


function updateGlobalFunctions(GLOBAL) {
    // assign everything to env because this __attribute(import) BS don't work
    let startKeys = Object.keys(GLOBAL)
    let startValues = Object.values(GLOBAL)
    if (typeof window != 'undefined') {
        for (let i = 0; i < startKeys.length; i++) {
            if (startKeys[i] === 'location') {
                debugger
                continue
            }
            ENV[startKeys[i]] =
                window[startKeys[i]] = startValues[i] //.apply(ENV.exports)
        }
        Object.assign(ENV, GLOBAL)
    } else if (typeof global != 'undefined') {
        for (let i = 0; i < startKeys.length; i++) {
            if (startKeys[i] === 'location') {
                debugger
                continue
            }
            ENV[startKeys[i]] =
                global[startKeys[i]] = startValues[i] //.apply(ENV.exports)
        }
        Object.assign(ENV, GLOBAL)
    }
}

// write it non-async just in case wasm is support but not es6?
function initWasm(bytes, env) {
    if (isStreaming) {
        return WebAssembly.instantiateStreaming(bytes, env)
    } else {
        return WebAssembly.instantiate(bytes, env)
    }
}

function updateEnvironment(program, ENV) {
    // share the game with window for hackers
    if (!program) {
        throw new Error("no program!")
    }
    let previousErr
    if (typeof stderr != 'undefined') {
        previousErr = FS.pointers[HEAPU32[stderr >> 2]]
    } else {
        previousErr = null // used below
    }

    let previousOut
    if (typeof stdout != 'undefined') {
        previousOut = FS.pointers[HEAPU32[stdout >> 2]]
    } else {
        previousOut = null
    }
    // THIS IS JUST INTENDED TO MEET MULTIPLE EXPECTATIONS FROM A PROGRAMMER
    ENV.program = program || {}
    ENV.instance = ENV.program.instance || {}
    ENV.exports = ENV.instance.exports || {}
    //ENV.memory = ENV.exports.memory
    updateGlobalFunctions(ENV.exports)
    updateGlobalBufferAndViews()
    // THIS IS ALSO STILL KIND OF A TEST THAT WINDOW INIT WORKS
    //   STDLIB WOULD ALLOC AS THE LIBRARY LOADS, 
    //   THIS IS KIND OF LIKE SHELL SPACE ALLOC
    // reserve some memory at the beginning for passing shit back and forth with JS
    //   not to use a complex HEAP, just loop around on bytes[b % 128] and if 
    //   something isn't cleared out, crash
    // store some strings and crap
    /*
    if (ENV.exports.stdout) {
        FS.pointers[HEAPU32[stdout >> 2]] = [
            0,
            'rw',
            // this is weird, multiple WASMs in same scope, globals are messed up
            //   because libc loads multiple times, there are multiple stderr
            //   the OS only loads libc once and all kernels and programms call
            //   into the system function, so it doesn't have to load a whole
            //   space just for static string operations.
            previousOut ? previousOut[2] : {
                timestamp: new Date(),
                mode: FS_FILE,
                contents: new Uint8Array(),
                path: '/dev/stdout',
                parent: '/dev'
            },
            1,
            HEAPU32[stdout >> 2]
        ]
    }
    if (ENV.exports.stderr) {
        FS.pointers[HEAPU32[stderr >> 2]] = [
            0,
            'rw',
            previousErr ? previousErr[2] : {
                timestamp: new Date(),
                mode: FS_FILE,
                contents: new Uint8Array(),
                path: '/dev/stderr',
                parent: '/dev'
            },
            2,
            HEAPU32[stderr >> 2]
        ]
    }
    */
    return program
}


async function initEngine(program) {
    // ALL THE VARIABLES WE NEED SHOULD BE ASSIGNED TO GLOBAL BY NOW
    Module.startArgs = SYS.startArgs = getQueryCommands()
    console.log("Starting with: " + Module.startArgs.join(' '))
    Module.environment = {
        USER: 'brian'
    }

    PREAMBLE = ENGINE_PREAMBLE

    await readPreFS()
    if (!program) {
        throw new Error("no program!")
    }
    try {
        SYS.exited = false
        if (typeof window['Z_Malloc'] == 'undefined') {
            window.Z_Malloc = window['Z_MallocDebug']
        }
        // Startup args is expecting a char **
        _start(SYS.startArgs.length, stringsToMemory(SYS.startArgs))
        // should have Clet system by now
        // this might help prevent this thing that krunker.io does where it lags when it first starts up
        Com_MaxFPSChanged()
    } catch (e) {
        writeLog(`${e.message}\n\r${e.stack || e.stacktrace}`)
        Sys_Exit(1)
        throw e
    }
}


let isStreaming = false

const ENV = {
    wasi_unstable: {}
}
ENV.ENV = ENV

let runDebounce = null
async function runEngine(database = null, noBounce = false) {
    if (runDebounce) {
        clearTimeout(runDebounce)
    }

    if (!noBounce) {
        runDebounce = setTimeout(() => runEngine(database, true), 500)
        return
    }

    if (GL.canvas != null)
        return

    if (!database)
        database = owner.value + '/' + repository.value


    let CONFIGURATION = configuration.value !== 'debug'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    try {
        let enginePath = CONFIGURATION + '/' + config.CNAME + '.' + COMPILE_ARCH + '.' + COMPILE_PLATFORM
        FS.virtual[enginePath] = await getRecord(DB_STORE_NAME, enginePath, database)
        if (!FS.virtual[enginePath] || FS.virtual[enginePath].contents.length === 0) {
            const response = await fetch('quake3e.wasm', {
                mode: 'cors',
                credentials: 'omit'
            });
            const contents = await response.arrayBuffer()
            const sha = await getGitShaBrowser(contents)
            //const response = await fetch("https://raw.githubusercontent.com/briancullinan2/quedit/main/quake3e.wasm");
            //const contents = await response.arrayBuffer();
            //if (!files['briancullinan2/quedit']) {
            //    await loadGitHubTree('briancullinan2', 'quedit', 'main')
            //}
            //await cacheFile('briancullinan2', 'quedit', 'quake3e.wasm');
            FS.virtual[enginePath] =
            {
                timestamp: new Date(),
                mode: FS_FILE,
                contents: contents,
                path: enginePath,
                sha: sha,
                parent: enginePath.substring(0, enginePath.lastIndexOf('/'))

            }
            await putRecord(DB_STORE_NAME, FS.virtual[enginePath], database)
        }

        if (!FS.virtual[enginePath])
            return alert("Compile the engine first.")

        Object.assign(ENV, {
            MATH: MATHS,
            FS: FS,
            NET: NET,
            STD: STD,
            DATE: DATE,
            SND: SND,
        })

        let startKeys = ['MATH', 'FS', 'SYS', 'GL', 'EMGL', 'INPUT', 'NET', 'STD', 'DATE', 'SND', 'ENV']
        let startValues = Object.values(ENV)
        updateGlobalFunctions(ENV) // ASSIGN STD, FS, GL, ETC
        for (let i = 0; i < startKeys.length; i++) {
            try {
                updateGlobalFunctions(startValues[startKeys[i]])
            } catch (e) { }
        }
        const viewport = document.getElementById('viewport-frame')
        GL.canvas = document.getElementById('viewport')
        GL.canvas2D = document.getElementById('scratch')
        const ENGINE = initEnvironment({
            SYS: SYS,
            GL: GL,
            EMGL: EMGL,
            INPUT: INPUT,
            FS: FS,
            DATE: DATE,
            NET: NET,
            STD: STD,
            SND: SND,
            MATH: MATHS,
        })
        ENGINE.canvas = GL.canvas

        isStreaming = false

        let program = await initWasm(FS.virtual[enginePath].contents, ENGINE)
        await updateEnvironment(program, ENGINE)
        await initEngine(program)
    } catch (e) {
        console.error(e)
    }

}



function _base64ToArrayBuffer(base64) {
    let binary_string = window.atob(base64);
    let len = binary_string.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

// I JUST REALIZED WHY CHROME DEBUGGER WILL PERPUTUALLY HAVE A HARDER
//   AND HARDER TIME WITH WEB APPS LIKE THIS. I SCREWED UP IT'S ABILITY TO OPTIMIZE GRAPH.

async function readPreFS() {
    // TODO: offline download so it saves binary to IndexedDB
    if (typeof window.preFS == 'undefined') {
        throw new Error('No preFS, must load in correct order!')
    }
    let preloadedPaths = Object.keys(window.preFS)
    for (let i = 0; i < preloadedPaths.length; i++) {
        if (preloadedPaths[i].endsWith('_timestamp')) {
            continue
        }
        let newFiletime = window.preFS[
            preloadedPaths[i] + '_timestamp']
            || new Date()
        FS.virtual[preloadedPaths[i]] = {
            timestamp: newFiletime,
            mode: FS_FILE,
            contents: _base64ToArrayBuffer(window.preFS[preloadedPaths[i]]),
            path: preloadedPaths[i],
            parent: preloadedPaths[i].substring(0, preloadedPaths[i].lastIndexOf('/'))
        }
    }

    /*
    thinking about how deep I want to go on this:
    I had a plan to repackage assets as they are requested from inside the server code
    so that the same process could be used for UDP downloads.
  
    But now I'm wondering if there's any reason not to do the same thing from the proxy server.
  
    Where do I get this list from normally? I has a plan to transfer pk3_cache databases from the server. That would store a list of pk3s per mod.
  
    How do I make the engine automatically pick a mod? #define BASEGAME in q_shared.h
    but FS_GetCurrentGameDir() is not available before the engine loads.
    */
    // TODO: replace with Com_StartupVariable
    // TODO: CL_Game_f() to switch games with a command, SV_GameRestart_f?
    // TODO: safe to get from query like Com_StartupVariable
    let basegame = MODNAME
    let argsI = SYS.startArgs.indexOf('fs_game')
    if (argsI == -1) {
        argsI = SYS.startArgs.indexOf('fs_basegame')
    }
    if (argsI > -1) {
        basegame = SYS.startArgs[argsI + 1]
    }

    FS.virtual['/home'] = {
        timestamp: new Date(),
        mode: FS_DIR,
        size: 4096,
        path: '/home',
        parent: ''
    }
    //putRecord(DB_STORE_NAME, FS.virtual['/home'], owner.value + '/' + repository.value)


    // TODO: check for cl_dlURL
    // TODO: CL_Download(, 'pak0', )
    let responseData = await Com_DL_Begin(basegame + '/pak0.pk3',
        'https://quake.games/maps/' + basegame + '/pak0.pk3')
    Com_DL_Perform('/base/' + basegame + '/pak0.pk3',
        basegame + '/pak0.pk3', responseData)
    let responseData2 = await Com_DL_Begin(basegame + '/pak1.pk3',
        'https://quake.games/maps/' + basegame + '/pak1.pk3')
    Com_DL_Perform('/base/' + basegame + '/pak1.pk3',
        basegame + '/pak1.pk3', responseData2)

    // write description to pk3dir so that it loads as a pak when the engine starts
    //   this is key to making async work on fresh loads
    let nameStr = '/base/' + MODNAME + '/pak0.pk3dir/description.txt'
    FS_CreatePath(stringToAddress(nameStr))
    FS.virtual[nameStr] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new Uint8Array('Multiworld\n'),
        path: nameStr,
        parent: nameStr.substring(0, nameStr.lastIndexOf('/'))
    }
    putRecord(DB_STORE_NAME, FS.virtual[nameStr], owner.value + '/' + repository.value)

    // write it in multiple places because of async startup
    nameStr = '/base/' + MODNAME + '/pak2.pk3dir/description.txt'
    FS_CreatePath(stringToAddress(nameStr))
    FS.virtual[nameStr] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new Uint8Array('Multiworld\n'),
        path: nameStr,
        parent: nameStr.substring(0, nameStr.lastIndexOf('/'))
    }
    putRecord(DB_STORE_NAME, FS.virtual[nameStr], owner.value + '/' + repository.value)


    let [_, selected, dbFile] = await findFileTestPath('build/release-wasm-js/baseq3a/q3_ui.wasm')
    if (dbFile) {
        FS.virtual['/base/' + MODNAME + '/uijs.wasm'] = {
            timestamp: new Date(),
            mode: FS_FILE,
            contents: dbFile.contents,
            path: '/base/' + MODNAME + '/uijs.wasm',
            parent: '/base/' + MODNAME
        }
    }
}
