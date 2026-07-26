/**
 * Quake3e Build Configuration Script - Browser Version
 */

const HEADER_BATCH = 10;


const CFLAGS = [
	"-cc1",
	"-emit-obj",
	"-triple", "wasm32-wasi",

	'-isysroot', '/',
	'-internal-isystem', 'include/c++/v1',
	'-internal-isystem', 'include',
	'-internal-isystem', 'lib/clang/8.0.1/include',
	'-disable-free',
	'-ferror-limit', '100',
	'-fcolor-diagnostics',


	"-D__WASM__=1",
	"-D__wasi__=1",
	"-D__wasm32__=1",
	"-DNO_VM_COMPILED=1",
	"-D__EMSCRIPTEN__=1",
	"-D_XOPEN_SOURCE=700",
	"-D_WASI_EMULATED_SIGNAL=1",
	"-D_WASI_EMULATED_MMAN=1",
	"-DDISABLE_IPV6=1",
	//"-DLACKS_ERRNO_H",
	"-D_Thread_local=",
	"-DSEEK_SET=0",
	"-DSEEK_CUR=1",
	"-DSEEK_END=2",
	"-DEMSCRIPTEN_NO_ERRNO=1",
	"-DUSE_OPENGL_API=1",
	"-fno-rtti",
	"-fno-common",
	"-fno-use-init-array",
	"-fno-threadsafe-statics",
	//"-fno-inline",
	"-mrelocation-model",
	"static",
	//"-target-feature",
	//"+bulk-memory",
	//"-target-feature",
	//"+atomics",
	//"-pthread",
	"-std=gnu11",

	"-I/code/wasm",
	"-I/code/qcommon",
	"-I/code/client",
	"-I/code/game"
];

// replicatng the file structure for the linker
// Client Core
const clientObjects = [
	"cl_cgame.c", "cl_cin.c", "cl_console.c", "cl_input.c",
	"cl_keys.c", "cl_main.c", "cl_net_chan.c", "cl_parse.c",
	"cl_scrn.c", "cl_ui.c", "cl_avi.c", "cl_jpeg.c"
].map(file => path.join(dirs.CDIR, file));

// Collision Manager
const collisionObjects = [
	"cm_load.c", "cm_patch.c", "cm_polylib.c",
	"cm_test.c", "cm_trace.c"
].map(file => path.join(dirs.CMDIR, file));

// QCommon / Shared
const commonObjects = [
	"cmd.c", "common.c", "cvar.c", "files.c", "history.c",
	"keys.c", "md4.c", "md5.c", "msg.c", "net_chan.c",
	"net_ip.c", "huffman.c", "huffman_static.c", "splines.c",
	"q_math.c", "q_shared.c", "unzip.c", "puff.c"
].map(file => path.join(dirs.CMDIR, file));

// Sound System
const soundObjects = [
	"snd_adpcm.c", "snd_dma.c", "snd_mem.c", "snd_mix.c",
	"snd_wavelet.c", "snd_main.c", "snd_codec.c", "snd_codec_wav.c"
].map(file => path.join(dirs.CDIR, file));

// Server
const serverObjects = [
	"sv_bot.c", "sv_bsp_mini.c", "sv_ccmds.c", "sv_client.c",
	"sv_filter.c", "sv_game.c", "sv_init.c", "sv_main.c",
	"sv_net_chan.c", "sv_snapshot.c", "sv_teleport.c", "sv_world.c"
].map(file => path.join(dirs.SDIR, file));

// Virtual Machine
const vmObjects = [
	"vm.c", "vm_interpreted.c"
].map(file => path.join(dirs.CMDIR, file));

// Bot Engine / AI (AAS)
const botObjects = [
	"be_aas_bspq3.c", "be_aas_cluster.c", "be_aas_debug.c",
	"be_aas_entity.c", "be_aas_file.c", "be_aas_main.c",
	"be_aas_move.c", "be_aas_optimize.c", "be_aas_reach.c",
	"be_aas_route.c", "be_aas_routealt.c", "be_aas_sample.c",
	"be_ai_char.c", "be_ai_chat.c", "be_ai_gen.c",
	"be_ai_goal.c", "be_ai_move.c", "be_ai_weap.c",
	"be_ai_weight.c", "be_ea.c", "be_interface.c"
].map(file => path.join(dirs.BLIBDIR, file));

// Internal Libraries (L_)
const libObjects = [
	"l_crc.c", "l_libvar.c", "l_log.c", "l_memory.c",
	"l_precomp.c", "l_script.c", "l_struct.c"
].map(file => path.join(dirs.BLIBDIR, file));


const sysObjects = [
	"sys_main.c",
	"dlmalloc.c",
	"sbrk.c",
	//"stack_ops.c",
].map(file => path.join(dirs.WASMDIR, file));

// Combined for the full build
const allQ3Objects = [
	...clientObjects,
	...collisionObjects,
	...commonObjects,
	...soundObjects,
	...serverObjects,
	...vmObjects,
	...botObjects,
	...libObjects,
	...sysObjects
];

// Shadows & Masking
const shaderShadowObjects = [
	"pshadow_fp.glsl", "pshadow_vp.glsl",
	"shadowfill_fp.glsl", "shadowfill_vp.glsl",
	"shadowmask_fp.glsl", "shadowmask_vp.glsl"
].map(file => path.join(dirs.R2DIR, "glsl", file));

// Lighting & Fog
const shaderLightObjects = [
	"dlight_fp.glsl", "dlight_vp.glsl",
	"lightall_fp.glsl", "lightall_vp.glsl",
	"fogpass_fp.glsl", "fogpass_vp.glsl"
].map(file => path.join(dirs.R2DIR, "glsl", file));

// Post-Processing (Bloom/Bokeh/Tone)
const shaderPostProcessObjects = [
	"bokeh_fp.glsl", "bokeh_vp.glsl",
	"tonemap_fp.glsl", "tonemap_vp.glsl",
	"ssao_fp.glsl", "ssao_vp.glsl",
	"depthblur_fp.glsl", "depthblur_vp.glsl"
].map(file => path.join(dirs.R2DIR, "glsl", file));

// Scaling & Downsampling
const shaderScaleObjects = [
	"calclevels4x_fp.glsl", "calclevels4x_vp.glsl",
	"down4x_fp.glsl", "down4x_vp.glsl"
].map(file => path.join(dirs.R2DIR, "glsl", file));

// Generic & Utilities
const shaderUtilityObjects = [
	"generic_fp.glsl", "generic_vp.glsl",
	"texturecolor_fp.glsl", "texturecolor_vp.glsl"
].map(file => path.join(dirs.R2DIR, "glsl", file));

// Combined Renderer Shaders
const allRend2ShaderObjects = [
	...shaderShadowObjects,
	...shaderLightObjects,
	...shaderPostProcessObjects,
	...shaderScaleObjects,
	...shaderUtilityObjects
];


// Image Loading & Formats
/*
const rendererImageObjects = [
	"tr_image_bmp.c", "tr_image_jpg.c",
	"tr_image_pcx.c", "tr_image_png.c", "tr_image_tga.c",
	"tr_image_dds.c"
].map(file => path.join(dirs.R2DIR, file));
*/

// Geometry, Meshes & Animation
const rendererGeometryObjects = [
	"tr_image_dds.c",
	"tr_image.c", "tr_animation.c", "tr_curve.c", "tr_mesh.c",
	"tr_model.c", "tr_model_iqm.c", "tr_surface.c",
	"tr_world.c", "tr_bsp.c"
].map(file => path.join(dirs.R2DIR, file));

// Core Pipeline & Backend
const rendererCoreObjects = [
	"tr_backend.c", "tr_cmds.c", "tr_main.c",
	"tr_init.c", "tr_scene.c", "tr_shade.c",
	"tr_shade_calc.c", "tr_shader.c"
].map(file => path.join(dirs.R2DIR, file));

// Buffers & Extensions (GL specific)
const rendererGLObjects = [
	"tr_dsa.c", "tr_extensions.c", "tr_fbo.c",
	"tr_glsl.c", "tr_vbo.c"
].map(file => path.join(dirs.R2DIR, file));

// Effects & Lighting
const rendererEffectObjects = [
	"tr_extramath.c", "tr_flares.c",
	"tr_light.c", "tr_marks.c",
	"tr_postprocess.c", "tr_shadows.c", "tr_sky.c"
].map(file => path.join(dirs.R2DIR, file));

// Shared Render Files
const rendererCommon = [
	"tr_font.c", "tr_noise.c", "tr_manipulation.c",
	"tr_image_tga.c"
].map(file => path.join(dirs.RCDIR, file));

// Shared dependencies (used if USE_RENDERER_DLOPEN is true)
const rendererSharedObjects = [
	"q_shared.c", "puff.c", "q_math.c"
].map(file => path.join(dirs.CMDIR, file));

// Combined Renderer Array
const allRend2Objects = [
	//...rendererImageObjects,
	...rendererGeometryObjects,
	...rendererCoreObjects,
	...rendererGLObjects,
	...rendererEffectObjects,
	...rendererCommon,
	//...rendererSharedObjects
];


const allCompileObjects = [
	...allQ3Objects,
	...allRend2Objects
];


const botlibCoreHeaders = [
	"botlib.h", "be_aas.h", "aasfile.h", "be_aas_bsp.h",
	"be_aas_def.h", "be_aas_funcs.h"
].map(file => path.join(dirs.BLIBDIR, file));

// AAS (Area Awareness System) Internal Headers
const aasInternalHeaders = [
	"be_aas_cluster.h", "be_aas_debug.h", "be_aas_entity.h",
	"be_aas_file.h", "be_aas_main.h", "be_aas_move.h",
	"be_aas_optimize.h", "be_aas_reach.h", "be_aas_route.h",
	"be_aas_routealt.h", "be_aas_sample.h"
].map(file => path.join(dirs.BLIBDIR, file));

// AI / Behavior Engine Headers
const botAIHeaders = [
	"be_ai_char.h", "be_ai_chat.h", "be_ai_gen.h",
	"be_ai_goal.h", "be_ai_move.h", "be_ai_weap.h",
	"be_ai_weight.h", "be_ea.h", "be_interface.h"
].map(file => path.join(dirs.BLIBDIR, file));

// Botlib Library Utilities (L_)
const botLibUtilsHeaders = [
	"l_crc.h", "l_libvar.h", "l_log.h", "l_memory.h",
	"l_precomp.h", "l_script.h", "l_struct.h", "l_utils.h"
].map(file => path.join(dirs.BLIBDIR, file));

// Combined for easy reference
const allBotlibHeaders = [
	...botlibCoreHeaders,
	...aasInternalHeaders,
	...botAIHeaders,
	...botLibUtilsHeaders
];


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
	"qcommon/cm_polylib.h",
	"qcommon/cm_patch.h",
	"qcommon/vm_local.h",
	"qcommon/files_checksums.h",
	"qcommon/puff.h",
	"qcommon/json.h",

	// --- Client & Server ---
	"client/client.h",      // Client-side engine state
	"client/snd_public.h",
	"client/snd_local.h",
	"client/snd_codec.h",
	"client/keys.h",
	"client/keycodes.h",
	"server/server.h",      // Server-side engine state
	"server/tlds.h",


	// --- Renderer (Internal) ---
	"renderer/iqm.h",
	"renderer2/tr_local.h",  // Core renderer internal state
	"renderercommon/tr_public.h", // Public interface to the renderer
	"renderercommon/tr_types.h",
	"renderer2/tr_common.h",
	"renderer2/tr_dsa.h",
	"renderer2/tr_extramath.h",
	"renderer2/tr_extratypes.h",
	"renderer2/tr_fbo.h",
	"renderer2/tr_postprocess.h",
	"renderer2/qgl.h",       // OpenGL function pointers/wrappers

	// --- Shared / Game Layer ---
	"game/g_public.h",      // Engine <-> Game VM interface
	"game/bg_public.h",     // Shared Game/CGame logic (physics, items)
	"cgame/cg_public.h",    // Engine <-> CGame VM interface

	// --- UI Layer ---
	"ui/ui_public.h",       // Engine <-> UI VM interface
	//"q3_ui/ui_local.h",     // Classic Q3 UI local definitions

	// --- System Layer ---
	"wasm/sys_overrides.h",
	//"wasm/setjmp.h",
	"wasm/gl.h",
	"wasm/glext.h",
	"wasm/sys_local.h",
	"wasm/khrplatform.h",
	"wasm/setjmp.h",
	"wasm/wasm.syms",
	//"sys/sys_local.h",      // System-specific (Win/Linux) low-level stuff
	//"sys/sys_loadlib.h"     // Dynamic library loading
].map(file => path.join(config.MOUNT_DIR, file))
	// --- BotLib ---
	.concat(allBotlibHeaders);

function getBaseFlags()
{
	let flags = ["-Wall", "-Wimplicit", "-Wstrict-prototypes"];

	if(config.USE_SYSTEM_JPEG) flags.push("-DUSE_SYSTEM_JPEG");
	if(config.USE_CURL) flags.push("-DUSE_CURL");

	// Web-specific requirements
	if(COMPILE_PLATFORM === 'emscripten')
	{
		flags.push("-s USE_SDL=2", "-s ALLOW_MEMORY_GROWTH=1", "-s ASSERTIONS=1");
	}

	return flags;
}


// Base LDFLAGS shared across all modules
const ENGINE_LDFLAGS = [
	//"-D__WASM__=1",
	//"--no-standard-libraries",
	'--no-threads',
	"--export-dynamic",
	"--error-limit=200",
	"--import-memory",
	"--import-table",
	'-z', `stack-size=${1024 * 1024}`,
	'-Llib/wasm32-wasi',
	"-mllvm", "-mattr=+mutable-globals",
	"--global-base=" + ENGINE_MEMORY_BASE,
	//"--growable-table",
	// Link against the builtins and libc.a
	//path.join(vars.WASI_BUILTINS, "lib/wasi/libclang_rt.builtins-wasm32.a"),
	//path.join(vars.WASISDK, "share/wasi-sysroot/lib/wasm32-wasi/libc.a")
];

// Platform specific (import memory/table for WASM target)
const wasmPlatformFlags = [
	"--import-memory",
	"--import-table"
];

// Emscripten/JS specific flags (-s settings)
const emscriptenJsFlags = [
	"-s", "MIN_WEBGL_VERSION=1",
	"-s", "MAX_WEBGL_VERSION=3",
	"-s", "USE_WEBGL2=1",
	"-s", "FULL_ES2=1",
	"-s", "FULL_ES3=1",
	"-s", "USE_SDL=2",
	"-s", "SINGLE_FILE=1",
	"-s", "ALLOW_MEMORY_GROWTH=1",
	"-s", "INITIAL_MEMORY=256MB",
	// JS Libraries
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_in.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_wasm.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_snd.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_net.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_web.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_fs.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_std.js"),
	"--js-library", path.join(config.MOUNT_DIR, "wasm/sys_emjs.js")
];

// Symbols to export to the JS environment
const exportFlags = [
	"__stack_pointer", "sprintf", "malloc", "free", "stderr", "stdout", "errno", "_start",
	"FS_CreatePath", "R_FindPalette", "Key_ClearStates", "Key_GetCatcher",
	"Key_SetCatcher", "CL_PacketEvent", "s_soundStarted", "s_soundMuted",
	"s_knownSfx", "dma", "S_SoundInfo", "Cbuf_ExecuteText", "Cbuf_AddText",
	"gw_minimized", "FS_RecordFile", "gw_active", "Z_Free", "CL_R_FinishImage3",
	"CL_NextDownload", "com_fullyInitialized", "Z_Malloc", "Sys_QueEvent",
	"MSG_Init", "Com_RunAndTimeServerPacket", "Com_Frame", "Cvar_VariableValue",
	"Cvar_VariableIntegerValue", "Cvar_VariableString", "Cvar_Get",
	"cvar_modifiedFlags", "WindowResize", "Cvar_Set", "Cvar_SetValue",
	"Cvar_SetIntegerValue", "Cvar_CheckRange", "FS_ReadFile", "VM_Call",
	"FS_FreeFile", "FS_CopyString", "FS_GetCurrentGameDir", "Key_KeynumToString"
].map(sym => `--export=${sym}`);

// Undefined symbols handling
const undefinedFlags = [
	`--allow-undefined-file=${'code/wasm/wasm.syms'}`
];

const includeFlags = [
	'-lc', '-lc++', '-lc++abi'
];

// Final Assembly based on platform
const LDFLAGS = [
	...ENGINE_LDFLAGS,
	'lib/wasm32-wasi/crt1.o',
	...wasmPlatformFlags,
	...exportFlags,
	...undefinedFlags
];


function generateFallbackC(fileName, content)
{

	const decoder = new TextDecoder();
	const str = decoder.decode(content);

	// Strip path and extension (basename equivalent)
	const base = fileName.split('/').pop().split('.').shift();

	let output = `const char *fallbackShader_${base} =\n`;

	const lines = str.split(/\r?\n/);

	lines.forEach(line =>
	{
		// Trim trailing whitespace and escape double quotes
		const trimmed = line.trimEnd().replace(/"/g, '\\"');
		output += `"${trimmed}\\n"\n`;
	});

	output += ";\n";
	return output;
}



function BUILDCFLAGS(CONFIGURATION)
{
	if(!CONFIGURATION)
		CONFIGURATION = api.configuration == 'release'
			? dirs.ENGINE_RELEASE
			: dirs.ENGINE_DEBUG;

	let DEBUG_CFLAGS = api.configuration != 'debug'
		? ['-DNDEBUG', '-O3', '-ffast-math']
		: ['-DDEBUG', '-D_DEBUG', /* '-g',*/ '-O0'];

	let PRE = api.configuration == 'pre'
		? ['-E', '-P']
		: api.configuration == 'analyze'
			? ['--analyze']
			: api.configuration == 'sanitize'
				? ['-fsanitize=address']
				: [];

	PRE = PRE.concat([
		'-fmessage-length', '' + (api.width || '80')
	]);

	return [...DEBUG_CFLAGS, ...PRE];
}



async function buildStringify(database = null, forceChanged = false, noLinking = false)
{


	let DEBUG_CFLAGS = BUILDCFLAGS();

	if(!database) database = api.database;
	const parts = database.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	if(needsHeaders)
	{

		await downloadHeaders(q3eCommonHeaders, 10, database);
	}

	let CONFIGURATION = api.configuration == 'release'
		? dirs.ENGINE_RELEASE
		: dirs.ENGINE_DEBUG;
	//await api.upload(database)

	let stringify = 'code/renderer2/stringify.c';
	let obj = CONFIGURATION + '/stringify.o';
	let sha = files[database][stringify].sha;
	let content = await cacheFile(ownerName, repoName, stringify, sha);

	if(!FS.virtual[obj] && !forceChanged)
		FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database);

	let hasChanged = false;

	if(FS.virtual[obj]
		// compare input and output mtime
		&& FS.virtual[stringify]?.timestamp < FS.virtual[obj]?.timestamp
		&& !forceChanged
	)
	{
		console.log(`${obj} already up to date...`);

		return;
	}

	hasChanged = true;

	try
	{
		await api.compile({
			CFLAGS: [
				'-cc1', '-triple', 'wasm32-wasi',
				'-emit-obj',
				'-isysroot', '/',
				'-internal-isystem', '/include/c++/v1',
				'-internal-isystem', '/include',
				'-internal-isystem', '/lib/clang/8.0.1/include',
				"-std=gnu11",
				...DEBUG_CFLAGS,
				...(api.configuration == 'pre' ? [
					'-o', obj.replace('.o', '.a'),
				] : ['-o', obj]),
				stringify
			],
			contents: content,
			input: stringify,
			database,
			obj: obj
		});
	} catch(e)
	{
		console.log(`${e.message}\n\r${e.stack || e.stacktrace}`);
	}

	if(!noLinking)
	{
		await linkStringify(database, hasChanged, true);
	}
}


async function linkStringify(database = null, forceChanged = false, noBuild = false)
{

	if(!database) database = api.database;

	let CONFIGURATION = api.configuration == 'release'
		? dirs.ENGINE_RELEASE
		: dirs.ENGINE_DEBUG;





	if(!noBuild)
	{
		await buildStringify(database, false, true);
	}

	let stringifyExe = CONFIGURATION + '/stringify' + config.BINEXT;

	let exeRecord = await getRecord(DB_STORE_NAME, stringifyExe, database);
	FS.virtual[stringifyExe] = exeRecord;


	if(FS.virtual[stringifyExe]
		// TODO: compare LATEST input and output mtime
		&& !forceChanged
	)
	{
		console.log(stringifyExe + " already up to date...");
		return;
	}

	console.log(`LD: ${stringifyExe}`);

	try
	{
		await api.link({
			LDFLAGS: [
				...toolLdFlags,
				CONFIGURATION + '/stringify.o',
				'-o', stringifyExe,
				...includeFlags
			],
			obj: [CONFIGURATION + '/stringify.o'],
			database,
			wasm: stringifyExe
		});
	} catch(e)
	{

		console.log(`Link error in stringify\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
	}



}

function mkdirp(path, database)
{

	// Ensure we have a clean array of directory segments
	// Filter(Boolean) removes empty strings from leading/double slashes
	const parts = path.split('/').filter(Boolean);

	// Track where we are in the tree
	// Start with an empty string or '.' to signify relative to root
	let accumulated = "";
	let previousPath = "";

	for(const part of parts)
	{
		accumulated = accumulated === "" ? part : `${accumulated}/${part}`;

		try
		{
			let hadnt = !FS.virtual[accumulated] || FS.virtual[accumulated].default === true;
			if(hadnt)
				FS.virtual[accumulated] = {
					timestamp: new Date(),
					mode: FS_DIR,
					size: 4096,
					path: accumulated,
					parent: accumulated.substring(0, accumulated.lastIndexOf('/'))
				};
			FS.virtual[accumulated + '/.'] = FS.virtual[accumulated];
			if(previousPath)
				FS.virtual[accumulated + '/..'] = FS.virtual[previousPath];
			if(database && hadnt) // TODO: good for checking build times?
				putRecord(DB_STORE_NAME, FS.virtual[accumulated], database);
			if(FS.virtual[accumulated].default)
			{
				FS.virtual[accumulated].default = false;
			}
		} catch(e)
		{
			// Log only if it's a real crash, not just an "already exists" error
			if(!e.message.includes("exists"))
			{
				console.warn(`mkdirp segment failed: ${accumulated}`, e);
			}
		}

		try
		{
			if(api.memfs)
			{
				api.memfs.mem.check();
				api.memfs.mkdirp(accumulated);
			}
		} catch(e) { console.log(`${e.message}\n\r${e.stack || e.stacktrace}`); }
	}
}


const loadedDirectories = [];

async function prepInputOutput(file, obj, database, makeDirs = false)
{
	const parts = database.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	let buildDir = file.substring(0, file.lastIndexOf('/'));
	let outDir;
	if(obj)
		outDir = obj.substring(0, obj.lastIndexOf('/'));


	if(makeDirs && !FS.virtual[config.TEMPDIR])
		mkdirp(config.TEMPDIR, database);
	if(makeDirs && !FS.virtual[config.HOMEDIR])
		mkdirp(config.HOMEDIR, database);

	if(api.memfs)
	{
		await api.ready;
		api.memfs.mem.check();
		try
		{
			api.memfs.mkdirp(config.TEMPDIR);
		} catch(e) { console.log(`${e.message}\n\r${e.stack || e.stacktrace}`); }
		try
		{
			api.memfs.mkdirp(config.HOMEDIR);
		} catch(e) { console.log(`${e.message}\n\r${e.stack || e.stacktrace}`); }

		try
		{
			if(makeDirs)
				api.memfs.mkdirp(buildDir);
		} catch(e) { console.log(`${e.message}\n\r${e.stack || e.stacktrace}`); }
		try
		{
			if(makeDirs && outDir)
				api.memfs.mkdirp(outDir);
		} catch(e) { console.log(`${e.message}\n\r${e.stack || e.stacktrace}`); }
	}

	if(!FS.virtual[file]
		|| (FS.virtual[file] >> 12) !== ST_DIR
		&& (!FS.virtual[file].contents
			|| FS.virtual[file].contents.length === 0)
	)
	{
		if(!loadedDirectories.includes(buildDir) && makeDirs)
		{
			console.log(`Loading index (${api.worker ? 'frontend' : 'worker'}): ${buildDir}`);
			loadedDirectories.push(buildDir);
			if(makeDirs)
				mkdirp(buildDir, database);
			let currentDir = await queryIndex(DB_STORE_NAME, 'parent', buildDir, null, null, database);
			for(let r of currentDir)
				FS.virtual[r.path] = r;
		}

		// TODO!!!!! check if commit has changed or file has changed on disk
		if((!FS.virtual[file] || !FS.virtual[file].contents || FS.virtual[file].contents.length === 0) && makeDirs /* only load github if its a controlled file */)
		{
			console.log(`Loading IDB/Github (${api.worker ? 'frontend' : 'worker'}): ${file}`);
			await cacheFile(ownerName, repoName, file, null, makeDirs);
		}

		if(FS.virtual[file] && (FS.virtual[file].mode >> 12) === ST_FILE)
		{
			if(api.memfs)
			{
				if(!api.memfs.exists(file))
				{
					api.memfs.mem.check;
					api.memfs.addFile(file, FS.virtual[file].contents);
				} else
					console.log(`Already have from query (${api.worker ? 'frontend' : 'worker'}): ${file}`);
			}
		}
		// else if (makeDirs) {
		//    debugger
		//}

	} else
	{
		if(api.memfs)
		{
			if((FS.virtual[file].mode >> 12) === ST_DIR)
			{
				api.memfs.addDirectory(file);
			}
			else
			{
				//api.memfs.mem.check
				api.memfs.addFile(file, FS.virtual[file].contents);
			}
		}
		console.log(`Already have contents (${api.worker ? 'frontend' : 'worker'}): ${file}`);
	}

	try
	{
		if(api.memfs && makeDirs && FS.virtual[file] && FS.virtual[file].contents)
		{
			if((FS.virtual[file].mode >> 12) === ST_DIR)
			{
				api.memfs.addDirectory(file);
			}
			else
			{
				api.memfs.mem.check;
				api.memfs.addFile(file, FS.virtual[file].contents);
			}
		}
	} catch(e)
	{
		console.log(`(${api.worker ? 'frontend' : 'worker'}) ${e.message}\n\r${e.stack || e.stacktrace}`);
	}

	if(!obj) return;

	if(!FS.virtual[obj])
	{
		if(!loadedDirectories.includes(outDir) && makeDirs)
		{
			console.log(`Loading index output (${api.worker ? 'frontend' : 'worker'}): ${outDir}`);
			if(makeDirs)
				mkdirp(outDir, database);
			let currentDir = await queryIndex(DB_STORE_NAME, 'parent', outDir, null, null, database);
			for(let r of currentDir)
				FS.virtual[r.path] = r;
			loadedDirectories.push(outDir);
		}

		// don't load object files from github
		if(!FS.virtual[obj])
		{
			console.log(`Loading IDB output (${api.worker ? 'frontend' : 'worker'}): ${obj}`);
			FS.virtual[obj] = await getRecord(DB_STORE_NAME, obj, database);
		} else
		{
			console.log(`Already have object (${api.worker ? 'frontend' : 'worker'}): ${file}`);
		}
		//if (api.memfs && !api.memfs.exists(obj) && FS.virtual[file])
		//    api.memfs.addFile(obj, FS.virtual[obj].contents)
	}

}




let building = false;
let buildDebounce = null;

async function buildClient(database = null, forceChanged = false, noLinking = false, noBounce = false)
{

	if(buildDebounce)
	{
		clearTimeout(buildDebounce);
	}

	if(!noBounce)
	{
		buildDebounce = setTimeout(() => buildClient(database, forceChanged, noLinking, true), 500);
		return;
	}

	if(building) return;
	building = true;


	try
	{

		// TODO: publish binaryen zero-filled, zip, download uri


		if(!api.github_token)
			return alert("Must enter Github token first by clicking the doorway on the left.");


		const output = [
			`Building ${config.CNAME} for ${COMPILE_PLATFORM} (${COMPILE_ARCH})`,
			`Flags: ${getBaseFlags().join(' ')}`,
			`Total source files mapped: ${[...allCompileObjects].length}`
		];

		output.forEach(line =>
		{
			console.log(line);
		});



		let DEBUG_CFLAGS = BUILDCFLAGS();

		if(!database) database = api.database;
		const parts = database.split('/');
		const ownerName = parts.length == 2 ? parts[0] : owner.value;
		const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

		let CONFIGURATION = api.configuration == 'release'
			? dirs.ENGINE_RELEASE
			: dirs.ENGINE_DEBUG;


		if(TERMINATE) return;

		if(needsHeaders)
		{

			await downloadHeaders(q3eCommonHeaders, 10, database);
		}

		if(TERMINATE) return;



		await buildStringify(database);

		let hasChanged = false;

		//let buildDirectory = []

		for(let file of [...allCompileObjects])
		{

			if(TERMINATE) return;


			try
			{



				let obj = CONFIGURATION + '/' + file.replace('.c', '.o');

				if(!forceChanged)
					await prepInputOutput(file, obj, database, true /* controlled directory */);

				if(FS.virtual[obj]
					// compare input and output mtime
					&& FS.virtual[file]?.timestamp < FS.virtual[obj]?.timestamp
					&& !forceChanged
				)
				{
					console.log(`${obj} already up to date...`);

					continue;
				}

				hasChanged = true;

				console.log(`CC: ${obj}`);

				let CCFLAGS = [
					...CFLAGS,
					...DEBUG_CFLAGS,
					...(api.configuration == 'pre' ? [
						'-o', obj.replace('.o', '.a')
					] : ['-o', obj]),
					file
				];
				if(file.includes('botlib'))
					CCFLAGS = CCFLAGS.concat('-DBOTLIB=1');



				await api.compile({
					CFLAGS: CCFLAGS,
					contents: FS.virtual[file].contents,
					input: file,
					database,
					obj
				});

			} catch(e)
			{

				console.log(`Build error in client: ${file}\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
			}

		}

		let shadersChanged = await buildShaders(database, forceChanged);
		hasChanged = hasChanged || shadersChanged;

		if(!noLinking)
		{
			await linkEngine(database, hasChanged, true);
		}



	} finally
	{
		building = false;

		//await api.download(database)

	}
}





async function linkEngine(database = null, forceChanged = true, noBuild = false)
{
	if(!database) database = api.database;


	let CONFIGURATION = api.configuration == 'release'
		? dirs.ENGINE_RELEASE
		: dirs.ENGINE_DEBUG;




	let clientObjs = allCompileObjects.map(s => CONFIGURATION + '/' + s.replace('.c', '.o'));
	let renderObjs = allRend2ShaderObjects.map(s => CONFIGURATION + '/' + s.replace('.glsl', '.o'));

	if(!noBuild)
	{
		await buildClient(database, false, true /* prevent recursion */, true /* no bouncing because we're waiting */);
	}


	let engineExe = CONFIGURATION + '/' + config.CNAME + config.BINEXT;

	let exeRecord = await getRecord(DB_STORE_NAME, engineExe, database);
	FS.virtual[engineExe] = exeRecord;


	if(FS.virtual[engineExe]
		// TODO: compare LATEST input and output mtime
		&& !forceChanged
	)
	{
		console.log(engineExe + " already up to date...");
		return;
	}

	console.log(`LD: ${engineExe}`);


	try
	{
		await api.link({
			LDFLAGS: [
				...LDFLAGS,
				...clientObjs,
				...renderObjs,
				'-o', engineExe,
				...includeFlags
			],
			obj: [
				...clientObjs,
				...renderObjs
			],
			database,
			wasm: engineExe
		});
	} catch(e)
	{
		console.log(`Link error in client\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
	}


}



async function buildShaders(database = null, forceChanged = false)
{

	if(!database) database = api.database;
	const parts = database.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	if(needsHeaders)
	{

		await downloadHeaders(q3eCommonHeaders, 10, database);
	}

	let CONFIGURATION = api.configuration == 'release'
		? dirs.ENGINE_RELEASE
		: dirs.ENGINE_DEBUG;




	let DEBUG_CFLAGS = BUILDCFLAGS();

	let hasChanged = false;

	for(let shader of allRend2ShaderObjects)
	{



		if(TERMINATE) return;

		try
		{
			// TODO: run stringify?

			let obj = CONFIGURATION + '/' + shader.replace('.glsl', '.o');

			if(!forceChanged) // because we'll create it anyways so don't load it here
				await prepInputOutput(shader, obj, database, true /* controlled paths */);

			if(FS.virtual[obj]
				&& FS.virtual[shader]?.timestamp < FS.virtual[obj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(`${obj} already up to date...`);

				continue;
			}

			console.log(`GLSL: ${obj}`);

			const cCode = generateFallbackC(shader, FS.virtual[shader].contents);

			let hasChanged = true;

			console.log(`CC: ${shader}`);

			await api.compile({
				CFLAGS: [
					...CFLAGS,
					...DEBUG_CFLAGS,
					'-o', obj,
					shader.replace('.glsl', '.c')
				],
				contents: cCode,
				input: shader.replace('.glsl', '.c'),
				database,
				obj
			});

		} catch(e)
		{
			console.log(`Build error in shaders: ${shader}\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
		}
	}


	return hasChanged;
}



async function downloadHeaders(headers, batchSize = HEADER_BATCH, database = null)
{
	if(!database)
		database = api.database;
	const parts = database.split('/');
	const ownerName = parts.length == 2 ? parts[0] : owner.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value;

	// Process in chunks to avoid slamming the network/API
	for(let i = 0; i < headers.length; i += batchSize)
	{
		const batch = headers.slice(i, i + batchSize);

		if(TERMINATE) return;

		for(let j = 0; j < batch.length; j++)
		{

			if(TERMINATE) return;

			let header = batch[j];
			//await Promise.all(batch.map(async (header) => {
			try
			{
				let thisDatabase = database;
				let thisOwner = ownerName;
				let thisRepo = repoName;
				if(header.includes('wasm.syms'))
				{
					let localName = 'components/compiler/wasm.syms';
					//let response = await fetch('wasm.syms');
					//let contents = await response.arrayBuffer()
					if(!files['briancullinan2/quedit'])
					{
						await loadGitHubTree('briancullinan2', 'quedit', 'main');
					}
					await cacheFile('briancullinan2', 'quedit', localName);
					if(!FS.virtual[localName])
					{
						debugger;
						console.error('Goddamnit you suck at programming.');
					}
					FS.virtual[header] =
					{
						timestamp: new Date(),
						mode: FS_FILE,
						contents: FS.virtual[localName].contents,
						path: header,
						sha: FS.virtual[localName].sha,
						parent: header.substring(0, header.lastIndexOf('/'))

					};
					await putRecord(DB_STORE_NAME, FS.virtual[header], thisDatabase);
				}
				else
				{
					if(!files[thisDatabase])
					{
						let branch = await getDefaultBranch(thisOwner, thisRepo);
						await loadGitHubTree(thisOwner, thisRepo, branch);
					}

					if(files[thisDatabase][header])
					{
						// cacheFile handles the storage logic
						let sha = files[thisDatabase][header].sha;
						await cacheFile(thisOwner, thisRepo, header, sha);
					}

				}



				await api.header(thisOwner, thisRepo, header, thisDatabase);
			} catch(e)
			{


				console.log(`Failed to download header ${header}: ` + e + '\n\r' + (e.stack || e.stacktrace));
			}
		}

		//));



		console.log(`Finished batch ${Math.ceil((i + batchSize) / batchSize)}`);
	}


	needsHeaders = false;
}


/*
const ST_FILE = 8
const ST_DIR = 4
const FS_DEFAULT = (6 << 3) + (6 << 6) + (6)
const FS_FILE = (ST_FILE << 12) + FS_DEFAULT
const FS_DIR = (ST_DIR << 12) + FS_DEFAULT

const FS = {
	virtual: {},
}
*/

function loadEntry(cursor)
{
	if(!cursor)
	{
		return resolve();
	}
	if(cursor.path.endsWith('default.cfg'))
	{
		FS.hadDefault = cursor.path;
	}
	// already exists on filesystem,
	//   it must have come with page
	if(FS.virtual[cursor.path]
		&& FS.virtual[cursor.path].timestamp
		> cursor.timestamp)
	{
		// embedded file is newer, start with that
		return;
	}


	console.log('Loading: ' + cursor.path);

	FS.virtual[cursor.path] = {
		timestamp: cursor.timestamp,
		mode: cursor.mode,
		contents: cursor.contents,
		path: cursor.path,
		sha: cursor.sha,
		parent: cursor.parent,
	};
}

