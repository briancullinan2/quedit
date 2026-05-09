/**
 * Quake3e LCC Toolchain Build Script
 * Handles: q3rcc, lburg, q3cpp, q3lcc
 */

const COMPILE_PLATFORM = 'wasm'; // Or your target platform
const COMPILE_ARCH = 'js';

const config = {
    BUILD_DIR: "build",
    MOUNT_DIR: "code/tools", // Path to the tools source
    TEMPDIR: "/tmp"
};

const dirs = {
    BD: path.join(config.BUILD_DIR, `tools-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
};

// Tool-specific subdirectories
const toolDirs = {
    RCC: path.join(dirs.BD, "rcc"),
    LBURG: path.join(dirs.BD, "lburg"),
    CPP: path.join(dirs.BD, "cpp"),
    ETC: path.join(dirs.BD, "etc")
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
    "-O2",
    "-Wall",
    "-fno-strict-aliasing",
    "-Isrc",
    ...(COMPILE_PLATFORM === 'darwin' ? ["-DMACOS_X"] : [])
];

// --- Build Logic ---

async function buildTools(database = null) {
    if (!database) database = owner.value + '/' + repo.value;
    let parts = database.split('/');
    let ownerName = parts.length == 2 ? parts[0] : owner.value;
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value;

    const log = (msg) => {
        if (typeof term !== 'undefined') term.write(`\x1b[33m[TOOLS-BUILD]\x1b[0m ${msg}\r\n`);
        else console.log(msg);
    };

    // Helper to compile a single tool component
    const compileToolFile = async (src, obj, includeDir, extraFlags = []) => {
        try {
            const sha = files['#filelist'][src].sha;
            const content = await cacheFile(ownerName, repoName, src, sha);

            await api.compile({
                CFLAGS: [...LCC_CFLAGS, `-I${includeDir}`, ...extraFlags],
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

    // 1. Build LBURG (Needed to generate dagcheck.c for RCC)
    log("Building LBURG...");
    const lburgObjs = [];
    for (const file of lburgFiles) {
        const src = path.join("lburg", file.replace('.o', '.c'));
        const obj = path.join(toolDirs.LBURG, file);
        lburgObjs.push(await compileToolFile(src, obj, "lburg"));
    }
    const lburgExe = path.join(dirs.BD, "lburg");
    await api.link({ LDFLAGS: ["-o", lburgExe], obj: lburgObjs, database, wasm: lburgExe });

    // 2. Build RCC (The Compiler Core)
    log("Building RCC...");
    const rccObjs = [];
    for (const file of rccFiles) {
        const obj = path.join(toolDirs.RCC, file);
        if (file === 'dagcheck.o') {
            // Special case: Generate dagcheck.c using lburg
            log("Generating dagcheck.c via lburg...");
            const dagMd = "src/dagcheck.md";
            const dagC = path.join(toolDirs.RCC, "dagcheck.c");
            
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
    }
    const rccExe = path.join(dirs.BD, "q3rcc");
    await api.link({ LDFLAGS: ["-o", rccExe], obj: rccObjs, database, wasm: rccExe });

    // 3. Build CPP (Preprocessor)
    log("Building CPP...");
    const cppObjs = [];
    for (const file of cppFiles) {
        const src = path.join("cpp", file.replace('.o', '.c'));
        const obj = path.join(toolDirs.CPP, file);
        cppObjs.push(await compileToolFile(src, obj, "cpp"));
    }
    const cppExe = path.join(dirs.BD, "q3cpp");
    await api.link({ LDFLAGS: ["-o", cppExe], obj: cppObjs, database, wasm: cppExe });

    // 4. Build LCC (Frontend)
    log("Building LCC...");
    const lccObjs = [];
    for (const file of lccFiles) {
        const src = path.join("etc", file.replace('.o', '.c'));
        const obj = path.join(toolDirs.ETC, file);
        const lccFlags = [`-DTEMPDIR=\"${config.TEMPDIR}\"`, `-DSYSTEM=\"\"`];
        lccObjs.push(await compileToolFile(src, obj, "src", lccFlags));
    }
    const lccExe = path.join(dirs.BD, "q3lcc");
    await api.link({ LDFLAGS: ["-o", lccExe], obj: lccObjs, database, wasm: lccExe });

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
    ...(COMPILE_PLATFORM === 'darwin' ? ["-DMACOS_X=1"] : [])
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

    log("Building q3asm...");

    const objs = [];
    const toolSourceDir = "code/tools/asm"; // Adjust to your actual source path

    for (const file of q3asmFiles) {
        const src = path.join(toolSourceDir, file);
        const obj = path.join(dirs.BD, file.replace('.c', '.o'));

        try {
            const sha = files['#filelist'][src].sha;
            const content = await cacheFile(ownerName, repoName, src, sha);

            log(`CC: ${file}`);
            await api.compile({
                CFLAGS: QVM_CFLAGS,
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

    const q3asmExe = path.join(dirs.BD, "q3asm");
    
    try {
        log("Linking q3asm...");
        await api.link({
            LDFLAGS: ["-o", q3asmExe],
            obj: objs,
            database,
            wasm: q3asmExe
        });
        log("q3asm build complete.");
    } catch (e) {
        log("Linker Error for q3asm");
    }
}

