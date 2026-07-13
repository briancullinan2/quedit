import { Terminal, IDisposable } from 'xterm';
import { TerminalHistoryManager } from './history'; // Adjust path accordingly

// --- Types & Structural Interfaces ---
export interface ExtractedFile
{
	path: string | null;
	filename: string | null;
	line: number | null;
	index: number;
	text: string;
	isFallback: boolean;
}

export interface TerminalEventPayload
{
	event: MouseEvent | null;
	x: number;
	y: number;
	activeRow: number;
	col: number;
	row: number;
	lineText: string;
	filePath: string | null;
	lineNumber: number | null;
	fileIndex: number;
	isFallback: boolean;
	history: number | null;
}

// Global window extension declarations matching environment specifics
declare global
{
	interface Window
	{
		isModifierPressed?: boolean;
		moveLookLocked?: (mx: number, my: number) => void;
		playerMover?: { jump: () => void; };
		triggerIncrementalSave?: () => void;
		updateModifierPressed?: (arg: any) => void;
		lastNewLine?: boolean;
	}
}

// Constants required by the internal parser expressions
const FILE_NAME_REGEX = /(?:^|\s)([a-zA-Z0-9_\-\.\/]+)(?::(\d+)|#(\d+))?/g;

export class TerminalEventManager
{
	private term: Terminal;
	private container: HTMLElement;
	private statusBar: HTMLElement | null;
	private historyManager: TerminalHistoryManager;

	// Ephemeral instance trackers
	private debounceTerminalMouse: ReturnType<typeof setTimeout> | null = null;
	private previousUpdate: TerminalEventPayload | null = null;
	private isDragging = false;
	private dragDownOffset = 0;

	// Explicit tracking metrics mapped to global UI states
	private targetStartX = 0;
	private targetStartY = 0;
	private renderWidth = 20; // Default spatial placeholder bounds
	private renderMoved = false;
	private isTERMINATED = false;

	// Event cleanup references
	private listeners: IDisposable[] = [];

	constructor(term: Terminal, container: HTMLElement, statusBarId: string = 'status-bar')
	{
		this.term = term;
		this.container = container;
		this.statusBar = document.getElementById(statusBarId);
		this.historyManager = TerminalHistoryManager.getInstance();

		this.init();
	}

	private init(): void
	{
		// Wire pointer and container bindings
		this.container.addEventListener('mousemove', this.handleMouseMove);
		this.container.addEventListener('mousedown', this.handleMouseDown);
		this.container.addEventListener('focus', this.refreshBlinkerState);

		window.addEventListener('mouseup', this.handleMouseUp);
		window.addEventListener('focus', this.refreshBlinkerState);
		document.addEventListener('visibilitychange', this.refreshBlinkerState);

		// Core terminal hooks
		this.listeners.push(this.term.onScroll(() => this.debounceTerminalStatus(null)));
		this.listeners.push(this.term.onRender(() => this.ensureTerminalStarted()));

		this.term.attachCustomKeyEventHandler((arg) => this.handleCustomKeyEvent(arg));
		this.listeners.push(this.term.onData((data) => this.handleRawStreamData(data)));
	}

	public dispose(): void
	{
		this.container.removeEventListener('mousemove', this.handleMouseMove);
		this.container.removeEventListener('mousedown', this.handleMouseDown);
		this.container.removeEventListener('focus', this.refreshBlinkerState);

		window.removeEventListener('mouseup', this.handleMouseUp);
		window.removeEventListener('focus', this.refreshBlinkerState);
		document.removeEventListener('visibilitychange', this.refreshBlinkerState);

		this.listeners.forEach(l => l.dispose());
		this.historyManager.unregister(this.term);
		if(this.debounceTerminalMouse) clearTimeout(this.debounceTerminalMouse);
	}

	private extractFiles(col: number, row: number): ExtractedFile[]
	{
		const buffer = this.term.buffer.active;
		const offsets = [-2, -1, 0, 1, 2];

		let unifiedText = '';
		const charMap: Array<{ col: number; row: number; }> = [];
		let absoluteMouseIndex = -1;

		offsets.forEach(off =>
		{
			const currentRowIdx = row + off;
			const line = buffer.getLine(currentRowIdx);
			if(!line) return;

			const lineStr = line.translateToString(false);

			for(let x = 0; x < lineStr.length; x++)
			{
				if(off === 0 && x === col)
				{
					absoluteMouseIndex = unifiedText.length;
				}

				unifiedText += lineStr[x];
				charMap.push({ col: x, row: currentRowIdx });
			}

			if(line.isWrapped)
			{
				if(off === 0 && col >= lineStr.length)
				{
					absoluteMouseIndex = unifiedText.length;
				}
			} else
			{
				if(off === 0 && col >= lineStr.length)
				{
					absoluteMouseIndex = unifiedText.length;
				}
				unifiedText += '\n';
				charMap.push({ col: lineStr.length, row: currentRowIdx });
			}
		});

		let fileMatch: RegExpExecArray | null;
		FILE_NAME_REGEX.lastIndex = 0;

		while((fileMatch = FILE_NAME_REGEX.exec(unifiedText)) !== null)
		{
			const startIdx = fileMatch.index;
			const endIdx = startIdx + fileMatch[0].length;

			if(absoluteMouseIndex >= startIdx && absoluteMouseIndex < endIdx)
			{
				const fullPath = fileMatch[1];
				const lineNo = fileMatch[2] || fileMatch[3] || fileMatch[4];
				const mappedStart = charMap[startIdx] || { col: 0, row };

				return [{
					path: fullPath,
					filename: fullPath ? fullPath.split('/').pop() || null : null,
					line: lineNo ? parseInt(lineNo, 10) : null,
					index: mappedStart.col,
					text: fileMatch[0],
					isFallback: false
				}];
			}
		}

		const baselineText = buffer.getLine(row)?.translateToString(true)?.trim() || "";
		return [{
			path: null,
			filename: null,
			line: null,
			index: 0,
			text: baselineText,
			isFallback: true
		}];
	}

	private updateTerminalStatus(
		col: number,
		row: number,
		activeRow: number,
		filePath: string | null,
		lineNumber: number | null,
		isFallback: boolean,
		historyIndexValue: number | null
	): void
	{
		if(!this.statusBar) return;

		const buffer = this.term.buffer.active;
		const startRow = buffer.viewportY;
		const endRow = startRow + this.term.rows;

		// Contextually locate active instance buffers safely outside the root loop
		const currentCursorPos = this.historyManager.getHistory().length > 0 ? activeRow : 0;

		this.statusBar.innerText = `Terminal: Mouse: ${col}x${row}, `
			+ `Cursor: ${currentCursorPos}x${activeRow}, `
			+ `Viewport: ${startRow}x${endRow}, `
			+ (historyIndexValue !== null && historyIndexValue !== -1 ? `History: ${historyIndexValue}, ` : '')
			+ (filePath && !isFallback ? (lineNumber !== null ? `File: ${filePath}, Line: ${lineNumber}` : `File: ${filePath}`) : '');
	}

	private detectTerminalEvents(event: MouseEvent | null, x?: number, y?: number, updateStatus = true): TerminalEventPayload
	{
		const rect = this.container.getBoundingClientRect();
		const finalX = event ? (x !== undefined ? x : (event.clientX - rect.left)) : 0;
		const finalY = event ? (y !== undefined ? y : (event.clientY - rect.top)) : 0;

		// Access internal dimensions structures securely
		const coreTerm = (this.term as any)._core;
		const dims = coreTerm._renderService.dimensions.css.cell;

		const col = Math.floor(finalX / dims.width);
		const row = Math.floor(finalY / dims.height) + this.term.buffer.active.viewportY;
		const activeRow = this.term.buffer.active.baseY + this.term.buffer.active.cursorY;

		const files = this.extractFiles(col, row);
		const lineText = files[0]?.text?.trim() || this.term.buffer.active.getLine(row)?.translateToString(true) || "";

		let filePath: string | null = null;
		let lineNumber: number | null = null;
		let isFallback = true;
		let fileIndex = 0;

		if(files.length > 0)
		{
			filePath = files[0].path;
			lineNumber = files[0].line;
			fileIndex = files[0].index;
			isFallback = files[0].isFallback;
		}

		let historyIndexMatch: number | null = null;

		if(lineText)
		{
			const cmdHistory = [...this.historyManager.getHistory()];
			const trimmedLine = lineText.trim();

			if(trimmedLine.length > 0)
			{
				// Find matching vectors directly out of unified storage stacks
				for(let i = cmdHistory.length - 1; i >= 0; i--)
				{
					const trimmedCmd = cmdHistory[i].trim();
					if(trimmedCmd.length > 0 && (trimmedCmd === trimmedLine || trimmedCmd.includes(trimmedLine) || trimmedLine.includes(trimmedCmd)))
					{
						historyIndexMatch = i;
						break;
					}
				}
			}
		}

		if(updateStatus)
		{
			this.updateTerminalStatus(col, row, activeRow, filePath, lineNumber, isFallback, historyIndexMatch);
		}

		return {
			event, x: finalX, y: finalY, activeRow, col, row,
			lineText, filePath, lineNumber, fileIndex,
			isFallback, history: historyIndexMatch
		};
	}

	private handleMouseMove = (event: MouseEvent): void =>
	{
		this.debounceTerminalStatus(event);
	};

	private debounceTerminalStatus(event: MouseEvent | null): boolean
	{
		const rect = this.container.getBoundingClientRect();
		const currentX = event ? event.clientX - rect.left : 0;
		const currentY = event ? event.clientY - rect.top : 0;

		if(this.previousUpdate && event)
		{
			this.previousUpdate.event = event;
			this.previousUpdate.x = currentX;
			this.previousUpdate.y = currentY;
		}

		if(event && (window.isModifierPressed || document.pointerLockElement !== null) && typeof window.moveLookLocked === 'function')
		{
			window.moveLookLocked(event.movementX, event.movementY);
		}

		if(this.isDragging && event)
		{
			event.preventDefault();
			event.stopPropagation();
			const coreTerm = (this.term as any)._core;
			const dims = coreTerm._renderService.dimensions.css.cell;
			const col = Math.floor(currentX / dims.width);
			const row = Math.floor(currentY / dims.height) + this.term.buffer.active.viewportY;
			this.targetStartY = row;
			this.targetStartX = col - this.dragDownOffset;
			this.renderMoved = true;
			return false;
		}

		if(this.debounceTerminalMouse) return true;

		this.debounceTerminalMouse = setTimeout(() =>
		{
			const searchInput = document.getElementById('search-terminal') as HTMLInputElement | null;
			if(searchInput)
			{
				this.scanVisibleViewport(searchInput.value);
			}

			if(!this.previousUpdate && !event)
			{
				// No operational vector trace
			} else if(!this.previousUpdate)
			{
				this.previousUpdate = this.detectTerminalEvents(event, currentX, currentY);
			} else
			{
				this.previousUpdate = this.detectTerminalEvents(this.previousUpdate.event, this.previousUpdate.x, this.previousUpdate.y);
			}

			this.debounceTerminalMouse = null;
		}, 200);

		return true;
	}

	private handleMouseDown = async (event: MouseEvent): Promise<boolean> =>
	{
		event.preventDefault();
		const rect = this.container.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const data = this.detectTerminalEvents(event, x, y);

		const softTab = document.querySelector('#terminals a[href="#soft"].active');
		if(softTab !== null)
		{
			if(data.row === this.targetStartY && data.col > this.targetStartX && data.col < this.targetStartX + this.renderWidth)
			{
				this.isDragging = true;
				this.dragDownOffset = data.col - this.targetStartX;
				document.body.classList.add('dragging');
			}
			if(data.row < this.term.buffer.active.viewportY + (this.term.rows / 2))
			{
				return false;
			}
		}

		if(data.filePath && !data.isFallback && event.button === 0)
		{
			if(typeof (window as any).writeLog === 'function')
			{
				(window as any).writeLog(`File: ${data.filePath}, Line: ${data.lineNumber}, Fallback: ${data.isFallback}`);
			}
			if(typeof (window as any).navigateFile === 'function')
			{
				await (window as any).navigateFile(data.filePath, data.lineNumber);
			}
			return false;
		}

		if(!event.ctrlKey && !event.metaKey && !window.isModifierPressed) return false;

		// Command Prompt Input Locus Shifting mapped via context routing
		if(data.row === data.activeRow)
		{
			this.historyManager.changeCursorPosition(this.term, data.col);
		} else if(data.history !== null && data.history !== -1)
		{
			// Fetch internal target frame state indicators cleanly
			const state = (this.historyManager as any).getState(this.term);
			state.historyIndex = data.history;
			this.historyManager.updateLineFromHistory(this.term);
		}

		return false;
	};

	private handleMouseUp = (): void =>
	{
		this.isDragging = false;
		document.body.classList.remove('dragging');
	};

	private handleCustomKeyEvent(arg: KeyboardEvent): boolean
	{
		this.debounceTerminalStatus(null);

		if(arg.type === "keydown" || arg.type === "keyup")
		{
			if(typeof window.updateModifierPressed === 'function')
			{
				window.updateModifierPressed(arg);
			}
		}

		if(arg.type === "keydown")
		{
			const state = (this.historyManager as any).getState(this.term);

			// --- Ctrl+F: Focus Search Box ---
			if(window.isModifierPressed && arg.code === "KeyF")
			{
				arg.preventDefault?.();
				const searchTerminal = document.getElementById('search-terminal') as HTMLInputElement | null;
				if(searchTerminal)
				{
					searchTerminal.focus();
					const selection = this.term.getSelection();
					if(selection) searchTerminal.value = selection;
					if(searchTerminal.value.length > 0 && typeof (window as any).executeFindQuery === 'function')
					{
						(window as any).executeFindQuery();
					}
				}
			}

			// --- Ctrl+C: Copy / Cancel ---
			if(window.isModifierPressed && arg.code === "KeyC")
			{
				const selection = this.term.getSelection();
				if(selection)
				{
					navigator.clipboard.writeText(selection);
					return false;
				}
				this.term.write('\n\rCTRL+C');
				this.isTERMINATED = true;
				if((window as any).building) this.term.write('\n\rStopping build...');
				this.historyManager.writePrompt(this.term);
				state.cursorPosition = 0;
				state.currentLine = '';
			}

			// --- Backspace: Inline Redraw Splicer ---
			if(arg.code === "Backspace")
			{
				arg.preventDefault?.();

				if(state.cursorPosition > 0)
				{
					const leftSide = state.currentLine.slice(0, state.cursorPosition - 1);
					const rightSide = state.currentLine.slice(state.cursorPosition);

					state.currentLine = leftSide + rightSide;
					state.cursorPosition = state.cursorPosition - 1;

					if(this.term.buffer.active.cursorX === 0)
					{
						this.term.write(`\x1b[A\x1b[${this.term.cols}C`);
					} else
					{
						this.term.write('\b');
					}

					this.term.write('\x1b[s');
					this.term.write(rightSide + '\x1b[K');
					this.term.write('\x1b[u');
				}
				return false;
			}

			// --- Ctrl+V: Paste Filter Loop ---
			if(window.isModifierPressed && arg.code === "KeyV")
			{
				arg.preventDefault?.();

				navigator.clipboard.readText().then(text =>
				{
					if(text)
					{
						const filtered = text.split('').filter(c =>
							c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e
						).join('');

						state.cursorPosition = state.cursorPosition + filtered.length;
						state.currentLine = state.currentLine + filtered;
						this.term.write(filtered);
					}
				}).catch(err => console.error('Paste failed: ', err));
				return false;
			}
		}
		return true;
	}

	private async handleRawStreamData(data: string): Promise<void>
	{
		// Game Engine Vector Controls Interception
		if(typeof (window as any).pressed !== 'undefined' && data.length === 1)
		{
			const lowerChar = data.toLowerCase();

			if(['w', 'a', 's', 'd', ' '].includes(lowerChar))
			{
				let targetKeyCode = lowerChar === ' ' ? 32 : lowerChar.toUpperCase().charCodeAt(0);

				(window as any).pressed[targetKeyCode] = true;
				const selfRef = self as any;
				selfRef.terminalTimers = selfRef.terminalTimers || {};
				clearTimeout(selfRef.terminalTimers[targetKeyCode]);

				selfRef.terminalTimers[targetKeyCode] = setTimeout(() =>
				{
					(window as any).pressed[targetKeyCode] = false;
				}, 120);

				if(lowerChar === ' ' && typeof window.playerMover !== 'undefined')
				{
					window.playerMover.jump();
				}
				return;
			}
		}

		const state = (this.historyManager as any).getState(this.term);

		switch(data)
		{
			case '\r': // Enter / Return
				let committedCommand = '';

				if(state.currentLine.trim().length > 0)
				{
					committedCommand = this.historyManager.commitLine(this.term, state.currentLine);

					if(typeof (window as any).terminalWrite === 'function')
					{
						(window as any).terminalWrite(committedCommand + '\n\r', 'user-input', true);
					}
				} else
				{
					this.historyManager.commitLine(this.term, '');
				}

				if(typeof window.triggerIncrementalSave === 'function')
				{
					window.triggerIncrementalSave();
				}

				try
				{
					window.lastNewLine = true;
					this.term.write('\n\r');

					if(typeof (window as any).handleCommand === 'function')
					{
						await (window as any).handleCommand(committedCommand);
					}
				} catch(e: any)
				{
					if(typeof (window as any).terminalWrite === 'function')
					{
						(window as any).terminalWrite(e.toString() + '\r\n' + (e.stack || e.stacktrace || '') + '\r\n');
					}
				}

				this.historyManager.writePrompt(this.term);
				break;

			case '\u001b[A': // Up Arrow
				this.historyManager.navigateHistory(this.term, 'up');
				break;

			case '\u001b[B': // Down Arrow
				this.historyManager.navigateHistory(this.term, 'down');
				break;

			case '\u001b[D': // Left Arrow
				if(state.cursorPosition > 0)
				{
					state.cursorPosition = state.cursorPosition - 1;
					this.term.write('\u001b[D');
				}
				break;

			case '\u001b[C': // Right Arrow
				if(state.cursorPosition < state.currentLine.length)
				{
					state.cursorPosition = state.cursorPosition + 1;
					this.term.write('\u001b[C');
				}
				break;

			case '\u001b[H': // Home
			case '\u001bOH':
				if(state.cursorPosition > 0)
				{
					this.term.write(`\u001b[${state.cursorPosition}D`);
					state.cursorPosition = 0;
				}
				break;

			case '\u001b[F': // End
			case '\u001bOF':
				if(state.cursorPosition < state.currentLine.length)
				{
					this.term.write(`\u001b[${state.currentLine.length - state.cursorPosition}C`);
					state.cursorPosition = state.currentLine.length;
				}
				break;

			case '\u001b[5~': // Page Up
				this.term.scrollLines(-Math.floor(this.term.rows / 2));
				break;

			case '\u001b[6~': // Page Down
				this.term.scrollLines(Math.floor(this.term.rows / 2));
				break;

			default: // Standard Type Splicing Pass
				if(data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e))
				{
					const leftSide = state.currentLine.slice(0, state.cursorPosition);
					const rightSide = state.currentLine.slice(state.cursorPosition);

					state.currentLine = leftSide + data + rightSide;
					state.cursorPosition = state.cursorPosition + data.length;

					if(rightSide.length === 0)
					{
						this.term.write(data);
					} else
					{
						this.term.write(data + rightSide);
						this.term.write(`\x1b[${rightSide.length}D`);
					}
				}
		}
		this.debounceTerminalStatus(null);
	}

	// --- Placeholder Fallbacks for External Execution Methods ---
	private refreshBlinkerState = (): void =>
	{
		if(typeof (window as any).refreshBlinkerState === 'function')
		{
			(window as any).refreshBlinkerState();
		}
	};

	private ensureTerminalStarted(): void
	{
		if(typeof (window as any).ensureTerminalStarted === 'function')
		{
			(window as any).ensureTerminalStarted();
		}
	}

	private scanVisibleViewport(val: string): void
	{
		if(typeof (window as any).scanVisibleViewport === 'function')
		{
			(window as any).scanVisibleViewport(val);
		}
	}
}

