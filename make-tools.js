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
    '-internal-isystem', '/include/c++/v1',
    "-internal-isystem", "/include",
    "-internal-isystem", "/lib/clang/8.0.1/include", // Path varies by your Clang version

    "-O2",
    "-Wall",
    "-Wno-dangling-else",
    '-ferror-limit', '100',
    //'-c',
    //"-fno-strict-aliasing",
    "-D_XOPEN_SOURCE=700",
    "-D__wasi__=1",
    "-std=gnu11",

    '-disable-free',
    '-fno-common',
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

    // etc
    //"etc/lcc.h"
];



// --- Build Logic ---

async function buildTools(database = null) {
    if (!database) database = owner.value + '/' + repo.value;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;

    let BRANCH = await getDefaultBranch(ownerName, repoName)
    let FILELIST = await loadGitHubTree(ownerName, repoName, BRANCH)


    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    const log = (msg) => {
        if (typeof term !== 'undefined') term.write(`\x1b[33m[TOOLS-BUILD]\x1b[0m ${msg}\r\n`);
        else console.log(msg);
    };

    // Helper to compile a single tool component
    const compileToolFile = async (src, obj, includeDir, extraFlags = []) => {
        try {
            const sha = FILELIST[src].sha;
            const content = await cacheFile(ownerName, repoName, src, sha);

            await api.compile({
                CFLAGS: [
                    ...LCC_CFLAGS, `-I${includeDir}`, ...extraFlags,
                    '-o', obj, src
                ],
                contents: content,
                width: term.cols,
                input: src,
                database,
                obj: obj
            });
            return obj;
        } catch (e) {
            log(`Error compiling: ${src}`);
            throw e;
        }
    };

    log("Starting Toolchain Build...");

    await downloadHeaders(lccToolHeaders, 10, database)


    // 1. Build LBURG (Needed to generate dagcheck.c for RCC)
    log("Building LBURG...");
    const lburgObjs = [];
    for (const file of lburgFiles) {
        try {

            const src = path.join("lburg", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.LBURG, file);
            lburgObjs.push(await compileToolFile(src, obj, "lburg"));
        } catch (e) {
            console.log(e)
        }
    }
    const lburgExe = path.join(CONFIGURATION, "lburg" + config.BINEXT);
    await api.link({
        LDFLAGS: [
            ...baseLdFlags,
            "-o", lburgExe,
            ...lburgObjs,
            ...includeFlags
        ], obj: lburgObjs, database, wasm: lburgExe
    });

    // 2. Build RCC (The Compiler Core)
    log("Building RCC...");
    const rccObjs = [];
    for (const file of rccFiles) {
        const obj = path.join(CONFIGURATION + '/' + toolDirs.RCC, file);
        try {
            if (file === 'dagcheck.o') {
                // Special case: Generate dagcheck.c using lburg
                log("Generating dagcheck.c via lburg...");
                const dagMd = "src/dagcheck.md";
                const dagC = path.join(CONFIGURATION + '/' + toolDirs.RCC, "dagcheck.c");

                // Logic to run lburg on dagcheck.md (This assumes your API can execute the tool)
                await api.run({
                    tool: lburgExe,
                    args: [dagMd, dagC],
                    database
                });

                rccObjs.push(await compileToolFile(dagC, obj, "src", ["-Wno-unused"]));
            } else {
                const src = path.join("src", file.replace('.o', '.c'));
                rccObjs.push(await compileToolFile(src, obj, "src"));
            }
        } catch (e) {
            console.log(e)
        }
    }
    const rccExe = path.join(CONFIGURATION, "q3rcc" + config.BINEXT);
    await api.link({
        LDFLAGS: [
            ...baseLdFlags,
            "-o", rccExe,
            ...rccObjs,
            ...includeFlags
        ], obj: rccObjs, database, wasm: rccExe
    });

    // 3. Build CPP (Preprocessor)
    log("Building CPP...");
    const cppObjs = [];
    for (const file of cppFiles) {
        try {
            const src = path.join("cpp", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.CPP, file);
            cppObjs.push(await compileToolFile(src, obj, "cpp"));
        } catch (e) {
            console.log(e)
        }
    }
    const cppExe = path.join(CONFIGURATION, "q3cpp" + config.BINEXT);
    await api.link({
        LDFLAGS: [
            ...baseLdFlags,
            "-o", cppExe,
            ...cppObjs,
            ...includeFlags

        ], obj: cppObjs, database, wasm: cppExe
    });

    // 4. Build LCC (Frontend)
    log("Building LCC...");
    const lccObjs = [];
    for (const file of lccFiles) {
        try {
            const src = path.join("etc", file.replace('.o', '.c'));
            const obj = path.join(CONFIGURATION + '/' + toolDirs.ETC, file);
            const lccFlags = [`-DTEMPDIR=\"${config.TEMPDIR}\"`, `-DSYSTEM=\"\"`];
            lccObjs.push(await compileToolFile(src, obj, "src", lccFlags));
        } catch (e) {
            console.log(e)
        }
    }
    const lccExe = path.join(CONFIGURATION, "q3lcc" + config.BINEXT);
    await api.link({
        LDFLAGS: [
            ...baseLdFlags,
            "-o", lccExe,
            ...lccObjs,
            ...includeFlags
        ], obj: lccObjs, database, wasm: lccExe
    });

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
    if (!database) database = owner.value + '/' + repo.value;

    const log = (msg) => {
        if (typeof term !== 'undefined') term.write(`\x1b[35m[Q3ASM-BUILD]\x1b[0m ${msg}\r\n`);
        else console.log(msg);
    };

    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    log("Building q3asm...");

    const objs = [];
    const toolSourceDir = "code/tools/asm"; // Adjust to your actual source path

    for (const file of q3asmFiles) {
        const src = path.join(toolSourceDir, file);
        const obj = path.join(CONFIGURATION, file.replace('.c', '.o'));

        try {
            const sha = files[database][src].sha;
            const content = await cacheFile(ownerName, repoName, src, sha);

            log(`CC: ${file}`);
            await api.compile({
                CFLAGS: [
                    ...QVM_CFLAGS,
                    '-o', obj, src
                ],
                contents: content,
                width: term.cols,
                input: src,
                database,
                obj: obj
            });
            objs.push(obj);
        } catch (e) {
            log(`Error compiling q3asm component: ${file}`);
        }
    }

    const q3asmExe = path.join(CONFIGURATION, "q3asm" + config.BINEXT);

    try {
        log("Linking q3asm...");
        await api.link({
            LDFLAGS: [
                ...baseLdFlags,
                "-o", q3asmExe,
                ...objs,
                ...includeFlags
            ],
            obj: objs,
            database,
            wasm: q3asmExe
        });
        log("q3asm build complete.");
    } catch (e) {
        log("Linker Error for q3asm");
    }
}

