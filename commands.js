
// Definitive Semantic Autocomplete Types
const ARG_TYPES = {
    FILE: 'file',          // Local file path validation/completion
    DATABASE: 'database',  // GitHub user/repo path pattern tracking
    STRING: 'string',      // Plain text argument
    NUMERIC: 'number'
};

const COMMAND_SCHEMA = {
    help: {
        execute: help,
        description: "Display structured manual lookups for all available engine commands.",
        args: [{ name: "command", type: ARG_TYPES.STRING, description: "Target command manual to profile" }],
        flags: {},
        demos: [
            { cmd: "help", desc: "List all global system commands and inline operational manuals" },
            { cmd: "help build", desc: "Profile parameters, targets, and modes for the build compiler pipeline" }
        ]
    },
    clear: {
        execute: clear,
        description: "Clear active terminal screen scrollback history layers.",
        args: [],
        flags: {},
        demos: [{ cmd: "clear", desc: "Flush terminal screen scrollback" }]
    },
    reset: {
        execute: reset,
        description: "Hard reset terminal terminal display state engine.",
        args: [],
        flags: {},
        demos: [{ cmd: "reset", desc: "Reinitialize active graphic canvas streams and terminals" }]
    },
    mount: {
        execute: mount,
        prereqs: ['build'],
        description: "Mount a target workspace repository branch directory structure.",
        args: [
            { name: "repo_path", type: ARG_TYPES.DATABASE, description: "Target repository identifier string" }
        ],
        flags: {},
        demos: [
            { cmd: "mount briancullinan2/quedit", desc: "Mount the main system development repository matrix" },
            { cmd: "mount id-Software/Quake-III-Arena", desc: "Mount legacy source asset structures" }
        ]
    },
    ls: {
        execute: ls,
        description: "List workspace data entries within the current execution path.",
        args: [],
        flags: {
            '-R': { description: "Recursively traverse matching sub-paths" },
            '-h': { description: "Render data content metrics using human-readable layouts" },
            '-1': { description: "Force single column flat stream list format output" }
        },
        demos: [
            { cmd: "ls", desc: "List files within the current active workspace directory" },
            { cmd: "ls -R", desc: "Recursively print all sub-directories and downstream files" },
            { cmd: "ls -h", desc: "List files showing size metrics using human-readable formats" },
            { cmd: "ls -1", desc: "Force flat single column layout stream processing list" }
        ]
    },
    build: {
        execute: buildCommand,
        prereqs: ['build'],
        description: "Execute compilation procedures across targeted project modules.",
        args: [
            {
                name: "mode",
                type: ['release', 'debug', 'tools', 'qvms', 'client', 'engine', 'server', 'shaders', 'stringify', 'q3lcc', 'q3rcc', 'q3asm', 'lburg', 'game', 'cgame', 'ui'],
                description: "Target build execution configuration profile"
            },
            { name: "target_db", type: ARG_TYPES.DATABASE, description: "Override execution repository target" }
        ],
        flags: {},
        demos: [
            { cmd: "build client", desc: "Compile the web front-end engine client package components" },
            { cmd: "build tools", desc: "Compile toolchain assets including lcc, rcc, and q3asm engines" },
            { cmd: "build qvms", desc: "Build game sandbox files: qagame, cgame, and user interface modules" },
            { cmd: "build debug briancullinan2/quedit", desc: "Execute target architecture debug compilation over explicit database workspace" }
        ]
    },
    remove: {
        execute: remove,
        description: "Purge targeted structural documents from persistent storage matrices.",
        args: [
            { name: "filename", type: ARG_TYPES.FILE, description: "File path targeted for deletion" }
        ],
        flags: {},
        demos: [
            { cmd: "remove code/game/g_main.c", desc: "Purge target gameplay initialization file from cache layers" }
        ]
    },
    open: {
        execute: openCommand,
        prereqs: ['editor'],
        description: "Load a specified document directly into the active editing layout space.",
        args: [
            { name: "filename", type: ARG_TYPES.FILE, description: "Target file path to parse" },
            { name: "target_db", type: ARG_TYPES.DATABASE, description: "Repository resource source point" }
        ],
        flags: {},
        demos: [
            { cmd: "open src/dagcheck.md", desc: "Open code generator structural documentation file" },
            { cmd: "open code/client/cl_main.c briancullinan2/quedit", desc: "Load client core engine file from an explicit system database" }
        ]
    },
    compile: {
        execute: compileWorker,
        prereqs: ['build'],
        description: "Trigger compiler pipelines on target code assets.",
        args: [
            { name: "filename", type: ARG_TYPES.FILE, description: "Source document targeted for evaluation" },
            { name: "target_db", type: ARG_TYPES.DATABASE, description: "Target environment database repository context" }
        ],
        flags: {},
        demos: [
            { cmd: "compile code/game/bg_lib.c", desc: "Run background compatibility library code block processing" }
        ]
    },
    run: {
        execute: runWorker,
        prereqs: ['build'],
        description: "Invoke binary runtime tasks or specialized compiler utility tools.",
        args: [
            { name: "tool", type: ARG_TYPES.FILE, description: "WASM engine target binary element filename" }
        ],
        flags: {},
        demos: [
            { cmd: "run quake3e.wasm", desc: "Instantiate primary Quake 3 WASM engine cluster execution" },
            { cmd: "run q3asm.js.wasm", desc: "Invoke web assembly runtime wrapper context instance directly" }
        ]
    },
    lburg: {
        execute: lburg,
        prereqs: ['build'],
        description: "Run code generator bottom-up rewrite system compilation tools.",
        args: [
            { name: "input_md", type: ARG_TYPES.FILE, description: "DAG description source ruleset" },
            { name: "output_c", type: ARG_TYPES.FILE, description: "Output C source translation destination layout" }
        ],
        flags: {},
        demos: [
            { cmd: "lburg src/dagcheck.md src/dagcheck.c", desc: "Generate low-level system matrix parse definitions" }
        ]
    },
    clone: {
        execute: clone,
        description: "Clone external structures down into local indexed DB instances.",
        args: [
            { name: "repo_path", type: ARG_TYPES.DATABASE, description: "Target remote owner/repository pathway" },
            { name: "branch", type: ARG_TYPES.STRING, description: "Specific repository branch tag context" }
        ],
        flags: {},
        demos: [
            { cmd: "clone briancullinan2/quedit", desc: "Clone environment profile default production structures" },
            { cmd: "clone id-Software/Quake-III-Arena main", desc: "Pull explicit code branches from target historical repository tracking lists" }
        ]
    },
    kill: {
        execute: kill,
        description: "Terminate all running workers or low-level application processes immediately.",
        args: [],
        flags: {},
        demos: [{ cmd: "kill", desc: "Force stop all active asynchronous layout thread routines" }]
    },

    hello: {
        execute: hello,
        description: "Initialize environment greeting routines and log terminal session handshake diagnostic parameters.",
        args: [],
        flags: {},
        demos: [
            { cmd: "hello", desc: "Trigger console connection banner state check" }
        ]
    },
    header: {
        execute: header,
        description: "Upload header files to the background worker before trying to compile code that includes them.",
        args: [
            { name: "filename", type: ARG_TYPES.FILE, description: "Target include header file structure context" }
        ],
        flags: {},
        demos: [
            { cmd: "header code/game/g_local.h", desc: "Profile include links and structural offsets for target header definitions" }
        ]
    },
    link: {
        execute: link,
        prereqs: ['build'],
        description: "Link compiled sandbox application object segments or virtual image fragments into unified module payloads.",
        args: [
            {
                name: "mode",
                type: ['release', 'debug', 'tools', 'qvms', 'client', 'engine', 'server', 'shaders', 'stringify', 'q3lcc', 'q3rcc', 'q3asm', 'lburg', 'game', 'cgame', 'ui'],
                description: "Target build execution configuration profile"
            },
            { name: "target_db", type: ARG_TYPES.DATABASE, description: "Override execution repository target" }
        ],
        flags: {},
        demos: [
            { cmd: "link game", desc: "Skip any already built objects and run lld.wasm on code/game files." }
        ]
    },
    load: {
        execute: loadCommand,
        description: "Load a specific predefined module into the app, bypassing the laziness of the menus.",
        args: [
            {
                name: "module",
                type: Object.keys(IMPORT_MODULES),
                description: "Load the specified module by name"
            }
        ],
        flags: {},
        demos: [
            { cmd: "load editor", desc: "Immediately loads the " }
        ]
    },
    clang: {
        execute: clang,
        prereqs: ['build'],
        description: "Direct compiler frontend interface for raw wasm32-wasi compilation.",
        args: [
            { name: "source_file", type: ARG_TYPES.FILE, description: "Source document (.c, .cpp) to compile" }
        ],
        flags: {
            '-cc1': { description: "Invoke core compiler frontend directly, bypassing standard driver wrappers" },
            '-emit-obj': { description: "Force emit compiled binary relocatable object code (.o file matrix)" },
            '-triple=wasm32-wasi': { description: "Target core WASI interface platform architecture footprint" },
            '-fcolor-diagnostics': { description: "Enable ANSI color mapping codes inside IDE compiler log outputs" },
            '-ferror-limit': { description: "Truncate macro expansion/diagnostic error reporting logs [Default: 100]" },
            '-O0': { description: "Disable optimization passes for rapid debugging, explicit stack tracing, and rapid generation" },
            '-O3': { description: "Enable aggressive compiler optimization passes for maximum execution performance limits" },
            '-fno-rtti': { description: "Disable C++ Run-Time Type Information structures to minimize output sizing footprints" },
            '-fno-threadsafe-statics': { description: "Omit synchronization locks around local static initializations inside single-threaded loops" },
            '-D__WASM__=1': { description: "Inject explicit target macro conditioning parameters into preprocessor environments" },
            '-I': { description: "Append a specific directory tracking path directly into system header include matrices" }
        },
        demos: [
            { cmd: "clang -cc1 -emit-obj -triple wasm32-wasi code/game/g_main.c", desc: "Compile raw engine gameplay core down to an unlinked relocatable object file" },
            { cmd: "clang -cc1 -O3 -I/code/qcommon code/client/cl_main.c", desc: "Execute an optimized parsing iteration over target client source trees" }
        ]
    },
    wasm: {
        execute: wasm,
        prereqs: ['build'],
        description: "Direct LLVM static linker (wasm-ld) and diagnostic utility wrapper engine.",
        args: [
            { name: "object_files", type: ARG_TYPES.FILE, description: "Compiled relocatable object components (.o) to link" }
        ],
        flags: {
            '--no-entry': { description: "Allow linking compilation blobs lacking a traditional primary main() entry sequence" },
            '--export-all': { description: "Force expose all internal compilation symbols out directly into the browser's JS loop" },
            '--export': { description: "Explicitly append a named function/symbol structure into the module export tracking array" },
            '--allow-undefined': { description: "Allow compilation maps to contain dangling external symbol hooks to link at runtime" },
            '--import-memory': { description: "Instruct module to ingest WebAssembly.Memory provided explicitly by browser host script wrappers" },
            '--initial-memory': { description: "Set native initialization footprint requirements for linear allocation arenas [Bytes]" },
            '--max-memory': { description: "Set hard-boundary thresholds for memory growth before triggering buffer expansion drops" },
            '-o': { description: "Define output path target destination filename for finished binary payload (.wasm)" }
        },
        demos: [
            { cmd: "wasm-ld --no-entry --export-all -o quake3e.wasm code/game/g_main.o code/game/bg_lib.o", desc: "Link independent local runtime object fragments into a single executable system file" },
            { cmd: "wasm-ld --import-memory --initial-memory=67108864 -o q3asm.wasm code/tools/asm.o", desc: "Link assembly generator mapping tool with a fixed 64MB baseline allocation pool" }
        ]
    },
    // ==========================================
    // Symbolic Alias/Redirect Mapping Matrix
    // ==========================================
    rm: { alias: "remove" },
    manual: { alias: "help" },
    delete: { alias: "remove" },
    make: { alias: "build" },
    edit: { alias: "open" },
    lcc: { alias: "clang" },
    rcc: { alias: "clang" },
    ld: { alias: "wasm" },
    terminal: { alias: "load" },
    editor: { alias: "load" },
    build: { alias: "load" },
    q3: { alias: "load" },
    toji: { alias: "load" },
    paint: { alias: "load" },
    engine: { alias: "load" },
    client: { alias: "load" },
    quake3e: { alias: "load" },
    cc1: { alias: "clang" },
    as: { alias: "clang" },
    cpp: { alias: "clang" },
    'clang++': { alias: "clang" },
    'wasm-ld': { alias: "wasm" },
    'lld': { alias: "wasm" },
    terminate: { alias: "kill" },
    stop: { alias: "kill" },
    start: { alias: "run" },
    hello: { alias: "help" }
};

function writeCommandHelp(targetCommand, argv) {
    if (!targetCommand) return

    const schema = COMMAND_SCHEMA[targetCommand];
    if (!schema) {
        terminalWrite(`\x1b[38;5;203m[HELP ERROR]\x1b[0m Unknown command entity descriptor: "${targetCommand}"\n\r`);
        return;
    }

    // Handle Symbolic Redirection Hooks instantly
    if (schema.alias) {
        terminalWrite(`\x1b[38;5;221m[ALIAS]\x1b[0m Command \x1b[1m"${targetCommand}"\x1b[0m is a symbolic link to: \x1b[38;5;118m${schema.alias}\x1b[0m\n\r`);
        terminalWrite(`Execute "help ${schema.alias}" to view operational engine constraints.\n\r`);
        return;
    }

    terminalWrite(`\n\r\x1b[1;38;5;33mMANUAL LOOKUP: ${targetCommand.toUpperCase()}\x1b[0m\n\r`);
    terminalWrite(`\x1b[4mDescription:\x1b[0m ${schema.description}\n\r\n\r`);

    // Render Arguments and Typings
    if (schema.args.length > 0) {
        terminalWrite(`\x1b[4mArguments:\x1b[0m\n\r`);
        schema.args.forEach((arg, index) => {
            let typeString = '';
            if (Array.isArray(arg.type)) {
                typeString = `[enum: ${arg.type.join('|')}]`;
            } else {
                typeString = `<${arg.type}>`;
            }
            terminalWrite(`  argv[${index}] : ${arg.name.padEnd(14)} \x1b[38;5;214m${typeString.padEnd(30)}\x1b[0m # ${arg.description}\n\r`);
        });
        terminalWrite(`\n\r`);
    }

    // Render Compilation and Runtime Flags
    const flagKeys = Object.keys(schema.flags);
    if (flagKeys.length > 0) {
        terminalWrite(`\x1b[4mAvailable Flags:\x1b[0m\n\r`);
        flagKeys.forEach(flag => {
            terminalWrite(`  ${flag.padEnd(10)} : ${schema.flags[flag].description}\n\r`);
        });
        terminalWrite(`\n\r`);
    }

    if (schema.demos && schema.demos.length > 0) {
        terminalWrite(`\x1b[4mSample Execution Demos (Interactive):\x1b[0m\n\r`);
        schema.demos.forEach(demo => {
            // Bright Turquoise underlines on the actual target command sequence lines 
            // making them instantly targetable for stage two processing maps
            terminalWrite(`\x1b[1;38;5;81m${demo.cmd.padEnd(50)}\x1b[0m \x1b[38;5;244m# ${demo.desc}\x1b[0m\n\r`);
        });
    }

}


async function loadCommand(argv) {

    let moduleToLoad = argv[0]
    if (!argv[0] || argv[0].trim().length === 0
        || argv === 'q3'
        // TODO: remove conflict down below by running engine and dedicated in a worker
        || argv[0].includes('engine')
        || argv[0].includes('client')
    )
        moduleToLoad = 'quake3e'

    if (!IMPORT_MODULES[moduleToLoad]) {
        console.log('Invalid module specified: ' + argv[0])
        console.log('Valid options:')
        writeCommandHelp('load')
        return
    }

    await DependencyLoader.loadModule(moduleToLoad);

    if (moduleToLoad === 'quake3e' || moduleToLoad === 'toji') {
        renderTabsCommand('viewport-container')
    }

    if (moduleToLoad === 'editor') {
        renderTabsCommand('editor')
    }
    if (moduleToLoad === 'terminal') {
        renderTabsCommand('terminal-container')
    }
    if (moduleToLoad === 'paint') {
        renderTabsCommand('paint')
    }
}


async function help(argv) {
    const targetCommand = argv[0];

    // Scenario A: Render deep metrics for an explicit, single requested command target
    if (targetCommand) {
        writeCommandHelp(targetCommand)
        if (COMMAND_SCHEMA[targetCommand] && COMMAND_SCHEMA[targetCommand].alias) {
            writeCommandHelp(COMMAND_SCHEMA[targetCommand].alias)
        }
        return;
    }

    // Scenario B: Global lookup list pass (Default plain "help" execution context)
    terminalWrite(`\n\r\x1b[1;38;5;118m=== AVAILABLE SYSTEM MATRIX COMMANDS ===\x1b[0m\n\r`);

    // Sort keys to maintain a clean layout presentation
    const keys = Object.keys(COMMAND_SCHEMA).sort();

    // Compute padding alignments
    const maxKeyLen = Math.max(...keys.map(k => k.length), 10);

    for (const key of keys) {
        const item = COMMAND_SCHEMA[key];
        const keyNameDisplay = key.padEnd(maxKeyLen + 2);

        if (item.alias) {
            // Render basic alias linkage markers concisely
            terminalWrite(`  \x1b[38;5;244m${keyNameDisplay} -> alias to [${item.alias}]\x1b[0m\n\r`);
        } else {
            // Render active descriptions 
            terminalWrite(`  \x1b[1;38;5;45m${keyNameDisplay}\x1b[0m : ${item.description}\n\r`);
        }
    }
    for (const key of keys) {
        if (!COMMAND_SCHEMA[key].alias) {
            writeCommandHelp(key);
            // Boundary line divider separating operational tools
            terminalWrite(`\x1b[38;5;238m${'-'.repeat(term.cols || 80)}\x1b[0m\n\r`);
        }
    }

    terminalWrite(`\n\rRun "help <command>" to query explicit option arguments and value types.\n\r`);
}


const CWD = ''
const HISTORY = []


let runningCommand = false
let detachedConsole = false
async function handleCommand(input) {
    const database = owner.value + '/' + repository.value;
    const tokens = tokenize(input.trim());

    api.configuration = configuration.value === 'debug' ? 'debug' : 'release';

    if (tokens.length === 0) return;

    runningCommand = true;
    const [commandName, ...args] = tokens;

    let resolvedCommandKey = commandName;
    const schemaMatch = COMMAND_SCHEMA[commandName];

    if (schemaMatch && schemaMatch.alias) {
        resolvedCommandKey = schemaMatch.alias;
    }


    if (schemaMatch.prereqs) {
        for (let importFirst of schemaMatch.prereqs) {
            await DependencyLoader.loadModule(importFirst);
        }
    }

    const targetExecutionRoute = COMMAND_SCHEMA[resolvedCommandKey].execute;

    if (targetExecutionRoute) {
        try {
            await targetExecutionRoute(args, database, commandName);
        } catch (execError) {
            if (typeof originalConsole !== 'undefined')
                originalConsole.error(execError)
            terminalWrite(formatMessage(CMD_PREAMBLE, [`Failed executing: ${resolvedCommandKey}`, execError]));
        }
    } else {
        terminalWrite(`Command not found: ${commandName}\n\r`);
    }

    runningCommand = false;
    triggerIncrementalSave();

}


async function mount(argv, database) {
    let selected = argv[0] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    let branch = await getDefaultBranch(ownerName, repoName)
    await loadGitHubTree(ownerName, repoName, branch)
    //await readAll(selected)
}


async function ls(argv, database) {
    let selected = toolsRepository || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    if (!files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    const flags = {
        recursive: argv.includes('-R'),
        human: argv.includes('-h'),
        flat: argv.includes('-1')
    };

    // Assuming FS.virtual.readdir returns objects with {name, size, type}
    const entries = Object.values(FS.virtual)
        .concat(Object.values(files[selected] || {}) || [])
        .filter(p => {
            if (!p.path) {
                debugger
            }
            let compare = CWD
            let startMatch = false
            let subMatch = false
            if (compare.trim().length == 0)
                compare = '/'
            if (!compare.endsWith('/'))
                compare += '/'

            let path = p.path
            if (!path.startsWith('/'))
                path = '/' + path
            if (path.startsWith(compare))
                startMatch = true
            if (flags.recursive || path.substring(compare.length).indexOf('/') === -1)
                subMatch = true
            return startMatch && (flags.recursive || subMatch)
        });


    if (flags.flat) {
        entries.forEach(e => terminalWrite(e.path + '\n\r'));
    } else {
        // Calculate column width for alignment
        const maxName = Math.max(...entries.map(e => e.path.length), 10);

        terminalWrite(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE\n\r`);
        terminalWrite('-'.repeat(maxName + 20) + '\n\r');

        entries.forEach(e => {
            const size = e.contents ? flags.human ? formatBytes(e.contents.length) : e.contents.length.toString() : '0B';
            const nameStr = e.path.padEnd(maxName + 2);
            const sizeStr = size.padEnd(10);
            const color = e.mode === FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

            terminalWrite(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}\n\r`);
        });
    }
}




async function hello(argv) {
    const name = argv[0] || 'User';
    let user = (await getAuthenticatedUser()).login
    terminalWrite(`Hello, ${user || name}!\n\r`);
}






async function buildCommand(argv, database) {
    const mode = argv[0] || 'release';

    let selected = api.database = argv[1] || engineRepository || database
    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'tools'
    )
        selected = argv[1] || toolsRepository
    if (mode === 'q3asm')
        selected = argv[1] || tools2Repository
    if (mode === 'all'
        || mode === 'release'
        || mode === 'debug'
        || mode === 'stringify'
        || mode === 'shaders'
        || mode === 'client'
        || mode === 'engine'
        || mode === 'server'
    )
        selected = argv[1] || engineRepository

    if (mode === 'cgame'
        || mode === 'game'
        || mode === 'uid'
        || mode === 'qvms'
    )
        selected = argv[1] || gameRepository

    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
    if (selected && !files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }


    if (TERMINATE) return

    let validMode = configuration.value

    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'q3asm'
        || mode === 'tools'
    )
        validMode = 'tools'

    else if (mode === 'cgame'
        || mode === 'game'
        || mode === 'uid'
        || mode === 'qvms'
    )
        validMode = 'qvms'
    else if (mode === 'all'
        || mode === 'release'
        || mode === 'debug'
        || mode === 'stringify'
        || mode === 'shaders'
        || mode === 'client'
        || mode === 'engine'
        || mode === 'server'
    )
        validMode = 'release'


    if (configuration.querySelector(`[value="${validMode}"]`)) {
        configuration.value = validMode
        api.configuration = configuration.value === 'debug' ? 'debug' : 'release'
    }
    else if (mode) {
        let modes = Array.from(configuration.children).map(m => m.value)
        terminalWrite(`Valid modes ${modes.join('|')}: ${mode} given.\n\r`);
        return;
    }


    terminalWrite(`Starting ${mode} build...\n\r`);

    if (selected === engineRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(q3eCommonHeaders, 10, mode === 'all' ? engineRepository : selected)
    }

    needsHeaders = false


    if (TERMINATE) return

    if (mode === 'stringify' || mode === 'all')
        await buildStringify(mode === 'all' ? engineRepository : selected, false, true)

    if (TERMINATE) return
    if (mode === 'shaders')
        await buildShaders(mode === 'all' ? engineRepository : selected, false, true)

    if (TERMINATE) return
    if (mode === 'client'
        || mode === 'release' || mode === 'debug'
        || mode === 'all'
    )
        await buildClient(mode === 'all' ? engineRepository : selected, mode === 'client' || mode === 'engine', false, true) // also builds shaders

    if (TERMINATE) return

    if (selected === toolsRepository) {
        await downloadHeaders(lccToolHeaders, 10, mode === 'all' ? toolsRepository : selected)
    }

    if (TERMINATE) return

    if (mode === 'lburg' || mode === 'all' || mode === 'tools')
        await buildTools(mode === 'all' ? toolsRepository : selected, 'lburg', mode === 'lburg', true) // shared debouncer

    if (TERMINATE) return
    if (mode === 'q3rcc' || mode === 'all' || mode === 'tools')
        await buildTools(mode === 'all' ? toolsRepository : selected, 'q3rcc', mode === 'q3rcc', true) // implicit forceChanged = true

    if (TERMINATE) return
    if (mode === 'q3cpp' || mode === 'all' || mode === 'tools')
        await buildTools(mode === 'all' ? toolsRepository : selected, 'q3cpp', mode === 'q3cpp', true)

    if (TERMINATE) return
    if (mode === 'q3lcc' || mode === 'all' || mode === 'tools')
        await buildTools(mode === 'all' ? toolsRepository : selected, 'q3lcc', mode === 'q3lcc', true)

    if (TERMINATE) return

    if (selected === tools2Repository) {
        await downloadHeaders(asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? tools2Repository : selected)
    }

    if (mode === 'q3asm' || mode === 'all' || mode === 'tools')
        await buildTools(mode === 'q3asm' || mode === 'tools' ? selected : tools2Repository, 'q3asm', mode === 'q3asm', true)




    if (TERMINATE) return

    if (selected === gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, mode === 'all' ? gameRepository : selected)
    }

    if (TERMINATE) return

    if (mode === 'game' || mode === 'all' || mode === 'qvms')
        await buildModule('game', dirs.QADIR, gameFiles, mode === 'all' ? gameRepository : selected, ['QAGAME'], mode === 'game', false, true);

    if (TERMINATE) return
    if (mode === 'cgame' || mode === 'all' || mode === 'qvms')
        await buildModule('cgame', dirs.CGDIR, cgameFiles, mode === 'all' ? gameRepository : selected, ['CGAME'], mode === 'cgame', false, true);
    if (TERMINATE) return
    if (mode === 'ui' || mode === 'all' || mode === 'qvms')
        await buildModule('ui', dirs.UIDIR, uiFiles, mode === 'all' ? gameRepository : selected, ['UI'], mode === 'ui' || mode === 'q3_ui', false, true);


}


async function remove(argv, database) {
    const databases = [database, engineRepository, assetRepository, gameRepository, toolsRepository, tools2Repository]
    const filename = argv[0]
    for (let db of databases) {
        try {
            if (!db) continue
            await deleteRecord(DB_STORE_NAME, filename, db)
        } catch (e) {

        }
    }
    delete FS.virtual[filename]
    try {
        api.remove(filename)
    } catch (e) {

    }
}



async function link(argv, database) {
    const mode = argv[0] || 'engine';


    let selected = api.database = argv[1] || engineRepository || database
    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'tools'
    )
        selected = argv[1] || toolsRepository
    if (mode === 'q3asm')
        selected = argv[1] || tools2Repository
    if (mode === 'all'
        || mode === 'release'
        || mode === 'debug'
        || mode === 'stringify'
        || mode === 'shaders'
        || mode === 'client'
        || mode === 'engine'
        || mode === 'server'
    )
        selected = argv[1] || engineRepository

    if (mode === 'cgame'
        || mode === 'game'
        || mode === 'uid'
        || mode === 'qvms'
    )
        selected = argv[1] || gameRepository


    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
    if (selected && !files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    if (TERMINATE) return

    api.configuration = configuration.value === 'debug' ? 'debug' : 'release'


    terminalWrite(`Starting ${mode} linking...\n\r`);


    if (selected === engineRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(q3eCommonHeaders, 10, mode === 'all' ? engineRepository : selected)
    }

    if (TERMINATE) return


    if (mode === 'stringify' || mode === 'all')
        await linkStringify(mode === 'all' ? engineRepository : selected, true)

    if (TERMINATE) return
    if (mode === 'client' || mode === 'engine'
        || mode === 'shaders' || mode === 'release'
        || mode === 'debug' || mode === 'all'
    )
        await linkEngine(mode === 'all' ? engineRepository : selected, true)

    if (TERMINATE) return


    if (selected === toolsRepository) {
        await downloadHeaders(lccToolHeaders, 10, mode === 'all' ? toolsRepository : selected)
    }



    if (TERMINATE) return
    if (mode === 'lburg' || mode === 'tools' || mode === 'all')
        await linkLburg(mode === 'all' ? toolsRepository : selected, true)

    if (TERMINATE) return
    if (mode === 'q3rcc' || mode === 'tools' || mode === 'all')
        await linkRCC(mode === 'all' ? toolsRepository : selected, true)

    if (TERMINATE) return
    if (mode === 'q3cpp' || mode === 'tools' || mode === 'all')
        await linkCPP(mode === 'all' ? toolsRepository : selected, true)

    if (TERMINATE) return
    if (mode === 'q3lcc' || mode === 'tools' || mode === 'all')
        await linkLCC(mode === 'all' ? toolsRepository : selected, true)

    if (TERMINATE) return

    if (selected === tools2Repository) {
        await downloadHeaders(asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? tools2Repository : selected)
    }


    if (TERMINATE) return
    if (mode === 'q3asm' || mode === 'tools' || mode === 'all')
        await linkAsm(mode === 'all' || mode === 'tools' ? tools2Repository : selected, true)

    if (TERMINATE) return
    if (selected === gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, mode === 'all' ? gameRepository : selected)
    }
    if (TERMINATE) return


    if (mode === 'game' || mode === 'qvms' || mode === 'all')
        await linkModule(mode === 'all' ? gameRepository : selected, 'game', dirs.QADIR, gameFiles, true)

    if (TERMINATE) return
    if (mode === 'cgame' || mode === 'qvms' || mode === 'all')
        await linkModule(mode === 'all' ? gameRepository : selected, 'cgame', dirs.CGDIR, cgameFiles, true)

    if (TERMINATE) return
    if (mode === 'ui' || mode === 'qvms' || mode === 'all')
        await linkModule(mode === 'all' ? gameRepository : selected, 'ui', dirs.UIDIR, uiFiles, true)

    if (TERMINATE) return
    if (mode === 'q3_ui' || mode === 'qvms' || mode === 'all')
        await linkModule(mode === 'all' ? gameRepository : selected, 'q3_ui', dirs.Q3UIDIR, q3uiFiles, true)

    if (TERMINATE) return

    // TODO: link dedicated server

}


async function header(argv, database) {
    let selected = toolsRepository || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
    let headers = [argv[0]]

    if (!argv[0])
        headers = [...lccToolHeaders]

    if (!files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    for (let header of headers) {
        let sha = files[selected][header].sha

        await cacheFile(ownerName, repoName, header, sha);
        await api.header(ownerName, repoName, header, selected)
    }
}


function openCommand(argv, database) {
    let selected = toolsRepository || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value
    let fileName = argv[0]
    // TODO: I did this backwards, i should have had the terminal click execute the command, and put it in history
    clickTerminalFile(fileName, null)

}

function edit(argv) {
    return open(argv)
}

async function compileWorker(argv, database) {
    let file = argv[0] || currentSession()
    let selected = argv[1] || engineRepository || database

    if (file.includes('src')
        || file.includes('cpp')
        || file.includes('etc')
        || file.includes('lburg')
    ) {
        selected = toolsRepository
    }

    if (q3asmFiles.indexOf(file) > -1) {
        selected = tools2Repository
    }


    if (file.includes('code/client')
        || file.includes('code/server')
        || file.includes('code/qcommon')
        || file.includes('code/renderer2')
        || file.includes('code/botlib')
        || file.includes('code/wasm')
        || file.includes('code/renderercommon')
    ) {
        selected = engineRepository
    }

    if (file.includes('code/cgame')
        || file.includes('code/game')
        || file.includes('code/q3_ui')
        || file.includes('code/ui')
    ) {
        selected = gameRepository
    }


    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    if (!files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    if (selected === engineRepository
        || file.includes('code/client')
        || file.includes('code/server')
        || file.includes('code/qcommon')
        || file.includes('code/renderer2')
        || file.includes('code/botlib')
        || file.includes('code/wasm')
        || file.includes('code/renderercommon')) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(q3eCommonHeaders, 10, selected)
    }

    if (selected === gameRepository || file.includes('code/game')
        || file.includes('code/cgame') || file.includes('code/ui')
        || file.includes('code/q3_ui')) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, selected)
    }

    if (selected === toolsRepository || file.includes('src/')
        || file.includes('cpp/') || file.includes('etc/')
        || file.includes('lburg/')) {
        await downloadHeaders(lccToolHeaders, 10, selected)
    }

    if (selected === tools2Repository || q3asmFiles.indexOf(file) > -1) {
        await downloadHeaders(asmToolHeaders, 10, selected)
    }

    //let sha = files[selected][file].sha
    let contents = await cacheFile(ownerName, repoName, file);

    api.configuration = configuration.value === 'debug' ? 'debug' : 'release'

    let CONFIGURATION = api.configuration === 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    let srcPath = file.replace('.o', '.c')
    let obj = CONFIGURATION + '/' + file.replace('.c', '.o')
    let outPath = CONFIGURATION + '/' + file.replace('.c', '.asm')

    if (selected === gameRepository
        || file.includes('code/cgame')
        || file.includes('code/game')
        || file.includes('code/q3_ui')
        || file.includes('code/ui')
    ) {

        let DEFINE = ['-DGAME']
        let vm = 'game'
        if (file.includes('code/cgame')) {
            DEFINE = ['-DCGAME']
            vm = 'cgame'
        }
        if (file.includes('code/q3_ui') || file.includes('code/ui')) {
            DEFINE = ['-DUI']
            vm = 'ui'
        }


        let tempPath = CONFIGURATION + '/' + srcPath.replace('.c', '.i')

        /*
q3lcc -v -v -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED -DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/g
ame/bg_lib.c build/debug-wasm-js/code/game/bg_lib.i
q3lcc $Id$
code/game/bg_lib.c:
q3cpp -D__STDC__=1 -D__STRICT_ANSI__ -D__signed__=signed -DQ3_VM -D__LCC__ -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED 
-DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/game/bg_lib.c /tmp/lcc420.i
q3rcc -target=bytecode -v /tmp/lcc420.i bg_lib.asm
build/debug-wasm-js/code/game/bg_lib.i:
q3rcc -target=bytecode -v build/debug-wasm-js/code/game/bg_lib.i bg_lib.asm
rm /tmp/lcc420.i
*/

        /*
        
                await api.run({
                    tool: 'q3cpp.js.wasm',
                    args: [
                        'q3cpp', // '-v', '-v',
                        ...QVM_CFLAGS,
                        ...DEFINE,
                        srcPath,
                        tempPath,
                    ],
                    database: selected,
                    toolsRepo: toolsRepo,
                    paths: [file, tempPath],
        
                    // TODO:
                    contents: contents,
                    width: term.cols,
                    input: srcPath,
                    tempPath,
                    github_token: api.github_token
                })
        
                await api.run({
                    tool: 'q3rcc.js.wasm',
                    args: [
                        'q3rcc', // '-v', '-v',
                        '-target=bytecode',
                        //(configuration.value === 'pre' ? '-g' : '-g2'),
                        '-v',
                        tempPath,
                        outPath //.split('/').pop(),
                    ],
                    database: selected,
                    toolsRepo: toolsRepo,
                    paths: [outPath, tempPath],
                })
        
                */

        await api.run({
            tool: 'q3lcc.js.wasm',
            args: [
                'q3lcc', '-v', '-S', '-Wf-g',
                ...QVM_CFLAGS,
                ...DEFINE,
                srcPath,
                '-o', outPath,
            ],
            database: selected,
            toolsRepo: toolsRepository,
            paths: [outPath, srcPath],
        })

        return
    }

    return await api.compile({
        CFLAGS: [
            ...LCC_CFLAGS, `-Icode`, `-Isrc`,
            ...(configuration.value == 'pre' ? [
                '-o', obj.replace('.o', '.a')
            ] : ['-o', obj]),
            srcPath
        ],
        contents: contents,
        width: term.cols,
        input: srcPath,
        database: selected,
        obj,
        github_token: api.github_token
    })
}
async function clang(argv, database) {
    let file = argv[0] || currentSession()
    return await api.compile({
        CFLAGS: argv,
        contents: aceEditor.getValue(),
        width: term.cols,
        input: file,
        database: database,
        obj: file ? CONFIGURATION + '/' + file.replace('.c', '.o') : null
    })
}
async function runWorker(argv, database) {
    if (!argv[0] || argv[0].trim().length === 0
        || argv[0].includes('quake3e')
        // TODO: remove conflict down below by running engine and dedicated in a worker
        || argv[0].includes('engine')
        || argv[0].includes('client')
        || argv[0].includes('q3')
    ) {
        return loadCommand(argv[0])
    }

    let thisDatabase = database
    if (argv[0].includes('lburg')
        || argv[0].includes('q3lcc')
        || argv[0].includes('q3rcc')
        || argv[0].includes('q3cpp')
        || argv[0].includes('q3asm')
    )
        thisDatabase = toolsRepository
    if (argv[0].includes('stringify')
        || argv[0].includes('quake3e')
        || argv === 'dedicated')
        thisDatabase = engineRepository

    return await api.run({
        tool: argv[0],
        args: argv,
        database: thisDatabase,
        toolsRepo: toolsRepository
    })
}
async function lburg(argv, database) {
    let selected = toolsRepository || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    if (!files.selected) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    api.configuration = configuration.value === 'debug' ? 'debug' : 'release'

    let CONFIGURATION = api.configuration === 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    let paths = [
        argv[0] || 'src/dagcheck.md',
        argv[1] || path.join(CONFIGURATION, argv[0] ? argv[0].replace('.md', '.c') : 'src/dagcheck.c'),
    ]

    await cacheFile(ownerName, repoName, paths[0], (files[selected][paths[0]] || {}).sha);


    let args = [
        'lburg.js.wasm',
        ...paths,
        ...argv.slice(2)
    ]

    return await api.run({
        tool: 'lburg.js.wasm',
        args: args,
        database: selected,
        toolsRepo: toolsRepository,
        paths: paths,
        github_token: api.github_token
    })
}
async function clone(argv) {
    const selected = argv[0] || toolsRepository || 'briancullinan2/quedit'
    const parts = selected.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value

    const branch = argv[1]
    if (!branch) {
        branch = await getDefaultBranch(ownerName, repoName)
    }
    await loadGitHubTree(ownerName, repoName, branch)

    terminalWrite('Checked out: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

    // TODO: switch to aux filelist and display
}
async function lcc(argv) {
    return commands['clang'](argv)
}
async function wasm(argv, database = null) {
    return await api.link({
        LDFLAGS: argv,
        database: database,
        github_token: api.github_token
    })
}
function reset() {
    term.reset()
    triggerIncrementalSave()
}

function clear() {
    term.clear()
    triggerIncrementalSave()
}

function kill() {
    api.terminate()
    //api.worker.terminate()
}

