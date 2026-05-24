
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
        '/xterm.css'
    ],

    paint: [
        '/paint-css/alertify.css',
        '/paint-css/component.css',
        '/paint-css/layout.css',
        // '/paint-css/menu.css', // included with page
        '/paint-css/popup.css',
        '/paint-css/print.css',
        '/paint-css/reset.css',
        '/paint-css/utility.css',
        '/paint-css/theme.css'
    ],

    editor: [] // Handled internally by Ace's DOM-injected themes
};

const IMPORT_JS = {
    // Application Bootstrap / UI Orchestration
    core: [
        '/preambles.js',
        '/annotations.js',
        '/logging.js',
        //'/jszip.min.js',
        //'/shared.js', trying to do without this? need to run build
        '/local.js',
        '/sys_fs.js', // Core shared filesystem bridge
        '/tree.js',
        '/compiler.js',
        '/configuration.js',
        '/settings.js',
        '/toolbar.js',
        '/binary.js',
        '/github.js',
        '/filelist.js',
        //'/unzip.js'
    ],

    // Virtual Terminal Environment
    terminal: [
        '/xterm.js',
        '/commands.js',
        '/terminal.js'
    ],

    // Code Workspace
    editor: [
        '/ace/ace.js',
        '/editor.js'
    ],

    // Local QVM Compiler / Build Toolchain (Matches your Worker imports)
    build: [
        '/shared.js',
        '/local.js',
        '/sys_fs.js',
        '/make.js',
        '/make-tools.js',
        '/make-qvm.js',
    ],

    toji: [
        // Subsystem Shims & Math Matrices
        '/js/util/webxr-polyfill.min.js',
        '/js/util/game-shim.js',
        '/js/util/gl-matrix-min.js',
        '/js/util/stats.min.js',
        '/js/basis/basis-basics.js',

        // WebGL Renderer Core & Engine Logic
        '/js/main.js',
        '/js/q3bsp.js',
        '/js/q3shader.js',
        '/js/q3glshader.js',
        '/js/q3movement.js'
    ],

    // Quake 3 WebGL & Native WASM Runtime Subsystems
    quake3e: [

        // Low-Level WASM / Native Execution Layer
        '/nipplejs.js',
        '/sys_emgl.js',
        '/sys_in.js',
        '/sys_net.js',
        '/sys_std.js',
        '/sys_web.js',
        '/sys_snd.js',
        '/sys_wasm.js',

    ],

    // Image Editor Canvas
    paint: [
        '/paint.js'
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
    }
};

