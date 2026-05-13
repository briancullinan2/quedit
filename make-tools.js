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
    "-internal-isystem", "lib/clang/8.0.1/include", // Path varies by your Clang version
    '-isystem', 'include/wasi-emulated-signal',

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
    '-D_REENTRANT=0',
    "-DSIGINT=2",
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


const toolLdFlags = [
    //"-D__WASM__=1",
    //"--no-standard-libraries",
    '--no-threads',
    "--export-dynamic",
    "--export-table",
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



async function buildLBurg(database = null) {
    if (!database) database = toolsRepo || api.database;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    log("Building LBURG...");
    const lburgObjs = [];
    for (const file of lburgFiles) {
        try {

            const src = path.join("lburg", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.LBURG, file);

            log(`CC: ${src}\n\r`);
            lburgObjs.push(await compileToolFile(src, obj, "lburg", database));
        } catch (e) {
            log(e)
        }

    }

    await linkLburg(database)
}


async function linkLburg(database) {

    const lburgExe = path.join(CONFIGURATION, "lburg" + config.BINEXT);


    let exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
    FS.virtual[lburgExe] = exeRecord


    if (FS.virtual[lburgExe]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[lburgExe]?.timestamp
    ) {
        log(lburgExe + " already up to date...");
        return
    }

    log(`LD: ${lburgExe}\n\r`);


    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", lburgExe,
            ...lburgObjs,
            ...includeFlags
        ], obj: lburgObjs, database, wasm: lburgExe
    });


}


let BRANCH
let FILELIST

async function compileToolFile(src, obj, includeDir, database, extraFlags = []) {
    try {
        if (!database) database = toolsRepo || api.database;
        let parts = database.split('/');
        let ownerName = parts.length == 2 ? parts[0] : owner.value;
        let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;


        if (!BRANCH || !FILELIST) {
            BRANCH = await getDefaultBranch(ownerName, repoName)
            FILELIST = await loadGitHubTree(ownerName, repoName, BRANCH)
        }

        const sha = (FILELIST[src] || {}).sha;
        const content = await cacheFile(ownerName, repoName, src, sha);


        if (needsHeaders) {
            needsHeaders = false;

            await downloadHeaders(lccToolHeaders, 10, database)

        }

        let objRecord = await getRecord(DB_STORE_NAME, obj, database)
        FS.virtual[obj] = objRecord

        if (FS.virtual[obj]
            && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
        ) {
            log(`${obj} already up to date...\n\r`)

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
            obj: obj
        });
        return obj;
    } catch (e) {
        log(`Error compiling: ${src}`);
        throw e;
    }
}

function log(msg, ...args) {

    if (typeof term !== 'undefined') term.write(`\x1b[33m[TOOLS-BUILD]\x1b[0m ${msg}\r\n`);
    else if (typeof api.hostWrite != 'undefined') api.hostWrite(`\x1b[33m[TOOLS-BUILD]\x1b[0m ${msg}\r\n`);
    else console.log(msg);
}


let needsHeaders = true


async function buildRCC(database = null, skipTool = false) {
    if (!database) database = toolsRepo || api.database;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;

    needsHeaders = true

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    if (!skipTool) {

        const lburgExe = path.join(CONFIGURATION, "lburg" + config.BINEXT);

        let exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
        if (!exeRecord) {
            await buildLBurg(database)
            exeRecord = await getRecord(DB_STORE_NAME, lburgExe, database)
        }
        FS.virtual[lburgExe] = exeRecord

    }

    log("Building RCC...");
    const rccObjs = [];
    for (const file of rccFiles) {
        const obj = path.join(CONFIGURATION + '/' + toolDirs.RCC, file);
        try {
            if (file === 'dagcheck.o') {
                // Special case: Generate dagcheck.c using lburg
                log("Generating dagcheck.c via lburg...");
                const dagMd = "src/dagcheck.md";
                const dagC = path.join(CONFIGURATION, "src/dagcheck.c");


                await cacheFile(ownerName, repoName, dagMd, (FILELIST[dagMd] || {}).sha);
                // Logic to run lburg on dagcheck.md (This assumes your API can execute the tool)

                log(`BURG: ${dagMd}`);
                await api.run({
                    tool: lburgExe,
                    args: [lburgExe, dagMd, dagC],
                    database
                });

                log(`CC: ${dagC}\n\r`);
                rccObjs.push(await compileToolFile(dagC, obj, "src", database, ["-Wno-unused"]));
            } else {
                const src = path.join("src", file.replace('.o', '.c'));

                log(`CC: ${src}\n\r`);
                rccObjs.push(await compileToolFile(src, obj, "src", database));
            }
        } catch (e) {
            log(e)
        }
    }



    await linkRCC(database)

}



async function linkRCC(database = null) {
    if (!database) database = toolsRepo || api.database;


    let rccObjs = rccFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.RCC, file))
    const rccExe = path.join(CONFIGURATION, "q3rcc" + config.BINEXT);

    let exeRecord = await getRecord(DB_STORE_NAME, rccExe, database)
    FS.virtual[rccExe] = exeRecord


    if (FS.virtual[rccExe]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[rccExe]?.timestamp
    ) {
        log(rccExe + " already up to date...");
        return
    }

    log(`LD: ${rccExe}\n\r`);

    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", rccExe,
            ...rccObjs,
            ...includeFlags
        ], obj: rccObjs, database, wasm: rccExe
    });

}


async function buildCPP(database = null) {
    if (!database) database = toolsRepo || api.database;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;

    needsHeaders = true


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    log("Building CPP...");
    const cppObjs = [];
    for (const file of cppFiles) {
        try {
            const src = path.join("cpp", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.CPP, file);

            log(`CC: ${src}\n\r`);
            cppObjs.push(await compileToolFile(src, obj, "cpp", database));
        } catch (e) {
            log(e)
        }
    }

    await linkCPP(database)
}



async function linkCPP(database = null) {
    if (!database) database = toolsRepo || api.database;


    let cppObjs = cppFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.CPP, file))
    const cppExe = path.join(CONFIGURATION, "q3cpp" + config.BINEXT);


    let exeRecord = await getRecord(DB_STORE_NAME, cppExe, database)
    FS.virtual[cppExe] = exeRecord


    if (FS.virtual[cppExe]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[lburgExe]?.timestamp
    ) {
        log(cppExe + " already up to date...");
        return
    }

    log(`LD: ${cppExe}\n\r`);



    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", cppExe,
            ...cppObjs,
            ...includeFlags

        ], obj: cppObjs, database, wasm: cppExe
    });
}


async function buildLCC(database = null) {
    if (!database) database = toolsRepo || api.database;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;

    needsHeaders = true


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    log("Building LCC...");
    const lccObjs = [];
    for (const file of lccFiles) {
        try {
            const src = path.join("etc", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.ETC, file);
            const lccFlags = [`-DTEMPDIR=\"${config.TEMPDIR}\"`, `-DSYSTEM=\"\"`];

            log(`CC: ${src}\n\r`);
            lccObjs.push(await compileToolFile(src, obj, "src", database, lccFlags));
        } catch (e) {
            log(e)
        }
    }


    await linkLCC(database)


}




async function linkLCC(database = null) {

    if (!database) database = toolsRepo || api.database;


    let lccObjs = lccFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.ETC, file))
    const lccExe = path.join(CONFIGURATION, "q3lcc" + config.BINEXT);


    let exeRecord = await getRecord(DB_STORE_NAME, lccExe, database)
    FS.virtual[lccExe] = exeRecord


    if (FS.virtual[lccExe]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[lburgExe]?.timestamp
    ) {
        log(lccExe + " already up to date...");
        return
    }

    log(`LD: ${lccExe}\n\r`);


    await api.link({
        LDFLAGS: [
            ...toolLdFlags,
            "-o", lccExe,
            ...lccObjs,
            ...includeFlags
        ], obj: lccObjs, database, wasm: lccExe
    });

}


// --- Build Logic ---

async function buildTools(database = null) {
    if (!database) database = toolsRepo || api.database;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;


    needsHeaders = true

    // Helper to compile a single tool component


    log("Starting Toolchain Build...");


    // TODO: check if tool final output exists just like obj check

    // 1. Build LBURG (Needed to generate dagcheck.c for RCC)
    await buildLBurg(database)


    // 2. Build RCC (The Compiler Core)
    await buildRCC(database, true)


    // 3. Build CPP (Preprocessor)
    await buildCPP(database)


    // 4. Build LCC (Frontend)
    await buildLCC(database)

    log("Toolchain build complete.");
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
async function buildAsmTool(database = null) {
    if (!database) database = toolsRepo2 || api.database;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    needsHeaders = true


    if (needsHeaders) {
        needsHeaders = false;

        await downloadHeaders(lccToolHeaders, 10, database)

    }



    log("Building q3asm...");

    const toolSourceDir = "code/tools/asm"; // Adjust to your actual source path

    for (const file of q3asmFiles) {
        const src = path.join(toolSourceDir, file);
        const obj = path.join(CONFIGURATION, file.replace('.c', '.o'));

        try {
            const sha = files[database][src].sha;
            const content = await cacheFile(ownerName, repoName, src, sha);

            log(`CC: ${file}\n\r`);
            await api.compile({
                CFLAGS: [
                    ...QVM_CFLAGS,
                    '-o', obj, src
                ],
                contents: content,
                input: src,
                database,
                obj: obj
            });
        } catch (e) {
            log(`Error compiling q3asm component: ${file}`);
        }
    }

    await linkAsm(database)

}


async function linkAsm(database = null) {
    if (!database) database = toolsRepo2 || api.database;


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    let asmObjs = q3asmFiles.map(file => path.join(CONFIGURATION + '/' + toolDirs.ETC, file))

    const q3asmExe = path.join(CONFIGURATION, "q3asm" + config.BINEXT);

    let exeRecord = await getRecord(DB_STORE_NAME, q3asmExe, database)
    FS.virtual[q3asmExe] = exeRecord


    if (FS.virtual[q3asmExe]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[q3asmExe]?.timestamp
    ) {
        log(q3asmExe + " already up to date...");
        return
    }

    log(`LD: ${q3asmExe}\n\r`);


    try {
        log("Linking q3asm...");
        await api.link({
            LDFLAGS: [
                ...baseLdFlags,
                "-o", q3asmExe,
                ...asmObjs,
                ...includeFlags
            ],
            obj: asmObjs,
            database,
            wasm: q3asmExe,
        });
        log("q3asm build complete.");
    } catch (e) {
        log("Linker Error for q3asm");
    }
}

