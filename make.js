/**
 * Quake3e Build Configuration Script
 * Ported from Unix Makefile
 */

const os = require('os');
const path = require('path');

// --- Platform & Architecture Detection ---
const COMPILE_PLATFORM = os.platform() === 'win32' ? 'mingw32' : os.platform(); // Adjusting for Quake's logic
const COMPILE_ARCH = os.arch() === 'x64' ? 'x86_64' : (os.arch() === 'ia32' ? 'x86' : os.arch());

const config = {
    // Build Options
    BUILD_CLIENT: 1,
    BUILD_SERVER: 1,
    
    // Feature Toggles
    USE_SDL: 1,
    USE_CURL: 1,
    USE_LOCAL_HEADERS: 0,
    USE_SYSTEM_JPEG: 0,
    USE_OGG_VORBIS: 1,
    
    // Renderers
    USE_VULKAN: 0,
    USE_OPENGL: 1,
    USE_OPENGL2: 0,
    RENDERER_DEFAULT: "opengl",
    
    // Names
    CNAME: "quake3e",
    DNAME: "quake3e.ded",
    
    // Paths
    MOUNT_DIR: "code",
    BUILD_DIR: "build",
};

// --- Directory Mapping ---
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

// --- Object File Lists (The "Q3OBJ" Mapping) ---
// This replicates the file structure for the linker
const clientObjects = [
    "cl_cgame.c", "cl_cin.c", "cl_console.c", "cl_input.c", 
    "cl_keys.c", "cl_main.c", "cl_net_chan.c", "cl_parse.c", 
    "cl_scrn.c", "cl_ui.c", "cl_avi.c", "cl_jpeg.c"
].map(file => path.join(dirs.CDIR, file));

const commonObjects = [
    "cm_load.c", "cm_patch.c", "cm_polylib.c", "cm_test.c", "cm_trace.c",
    "cmd.c", "common.c", "cvar.c", "files.c", "md4.c", "md5.c", "msg.c"
].map(file => path.join(dirs.CMDIR, file));

// --- CFLAGS Generation ---
function getBaseFlags() {
    let flags = ["-Wall", "-Wimplicit", "-Wstrict-prototypes"];
    
    if (config.USE_SYSTEM_JPEG) flags.push("-DUSE_SYSTEM_JPEG");
    if (config.USE_CURL) flags.push("-DUSE_CURL");
    if (config.USE_VULKAN) flags.push("-DUSE_VULKAN_API");
    
    // Emscripten/Wasm specific flags often added here
    if (COMPILE_PLATFORM === 'emscripten') {
        flags.push("-s USE_SDL=2", "-s ALLOW_MEMORY_GROWTH=1");
    }

    return flags;
}

// --- Execution Logic ---
function build() {
    console.log(`Building ${config.CNAME} for ${COMPILE_PLATFORM} (${COMPILE_ARCH})`);
    console.log(`Flags: ${getBaseFlags().join(' ')}`);
    
    const allFilesToCompile = [...clientObjects, ...commonObjects];
    
    console.log(`Total source files mapped: ${allFilesToCompile.length}`);
    
    // In a real Node build script, you would spawn your compiler here:
    // const { execSync } = require('child_process');
    // allFilesToCompile.forEach(file => execSync(`clang ${getBaseFlags().join(' ')} -c ${file}`));
}
