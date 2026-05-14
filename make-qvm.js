/**
 * Quake3e Build Configuration Script - QVM Version
 */


// Shared files used across all modules
const commonFiles = [
    'bg_lib.o', 'bg_misc.o', 'bg_pmove.o', 'bg_slidemove.o',
    'q_math.o', 'q_shared.o'
];

// Client Game (cgame) specific files
const cgameFiles = [
    ...commonFiles,
    'cg_main.o', 'cg_consolecmds.o', 'cg_draw.o', 'cg_drawtools.o',
    'cg_effects.o', 'cg_ents.o', 'cg_event.o', 'cg_info.o',
    'cg_localents.o', 'cg_marks.o', 'cg_players.o', 'cg_playerstate.o',
    'cg_predict.o', 'cg_scoreboard.o', 'cg_servercmds.o', 'cg_snapshot.o',
    'cg_view.o', 'cg_weapons.o', 'cg_syscalls.o'
];

// Server Game (qagame) specific files
const gameFiles = [
    ...commonFiles,
    'g_main.o', 'ai_chat.o', 'ai_cmd.o', 'ai_dmnet.o', 'ai_dmq3.o',
    'ai_main.o', 'ai_team.o', 'ai_vcmd.o', 'g_active.o', 'g_arenas.o',
    'g_bot.o', 'g_client.o', 'g_cmds.o', 'g_combat.o', 'g_items.o',
    'g_mem.o', 'g_misc.o', 'g_missile.o', 'g_mover.o', 'g_rotation.o',
    'g_session.o', 'g_spawn.o', 'g_svcmds.o', 'g_target.o', 'g_team.o',
    'g_trigger.o', 'g_utils.o', 'g_unlagged.o', 'g_weapon.o', 'g_syscalls.o'
];

// User Interface (ui) specific files
const q3uiFiles = [
    ...commonFiles,
    'ui_main.o', 'ui_addbots.o', 'ui_atoms.o', 'ui_cdkey.o',
    'ui_cinematics.o', 'ui_confirm.o', 'ui_connect.o', 'ui_controls2.o',
    'ui_credits.o', 'ui_demo2.o', 'ui_display.o', 'ui_gameinfo.o',
    'ui_ingame.o', 'ui_loadconfig.o', 'ui_menu.o', 'ui_mfield.o',
    'ui_mods.o', 'ui_network.o', 'ui_options.o', 'ui_playermodel.o',
    'ui_players.o', 'ui_playersettings.o', 'ui_preferences.o', 'ui_qmenu.o',
    'ui_removebots.o', 'ui_saveconfig.o', 'ui_serverinfo.o', 'ui_servers2.o',
    'ui_setup.o', 'ui_sound.o', 'ui_sparena.o', 'ui_specifyserver.o',
    'ui_splevel.o', 'ui_sppostgame.o', 'ui_spskill.o', 'ui_startserver.o',
    'ui_team.o', 'ui_teamorders.o', 'ui_video.o', 'ui_syscalls.o'
];


const uiFiles = [
    'ui_main.o',
    'ui_atoms.o',
    'ui_gameinfo.o',
    'ui_players.o',
    'ui_shared.o',
    'ui_syscalls.o'
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
    "cgame/cg_public.h",   // Engine interface for CGame
    "cgame/cg_local.h",    // CGame module internal state
    "cgame/tr_types.h",    // Renderer types shared with CGame

    // --- UI Module Interfaces ---
    "ui/ui_public.h",      // Engine interface for UI
    "q3_ui/ui_local.h",    // UI module internal state
    "ui/keycodes.h",

    // --- VM Syscall Definitions ---
    // These define the trap() calls for the VM to talk to the engine
    "game/g_syscalls.h",
    "cgame/cg_syscalls.h",
    "ui/ui_syscalls.h"
].map(file => path.join(config.MOUNT_DIR, file));


/**
 * QVM Specific Flags
 * QVMs typically use -DQ3_VM and -S (to generate assembly files 
 * before being passed to q3asm)
 */
const QVMLIB_CFLAGS = [
    "-cc1",
    "-emit-obj",
    "-Wimplicit",
    "-Wstrict-prototypes",
    "-Werror-implicit-function-declaration",
];


const QVM_CFLAGS = [
    '-D__STDC__=1',
    '-D__STRICT_ANSI__',
    '-D__signed__=signed',
    '-DQ3_VM',
    '-D__LCC__',
    '-D__CHAR_UNSIGNED__',
    '-U_CHAR_IS_SIGNED',
    "-Icode/game",
    "-Icode/cgame",
    "-Icode/q3_ui"
];


let QVM_MODE = true;


const QVM_PREAMBLE = '\x1b[38;5;135m[QVM]\x1b[0m '
const QVMERR_PREAMBLE = '\x1b[38;5;161m[QVM ERROR]\x1b[0m '



async function buildModule(name, sourceDir, filesList, database, extraDefines = []) {

    TERMINATE = false
    PREAMBLE = QVM_PREAMBLE

    log(`Compiling ${name} module...`);


    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value


    if (needsHeaders) {
        log("Syncing QVM Headers...");
        await downloadHeaders(qvmHeaders, 10, database);
    }

    PREAMBLE = QVM_PREAMBLE

    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    log(`Building ${name}.qvm...`);

    if (!files[database]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }


    let DEBUG_CFLAGS = BUILDCFLAGS(CONFIGURATION)


    for (const file of filesList) {
        if (TERMINATE) return

        let srcPath;
        // Q3 Makefile logic: shared files are in the game/ directory
        if (file.startsWith('bg_') || file.startsWith('q_')) {
            srcPath = path.join(dirs.QADIR, file.replace('.o', '.c'));
        } else {
            srcPath = path.join(sourceDir, file.replace('.o', '.c'));
        }

        try {

            PREAMBLE = QVM_PREAMBLE

            // TODO: if using q3lcc
            let outPath = path.join(CONFIGURATION, name, file);
            if (QVM_MODE)
                outPath = path.join(CONFIGURATION, name, file.replace('.o', '.asm'));

            const tempPath = path.join(CONFIGURATION, name, file.replace('.o', '.i'));

            if (!files[database][srcPath]) {
                debugger
            }
            const sha = files[database][srcPath].sha;
            const content = await cacheFile(ownerName, repoName, srcPath, sha);


            let objRecord = await getRecord(DB_STORE_NAME, outPath, database)
            FS.virtual[outPath] = objRecord

            if (FS.virtual[outPath]
                && FS.virtual[srcPath]?.timestamp < FS.virtual[outPath]?.timestamp
            ) {
                log(`${outPath} already up to date...\n\r`)

                continue
            }

            log(`QVMCC: ${srcPath}`);

            let CCFLAGS = [
                ...(QVM_MODE ? [] : QVMLIB_CFLAGS),
                ...QVM_CFLAGS,
                ...(QVM_MODE ? [] : DEBUG_CFLAGS),
                ...extraDefines.map(d => `-D${d}`),
            ]

            if (QVM_MODE) {

                await api.run({
                    tool: 'q3cpp.js.wasm',
                    args: [
                        'q3cpp', // '-v', '-v',
                        ...QVM_CFLAGS,
                        ...extraDefines.map(d => `-D${d}`),
                        srcPath,
                        tempPath,
                    ],
                    database: database,
                    toolsRepo: toolsRepo,
                    paths: [srcPath, tempPath],

                })

                await api.run({
                    tool: 'q3rcc.js.wasm',
                    args: [
                        'q3rcc', // '-v', '-v',
                        '-target=bytecode',
                        '-v',
                        tempPath,
                        outPath.split('/').pop(),
                    ],
                    database: database,
                    toolsRepo: toolsRepo,
                    paths: [outPath, tempPath],
                })
            }
            else {
                await api.compile({
                    CFLAGS: CCFLAGS,
                    contents: content,
                    input: srcPath,
                    database,
                    obj: outPath // For QVM, we output .asm first
                });
            }

        } catch (e) {
            PREAMBLE = QVMERR_PREAMBLE
            log(`CC: ${srcPath}: ${e.message}\n\r${e.stack || e.stacktrace}`);
        }
    }

    if (TERMINATE) return


    await linkModule(database, name, filesList)
}




async function linkModule(database, name, filesList) {
    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value


    let CONFIGURATION = api.configuration == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    PREAMBLE = QVM_PREAMBLE

    // Link phase (q3asm)
    const qvmOutput = path.join(CONFIGURATION, repoName || config.MOD, `${name === 'game' ? 'qagame' : name}.qvm`);
    log(`Assembling ${qvmOutput}...`);

    let qvmObjs = filesList.map(file => path.join(CONFIGURATION, name, file))



    let exeRecord = await getRecord(DB_STORE_NAME, qvmOutput, database)
    FS.virtual[qvmOutput] = exeRecord


    if (FS.virtual[qvmOutput]
        // TODO: compare LATEST input and output mtime
        // && FS.virtual[file]?.timestamp < FS.virtual[qvmOutput]?.timestamp
    ) {
        log(qvmOutput + " already up to date...");
        return
    }

    log(`LD: ${qvmOutput}\n\r`);


    let LDFLAGS = [
        ...(QVM_MODE ? [] : ["--no-entry"]),
        "-o", qvmOutput,
        ...qvmObjs
    ]
    try {
        if (QVM_MODE) {

            await api.run({
                tool: 'q3asm.js.wasm',
                args: [
                    'q3asm.js.wasm',
                    ...LDFLAGS
                ],
                database: database,
                toolsRepo: toolsRepo2,
                paths: [...qvmObjs, qvmOutput]
            })
        }
        else {

            await api.link({
                LDFLAGS: LDFLAGS,
                obj: qvmObjs,
                database,
                wasm: qvmOutput // Overloading 'wasm' key for the binary output
            });
        }

        log(`Success: ${qvmOutput}`);
    } catch (e) {
        PREAMBLE = QVMERR_PREAMBLE
        log(`Linker Error in ${name}`);
    }
}



async function buildGame(database = null) {
    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true

    await buildModule('game', dirs.QADIR, gameFiles, database, ['QAGAME']);


}


async function buildCGame(database = null) {
    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true


    await buildModule('cgame', dirs.CGDIR, cgameFiles, database, ['CGAME']);


}



async function buildUI(database = null) {
    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true

    await buildModule('ui', dirs.UIDIR, uiFiles, database, ['UI']);


}




async function buildUI(database = null) {
    if (!database) database = gameRepo || api.database;

    needsHeaders = true

    await buildModule('ui', dirs.Q3UIDIR, uiFiles, database, ['UI']);


}







async function buildQVM(database = null) {
    if (!database) database = gameRepo || api.database;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    TERMINATE = false
    PREAMBLE = QVM_PREAMBLE

    // 3. Start building modules
    log("Starting QVM compilation...");

    needsHeaders = true


    // CGAME
    await buildModule('cgame', dirs.CGDIR, cgameFiles, database, ['CGAME']);


    if (TERMINATE) return


    // 2. Build GAME (qagame)
    await buildModule('game', dirs.QADIR, gameFiles, database, ['QAGAME']);

    if (TERMINATE) return


    // 3. Build UI
    await buildModule('ui', dirs.UIDIR, uiFiles, database, ['UI']);

    if (TERMINATE) return



    // 3. Build UI
    await buildModule('q3_ui', dirs.Q3UIDIR, q3uiFiles, database, ['UI']);

    if (TERMINATE) return



    log("QVM Build Process Finished.");
}