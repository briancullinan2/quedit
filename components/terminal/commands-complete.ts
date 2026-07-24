
import type { CompletionState, IPooledTerminal } from "./widget-types";

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
		levDist(s: string, t: string): number;
		findMatchesWithFuzzy(currentValue: string, candidatesPool: string[]): string[];
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



function completeCommandName(partialCommand: string, pooledCtx: IPooledTerminal): string[]
{
	const allCommands = Object.keys(window.COMMAND_SCHEMA || {});
	return window.findMatchesWithFuzzy(partialCommand, allCommands);
}

function completeEnumArg(
	currentValue: string,
	candidates: string[],
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): string[]
{
	return window.findMatchesWithFuzzy(currentValue, candidates);
}

function completeFilenameArg(
	currentValue: string,
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): string[]
{
	const knownFiles = (window as any).vfsFiles || [
		"code/game/g_main.c",
		"code/game/bg_lib.c",
		"code/client/cl_main.c",
		"src/dagcheck.md",
		"quake3e.wasm"
	];
	return window.findMatchesWithFuzzy(currentValue, knownFiles);
}

function completeDatabaseArg(
	currentValue: string,
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal): string[]
{
	const knownDatabases = (window as any).knownDatabases || [
		"briancullinan2/quedit",
		"briancullinan2/quake3e-wasm",
		"id-Software/Quake-III-Arena"
	];
	return window.findMatchesWithFuzzy(currentValue, knownDatabases);
}


/**
 * Replaces token in line or prints candidates grid to the xterm instance
 */
function applyCompletionCandidates(
	currentValue: string,
	candidates: string[],
	tokens: CommandToken[],
	argnum: number,
	pooledCtx: IPooledTerminal
): void
{
	if(!candidates || candidates.length === 0) return;

	const state = pooledCtx.events?.historyManager?.getState(pooledCtx.term);
	if(!state) return;

	const now = Date.now();
	const prevComp: CompletionState | undefined = state.completionState;
	const isDoubleTab = prevComp && (now - prevComp.lastTabTime <= 1000);

	// --- DOUBLE TAB: Print candidate grid / "Did you mean?" ---
	if(isDoubleTab)
	{
		printCompletionGrid(candidates, pooledCtx, currentValue);
		state.completionState = {
			lastTabTime: now,
			candidates,
			candidateIndex: prevComp ? prevComp.candidateIndex : 0,
			originalTokenValue: prevComp ? prevComp.originalTokenValue : currentValue,
			argnum
		};
		return;
	}

	// --- SINGLE TAB: Rotate candidate inline ---
	let candidateIndex = 0;
	let baseTokenValue = currentValue;

	if(prevComp && prevComp.candidates && prevComp.argnum === argnum)
	{
		candidates = prevComp.candidates;
		baseTokenValue = prevComp.originalTokenValue;
		candidateIndex = (prevComp.candidateIndex + 1) % candidates.length;
	}

	const selectedMatch = candidates[candidateIndex];

	if(argnum === 0)
	{
		replaceCurrentLine(selectedMatch + " ", pooledCtx);
	} else
	{
		const updatedTokens = tokens.map((t, idx) => idx === argnum ? selectedMatch : t.value);
		if(argnum >= tokens.length)
		{
			updatedTokens.push(selectedMatch);
		}
		replaceCurrentLine(updatedTokens.join(" ") + " ", pooledCtx);
	}

	// Persist rotation state for next Tab key
	state.completionState = {
		lastTabTime: now,
		candidates,
		candidateIndex,
		originalTokenValue: baseTokenValue,
		argnum
	};
}

/**
 * Prints a clean, grouped candidate grid to the active terminal instance
 */
function printCompletionGrid(candidates: string[], pooledCtx: IPooledTerminal, originalValue: string): void
{
	if(!pooledCtx?.term) return;

	const lowerOriginal = (originalValue || "").toLowerCase();
	const isFuzzy = candidates.length > 0 && !candidates.some(c => c.toLowerCase().startsWith(lowerOriginal));

	let formattedList = "";
	if(isFuzzy)
	{
		formattedList = `\r\n\x1b[33mDid you mean?\x1b[0m\r\n` + candidates.map(c => `\x1b[36m${c}\x1b[0m`).join("  ");
	} else
	{
		formattedList = `\r\n` + candidates.map(c => `\x1b[36m${c}\x1b[0m`).join("  ");
	}

	pooledCtx.term.write(`${formattedList}\r\n`);

	if(typeof prompt === "function")
	{
		prompt();
	}
	if(pooledCtx.events?.historyManager)
	{
		const activeLine = pooledCtx.events.historyManager.getState(pooledCtx.term).currentLine || "";
		pooledCtx.term.write(activeLine);
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


export function clearCompletionState(state: any): void
{
	if(state) state.completionState = undefined;
}

