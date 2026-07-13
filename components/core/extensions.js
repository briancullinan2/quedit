
// Organized by feature/context for easy on-demand loading
const IMPORT_CSS = {

    nunu: [
        '/components/map-editor/codemirror.css',
        '/components/map-editor/styles.css',
        '/components/map-editor/nunu.css',
    ],

    audio: [
        '/components/audio-editor/all.css'
    ]
};

const IMPORT_JS = {


    // Local QVM Compiler / Build Toolchain (Matches your Worker imports)
    build: [
        '/components/compiler/compiler.js',
        '/components/compiler/shared.js',
        '/components/core/local.js',
        '/components/engine/sys_fs.js',
        '/components/compiler/make.js',
        '/components/compiler/make-tools.js',
        '/components/compiler/make-qvm.js',
    ],

    toji: [
        // Subsystem Shims & Math Matrices
        '/components/map-loader/util/webxr-polyfill.min.js',
        '/components/map-loader/util/game-shim.js',
        '/components/map-loader/util/gl-matrix-min.js',
        '/components/map-loader/util/stats.min.js',
        '/components/map-loader/basis/basis-basics.js',

        // WebGL Renderer Core & Engine Logic
        '/components/map-loader/main.js',
        '/components/map-loader/q3bsp.js',
        '/components/map-loader/q3shader.js',
        '/components/map-loader/q3glshader.js',
        '/components/map-loader/q3movement.js'
    ],

    // Quake 3 WebGL & Native WASM Runtime Subsystems
    quake3e: [

        // Low-Level WASM / Native Execution Layer
        '/components/engine/nipplejs.js',
        '/components/engine/sys_emgl.js',
        '/components/engine/sys_in.js',
        '/components/engine/sys_fsq3.js',
        '/components/engine/sys_net.js',
        '/components/engine/sys_std.js',
        '/components/engine/sys_web.js',
        '/components/engine/sys_snd.js',
        '/components/engine/sys_wasm.js',

    ],

    nunu: [
        '/components/map-editor/codemirror.js',
        '/components/map-editor/bundle.js',
        '/components/map-editor/acorn.js',
        '/components/map-editor/tern.js',
        '/components/map-editor/jshint.js',
        '/components/map-editor/draco_encoder.js',
        '/components/map-editor/Q3BSPLoader.js'
    ],

    audio: [
        '/components/audio-editor/all.build.js',
        '/components/audio-editor/audio.js'
    ]
};

