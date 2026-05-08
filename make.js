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

const COMPILE_PLATFORM = 'emscripten'; 
const COMPILE_ARCH = 'wasm';

const config = {
    BUILD_CLIENT: 1,
    BUILD_SERVER: 1,
    USE_SDL: 1,
    USE_CURL: 1,
    USE_LOCAL_HEADERS: 0,
    USE_SYSTEM_JPEG: 0,
    USE_OGG_VORBIS: 1,
    USE_VULKAN: 0,
    USE_OPENGL: 1,
    USE_OPENGL2: 0,
    RENDERER_DEFAULT: "opengl",
    CNAME: "quake3e",
    DNAME: "quake3e.ded",
    MOUNT_DIR: "code",
    BUILD_DIR: "build",
};

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

// replicatng the file structure for the linker
const clientObjects = [
    "cl_cgame.c", "cl_cin.c", "cl_console.c", "cl_input.c", 
    "cl_keys.c", "cl_main.c", "cl_net_chan.c", "cl_parse.c", 
    "cl_scrn.c", "cl_ui.c", "cl_avi.c", "cl_jpeg.c"
].map(file => path.join(dirs.CDIR, file));

const commonObjects = [
    "cm_load.c", "cm_patch.c", "cm_polylib.c", "cm_test.c", "cm_trace.c",
    "cmd.c", "common.c", "cvar.c", "files.c", "md4.c", "md5.c", "msg.c"
].map(file => path.join(dirs.CMDIR, file));

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

function build() {
    // Log directly to your xterm.js instance if available
    const output = [
        `Building ${config.CNAME} for ${COMPILE_PLATFORM} (${COMPILE_ARCH})`,
        `Flags: ${getBaseFlags().join(' ')}`,
        `Total source files mapped: ${[...clientObjects, ...commonObjects].length}`
    ];

    output.forEach(line => {
        if (typeof term !== 'undefined') {
            term.write(`\x1b[32m[BUILD]\x1b[0m ${line}\r\n`);
        } else {
            console.log(line);
        }
    });
}