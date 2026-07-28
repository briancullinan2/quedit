import type { FileRecord } from "../bundle/local.d";


export interface MakeWindow
{
	BUILD_SCRIPTS: string[];
	buildTools: (database?: string | null) => Promise<void>;
	buildQVM: (database?: string | null) => Promise<void>;
	buildClient: (database?: string | null) => Promise<void>;
	downloadHeaders(headers: any, batchSize?: number, database?: string | null): Promise<void>;

	updateGlobalBufferAndViews?: () => void;

}

export interface MakeSystemGlobals
{
	TERMINATE?: boolean;
	needsHeaders?: boolean;
	undefinedFlags?: string[];
	includeFlags?: string[];
	CFLAGS?: string[];
	building?: boolean;
	buildDebounce?: ReturnType<typeof setTimeout> | undefined;
}

export interface BuildWindow
{
	SYS?: any;
	FILED?: any;
	FS?: {
		virtual: Record<string, FileRecord | null | undefined>;
		pointers?: ([number, string, FileRecord, string, number, number])[];
	};
	path?: typeof path;
	config?: typeof config;
	dirs?: typeof dirs;
	ENGINE_MEMORY_BASE?: number;
	UI_MEMORY_BASE?: number;
	CGAME_MEMORY_BASE?: number;
	GAME_MEMORY_BASE?: number;
	COMPILE_PLATFORM?: string;
	COMPILE_ARCH?: string;
	GAME_PLATFORM?: string;
	GAME_ARCH?: string;
}
