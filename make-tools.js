/**
 * Quake3e LCC Toolchain Build Script
 * Handles: q3rcc, lburg, q3cpp, q3lcc
 */



// Tool-specific subdirectories
const toolDirs = {
    RCC: 'rcc',
    LBURG: 'lburg',
    CPP: 'cpp',
    ETC: 'etc'
};

// --- Object Arrays ---

const rccFiles = [
    'alloc.o', 'bind.o', 'bytecode.o', 'dag.o', 'dagcheck.o',
    'decl.o', 'enode.o', 'error.o', 'event.o', 'expr.o',
    'gen.o', 'init.o', 'inits.o', 'input.o', 'lex.o',
    'list.o', 'main.o', 'null.o', 'output.o', 'prof.o',
    'profio.o', 'simp.o', 'stmt.o', 'string.o', 'sym.o',
    'symbolic.o', 'trace.o', 'tree.o', 'types.o'
];

const lburgFiles = [
    'lburg.o', 'gram.o'
];

const cppFiles = [
    'cpp.o', 'lex.o', 'nlist.o', 'tokens.o', 'macro.o',
    'eval.o', 'include.o', 'hideset.o', 'getopt.o', 'unix.o'
];

const lccFiles = [
    'lcc.o', 'bytecode.o'
];

const LCC_CFLAGS = [
    '-cc1',
    '-emit-obj',
    '-triple', 'wasm32-wasi',

    "-isysroot", "/",
    '-internal-isystem', 'include/c++/v1',
    "-internal-isystem", "include",
    '-internal-isystem', 'include/wasi-emulated-signal',
    "-internal-isystem", "lib/clang/8.0.1/include", // Path varies by your Clang version

    "-O2",
    "-Wall",
    "-Wno-dangling-else",
    "-Wno-logical-not-parentheses",
    "-Wno-missing-braces",
    "-Wno-parentheses",
    "-Wno-logical-op-parentheses",
    "-Wno-unused",
    '-ferror-limit', '100',
    //'-c',
    //"-fno-strict-aliasing",
    '-ftls-model=global-dynamic',
    //'-D_REENTRANT=0',
    //"-DSIGINT=2",
    '-D_Thread_local=',
    //"-Derrno=(*__errno_location())",
    //"-D__errno_location=void",
    "-DSIG_IGN=(void (*)(int))1",
    "-Dsignal(s,h)=SIG_IGN",
    "-D_WASI_EMULATED_MMAN=1",
    "-D_WASI_EMULATED_SIGNAL=1",
    "-D_XOPEN_SOURCE=700",
    "-D__wasi__=1",

    '-disable-free',
    '-fno-common',
    "-fno-rtti",
    "-fno-use-init-array",
    "-fno-threadsafe-statics",
    //"-fno-inline",
    //'-mlong-double-64',
    "-mrelocation-model",
    "static",
    //"-target-feature",
    //"+bulk-memory",
    //"-target-feature",
    //"+atomics",
    //"-pthread",
    "-std=gnu11",

    "-Isrc",
    ...(COMPILE_PLATFORM === 'darwin' ? ["-DMACOS_X"] : [])
];


const lccToolHeaders = [
    // src
    "src/c.h",
    "src/config.h",
    "src/token.h",
    "src/ops.h",

    // cpp
    "cpp/cpp.h",

    // lburg
    "lburg/lburg.h",

    config.MOUNT_DIR + "/wasm/wasm.syms"
    // etc
    //"etc/lcc.h"
];


const asmToolHeaders = [
    'cmdlib.h',
    'opstrings.h',
    'qvm.h',
    config.MOUNT_DIR + "/wasm/wasm.syms"
]

const toolLdFlags = [
    //"-D__WASM__=1",
    //"--no-standard-libraries",
    '--no-threads',
    "--export-dynamic",
    //"--verbose",
    //"--import-memory",
    //"--import-table",

    //"--export-memory",
    //"--export-table",
    "--error-limit=200",
    '-z', `stack-size=${1024 * 1024}`,
    '-Llib/wasm32-wasi',
    'lib/wasm32-wasi/crt1.o',
    '-Llib/clang/8.0.1/lib/wasi',
    '-lclang_rt.builtins-wasm32',
    ...undefinedFlags,
    //"--growable-table",
    // Link against the builtins and libc.a
    //path.join(vars.WASI_BUILTINS, "lib/wasi/libclang_rt.builtins-wasm32.a"),
    //path.join(vars.WASISDK, "share/wasi-sysroot/lib/wasm32-wasi/libc.a")
];



async function buildLBurg(database = null, forceChanged = false, noLinking = false) {
    if (!database) database = toolsRepository || api.database;
    const parts = database.split('/');
    const ownerName = parts.length == 2 ? parts[0] : owner.value;
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    PREAMBLE = TOOLS_PREAMBLE

    let hasChanged = false

    writeLog("Building LBURG...");
    for (const file of lburgFiles) {
        if (TERMINATE) return

        try {

            const src = path.join("lburg", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.LBURG, file);

            if (FS.virtual[obj]
                && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                && !forceChanged
            ) {
                writeLog(`${obj} already up to date...`)
                continue
            }

            hasChanged = true

            writeLog(`CC: ${src}`);
            await compileToolFile(src, obj, "lburg", database, [], forceChanged);
        } catch (e) {
            PREAMBLE = TOOLERR_PREAMBLE
            writeLog(`Build error in lburg: ${file}\n\r${e.message}\n\r${e.stack || e.stacktrace}`)
        }

    }

    // this is the control structure i was looking for
    //   `build` command forces a full compile
    //   `link` command only builds missing and forces link
    //  *sigh* voidzero would have been so much more descriptive
    //    i could have defined a single module "build pattern"
    //    with only this workflow and then templates for the
    //    files variable, it would look similar to `make`
    if (!noLinking) {
        await linkLburg(database, true, true /* prevent recusion */)
    }
}


async function linkLburg(database, forceChanged = false, noBuild = false) {
    if (!database) database = toolsRepository || api.database;

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE


    const lburgExe = path.join(CONFIGURATION, "lburg" + config.BINEXT);
    const lburgObjs = lburgFiles.map(f => path.join(CONFIGURATION + '/' + toolDirs.LBURG, f))

    if (!noBuild
        // TODO: check objs mtimes?
    ) {
        // contradicts forceChanged because if noBuild === false then we just built
        await buildLBurg(database, false /* here's what makes it special */, true /* prevent recursion */)
    }



    let exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
    FS.virtual[lburgExe] = exeRecord


    if (FS.virtual[lburgExe]
        && !forceChanged
    ) {
        writeLog(lburgExe + " already up to date...");
        return
    }

    writeLog(`LD: ${lburgExe}`);


    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", lburgExe,
            ...lburgObjs,
            ...includeFlags
        ],
        obj: lburgObjs,
        database,
        wasm: lburgExe,
    });


}


let BRANCH
let FILELIST

async function compileToolFile(src, obj, includeDir, database, extraFlags = [], forceChanged = false) {
    try {
        if (!database) database = toolsRepository || api.database;
        const parts = database.split('/');
        const ownerName = parts.length == 2 ? parts[0] : owner.value;
        const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

        PREAMBLE = TOOLS_PREAMBLE

        if (!BRANCH || !FILELIST) {
            BRANCH = await getDefaultBranch(ownerName, repoName)
            FILELIST = await loadGitHubTree(ownerName, repoName, BRANCH)
        }


        let content
        if (FS.virtual[src])
            content = FS.virtual[src].contents
        else if (!src.includes('build/'))
            content = await cacheFile(ownerName, repoName, src);
        else {
            FS.virtual[src] = await getRecord(DB_STORE_NAME, src, database)
            if (!FS.virtual[src])
                throw new Error('Output file not found: ' + src)
        }



        if (needsHeaders) {

            writeLog("Syncing TOOL headers...");

            await downloadHeaders(lccToolHeaders, 10, database)

        }

        PREAMBLE = TOOLS_PREAMBLE

        let objRecord = await getRecord(DB_STORE_NAME, obj, database)
        FS.virtual[obj] = objRecord

        if (FS.virtual[obj]
            && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
            && !forceChanged
        ) {
            writeLog(`${obj} already up to date...`)
            return obj
        }

        await api.compile({
            CFLAGS: [
                ...LCC_CFLAGS, `-I${includeDir}`,
                ...extraFlags,
                '-o', obj, src
            ],
            contents: content,
            input: src,
            database,
            obj: obj,
        });
        return obj;
    } catch (e) {
        PREAMBLE = TOOLERR_PREAMBLE
        writeLog(`Error compiling: ${src}: ${e}\n\r${e.stack || e.stacktrace}`);
        let newError = new Error(e.message)
        newError.stack = newError.stacktrace = e.stack || e.stacktrace
        throw newError;
    }
}

let needsHeaders = true


async function buildRCC(database = null, skipTool = false, forceChanged = false, noLinking = false) {
    if (!database) database = toolsRepository || api.database;
    const parts = database.split('/');
    const ownerName = parts.length == 2 ? parts[0] : owner.value;
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    PREAMBLE = TOOLS_PREAMBLE

    const lburgExe = path.join(CONFIGURATION, "lburg" + config.BINEXT);

    if (!skipTool) {

        let exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
        if (!exeRecord) {
            await buildLBurg(database, forceChanged)
            exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
        }
        FS.virtual[lburgExe] = exeRecord

    }

    writeLog("Building RCC...");

    let hasChanged = false

    for (const file of rccFiles) {
        if (TERMINATE) return

        PREAMBLE = TOOLS_PREAMBLE

        try {
            const obj = path.join(CONFIGURATION + '/' + toolDirs.RCC, file);
            if (file === 'dagcheck.o') {
                // Special case: Generate dagcheck.c using lburg
                writeLog("Generating dagcheck.c via lburg...");
                const dagMd = "src/dagcheck.md";
                const dagC = path.join(CONFIGURATION, "src/dagcheck.c");

                if (!FS.virtual[obj] && !forceChanged)
                    FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database)

                if (!FS.virtual[dagMd] && !forceChanged)
                    FS.virtual[dagMd] = await getRecord(DB_STORE_NAME, dagMd, database)

                if (FS.virtual[obj]
                    && FS.virtual[dagMd]?.timestamp < FS.virtual[obj]?.timestamp
                    && !forceChanged
                ) {
                    writeLog(obj + " already up to date...");
                    continue
                }

                hasChanged = true

                await cacheFile(ownerName, repoName, dagMd, (FILELIST[dagMd] || {}).sha);
                // Logic to run lburg on dagcheck.md (This assumes your API can execute the tool)
                PREAMBLE = TOOLS_PREAMBLE

                writeLog(`BURG: ${dagMd}`);
                await api.run({
                    tool: lburgExe,
                    args: [lburgExe, dagMd, dagC],
                    database,
                    paths: [dagMd, dagC]
                });

                writeLog(`CC: ${dagC}`);
                await compileToolFile(dagC, obj, "src", database, ["-Wno-unused"], forceChanged);
            } else {
                const src = path.join("src", file.replace('.o', '.c'));

                if (!FS.virtual[obj] && !forceChanged)
                    FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database)

                if (FS.virtual[obj]
                    && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                    && !forceChanged
                ) {
                    writeLog(obj + " already up to date...");
                    continue
                }

                hasChanged = true

                writeLog(`CC: ${src}`);
                await compileToolFile(src, obj, "src", database, [], forceChanged);
            }
        } catch (e) {
            PREAMBLE = TOOLERR_PREAMBLE
            // ALREADY LOGGED BY 
            if (!e.message.includes('Error compiling:'))
                writeLog(`Error compiling: ${file}: ${e}\n\r${e.stack || e.stacktrace}`)
        }
    }


    if (!noLinking) {
        await linkRCC(database, true, true)
    }

}



async function linkRCC(database = null, forceChanged = false, noBuild = false) {
    if (!database) database = toolsRepository || api.database;

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE

    const rccObjs = rccFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.RCC, file))
    const rccExe = path.join(CONFIGURATION, "q3rcc" + config.BINEXT);

    let exeRecord = await getRecord(DB_STORE_NAME, rccExe, database)
    FS.virtual[rccExe] = exeRecord

    if (!noBuild) {
        await buildRCC(database, false, false, true /* prevent recursion */)
    }


    if (FS.virtual[rccExe]
        && !forceChanged
    ) {
        writeLog(rccExe + " already up to date...");
        return
    }

    writeLog(`LD: ${rccExe}`);

    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", rccExe,
            ...rccObjs,
            ...includeFlags
        ],
        obj: rccObjs,
        database,
        wasm: rccExe,
    });

}


async function buildCPP(database = null, forceChanged = false, noLinking = false) {
    if (!database) database = toolsRepository || api.database;
    const parts = database.split('/');
    const ownerName = parts.length == 2 ? parts[0] : owner.value;
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE

    writeLog("Building CPP...");

    let hasChanged = false

    for (const file of cppFiles) {
        if (TERMINATE) return

        try {
            const src = path.join("cpp", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.CPP, file);

            if (!FS.virtual[obj] && !forceChanged)
                FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database)

            if (FS.virtual[obj]
                && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                && !forceChanged
            ) {
                writeLog(obj + " already up to date...");
                continue
            }

            hasChanged = true

            writeLog(`CC: ${src}`);
            await compileToolFile(src, obj, "cpp", database, [], forceChanged);
        } catch (e) {
            writeLog(`${e.message}\n\r${e.stack || e.stacktrace}`)
        }
    }

    if (!noLinking) {
        await linkCPP(database, true, true)
    }
}



async function linkCPP(database = null, forceChanged = false, noBuild = false) {
    if (!database) database = toolsRepository || api.database;

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE

    const cppObjs = cppFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.CPP, file))
    const cppExe = path.join(CONFIGURATION, "q3cpp" + config.BINEXT);


    let exeRecord = await getRecord(DB_STORE_NAME, cppExe, database)
    FS.virtual[cppExe] = exeRecord


    if (!noBuild) {
        await buildCPP(database, false, true)
    }

    if (FS.virtual[cppExe]
        && !forceChanged
    ) {
        writeLog(cppExe + " already up to date...");
        return
    }

    writeLog(`LD: ${cppExe}`);



    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", cppExe,
            ...cppObjs,
            ...includeFlags

        ],
        obj: cppObjs,
        database,
        wasm: cppExe,
    });
}


async function buildLCC(database = null, forceChanged = false, noLinking = false) {
    if (!database) database = toolsRepository || api.database;
    const parts = database.split('/');
    const ownerName = parts.length == 2 ? parts[0] : owner.value;
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    PREAMBLE = TOOLS_PREAMBLE

    writeLog("Building LCC...");

    let hasChanged = false

    for (const file of lccFiles) {
        if (TERMINATE) return


        try {
            const src = path.join("etc", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.ETC, file);
            const lccFlags = [`-DTEMPDIR=\"${config.TEMPDIR}\"`, `-DSYSTEM=\"\"`];

            if (!FS.virtual[obj] && !forceChanged)
                FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database)

            if (FS.virtual[obj]
                && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                && !forceChanged
            ) {
                writeLog(obj + " already up to date...");
                continue
            }

            hasChanged = true

            writeLog(`CC: ${src}`);
            await compileToolFile(src, obj, "src", database, lccFlags, forceChanged);
        } catch (e) {
            PREAMBLE = TOOLERR_PREAMBLE
            writeLog(`Build error in q3lcc: ${file}\n\r${e.message}\n\r${e.stack || e.stacktrace}`)
        }
    }


    if (!noLinking) {
        await linkLCC(database, true, true)
    }


}




async function linkLCC(database = null, forceChanged = false, noBuild = false) {

    if (!database) database = toolsRepository || api.database;

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE

    const lccObjs = lccFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.ETC, file))
    const lccExe = path.join(CONFIGURATION, "q3lcc" + config.BINEXT);


    if (!noBuild) {
        await buildLCC(database, false, true)
    }

    let exeRecord = await getRecord(DB_STORE_NAME, lccExe, database)
    FS.virtual[lccExe] = exeRecord


    if (FS.virtual[lccExe]
        // TODO: compare LATEST input and output mtime
        && !forceChanged
    ) {
        writeLog(lccExe + " already up to date...");
        return
    }

    writeLog(`LD: ${lccExe}`);


    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            //"--export=_spawnvp",
            "-o", lccExe,
            ...lccObjs,
            ...includeFlags
        ],
        obj: lccObjs,
        database,
        wasm: lccExe,
    });

}


// --- Build Logic ---

async function buildTools(database = null, toolName = 'all', forceChanged = false, noBounce = false) {

    if (buildDebounce) {
        clearTimeout(buildDebounce)
    }

    if (!noBounce) {
        buildDebounce = setTimeout(() => buildTools(database, toolName, forceChanged, true), 500)
        return
    }

    if (building) return
    building = true


    if (TERMINATE) return


    PREAMBLE = TOOLS_PREAMBLE

    try {

        if (!database) database = toolsRepository || api.database;



        // Helper to compile a single tool component

        writeLog(`Starting Toolchain Build ${toolName}...`);

        // TODO: check if tool final output exists just like obj check

        if (toolName === 'lburg' || toolName === 'all')
            // 1. Build LBURG (Needed to generate dagcheck.c for RCC)
            await buildLBurg(database, forceChanged, false /* don't exclude link step */)

        if (TERMINATE) return


        if (toolName === 'q3rcc' || toolName === 'all')
            // 2. Build RCC (The Compiler Core)
            await buildRCC(database, false, forceChanged)

        if (TERMINATE) return


        if (toolName === 'q3cpp' || toolName === 'all')
            // 3. Build CPP (Preprocessor)
            await buildCPP(database, forceChanged)

        if (TERMINATE) return


        if (toolName === 'q3lcc' || toolName === 'all')
            // 4. Build LCC (Frontend)
            await buildLCC(database, forceChanged)

        if (TERMINATE) return


        if (toolName === 'q3asm' || toolName === 'all')
            await buildAsmTool(tools2Repository || api.toolsRepo2 || api.database, forceChanged)

        if (TERMINATE) return


        writeLog(`Toolchain build ${toolName} complete.`);

    }
    finally {
        building = false
    }
}


/**
 * Quake3e q3asm Build Configuration
 * This tool takes the .asm files and converts them into the final .qvm bytecode
 */

const q3asmFiles = [
    'q3asm.c',
    'q3vm.c',
    'cmdlib.c'
];

const Q3ASM_CFLAGS = [
    "-O2",
    "-Wall",
    "-Werror",
    "-fno-strict-aliasing",
];

/**
 * Appends the q3asm build to your existing buildTools function
 */
async function buildAsmTool(database = null, forceChanged = false, noLinking = false) {


    if (!database) database = tools2Repository || api.toolsRepo2 || api.database;
    const parts = database.split('/');
    const ownerName = parts.length == 2 ? parts[0] : owner.value;
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG



    PREAMBLE = TOOLS_PREAMBLE


    writeLog("Building q3asm...");

    let hasChanged = false

    for (const file of q3asmFiles) {

        if (TERMINATE) return


        if (needsHeaders) {

            writeLog("Syncing ASM headers...");
            await downloadHeaders(asmToolHeaders, 10, database)

        }

        hasChanged = true

        PREAMBLE = TOOLS_PREAMBLE

        try {

            const src = file;
            const obj = path.join(CONFIGURATION, file.replace('.c', '.o'));
            const content = await cacheFile(ownerName, repoName, src);



            if (!FS.virtual[obj] && !forceChanged)
                FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database)

            if (FS.virtual[obj]
                && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                && !forceChanged
            ) {
                writeLog(obj + " already up to date...");
                continue
            }

            writeLog(`CC: ${file}`);
            await api.compile({
                CFLAGS: [
                    ...LCC_CFLAGS,
                    '-o', obj, src
                ],
                contents: content,
                input: src,
                database,
                obj: obj,
            });

        } catch (e) {
            PREAMBLE = TOOLERR_PREAMBLE
            writeLog(`Error compiling q3asm component: ${file}\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
        }
    }

    if (!noLinking) {
        await linkAsm(database, hasChanged, true)
    }

}


async function linkAsm(database = null, forceChanged = false, noBuild = false) {
    if (!database) database = tools2Repository || api.toolsRepo2 || api.database;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = TOOLS_PREAMBLE

    let asmObjs = q3asmFiles.map(file => path.join(CONFIGURATION, file.replace('.c', '.o')))

    if (!noBuild) {
        await buildAsmTool(database, false, true)
    }

    const q3asmExe = path.join(CONFIGURATION, "q3asm" + config.BINEXT);

    let exeRecord = await getRecord(DB_STORE_NAME, q3asmExe, database)
    FS.virtual[q3asmExe] = exeRecord


    if (FS.virtual[q3asmExe]
        // TODO: compare LATEST input and output mtime
        && !forceChanged
    ) {
        writeLog(q3asmExe + " already up to date...");
        return
    }

    writeLog(`LD: ${q3asmExe}`);


    try {
        writeLog("Linking q3asm...");
        await api.link({
            LDFLAGS: [
                ...toolLdFlags,
                "-o", q3asmExe,
                ...asmObjs,
                ...includeFlags
            ],
            obj: asmObjs,
            database,
            wasm: q3asmExe,

        });
        writeLog("q3asm build complete.");
    } catch (e) {
        PREAMBLE = TOOLERR_PREAMBLE
        writeLog(`Linker Error for q3asm: ${q3asmExe}: ${e}\n\r${e.stack || e.stacktrace}`);
        throw e
    }
}

