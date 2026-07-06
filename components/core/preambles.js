
const CMD_PREAMBLE = '\x1b[38;5;196m[RUNTIME ERROR]\x1b[0m';
const API_PREAMBLE = '\x1b[38;5;214m[COMPILER]\x1b[0m ';      // Gold/Orange

const TAR_PREAMBLE = '\x1b[38;5;179m[TAR]\x1b[0m ';           // Warm Tan

const GITHUB_PREAMBLE = '\x1b[38;5;27m[GITHUB]\x1b[0m ';      // Deep Brand Blue
const FETCH_PREAMBLE = '\x1b[38;5;39m[FETCH]\x1b[0m ';        // Vivid Cyan
const ERROR_PREAMBLE = '\x1b[38;5;196m[ERROR]\x1b[0m ';       // Intense Crimson Red
const WARN_PREAMBLE = '\x1b[38;5;33m[WARN]\x1b[0m ';
const INFO_PREAMBLE = '\x1b[38;5;36m[INFO]\x1b[0m ';
const LOG_PREAMBLE = '\x1b[38;5;32m[LOG]\x1b[0m ';

const QVM_PREAMBLE = '\x1b[38;5;165m[QVM]\x1b[0m ';           // Electric Magenta
const QVMERR_PREAMBLE = '\x1b[38;5;202m[QVM ERROR]\x1b[0m ';  // Deep Coral Orange

//const BUILD_PREAMBLE = '\x1b[38;5;99m[TOOLS-BUILD]\x1b[0m '; // Soft Lavender
const TOOLERR_PREAMBLE = '\x1b[38;5;203m[TOOL ERROR]\x1b[0m ';      // Bright Coral Red

const API_HEADER_PREAMBLE = '\x1b[38;5;221m[HEADER]\x1b[0m ';    // Amber Yellow (Parsing)
const API_COMPILE_PREAMBLE = '\x1b[38;5;208m[COMPILE]\x1b[0m ';  // Safety Orange (Compiling)
const API_LINK_PREAMBLE = '\x1b[38;5;118m[LINK]\x1b[0m ';        // Neon Lime Green (Success)
const API_RUN_PREAMBLE = '\x1b[38;5;45m[RUN]\x1b[0m ';           // Turquoise (Execution)
const API_BUILD_PREAMBLE = '\x1b[38;5;76m[BUILD]\x1b[0m ';         // Forest Green mix
const API_REMOVE_PREAMBLE = '\x1b[38;5;244m[REMOVE]\x1b[0m ';    // Muted Slate Gray

const BUILD_PREAMBLE = '\x1b[38;5;118m[BUILD]\x1b[0m '; // Matches successful link color

const EDITOR_PREAMBLE = '\x1b[38;5;201m[EDITOR]\x1b[0m ';    // Hot Pink

const UNZIP_PREAMBLE = '\x1b[38;5;134m[UNZIP]\x1b[0m ';      // Orchid Purple

const TOOLS_PREAMBLE = '\x1b[38;5;121m[TOOLS-BUILD]\x1b[0m '
//const TOOLERR_PREAMBLE = '\x1b[38;5;203m[TOOL ERROR]\x1b[0m '
const ENGINE_PREAMBLE = '\x1b[38;5;36m[QUAKE3E]\x1b[0m '

const EXTENSION_TO_MODE = {
    // =====================================================================
    // 1. ACTIVE ANTLR PIPELINE ROUTING LAYER ('antlr_worker')
    // =====================================================================
    'c': 'antlr_worker', 'cc': 'antlr_worker', 'cpp': 'antlr_worker',
    'cxx': 'antlr_worker', 'h': 'antlr_worker', 'hh': 'antlr_worker',
    'hpp': 'antlr_worker', 'hxx': 'antlr_worker', 'i': 'antlr_worker',
    'ino': 'antlr_worker',

    'angelscript': 'antlr_worker', 'lua': 'antlr_worker',

    'wat': 'antlr_worker', 'asm': 'antlr_worker', 's': 'antlr_worker',
    'pdp7': 'antlr_worker',

    'js': 'antlr_worker', 'cjs': 'antlr_worker', 'mjs': 'antlr_worker',
    'jsm': 'antlr_worker', 'ts': 'antlr_worker', 'html': 'antlr_worker',
    'htm': 'antlr_worker', 'xhtml': 'antlr_worker', 'css': 'antlr_worker',
    'json': 'antlr_worker', 'gql': 'antlr_worker', 'graphql': 'antlr_worker',

    'php': 'antlr_worker', 'phtml': 'antlr_worker', 'cs': 'antlr_worker',
    'csx': 'antlr_worker', 'go': 'antlr_worker', 'rs': 'antlr_worker',

    'java': 'antlr_worker', 'py': 'antlr_worker', 'pyw': 'antlr_worker',

    'postgresql': 'antlr_worker', 'pgsql': 'antlr_worker', 'sqlite': 'antlr_worker',
    'plsql': 'antlr_worker', 'tsql': 'antlr_worker', 'mysql': 'antlr_worker',
    'sql': 'antlr_worker',

    'cmakelists.txt': 'antlr_worker',
    'cmake': 'antlr_worker', 'proto': 'antlr_worker', 'toml': 'antlr_worker',
    'xml': 'antlr_worker', 'xsd': 'antlr_worker', 'xsl': 'antlr_worker',
    'csv': 'antlr_worker', 'properties': 'antlr_worker', 'props': 'antlr_worker',
    'terraform': 'antlr_worker',

    // =====================================================================
    // 2. ID TECH 3 / QUAKE DEDICATED ASSET PIPELINE LAYER ('antlr_worker')
    // =====================================================================
    'arena': 'antlr_worker',     // Q3ArenaParser
    'cam': 'antlr_worker',       // Q3CameraParser
    'cfg': 'antlr_worker',       // Q3ConfigParser
    'map': 'antlr_worker',       // Q3MapParser / QuakeMapParser
    'menu': 'antlr_worker',      // Q3MenuParser
    'shader': 'antlr_worker',    // Q3ShaderParser
    'shaderx': 'antlr_worker',   // Q3ShaderParser variant
    'skin': 'antlr_worker',      // Q3SkinParser

    // =====================================================================
    // 3. PRESERVED EXTENSIONS & FALLBACK MODES (UNCOVERED PIPELINES)
    // =====================================================================
    'abap': 'abap',
    'abc': 'abc',
    'ada': 'ada',
    'adb': 'ada',
    'ahk': 'autohotkey',
    'apex': 'apex',
    'applescript': 'applescript',
    'as': 'actionscript',
    'bat': 'batchfile',
    'cbl': 'cobol',
    'cfc': 'coldfusion',
    'cfm': 'coldfusion',
    'cl': 'lisp',
    'clj': 'clojure',
    'cljs': 'clojure',
    'cls': 'apex',
    'cmd': 'batchfile',
    'cob': 'cobol',
    'coffee': 'coffee',
    'conf': 'apache_conf',
    'd': 'd',
    'dart': 'dart',
    'diff': 'diff',
    'dockerfile': 'dockerfile',
    'dot': 'dot',
    'e': 'eiffel',
    'edn': 'clojure',
    'ejs': 'ejs',
    'erl': 'erlang',
    'ex': 'elixir',
    'exs': 'elixir',
    'f': 'fortran',
    'f90': 'fortran',
    'f95': 'fortran',
    'for': 'fortran',
    'forth': 'forth',
    'frag': 'glsl',
    'fs': 'fsharp',
    'fsi': 'fsharp',
    'fsx': 'fsharp',
    'fth': 'forth',
    'ftl': 'freemarker',
    'gcode': 'gcode',
    'gitignore': 'ini',
    'glsl': 'glsl',
    'vlsl': 'glsl',
    'hlsl': 'glsl',
    'groovy': 'groovy',
    'gsh': 'groovy',
    'gvy': 'groovy',
    'gy': 'groovy',
    'haml': 'haml',
    'handlebars': 'handlebars',
    'hbs': 'handlebars',
    'hjson': 'hjson',
    'hrl': 'erlang',
    'hs': 'haskell',
    'htaccess': 'apache_conf',
    'ini': 'ini',
    'jade': 'pug',
    'jl': 'julia',
    'jsp': 'jsp',
    'jsx': 'jsx',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'less': 'less',
    'liquid': 'liquid',
    'lisp': 'lisp',
    'log': 'text',
    'ls': 'livescript',
    'lsp': 'lisp',
    'ltx': 'latex',
    'm': 'matlab',
    'makefile': 'makefile',
    'make': 'makefile',
    'markdown': 'markdown',
    'md': 'markdown',
    'mel': 'mel',
    'mk': 'makefile',
    'ml': 'ocaml',
    'mli': 'ocaml',
    'mm': 'objectivec',
    'nginx': 'nginx',
    'nim': 'nim',
    'nix': 'nix',
    'nsh': 'nsis',
    'nsi': 'nsis',
    'pas': 'pascal',
    'patch': 'diff',
    'perl': 'perl',
    'pig': 'pig',
    'pl': 'perl',
    'pm': 'perl',
    'pp': 'pascal',
    'powershell': 'powershell',
    'prefs': 'ini',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'pug': 'pug',
    'puppet': 'puppet',
    'q': 'q',
    'r': 'r',
    'rb': 'ruby',
    'rdoc': 'rdoc',
    'rhtml': 'ruby',
    'rprofile': 'r',
    'sass': 'sass',
    'sbt': 'scala',
    'scad': 'scad',
    'scala': 'scala',
    'scheme': 'scheme',
    'scm': 'scheme',
    'scss': 'scss',
    'sh': 'sh',
    'sieve': 'sieve',
    'slim': 'slim',
    'smali': 'smali',
    'smarty': 'smarty',
    'ss': 'scheme',
    'styl': 'stylus',
    'svg': 'svg',
    'swift': 'swift',
    'tcl': 'tcl',
    'tex': 'latex',
    'tpl': 'smarty',
    'tsx': 'tsx',
    'twig': 'twig',
    'txt': 'text',
    'wasm': 'wasm_disassembly',
    'qvm': 'qvm_disassembly',
    'v': 'verilog',
    'vala': 'vala',
    'vapi': 'vala',
    'vbe': 'vbscript',
    'vbs': 'vbscript',
    'vert': 'glsl',
    'vh': 'verilog',
    'vhd': 'vhdl',
    'vhdl': 'vhdl',
    'vue': 'vue',
    'yaml': 'yaml',
    'yml': 'yaml',
    'zig': 'zig',
    'zsh': 'sh'
};

function getModeByFilename(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const filenameAsType = filePath.split('/').pop().toLowerCase();
    const modeKey = ((!EXTENSION_TO_MODE[ext] || ext === 'txt') && EXTENSION_TO_MODE[filenameAsType]) ? filenameAsType : ext;
    return `ace/mode/${EXTENSION_TO_MODE[modeKey] || 'text'}`;
}

// Simulating x-mode (verbose regex) by joining an array of strings with comments
const FILE_NAME_REGEX = new RegExp([
    '(?:',
    // Group 1: Captures full URLs or relative/absolute file paths
    '([a-z]+://[^\\s:]+|[\\w\\d._\\-/]+\\.[\\w\\d._\\-]+)',
    ')',
    '(?:',
    // Line capture variations
    '(?:,\\s*Line:\\s*(\\d+))', // Handles "File: path, Line: 324"
    '|',
    '(?::(\\d+))',              // Handles "path:324"
    ')?',
    '(?::(\\d+))?'                  // Handles secondary column offsets if present "path:324:10"
].join(''), 'gi');



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

const TERMINALS = (typeof document !== 'undefined'
    ? Array.from(document.querySelectorAll('#terminals [href^="#"]')).map(el => el.href.split('#')[1])
    : ['all', 'error', 'warn', 'info', 'soft', 'immediate', 'build', 'console', 'ai'])
    .concat(['language'])
    .filter((a, i, arr) => arr.indexOf(a) === i)


const ENGINE_MEMORY_BASE = 48 * 1024 * 1024
const UI_MEMORY_BASE = 32
const CGAME_MEMORY_BASE = 16 * 1024 * 1024
const GAME_MEMORY_BASE = 32 * 1024 * 1024
