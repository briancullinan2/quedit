import type { GithubWindow } from "../bundle/github.d";
import type { FileRecord } from "../bundle/local.d";
import type { LoggingWindow } from "../bundle/logging.d";
import type { GlobalToolbarsWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { TerminalWindow } from "../terminal/widget.d";
import type { ApiWindow, MockAPI } from "./worker.d";


export interface MakeWindow
{
	BUILD_SCRIPTS?: string[];
	buildTools?: (database?: string | null) => Promise<void>;
	buildQVM?: (database?: string | null) => Promise<void>;
	buildClient?: (database?: string | null) => Promise<void>;
	downloadHeaders?: (headers: any, batchSize?: number, database?: string | null) => Promise<void>;

	updateGlobalBufferAndViews?: () => void;
	BUILDCFLAGS?: (config?: string | null) => string[];

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
	runningWorker?: boolean;
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


export interface CompilerWindow extends
	RepositorySettingsWindow,
	GithubWindow,
	GlobalToolbarsWindow,
	LoggingWindow,
	MakeSystemGlobals,
	TerminalWindow
{

}

export interface JavascriptLogger extends
	LoggingWindow,
	MakeSystemGlobals,
	ApiWindow
{

}

export interface MakeQVMWindow extends
	BuildWindow,
	MakeWindow,
	ApiWindow,
	MakeSystemGlobals,
	RepositorySettingsWindow,
	GlobalToolbarsWindow,
	GithubWindow
{

}

