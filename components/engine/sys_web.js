
const MATCH_ADDRESS = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/gi
const MODNAME = 'demoq3';


function getQueryCommands() {
	// Wow, look at all the unfuckery I don't have to do with startup options because
	//   I'm not using emscripten anymore.
	let startup = [
		'quake3e_web',
		'+set', 'fs_basepath', '/base',
		'+set', 'fs_homepath', '/home',
		'+set', 'sv_pure', '0', // require for now, TODO: server side zips
		'+set', 'r_mode', '-2',
		'+set', 'net_socksServer', window.location.hostname || '',
		'+set', 'net_socksPort', window.location.port
		|| (window.location.protocol == 'https:' ? '443' : '80'),
		'+set', 'sv_fps', '60',
		'+set', 'com_hunkMegs', '256',
		'+set', 'snaps', '60',
		// ISN'T HELPING STUPID NETWORK CRASH BUG
		//'+set', 'cl_nodelta', '1',
		'+set', 'r_fastsky', '0',
		// use high pic mip because images are displayed at the initial quality
		//   they are loaded by the browser, so even the highest picmip (worst quality)
		//   will have the same image but backend won't spend so much time on it.
		'+set', 'r_picmip', '16',
		//'+set', 's_initsound', '0',
		// it doesn't make sense to display a CD key in this client because it doesn't
		//   come with any game content
		'+set', 'ui_cdkeychecked', '1',
		// TURN OFF UDP DOWNLOADS, TURN ON REDIRECT
		'+set', 'cl_allowDownload', '5',
		// each one of the following has a special meaning
		//'+set', 'r_ext_multitexture', '0',
		// not implemented in javascript?
		'+set', 'r_ignorehwgamma', '1',
		// FBO shows up all black and textures don't bind, 
		//   but this should work in theory with WebGL
		'+set', 'r_ext_framebuffer_object', '0',
		'+set', 'r_ext_direct_state_access', '0',
		// Cause of FBO bug above?
		'+set', 'r_overBrightBits', '0',
		// this was replaced in QuakeJS, instead of replacing, just change cvar
		'+set', 'r_drawBuffer', 'GL_NONE',
		'+set', 'r_ext_texture_filter_anisotropic', '1',
		//'+set', 'r_finish', '1',
		// save time loading???
		'+set', 'r_vertexLight', '0',
		'+set', 'r_dynamiclight', '1',

		//'+set', 'r_ext_framebuffer_multisample', '0',
		// this prevents lightmap from being wrong when switching maps
		//   renderer doesn't restart between maps, but BSP loading updates
		//   textures with lightmap by default, so this keeps them separate
		'+set', 'r_mergeLightmaps', '0',
		//'+set', 'r_deluxeMapping', '0',
		//'+set', 'r_normalMapping', '0',
		//'+set', 'r_specularMapping', '0',
		'+set', 'fs_restrict', '0',
		'+set', 'vm_ui', '0',
		'+set', 'vm_game', '0',
		'+set', 'vm_cgame', '0',
	]
	startup.push.apply(startup, window.preStart)
	// TODO: full screen by default? I suppose someone might 
	//   want to embed in the center of a page, edit CSS instead of JS?
	startup.push.apply(startup, [
		'+set', 'r_fullscreen', window.fullscreen ? '1' : '0',
		'+set', 'r_customHeight', '' + GL.canvas.clientHeight || 0,
		'+set', 'r_customWidth', '' + GL.canvas.clientWidth || 0,
		'+set', 'r_customAspect', '' + (Math.round(GL.canvas.clientWidth / GL.canvas.clientHeight * 100) / 100) || 0,
	])
	// meant to do this a lot sooner, with a download, we can just package
	//   whatever pk3/autoexec we want with the game.
	// but with web, we might be serving multiple sources, file:///index.html
	//   http://localhost/ and public quake.games/lvlworld. so i don't have
	//   to repackage for every source, check the domain we're on.
	let hostname = (/^(.*?)\./i).exec(window.location.hostname)
	let gamename = false
	if (hostname) {
		gamename = hostname[1]
	} else
		if (window.location.protocol == 'file:') {
			gamename = 'localhost'
		}

	if (gamename) {
		//startup.push.apply(startup, [
		//	'+set', 'fs_game', gamename,
		//])
		if (typeof FS.virtual[gamename] == 'undefined') {
			FS.virtual[gamename] = {
				timestamp: new Date(),
				mode: FS_DIR,
				size: 4096,
				path: gamename,
				parent: gamename.substring(0, gamename.lastIndexOf('/'))
			}
		}
	}

	let search = /([^&=]+)/g
	let query = window.location.search.substring(1)
	let match
	while (match = search.exec(query)) {
		let val = decodeURIComponent(match[1])
		val = val.split(' ')
		val[0] = (val[0][0] != '+' ? '+' : '') + val[0]
		startup.push.apply(startup, val)
	}


	// TODO: from URL or default.cfg?
	if (!startup.includes('fs_game')) {
		startup.push.apply(startup, [
			'+set', 'fs_basegame', MODNAME,
			'+set', 'fs_game', MODNAME,
		])
		if (typeof FS.virtual[config.RUNBASE + '/' + MODNAME] == 'undefined') {
			FS.virtual[config.RUNBASE + '/' + MODNAME] = {
				timestamp: new Date(),
				mode: FS_DIR,
				size: 4096,
				path: config.RUNBASE + '/' + MODNAME,
				parent: config.RUNBASE
			}
		}
	}

	// try to get connect address out of window
	let connectAddr = MATCH_ADDRESS.exec(window.location.pathname)
	if (connectAddr && !startup.includes('map')
		&& !startup.includes('spmap') && !startup.includes('devmap')
		&& !startup.includes('spdevmap')) {
		startup.push.apply(startup, [
			'+connect', connectAddr[0],
		])
	}

	return startup
}




function Sys_UnloadLibrary(namePtr) {
	debugger;
}

const loadedWasmModules = {};
let nextModuleHandle = 0x1000;

function Sys_LoadLibrary(namePtr) {
	// 1. Resolve path string out of WASM memory
	let sPtr = namePtr;
	let filename = "";
	const memoryView = new Uint8Array(ENV.memory.buffer);
	while (memoryView[sPtr] !== 0) {
		filename += String.fromCharCode(memoryView[sPtr]);
		sPtr++;
	}

	let searchPath = filename;
	if (searchPath.endsWith('.so') || searchPath.endsWith('.dll')) {
		searchPath = searchPath.substring(0, searchPath.lastIndexOf('.')) + '.wasm';
	}

	const wasmFileRecord = FS.virtual[searchPath];
	if (!wasmFileRecord || !wasmFileRecord.contents) {
		console.error(`[Sys_LoadLibrary] File missing: ${searchPath}`);
		return 0;
	}

	const bytes = new Uint8Array(wasmFileRecord.contents);
	let allocatedMemoryAddress = UI_MEMORY_BASE;
	if (filename.includes('cgame'))
		allocatedMemoryAddress = CGAME_MEMORY_BASE;
	if (filename.includes('game'))
		allocatedMemoryAddress = GAME_MEMORY_BASE;

	// =========================================================================
	// STEP 2: PROVISION ISOLATED TABLE & BACKFILL CORE ENGINE HOOKS
	// =========================================================================
	const localSideModuleTable = new WebAssembly.Table({
		element: "anyfunc",
		initial: 4096,
		maximum: 8192
	});

	const masterTableSize = ENV.table.length;
	for (let i = 0; i < masterTableSize; i++) {
		try {
			const engineFunc = ENV.table.get(i);
			if (engineFunc) {
				localSideModuleTable.set(i, engineFunc);
			}
		} catch (e) {
			// Safe escape vector for sparse/empty indices in the master table
		}
	}

	const sideModuleEnv = {};
	if (ENV.exports && ENV.exports.__stack_pointer) {
		sideModuleEnv.__stack_pointer = ENV.exports.__stack_pointer;
	} else if (!(ENV.__stack_pointer instanceof WebAssembly.Global)) {
		ENV.__stack_pointer = new WebAssembly.Global({ value: 'i32', mutable: true }, 1024 * 64);
		sideModuleEnv.__stack_pointer = ENV.__stack_pointer;
	}

	sideModuleEnv.memory = ENV.memory;
	sideModuleEnv.__indirect_function_table = localSideModuleTable;
	sideModuleEnv.__memory_base = allocatedMemoryAddress;
	sideModuleEnv.__table_base = 0;

	sideModuleEnv.sin = Math.sin;
	sideModuleEnv.atan2 = Math.atan2;
	sideModuleEnv.cos = Math.cos;
	sideModuleEnv.env = sideModuleEnv.wasi_snapshot_preview1 = sideModuleEnv.wasi_unstable = sideModuleEnv;

	try {
		const wasmModule = new WebAssembly.Module(bytes);
		const wasmInstance = new WebAssembly.Instance(wasmModule, { env: sideModuleEnv });

		// =========================================================================
		// STEP 3: EXPORT SUB-MODULE ENTRY POINTS BACK TO MASTER TABLE
		// =========================================================================
		const allocatedTableAddress = ENV.table.length;
		ENV.table.grow(2); // Make room for exactly two incoming main entry vectors

		const vmMainIndex = allocatedTableAddress;
		const dllEntryIndex = allocatedTableAddress + 1;

		if (wasmInstance.exports.vmMain) {
			ENV.table.set(vmMainIndex, wasmInstance.exports.vmMain);
		} else {
			console.error(`[Sys_LoadLibrary] Critical: vmMain export missing from ${filename}`);
		}

		if (wasmInstance.exports.dllEntry) {
			ENV.table.set(dllEntryIndex, wasmInstance.exports.dllEntry);
		}

		const currentHandle = nextModuleHandle++;
		loadedWasmModules[currentHandle] = {
			name: filename,
			instance: wasmInstance,
			exports: wasmInstance.exports,
			memoryBase: allocatedMemoryAddress,
			table: localSideModuleTable,
			memorySize: 0,
			tableBase: 0,
		};

		return currentHandle;
	} catch (error) {
		console.error(`[Sys_LoadLibrary] Instantiation failed:`, error);
		return 0;
	}
}


function dllEntry(engineSyscallTableIndex) {
	console.log(`%c[Static dllEntry] Intercepted Engine Syscall Table Index: ${engineSyscallTableIndex}`, "color: #00ff00; font-weight: bold;");

	// 1. Identify the active module record using your handle tracking map
	// (Assuming you track the initializing module context globally or can infer it)
	const activeHandle = nextModuleHandle - 1;
	const moduleRecord = loadedWasmModules[activeHandle];

	if (!moduleRecord) {
		console.error("[dllEntry] Critical Error: No active WASM module record found to bridge.");
		return;
	}

	const sideModuleTable = moduleRecord.table;
	const realEngineSyscallFunction = ENV.table.get(engineSyscallTableIndex);

	if (!realEngineSyscallFunction) {
		console.error(`[dllEntry] Engine Table Index ${engineSyscallTableIndex} returned null or uninitialized function reference.`);
		return;
	}

	// =========================================================================
	// STEP 2: CHOOSE BRIDGING MODEL
	// =========================================================================

	// Mode A: Overwrite-Match (If your side-module compiler expects the SAME index)
	if (engineSyscallTableIndex >= sideModuleTable.length) {
		sideModuleTable.grow((engineSyscallTableIndex + 1) - sideModuleTable.length);
	}
	sideModuleTable.set(engineSyscallTableIndex, realEngineSyscallFunction);
	console.log(`   -> Bridged to Side-Module Table Slot [${engineSyscallTableIndex}] natively.`);

	// Mode B: Index 0 Fallback Alignment (Only if side-module hardcoded syscalls to index 0)
	// sideModuleTable.set(0, realEngineSyscallFunction);

	// =========================================================================
	// STEP 3: EXECUTE THE TRUE VM ENTRY
	// =========================================================================
	// Now that the side-module's private table possesses the engine's execution function,
	// pass the correct index straight into the compiled binary's true entry export point.
	if (moduleRecord.instance.exports.dllEntry) {
		console.log(`[Static dllEntry] Invoking compiled WASM dllEntry...`);
		moduleRecord.instance.exports.dllEntry(engineSyscallTableIndex);
	} else {
		console.error(`[dllEntry] Compiled module is missing native dllEntry export hook.`);
	}
}


/**
 * Manual diagnostic scanner to extract and decode raw 32-bit integer arguments
 * directly out of the WebAssembly shared linear stack canvas.
 * * Paste this directly into your browser's Developer Tools Console.
 */
function debugWasmSyscallArgs(memBase, targetArgsArrayAddress) {
	// 1. Grab your configuration targets out of your active state variables
	//const memBase = 309716736; // Your module record memoryBase
	const memoryBuffer = ENV.memory.buffer;

	// Set this to the exact absolute stack array address you caught entering CL_UISystemCalls 
	// e.g., the $var0 value (like 33168064 or 33168108) right before it dissolves
	//const targetArgsArrayAddress = 33168108; 

	if (!memoryBuffer) {
		console.error("❌ Critical: WebAssembly linear memory context is missing or inaccessible.");
		return;
	}

	const view = new DataView(memoryBuffer);
	const u8View = new Uint8Array(memoryBuffer);

	console.log(`%c=== MANUAL WASM ARGS DECODER ===`, "color: #00ff00; font-weight: bold;");
	console.log(`Analyzing local stack array address: ${targetArgsArrayAddress} (0x${targetArgsArrayAddress.toString(16).toUpperCase()})`);

	// Extract the raw slots sequentially exactly like the C array mapping expects
	const parsedSlots = [];
	for (let i = 0; i < 6; i++) {
		const byteOffset = targetArgsArrayAddress + (i * 4);
		if (byteOffset + 4 <= view.byteLength) {
			parsedSlots.push(view.getInt32(byteOffset, true)); // True = Little Endian execution profile
		} else {
			parsedSlots.push(null);
		}
	}

	console.log(`\n%cRaw Extracted Array Slots (Integers):`, "color: #00ffff; font-weight: bold;");
	parsedSlots.forEach((val, idx) => {
		console.log(`  args[${idx}]: ${val} (0x${val ? val.toString(16).toUpperCase() : '0'})`);
	});

	// Attempt to string decode the paths using both relative and absolute coordinates
	const potentialStringPointer = parsedSlots[2]; // Slot 2 is your target string parameter input

	if (potentialStringPointer) {
		const readString = (absoluteAddress) => {
			let str = "";
			let p = absoluteAddress;
			while (p < u8View.length && u8View[p] !== 0 && str.length < 128) {
				str += String.fromCharCode(u8View[p]);
				p++;
			}
			return str || "[Empty/Null Pointer Territory]";
		};

		console.log(`\n%cEvaluating String Translation Vectors for args[2]:`, "color: #ffaa00; font-weight: bold;");
		console.log(`  -> If treated as ABSOLUTE address (${potentialStringPointer}):`);
		console.log(`     "${readString(potentialStringPointer)}"`);

		console.log(`  -> If treated as RELATIVE offset (${potentialStringPointer} + memBase):`);
		console.log(`     "${readString(potentialStringPointer + memBase)}"`);
	}
}



function Sys_LoadFunction(moduleHandle, functionNamePtr) {
	let sPtr = functionNamePtr;
	let funcName = "";
	const memoryView = new Uint8Array(ENV.memory.buffer);

	// 1. Read the null-terminated function name string out of C memory
	while (memoryView[sPtr] !== 0) {
		funcName += String.fromCharCode(memoryView[sPtr]);
		sPtr++;
	}


	const moduleRecord = loadedWasmModules[moduleHandle];
	if (!moduleRecord) return 0;


	const targetExport = moduleRecord.exports[funcName];
	if (!targetExport) {
		console.warn(`[Sys_LoadFunction] Target export signature '${funcName}' was missing inside ${moduleRecord.name}`);
		return 0;
	}

	// Initialize an internal transaction cache for this module to prevent duplicate allocations
	if (!moduleRecord.functionPointerCache) {
		moduleRecord.functionPointerCache = {};
	}
	if (moduleRecord.functionPointerCache[funcName]) {
		return moduleRecord.functionPointerCache[funcName];
	}

	let targetTableIndex = 0;
	const masterTable = ENV.table;
	const associatedTableBase = moduleRecord.tableBase;

	// Convert our target export to its native signature string block to bypass wrapper proxy mutations
	const targetExportString = targetExport.toString();


	// =========================================================================
	// PASS 1: SCAN COHERENT TABLE SLOTS WITH SIGNATURE MATCHING
	// =========================================================================
	// Scan up to 2048 positions inside the module's assigned hunk table block
	for (let i = 0; i < 2048; i++) {
		const checkIndex = associatedTableBase + i;
		try {
			const tableFunc = masterTable.get(checkIndex);
			if (!tableFunc) continue;

			// If reference equality works, or if the string signature mappings match, 
			// we have verified the true physical underlying address.
			if (tableFunc === targetExport || tableFunc.toString() === targetExportString) {
				targetTableIndex = checkIndex;
				break;
			}
		} catch (e) {
			// Reached unallocated table boundaries safely
			break;
		}
	}

	// =========================================================================
	// PASS 2: OBJECT FIELD COMPILER METADATA FALLBACK
	// =========================================================================
	if (targetTableIndex === 0 && typeof targetExport.index === 'number') {
		targetTableIndex = targetExport.index;
	}

	// =========================================================================
	// PASS 3: DYNAMIC RUNTIME INJECTION CAGE (GROW ON MISS)
	// =========================================================================
	// If the toolchain completely stripped it out of the elements table, 
	// manually grow the table by 1 entry and hot-plug the export right here.
	if (targetTableIndex === 0) {
		targetTableIndex = masterTable.length;
		try {
			masterTable.grow(1);
			masterTable.set(targetTableIndex, targetExport);
			console.log(`[Runtime Linker Link] Injected missing entry point '${funcName}' into Table Index: ${targetTableIndex}`);
		} catch (error) {
			console.error(`[Sys_LoadFunction] Failed to dynamically append function table slot for ${funcName}:`, error);
			return 0;
		}
	}

	// Save back to the transaction cache so subsequent lookups hit instantly
	moduleRecord.functionPointerCache[funcName] = targetTableIndex;

	console.log(`[Sys_LoadFunction] Resolved symbol '${funcName}' to numeric function pointer: ${targetTableIndex} (0x${targetTableIndex.toString(16).toUpperCase()})`);
	return targetTableIndex;
}

/*
function Sys_LoadFunction(moduleHandle, functionNamePtr) {
	let sPtr = functionNamePtr;
	let funcName = "";
	const memoryView = new Uint8Array(ENV.memory.buffer);
    
	while (memoryView[sPtr] !== 0) {
		funcName += String.fromCharCode(memoryView[sPtr]);
		sPtr++;
	}

	const moduleRecord = loadedWasmModules[moduleHandle];
	if (!moduleRecord) return 0;

	const targetExport = moduleRecord.exports[funcName];
	if (!targetExport) {
		console.warn(`[Sys_LoadFunction] Symbol '${funcName}' not found in exports.`);
		return 0;
	}

	// =========================================================================
	// PARSING THE NATIVE WASM ELEMENT OFFSET
	// =========================================================================
	// To completely bypass JS wrapper opacity, we look at the order of the 
	// exported function names. Standard LLVM side-modules append their functions 
	// to the table segment in the precise order they appear in the export table definition list.
	let targetTableIndex = 0;
	const associatedTableBase = moduleRecord.tableBase;
	//const associatedTableBase = moduleRecord.tableBase || ENV.table.length - 1024;

	// Get a clean list of all exported function signatures
	const exportedSymbols = Object.keys(moduleRecord.exports);
	const functionSymbols = exportedSymbols.filter(x => typeof moduleRecord.exports[x] === 'function');
    
	debugger
	// Find where this function sits in the ordered export list
	const exportPositionIndex = functionSymbols.indexOf(funcName);

	if (exportPositionIndex !== -1) {
		// Calculate the real index based on the dynamic table base your hunk allocated
		targetTableIndex = associatedTableBase + exportPositionIndex;
	}

	// Double-check verification check: ensure the table slot isn't empty
	try {
		const verifiedSlot = ENV.table.get(targetTableIndex);
		if (!verifiedSlot) {
			console.warn(`[Sys_LoadFunction] Table slot ${targetTableIndex} is unpopulated.`);
		}
	} catch (e) {
		console.error(`[Sys_LoadFunction] Out of bounds table access at index: ${targetTableIndex}`);
	}

	console.log(`[Sys_LoadFunction] Resolved symbol '${funcName}' via Export Map to index: ${targetTableIndex}`);
	return targetTableIndex;
}
*/

let messageTime = Date.now()
function Sys_Print(message) {
	let messageStr = addressToString(message)
	if (messageStr.includes('Client Information')) {
		messageTime = Date.now()
	}
	let stateMatch

	if (Date.now() - messageTime < 100 && (stateMatch = (/state:\s*([0-9]+)/g).exec(messageStr))) {
		SYS.state = parseInt(stateMatch[1])
	}
	if (messageStr.includes('Hunk_Clear'))
		console.warn(messageStr)
	else if (messageStr.includes('error')
		|| messageStr.includes('RE_Shutdown')

		|| messageStr.includes('ERROR:')) {
		console.error(messageStr)
	} else {
		writeLog(messageStr)
	}
}

function Sys_Edit() {
	if (typeof window.ace == 'undefined') {
		return
	}

	if (Cmd_Argc() < 2) {
		Com_Printf(stringToAddress('Usage: edit [filename]\n'))
		return
	}

	let basegamedir = addressToString(FS_GetBaseGameDir())
	let gamedir = addressToString(FS_GetCurrentGameDir())
	let filename = Cmd_Argv(1)
	let filenameStr = addressToString(filename)
	if (filenameStr.startsWith('/')) {
		filenameStr = filenameStr.substr(1)
	}
	if (filenameStr.startsWith(gamedir)) {
		filenameStr = filenameStr.substr(gamedir.length)
	}
	if (filenameStr.startsWith(basegamedir)) {
		filenameStr = filenameStr.substr(basegamedir.length)
	}
	if (filenameStr.startsWith('/')) {
		filenameStr = filenameStr.substr(1)
	}
	if (!filenameStr || !filenameStr.length) {
		Com_Printf(stringToAddress('Usage: edit [filename]\n'))
		return
	}
	let openFilename = stringToAddress(filenameStr)

	let buf = stringToAddress('DEADBEEF') // pointer to pointer
	let length
	if ((length = FS_ReadFile(openFilename, buf)) > 0 && HEAPU32[buf >> 2] > 0) {
		let imageView = Array.from(HEAPU8.slice(HEAPU32[buf >> 2], HEAPU32[buf >> 2] + length))
		let utfEncoded = imageView.map(function (c) { return String.fromCharCode(c) }).join('')
		FS_FreeFile(HEAPU32[buf >> 2])
		ace.setValue(utfEncoded)
		// TODO: show relationships in Jarvis, 
		//   one module refers to another module
		//   these are the leaves of change that worry code reviewers
		ACE.filename = filenameStr
	} else {
		let vargs = stringToAddress('DEADBEEF') // pointer to pointer
		HEAPU32[vargs >> 2] = openFilename
		HEAPU32[(vargs >> 2) + 1] = 0
		Com_Printf(stringToAddress('File not found \'%s\'.\nUsage: edit [filename]\n'), vargs)
	}
}


function Sys_Return() {
	let returnUrl = addressToString(Cvar_VariableString(stringToAddress('cl_returnURL')))
	if (returnUrl) {
		window.location = returnUrl
	}
	// brian cullinan added this feature for Tig
	// client mode
	//let reconnect = addressToString(Cvar_VariableString(stringToAddress('cl_reconnectArgs')))
	//if(reconnect) {
	//	window.location = '/games/' + reconnect
	//}
	// single player mode
	//let mapname = addressToString(Cvar_VariableString(stringToAddress('mapname')))
	//if(mapname && mapname != 'nomap') {
	//	window.location = '/maps/' + mapname
	//}
}



function Sys_Exit(code) {
	SYS.exited = true
	GLimp_Shutdown(true)
	NET_Shutdown()
	if (SYS.frameInterval) {
		clearInterval(SYS.frameInterval)
		SYS.frameInterval = null
	}
	if (code == 0) {
		Sys_Return()
	}
	if (GL.canvas) {
		GL.canvas.remove()
	}
}

function Sys_Error(fmt, args) {
	let len = sprintf(STD.sharedMemory + STD.sharedCounter, fmt, args)
	if (len > 0)
		console.error('Sys_Error: ', addressToString(STD.sharedMemory + STD.sharedCounter))
	Sys_Exit(1)
	throw new Error(addressToString(fmt))
}

function Sys_SetStatus(status, replacementStr) {
	// TODO: something like  window.title = , then setTimeout( window.title = 'Quake3e' again)
	writeLog(addressToString(status), replacementStr)

}

function CL_MenuModified(oldValue, newValue, cvar) {
	if (INPUT.modifyingCrumb) {
		return // called from ourselves below from a user action
	}
	if (window.location.orgin == null) {
		return
	}
	let newValueStr = addressToString(newValue)
	let newLocation = newValueStr.replace(/[^a-z0-9]/gi, '')
	if (!SYS.menuInited) { // keep track of first time the ui.qvm appears
		SYS.menuInited = true
		document.body.className += ' done-loading '
	}
	if (window.location.pathname.toString().includes(newLocation)) {
		// don't add to stack because it creates a lot of annoying back pushes
		return
	}
	history.pushState(
		{ location: window.location.pathname },
		'Quake III Arena: ' + newValueStr,
		newLocation)
}

function CL_ModifyMenu(event) {
	let oldLocation = window.location.pathname.toString().substring(1) || 'MAIN MENU'
	Cbuf_AddText(stringToAddress(`set ui_breadCrumb "${oldLocation}"\n`));
	return true
}

function Sys_Frame() {
	if (SYS.inFrame) {
		return
	}
	if (INPUT.fpsModified != HEAPU32[(INPUT.fps >> 2) + 6]
		|| INPUT.fpsUnfocusedModified != HEAPU32[(INPUT.fpsUnfocused >> 2) + 6]) {
		Com_MaxFPSChanged()
	}
	function doFrame() {
		SYS.inFrame = true
		SYS.running = !SYS.running
		SYS.milliseconds = Date.now()
		try {
			if (typeof ACE != 'undefined') {
				renderFilelist()
			}
			Com_Frame(0 /* SYS.running */)
		} catch (e) {
			if (!SYS.exited && e.message == 'longjmp') {
				// let game Com_Frame handle it, it will restart UIVM
				console.error(e)
				stackRestore(STD.longjumps[e.stackPointer])
				Cbuf_AddText(stringToAddress('vid_restart\n'));
			} else
				if (!SYS.exited || e.message != 'unreachable') {
					Sys_Exit(1)
					throw e
				}
		}
		SYS.inFrame = false
	}
	if (HEAP32[gw_active >> 2]) {
		requestAnimationFrame(doFrame)
	} else {
		doFrame()
	}
}

async function Sys_notify(ifile, path, fp) {
	var database = Module.database || owner.value + '/' + repository.value
	try {
		if (ifile === false) {
			getDB(database).then(function (db) {
				deleteRecord(DB_STORE_NAME, path, database)
			})
			return
		}
		ifile.sha = await getGitShaBrowser(ifile.contents)
		getDB(database).then(function (db) {
			putRecord(DB_STORE_NAME, ifile, database)
		})
	} catch (e) {
		debugger
		console.error(e)
	}
}


function dynCall(ret, func, args) {
	return Module.table.get(func).apply(null, args)
}

function CreateAndCall(code, params, vargs) {
	let func
	if (typeof SYS.evaledFuncs[code] != 'undefined') {
		func = SYS.evaledFuncs[code]
	} else {
		let paramStr = addressToString(params)
		func = SYS.evaledFuncs[code] = eval('(function func'
			+ ++SYS.evaledCount + '($0, $1, $2, $3)'
			+ addressToString(code, 4096) + ')')
		func.paramCount = paramStr.split(',').filter(function (name) {
			return name.length > 0
		}).length
	}
	let args = HEAPU32.slice(vargs >> 2, (vargs >> 2) + func.paramCount)
	return func.apply(func, args)
}

function Sys_RandomBytes(string, len) {
	if (typeof crypto != 'undefined') {
		crypto.getRandomValues((new Int8Array(ENV.memory.buffer)).slice(string, string + (len / 4)))
	} else {
		for (let i = 0; i < (len / 4); i++) {
			ENV.memory.buffer[string] = Math.random() * 255
		}
	}
	return true;
}

function CL_Try_Fail_LoadJPG(fbuffer, filename, pic, width, height, cinfo) {
	try {
		CL_Try_LoadJPG(filename, cinfo, fbuffer, pic, width, height)
	} catch (e) {
		if (e.message == 'unreachable') {
			try {
				CL_Fail_LoadJPG(filename, fbuffer, cinfo)
			} catch (e) { }
		}
	}
}





var SYSCALLS = {
	DEFAULT_POLLMASK: 5,
	calculateAt(dirfd, path, allowEmpty) {
		if (PATH.isAbs(path)) {
			return path;
		}
		// relative path
		var dir;
		if (dirfd === -100) {
			dir = FS.cwd();
		} else {
			var dirstream = SYSCALLS.getStreamFromFD(dirfd);
			dir = dirstream.path;
		}
		if (path.length == 0) {
			if (!allowEmpty) {
				throw new FS.ErrnoError(44);;
			}
			return dir;
		}
		return PATH.join2(dir, path);
	},
	doStat(func, path, buf) {
		var stat = func(path);
		HEAP32[((buf) >> 2)] = stat.dev;
		HEAP32[(((buf) + (4)) >> 2)] = stat.mode;
		HEAPU32[(((buf) + (8)) >> 2)] = stat.nlink;
		HEAP32[(((buf) + (12)) >> 2)] = stat.uid;
		HEAP32[(((buf) + (16)) >> 2)] = stat.gid;
		HEAP32[(((buf) + (20)) >> 2)] = stat.rdev;
		(tempI64 = [stat.size >>> 0, (tempDouble = stat.size, (+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble) / 4294967296.0))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296.0))))) >>> 0) : 0)], HEAP32[(((buf) + (24)) >> 2)] = tempI64[0], HEAP32[(((buf) + (28)) >> 2)] = tempI64[1]);
		HEAP32[(((buf) + (32)) >> 2)] = 4096;
		HEAP32[(((buf) + (36)) >> 2)] = stat.blocks;
		var atime = stat.atime.getTime();
		var mtime = stat.mtime.getTime();
		var ctime = stat.ctime.getTime();
		(tempI64 = [Math.floor(atime / 1000) >>> 0, (tempDouble = Math.floor(atime / 1000), (+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble) / 4294967296.0))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296.0))))) >>> 0) : 0)], HEAP32[(((buf) + (40)) >> 2)] = tempI64[0], HEAP32[(((buf) + (44)) >> 2)] = tempI64[1]);
		HEAPU32[(((buf) + (48)) >> 2)] = (atime % 1000) * 1000;
		(tempI64 = [Math.floor(mtime / 1000) >>> 0, (tempDouble = Math.floor(mtime / 1000), (+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble) / 4294967296.0))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296.0))))) >>> 0) : 0)], HEAP32[(((buf) + (56)) >> 2)] = tempI64[0], HEAP32[(((buf) + (60)) >> 2)] = tempI64[1]);
		HEAPU32[(((buf) + (64)) >> 2)] = (mtime % 1000) * 1000;
		(tempI64 = [Math.floor(ctime / 1000) >>> 0, (tempDouble = Math.floor(ctime / 1000), (+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble) / 4294967296.0))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296.0))))) >>> 0) : 0)], HEAP32[(((buf) + (72)) >> 2)] = tempI64[0], HEAP32[(((buf) + (76)) >> 2)] = tempI64[1]);
		HEAPU32[(((buf) + (80)) >> 2)] = (ctime % 1000) * 1000;
		(tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, (+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble) / 4294967296.0))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296.0))))) >>> 0) : 0)], HEAP32[(((buf) + (88)) >> 2)] = tempI64[0], HEAP32[(((buf) + (92)) >> 2)] = tempI64[1]);
		return 0;
	},
	doMsync(addr, stream, len, flags, offset) {
		if (!FS.isFile(stream.node.mode)) {
			throw new FS.ErrnoError(43);
		}
		if (flags & 2) {
			// MAP_PRIVATE calls need not to be synced back to underlying fs
			return 0;
		}
		var buffer = HEAPU8.slice(addr, addr + len);
		FS.msync(stream, buffer, offset, len, flags);
	},
	getStreamFromFD(fd) {
		var stream = FS.getStreamChecked(fd);
		return stream;
	},
	varargs: undefined,
	getStr(ptr) {
		var ret = UTF8ToString(ptr);
		return ret;
	},
};




function ___syscall_fcntl64(fd, cmd, varargs) {
	SYSCALLS.varargs = varargs;
	try {

		var stream = SYSCALLS.getStreamFromFD(fd);
		switch (cmd) {
			case 0: {
				var arg = syscallGetVarargI();
				if (arg < 0) {
					return -28;
				}
				while (FS.streams[arg]) {
					arg++;
				}
				var newStream;
				newStream = FS.dupStream(stream, arg);
				return newStream.fd;
			}
			case 1:
			case 2:
				return 0;  // FD_CLOEXEC makes no sense for a single process.
			case 3:
				return stream.flags;
			case 4: {
				var arg = syscallGetVarargI();
				stream.flags |= arg;
				return 0;
			}
			case 12: {
				var arg = syscallGetVarargP();
				var offset = 0;
				// We're always unlocked.
				HEAP16[(((arg) + (offset)) >> 1)] = 2;
				return 0;
			}
			case 13:
			case 14:
				return 0; // Pretend that the locking is successful.
		}
		return -28;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}


function ___syscall_ioctl(fd, op, varargs) {
	SYSCALLS.varargs = varargs;
	try {

		var stream = SYSCALLS.getStreamFromFD(fd);
		switch (op) {
			case 21509: {
				if (!stream.tty) return -59;
				return 0;
			}
			case 21505: {
				if (!stream.tty) return -59;
				if (stream.tty.ops.ioctl_tcgets) {
					var termios = stream.tty.ops.ioctl_tcgets(stream);
					var argp = syscallGetVarargP();
					HEAP32[((argp) >> 2)] = termios.c_iflag || 0;
					HEAP32[(((argp) + (4)) >> 2)] = termios.c_oflag || 0;
					HEAP32[(((argp) + (8)) >> 2)] = termios.c_cflag || 0;
					HEAP32[(((argp) + (12)) >> 2)] = termios.c_lflag || 0;
					for (var i = 0; i < 32; i++) {
						HEAP8[(argp + i) + (17)] = termios.c_cc[i] || 0;
					}
					return 0;
				}
				return 0;
			}
			case 21510:
			case 21511:
			case 21512: {
				if (!stream.tty) return -59;
				return 0; // no-op, not actually adjusting terminal settings
			}
			case 21506:
			case 21507:
			case 21508: {
				if (!stream.tty) return -59;
				if (stream.tty.ops.ioctl_tcsets) {
					var argp = syscallGetVarargP();
					var c_iflag = HEAP32[((argp) >> 2)];
					var c_oflag = HEAP32[(((argp) + (4)) >> 2)];
					var c_cflag = HEAP32[(((argp) + (8)) >> 2)];
					var c_lflag = HEAP32[(((argp) + (12)) >> 2)];
					var c_cc = []
					for (var i = 0; i < 32; i++) {
						c_cc.push(HEAP8[(argp + i) + (17)]);
					}
					return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
				}
				return 0; // no-op, not actually adjusting terminal settings
			}
			case 21519: {
				if (!stream.tty) return -59;
				var argp = syscallGetVarargP();
				HEAP32[((argp) >> 2)] = 0;
				return 0;
			}
			case 21520: {
				if (!stream.tty) return -59;
				return -28; // not supported
			}
			case 21531: {
				var argp = syscallGetVarargP();
				return FS.ioctl(stream, op, argp);
			}
			case 21523: {
				// TODO: in theory we should write to the winsize struct that gets
				// passed in, but for now musl doesn't read anything on it
				if (!stream.tty) return -59;
				if (stream.tty.ops.ioctl_tiocgwinsz) {
					var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
					var argp = syscallGetVarargP();
					HEAP16[((argp) >> 1)] = winsize[0];
					HEAP16[(((argp) + (2)) >> 1)] = winsize[1];
				}
				return 0;
			}
			case 21524: {
				// TODO: technically, this ioctl call should change the window size.
				// but, since emscripten doesn't have any concept of a terminal window
				// yet, we'll just silently throw it away as we do TIOCGWINSZ
				if (!stream.tty) return -59;
				return 0;
			}
			case 21515: {
				if (!stream.tty) return -59;
				return 0;
			}
			default: return -28; // not supported
		}
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}


function ___syscall_openat(dirfd, path, flags, varargs) {
	SYSCALLS.varargs = varargs;
	try {

		path = SYSCALLS.getStr(path);
		path = SYSCALLS.calculateAt(dirfd, path);
		var mode = varargs ? syscallGetVarargI() : 0;
		return FS.open(path, flags, mode).fd;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}

function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
	try {

		oldpath = SYSCALLS.getStr(oldpath);
		newpath = SYSCALLS.getStr(newpath);
		oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
		newpath = SYSCALLS.calculateAt(newdirfd, newpath);
		FS.rename(oldpath, newpath);
		return 0;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}

function ___syscall_rmdir(path) {
	try {

		path = SYSCALLS.getStr(path);
		FS.rmdir(path);
		return 0;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}

function ___syscall_unlinkat(dirfd, path, flags) {
	try {

		path = SYSCALLS.getStr(path);
		path = SYSCALLS.calculateAt(dirfd, path);
		if (flags === 0) {
			FS.unlink(path);
		} else if (flags === 512) {
			FS.rmdir(path);
		} else {
			abort('Invalid flags passed to unlinkat');
		}
		return 0;
	} catch (e) {
		if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
		return -e.errno;
	}
}

var __emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);

var isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

var MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
var ydayFromDate = (date) => {
	var leap = isLeapYear(date.getFullYear());
	var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
	var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1; // -1 since it's days since Jan 1

	return yday;
};

function assert(condition, text) {
	if (!condition) {
		abort('Assertion failed' + (text ? ': ' + text : ''));
	}
}


var convertI32PairToI53Checked = (lo, hi) => {
	// If Clang is passing BigInts, convert them to Number safely
	// BigInt(x) | 0 is an easy way to ensure i32/u32 behavior
	const l = Number(lo) >>> 0;
	const h = Number(hi) | 0;

	// Original safety check for the 53-bit Number limit
	if ((h + 0x200000) >>> 0 < 0x400001 - !!l) {
		return l + (h * 4294967296);
	}
	return NaN;
};


function __localtime_js(time_low, time_high, tmPtr) {
	var time = convertI32PairToI53Checked(time_low, time_high);


	var date = new Date(time * 1000);
	HEAP32[((tmPtr) >> 2)] = date.getSeconds();
	HEAP32[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
	HEAP32[(((tmPtr) + (8)) >> 2)] = date.getHours();
	HEAP32[(((tmPtr) + (12)) >> 2)] = date.getDate();
	HEAP32[(((tmPtr) + (16)) >> 2)] = date.getMonth();
	HEAP32[(((tmPtr) + (20)) >> 2)] = date.getFullYear() - 1900;
	HEAP32[(((tmPtr) + (24)) >> 2)] = date.getDay();

	var yday = ydayFromDate(date) | 0;
	HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
	HEAP32[(((tmPtr) + (36)) >> 2)] = -(date.getTimezoneOffset() * 60);

	// Attention: DST is in December in South, and some regions don't have DST at all.
	var start = new Date(date.getFullYear(), 0, 1);
	var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
	var winterOffset = start.getTimezoneOffset();
	var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
	HEAP32[(((tmPtr) + (32)) >> 2)] = dst;
	;
}

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
	assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
	// Parameter maxBytesToWrite is not optional. Negative values, 0, null,
	// undefined and false each don't write out any bytes.
	if (!(maxBytesToWrite > 0))
		return 0;

	var startIdx = outIdx;
	var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
	for (var i = 0; i < str.length; ++i) {
		// Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
		// unit, not a Unicode code point of the character! So decode
		// UTF16->UTF32->UTF8.
		// See http://unicode.org/faq/utf_bom.html#utf16-3
		// For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
		// and https://www.ietf.org/rfc/rfc2279.txt
		// and https://tools.ietf.org/html/rfc3629
		var u = str.charCodeAt(i); // possibly a lead surrogate
		if (u >= 0xD800 && u <= 0xDFFF) {
			var u1 = str.charCodeAt(++i);
			u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
		}
		if (u <= 0x7F) {
			if (outIdx >= endIdx) break;
			heap[outIdx++] = u;
		} else if (u <= 0x7FF) {
			if (outIdx + 1 >= endIdx) break;
			heap[outIdx++] = 0xC0 | (u >> 6);
			heap[outIdx++] = 0x80 | (u & 63);
		} else if (u <= 0xFFFF) {
			if (outIdx + 2 >= endIdx) break;
			heap[outIdx++] = 0xE0 | (u >> 12);
			heap[outIdx++] = 0x80 | ((u >> 6) & 63);
			heap[outIdx++] = 0x80 | (u & 63);
		} else {
			if (outIdx + 3 >= endIdx) break;
			if (u > 0x10FFFF) warnOnce('Invalid Unicode code point ' + ptrToString(u) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
			heap[outIdx++] = 0xF0 | (u >> 18);
			heap[outIdx++] = 0x80 | ((u >> 12) & 63);
			heap[outIdx++] = 0x80 | ((u >> 6) & 63);
			heap[outIdx++] = 0x80 | (u & 63);
		}
	}
	// Null-terminate the pointer to the buffer.
	heap[outIdx] = 0;
	return outIdx - startIdx;
};


var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
	assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
	return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
};

var __tzset_js = (timezone, daylight, std_name, dst_name) => {
	// TODO: Use (malleable) environment variables instead of system settings.
	var currentYear = new Date().getFullYear();
	var winter = new Date(currentYear, 0, 1);
	var summer = new Date(currentYear, 6, 1);
	var winterOffset = winter.getTimezoneOffset();
	var summerOffset = summer.getTimezoneOffset();

	// Local standard timezone offset. Local standard time is not adjusted for
	// daylight savings.  This code uses the fact that getTimezoneOffset returns
	// a greater value during Standard Time versus Daylight Saving Time (DST).
	// Thus it determines the expected output during Standard Time, and it
	// compares whether the output of the given date the same (Standard) or less
	// (DST).
	var stdTimezoneOffset = Math.max(winterOffset, summerOffset);

	// timezone is specified as seconds west of UTC ("The external variable
	// `timezone` shall be set to the difference, in seconds, between
	// Coordinated Universal Time (UTC) and local standard time."), the same
	// as returned by stdTimezoneOffset.
	// See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
	HEAPU32[((timezone) >> 2)] = stdTimezoneOffset * 60;

	HEAP32[((daylight) >> 2)] = Number(winterOffset != summerOffset);

	var extractZone = (timezoneOffset) => {
		// Why inverse sign?
		// Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
		var sign = timezoneOffset >= 0 ? "-" : "+";

		var absOffset = Math.abs(timezoneOffset)
		var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
		var minutes = String(absOffset % 60).padStart(2, "0");

		return `UTC${sign}${hours}${minutes}`;
	}

	var winterName = extractZone(winterOffset);
	var summerName = extractZone(summerOffset);
	assert(winterName);
	assert(summerName);
	assert(lengthBytesUTF8(winterName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${winterName})`);
	assert(lengthBytesUTF8(summerName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${summerName})`);
	if (summerOffset < winterOffset) {
		// Northern hemisphere
		stringToUTF8(winterName, std_name, 17);
		stringToUTF8(summerName, dst_name, 17);
	} else {
		stringToUTF8(winterName, dst_name, 17);
		stringToUTF8(summerName, std_name, 17);
	}
};

var getHeapMax = () =>
	HEAPU8.length;


function _exit(code) {
	SYS.exited = true
	GLimp_Shutdown(true)
	NET_Shutdown()
	if (SYS.frameInterval) {
		clearInterval(SYS.frameInterval)
		SYS.frameInterval = null
	}
	if (code == 0) {
		Sys_Return()
	}
	if (GL.canvas) {
		GL.canvas.remove()
	}
}

const SYS = {
	evaledFuncs: {},
	evaledCount: 0,
	DebugBreak: function () { debugger },
	DebugTrace: function () { writeLog(new Error()) },
	Sys_RandomBytes: Sys_RandomBytes,
	Sys_Exit: Sys_Exit,
	Sys_Edit: Sys_Edit,
	Sys_Return: Sys_Return,
	exit: Sys_Exit,
	Sys_Frame: Sys_Frame,
	Sys_Error: Sys_Error,
	Sys_UnloadLibrary: Sys_UnloadLibrary,
	Sys_LoadLibrary: Sys_LoadLibrary,
	Sys_LoadFunction: Sys_LoadFunction,
	popen: function popen() { },
	Sys_Print: Sys_Print,
	Sys_SetStatus: Sys_SetStatus,
	CL_MenuModified: CL_MenuModified,
	CreateAndCall: CreateAndCall,
	CL_Try_Fail_LoadJPG: CL_Try_Fail_LoadJPG,
	dllEntry: dllEntry,


	__syscall_fcntl64: ___syscall_fcntl64,
	/** @export */
	__syscall_ioctl: ___syscall_ioctl,
	/** @export */
	__syscall_openat: ___syscall_openat,
	/** @export */
	__syscall_renameat: ___syscall_renameat,
	/** @export */
	__syscall_rmdir: ___syscall_rmdir,
	/** @export */
	__syscall_unlinkat: ___syscall_unlinkat,
	/** @export */
	_emscripten_memcpy_js: __emscripten_memcpy_js,
	/** @export */
	_localtime_js: __localtime_js,
	/** @export */
	_tzset_js: __tzset_js,
	/** @export */
	exit: _exit,

	emscripten_cancel_main_loop: function () { debugger },
	emscripten_force_exit: function () { debugger },
}




