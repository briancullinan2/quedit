/**
 * Quake3e Build Configuration Script - QVM Version
 */

/**
 * Quake3e Build Configuration Script - QVM Version
 * Fixed Ordering to Ensure Precise Code Segment Alignment (Index 0 Entry)
 */

// Shared structural dependencies used across all executable modules
// Explicitly removed from the top of module vectors to preserve entry offsets
const commonFiles = [
    'bg_misc.o', 'bg_lib.o', 'bg_pmove.o', 'bg_slidemove.o',
    'q_math.o', 'q_shared.o'
];

// Client Game (cgame) module file sequence
const cgameFiles = [
    'cg_main.o', 'cg_syscalls.o', // CRITICAL: Entry point and system trap must occupy index 0 and 1
    'cg_consolecmds.o', 'cg_draw.o', 'cg_drawtools.o', 'cg_effects.o',
    'cg_ents.o', 'cg_event.o', 'cg_info.o', 'cg_localents.o',
    'cg_marks.o', 'cg_players.o', 'cg_playerstate.o', 'cg_predict.o',
    'cg_scoreboard.o', 'cg_servercmds.o', 'cg_snapshot.o', 'cg_view.o',
    'cg_weapons.o',
    ...commonFiles
];

// Server Game (qagame) module file sequence
const gameFiles = [
    'g_main.o', 'g_syscalls.o', // CRITICAL: Entry point and system trap must occupy index 0 and 1
    'ai_dmnet.o', 'ai_dmq3.o', 'ai_team.o', 'ai_main.o', 'ai_chat.o',
    'ai_cmd.o', 'ai_vcmd.o',
    'g_active.o', 'g_arenas.o', 'g_bot.o', 'g_client.o', 'g_cmds.o',
    'g_combat.o', 'g_items.o', 'g_mem.o', 'g_misc.o', 'g_missile.o',
    'g_mover.o', 'g_rotation.o', 'g_session.o', 'g_spawn.o', 'g_svcmds.o',
    'g_target.o', 'g_team.o', 'g_trigger.o', 'g_unlagged.o', 'g_utils.o',
    'g_weapon.o',
    ...commonFiles
];

// User Interface (ui / q3_ui) consolidated working target directory list
const q3uiFiles = [
    'ui_main.o', 'ui_syscalls.o', // CRITICAL: Entry point and system trap must occupy index 0 and 1
    'ui_gameinfo.o', 'ui_atoms.o', 'ui_cinematics.o', 'ui_connect.o',
    'ui_controls2.o', 'ui_demo2.o', 'ui_mfield.o', 'ui_credits.o',
    'ui_menu.o', 'ui_ingame.o', 'ui_confirm.o', 'ui_setup.o',
    'ui_options.o', 'ui_display.o', 'ui_sound.o', 'ui_network.o',
    'ui_playermodel.o', 'ui_players.o', 'ui_playersettings.o', 'ui_preferences.o',
    'ui_qmenu.o', 'ui_serverinfo.o', 'ui_servers2.o', 'ui_sparena.o',
    'ui_specifyserver.o', 'ui_sppostgame.o', 'ui_splevel.o', 'ui_spskill.o',
    'ui_startserver.o', 'ui_team.o', 'ui_video.o', 'ui_addbots.o',
    'ui_removebots.o', 'ui_teamorders.o', 'ui_loadconfig.o', 'ui_saveconfig.o',
    'ui_cdkey.o', 'ui_mods.o',
    'bg_misc.o', 'bg_lib.o',
    'q_math.o', 'q_shared.o'
];


const uiFiles = [
    'ui_main.o',
    'ui_syscalls.o',
    'ui_atoms.o',
    'ui_gameinfo.o',
    'ui_players.o',
    'ui_shared.o',
    'bg_misc.o', 'bg_lib.o',
    'q_math.o', 'q_shared.o'
]


const qvmHeaders = [
    // --- Shared Core Engine Headers ---
    "game/q_shared.h",
    "game/q_platform.h",
    "game/qcommon.h",
    "game/qfiles.h",
    "game/surfaceflags.h",
    "game/unzip.h",
    "game/cm_public.h",
    "game/cm_local.h",
    "game/g_team.h",
    "game/g_cvar.h",
    "game/be_aas.h",
    "game/be_ea.h",
    "game/be_ai_char.h",
    "game/be_ai_chat.h",
    "game/be_ai_gen.h",
    "game/be_ai_goal.h",
    "game/be_ai_move.h",
    "game/be_ai_weap.h",
    "game/ai_dmq3.h",
    "game/ai_cmd.h",
    "game/ai_dmnet.h",
    "game/chars.h",
    "game/inv.h",
    "game/syn.h",
    "game/match.h",
    "game/ai_vcmd.h",

    // --- Game Module Interfaces ---
    "game/g_public.h",     // Engine interface for Game
    "game/bg_public.h",    // Shared Game/CGame logic
    "game/bg_local.h",
    "game/bg_lib.h",
    "game/bg_events.h",
    "game/bg_mods.h",
    "game/g_local.h",      // Game module internal state
    "game/ai_chat.h",
    "game/ai_main.h",
    "game/ai_team.h",
    "game/botlib.h",

    // --- CGame Module Interfaces ---
    "cgame/cg_cvar.h",
    "cgame/cg_public.h",   // Engine interface for CGame
    "cgame/cg_local.h",    // CGame module internal state
    "cgame/tr_types.h",    // Renderer types shared with CGame

    // --- UI Module Interfaces ---
    "q3_ui/ui_cvar.h",
    "q3_ui/ui_local.h",    // UI module internal state
    "q3_ui/ui_public.h",      // Engine interface for UI
    "q3_ui/keycodes.h",
    "ui/menudef.h",
    "ui/ui_local.h",
    "ui/ui_cvar.h",
    "ui/ui_public.h",
    "ui/ui_shared.h",
    "ui/keycodes.h",

    // --- VM Syscall Definitions ---
    // These define the trap() calls for the VM to talk to the engine
    "game/g_syscalls.h",
    "cgame/cg_syscalls.h",
    "ui/ui_syscalls.h"
].map(file => path.join(config.MOUNT_DIR, file));


const QVMLIB_CFLAGS = [
    "-cc1",
    "-emit-obj",
    "-triple", "wasm32-wasi",
    "-O2",
    "-mrelocation-model", "static",
    //"-pic-level", "2",
    //'-menable-no-nans',
    "-isysroot", "/",
    "-internal-isystem", "include/c++/v1",
    "-internal-isystem", "include",
    "-internal-isystem", "include/wasi-emulated-signal", // ◄◄ RESTORE THIS
    "-internal-isystem", "lib/clang/8.0.1/include",

    "-ftls-model=global-dynamic",                        // ◄◄ RESTORE THIS
    "-D_Thread_local=",
    "-DSIG_IGN=(void (*)(int))1",
    "-Dsignal(s,h)=SIG_IGN",
    "-D_WASI_EMULATED_MMAN=1",                           // ◄◄ RESTORE THIS
    "-D_WASI_EMULATED_SIGNAL=1",                         // ◄◄ RESTORE THIS
    "-D_XOPEN_SOURCE=700",
    "-D__wasi__=1",
    "-D__WASM__=1",
    "-std=gnu11",

    "-disable-free",
    "-fno-common",
    "-fno-rtti",
    "-fno-use-init-array",
    "-fno-threadsafe-statics",
    "-ferror-limit", "100",
];


const QVM_CFLAGS = [
    //'-D__STDC__=1',
    //'-D__STRICT_ANSI__',
    //'-D__signed__=signed',
    //'-DQ3_VM',
    //'-D__LCC__',
    //'-D__CHAR_UNSIGNED__',
    //'-U_CHAR_IS_SIGNED',
    ,
    "-Icode/cgame",
    "-Icode/q3_ui"
];

// Base LDFLAGS shared across all modules
const SHLIB_LDFLAGS = [
    //"-D__WASM__=1",
    //"--no-standard-libraries",
    '--no-threads',
    "--export-dynamic",
    '--export=dllEntry',
    '--export=vmMain',
    //"-fvisibility", "hidden",
    //"--experimental-pic",
    //"-shared",
    "--error-limit=200",
    "--import-memory",
    "--import-table",
    '-z', `stack-size=${1024 * 1024}`,
    //"--stack-first",
    '-Llib/wasm32-wasi',
    "--global-base=32",
    //"--table-base=1024",
    //"--growable-table",
    // Link against the builtins and libc.a
    //path.join(vars.WASI_BUILTINS, "lib/wasi/libclang_rt.builtins-wasm32.a"),
    //path.join(vars.WASISDK, "share/wasi-sysroot/lib/wasm32-wasi/libc.a")
];

let QVM_MODE = false;



async function buildModule(name, sourceDir, filesList, database, extraDefines = [], forceChanged = false, noLinking = false /* called from linkModule */, noBounce = false) {

    PREAMBLE = QVM_PREAMBLE
    QVM_MODE = typeof api !== 'undefined' ? api.configuration === 'qvms' : false

    if (buildDebounce) {
        clearTimeout(buildDebounce)
    }

    if (!noBounce) {
        buildDebounce = setTimeout(() => buildModule(name, sourceDir, filesList, database, extraDefines, forceChanged, noLinking, true), 500)
        return
    }

    if (building) return
    building = true

    try {
        writeLog(`Compiling ${name} module...`);


        if (!database) database = gameRepo || api.database;
        const parts = database.split('/')
        const ownerName = parts.length == 2 ? parts[0] : owner.value
        const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value


        if (needsHeaders) {
            writeLog("Syncing QVM Headers...");
            await downloadHeaders(qvmHeaders, 10, database);
        }

        PREAMBLE = QVM_PREAMBLE

        let CONFIGURATION = api.configuration == 'release'
            ? dirs.ENGINE_RELEASE
            : dirs.ENGINE_DEBUG

        writeLog(`Building ${name}.qvm...`);

        if (!files[database]) {
            let branch = await getDefaultBranch(ownerName, repoName)
            await loadGitHubTree(ownerName, repoName, branch)
        }


        let DEBUG_CFLAGS = BUILDCFLAGS(CONFIGURATION)

        let hasChanged = false

        for (const file of filesList) {
            if (TERMINATE) return

            let src;
            // Q3 Makefile logic: shared files are in the game/ directory
            if (file.startsWith('bg_') || file.startsWith('q_')) {
                src = path.join(dirs.QADIR, file.replace('.o', '.c'));
            } else {
                src = path.join(sourceDir, file.replace('.o', '.c'));
            }

            try {

                PREAMBLE = QVM_PREAMBLE

                // TODO: if using q3lcc
                let obj = path.join(CONFIGURATION, sourceDir, file);
                if (QVM_MODE)
                    obj = obj.replace('.o', '.asm');

                // SKIP: because its already compiled
                if (obj.includes('cg_syscalls.asm')
                    || obj.includes('g_syscalls.asm')
                    || obj.includes('ui_syscalls.asm')
                )
                    continue


                const tempPath = path.join(CONFIGURATION, sourceDir, file.replace('.o', '.i'));


                let content
                if (FS.virtual[src])
                    content = FS.virtual[src].contents
                else if (!src.includes(config.BUILD_DIR + '/'))
                    content = await cacheFile(ownerName, repoName, src);
                else {
                    FS.virtual[src] = await getRecord(DB_STORE_NAME, src, database)
                    if (!FS.virtual[src])
                        throw new Error('Output file not found: ' + src)
                }



                let objRecord = await getRecord(DB_STORE_NAME, obj, database)
                FS.virtual[obj] = objRecord

                if (FS.virtual[obj]
                    && FS.virtual[src]?.timestamp < FS.virtual[obj]?.timestamp
                    && !forceChanged
                ) {
                    writeLog(`${obj} already up to date...`)
                    continue
                }


                hasChanged = true

                writeLog(`QVMCC: ${src}`);

                let DEFINE = extraDefines.map(d => `-D${d}`)
                let vm = 'game'
                if (src.includes('code/cgame')) {
                    DEFINE = ['-DCGAME', "-Icode/cgame"]
                    vm = 'cgame'
                }
                if (src.includes('code/q3_ui')) {
                    DEFINE = ['-DUI', "-Icode/q3_ui"]
                    vm = 'ui'
                }
                if (src.includes('code/ui')) {
                    DEFINE = ['-DUI', "-Icode/ui"]
                    vm = 'q3_ui'
                }


                let CCFLAGS = [
                    ...(QVM_MODE ? [] : QVMLIB_CFLAGS),
                    "-Icode/game",
                    //...(QVM_MODE ? [] : DEBUG_CFLAGS),
                ]



                if (QVM_MODE) {

                    /*
                    await api.run({
                        tool: 'q3cpp.js.wasm',
                        args: [
                            'q3cpp', // '-v', '-v',
                            "-Icode/game",
                            ...extraDefines.map(d => `-D${d}`),
                            src,
                            tempPath,
                        ],
                        database: database,
                        paths: [src, tempPath],

                    })

                    if (TERMINATE) return


                    await api.run({
                        tool: 'q3rcc.js.wasm',
                        args: [
                            'q3rcc', // '-v', '-v',
                            '-target=bytecode',
                            //(api.configuration === 'pre' ? '-g' : '-g2'),
                            //'-v',
                            tempPath,
                            obj //.split('/').pop(),
                        ],
                        database: database,
                        paths: [obj, tempPath],
                    })

                    */


                    await api.run({
                        tool: 'q3lcc.js.wasm',
                        args: [
                            'q3lcc', '-S', '-Wf-g',
                            '-v',
                            "-Icode/game",
                            ...DEFINE,
                            src,
                            '-o', obj,
                        ],
                        database: database,
                        paths: [obj, src],
                    })

                }
                else {
                    await api.compile({
                        CFLAGS: [
                            ...CCFLAGS,
                            ...(src.includes('bg_lib.c') ? ['-DQ3_VM=1'] : []),
                            ...DEFINE,
                            src,
                            '-o', obj,
                        ],
                        contents: content,
                        input: src,
                        database,
                        obj: obj // For QVM, we output .asm first
                    });
                }

            } catch (e) {
                PREAMBLE = QVMERR_PREAMBLE
                writeLog(`CC: ${src}: ${e.message}\n\r${e.stack || e.stacktrace}`);
            }
        }

        if (TERMINATE) return

        if (!noLinking) {


            building = false

            await linkModule(database, name, sourceDir, filesList,
                hasChanged /* always link after build something */,
                true /* prevent loops */,
                true /* already debounced above */
            )

        }

    }
    finally {
        building = false
    }
}




async function linkModule(database, name, sourceDir, filesList, forceChanged = false, noModule = false /* from buildModule */, noBounce = false) {
    if (!database) database = gameRepo || api.database;
    const parts = database.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value


    if (buildDebounce) {
        clearTimeout(buildDebounce)
    }

    if (!noBounce) {
        buildDebounce = setTimeout(() => linkModule(database, name, sourceDir, filesList, forceChanged, noModule /* from buildModule */, true), 500)
        return
    }


    try {

        let CONFIGURATION = api.configuration == 'release'
            ? dirs.ENGINE_RELEASE
            : dirs.ENGINE_DEBUG

        PREAMBLE = QVM_PREAMBLE

        // Link phase (q3asm)
        const qvmOutput = path.join(CONFIGURATION, repoName || config.MOD, `${name === 'game' ? 'qagame' : name}.${QVM_MODE ? 'qvm' : 'wasm'}`);

        let qvmObjs = filesList.map(file => path.join(CONFIGURATION, sourceDir, file))
        if (QVM_MODE)
            qvmObjs = filesList.map(file => {
                if (file.includes('syscalls.o')) {
                    return path.join(sourceDir, file.replace('.o', '.asm'))
                }
                return path.join(CONFIGURATION, sourceDir, file.replace('.o', '.asm'))
            })


        // prevent recursion
        if (!noModule) {

            // called from command or UI

            if (name === 'game')
                await buildModule(name, dirs.QADIR, filesList, database, ['GAME'], false, true /* prevent recursion */, true);

            if (name === 'cgame')
                await buildModule(name, dirs.CGDIR, filesList, database, ['CGAME'], false, true /* prevent recursion */, true);

            if (name === 'ui')
                await buildModule(name, dirs.UIDIR, filesList, database, ['UI'], false, true /* prevent recursion */, true);

            if (name === 'q3_ui')
                await buildModule(name, dirs.Q3UIDIR, filesList, database, ['UI', 'Q3UI'], false, true /* prevent recursion */, true);

        }


        if (TERMINATE) return


        if (building) return
        building = true

        let syscalls = path.join(sourceDir, 'g_syscalls.asm')
        if (name === 'cgame')
            syscalls = path.join(sourceDir, 'cg_syscalls.asm')
        if (name === 'ui' || name === 'q3_ui')
            syscalls = path.join(sourceDir, 'ui_syscalls.asm')


        let q3asm = path.join(config.BUILD_DIR, 'win32-qvm', name + '.q3asm')
        if (name === 'cgame')
            q3asm = path.join(config.BUILD_DIR, 'win32-qvm', name + '.q3asm')
        if (name === 'ui' || name === 'q3_ui')
            q3asm = path.join(config.BUILD_DIR, 'win32-qvm', name + '.q3asm')




        if (QVM_MODE) {


            let content
            if (FS.virtual[syscalls])
                content = FS.virtual[syscalls].contents

            content = await cacheFile(ownerName, repoName, syscalls);
            if (!FS.virtual[syscalls]) {
                FS.virtual[syscalls] = await getRecord(DB_STORE_NAME, syscalls, database)
                if (!FS.virtual[syscalls])
                    throw new Error('Syscalls file not found: ' + syscalls)
            }


            let content2
            if (FS.virtual[q3asm])
                content2 = FS.virtual[q3asm].contents

            content2 = await cacheFile(ownerName, repoName, q3asm);
            if (!FS.virtual[q3asm]) {
                FS.virtual[q3asm] = await getRecord(DB_STORE_NAME, q3asm, database)
                if (!FS.virtual[q3asm])
                    throw new Error('Syscalls file not found: ' + q3asm)
            }

            qvmObjs
        }


        let exeRecord = await getRecord(DB_STORE_NAME, qvmOutput, database)
        FS.virtual[qvmOutput] = exeRecord

        writeLog(`Assembling ${qvmOutput}...`);

        if (FS.virtual[qvmOutput] && !forceChanged) {
            writeLog(qvmOutput + " already up to date...");
            return
        }

        writeLog(`LD: ${qvmOutput}`);


        let LDFLAGS = [
            ...(QVM_MODE ? ['-vq3', '-r', '-m', '-v'] : SHLIB_LDFLAGS),
            "-o", qvmOutput, // (QVM_MODE ? name : qvmOutput),
            //...(QVM_MODE ? ['-f', path.join(config.BUILD_DIR, 'win32-qvm', name)] : qvmObjs),
        ]

        if (QVM_MODE) {

            await api.run({
                tool: 'q3asm.js.wasm',
                args: [
                    'q3asm.js.wasm',
                    ...LDFLAGS,
                    ...qvmObjs
                ],
                database: database,
                paths: [...qvmObjs, syscalls, q3asm, qvmOutput]
            })
        }
        else {

            await api.link({
                LDFLAGS: [
                    ...LDFLAGS,
                    '-lm',
                    '--no-entry',
                    '--export=vmMain',
                    '--export=dllEntry',
                    '--allow-undefined',
                    ...qvmObjs
                ],
                obj: qvmObjs,
                database,
                wasm: qvmOutput // Overloading 'wasm' key for the binary output
            });
        }

        writeLog(`Success: ${qvmOutput}`);
    } catch (e) {
        PREAMBLE = QVMERR_PREAMBLE
        writeLog(`Linker Error in ${name}\n\r${e.message}\n\r${e.stack || e.stacktrace}`);
        throw e
    }
    finally {
        building = false
    }
}



async function buildGame(database = null, forceChanged = true) {
    if (!database) database = gameRepo || api.database;
    const parts = database.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value






}


async function buildCGame(database = null, forceChanged = true) {
    if (!database) database = gameRepo || api.database;
    const parts = database.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value



    await buildModule('cgame', dirs.CGDIR, cgameFiles, database, ['CGAME'], forceChanged);


}



async function buildUI(database = null, forceChanged = true) {
    if (!database) database = gameRepo || api.database;
    const parts = database.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value



    await buildModule('ui', dirs.UIDIR, uiFiles, database, ['UI'], forceChanged);


}




async function buildUI(database = null, forceChanged = true) {
    if (!database) database = gameRepo || api.database;



    await buildModule('q3_ui', dirs.Q3UIDIR, q3uiFiles, database, ['UI'], forceChanged);


}







async function buildQVM(database = null, forceChanged = false, noBounce = false) {
    if (!database) database = gameRepo || api.database;
    const parts = database.split('/')
    const ownerName = parts.length == 2 ? parts[0] : owner.value
    const repoName = parts.length == 2 ? parts[1] : parts[0] || repository.value


    PREAMBLE = QVM_PREAMBLE


    if (buildDebounce) {
        clearTimeout(buildDebounce)
    }

    if (!noBounce) {
        buildDebounce = setTimeout(() => buildQVM(database, forceChanged, true), 500)
        return
    }

    if (building) return
    building = true

    try {
        // 3. Start building modules
        writeLog("Starting QVM compilation...");


        // CGAME
        await buildModule('cgame', dirs.CGDIR, cgameFiles, database, ['CGAME'], forceChanged, false, true);


        if (TERMINATE) return


        // 2. Build GAME (qagame)
        await buildModule('game', dirs.QADIR, gameFiles, database, ['QAGAME'], forceChanged, false, true);

        if (TERMINATE) return


        // 3. Build UI
        await buildModule('ui', dirs.UIDIR, uiFiles, database, ['UI'], forceChanged, false, true);

        if (TERMINATE) return



        // 3. Build UI
        await buildModule('q3_ui', dirs.Q3UIDIR, q3uiFiles, database, ['UI'], forceChanged, false, true);

        if (TERMINATE) return



        writeLog("QVM Build Process Finished.");
    }
    finally {
        building = false
    }
}