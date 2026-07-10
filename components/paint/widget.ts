import { Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import Paint from './bundle.js';

export interface MiniPaintApp
{
	Actions: typeof MiniPaintActions;
	Config: MiniPaintConfig;
	FileOpen: MiniPaintFileOpen;
	FileSave: MiniPaintFileSave;
	GUI: MiniPaintGUI;
	Layers: MiniPaintLayers;
	State: MiniPaintState;
	Tools: MiniPaintTools;
}

export interface MiniPaintConfig
{
	TARGET_ELEMENT: HTMLElement | null;
	TRANSPARENCY: boolean;
	COLOR: string;
	ALPHA: number;
	ZOOM: number;
	WIDTH: number;
	HEIGHT: number;
	[key: string]: any; // Catch-all fallback for dynamic properties
}

export interface MiniPaintGUI
{
	init(): void;
	render_main_gui(): void;
	prepare_canvas(): void;
	set_size(width: number, height: number): void;
	clear_canvas(): void;
	draw_grid(ctx: CanvasRenderingContext2D): void;
	GUI_menu: MiniPaintMenu;
}


export interface MiniPaintMenu
{
	menuDefinition: MiniPaintMenuConfig[];
}

export interface MiniPaintLayers
{
	init(): void;
	render(): void;
	insert(layer_data: Partial<MiniPaintLayerData>): void;
	delete(layer_id: number): void;
	select(layer_id: number): void;
	get_layer(layer_id: number): MiniPaintLayerData | null;
	convert_to_canvas(layer_id: number | null): HTMLCanvasElement;
}

export interface MiniPaintLayerData
{
	id: number;
	name: string;
	type: 'image' | 'vector' | 'group' | string;
	visible: boolean;
	opacity: number;
	x: number;
	y: number;
	width: number;
	height: number;
	data: any; // Raw pixel buffers or vector definitions
}

export interface MiniPaintTools
{
	active_tool: string;
	action_data: any;
	activate_tool(name: string): void;
}

export interface MiniPaintState
{
	do_action(action_name: string, params?: any[]): void;
	undo(): void;
	redo(): void;
	save_state(): void;
}

export interface MiniPaintFileOpen
{
	load_file_handler(event: Event | DragEvent): void;
	open_file(file: File): void;
	open_url(url: string): void;
}

export interface MiniPaintFileSave
{
	export_as_png(): void;
	export_as_jpg(): void;
	export_as_json(): void; // Native project structures
}


export interface MiniPaintMenuConfig
{
	name?: string;
	target?: string;
	shortcut?: string;
	ellipsis?: boolean;
	divider?: boolean;
	children?: MiniPaintMenuConfig[];
}


// Declares the bundle components available via import maps or actions modules
declare namespace MiniPaintActions
{
	function Bundle_Action(type: string, data: any): void;
}

// Global declaration augmentation so the compiler understands window attachment targets
declare global
{
	interface Window
	{
		initializeMiniPaint?: (targetNode?: HTMLElement | null) => MiniPaintApp;
		commandRegistry: CommandRegistry;
		globalMenuBar: MenuBar;
	}
}


export class PaintWidget extends Widget
{
	private _paintMenu: Menu | null = null;
	private _isAttachedToMenu = false;
	private _instance?: MiniPaintApp;

	constructor(fileId?: string, initialContent?: string)
	{
		super();

		this.id = 'mini-paint-panel';
		this.title.label = fileId ?? 'Canvas Editor';
		this.title.closable = true;
		this.addClass('lm-miniPaintPanel');

		this._buildInterface();

		// 2. Register Lumino commands matching miniPaint global triggers

		// 3. Track focus internally to swap menu environments dynamically
		this.node.addEventListener('focusin',
			() => this.injectContextualMenus(this._instance?.GUI.GUI_menu.menuDefinition ?? []));
		this.node.addEventListener('focusout', (e) =>
		{
			// Only remove if focus didn't move somewhere else inside this same panel
			if(!this.node.contains(e.relatedTarget as Node))
			{
				this.removeContextualMenus();
			}
		});
	}


	private _buildInterface(): void
	{
		this.node.innerHTML = `
		<nav aria-label="Main Menu" class="main_menu" id="main_menu"></nav>

		<div class="submenu">
			<div class="block attributes" id="action_attributes"></div>
			<button class="undo_button" id="undo_button" type="button">
				<span class="sr_only">Undo</span>
			</button>
		</div>

		<div class="sidebar_left" id="tools_container"></div>


		<div class="middle_area" id="middle_area">

			<canvas class="ruler_left" id="ruler_left"></canvas>
			<canvas class="ruler_top" id="ruler_top"></canvas>

			<div class="main_wrapper" id="main_wrapper">
				<div class="canvas_wrapper" id="canvas_wrapper">
					<div id="mouse"></div>
					<div class="transparent-grid" id="canvas_minipaint_background"></div>
					<canvas id="canvas_minipaint">
						<div class="trn error">
							Your browser does not support canvas or JavaScript is not enabled.
						</div>
					</canvas>
				</div>
			</div>
		</div>

		<div class="sidebar_right">
			<div class="preview block">
				<h2 class="trn toggle" data-target="toggle_preview">Preview</h2>
				<div id="toggle_preview"></div>
			</div>

			<div class="colors block">
				<h2 class="trn toggle" data-target="toggle_colors">Colors</h2>
				<div class="content" id="toggle_colors"></div>
			</div>

			<div class="block" id="info_base">
				<h2 class="trn toggle toggle-full" data-target="toggle_info">Information</h2>
				<div class="content" id="toggle_info"></div>
			</div>

			<div class="details block" id="details_base">
				<h2 class="trn toggle toggle-full" data-target="toggle_details">Layer details</h2>
				<div class="content details-content" id="toggle_details"></div>
			</div>

			<div class="layers block">
				<h2 class="trn">Layers</h2>
				<div class="content" id="layers_base"></div>
			</div>
		</div>
        `;
	}


	/**
	 * LifeCycle: Run interception routines once the iframe element hits the live DOM tree
	 */
	protected onAfterAttach(msg: any): void
	{
		super.onAfterAttach(msg);
		if(typeof window.initializeMiniPaint === 'function')
		{
			this._instance = window.initializeMiniPaint();
			this._onLoadPaint();
			this._registerPaintCommands(this._instance?.GUI.GUI_menu.menuDefinition ?? []);
			this.injectContextualMenus(this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		}
	}

	/**
	 * LifeCycle: Sync Lumino's panel resize dimensions straight into miniPaint's inner loop
	 */
	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		this._updatePainterDimensions();
	}

	/**
	 * LifeCycle: Ensure menu bars are completely unlinked if the panel is permanently destroyed
	 */
	protected onBeforeDetach(msg: any): void
	{
		this.removeContextualMenus();
		super.onBeforeDetach(msg);
	}

	/**
	 * Initialize miniPaint configurations on iframe frame initialization pass
	 */
	private _onLoadPaint(): void
	{
		if(this._instance?.Config)
		{
			// Force alpha layer grid defaults natively
			this._instance.Config.TRANSPARENCY = true;
			if(this._instance.Layers && typeof this._instance.Layers.render === 'function')
			{
				this._instance.Layers.render();
			}
		}
		this._updatePainterDimensions();
	}

	/**
	 * Dynamically resize miniPaint canvas bounding layouts matching Lumino frame mutations
	 */
	private _updatePainterDimensions(): void
	{
		if(typeof this._instance?.GUI === 'undefined') return;

		// Account for edge headers or toolbars inside your frame bounds
		const computedWidth = this.node.clientWidth;
		const computedHeight = this.node.clientHeight;

		if(typeof this._instance.GUI.set_size === 'function')
		{
			this._instance.GUI.set_size(computedWidth, computedHeight);
		}
		if(typeof this._instance.GUI.prepare_canvas === 'function')
		{
			this._instance.GUI.prepare_canvas();
		}
		if(this._instance.Layers && typeof this._instance.Layers.render === 'function')
		{
			this._instance.Layers.render();
		}
	}

	/**
	 * Recursively parses the miniPaint menu definition structure to register commands
	 */
	private _registerPaintCommands(menuItems: MiniPaintMenuConfig[]): void
	{
		menuItems.forEach((item) =>
		{
			if(item.divider) return;

			// If it has children, walk into the sub-branch recursively
			if(item.children && item.children.length > 0)
			{
				this._registerPaintCommands(item.children);
				return;
			}

			// Guard: Must have a functional target action link
			if(!item.target) return;

			const commandId = `minipaint:${item.target}`;

			// Prevent double-registration artifacts
			if(window.commandRegistry.hasCommand(commandId)) return;

			// Map standard text label decorators
			const labelStr = item.name + (item.ellipsis ? '...' : '');
			const mnemonicChar = item.shortcut ? item.shortcut.trim().split(/[\s+]+/).pop()!.toUpperCase() : '';

			window.commandRegistry.addCommand(commandId, {
				label: labelStr,
				mnemonic: item.shortcut ? labelStr.indexOf(mnemonicChar) : -1,
				execute: () =>
				{
					// Route directly into the active miniPaint State pipeline instance
					if(this._instance?.State && typeof this._instance.State.do_action === 'function')
					{
						this._instance.State.do_action(item.target!);
					} else
					{
						console.warn(`Cannot execute miniPaint command ${item.target} - instance not active.`);
					}
				}
			});

			if(item.shortcut)
			{
				const keybindingSequence = [item.shortcut.replace(/Ctrl/gi, 'Accel').replace(/Shift\s*\+\s*/gi, 'Shift ').replace(/\s*\+\s*/g, ' ')];
				if(keybindingSequence.length > 0)
				{
					window.commandRegistry.addKeyBinding({
						command: commandId,
						keys: keybindingSequence,
						selector: 'lm-miniPaintPanel'
					});
				}
			}
		});
	}

	/**
	 * Helper to recursively build nested Lumino Menu trees from configuration files
	 */
	private _buildLuminoSubMenu(menuItems: MiniPaintMenuConfig[], titleLabel: string): Menu
	{
		const menu = new Menu({ commands: window.commandRegistry });
		menu.title.label = titleLabel;

		menuItems.forEach((item) =>
		{
			if(item.divider)
			{
				menu.addItem({ type: 'separator' });
				return;
			}

			if(item.children && item.children.length > 0)
			{
				// Nested branch: Create a cascading child menu item
				const subMenu = this._buildLuminoSubMenu(item.children, item.name || '');
				menu.addItem({ type: 'submenu', submenu: subMenu });
			} else if(item.target)
			{
				// Leaf item: Bind directly back to the matching generated command string
				const commandId = `minipaint:${item.target}`;
				menu.addItem({ command: commandId });
			}
		});

		return menu;
	}

	/**
	 * Contextual Menu Insertion Trigger
	 */
	public injectContextualMenus(menuDefinition: MiniPaintMenuConfig[]): void
	{
		if(this._isAttachedToMenu) return;

		// Ensure all commands mapped across leaf attributes are registered
		this._registerPaintCommands(menuDefinition);

		if(!this._paintMenu)
		{
			this._paintMenu = new Menu({ commands: window.commandRegistry });
			this._paintMenu.title.label = 'Painter';

			// Walk top-level array blocks (e.g., File, Edit, Image, Layers)
			menuDefinition.forEach((topLevelItem) =>
			{
				if(topLevelItem.children && topLevelItem.children.length > 0)
				{
					const subMenu = this._buildLuminoSubMenu(topLevelItem.children, topLevelItem.name || '');
					this._paintMenu!.addItem({ type: 'submenu', submenu: subMenu });
				}
			});
		}

		// Mount the parsed menu tree straight onto your workspace top rails
		window.globalMenuBar.addMenu(this._paintMenu);
		this._isAttachedToMenu = true;
	}

	/**
	 * Contextual Menu Removal Trigger
	 */
	public removeContextualMenus(): void
	{
		if(!this._isAttachedToMenu || !this._paintMenu) return;

		// Snatch it clean back out from the globally visible menu bar bounds
		window.globalMenuBar.removeMenu(this._paintMenu);
		this._isAttachedToMenu = false;
	}

}
