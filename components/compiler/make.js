
// @ts-check

/** @type {import('./make.d').MakeQVMWindow} */
const makeSelf = /** @type {any} */ (self);


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
].map(file => makeSelf.path.join(makeSelf.dirs.CDIR, file));

// Collision Manager
const collisionObjects = [
	"cm_load.c", "cm_patch.c", "cm_polylib.c",
	"cm_test.c", "cm_trace.c"
].map(file => makeSelf.path.join(makeSelf.dirs.CMDIR, file));

// QCommon / Shared
const commonObjects = [
	"cmd.c", "common.c", "cvar.c", "files.c", "history.c",
	"keys.c", "md4.c", "md5.c", "msg.c", "net_chan.c",
	"net_ip.c", "huffman.c", "huffman_static.c", "splines.c",
	"q_math.c", "q_shared.c", "unzip.c", "puff.c"
].map(file => makeSelf.path.join(makeSelf.dirs.CMDIR, file));

// Sound System
const soundObjects = [
	"snd_adpcm.c", "snd_dma.c", "snd_mem.c", "snd_mix.c",
	"snd_wavelet.c", "snd_main.c", "snd_codec.c", "snd_codec_wav.c"
].map(file => makeSelf.path.join(makeSelf.dirs.CDIR, file));

// Server
const serverObjects = [
	"sv_bot.c", "sv_bsp_mini.c", "sv_ccmds.c", "sv_client.c",
	"sv_filter.c", "sv_game.c", "sv_init.c", "sv_main.c",
	"sv_net_chan.c", "sv_snapshot.c", "sv_teleport.c", "sv_world.c"
].map(file => makeSelf.path.join(makeSelf.dirs.SDIR, file));

// Virtual Machine
const vmObjects = [
	"vm.c", "vm_interpreted.c"
].map(file => makeSelf.path.join(makeSelf.dirs.CMDIR, file));

// Bot Engine / AI (AAS)
const botObjects = [
	"be_aas_bspq3.c", "be_aas_cluster.c", "be_aas_debug.c",
	"be_aas_entity.c", "be_aas_file.c", "be_aas_main.c",
	"be_aas_move.c", "be_aas_optimize.c", "be_aas_reach.c",
	"be_aas_route.c", "be_aas_routealt.c", "be_aas_sample.c",
	"be_ai_char.c", "be_ai_chat.c", "be_ai_gen.c",
	"be_ai_goal.c", "be_ai_move.c", "be_ai_weap.c",
	"be_ai_weight.c", "be_ea.c", "be_interface.c"
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));

// Internal Libraries (L_)
const libObjects = [
	"l_crc.c", "l_libvar.c", "l_log.c", "l_memory.c",
	"l_precomp.c", "l_script.c", "l_struct.c"
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));


const sysObjects = [
	"sys_main.c",
	"dlmalloc.c",
	"sbrk.c",
	//"stack_ops.c",
].map(file => makeSelf.path.join(makeSelf.dirs.WASMDIR, file));

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
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, "glsl", file));

// Lighting & Fog
const shaderLightObjects = [
	"dlight_fp.glsl", "dlight_vp.glsl",
	"lightall_fp.glsl", "lightall_vp.glsl",
	"fogpass_fp.glsl", "fogpass_vp.glsl"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, "glsl", file));

// Post-Processing (Bloom/Bokeh/Tone)
const shaderPostProcessObjects = [
	"bokeh_fp.glsl", "bokeh_vp.glsl",
	"tonemap_fp.glsl", "tonemap_vp.glsl",
	"ssao_fp.glsl", "ssao_vp.glsl",
	"depthblur_fp.glsl", "depthblur_vp.glsl"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, "glsl", file));

// Scaling & Downsampling
const shaderScaleObjects = [
	"calclevels4x_fp.glsl", "calclevels4x_vp.glsl",
	"down4x_fp.glsl", "down4x_vp.glsl"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, "glsl", file));

// Generic & Utilities
const shaderUtilityObjects = [
	"generic_fp.glsl", "generic_vp.glsl",
	"texturecolor_fp.glsl", "texturecolor_vp.glsl"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, "glsl", file));

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
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, file));

// Core Pipeline & Backend
const rendererCoreObjects = [
	"tr_backend.c", "tr_cmds.c", "tr_main.c",
	"tr_init.c", "tr_scene.c", "tr_shade.c",
	"tr_shade_calc.c", "tr_shader.c"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, file));

// Buffers & Extensions (GL specific)
const rendererGLObjects = [
	"tr_dsa.c", "tr_extensions.c", "tr_fbo.c",
	"tr_glsl.c", "tr_vbo.c"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, file));

// Effects & Lighting
const rendererEffectObjects = [
	"tr_extramath.c", "tr_flares.c",
	"tr_light.c", "tr_marks.c",
	"tr_postprocess.c", "tr_shadows.c", "tr_sky.c"
].map(file => makeSelf.path.join(makeSelf.dirs.R2DIR, file));

// Shared Render Files
const rendererCommon = [
	"tr_font.c", "tr_noise.c", "tr_manipulation.c",
	"tr_image_tga.c"
].map(file => makeSelf.path.join(makeSelf.dirs.RCDIR, file));

// Shared dependencies (used if USE_RENDERER_DLOPEN is true)
const rendererSharedObjects = [
	"q_shared.c", "puff.c", "q_math.c"
].map(file => makeSelf.path.join(makeSelf.dirs.CMDIR, file));

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
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));

// AAS (Area Awareness System) Internal Headers
const aasInternalHeaders = [
	"be_aas_cluster.h", "be_aas_debug.h", "be_aas_entity.h",
	"be_aas_file.h", "be_aas_main.h", "be_aas_move.h",
	"be_aas_optimize.h", "be_aas_reach.h", "be_aas_route.h",
	"be_aas_routealt.h", "be_aas_sample.h"
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));

// AI / Behavior Engine Headers
const botAIHeaders = [
	"be_ai_char.h", "be_ai_chat.h", "be_ai_gen.h",
	"be_ai_goal.h", "be_ai_move.h", "be_ai_weap.h",
	"be_ai_weight.h", "be_ea.h", "be_interface.h"
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));

// Botlib Library Utilities (L_)
const botLibUtilsHeaders = [
	"l_crc.h", "l_libvar.h", "l_log.h", "l_memory.h",
	"l_precomp.h", "l_script.h", "l_struct.h", "l_utils.h"
].map(file => makeSelf.path.join(makeSelf.dirs.BLIBDIR, file));

// Combined for easy reference
const allBotlibHeaders = [
	...botlibCoreHeaders,
	...aasInternalHeaders,
	...botAIHeaders,
	...botLibUtilsHeaders
];


makeSelf.q3eCommonHeaders = [

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
].map(file => makeSelf.path.join(makeSelf.config.MOUNT_DIR, file))
	// --- BotLib ---
	.concat(allBotlibHeaders);

function getBaseFlags()
{
	let flags = ["-Wall", "-Wimplicit", "-Wstrict-prototypes"];

	if(makeSelf.config.USE_SYSTEM_JPEG) flags.push("-DUSE_SYSTEM_JPEG");
	if(makeSelf.config.USE_CURL) flags.push("-DUSE_CURL");

	// Web-specific requirements
	//if(COMPILE_PLATFORM === 'emscripten')
	//{
	//	flags.push("-s USE_SDL=2", "-s ALLOW_MEMORY_GROWTH=1", "-s ASSERTIONS=1");
	//}

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
	"--global-base=" + makeSelf.ENGINE_MEMORY_BASE,
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
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_in.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_wasm.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_snd.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_net.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_web.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_fs.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_std.js"),
	"--js-library", makeSelf.path.join(makeSelf.config.MOUNT_DIR, "wasm/sys_emjs.js")
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
makeSelf.undefinedFlags = [
	`--allow-undefined-file=${'code/wasm/wasm.syms'}`
];

makeSelf.includeFlags = [
	'-lc', '-lc++', '-lc++abi'
];

// Final Assembly based on platform
makeSelf.LDFLAGS = [
	...ENGINE_LDFLAGS,
	'lib/wasm32-wasi/crt1.o',
	...wasmPlatformFlags,
	...exportFlags,
	...makeSelf.undefinedFlags
];


/**
 *
 * @param {string} fileName
 * @param {ArrayBuffer | Uint8Array | FileSystemFileHandle} content
 * @returns {Promise<string>}
 */
async function generateFallbackC(fileName, content)
{
	if(content instanceof FileSystemFileHandle)
	{
		content = await (await content.getFile()).arrayBuffer();
	}
	const decoder = new TextDecoder();
	const str = decoder.decode(content);

	// Strip path and extension (basename equivalent)
	const base = fileName.split('/').pop()?.split('.').shift();

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


/**
 *
 * @param {string | null | undefined} CONFIGURATION
 * @returns
 */
function BUILDCFLAGS(CONFIGURATION = null)
{
	if(!CONFIGURATION)
		CONFIGURATION = makeSelf.api?.configuration === 'release'
			? makeSelf.dirs.ENGINE_RELEASE
			: makeSelf.dirs.ENGINE_DEBUG;

	let DEBUG_CFLAGS = makeSelf.api?.configuration != 'debug'
		? ['-DNDEBUG', '-O3', '-ffast-math']
		: ['-DDEBUG', '-D_DEBUG', /* '-g',*/ '-O0'];

	let PRE = makeSelf.api?.configuration === 'pre'
		? ['-E', '-P']
		: makeSelf.api?.configuration === 'analyze'
			? ['--analyze']
			: makeSelf.api?.configuration === 'sanitize'
				? ['-fsanitize=address']
				: [];

	PRE = PRE.concat([
		'-fmessage-length', '' + (makeSelf.api?.width || '80')
	]);

	return [...DEBUG_CFLAGS, ...PRE];
}


makeSelf.BUILDCFLAGS = BUILDCFLAGS;


/**
 * @param {string | null | undefined} database
 **/
async function buildStringify(database = null, forceChanged = false, noLinking = false)
{


	let DEBUG_CFLAGS = BUILDCFLAGS();

	if(!database) database = makeSelf.toolsRepository || makeSelf.api?.database;
	if(!database) return;

	const parts = database?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : makeSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || makeSelf.RepositoryToolbar?.repository?.value;

	if(!ownerName || !repoName) return;

	if(makeSelf.needsHeaders && makeSelf.q3eCommonHeaders)
	{
		await downloadHeaders(makeSelf.q3eCommonHeaders, 10, database);
	}

	let CONFIGURATION = makeSelf.api?.configuration === 'release'
		? makeSelf.dirs.ENGINE_RELEASE
		: makeSelf.dirs.ENGINE_DEBUG;
	//await api.upload(database)

	const stringify = 'code/renderer2/stringify.c';
	const virtualStr = makeSelf.path.join(database, stringify);
	const obj = CONFIGURATION + '/stringify.o';
	const virtualObj = makeSelf.path.join(database, obj);
	const content = await makeSelf.cacheFile?.(makeSelf.DB_STORE_NAME ?? '', ownerName, repoName, stringify);

	if(makeSelf.FS && !makeSelf.FS.virtual[virtualObj] && !forceChanged)
		makeSelf.FS.virtual[virtualObj] = await makeSelf.getRecord?.(makeSelf.DB_STORE_NAME ?? '', obj, database);

	let hasChanged = false;

	if(makeSelf.FS && makeSelf.FS.virtual[virtualObj]
		// compare input and output mtime
		&& makeSelf.FS.virtual[virtualStr]?.timestamp
		&& makeSelf.FS.virtual[virtualObj]?.timestamp
		&& makeSelf.FS.virtual[virtualStr]?.timestamp < makeSelf.FS.virtual[virtualObj]?.timestamp
		&& !forceChanged
	)
	{
		console.log(`${obj} already up to date...`);

		return;
	}

	hasChanged = true;

	try
	{
		await makeSelf.api?.compile?.({
			CFLAGS: [
				'-cc1', '-triple', 'wasm32-wasi',
				'-emit-obj',
				'-isysroot', '/',
				'-internal-isystem', '/include/c++/v1',
				'-internal-isystem', '/include',
				'-internal-isystem', '/lib/clang/8.0.1/include',
				"-std=gnu11",
				...DEBUG_CFLAGS,
				...(makeSelf.api?.configuration === 'pre' ? [
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
		if(e instanceof Error)
		{
			console.error(`${e.message}\n\r${e.stack}`);
		}
	}

	if(!noLinking)
	{
		await linkStringify(database, hasChanged, true);
	}
}

makeSelf.buildStringify = buildStringify;


/**
 * @param {string | null | undefined} database
 **/
async function linkStringify(database = null, forceChanged = false, noBuild = false)
{

	if(!database) database = makeSelf.api?.database;
	if(!database) return;

	let CONFIGURATION = makeSelf.api?.configuration == 'release'
		? makeSelf.dirs.ENGINE_RELEASE
		: makeSelf.dirs.ENGINE_DEBUG;


	if(!noBuild)
	{
		await buildStringify(database, false, true);
	}

	const stringifyExe = CONFIGURATION + '/stringify' + makeSelf.config.BINEXT;
	const virtualStrExe = makeSelf.path.join(database, stringifyExe);

	if(makeSelf.FS)
	{
		makeSelf.FS.virtual[virtualStrExe] = await makeSelf.getRecord?.(makeSelf.DB_STORE_NAME ?? '', stringifyExe, database);
	}


	if(makeSelf.FS?.virtual[virtualStrExe] && !forceChanged)
	{
		console.log(stringifyExe + " already up to date...");
		return;
	}

	console.log(`LD: ${stringifyExe}`);

	try
	{
		await makeSelf.api?.link?.({
			LDFLAGS: [
				...(makeSelf.toolLdFlags ?? []),
				CONFIGURATION + '/stringify.o',
				'-o', stringifyExe,
				...(makeSelf.includeFlags ?? [])
			],
			obj: [CONFIGURATION + '/stringify.o'],
			database,
			wasm: stringifyExe
		});
	} catch(e)
	{
		if(e instanceof Error)
		{
			console.error(`Link error in stringify\n\r${e.message}\n\r${e.stack}`);
		}
	}
}



/**
 *
 * @param {string} path
 * @param {string} database
 */
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
		const virtualAccu = makeSelf.path.join(database, accumulated);

		try
		{
			let hadnt = !makeSelf.FS?.virtual[virtualAccu]; // || makeSelf.FS.virtual[virtualAccu].default === true;
			if(hadnt && makeSelf.FS)
				makeSelf.FS.virtual[virtualAccu] = {
					timestamp: new Date(),
					mode: makeSelf.FS_DIR ?? (0o040000 | 0o755),
					path: accumulated,
					parent: accumulated.substring(0, accumulated.lastIndexOf('/'))
				};
			if(makeSelf.FS)
			{
				makeSelf.FS.virtual[virtualAccu + '/.'] = makeSelf.FS?.virtual[virtualAccu];
			}
			if(previousPath && makeSelf.FS)
				makeSelf.FS.virtual[virtualAccu + '/..'] = makeSelf.FS.virtual[database + '/' + previousPath];
			if(database && hadnt && makeSelf.FS
				&& makeSelf.FS.virtual[virtualAccu])
			{ // TODO: good for checking build times?
				makeSelf.putRecord?.(makeSelf.DB_STORE_NAME ?? '', makeSelf.FS.virtual[virtualAccu], database);
			}
			//if(makeSelf.FS.virtual[virtualAccu].default)
			//{
			//	makeSelf.FS.virtual[virtualAccu].default = false;
			//}
		} catch(e)
		{
			// Log only if it's a real crash, not just an "already exists" error
			if(e instanceof Error && !e.message.includes("exists"))
			{
				console.warn(`mkdirp segment failed: ${accumulated}`, e);
			}
		}

		try
		{
			if(makeSelf.api?.memfs)
			{
				makeSelf.api.memfs.mem.check();
				makeSelf.api.memfs.mkdirp(accumulated);
			}
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}
	}
}


/**
 * @type {string[]}
 */
const loadedDirectories = [];

/**
 *
 * @param {string} file
 * @param {string | null | undefined} obj
 * @param {string | null | undefined} database
 * @param {boolean} makeDirs
 * @returns
 */
async function prepInputOutput(file, obj, database, makeDirs = false)
{
	if(!database) return;

	const parts = database.split('/');
	const ownerName = parts.length == 2 ? parts[0] : makeSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || makeSelf.RepositoryToolbar?.repository?.value;

	if(!ownerName || !repoName) return;

	const virtualFile = makeSelf.path.join(database, file);
	const buildDir = file.substring(0, file.lastIndexOf('/'));


	if(makeDirs && !makeSelf.FS?.virtual[makeSelf.config.TEMPDIR])
		mkdirp(makeSelf.config.TEMPDIR, database);
	if(makeDirs && !makeSelf.FS?.virtual[makeSelf.config.HOMEDIR])
		mkdirp(makeSelf.config.HOMEDIR, database);
	if(makeDirs && !makeSelf.FS?.virtual[database])
		mkdirp(database, database);

	if(makeSelf.api?.memfs)
	{
		await makeSelf.api?.ready;
		makeSelf.api?.memfs.mem.check();
		try
		{
			makeSelf.api.memfs.mkdirp(makeSelf.config.TEMPDIR);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}
		try
		{
			makeSelf.api.memfs.mkdirp(makeSelf.config.HOMEDIR);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}
		try
		{
			if(makeDirs)
				makeSelf.api.memfs.mkdirp(buildDir);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}
	}

	if(makeSelf.FS && !makeSelf.FS.virtual[virtualFile]
		|| (makeSelf.FS && makeSelf.FS.virtual[virtualFile] && makeSelf.FS.virtual[virtualFile].mode >> 12) !== makeSelf.ST_DIR
		&& (!makeSelf.FS?.virtual[virtualFile]?.contents
			|| (makeSelf.FS.virtual[virtualFile].contents instanceof Uint8Array
				&& makeSelf.FS.virtual[virtualFile].contents.length === 0)
			|| (makeSelf.FS.virtual[virtualFile].contents instanceof ArrayBuffer
				&& makeSelf.FS.virtual[virtualFile].contents.byteLength === 0))
	)
	{
		if(!loadedDirectories.includes(buildDir) && makeDirs)
		{
			console.log(`Loading index (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${buildDir}`);
			loadedDirectories.push(buildDir);
			if(makeDirs)
				mkdirp(buildDir, database);
			let currentDir = await makeSelf.queryIndex?.(makeSelf.DB_STORE_NAME ?? '', 'parent', buildDir, null, null, database);
			for(let r of currentDir ?? [])
			{
				if(makeSelf.FS)
				{
					makeSelf.FS.virtual[database + '/' + r.path] = r;
				}
			}
		}

		// TODO!!!!! check if commit has changed or file has changed on disk
		if((makeSelf.FS && !makeSelf.FS.virtual[virtualFile]
			|| !makeSelf.FS?.virtual[virtualFile]?.contents
			|| (makeSelf.FS.virtual[virtualFile].contents instanceof Uint8Array
				&& makeSelf.FS.virtual[virtualFile].contents.length === 0)
			|| (makeSelf.FS.virtual[virtualFile].contents instanceof ArrayBuffer
				&& makeSelf.FS.virtual[virtualFile].contents.byteLength === 0)) && makeDirs /* only load github if its a controlled file */)
		{
			console.log(`Loading IDB/Github (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${file}`);
			await makeSelf.cacheFile?.(makeSelf.DB_STORE_NAME ?? '', ownerName, repoName, file, void 0, makeDirs);
		}

		if(makeSelf.FS?.virtual[virtualFile] && (makeSelf.FS.virtual[virtualFile].mode >> 12) === makeSelf.ST_FILE)
		{
			if(makeSelf.api?.memfs)
			{
				if(!makeSelf.api.memfs.exists(file))
				{
					makeSelf.api.memfs.mem.check;
					makeSelf.api.memfs.addFile(file, makeSelf.FS.virtual[virtualFile].contents);
				} else
					console.log(`Already have from query (${makeSelf.api.worker ? 'frontend' : 'worker'}): ${file}`);
			}
		}
		// else if (makeDirs) {
		//    debugger
		//}

	} else
	{
		if(makeSelf.api?.memfs)
		{
			if(makeSelf.FS && makeSelf.FS.virtual[virtualFile] && (makeSelf.FS.virtual[virtualFile].mode >> 12) === makeSelf.ST_DIR)
			{
				makeSelf.api.memfs.addDirectory(virtualFile);
			}
			else
			{
				//api.memfs.mem.check
				makeSelf.api.memfs.addFile(file, makeSelf.FS?.virtual[virtualFile]?.contents);
			}
		}
		console.log(`Already have contents (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${file}`);
	}

	try
	{
		if(makeSelf.api?.memfs && makeDirs && makeSelf.FS?.virtual[virtualFile] && makeSelf.FS.virtual[virtualFile].contents)
		{
			if((makeSelf.FS.virtual[virtualFile].mode >> 12) === makeSelf.ST_DIR)
			{
				makeSelf.api.memfs.addDirectory(file);
			}
			else
			{
				makeSelf.api.memfs.mem.check;
				makeSelf.api.memfs.addFile(file, makeSelf.FS.virtual[virtualFile].contents);
			}
		}
	} catch(e)
	{
		if(e instanceof Error)
		{
			console.log(`(${makeSelf.api?.worker ? 'frontend' : 'worker'}) ${e.message}\n\r${e.stack}`);
		}
	}

	if(!obj) return;

	const outDir = obj?.substring(0, obj?.lastIndexOf('/'));
	const virtualObj = makeSelf.path.join(database, obj);

	try
	{
		if(makeDirs && outDir)
			makeSelf.api?.memfs.mkdirp(outDir);
	} catch(e)
	{
		if(e instanceof Error)
		{
			console.error(`${e.message}\n\r${e.stack}`);
		}
	}
	if(!makeSelf.FS?.virtual[virtualObj])
	{
		if(!loadedDirectories.includes(outDir) && makeDirs)
		{
			console.log(`Loading index output (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${outDir}`);
			if(makeDirs)
			{
				mkdirp(outDir, database);
			}
			let currentDir = await makeSelf.queryIndex?.(makeSelf.DB_STORE_NAME ?? '', 'parent', outDir, null, null, database);
			for(let r of currentDir ?? [])
			{
				if(makeSelf.FS)
				{
					makeSelf.FS.virtual[database + '/' + r.path] = r;
				}
			}
			loadedDirectories.push(outDir);
		}

		// don't load object files from github
		if(!makeSelf.FS?.virtual[virtualObj])
		{
			console.log(`Loading IDB output (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${obj}`);
			if(makeSelf.FS)
			{
				makeSelf.FS.virtual[virtualObj] = await makeSelf.getRecord?.(makeSelf.DB_STORE_NAME ?? '', obj, database);
			}
		} else
		{
			console.log(`Already have object (${makeSelf.api?.worker ? 'frontend' : 'worker'}): ${file}`);
		}
		//if (api.memfs && !api.memfs.exists(obj) && FS.virtual[file])
		//    api.memfs.addFile(obj, FS.virtual[obj].contents)
	}

}

makeSelf.prepInputOutput = prepInputOutput;


/**
 * @param {string | null | undefined} database
 **/
async function buildClient(database = null, forceChanged = false, noLinking = false, noBounce = false)
{

	if(makeSelf.buildDebounce)
	{
		clearTimeout(makeSelf.buildDebounce);
	}

	if(!noBounce)
	{
		makeSelf.buildDebounce = setTimeout(() => buildClient(database, forceChanged, noLinking, true), 500);
		return;
	}

	if(makeSelf.building) return;
	makeSelf.building = true;


	try
	{

		// TODO: publish binaryen zero-filled, zip, download uri


		if(!makeSelf.api?.github_token)
			return alert("Must enter Github token first by clicking the doorway on the left.");


		const output = [
			`Building ${makeSelf.config.CNAME} for ${makeSelf.COMPILE_PLATFORM} (${makeSelf.COMPILE_ARCH})`,
			`Flags: ${getBaseFlags().join(' ')}`,
			`Total source files mapped: ${[...allCompileObjects].length}`
		];

		output.forEach(line =>
		{
			console.log(line);
		});



		let DEBUG_CFLAGS = BUILDCFLAGS();

		if(!database) database = makeSelf.engineRepository || makeSelf.api?.database;
		if(!database) return;

		let CONFIGURATION = makeSelf.api?.configuration === 'release'
			? makeSelf.dirs.ENGINE_RELEASE
			: makeSelf.dirs.ENGINE_DEBUG;


		if(makeSelf.TERMINATE) return;

		if(makeSelf.needsHeaders && makeSelf.q3eCommonHeaders)
		{

			await downloadHeaders(makeSelf.q3eCommonHeaders, 10, database);
		}

		if(makeSelf.TERMINATE) return;



		await buildStringify(database);

		let hasChanged = false;

		//let buildDirectory = []

		for(let file of [...allCompileObjects])
		{

			if(makeSelf.TERMINATE) return;


			try
			{
				const obj = CONFIGURATION + '/' + file.replace('.c', '.o');
				const virtualFile = makeSelf.path.join(database, file);
				const virtualObj = makeSelf.path.join(database, obj);

				if(!forceChanged)
					await prepInputOutput(file, obj, database, true /* controlled directory */);

				if(makeSelf.FS?.virtual[virtualObj]?.timestamp
					&& makeSelf.FS.virtual[virtualFile]?.timestamp
					// compare input and output mtime
					&& makeSelf.FS.virtual[virtualFile]?.timestamp < makeSelf.FS.virtual[virtualObj]?.timestamp
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
					...(makeSelf.api?.configuration === 'pre' ? [
						'-o', obj.replace('.o', '.a')
					] : ['-o', obj]),
					file
				];
				if(file.includes('botlib'))
					CCFLAGS = CCFLAGS.concat('-DBOTLIB=1');



				await makeSelf.api?.compile?.({
					CFLAGS: CCFLAGS,
					contents: makeSelf.FS?.virtual[virtualFile]?.contents,
					input: file,
					database,
					obj
				});

			} catch(e)
			{
				if(e instanceof Error)
				{
					console.error(`Build error in client: ${file}\n\r${e.message}\n\r${e.stack}`);
				}
			}

		}

		let shadersChanged = await buildShaders(database, forceChanged);
		if(shadersChanged)
		{
			hasChanged = true;
		}

		if(!noLinking)
		{
			await linkEngine(database, hasChanged, true);
		}



	} finally
	{
		makeSelf.building = false;

		//await api.download(database)

	}
}

makeSelf.buildClient = buildClient;



/**
 * @param {string | null | undefined} database
 **/
async function linkEngine(database = null, forceChanged = true, noBuild = false)
{
	if(!database) database = makeSelf.api?.database;
	if(!database) return;


	let CONFIGURATION = makeSelf.api?.configuration === 'release'
		? makeSelf.dirs.ENGINE_RELEASE
		: makeSelf.dirs.ENGINE_DEBUG;




	let clientObjs = allCompileObjects.map(s => CONFIGURATION + '/' + s.replace('.c', '.o'));
	let renderObjs = allRend2ShaderObjects.map(s => CONFIGURATION + '/' + s.replace('.glsl', '.o'));

	if(!noBuild)
	{
		await buildClient(database, false, true /* prevent recursion */, true /* no bouncing because we're waiting */);
	}


	const engineExe = CONFIGURATION + '/' + makeSelf.config.CNAME + makeSelf.config.BINEXT;
	const virtualExe = makeSelf.path.join(database, engineExe);

	if(makeSelf.FS)
	{
		makeSelf.FS.virtual[virtualExe] = await makeSelf.getRecord?.(makeSelf.DB_STORE_NAME ?? '', engineExe, database);
	}


	if(makeSelf.FS?.virtual[virtualExe]
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
		await makeSelf.api?.link?.({
			LDFLAGS: [
				...(makeSelf.LDFLAGS ?? []),
				...clientObjs,
				...renderObjs,
				'-o', engineExe,
				...(makeSelf.includeFlags ?? [])
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
		if(e instanceof Error)
		{
			console.error(`Link error in client\n\r${e.message}\n\r${e.stack}`);
		}
	}
}


makeSelf.linkEngine = linkEngine;


/**
 * @param {string | null | undefined} database
 * @param {boolean} forceChanged
 * @returns {Promise<boolean | void>}
 **/
async function buildShaders(database = null, forceChanged = false)
{

	if(!database) database = makeSelf.engineRepository || makeSelf.api?.database;
	if(!database) return;

	if(makeSelf.needsHeaders && makeSelf.q3eCommonHeaders)
	{

		await downloadHeaders(makeSelf.q3eCommonHeaders, 10, database);
	}

	let CONFIGURATION = makeSelf.api?.configuration === 'release'
		? makeSelf.dirs.ENGINE_RELEASE
		: makeSelf.dirs.ENGINE_DEBUG;




	let DEBUG_CFLAGS = BUILDCFLAGS();

	let hasChanged = false;

	for(let shader of allRend2ShaderObjects)
	{



		if(makeSelf.TERMINATE) return;

		try
		{
			// TODO: run stringify?
			const obj = CONFIGURATION + '/' + shader.replace('.glsl', '.o');
			const virtualShader = makeSelf.path.join(database, shader);
			const virtualObj = makeSelf.path.join(database, obj);

			if(!forceChanged) // because we'll create it anyways so don't load it here
				await prepInputOutput(shader, obj, database, true /* controlled paths */);

			if(makeSelf.FS?.virtual[virtualObj]?.timestamp
				&& makeSelf.FS.virtual[virtualShader]?.timestamp
				&& makeSelf.FS.virtual[virtualShader]?.timestamp < makeSelf.FS.virtual[virtualObj]?.timestamp
				&& !forceChanged
			)
			{
				console.log(`${obj} already up to date...`);

				continue;
			}

			console.log(`GLSL: ${obj}`);

			const contents = makeSelf.FS?.virtual[virtualShader]?.contents;
			const cCode = contents instanceof ArrayBuffer || contents instanceof Uint8Array || contents instanceof FileSystemFileHandle
				? await generateFallbackC(shader, contents) : void 0;
			if(!cCode)
			{
				continue;
			}

			hasChanged = true;

			console.log(`CC: ${shader}`);

			await makeSelf.api?.compile?.({
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
			if(e instanceof Error)
			{
				console.error(`Build error in shaders: ${shader}\n\r${e.message}\n\r${e.stack}`);
			}
		}
	}


	return hasChanged;
}

makeSelf.buildShaders = buildShaders;



/**
 * @param {string[]} headers
 * @param {string | null | undefined} database
 **/
async function downloadHeaders(headers, batchSize = HEADER_BATCH, database = null)
{
	if(!database)
	{
		database = makeSelf.engineRepository || makeSelf.api?.database;
	}
	if(!database)
	{
		return;
	}
	const parts = database?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : makeSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || makeSelf.RepositoryToolbar?.repository?.value;
	if(!ownerName || !repoName)
	{
		return;
	}

	// Process in chunks to avoid slamming the network/API
	for(let i = 0; i < headers.length; i += batchSize)
	{
		const batch = headers.slice(i, i + batchSize);

		if(makeSelf.TERMINATE) return;

		for(let j = 0; j < batch.length; j++)
		{

			if(makeSelf.TERMINATE) return;

			let header = batch[j];
			//await Promise.all(batch.map(async (header) => {
			try
			{
				if(header.includes('wasm.syms'))
				{
					const localName = 'components/compiler/wasm.syms';
					const virtualSyms = makeSelf.path.join('briancullinan2/quedit', localName);
					const virtualHeader = makeSelf.path.join(database, header);
					//let response = await fetch('wasm.syms');
					//let contents = await response.arrayBuffer()
					if(!makeSelf.filesRepo?.['briancullinan2/quedit'])
					{
						await makeSelf.loadGitHubTree?.('briancullinan2', 'quedit', 'main');
					}
					await makeSelf.cacheFile?.(makeSelf.DB_STORE_NAME ?? '', 'briancullinan2', 'quedit', localName);
					if(!makeSelf.FS?.virtual[virtualSyms])
					{
						debugger;
						console.error('Goddamnit you suck at programming.');
					}
					if(makeSelf.FS)
					{
						makeSelf.FS.virtual[virtualHeader] =
						{
							timestamp: new Date(),
							mode: makeSelf.FS_FILE ?? (0o100000 | 0o666),
							contents: makeSelf.FS.virtual[virtualSyms]?.contents,
							path: header,
							sha: makeSelf.FS.virtual[virtualSyms]?.sha,
							parent: header.substring(0, header.lastIndexOf('/'))

						};
					}

					if(makeSelf.FS?.virtual[virtualHeader])
					{
						await makeSelf.putRecord?.(makeSelf.DB_STORE_NAME ?? '', makeSelf.FS.virtual[virtualHeader], database);
					}
				}
				else
				{
					if(!makeSelf.filesRepo?.[database])
					{
						let branch = await makeSelf.getDefaultBranch?.(ownerName, repoName);
						if(branch)
						{
							await makeSelf.loadGitHubTree?.(ownerName, repoName, branch);
						}
					}

					if(makeSelf.filesRepo?.[database]?.[header])
					{
						// cacheFile handles the storage logic
						let sha = makeSelf.filesRepo[database]?.[header].sha;
						await makeSelf.cacheFile?.(makeSelf.DB_STORE_NAME ?? '', ownerName, repoName, header, sha);
					}

				}



				await makeSelf.api?.header?.(ownerName, repoName, header, database);
			} catch(e)
			{
				if(e instanceof Error)
				{
					console.error(`Failed to download header ${header}: ` + e + '\n\r' + (e.stack));
				}
			}
		}

		//));



		console.log(`Finished batch ${Math.ceil((i + batchSize) / batchSize)}`);
	}


	makeSelf.needsHeaders = false;
}

