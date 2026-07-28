
// @ts-check


/** @type {import('./make.d').MakeQVMWindow} */
const makeToolsSelf = /** @type {any} */ (self);

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
	"-D__WASM__=1",

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

	//...(COMPILE_PLATFORM === 'darwin' ? ["-DMACOS_X"] : [])
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

	makeToolsSelf.config.MOUNT_DIR + "/wasm/wasm.syms"
	// etc
	//"etc/lcc.h"
];


const asmToolHeaders = [
	'cmdlib.h',
	'opstrings.h',
	'qvm.h',
	makeToolsSelf.config.MOUNT_DIR + "/wasm/wasm.syms"
];

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
	...(makeToolsSelf.undefinedFlags ?? []),
	//"--growable-table",
	// Link against the builtins and libc.a
	//path.join(vars.WASI_BUILTINS, "lib/wasi/libclang_rt.builtins-wasm32.a"),
	//path.join(vars.WASISDK, "share/wasi-sysroot/lib/wasm32-wasi/libc.a")
];




/**
 * @param {string | null | undefined} database
 **/
async function buildLBurg(database = null, forceChanged = false, noLinking = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;

	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;




	let hasChanged = false;

	console.log("Building LBURG...");
	for(const file of lburgFiles)
	{
		if(makeToolsSelf.TERMINATE) return;

		try
		{

			const src = makeToolsSelf.path.join("lburg", file.replace('.o', '.c'));
			const obj = makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.LBURG, file);
			const virtualSrc = makeToolsSelf.path.join(database, src);
			const virtualObj = makeToolsSelf.path.join(database, obj);

			if(makeToolsSelf.FS?.virtual[virtualObj]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(`${obj} already up to date...`);
				continue;
			}

			hasChanged = true;

			console.log(`CC: ${src}`);
			await compileToolFile(src, obj, "lburg", database, [], forceChanged);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`Build error in lburg: ${file}\n\r${e.message}\n\r${e.stack}`);
			}
		}

	}

	// this is the control structure i was looking for
	//   `build` command forces a full compile
	//   `link` command only builds missing and forces link
	//  *sigh* voidzero would have been so much more descriptive
	//    i could have defined a single module "build pattern"
	//    with only this workflow and then templates for the
	//    files variable, it would look similar to `make`
	if(!noLinking)
	{
		await linkLburg(database, true, true /* prevent recusion */);
	}
}


async function linkLburg(database, forceChanged = false, noBuild = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;

	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;




	const lburgExe = makeToolsSelf.path.join(CONFIGURATION, "lburg" + makeToolsSelf.config.BINEXT);
	const virtualLburg = makeToolsSelf.path.join(database, lburgExe);
	const lburgObjs = lburgFiles.map(f => makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.LBURG, f));

	if(!noBuild
		// TODO: check objs mtimes?
	)
	{
		// contradicts forceChanged because if noBuild === false then we just built
		await buildLBurg(database, false /* here's what makes it special */, true /* prevent recursion */);
	}



	let exeRecord = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', lburgExe, database);
	if(makeToolsSelf.FS)
	{
		makeToolsSelf.FS.virtual[virtualLburg] = exeRecord;

		if(makeToolsSelf.FS.virtual[virtualLburg]
			&& !forceChanged
		)
		{
			console.log(lburgExe + " already up to date...");
			return;
		}
	}

	console.log(`LD: ${lburgExe}`);


	await makeToolsSelf.api?.link?.({
		LDFLAGS: [
			...toolLdFlags,
			"-o", lburgExe,
			...lburgObjs,
			...(makeToolsSelf.includeFlags ?? [])
		],
		obj: lburgObjs,
		database,
		wasm: lburgExe,
	});


}


let BRANCH;
let FILELIST;

async function compileToolFile(src, obj, includeDir, database, extraFlags = [], forceChanged = false)
{
	try
	{
		if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
		const parts = database.split('/');
		const ownerName = parts.length == 2 ? parts[0] : makeToolsSelf.RepositoryToolbar?.owner?.value;
		const repoName = parts.length == 2 ? parts[1] : parts[0] || makeToolsSelf.RepositoryToolbar?.repository?.value;

		const virtualSrc = makeToolsSelf.path.join(database, src);
		const virtualObj = makeToolsSelf.path.join(database, obj);


		if(!BRANCH || !FILELIST)
		{
			BRANCH = await makeToolsSelf.getDefaultBranch?.(ownerName, repoName);
			if(BRANCH)
			{
				FILELIST = await makeToolsSelf.loadGitHubTree?.(ownerName, repoName, BRANCH);
			}
		}


		let content;
		if(makeToolsSelf.FS?.virtual[virtualSrc])
			content = makeToolsSelf.FS.virtual[virtualSrc].contents;
		else if(!src.includes(makeToolsSelf.config.BUILD_DIR + '/'))
			content = await makeToolsSelf.cacheFile?.(makeToolsSelf.DB_STORE_NAME ?? '', ownerName, repoName, src);
		else if(makeToolsSelf.FS)
		{
			makeToolsSelf.FS.virtual[virtualSrc] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', src, database);
			if(!makeToolsSelf.FS.virtual[virtualSrc])
				throw new Error('Output file not found: ' + src);
		}



		if(makeToolsSelf.needsHeaders)
		{

			console.log("Syncing TOOL headers...");

			await makeToolsSelf.downloadHeaders?.(lccToolHeaders, 10, database);

		}



		let objRecord = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);
		if(makeToolsSelf.FS)
		{
			makeToolsSelf.FS.virtual[virtualObj] = objRecord;

			if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(`${obj} already up to date...`);
				return obj;
			}
		}

		await makeToolsSelf.api?.compile?.({
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
	} catch(e)
	{
		if(e instanceof Error)
		{
			console.error(`Error compiling: ${src}: ${e}\n\r${e.stack}`);
			let newError = new Error(e.message);
			newError.stack = e.stack;
			throw newError;
		}
	}
}

if(typeof makeToolsSelf.needsHeaders === 'undefined')
{
	makeToolsSelf.needsHeaders = true;
}



/**
 * @param {string | null | undefined} database
 **/
async function buildRCC(database = null, skipTool = false, forceChanged = false, noLinking = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;

	const parts = database?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : makeToolsSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || makeToolsSelf.RepositoryToolbar?.repository?.value;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;




	const lburgExe = makeToolsSelf.path.join(CONFIGURATION, "lburg" + makeToolsSelf.config.BINEXT);
	const virtualLburg = makeToolsSelf.path.join(database, lburgExe);

	if(!skipTool)
	{

		let exeRecord = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', lburgExe, database);
		if(!exeRecord)
		{
			await buildLBurg(database, forceChanged);
			exeRecord = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', lburgExe, database);
		}
		if(makeToolsSelf.FS)
		{
			makeToolsSelf.FS.virtual[virtualLburg] = exeRecord;
		}

	}

	console.log("Building RCC...");

	let hasChanged = false;

	for(const file of rccFiles)
	{
		if(makeToolsSelf.TERMINATE) return;

		try
		{
			const obj = makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.RCC, file);
			const virtualObj = makeToolsSelf.path.join(database, obj);
			if(file === 'dagcheck.o')
			{
				// Special case: Generate dagcheck.c using lburg
				console.log("Generating dagcheck.c via lburg...");
				const dagMd = "src/dagcheck.md";
				const virtualDag = makeToolsSelf.path.join(database, dagMd);
				const dagC = makeToolsSelf.path.join(CONFIGURATION, "src/dagcheck.c");

				if(!makeToolsSelf.FS.virtual[virtualObj] && !forceChanged)
					makeToolsSelf.FS.virtual[virtualObj] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);

				if(!makeToolsSelf.FS.virtual[virtualDag] && !forceChanged)
					makeToolsSelf.FS.virtual[virtualDag] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', dagMd, database);

				if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
					&& makeToolsSelf.FS.virtual[virtualDag]?.timestamp
					&& makeToolsSelf.FS.virtual[virtualDag]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
					&& !forceChanged
				)
				{
					console.log(obj + " already up to date...");
					continue;
				}

				hasChanged = true;

				await makeToolsSelf.cacheFile?.(ownerName, repoName, dagMd, (FILELIST[dagMd] || {}).sha);
				// Logic to run lburg on dagcheck.md (This assumes your API can execute the tool)


				console.log(`BURG: ${dagMd}`);
				await makeToolsSelf.api?.run?.({
					tool: lburgExe,
					args: [lburgExe, dagMd, dagC],
					database,
					paths: [dagMd, dagC]
				});

				console.log(`CC: ${dagC}`);
				await compileToolFile(dagC, obj, "src", database, ["-Wno-unused"], forceChanged);
			} else
			{
				const src = makeToolsSelf.path.join("src", file.replace('.o', '.c'));
				const virtualSrc = makeToolsSelf.path.join(database, src);

				if(!makeToolsSelf.FS.virtual[virtualObj] && !forceChanged)
					makeToolsSelf.FS.virtual[virtualObj] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);

				if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
					&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
					&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
					&& !forceChanged
				)
				{
					console.log(obj + " already up to date...");
					continue;
				}

				hasChanged = true;

				console.log(`CC: ${src}`);
				await compileToolFile(src, obj, "src", database, [], forceChanged);
			}
		} catch(e)
		{
			if(e instanceof Error)
			{
				// ALREADY LOGGED BY
				if(!e.message.includes('Error compiling:'))
					console.error(`Error compiling: ${file}: ${e}\n\r${e.stack}`);
			}
		}
	}


	if(!noLinking)
	{
		await linkRCC(database, true, true);
	}

}



/**
 * @param {string | null | undefined} database
 **/
async function linkRCC(database = null, forceChanged = false, noBuild = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;



	const rccObjs = rccFiles.map(file => makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.RCC, file));
	const rccExe = makeToolsSelf.path.join(CONFIGURATION, "q3rcc" + makeToolsSelf.config.BINEXT);

	makeToolsSelf.FS.virtual[database + '/' + rccExe] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', rccExe, database);

	if(!noBuild)
	{
		await buildRCC(database, false, false, true /* prevent recursion */);
	}


	if(makeToolsSelf.FS.virtual[database + '/' + rccExe] && !forceChanged)
	{
		console.log(rccExe + " already up to date...");
		return;
	}

	console.log(`LD: ${rccExe}`);

	await makeToolsSelf.api?.link?.({
		LDFLAGS: [
			...toolLdFlags,
			"-o", rccExe,
			...rccObjs,
			...(makeToolsSelf.includeFlags ?? [])
		],
		obj: rccObjs,
		database,
		wasm: rccExe,
	});

}



/**
 * @param {string | null | undefined} database
 **/
async function buildCPP(database = null, forceChanged = false, noLinking = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;



	console.log("Building CPP...");

	let hasChanged = false;

	for(const file of cppFiles)
	{
		if(makeToolsSelf.TERMINATE) return;

		try
		{
			const src = makeToolsSelf.path.join("cpp", file.replace('.o', '.c'));
			const obj = makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.CPP, file);
			const virtualSrc = makeToolsSelf.path.join(database, src);
			const virtualObj = makeToolsSelf.path.join(database, obj);

			if(!makeToolsSelf.FS.virtual[virtualObj] && !forceChanged)
				makeToolsSelf.FS.virtual[virtualObj] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);

			if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(obj + " already up to date...");
				continue;
			}

			hasChanged = true;

			console.log(`CC: ${src}`);
			await compileToolFile(src, obj, "cpp", database, [], forceChanged);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}
	}

	if(!noLinking)
	{
		await linkCPP(database, true, true);
	}
}



/**
 * @param {string | null | undefined} database
 **/
async function linkCPP(database = null, forceChanged = false, noBuild = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;



	const cppObjs = cppFiles.map(file => makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.CPP, file));
	const cppExe = makeToolsSelf.path.join(CONFIGURATION, "q3cpp" + makeToolsSelf.config.BINEXT);


	makeToolsSelf.FS.virtual[database + '/' + cppExe] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', cppExe, database);


	if(!noBuild)
	{
		await buildCPP(database, false, true);
	}

	if(makeToolsSelf.FS.virtual[database + '/' + cppExe] && !forceChanged)
	{
		console.log(cppExe + " already up to date...");
		return;
	}

	console.log(`LD: ${cppExe}`);



	await makeToolsSelf.api?.link?.({
		LDFLAGS: [
			...toolLdFlags,
			'--export=out_fd',
			"-o", cppExe,
			...cppObjs,
			...(makeToolsSelf.includeFlags ?? [])

		],
		obj: cppObjs,
		database,
		wasm: cppExe,
	});
}


/**
 * @param {string | null | undefined} database
 **/
async function buildLCC(database = null, forceChanged = false, noLinking = false)
{
	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;



	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;




	console.log("Building LCC...");

	let hasChanged = false;

	for(const file of lccFiles)
	{
		if(makeToolsSelf.TERMINATE) return;


		try
		{
			const src = makeToolsSelf.path.join("etc", file.replace('.o', '.c'));
			const obj = makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.ETC, file);
			const virtualSrc = makeToolsSelf.path.join(database, src);
			const virtualObj = makeToolsSelf.path.join(database, obj);
			const lccFlags = [`-DTEMPDIR=\"${makeToolsSelf.config.TEMPDIR}\"`, `-DSYSTEM=\"\"`];

			if(!makeToolsSelf.FS.virtual[virtualObj] && !forceChanged)
				makeToolsSelf.FS.virtual[virtualObj] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);

			if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(obj + " already up to date...");
				continue;
			}

			hasChanged = true;

			console.log(`CC: ${src}`);
			await compileToolFile(src, obj, "src", database, lccFlags, forceChanged);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`Build error in q3lcc: ${file}\n\r${e.message}\n\r${e.stack}`);
			}
		}
	}


	if(!noLinking)
	{
		await linkLCC(database, true, true);
	}


}



/**
 * @param {string | null | undefined} database
 **/
async function linkLCC(database = null, forceChanged = false, noBuild = false)
{

	if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;



	const lccObjs = lccFiles.map(file => makeToolsSelf.path.join(CONFIGURATION + '/' + toolDirs.ETC, file));
	const lccExe = makeToolsSelf.path.join(CONFIGURATION, "q3lcc" + makeToolsSelf.config.BINEXT);


	if(!noBuild)
	{
		await buildLCC(database, false, true);
	}

	makeToolsSelf.FS.virtual[database + '/' + lccExe] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', lccExe, database);


	if(makeToolsSelf.FS.virtual[database + '/' + lccExe] && !forceChanged)
	{
		console.log(lccExe + " already up to date...");
		return;
	}

	console.log(`LD: ${lccExe}`);


	await makeToolsSelf.api?.link?.({
		LDFLAGS: [
			...toolLdFlags,
			//"--export=_spawnvp",
			"-o", lccExe,
			...lccObjs,
			...(makeToolsSelf.includeFlags || [])
		],
		obj: lccObjs,
		database,
		wasm: lccExe,
	});

}


/**
 * @param {string | null | undefined} database
 **/
async function buildTools(database = null, toolName = 'all', forceChanged = false, noBounce = false)
{

	if(makeToolsSelf.buildDebounce)
	{
		clearTimeout(makeToolsSelf.buildDebounce);
	}

	if(!noBounce)
	{
		makeToolsSelf.buildDebounce = setTimeout(() => buildTools(database, toolName, forceChanged, true), 500);
		return;
	}

	if(makeToolsSelf.building) return;
	makeToolsSelf.building = true;


	if(makeToolsSelf.TERMINATE) return;


	try
	{

		if(!database) database = makeToolsSelf.toolsRepository || makeToolsSelf.api?.database;

		// Helper to compile a single tool component

		console.log(`Starting Toolchain Build ${toolName}...`);

		// TODO: check if tool final output exists just like obj check

		if(toolName === 'lburg' || toolName === 'all')
			// 1. Build LBURG (Needed to generate dagcheck.c for RCC)
			await buildLBurg(database, forceChanged, false /* don't exclude link step */);

		if(makeToolsSelf.TERMINATE) return;


		if(toolName === 'q3rcc' || toolName === 'all')
			// 2. Build RCC (The Compiler Core)
			await buildRCC(database, false, forceChanged);

		if(makeToolsSelf.TERMINATE) return;


		if(toolName === 'q3cpp' || toolName === 'all')
			// 3. Build CPP (Preprocessor)
			await buildCPP(database, forceChanged);

		if(makeToolsSelf.TERMINATE) return;


		if(toolName === 'q3lcc' || toolName === 'all')
			// 4. Build LCC (Frontend)
			await buildLCC(database, forceChanged);

		if(makeToolsSelf.TERMINATE) return;


		if(toolName === 'q3asm' || toolName === 'all')
			await buildAsmTool(makeToolsSelf.tools2Repository || makeToolsSelf.api?.toolsRepo2 || makeToolsSelf.api?.database, forceChanged);

		if(makeToolsSelf.TERMINATE) return;


		console.log(`Toolchain build ${toolName} complete.`);

	}
	finally
	{
		makeToolsSelf.building = false;
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
 * @param {string | null | undefined} database
 **/
async function buildAsmTool(database = null, forceChanged = false, noLinking = false)
{


	if(!database) database = makeToolsSelf.tools2Repository || makeToolsSelf.api?.toolsRepo2 || makeToolsSelf.api?.database;
	if(!database) return;


	const parts = database?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : makeToolsSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || makeToolsSelf.RepositoryToolbar?.repository?.value;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;






	console.log("Building q3asm...");

	let hasChanged = false;

	for(const file of q3asmFiles)
	{

		if(makeToolsSelf.TERMINATE) return;


		if(makeToolsSelf.needsHeaders)
		{

			console.log("Syncing ASM headers...");
			await makeToolsSelf.downloadHeaders?.(asmToolHeaders, 10, database);

		}

		hasChanged = true;



		try
		{

			const src = file;
			const obj = makeToolsSelf.path.join(CONFIGURATION, file.replace('.c', '.o'));
			const content = await makeToolsSelf.cacheFile?.(ownerName, repoName, src);
			const virtualSrc = makeToolsSelf.path.join(database, src);
			const virtualObj = makeToolsSelf.path.join(database, obj);



			if(!makeToolsSelf.FS.virtual[virtualObj] && !forceChanged)
				makeToolsSelf.FS.virtual[virtualObj] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', obj, database);

			if(makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp
				&& makeToolsSelf.FS.virtual[virtualSrc]?.timestamp < makeToolsSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(obj + " already up to date...");
				continue;
			}

			console.log(`CC: ${file}`);
			await makeToolsSelf.api?.compile?.({
				CFLAGS: [
					...LCC_CFLAGS,
					'-o', obj, src
				],
				contents: content,
				input: src,
				database,
				obj: obj,
			});

		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`Error compiling q3asm component: ${file}\n\r${e.message}\n\r${e.stack}`);
			}
		}
	}

	if(!noLinking)
	{
		await linkAsm(database, hasChanged, true);
	}

}


/**
 * @param {string | null | undefined} database
 **/
async function linkAsm(database = null, forceChanged = false, noBuild = false)
{
	if(!database) database = makeToolsSelf.tools2Repository || makeToolsSelf.api?.toolsRepo2 || makeToolsSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeToolsSelf.api?.configuration === 'release'
		? makeToolsSelf.dirs.ENGINE_RELEASE
		: makeToolsSelf.dirs.ENGINE_DEBUG;



	let asmObjs = q3asmFiles.map(file => makeToolsSelf.path.join(CONFIGURATION, file.replace('.c', '.o')));

	if(!noBuild)
	{
		await buildAsmTool(database, false, true);
	}

	const q3asmExe = makeToolsSelf.path.join(CONFIGURATION, "q3asm" + makeToolsSelf.config.BINEXT);

	makeToolsSelf.FS.virtual[database + '/' + q3asmExe] = await makeToolsSelf.getRecord?.(makeToolsSelf.DB_STORE_NAME ?? '', q3asmExe, database);


	if(makeToolsSelf.FS.virtual[database + '/' + q3asmExe] && !forceChanged)
	{
		console.log(q3asmExe + " already up to date...");
		return;
	}

	console.log(`LD: ${q3asmExe}`);


	try
	{
		console.log("Linking q3asm...");
		await makeToolsSelf.api?.link?.({
			LDFLAGS: [
				...toolLdFlags,
				"-o", q3asmExe,
				...asmObjs,
				...(makeToolsSelf.includeFlags ?? [])
			],
			obj: asmObjs,
			database,
			wasm: q3asmExe,

		});
		console.log("q3asm build complete.");
	} catch(e)
	{
		if(e instanceof Error)
		{
			console.error(`Linker Error for q3asm: ${q3asmExe}: ${e}\n\r${e.stack}`);
		}
		throw e;
	}
}

