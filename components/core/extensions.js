
// Organized by feature/context for easy on-demand loading
const IMPORT_CSS = {
    // Always loaded up front
    core: [
        // INCLUDED in index.html
        //'/boxicons.min.css',
        //'/main.css',
        //'/theme.css'
    ],

    // Loaded dynamically on demand
    terminal: [
        '/components/terminal/xterm.css'
    ],

    paint: [
        '/components/paint/css/alertify.css',
        '/components/paint/css/component.css',
        '/components/paint/css/layout.css',
        // '/components/paint/css/menu.css', // included with page
        '/components/paint/css/popup.css',
        '/components/paint/css/print.css',
        '/components/paint/css/reset.css',
        '/components/paint/css/utility.css',
        '/components/paint/css/theme.css'
    ],

    editor: [], // Handled internally by Ace's DOM-injected themes

    nunu: [
        '/components/map-editor/codemirror.css',
        '/components/map-editor/styles.css'
    ]

};

const IMPORT_JS = {
    // Application Bootstrap / UI Orchestration
    core: [
        '/components/core/preambles.js',
        '/components/editor/annotations.js',
        '/components/core/logging.js',
        //'/jszip.min.js',
        //'/shared.js', trying to do without this? need to run build
        '/components/core/local.js',
        '/components/filelist/iso-git.min.js',
        '/components/filelist/sys_fsgit.js',
        '/components/engine/sys_fs.js', // Core shared filesystem bridge
        '/components/filelist/tree.js',
        '/components/layout/configuration.js',
        '/components/layout/settings.js',
        '/components/layout/toolbar.js',
        '/components/rosetta/binary.js',
        '/components/filelist/github.js',
        '/components/filelist/vfs.js',
        '/components/filelist/layout.js',
        '/components/filelist/load-media.js',
        '/components/filelist/filelist.js',
        //'/unzip.js'
    ],

    // Virtual Terminal Environment
    terminal: [
        '/components/terminal/xterm.js',
        '/components/terminal/search.js',
        '/components/terminal/history.js',
        '/components/terminal/utilities.js',
        '/components/terminal/render.js',
        '/components/terminal/commands.js',
        '/components/terminal/terminal.js',
        '/components/terminal/events.js',
    ],

    // Code Workspace
    editor: [
        '/ace/ace-noconflict.js',
        '/components/editor/core.js',
        '/components/editor/editor.js',
        '/components/editor/events.js',
    ],

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

    // Image Editor Canvas
    paint: [
        '/components/paint/paint.js',
        '/components/paint/utilities.js',
    ],


    nunu: [
        '/components/map-editor/codemirror.js',
        '/components/map-editor/bundle.js',
        '/components/map-editor/acorn.js',
        '/components/map-editor/tern.js',
        '/components/map-editor/jshint.js',
        '/components/map-editor/draco_encoder.js',
        //'/components/map-editor/Q3BSPLoader.js'
    ]
};

const IMPORT_MODULES = {
    core: {
        js: IMPORT_JS['core'],
        onLoad: onLoadCore
    },

    terminal: {
        panelId: 'terminal-container',
        css: IMPORT_CSS['terminal'],
        js: IMPORT_JS['terminal'],
        onLoad: onLoadTerminal,
        onUnload: onUnloadTerminal
    },

    editor: {
        panelId: 'editor',
        js: IMPORT_JS['editor'],
        // Dynamic SHA tracking for modifications
        onLoad: onLoadEditor,
        hasChanges: hasChangedEditor
    },

    build: {
        js: IMPORT_JS['build'],
        hasChanges: hasChangesBuilder
    },

    quake3e: {
        panelId: 'viewport-frame',
        js: IMPORT_JS['quake3e'],
        onLoad: onLoadEngine
    },

    toji: {
        panelId: 'viewport-frame',
        js: IMPORT_JS['toji'],
        onLoad: onLoadToji
    },

    paint: {
        panelId: 'paint-container',
        css: IMPORT_CSS['paint'],
        js: IMPORT_JS['paint'],
        onLoad: onLoadPaint,
        hasChanges: hasChangesPaint
    },

    
    nunu: {
        panelId: 'nunu',
        js: IMPORT_JS['nunu'],
        css: IMPORT_CSS['nunu'],
        onLoad: () => {}
    },
};

