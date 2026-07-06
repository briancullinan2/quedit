import { FileRecord } from "./local";


export const path = {
	join: (...parts: string[]): string =>
	{
		return parts
			.map((part: string, index: number) =>
			{
				if(index > 0) return part.replace(/^\//, ''); // Strip leading slash
				return part.replace(/\/$/, ''); // Strip trailing slash
			})
			.filter((part: string) => part.length > 0)
			.join('/');
	}
};

const COMPILE_PLATFORM = 'wasm';
const COMPILE_ARCH = 'js';

const GAME_PLATFORM = 'qvm';
const GAME_ARCH = 'bytecode';

export const config = {
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

export const dirs = {
	ENGINE_DEBUG: path.join(config.BUILD_DIR, `debug-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),
	ENGINE_RELEASE: path.join(config.BUILD_DIR, `release-${COMPILE_PLATFORM}-${COMPILE_ARCH}`),

	GAME_DEBUG: path.join(config.BUILD_DIR, `debug-${GAME_PLATFORM}-${GAME_ARCH}`),
	GAME_RELEASE: path.join(config.BUILD_DIR, `release-${GAME_PLATFORM}-${GAME_ARCH}`),

	CGDIR: path.join(config.MOUNT_DIR, "cgame"),
	QADIR: path.join(config.MOUNT_DIR, "game"),
	UIDIR: path.join(config.MOUNT_DIR, "ui"),
	Q3UIDIR: path.join(config.MOUNT_DIR, "q3_ui"),

	CDIR: path.join(config.MOUNT_DIR, "client"),
	SDIR: path.join(config.MOUNT_DIR, "server"),
	CMDIR: path.join(config.MOUNT_DIR, "qcommon"),
	//R1DIR: path.join(config.MOUNT_DIR, "renderer"),
	R2DIR: path.join(config.MOUNT_DIR, "renderer2"),
	RCDIR: path.join(config.MOUNT_DIR, "renderercommon"),
	//RVDIR: path.join(config.MOUNT_DIR, "renderervk"),
	BLIBDIR: path.join(config.MOUNT_DIR, "botlib"),
	WASMDIR: path.join(config.MOUNT_DIR, "wasm"),
};


declare global {
    interface Window {
        FS?: {
            virtual: Record<string, FileRecord | null | undefined>;
        };
    }
}

// 2. Safely capture or initialize the instance on window
const FSInstance = window.FS || { virtual: {} };

if (!window.FS) {
    window.FS = FSInstance;
}

// 3. Export it cleanly for module usage
export const FS = FSInstance;

