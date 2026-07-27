import { DockPanel, Widget } from "@lumino/widgets";
import { TerminalLogEntry } from "../terminal/widget-types";
import { AceSession } from "../editor/widget";
import { specialWrite, terminalWrite } from "./logging";

// --- TYPES & INTERFACES ---
export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export type SourceMetadata = [
	category: string,
	...trailingFilesAndFunc: string[],
	rawFileName: string,
	rawFilePath: string
];

export interface ParsedStackFrame
{
	func: string;
	file: string;
}

export type CalleeInfo = [
	func: string,
	trailingFiles: string[],
	category: string,
	rawFile: string
];


export interface LoggingWindow
{
	lineCount?: number;
	originalConsole?: {
		log: typeof console.log,
		warn: typeof console.warn,
		error: typeof console.error,
		info: typeof console.info;
	};

	compilerDiagnostics?: {
		log: (msg: string) => void;
		clear: () => void;
		getBridge: () => {
			refreshActiveEditorView: (session: AceSession) => void;
		};
	};

	terminalLog: TerminalLogEntry[];
	mainDock: DockPanel;
	lastInteractedWidget: Widget | null;
	terminalWrite?: typeof terminalWrite;
	runningCommand?: boolean;
	detachedConsole?: boolean;
	alreadyWroteDetached?: boolean;
	specialWrite?: typeof specialWrite;
}

declare var self: Window & LoggingWindow & typeof globalThis;
