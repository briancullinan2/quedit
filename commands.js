
const CWD = ''
const HISTORY = []



async function handleCommand(input) {
    const database = owner.value + '/' + repo.value
    const tokens = tokenize(input.trim());


    api.configuration = configuration.value === 'debug' ? 'debug' : 'release'

    let CONFIGURATION = api.configuration === 'release'
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
        || mode === 'tools'
    )
        selected = argv[1] || toolsRepo
    if (mode === 'q3asm')
        selected = argv[1] || toolsRepo2
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
        term.write(`Valid modes ${modes.join('|')}: ${mode} given.\n\r`);
        return;
    }


    term.write(`Starting ${mode} build...\n\r`);

    if (selected === engineRepo) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(q3eCommonHeaders, 10, selected)
    }

    if (selected === gameRepo) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, selected)
    }

    if (selected === toolsRepo) {
        await downloadHeaders(lccToolHeaders, 10, selected)
    }

    if (selected === toolsRepo2) {
        await downloadHeaders(asmToolHeaders, 10, selected)
    }


    if (mode === 'stringify' || mode === 'all')
        await buildStringify(selected, true)
    if (mode === 'shaders')
        await buildShaders(selected, true)
    if (mode === 'client'
        || mode === 'release' || mode === 'debug'
        || mode === 'all'
    )
        await buildClient(selected, true) // also builds shaders


    if (mode === 'lburg' || mode === 'all' || mode === 'tools')
        await buildTools(selected, 'lburg', mode === 'lburg', true) // shared debouncer
    if (mode === 'q3rcc' || mode === 'all' || mode === 'tools')
        await buildTools(selected, 'q3rcc', mode === 'q3rcc', true) // implicit forceChanged = true
    if (mode === 'q3cpp' || mode === 'all' || mode === 'tools')
        await buildTools(selected, 'q3cpp', mode === 'q3cpp', true)
    if (mode === 'q3lcc' || mode === 'all' || mode === 'tools')
        await buildTools(selected, 'q3lcc', mode === 'q3lcc', true)
    if (mode === 'q3asm' || mode === 'all' || mode === 'tools')
        await buildTools(selected, 'q3asm', mode === 'q3asm', true)

    if (mode === 'game' || mode === 'all' || mode === 'qvms')
        await buildGame(selected, true) // shared debouncer
    if (mode === 'cgame' || mode === 'all' || mode === 'qvms')
        await buildCGame(selected, true)
    if (mode === 'ui' || mode === 'all' || mode === 'qvms')
        await buildUI(selected, true)

}




async function link(argv, database) {
    const mode = argv[0] || 'engine';


    let selected = api.database = argv[1] || engineRepo || database
    if (mode === 'q3lcc'
        || mode === 'q3rcc'
        || mode === 'q3cpp'
        || mode === 'lburg'
        || mode === 'tools'
    )
        selected = argv[1] || toolsRepo
    if (mode === 'q3asm')
        selected = argv[1] || toolsRepo2
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


    api.configuration = configuration.value === 'debug' ? 'debug' : 'release'


    term.write(`Starting ${mode} linking...\n\r`);


    if (selected === engineRepo) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(q3eCommonHeaders, 10, selected)
    }

    if (selected === gameRepo) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, selected)
    }

    if (selected === toolsRepo) {
        await downloadHeaders(lccToolHeaders, 10, selected)
    }

    if (selected === toolsRepo2) {
        await downloadHeaders(asmToolHeaders, 10, selected)
    }


    if (mode === 'stringify' || mode === 'all')
        await linkStringify(selected, true)

    if (mode === 'client' || mode === 'engine'
        || mode === 'shaders' || mode === 'release'
        || mode === 'debug' || mode === 'all'
    )
        await linkEngine(selected, true)

    if (mode === 'lburg' || mode === 'tools' || mode === 'all')
        await linkLburg(selected, true)
    if (mode === 'q3rcc' || mode === 'tools' || mode === 'all')
        await linkRCC(selected, true)
    if (mode === 'q3cpp' || mode === 'tools' || mode === 'all')
        await linkCPP(selected, true)
    if (mode === 'q3lcc' || mode === 'tools' || mode === 'all')
        await linkLCC(selected, true)
    if (mode === 'q3asm' || mode === 'tools' || mode === 'all')
        await linkAsm(selected, true)


    if (mode === 'game' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'game', dirs.QADIR, gameFiles, true)
    if (mode === 'cgame' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'cgame', dirs.CGDIR, cgameFiles, true)
    if (mode === 'ui' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'ui', dirs.UIDIR, uiFiles, true)
    if (mode === 'q3_ui' || mode === 'qvms' || mode === 'all')
        await linkModule(selected, 'q3_ui', dirs.Q3UIDIR, q3uiFiles, true)

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
    let selected = argv[1] || engineRepo || database

    if (file.includes('src')
        || file.includes('cpp')
        || file.includes('etc')
        || file.includes('lburg')
    ) {
        selected = toolsRepo
    }

    if (q3asmFiles.indexOf(file) > -1) {
        selected = toolsRepo2
    }


    if (file.includes('code/client')
        || file.includes('code/server')
        || file.includes('code/qcommon')
        || file.includes('code/renderer2')
        || file.includes('code/botlib')
        || file.includes('code/wasm')
        || file.includes('code/renderercommon')
    ) {
        selected = engineRepo
    }

    if (file.includes('code/cgame')
        || file.includes('code/game')
        || file.includes('code/q3_ui')
        || file.includes('code/ui')
    ) {
        selected = gameRepo
    }


    let parts = selected.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    if (!files[selected]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }

    if (selected === engineRepo
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

    if (selected === gameRepo || file.includes('code/game')
        || file.includes('code/cgame') || file.includes('code/ui')
        || file.includes('code/q3_ui')) // TODO: || file.includes('code/') && !file.includes('code/'))
    {
        await downloadHeaders(qvmHeaders, 10, selected)
    }

    if (selected === toolsRepo || file.includes('src/')
        || file.includes('cpp/') || file.includes('etc/')
        || file.includes('lburg/')) {
        await downloadHeaders(lccToolHeaders, 10, selected)
    }

    if (selected === toolsRepo2 || q3asmFiles.indexOf(file) > -1) {
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

    if (selected === gameRepo
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
                (configuration.value === 'pre' ? '-g' : '-g2'),
                '-v',
                tempPath,
                outPath //.split('/').pop(),
            ],
            database: selected,
            toolsRepo: toolsRepo,
            paths: [outPath, tempPath],
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
        database: database,
        github_token: api.github_token
    })
}
function reset() {
    term.reset()
}
function clear() {
    term.clear()
    triggerIncrementalSave()
}
