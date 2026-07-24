
import { IPooledTerminal } from "./widget-types";

/**
 * Tokenizes the input command string into structured arguments with start/end offsets.
 * Preserves quotes and tracks character boundaries for mid-string completion.
 */
export interface CommandToken
{
	value: string;
	raw: string;
	start: number;
	end: number;
}
// --- COMMAND SCHEMA TYPES ---

export type CommandArgType = string | string[];

export interface CommandArg
{
	name: string;
	type: CommandArgType;
	description: string;
	complete?: ((currentValue: string, tokens: any[], argnum: number) => string[]) | string[];
}

export interface CommandFlag
{
	description: string;
}

export interface CommandDemo
{
	cmd: string;
	desc: string;
}

export interface CommandDefinition
{
	execute?: (...args: any[]) => any;
	description?: string;
	prereqs?: string[];
	args?: CommandArg[];
	flags?: Record<string, string | CommandFlag>;
	demos?: CommandDemo[];
	alias?: string;
}

export type CommandSchema = Record<string, CommandDefinition>;

// --- GLOBAL WINDOW EXTENSION ---

declare global
{
	interface Window
	{
		COMMAND_SCHEMA: CommandSchema;
		ARG_TYPES: {
			FILE: 'file',          // Local file path validation/completion
			DATABASE: 'database',  // GitHub user/repo path pattern tracking
			STRING: 'string',      // Plain text argument
			NUMERIC: 'number';
		};
	}
}


export function tokenizeCommandLine(input: string): CommandToken[]
{
	const tokens: CommandToken[] = [];
	const regex = /\S+/g;
	let match: RegExpExecArray | null;

	while((match = regex.exec(input)) !== null)
	{
		tokens.push({
			value: match[0],
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}

	return tokens;
}

/**
 * Main Tab Key Autocomplete Handler
 */
export function handleTabAutocomplete(event: KeyboardEvent, currentLine: string, pooledCtx: IPooledTerminal): boolean
{
	if(event.key !== "Tab" || event.type !== "keydown")
	{
		return false;
	}

	event.preventDefault();

	const line = currentLine || "";
	const cursorIndex = pooledCtx?.term?.buffer?.active?.cursorX ?? line.length;

	// --- 1. SPECIAL CASE: COMMAND NAME COMPLETION (argv[0]) ---
	// If there are no spaces and > 1 character, autocompleting the command name
	if(!line.includes(" ") && line.trim().length >= 1)
	{
		completeCommandName(line.trim(), pooledCtx);
		return true;
	}

	// --- 2. TOKENIZE & LOCATE CURSOR IN ARGV ARRAY ---
	const tokens = tokenizeCommandLine(line);
	if(tokens.length === 0) return true;

	// Determine which token index (argnum) the cursor currently rests on
	let argnum = tokens.findIndex(t => cursorIndex >= t.start && cursorIndex <= t.end);

	// If cursor is past the last token (e.g. trailing space), we are starting a new arg
	if(argnum === -1 && cursorIndex >= line.length)
	{
		argnum = line.endsWith(" ") ? tokens.length : tokens.length - 1;
	} else if(argnum === -1)
	{
		argnum = 0;
	}

	const commandName = tokens[0]?.value || "";
	let schemaEntry = window.COMMAND_SCHEMA[commandName];

	// Resolve Command Aliases
	if(schemaEntry && schemaEntry.alias)
	{
		schemaEntry = window.COMMAND_SCHEMA[schemaEntry.alias];
	}

	if(!schemaEntry || argnum === 0)
	{
		// If completing command name mid-string or command not found
		completeCommandName(tokens[0]?.value || "", pooledCtx);
		return true;
	}

	// --- 3. ARGUMENT TYPE RESOLUTION ---
	const argIndex = argnum - 1; // 0-indexed argument offset in schema
	const argDef = schemaEntry.args ? schemaEntry.args[argIndex] : null;

	if(!argDef) return true;

	const currentTokenValue = tokens[argnum]?.value || "";

	// --- 4. DELEGATE TO SPECIALIZED TYPE HANDLERS ---

	// A. Explicit Enum / Array Types (e.g., mode: ['release', 'debug', ...])
	if(Array.isArray(argDef.type) || Array.isArray(argDef.complete))
	{
		const candidates = (Array.isArray(argDef.type) ? argDef.type : argDef.complete) as string[];
		completeEnumArg(currentTokenValue, candidates, tokens, argnum, pooledCtx);
		return true;
	}

	// B. Custom Completion Hook attached directly to schema argument definition
	if(typeof argDef.complete === 'function')
	{
		const candidates = argDef.complete(currentTokenValue, tokens, argnum);
		applyCompletionCandidates(currentTokenValue, candidates, tokens, argnum, pooledCtx);
		return true;
	}

	// C. File Argument Types
	if(argDef.type === window.ARG_TYPES.FILE)
	{
		completeFilenameArg(currentTokenValue, tokens, argnum, pooledCtx);
		return true;
	}

	// D. Database Argument Types
	if(argDef.type === window.ARG_TYPES.DATABASE)
	{
		completeDatabaseArg(currentTokenValue, tokens, argnum, pooledCtx);
		return true;
	}

	return true;
}

/**
 * Autocompletes Command Names (argv[0])
 */
function completeCommandName(partialCommand: string, pooledCtx: IPooledTerminal): void
{
	const allCommands = Object.keys(window.COMMAND_SCHEMA);
	const matches = allCommands.filter(cmd => cmd.startsWith(partialCommand.toLowerCase()));

	if(matches.length === 1)
	{
		// Single match -> Replace inline cleanly
		replaceCurrentLine(matches[0] + " ", pooledCtx);
	} else if(matches.length > 1)
	{
		// Multiple matches -> Print available options to terminal
		printCompletionGrid(matches, pooledCtx);
	}
}

/**
 * Autocompletes Enum / Array Argument Values
 */
function completeEnumArg(
	currentValue: string,
	candidates: string[],
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): void
{
	const matches = candidates.filter(c => c.toLowerCase().startsWith(currentValue.toLowerCase()));
	applyCompletionCandidates(currentValue, matches, tokens, argnum, pooledCtx);
}

/**
 * Autocompletes File paths
 */
function completeFilenameArg(
	currentValue: string,
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): void
{
	// If your app has an in-memory VFS or directory listing cache, query it here:
	const knownFiles = (window as any).vfsFiles || [
		"code/game/g_main.c",
		"code/game/bg_lib.c",
		"code/client/cl_main.c",
		"src/dagcheck.md",
		"quake3e.wasm"
	];

	const matches = knownFiles.filter((f: string) => f.startsWith(currentValue));
	applyCompletionCandidates(currentValue, matches, tokens, argnum, pooledCtx);
}

/**
 * Autocompletes Target Database / Repositories
 */
function completeDatabaseArg(
	currentValue: string,
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): void
{
	const knownDatabases = (window as any).knownDatabases || [
		"briancullinan2/quedit",
		"briancullinan2/quake3e-wasm",
		"id-Software/Quake-III-Arena"
	];

	const matches = knownDatabases.filter((db: string) => db.startsWith(currentValue));
	applyCompletionCandidates(currentValue, matches, tokens, argnum, pooledCtx);
}

/**
 * Replaces token in line or prints candidates grid to the xterm instance
 */
function applyCompletionCandidates(
	currentValue: string,
	matches: string[],
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): void
{
	if(matches.length === 1)
	{
		// Reconstruct command line with the newly substituted argument value
		const updatedTokens = tokens.map((t, idx) => idx === argnum ? matches[0] : t.value);
		if(argnum >= tokens.length)
		{
			updatedTokens.push(matches[0]);
		}
		replaceCurrentLine(updatedTokens.join(" ") + " ", pooledCtx);
	} else if(matches.length > 1)
	{
		printCompletionGrid(matches, pooledCtx);
	}
}

/**
 * Prints a clean, grouped candidate grid to the active terminal instance
 */
function printCompletionGrid(candidates: string[], pooledCtx: IPooledTerminal): void
{
	if(!pooledCtx?.term) return;

	const formattedList = candidates.map(c => `\x1b[36m${c}\x1b[0m`).join("  ");
	pooledCtx.term.write(`\r\n${formattedList}\r\n`);

	// Redraw prompt & current active command line state
	if(typeof prompt === "function")
	{
		prompt();
	}
	if(pooledCtx.events)
	{
		pooledCtx.term.write(pooledCtx.events.historyManager.getState(pooledCtx.term).currentLine);
	}
}

/**
 * Helper to update current input buffer state
 */
function replaceCurrentLine(newLine: string, pooledCtx: IPooledTerminal): void
{
	if(!pooledCtx?.term) return;

	// Erase existing row on terminal screen
	pooledCtx.term.write("\r\x1b[K");

	// Rewrite prompt if method exists
	if(typeof prompt === "function")
	{
		prompt();
	}

	if(pooledCtx.events)
	{
		pooledCtx.events.historyManager.getState(pooledCtx.term).currentLine = newLine;
	}
	pooledCtx.term.write(newLine);
}
