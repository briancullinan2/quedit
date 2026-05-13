
const CWD = ''
const HISTORY = []



async function handleCommand(input) {
    const database = owner.value + '/' + repo.value
    const tokens = tokenize(input.trim());


    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    if (tokens.length === 0) return;


    const [command, ...args] = tokens;

    const commands = {
        mount: mount,
        ls: ls,
        help: help,
        hello: hello,
        build: buildCommand,
        header: header,
        open: openCommand,
        edit: openCommand,
        compile: compileWorker,
        clang: clang,
        run: runWorker,
        lburg: lburg,
        clone: clone,
        'lcc': clang,
        'rcc': clang,
        'ld': clang,
        'cc1': clang,
        'as': clang,
        'cpp': clang,
        'clang++': clang,
        wasm: wasm,
        'wasm-ld': wasm,
        'ldd': wasm,
        reset: reset,
        clear: clear,
        link: link
    };

    if (commands[command]) {
        await commands[command](args, database);
    } else {
        term.write(`Command not found: ${command}\n\r`);
    }

    triggerIncrementalSave()
}



async function mount(argv, database) {
    let selected = argv[0] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    let branch = await getDefaultBranch(ownerName, repoName)
    await loadGitHubTree(ownerName, repoName, branch)
    //await readAll(selected)
}


async function ls(argv, database) {
    let selected = toolsRepo || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

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
        entries.forEach(e => term.writeln(e.path));
    } else {
        // Calculate column width for alignment
        const maxName = Math.max(...entries.map(e => e.path.length), 10);

        term.writeln(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE`);
        term.writeln('-'.repeat(maxName + 20));

        entries.forEach(e => {
            const size = e.contents ? flags.human ? formatBytes(e.contents.length) : e.contents.length.toString() : '0B';
            const nameStr = e.path.padEnd(maxName + 2);
            const sizeStr = size.padEnd(10);
            const color = e.mode === FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

            term.writeln(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}`);
        });
    }
}

async function help() {
    term.write('Available commands: help, clear, build, set\n\r');
}


async function hello(argv) {
    const name = argv[0] || 'User';
    let user = (await getAuthenticatedUser()).login
    term.write(`Hello, ${user || name}!\n\r`);
}






async function buildCommand(argv, database) {
    const mode = argv[0] || 'release';

    let selected = api.database = argv[1] || engineRepo || database
    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'asm'
        || mode === 'tools'
    )
        selected = argv[1] || toolsRepo
    if (mode === 'all'
        || mode === 'release'
        || mode === 'debug'
        || mode === 'stringify'
        || mode === 'shaders'
        || mode === 'client'
        || mode === 'engine'
        || mode === 'server'
    )
        selected = argv[1] || engineRepo

    if (mode === 'cgame'
        || mode === 'game'
        || mode === 'uid'
        || mode === 'qvms'
    )
        selected = argv[1] || gameRepo

    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
    if (selected && !files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }


    let validMode = api.configuration = configuration.value

    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'asm'
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


    if (configuration.querySelector(`[value="${validMode}"]`))
        configuration.value = validMode
    else if (mode) {
        let modes = Array.from(configuration.children).map(m => m.value)
        term.write(`Valid modes ${modes.join('|')}: ${mode} given.\n\r`);
        return;
    }



    term.write(`Starting ${mode} build...\n\r`);

    if (mode === 'stringify' || mode === 'all')
        await buildStringify(selected)
    if (mode === 'shaders' || mode === 'all')
        await buildShaders(selected)
    if (mode === 'client'
        || mode === 'release' || mode === 'debug'
        || mode === 'all'
    )
        await buildClient(selected)


    if (mode === 'lburg' || mode === 'all' || validMode === 'tools' || mode === 'tools')
        await buildLBurg(selected)
    if (mode === 'q3rcc' || mode === 'all' || validMode === 'tools' || mode === 'tools')
        await buildRCC(selected)
    if (mode === 'q3cpp' || mode === 'all' || validMode === 'tools' || mode === 'tools')
        await buildCPP(selected)
    if (mode === 'q3lcc' || mode === 'all' || validMode === 'tools' || mode === 'tools')
        await buildLCC(selected)
    if (mode === 'asm' || mode === 'all' || validMode === 'tools' || mode === 'tools')
        await buildAsmTool(selected)

    if (mode === 'game' || mode === 'all' || validMode === 'qvms' || mode === 'qvms')
        await buildGame(selected)
    if (mode === 'cgame' || mode === 'all' || validMode === 'qvms' || mode === 'qvms')
        await buildCGame(selected)
    if (mode === 'ui' || mode === 'all' || validMode === 'qvms' || mode === 'qvms')
        await buildUI(selected)

}




async function link(argv, database) {
    const mode = argv[0] || 'engine';

    let selected = api.database = argv[1] || engineRepo || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
    if (selected && !files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }


    term.write(`Starting ${mode} build...\n\r`);

    if (mode === 'stringify' || mode === 'all')
        await linkStringify(selected)
    if (mode === 'client' || mode === 'engine'
        || mode === 'shaders' || mode === 'release'
        || mode === 'debug' || mode === 'all'
    )
        await linkEngine(selected)

    if (mode === 'lburg' || mode === 'tools' || mode === 'all')
        await linkLburg(selected)
    if (mode === 'q3rcc' || mode === 'tools' || mode === 'all')
        await linkRCC(selected)
    if (mode === 'q3cpp' || mode === 'tools' || mode === 'all')
        await linkCPP(selected)
    if (mode === 'q3lcc' || mode === 'tools' || mode === 'all')
        await linkLCC(selected)
    if (mode === 'asm' || mode === 'tools' || mode === 'all')
        await linkAsm(selected)


    if (mode === 'game' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'game', gameFiles)
    if (mode === 'cgame' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'cgame', cgameFiles)
    if (mode === 'ui' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'ui', uiFiles)

    // TODO: link dedicated server

}


async function header(argv, database) {
    let selected = toolsRepo || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
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
    let selected = toolsRepo || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value
    let fileName = argv[0]
    const fileId = files[selected][fileName].sha
    currentOpenFileId = fileId;
    trees[selected].values = [fileId];
    openFile(ownerName, repoName, filePath, fileId, true);

}
function edit(argv) {
    return open(argv)
}
async function compileWorker(argv, database) {
    let file = argv[0] || currentSession()
    let selected = toolsRepo || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (!files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    let sha = files[selected][file].sha

    let contents = await cacheFile(ownerName, repoName, file, sha);

    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    let obj = CONFIGURATION + '/' + file.replace('.c', '.o')

    api.configuration = configuration.value

    return await api.compile({
        CFLAGS: [
            ...LCC_CFLAGS, `-Icode`, `-Isrc`,
            ...(configuration.value == 'pre' ? [
                '-o', obj.replace('.o', '.a')
            ] : ['-o', obj]),
            file
        ],
        configuration: configuration.value,
        contents: contents,
        width: term.cols,
        input: file,
        database: database,
        obj,
        github_token: api.github_token
    })
}
async function clang(argv, database) {
    let file = argv[0] || currentSession()
    return await api.compile({
        CFLAGS: argv,
        configuration: configuration.value,
        contents: editor.getValue(),
        width: term.cols,
        input: file,
        database: database,
        obj: file ? CONFIGURATION + '/' + file.replace('.c', '.o') : null
    })
}
async function runWorker(argv, database) {

    let thisDatabase = database
    if (argv[0].includes('lburg')
        || argv[0].includes('q3lcc')
        || argv[0].includes('q3rcc')
        || argv[0].includes('q3cpp')
        || argv[0].includes('q3asm')
    )
        thisDatabase = toolsRepo
    if (argv[0].includes('stringify')
        || argv[0].includes('quake3e'))
        thisDatabase = engineRepo

    return await api.run({
        configuration: configuration.value,
        tool: argv[0],
        args: argv,
        database: thisDatabase,
        toolsRepo
    })
}
async function lburg(argv, database) {
    let selected = toolsRepo || argv[1] || database
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (!files.selected) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG


    api.configuration = configuration.value

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
        configuration: configuration.value,
        tool: 'lburg.js.wasm',
        args: args,
        database: selected,
        toolsRepo,
        paths: paths,
        github_token: api.github_token
    })
}
async function clone(argv) {
    let selected = argv[0] || toolsRepo || 'briancullinan2/quedit'
    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    var branch = argv[1]
    if (!branch) {
        branch = await getDefaultBranch(ownerName, repoName)
    }
    await loadGitHubTree(ownerName, repoName, branch)

    term.write('Checked out: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

    // TODO: switch to aux filelist and display
}
async function lcc(argv) {
    return commands['clang'](argv)
}
async function wasm(argv, database = null) {
    return await api.link({
        LDFLAGS: argv,
        configuration: configuration.value,
        database: database,
        github_token: api.github_token
    })
}
function reset() {
    term.reset()
}
function clear() {
    term.clear()
}
