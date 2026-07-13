import type { SettingConfig, Settings } from '../bundle/settings';
import { DockPanel, Widget } from '@lumino/widgets';
import { Terminal } from 'xterm';
import { TerminalEventManager } from './events';
import type { StatusBarWidget } from '../bundle/status';
import { SearchTerminal } from './search';

const LINES_TO_SCROLLBACK = 5000;

declare global
{
	interface Window
	{
		mainDock: DockPanel;
		terminalFrameLimiter: typeof FrameRater;
		commandHistory: string[];
		SettingsManager: Settings;
		statusBar: StatusBarWidget;
		terminalLog: TerminalLogEntry[];
	}
}

/**
 * Interface tracking an active xterm instance context inside our static pool.
 */
export interface IPooledTerminal
{
	id: string;
	term: Terminal;
	container: HTMLDivElement;
	resizeObserver: ResizeObserver;
	activeOwner: TerminalWidget | null;
	events?: TerminalEventManager;
}

export interface TerminalLogEntry
{
	render: string;
	source: string[] | string;
	text: string;
	index: number;
	line: number;
}




/**
 * FrameCallback defines the signature for processing batched ticks.
 */
export type FrameCallback<T = any> = (data: T, elapsed: number, frameCount: number) => void;

/**
 * FrameRater limits and batches update calls targeting a maximum frame rate.
 * Implemented as an ES6 Singleton with a static entry point.
 *
 * @class FrameRater
 */
class FrameRater<T = any>
{
	// Static private instance container reference holding the Singleton state
	private static _instance: FrameRater<any> | null = null;

	private callback!: FrameCallback<T> | null;
	private startTime!: number;
	private frameCount!: number;
	private eventStack!: T[];
	private isFlushing!: boolean;
	private intervalId!: ReturnType<typeof setInterval> | null;

	/**
	 * Public static entry point to push events onto the frame processor loop stack.
	 * Accessible globally via FrameRater.requestFrameUpdate(data);
	 *
	 * @static
	 * @method requestFrameUpdate
	 * @param {T} data Data payload or event object to pass down to the frame processing callback.
	 */
	static requestFrameUpdate<T = any>(data: T): void
	{
		if(!FrameRater._instance)
		{
			// Automatically initialize with default fallback values if called before instantiation
			FrameRater._instance = new FrameRater<T>(60, null);
		}
		FrameRater._instance.push(data);
	}

	constructor(targetFps: number = 60, callback: FrameCallback<T> | null = null)
	{
		// Enforce the Singleton instantiation pattern behavior constraints strictly
		if(FrameRater._instance)
		{
			return FrameRater._instance as FrameRater<T>;
		}

		this.callback = callback;
		this.startTime = performance.now();
		this.frameCount = 0;
		this.eventStack = [];
		this.isFlushing = false;
		this.intervalId = null;

		this.setTargetFps(targetFps);

		FrameRater._instance = this;
	}

	/**
	 * Changes the maximum target frame rate and re-initializes the internal processing heartbeat interval loop.
	 *
	 * @method setTargetFps
	 * @param {number} targetFps New target frame rate.
	 */
	setTargetFps(targetFps: number): void
	{
		this.stop();

		const fpsInterval = 1000 / targetFps;

		if(this.intervalId)
		{
			clearInterval(this.intervalId);
		}

		this.intervalId = setInterval(() =>
		{
			// Only trigger if items are waiting AND we aren't currently inside a paint cycle
			if(this.eventStack.length > 0 && !this.isFlushing)
			{

				// Shallow copy and clear the stack immediately
				const currentBatch = [...this.eventStack];
				this.eventStack.length = 0;

				requestAnimationFrame((paintTime: number) =>
				{
					this.isFlushing = true; // Lock out the interval thread during execution

					this.frameCount++;
					const t = paintTime - this.startTime;

					try
					{
						if(typeof this.callback === "function")
						{
							// Drain the batch execution. Isolate each callback so a single throw can't drop the rest of the batch.
							for(let i = 0; i < currentBatch.length; i++)
							{
								try
								{
									this.callback(currentBatch[i], t, this.frameCount);
								}
								catch(e)
								{
									console.error("frame callback failed", e);
								}
							}
						}
					}
					finally
					{
						// Always release the lock, even if a callback throws, so the limiter can never freeze permanently.
						this.isFlushing = false;
					}
				});
			}
		}, fpsInterval);
	}

	/**
	 * Sets or overrides the active application update callback wrapper function method.
	 *
	 * @method setCallback
	 * @param {FrameCallback<T>} callback Handler processing batched ticks.
	 */
	setCallback(callback: FrameCallback<T>): void
	{
		this.callback = callback;
	}

	/**
	 * Internal container context mapping function method to push items into processing array tracking lists.
	 *
	 * @method push
	 * @param {T} data
	 */
	push(data: T): void
	{
		this.eventStack.push(data);
	}

	/**
	 * Clears the current active heartbeat interval.
	 *
	 * @method stop
	 */
	stop(): void
	{
		if(this.intervalId !== null)
		{
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Fully tears down the instance container reference layout parameters context properties.
	 *
	 * @method destroy
	 */
	destroy(): void
	{
		this.stop();
		this.eventStack.length = 0;
		if(FrameRater._instance === this)
		{
			FrameRater._instance = null;
		}
	}
}

export { FrameRater };
new FrameRater(25, (e, t, frame) =>
{
	e(t, frame);
});
window.terminalFrameLimiter = FrameRater;


/**
 * Global coordinator managing terminal resource allocation across dock layout splits.
 */
class TerminalPoolManager
{
	private static instance: TerminalPoolManager;
	private pool: Map<string, IPooledTerminal> = new Map();
	private instanceCounter = 0;

	private constructor() { }

	public count(): Number
	{
		return this.pool.size;
	}

	public static getInstance(): TerminalPoolManager
	{
		if(!TerminalPoolManager.instance)
		{
			TerminalPoolManager.instance = new TerminalPoolManager();
		}
		return TerminalPoolManager.instance;
	}

	/**
	 * Allocates an available terminal from the pool or spawns a new one
	 * if all existing sessions are currently occupied by visible widgets.
	 */
	public acquireTerminal(widget: TerminalWidget): IPooledTerminal
	{
		// First, check if there is an unowned terminal session we can recycle
		for(const pooled of this.pool.values())
		{
			if(!pooled.activeOwner || pooled.activeOwner === widget)
			{
				pooled.activeOwner = widget;
				return pooled;
			}
		}

		// Allocate a fresh session if layout splits force simultaneous rendering
		this.instanceCounter++;
		const terminalId = `term-session-${this.instanceCounter}`;

		const container = document.createElement('div');
		container.className = 'terminal-instance-container';
		container.style.width = '100%';
		container.style.height = '100%';

		const term = new Terminal({
			allowProposedApi: true,
			convertEol: true,
			scrollback: LINES_TO_SCROLLBACK,
			cursorBlink: true
		});

		term.open(container);

		const resizeObserver = new ResizeObserver(() =>
		{
			if(widget.isVisible && pooledContext.activeOwner === widget)
			{
				this.fitTerminalLayout(pooledContext);
			}
		});
		resizeObserver.observe(container);

		const pooledContext: IPooledTerminal = {
			id: terminalId,
			term,
			container,
			resizeObserver,
			activeOwner: widget,
		};
		pooledContext.events = new TerminalEventManager(pooledContext, container, window.statusBar);

		this.pool.set(terminalId, pooledContext);

		return pooledContext;
	}

	/**
	 * Releases a widget's ownership claim over a terminal session.
	 */
	public releaseTerminal(widget: TerminalWidget): void
	{
		for(const pooled of this.pool.values())
		{
			if(pooled.activeOwner === widget)
			{
				pooled.activeOwner = null;
				if(pooled.container.parentNode)
				{
					pooled.container.parentNode.removeChild(pooled.container);
				}
			}
		}
	}

	/**
	 * Forces character measurement metrics and resizes the xterm viewport dimensions.
	 */
	public fitTerminalLayout(pooled: IPooledTerminal): void
	{
		const term = pooled.term;
		const container = pooled.container;
		const core = (term as any)._core;

		if(!core || container.clientWidth === 0 || container.clientHeight === 0)
		{
			return;
		}

		if(core._charSizeService && !core._charSizeService.hasValidSize)
		{
			core._charSizeService.measure();
		}

		const dims = core._renderService && core._renderService.dimensions;
		if(!dims || dims.css.cell.width === 0 || dims.css.cell.height === 0)
		{
			return;
		}

		const cols = Math.max(120, Math.floor(container.clientWidth / dims.css.cell.width));
		const rows = Math.max(1, Math.floor(container.clientHeight / dims.css.cell.height));

		term.resize(cols, rows);
	}
}

/**
 * Lumino Component displaying specialized logs driven by a centralized terminal context pool.
 */
export class TerminalWidget extends Widget
{
	public filterId: string;
	private currentTerminalCtx: IPooledTerminal | null = null;
	public searchContainer!: HTMLDivElement;
	public searchInput!: HTMLInputElement;

	constructor(filterId: string, titleLabel: string)
	{
		super();
		if(filterId === 'Show Console')
		{
			this.filterId = terminalFilters[0].id;
			this.id = `terminal-panel-${this.filterId}`;
			this.title.label = terminalFilters[0].label;
		} else
		{
			this.filterId = filterId;
			this.id = `terminal-panel-${filterId}`;
			this.title.label = titleLabel;
		}
		this.title.closable = true;

		this.addClass('terminal-filter-widget');

		window.SettingsManager.hydrateAll(LOCAL_SETTINGS.editor);
	}


	private createSearchElement(): void
	{
		this.searchContainer = document.createElement('div');
		this.searchContainer.className = 'lumino-tab-search-wrapper';
		// Start hidden until onAfterShow fires
		this.searchContainer.style.display = 'none';

		this.searchInput = document.createElement('input');
		this.searchInput.type = 'search';
		this.searchInput.id = 'search-terminal';
		this.searchInput.placeholder = 'Search...';
		this.searchInput.autocomplete = 'off';

		this.searchInput.addEventListener('keypress', event =>
		{
			if(event.key === 'Enter')
			{
				event.preventDefault();
			}

			if(!this.currentTerminalCtx)
			{
				return;
			}

			SearchTerminal.executeFindQuery(this.currentTerminalCtx, event);
		});
		this.searchContainer.appendChild(this.searchInput);
	}


	/**
	 * Triggered by Lumino lifecycle manager when the tab layout brings this item into view.
	 */
	protected onAfterShow(msg: any): void
	{
		super.onAfterShow(msg);
		this.claimAndRenderSession();
		this.showSearchBar();
	}

	private resizeSearchContainer = () =>
	{
		const parentTabBar = this.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector('.lm-TabBar') as HTMLElement;

		if(!parentTabBar || !this.searchContainer || this.searchContainer.style.display === 'none')
		{
			return;
		}

		// Ensure searchContainer doesn't push the tab bar layout around
		this.searchContainer.style.position = 'absolute';
		this.searchContainer.style.right = '0px';

		const totalWidth = parentTabBar.getBoundingClientRect().width;
		let occupiedWidth = 0;

		// Target the actual tab items (typically 'li' elements with the class '.lm-TabBar-tab')
		// instead of the full-width wrapper panels.
		const actualTabs = parentTabBar.querySelectorAll('.lm-TabBar-content li');

		actualTabs.forEach((tab) =>
		{
			const element = tab as HTMLElement;
			const rect = element.getBoundingClientRect();

			const style = window.getComputedStyle(element);
			const margins = parseFloat(style.marginLeft || '0') + parseFloat(style.marginRight || '0');
			const elementTotalWidth = rect.width + margins;

			// If adding this element exceeds the available row width, it wraps to a new row.
			// We reset the row's occupied width tracking back to 0 before adding this element.
			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Handle any extra functional sibling controls (like scroll buttons if present)
		const extraControls = parentTabBar.querySelectorAll('.lm-TabBar-scrollButton');
		extraControls.forEach((control) =>
		{
			const element = control as HTMLElement;
			const rect = element.getBoundingClientRect();
			const elementTotalWidth = rect.width;

			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Set max-width based on the remaining space on the final row line
		const remainingSpace = Math.max(0, totalWidth - occupiedWidth - 15);
		this.searchContainer.style.maxWidth = `${remainingSpace}px`;
	};

	private showSearchBar()
	{
		const parentTabBar = this.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector('.lm-TabBar') as HTMLElement;

		if(parentTabBar && this.searchContainer)
		{
			parentTabBar.appendChild(this.searchContainer);
			this.searchContainer.style.display = 'flex';

			// Calculate initial width
			window.requestAnimationFrame(() =>
			{
				this.resizeSearchContainer();
			});

			// Listen for window resizing to keep the width updated
			window.removeEventListener('resize', this.resizeSearchContainer);
			window.addEventListener('resize', this.resizeSearchContainer);
		}
	}

	/**
	 * Triggered by Lumino lifecycle manager when the tab loses active focus or is moved.
	 */
	protected onAfterHide(msg: any): void
	{
		super.onAfterHide(msg);
		this.releaseSession();

		if(this.searchContainer)
		{
			if(this.searchContainer.parentNode)
			{
				this.searchContainer.parentNode.removeChild(this.searchContainer);
			}
			this.searchContainer.style.display = 'none';
			window.removeEventListener('resize', this.resizeSearchContainer);
		}
	}

	protected onAfterAttach(msg: any): void
	{
		this.createSearchElement();
		if(this.isVisible)
		{
			this.claimAndRenderSession();
			this.showSearchBar();
		}
		super.onAfterAttach(msg);
	}

	protected onBeforeDetach(msg: any): void
	{
		this.releaseSession();
		if(this.searchContainer && this.searchContainer.parentNode)
		{
			this.searchContainer.parentNode.removeChild(this.searchContainer);
		}
		super.onBeforeDetach(msg);
	}

	protected onResize(msg: any): void
	{
		super.onResize(msg);
		if(this.currentTerminalCtx)
		{
			TerminalPoolManager.getInstance().fitTerminalLayout(this.currentTerminalCtx);
		}
	}


	/**
	 * Requests an available terminal session from the static pool and mounts its element.
	 */
	private claimAndRenderSession(): void
	{
		const manager = TerminalPoolManager.getInstance();
		const shouldInitAll = manager.count() === 0;

		// Acquire a terminal context (reused primary or dedicated secondary/tertiary split)
		this.currentTerminalCtx = manager.acquireTerminal(this);

		// Attach terminal DOM structure to this Lumino widget node
		this.node.appendChild(this.currentTerminalCtx.container);

		// Recalculate dimensions for the newly attached node viewport
		manager.fitTerminalLayout(this.currentTerminalCtx);

		if(shouldInitAll)
		{
			TerminalWidget.initializeAllPanels();
		}
	}

	/**
	 * Releases current active terminal session claim back to the global pool.
	 */
	private releaseSession(): void
	{
		if(this.currentTerminalCtx)
		{
			TerminalPoolManager.getInstance().releaseTerminal(this);
			this.currentTerminalCtx = null;
		}
	}

	/**
	 * Clears out existing frame contexts and streams the matching log filter content.
	 */
	public syncTerminalState(): void
	{
		if(!this.currentTerminalCtx) return;

		const term = this.currentTerminalCtx.term;
		term.reset();

		// Reapply theme variables dynamically based on root computed style mutations
		this.syncThemeWithAce(term);

		// Pull systemic historical logs from global/window structures
		const sharedLogs = window.terminalLog;
		if(!sharedLogs || !Array.isArray(sharedLogs)) return;

		if(this.filterId === 'soft')
		{
			term.options.scrollback = 0;
			if(typeof (window as any).captureRenderToTerminalCorner === 'function')
			{
				(window as any).captureRenderToTerminalCorner(term);
			}
			return;
		}

		term.options.scrollback = LINES_TO_SCROLLBACK;

		const filteredBuffer = sharedLogs
			.filter((log: any) =>
			{
				const text = log.text || log || '';
				if(this.filterId === 'all') return true;
				return log.source === this.filterId || log.source?.includes(this.filterId);
			})
			.map((log: any) => log.text || log || '')
			.join('');

		term.write(filteredBuffer);

		// Maintain active blink schedules cleanly
		term.focus();
		const core = (term as any)._core;
		if(core && core._cursorBlinkContext)
		{
			core._cursorBlinkContext.restartInterval();
		}
	}


	/**
	 * Pulls CSS variables from the DOM tree directly to paint the active terminal surface.
	 */
	private syncThemeWithAce(term: Terminal): void
	{
		const style = getComputedStyle(document.body);
		const getAceVar = (name: string) => style.getPropertyValue(name).trim();

		const background = getAceVar('--ace-bg');
		const foreground = getAceVar('--ace-foreground');
		const gutter = getAceVar('--ace-gutter-bg');
		const pink = getAceVar('--ace-pink');
		const purple = getAceVar('--ace-purple');
		const blue = getAceVar('--ace-blue');
		const green = getAceVar('--ace-green');

		const parseToHex = (colorStr: string): string =>
		{
			if(!colorStr || typeof colorStr !== 'string') return colorStr;
			if(colorStr.startsWith('#')) return colorStr;
			const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
			if(!match) return colorStr;
			const hexR = parseInt(match[1], 10).toString(16).padStart(2, '0');
			const hexG = parseInt(match[2], 10).toString(16).padStart(2, '0');
			const hexB = parseInt(match[3], 10).toString(16).padStart(2, '0');
			return `#${hexR}${hexG}${hexB}`;
		};

		const bgHex = parseToHex(background);
		const fgHex = parseToHex(foreground);

		term.options.theme = {
			background: bgHex,
			foreground: fgHex,
			cursor: fgHex,
			selectionForeground: '#DEADBE',
			selectionBackground: '#DEADBE',
			selectionInactiveBackground: '#DEADBE',
			black: bgHex,
			white: fgHex,
			magenta: parseToHex(pink),
			cyan: parseToHex(purple),
			blue: parseToHex(blue),
			green: parseToHex(green),
			brightBlack: parseToHex(gutter)
		};
	}


	static initializeAllPanels()
	{

		// Mount all widgets into the unified layout terminal area stack
		terminalFilters.forEach((filter, index) =>
		{
			if(document.querySelector(`#terminal-panel-${filter.id}`))
			{
				return;
			}

			const widget = new TerminalWidget(filter.id, filter.label);

			if(index === 0)
			{
				window.mainDock.addWidget(widget);
			} else
			{
				const mainTerminal = Array.from(window.mainDock.widgets()).find(w => w.id === 'terminal-panel-all');
				// Dock as tab items inside the same workspace panel grouping setup by default
				window.mainDock.addWidget(widget, { mode: 'tab-before', ref: mainTerminal });
			}
		});

	}

}

export interface TerminalFilter
{
	id: string;
	label: string;
}


export const terminalFilters: TerminalFilter[] = [
	// Log Levels & Diagnostics
	{ id: 'all', label: 'All Logs' },
	{ id: 'error', label: 'Errors' },
	{ id: 'warn', label: 'Warnings' },

	// Core UI & Systems
	{ id: 'soft', label: 'CLI Render' },    // Matches your custom terminal viewport / frame limiter
	{ id: 'build', label: 'Build' },        // Compiler, AST parsers, build chains
	{ id: 'runtime', label: 'Runtime Dev' }, // Main loop, tasks, orchestration

	// Network & Background
	{ id: 'network', label: 'Network' },    // Custom meshes, P2P syncing, OAuth channels
	{ id: 'console', label: 'Console' },    // Standard fallback stdout / logging intercepts
	{ id: 'ai', label: 'AI Integration' }   // Local models, WebGPU memory, inference steps
];



const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	terminal: {
		commandHistory: {
			key: 'history',
			default: [],
			type: 'array',
			description: 'An indexed collection tracking sequential command strings typed into the text interface console for fast history scrolling.',
			set: (val) =>
			{
				const newValue = val.slice(0);
				if(!window.commandHistory) window.commandHistory = [];
				window.commandHistory.length = 0;
				if(Array.isArray(newValue))
				{
					newValue.forEach(cmd => { if(cmd.trim()) window.commandHistory.push(cmd); });
				}
			}
		},
		terminalLog: {
			key: 'terminal_log',
			edit: false,
			default: [],
			type: 'json',
			description: 'Persistent text logging buffer retaining runtime system updates, build logs, and standard out/error print operations.'
		}
	},

};


if(!window.IMPORT_SETTINGS)
{
	window.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	window.IMPORT_SETTINGS[moduleKey] = {
		...(window.IMPORT_SETTINGS[moduleKey] || {}),
		...configs
	};
}

export const IMPORT_SETTINGS = window.IMPORT_SETTINGS;
