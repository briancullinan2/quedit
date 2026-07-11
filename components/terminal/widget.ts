import { DockPanel, Widget } from '@lumino/widgets';
import { Terminal } from 'xterm';

const LINES_TO_SCROLLBACK = 5000;

declare global
{
	interface Window
	{
		mainDock: DockPanel;
	}
}

/**
 * Interface tracking an active xterm instance context inside our static pool.
 */
interface IPooledTerminal
{
	id: string;
	term: Terminal;
	container: HTMLDivElement;
	resizeObserver: ResizeObserver;
	activeOwner: TerminalWidget | null;
}

/**
 * Global coordinator managing terminal resource allocation across dock layout splits.
 */
class TerminalPoolManager
{
	private static instance: TerminalPoolManager;
	private pool: Map<string, IPooledTerminal> = new Map();
	private instanceCounter = 0;

	private constructor() { }

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
			activeOwner: widget
		};

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
	private filterId: string;
	private currentTerminalCtx: IPooledTerminal | null = null;

	constructor(filterId: string, titleLabel: string)
	{
		super();
		this.filterId = filterId;
		this.id = `terminal-panel-${filterId}`;
		this.title.label = titleLabel;
		this.title.closable = true;

		this.addClass('terminal-filter-widget');
	}

	/**
	 * Triggered by Lumino lifecycle manager when the tab layout brings this item into view.
	 */
	protected onAfterShow(msg: any): void
	{
		super.onAfterShow(msg);
		this.claimAndRenderSession();
	}

	/**
	 * Triggered by Lumino lifecycle manager when the tab loses active focus or is moved.
	 */
	protected onAfterHide(msg: any): void
	{
		super.onAfterHide(msg);
		this.releaseSession();
	}

	protected onAfterAttach(msg: any): void
	{
		super.onAfterAttach(msg);
		if(this.isVisible)
		{
			this.claimAndRenderSession();
		}
	}

	protected onBeforeDetach(msg: any): void
	{
		this.releaseSession();
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

		// Acquire a terminal context (reused primary or dedicated secondary/tertiary split)
		this.currentTerminalCtx = manager.acquireTerminal(this);

		// Attach terminal DOM structure to this Lumino widget node
		this.node.appendChild(this.currentTerminalCtx.container);

		// Clean and synchronize viewport content
		this.syncTerminalState();

		// Recalculate dimensions for the newly attached node viewport
		manager.fitTerminalLayout(this.currentTerminalCtx);
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
	private syncTerminalState(): void
	{
		if(!this.currentTerminalCtx) return;

		const term = this.currentTerminalCtx.term;
		term.reset();

		// Reapply theme variables dynamically based on root computed style mutations
		this.syncThemeWithAce(term);

		// Pull systemic historical logs from global/window structures
		const sharedLogs = (window as any).terminalLog;
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
				return text.includes('error') || log.source === this.filterId || log.source?.includes(this.filterId);
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
}

// Define the 8 target log workspace profiles
const terminalFilters = [
	{ id: 'all', label: 'All Logs' },
	{ id: 'soft', label: 'Soft Console' },
	{ id: 'system', label: 'System Errors' },
	{ id: 'network', label: 'Network' },
	{ id: 'compiler', label: 'Compiler' },
	{ id: 'database', label: 'Database' },
	{ id: 'auth', label: 'Auth Pipeline' },
	{ id: 'runtime', label: 'Runtime Dev' }
];

// Mount all widgets into the unified layout terminal area stack
terminalFilters.forEach((filter, index) =>
{
	const widget = new TerminalWidget(filter.id, filter.label);

	if(index === 0)
	{
		window.mainDock.addWidget(widget);
	} else
	{
		// Dock as tab items inside the same workspace panel grouping setup by default
		window.mainDock.addWidget(widget, { mode: 'tab-before', ref: widget });
	}
});
