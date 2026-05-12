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
const uiFiles = [
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


const qvmHeaders = [
    // --- Shared Core Engine Headers ---
    "qcommon/q_shared.h",
    "qcommon/q_platform.h",
    "qcommon/qcommon.h",
    "qcommon/qfiles.h",
    "qcommon/surfaceflags.h",
    "qcommon/unzip.h",
    "qcommon/cm_public.h",
    "qcommon/cm_local.h",

    // --- Game Module Interfaces ---
    "game/g_public.h",     // Engine interface for Game
    "game/bg_public.h",    // Shared Game/CGame logic
    "game/bg_local.h",
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
const QVM_CFLAGS = [
    "-S",
    "-Wimplicit",
    "-Wstrict-prototypes",
    "-DQ3_VM",
    "-D_Q3_VM",
    "-I/code/game",
    "-I/code/cgame",
    "-I/code/q3_ui"
];

// --- Build Logic ---


async function buildModule(name, sourceDir, filesList, database, extraDefines = []) {
    log(`Compiling ${name} module...`);
    const asmFiles = [];

    if (!database) database = gameRepo || owner.value + '/' + repo.value;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value


    if (needsHeaders) {
        log("Syncing QVM Headers...");
        await downloadHeaders(qvmHeaders, 10, database);
    }

    let CONFIGURATION = configuration.value == 'release'
        ? dirs.ENGINE_RELEASE
        : dirs.ENGINE_DEBUG

    log(`Building ${name}.qvm...`);

    if (!files[database]) {
        let branch = await getDefaultBranch(ownerName, repoName)
        await loadGitHubTree(ownerName, repoName, branch)
    }


    for (const file of filesList) {
        let srcPath;
        // Q3 Makefile logic: shared files are in the game/ directory
        if (file.startsWith('bg_') || file.startsWith('q_')) {
            srcPath = path.join(dirs.QADIR, file.replace('.o', '.c'));
        } else {
            srcPath = path.join(sourceDir, file.replace('.o', '.c'));
        }

        const asmPath = path.join(CONFIGURATION, name, file.replace('.o', '.asm'));

        try {
            const sha = files[database][srcPath].sha;
            const content = await cacheFile(ownerName, repoName, srcPath, sha);

            log(`QVMCC: ${srcPath}`);
            await api.compile({
                CFLAGS: [...QVM_CFLAGS, ...extraDefines.map(d => `-D${d}`)],
                contents: content,
                width: term.cols,
                input: srcPath,
                database,
                obj: asmPath // For QVM, we output .asm first
            });
            asmFiles.push(asmPath);
        } catch (e) { log(`Error CC: ${srcPath}: ${e.message}\n\r${e.stack || e.stacktrace}`); }
    }

    // Link phase (q3asm)
    log(`Assembling ${name}.qvm...`);
    const qvmOutput = path.join(CONFIGURATION, config.MOD, `${name === 'game' ? 'qagame' : name}.qvm`);

    try {
        await api.link({
            LDFLAGS: ["-o", qvmOutput],
            obj: asmFiles,
            database,
            wasm: qvmOutput // Overloading 'wasm' key for the binary output
        });
        log(`Success: ${qvmOutput}`);
    } catch (e) { log(`Linker Error in ${name}`); }
}



async function buildGame(database = null) {
    if (!database) database = gameRepo || owner.value + '/' + repo.value;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true

    await buildModule('game', dirs.CDIR, cgameFiles, database, ['CGAME']);


}


async function buildCGame(database = null) {
    if (!database) database = gameRepo || owner.value + '/' + repo.value;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true


    await buildModule('cgame', dirs.CDIR, cgameFiles, database, ['CGAME']);


}



async function buildUI(database = null) {
    if (!database) database = gameRepo || owner.value + '/' + repo.value;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value

    needsHeaders = true

    await buildModule('ui', dirs.CDIR, cgameFiles, database, ['CGAME']);


}







async function buildQVM(database = null) {
    if (!database) database = gameRepo || owner.value + '/' + repo.value;
    let parts = database.split('/')
    let ownerName = parts.length == 2 ? parts[0] : owner.value
    let repoName = parts.length == 2 ? parts[1] : parts[0] || repo.value


    // 3. Start building modules
    log("Starting QVM compilation...");

    needsHeaders = true


    // CGAME
    await buildModule('cgame', dirs.CDIR, cgameFiles, database, ['CGAME']);

    // 2. Build GAME (qagame)
    await buildModule('game', dirs.QADIR, gameFiles, database, ['QAGAME']);

    // 3. Build UI
    await buildModule('ui', dirs.UIDIR, uiFiles, database, ['UI']);

    log("QVM Build Process Finished.");
}