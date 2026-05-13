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

const GAME_PLATFORM = 'qvm';
const GAME_ARCH = 'bytecode';

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
    BINEXT: `.${COMPILE_ARCH}.${COMPILE_PLATFORM}`,
    TEMPDIR: '/tmp',
    MOD: 'baseq3a'
};

const dirs = {
    ENGINE_DEBUG: path.join(config.BUILD_DIR, `debug-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
    ENGINE_RELEASE: path.join(config.BUILD_DIR, `release-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),

    GAME_DEBUG: path.join(config.BUILD_DIR, `debug-${GAME_PLATFORM}-${GAME_ARCH}`),
    GAME_RELEASE: path.join(config.BUILD_DIR, `release-${GAME_PLATFORM}-${GAME_ARCH}`),

    CGDIR: path.join(config.MOUNT_DIR, "cgame"),
    QADIR: path.join(config.MOUNT_DIR, "game"),
    UIDIR: path.join(config.MOUNT_DIR, "q3_ui"),

    CDIR: path.join(config.MOUNT_DIR, "client"),
    SDIR: path.join(config.MOUNT_DIR, "server"),
    CMDIR: path.join(config.MOUNT_DIR, "qcommon"),
    //R1DIR: path.join(config.MOUNT_DIR, "renderer"),
    R2DIR: path.join(config.MOUNT_DIR, "renderer2"),
    RCDIR: path.join(config.MOUNT_DIR, "renderercommon"),
    //RVDIR: path.join(config.MOUNT_DIR, "renderervk"),
    BLIBDIR: path.join(config.MOUNT_DIR, "botlib"),
    WASMDIR: path.join(config.MOUNT_DIR, "wasm"),
};

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
]


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
    "wasm/setjmp.h",
    "wasm/gl.h",
    "wasm/glext.h",
    "wasm/sys_local.h",
    "wasm/khrplatform.h",
    "wasm/wasm.syms",
    //"sys/sys_local.h",      // System-specific (Win/Linux) low-level stuff
    //"sys/sys_loadlib.h"     // Dynamic library loading
].map(file => path.join(config.MOUNT_DIR, file))
    // --- BotLib ---
    .concat(allBotlibHeaders);

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


// Base LDFLAGS shared across all modules
const baseLdFlags = [
    //"-D__WASM__=1",
    //"--no-standard-libraries",
    '--no-threads',
    "--export-dynamic",
    "--error-limit=200",
    "--import-memory",
    "--import-table",
    '-z', `stack-size=${1024 * 1024}`,
    '-Llib/wasm32-wasi',
    'lib/wasm32-wasi/crt1.o',
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
    "sprintf", "malloc", "free", "stderr", "stdout", "errno", "_start",
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
]

// Final Assembly based on platform
const LDFLAGS = [
    ...baseLdFlags,
    ...wasmPlatformFlags,
    ...exportFlags,
    ...undefinedFlags
];

// For the Shared Libs (Renderer/VMs)
/*
const shLibLdFlags = [
    "--no-entry",
    ...baseLdFlags,
    "--export=malloc",
    "--export=s_knownSfx",
    "--export=stderr",
    "--export=stdout",
    ...undefinedFlags
];
*/
function generateFallbackC(fileName, content) {
    // Strip path and extension (basename equivalent)
    const base = fileName.split('/').pop().split('.').shift();

    let output = `const char *fallbackShader_${base} =\n`;

    const lines = content.split(/\r?\n/);

    lines.forEach(line => {
        // Trim trailing whitespace and escape double quotes
        const trimmed = line.trimEnd().replace(/"/g, '\\"');
        output += `"${trimmed}\\n"\n`;
    });

    output += ";\n";
    return output;
}



function BUILDCFLAGS(CONFIGURATION) {
    if (!CONFIGURATION)
        CONFIGURATION = api.configuration == 'release'
            ? dirs.ENGINE_RELEASE
            : dirs.ENGINE_DEBUG

    let DEBUG_CFLAGS = api.configuration != 'debug'
        ? ['-DNDEBUG', '-O3', '-ffast-math']
        : ['-DDEBUG', '-D_DEBUG', /* '-g',*/ '-O0']

    let PRE = api.configuration == 'pre'
        ? ['-E', '-P']
        : api.configuration == 'analyze'
            ? ['--analyze']
            : api.configuration == 'sanitize'
                ? ['-fsanitize=address']
                : []

    PRE = PRE.concat([
        '-fmessage-length', '' + (api.width || '80')
    ])

    return [...DEBUG_CFLAGS, ...PRE]
}



async function buildStringify(database = null) {


    let DEBUG_CFLAGS = BUILDCFLAGS()

    if (!database) database = api.database
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (needsHeaders) {
        needsHeaders = false
        await downloadHeaders(q3eCommonHeaders, 10, database)
    }

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG
    //await api.upload(database)

    let stringify = 'code/renderer2/stringify.c'
    let sha = files[database][stringify].sha
    let content = await cacheFile(ownerName, repoName, stringify, sha)

    try {
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
                    '-o', CONFIGURATION + '/stringify.a',
                ] : ['-o', CONFIGURATION + '/stringify.o']),
                stringify
            ],
            contents: content,
            input: stringify,
            database,
            obj: CONFIGURATION + '/stringify.o'
        })
    } catch (e) {
        log(e)
    }



    try {
        await api.link({
            LDFLAGS: [
                ...baseLdFlags,
                CONFIGURATION + '/stringify.o',
                '-o', CONFIGURATION + '/stringify' + config.BINEXT,
                ...includeFlags
            ],
            obj: [CONFIGURATION + '/stringify.o'],
            database,
            wasm: CONFIGURATION + '/stringify' + config.BINEXT
        })
    } catch (e) {
        log(e)
    }



}



async function buildClient(database = null) {


    let DEBUG_CFLAGS = BUILDCFLAGS()

    if (!database) database = api.database
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    if (needsHeaders) {
        needsHeaders = false
        await downloadHeaders(q3eCommonHeaders, 10, database)
    }


    for (let file of [...allCompileObjects]) {

        try {
            let sha = files[database][file].sha
            let content = await cacheFile(ownerName, repoName, file, sha)
            let obj = CONFIGURATION + '/' + file.replace('.c', '.o')

            let CCFLAGS = [
                ...CFLAGS,
                ...DEBUG_CFLAGS,
                ...(api.configuration == 'pre' ? [
                    '-o', obj.replace('.o', '.a')
                ] : ['-o', obj]),
                file
            ]
            if (file.includes('botlib'))
                CCFLAGS = CCFLAGS.concat('-DBOTLIB=1')

            log(`CC: ${obj}\n\r`)

            let objRecord = await getRecord(DB_STORE_NAME, obj, database)
            FS.virtual[obj] = objRecord

            if (FS.virtual[obj]
                // compare input and output mtime
                && FS.virtual[file]?.timestamp < FS.virtual[obj]?.timestamp
            ) {
                continue
            }

            await api.compile({
                CFLAGS: CCFLAGS,
                contents: content,
                input: file,
                database,
                obj
            })

        } catch (e) {
            log(e)
        }

    }

}




let building = false
let buildDebounce = null
async function build(database = null, noBounce = false) {

    if (buildDebounce) {
        clearTimeout(buildDebounce)
    }

    if (!noBounce) {
        buildDebounce = setTimeout(() => build(database, true), 500)
        return
    }

    if (building) return
    building = true

    try {

        // TODO: publish binaryen zero-filled, zip, download uri

        if (!database) database = api.database
        let parts = database.split('/')
        let ownerName = parts.length == 2 ? parts[0] : owner.value
        let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value


        if (!api.github_token)
            return alert("Must enter Github token first by clicking the doorway on the left.")


        // Log directly to your xterm.js instance if available
        const output = [
            `Building ${config.CNAME} for ${COMPILE_PLATFORM} (${COMPILE_ARCH})`,
            `Flags: ${getBaseFlags().join(' ')}`,
            `Total source files mapped: ${[...allCompileObjects].length}`
        ];

        output.forEach(line => {
            log(`\x1b[32m[BUILD]\x1b[0m ${line}\r\n`)
        });

        log('\n\r')



        FS.virtual['/home'] = {
            timestamp: new Date(),
            mode: FS_DIR,
            path: '/home'
        }
        await putRecord(DB_STORE_NAME, FS.virtual['/home'], database)
        FS.virtual['/tmp'] = {
            timestamp: new Date(),
            mode: FS_DIR, // ST_DIR + standard permissions
            path: '/tmp'
        };
        await putRecord(DB_STORE_NAME, FS.virtual['/tmp'], database)
        //if(this.memfs && !this.memfs.exists())


        let CONFIGURATION = api.configuration == 'release'
            ? dirs.ENGINE_RELEASE
            : dirs.ENGINE_DEBUG



        await buildStringify(database)


        await buildClient(database)


        await buildShaders(database)


        let clientObjs = allCompileObjects.map(s => CONFIGURATION + '/' + s.replace('.c', '.o'))
        let renderObjs = allRend2ShaderObjects.map(s => CONFIGURATION + '/' + s.replace('.glsl', '.o'))


        try {
            await api.link({
                LDFLAGS: [
                    ...LDFLAGS,
                    ...clientObjs,
                    ...renderObjs,
                    '-o', CONFIGURATION + '/' + config.CNAME + config.BINEXT,
                    ...includeFlags
                ],
                obj: [
                    ...clientObjs,
                    ...renderObjs
                ],
                database,
                wasm: CONFIGURATION + '/' + config.CNAME + config.BINEXT
            })
        } catch (e) {
            log(e)
        }

    } finally {
        building = false

        //await api.download(database)

    }

}



async function buildShaders(database = null) {

    if (!database) database = api.database
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (needsHeaders) {
        needsHeaders = false
        await downloadHeaders(q3eCommonHeaders, 10, database)
    }

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    let DEBUG_CFLAGS = BUILDCFLAGS()


    for (let shader of allRend2ShaderObjects) {
        try {
            let sha = files[database][shader].sha
            let content = await cacheFile(ownerName, repoName, shader, sha)
            const cCode = generateFallbackC(shader, content);
            let obj = CONFIGURATION + '/' + shader.replace('.glsl', '.o')
            log(`GLSL: ${obj}\n\r`)

            let objRecord = await getRecord(DB_STORE_NAME, obj, database)
            FS.virtual[obj] = objRecord


            log(`CC: ${shader}\n\r`);

            if (FS.virtual[obj]
                && FS.virtual[shader]?.timestamp < FS.virtual[obj]?.timestamp
            ) {
                continue
            }
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
            })

        } catch (e) {
            log(e)
        }
    }


}



async function downloadHeaders(headers, batchSize = 10, database = null) {
    if (!database)
        database = api.database
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    // Process in chunks to avoid slamming the network/API
    for (let i = 0; i < headers.length; i += batchSize) {
        const batch = headers.slice(i, i + batchSize);

        await Promise.all(batch.map(async (header) => {
            try {
                let thisDatabase = database
                let thisOwner = ownerName
                let thisRepo = repoName

                if (header.includes('wasm.syms')) {
                    //let response = await fetch('wasm.syms');
                    //let contents = await response.arrayBuffer()
                    if (!files['briancullinan2/quedit'])
                    {
                        await loadGitHubTree('briancullinan2', 'quedit', 'main')
                    }
                    await cacheFile('briancullinan2', 'quedit', 'wasm.syms');
                    FS.virtual[header] =
                    {
                        timestamp: new Date(),
                        mode: FS_FILE,
                        contents: FS.virtual['wasm.syms'].contents,
                        path: header,
                        sha: FS.virtual['wasm.syms'].sha
                        
                    }
                    await putRecord(DB_STORE_NAME, FS.virtual[header], thisDatabase)
                }
                else {
                    if (!files[thisDatabase])
                    {
                        let branch = await getDefaultBranch(thisOwner, thisRepo)
                        await loadGitHubTree(thisOwner, thisRepo, branch)
                    }

                    if (!files[thisDatabase][header]) return
                    // cacheFile handles the storage logic
                    let sha = files[thisDatabase][header].sha
                    await cacheFile(thisOwner, thisRepo, header, sha);

                }

                await api.header(thisOwner, thisRepo, header, thisDatabase)
            } catch (e) {
                log(`Failed to cache ${header}: ` + e + '\n\r' + (e.stack || e.stacktrace));
            }
        }));

        log(`Finished batch ${Math.ceil((i + batchSize) / batchSize)}`);
    }
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

function loadEntry(cursor) {
    if (!cursor) {
        return resolve()
    }
    if (cursor.path.endsWith('default.cfg')) {
        FS.hadDefault = cursor.path
    }
    // already exists on filesystem, 
    //   it must have come with page
    if (FS.virtual[cursor.path]
        && FS.virtual[cursor.path].timestamp
        > cursor.timestamp) {
        // embedded file is newer, start with that
        return
    }
    log('\n\rLoading: ' + cursor.path + '\n\r');

    FS.virtual[cursor.path] = {
        timestamp: cursor.timestamp,
        mode: cursor.mode,
        contents: cursor.contents,
        path: cursor.path,
        sha: cursor.sha
    }
}

