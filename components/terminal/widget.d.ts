import type { FrameRater } from "../bundle/frame-rater";
import type { TerminalFilter } from "../bundle/menu";
import type { TerminalEventManager } from "./events";
import type { TerminalWidget } from "./widget";
import type { TerminalLogEntry } from "./widget-types";


export interface TerminalWindow
{
	commandHistory?: string[];
	terminalLog?: TerminalLogEntry[];
	terminalFrameLimiter?: FrameRater;
	terminalLoaded?: boolean;
	TERMINAL_REGISTRY?: TerminalFilter[];
	mostRecentTerminalCols?: number;
	TerminalWidget?: typeof TerminalWidget;
	TerminalEventManager: typeof TerminalEventManager;
	COMMAND_SCHEMA: CommandSchema;
	ARG_TYPES: {
		FILE: 'file',          // Local file path validation/completion
		DATABASE: 'database',  // GitHub user/repo path pattern tracking
		STRING: 'string',      // Plain text argument
		NUMERIC: 'number';
	};
}

