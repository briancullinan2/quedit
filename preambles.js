
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
    'abap': 'abap', 'abc': 'abc', 'ada': 'ada', 'adb': 'ada', 'ahk': 'autohotkey',
    'apex': 'apex', 'applescript': 'applescript', 'as': 'actionscript', 'asm': 'assembly_x86',
    'bat': 'batchfile', 'bash': 'sh', 'c': 'c_cpp', 'cbl': 'cobol', 'cc': 'c_cpp',
    'cfc': 'coldfusion', 'cfm': 'coldfusion', 'cfg': 'q3_config', 'cjs': 'javascript',
    'cl': 'lisp', 'clj': 'clojure', 'cljs': 'clojure', 'cls': 'apex', 'cmake': 'cmake',
    'cmd': 'batchfile', 'cob': 'cobol', 'coffee': 'coffee', 'conf': 'apache_conf',
    'cpp': 'c_cpp', 'cs': 'csharp', 'css': 'css', 'csx': 'csharp', 'cxx': 'c_cpp',
    'd': 'd', 'dart': 'dart', 'diff': 'diff', 'dockerfile': 'dockerfile', 'dot': 'dot',
    'e': 'eiffel', 'edn': 'clojure', 'ejs': 'ejs', 'erl': 'erlang', 'ex': 'elixir',
    'exs': 'elixir', 'f': 'fortran', 'f90': 'fortran', 'f95': 'fortran', 'for': 'fortran',
    'forth': 'forth', 'frag': 'glsl', 'fs': 'fsharp', 'fsi': 'fsharp', 'fsx': 'fsharp',
    'fth': 'forth', 'ftl': 'freemarker', 'gcode': 'gcode', 'gitignore': 'ini', 'glsl': 'glsl',
    'vlsl': 'glsl', 'hlsl': 'glsl', 'go': 'golang', 'gql': 'graphql', 'graphql': 'graphql',
    'groovy': 'groovy', 'gsh': 'groovy', 'gvy': 'groovy', 'gy': 'groovy', 'h': 'c_cpp',
    'haml': 'haml', 'handlebars': 'handlebars', 'hbs': 'handlebars', 'hh': 'c_cpp',
    'hjson': 'hjson', 'hpp': 'c_cpp', 'hrl': 'erlang', 'hs': 'haskell', 'htm': 'html',
    'html': 'html', 'htaccess': 'apache_conf', 'hxx': 'c_cpp', 'i': 'c_cpp', 'ini': 'ini',
    'ino': 'c_cpp', 'io': 'io', 'java': 'java', 'jade': 'pug', 'jl': 'julia', 'js': 'javascript',
    'json': 'json', 'jsm': 'javascript', 'jsp': 'jsp', 'jsx': 'jsx', 'kt': 'kotlin',
    'kts': 'kotlin', 'less': 'less', 'liquid': 'liquid', 'lisp': 'lisp', 'log': 'text',
    'ls': 'livescript', 'lsp': 'lisp', 'ltx': 'latex', 'lua': 'lua', 'm': 'matlab',
    'makefile': 'makefile', 'make': 'makefile', 'markdown': 'markdown', 'md': 'markdown',
    'mel': 'mel', 'mjs': 'javascript', 'mk': 'makefile', 'ml': 'ocaml', 'mli': 'ocaml',
    'mm': 'objectivec', 'mysql': 'mysql', 'nginx': 'nginx', 'nim': 'nim', 'nix': 'nix',
    'nsh': 'nsis', 'nsi': 'nsis', 'pas': 'pascal', 'patch': 'diff', 'perl': 'perl',
    'pgsql': 'pgsql', 'php': 'php', 'phtml': 'php', 'pig': 'pig', 'pl': 'perl',
    'plsql': 'plsql', 'pm': 'perl', 'pp': 'pascal', 'powershell': 'powershell', 'prefs': 'ini',
    'properties': 'properties', 'props': 'properties', 'proto': 'protobuf', 'ps1': 'powershell',
    'psm1': 'powershell', 'pug': 'pug', 'puppet': 'puppet', 'py': 'python', 'pyw': 'python',
    'q': 'q', 'r': 'r', 'rb': 'ruby', 'rdoc': 'rdoc', 'rhtml': 'ruby', 'rprofile': 'r',
    'rs': 'rust', 's': 'assembly_x86', 'sass': 'sass', 'sbt': 'scala', 'scad': 'scad',
    'scala': 'scala', 'scheme': 'scheme', 'scm': 'scheme', 'scss': 'scss', 'sh': 'sh',
    'sieve': 'sieve', 'slim': 'slim', 'smali': 'smali', 'smarty': 'smarty', 'sql': 'sql',
    'ss': 'scheme', 'styl': 'stylus', 'svg': 'svg', 'swift': 'swift', 'tcl': 'tcl',
    'tex': 'latex', 'toml': 'toml', 'tpl': 'smarty', 'ts': 'typescript', 'tsx': 'tsx',
    'twig': 'twig', 'txt': 'text', 'wasm': 'wasm_disassembly', 'qvm': 'qvm_disassembly',
    'v': 'verilog', 'shader': 'q3_shader', 'shaderx': 'q3_shader', 'vala': 'vala',
    'vapi': 'vala', 'vbe': 'vbscript', 'vbs': 'vbscript', 'vert': 'glsl', 'cam': 'q3_cam',
    'map': 'q3_map', 'vh': 'verilog', 'vhd': 'vhdl', 'vhdl': 'vhdl', 'vue': 'vue',
    'xhtml': 'html', 'xml': 'xml', 'xsd': 'xml', 'xsl': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
    'zig': 'zig', 'zsh': 'sh'
};

function getModeByFilename(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const filenameAsType = filePath.split('/').pop().toLowerCase();
    const modeKey = (!EXTENSION_TO_MODE[ext] && EXTENSION_TO_MODE[filenameAsType]) ? filenameAsType : ext;
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
