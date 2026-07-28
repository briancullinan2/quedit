import type { Terminal } from "@xterm/xterm";
import type { FrameRater } from "../bundle/frame-rater";
import type { TerminalFilter } from "../bundle/menu";
import type { TerminalEventManager } from "./events";
import type { TerminalWidget } from "./widget";
import type { TerminalLogEntry } from "./widget-types";
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { TerminalCommands, TerminalWindow } from './widget.d';
import type { TojiWindow } from '../map-loader/widget.d';
import type { LoggingWindow } from '../bundle/logging.d';
import type { MakeSystemGlobals } from '../compiler/make.d';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { GithubWindow } from "../bundle/github.d";

export interface TerminalCommands
{
	handleCommand?: (input: string, term: Terminal) => Promise<void>;
	statusCommand?: (args: string[], flags: string[]) => Promise<void>;
	push?: (args: string[]) => Promise<void>;
	find?: (argv) => Promise<void>;
	clone?: (argv) => Promise<void>;
}


export interface TerminalWindow
{
	commandHistory?: string[];
	terminalLog?: TerminalLogEntry[];
	terminalFrameLimiter?: FrameRater;
	terminalLoaded?: boolean;
	TERMINAL_REGISTRY?: TerminalFilter[];
	mostRecentTerminalCols?: number;
	TerminalWidget?: typeof TerminalWidget;
	TerminalEventManager?: typeof TerminalEventManager;
	COMMAND_SCHEMA?: CommandSchema;
	ARG_TYPES: {
		FILE: 'file',          // Local file path validation/completion
		DATABASE: 'database',  // GitHub user/repo path pattern tracking
		STRING: 'string',      // Plain text argument
		NUMERIC: 'number';
	};
}

export interface TerminalEvents extends
	LuminoLayoutWindow,
	TerminalWindow,
	TojiWindow,
	LoggingWindow,
	MakeSystemGlobals,
	TerminalCommands
{

}



export interface TerminalCommandWindow extends
	TerminalCommands,
	TerminalWindow,
	LoggingWindow,
	RepositorySettingsWindow,
	LuminoMenuWindow,
	LuminoLayoutWindow,
	GlobalToolbarsWindow,
	MakeSystemGlobals,
	GithubWindow
{
}


export interface TerminalCommandGitWindow extends
	TerminalCommands,
	TerminalWindow,
	GithubWindow,
	GlobalToolbarsWindow
{
}

export interface TerminalCommandFileWindow extends
	TerminalCommands,
	TerminalWindow,
	RepositorySettingsWindow
{
}
