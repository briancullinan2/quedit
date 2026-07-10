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
	AppConfig?: MiniPaintConfig;
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
		this._registerPaintCommands();

		// 3. Track focus internally to swap menu environments dynamically
		this.node.addEventListener('focusin', () => this.injectContextualMenus());
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
		if(this._instance?.AppConfig)
		{
			// Force alpha layer grid defaults natively
			this._instance.AppConfig.TRANSPARENCY = true;
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
	 * Register standalone workspace commands to command registry pipeline
	 */
	private _registerPaintCommands(): void
	{
		if(window.commandRegistry.hasCommand('paint-editor:clear-canvas')) return;

		window.commandRegistry.addCommand('paint-editor:clear-canvas', {
			label: 'Clear Canvas Layers',
			execute: () =>
			{
				if(this._instance?.GUI) this._instance.GUI.clear_canvas();
			}
		});

		window.commandRegistry.addCommand('paint-editor:render-gui', {
			label: 'Force UI Redraw',
			execute: () =>
			{
				if(this._instance?.GUI) this._instance.GUI.render_main_gui();
			}
		});
	}

	/**
	 * Contextual Menu Insertion Trigger
	 */
	public injectContextualMenus(): void
	{
		if(this._isAttachedToMenu) return;

		if(!this._paintMenu)
		{
			this._paintMenu = new Menu({ commands: window.commandRegistry });
			this._paintMenu.title.label = 'Painter';

			// Map out items linking back down to your registered command executors
			this._paintMenu.addItem({ command: 'paint-editor:clear-canvas' });
			this._paintMenu.addItem({ command: 'paint-editor:render-gui' });
		}

		// Add the menu directly into the application level menu bar layout
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
