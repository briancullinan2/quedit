
// @ts-check

/** @type {import('../compiler/make.d').MakeWindow & import('../compiler/make.d').MakeSystemGlobals  & import('../compiler/make.d').BuildWindow} */
const compilerSelf = /** @type {any} */ (self);


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

const TOOLS_PREAMBLE = '\x1b[38;5;121m[TOOLS-BUILD]\x1b[0m ';
//const TOOLERR_PREAMBLE = '\x1b[38;5;203m[TOOL ERROR]\x1b[0m '
const ENGINE_PREAMBLE = '\x1b[38;5;36m[QUAKE3E]\x1b[0m ';


compilerSelf.path = {
	join: (...parts) =>
	{
		return parts
			.map((part, index) =>
			{
				if(index > 0) return part.replace(/^\//, ''); // Strip leading slash
				return part.replace(/\/$/, ''); // Strip trailing slash
			})
			.filter(part => part.length > 0)
			.join('/');
	},
	resolve: (...parts) =>
	{
		let resolvedSegments = [];

		for(const part of parts)
		{
			if(!part) continue;

			// If a segment starts with '/', it acts as an absolute root reset
			if(part.startsWith('/'))
			{
				resolvedSegments = part.split('/');
			} else
			{
				resolvedSegments.push(...part.split('/'));
			}
		}

		// Normalize the accumulated stack (. and .. processing)
		const stack = [];
		for(const segment of resolvedSegments)
		{
			if(segment === '' || segment === '.')
			{
				continue;
			}
			if(segment === '..')
			{
				if(stack.length > 0)
				{
					stack.pop();
				}
				continue;
			}
			stack.push(segment);
		}

		// Reconstruct the path ensuring it behaves as an absolute result
		return '/' + stack.join('/');
	}
};

const COMPILE_PLATFORM = 'wasm';
compilerSelf.COMPILE_PLATFORM = COMPILE_PLATFORM;
const COMPILE_ARCH = 'js';
compilerSelf.COMPILE_ARCH = COMPILE_ARCH;

const GAME_PLATFORM = 'qvm';
compilerSelf.GAME_PLATFORM = GAME_PLATFORM;
const GAME_ARCH = 'bytecode';
compilerSelf.GAME_ARCH = GAME_ARCH;


const config = {
	BUILD_CLIENT: 1,
	BUILD_SERVER: 1,
	USE_SDL: 1,
	USE_CURL: 1,
	USE_LOCAL_HEADERS: 0,
	USE_SYSTEM_JPEG: 0,
	USE_OGG_VORBIS: 1,
	USE_VULKAN: 0,
	USE_OPENGL: 0,
	USE_OPENGL2: 1,
	RENDERER_DEFAULT: "opengl2",
	CNAME: "quake3e",
	DNAME: "quake3e.ded",
	MOUNT_DIR: "code",
	BUILD_DIR: "build",
	BINEXT: `.${COMPILE_ARCH}.${COMPILE_PLATFORM}`,
	TEMPDIR: '/tmp',
	HOMEDIR: '/home',
	RUNBASE: '/base',
	MOD: 'baseq3a'
};
compilerSelf.config = config;

const dirs = {
	ENGINE_DEBUG: compilerSelf.path.join(config.BUILD_DIR, `debug-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
	ENGINE_RELEASE: compilerSelf.path.join(config.BUILD_DIR, `release-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),

	GAME_DEBUG: compilerSelf.path.join(config.BUILD_DIR, `debug-${GAME_PLATFORM}-${GAME_ARCH}`),
	GAME_RELEASE: compilerSelf.path.join(config.BUILD_DIR, `release-${GAME_PLATFORM}-${GAME_ARCH}`),

	CGDIR: compilerSelf.path.join(config.MOUNT_DIR, "cgame"),
	QADIR: compilerSelf.path.join(config.MOUNT_DIR, "game"),
	UIDIR: compilerSelf.path.join(config.MOUNT_DIR, "ui"),
	Q3UIDIR: compilerSelf.path.join(config.MOUNT_DIR, "q3_ui"),

	CDIR: compilerSelf.path.join(config.MOUNT_DIR, "client"),
	SDIR: compilerSelf.path.join(config.MOUNT_DIR, "server"),
	CMDIR: compilerSelf.path.join(config.MOUNT_DIR, "qcommon"),
	//R1DIR: path.join(config.MOUNT_DIR, "renderer"),
	R2DIR: compilerSelf.path.join(config.MOUNT_DIR, "renderer2"),
	RCDIR: compilerSelf.path.join(config.MOUNT_DIR, "renderercommon"),
	//RVDIR: path.join(config.MOUNT_DIR, "renderervk"),
	BLIBDIR: compilerSelf.path.join(config.MOUNT_DIR, "botlib"),
	WASMDIR: compilerSelf.path.join(config.MOUNT_DIR, "wasm"),
};
compilerSelf.dirs = dirs;

const ENGINE_MEMORY_BASE = 48 * 1024 * 1024;
compilerSelf.ENGINE_MEMORY_BASE = ENGINE_MEMORY_BASE;
const UI_MEMORY_BASE = 32;
compilerSelf.UI_MEMORY_BASE = UI_MEMORY_BASE;
const CGAME_MEMORY_BASE = 16 * 1024 * 1024;
compilerSelf.CGAME_MEMORY_BASE = CGAME_MEMORY_BASE;
const GAME_MEMORY_BASE = 32 * 1024 * 1024;
compilerSelf.GAME_MEMORY_BASE = GAME_MEMORY_BASE;
