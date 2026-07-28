import { Widget } from '@lumino/widgets';
import type { MenuConfig, MenuModules } from '../bundle/menu-manager';
const Paint = require('./bundle.js');
import { Message } from '@lumino/messaging';
import { arrayBufferToDataUri } from '../rosetta/binary.mjs';
import { EFFECTS_MENU, IMAGE_MENU, LAYER_MENU, TOOLS_MENU } from './widget-menu';
import './widget-settings';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { PaintWindow } from './widget.d';

const paintSelf: LuminoMenuWindow & LuminoLayoutWindow & PaintWindow & GlobalToolbarsWindow = self as unknown as any;

export interface MiniPaintApp
{
	Actions: MiniPaintActions;
	Config: MiniPaintConfig;
	FileOpen: MiniPaintFileOpen;
	FileSave: MiniPaintFileSave;
	GUI: MiniPaintGUI;
	Layers: MiniPaintLayers;
	State: MiniPaintState;
	Tools: MiniPaintTools;
	alertify: Alertify;
	Events: MiniPaintEvents;
}


export interface MiniPaintEvents
{
	register(
		target: EventTarget,
		type: string,
		handler: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions
	): void;
	activate(): void;
	deActivate(): void;
	destroy(): void;
}


export interface Alertify
{
	success: (msg: string) => void;
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
	layers: any[];
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
	modules: Record<string, Record<string, Function>>;
}


export interface MiniPaintMenu
{
	menuDefinition: MenuConfig[];
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
	is_layer_empty(layer_id: number): boolean;
	get_layers(): any[];
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
	extract_exif(object: HTMLImageElement): any;
}

export interface MiniPaintFileSave
{
	export_as_png(): void;
	export_as_jpg(): void;
	export_as_json(): void; // Native project structures
}


// Declares the bundle components available via import maps or actions modules
declare interface MiniPaintActions
{
	Bundle_Action(type: string, data: any): void;
	[key: string]: any;
}


export class PaintWidget extends Widget implements MenuModules
{
	public _instance?: MiniPaintApp;
	public modules?: Record<string, Record<string, Function>>;
	protected _fileId: string;
	protected _initialContent?: string | ArrayBuffer | Uint8Array | HTMLImageElement | null | undefined;

	constructor(fileId?: string)
	{
		super();

		this._fileId = PaintWidget.getNextTempName();

		this.id = 'mini-paint-panel';
		this.title.label = fileId ?? 'Canvas Editor';
		this.title.closable = true;
		this.addClass('lm-miniPaintPanel');

		this._buildInterface();

		this.node.addEventListener('focusin', () =>
		{
			paintSelf.injectMenus?.(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
			paintSelf.injectMenus?.(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		});
		this.node.addEventListener('focusout', (e) =>
		{
			// Only remove if focus didn't move somewhere else inside this same panel
			if(!this.node.contains(e.relatedTarget as Node))
			{
				paintSelf.removeMenus?.(PaintWidget.name);
			}
		});
	}


	public get fileId(): string
	{
		return this._fileId;
	}


	public static getNextTempName(): string
	{
		return 'temp-' + (paintSelf.nextTemp?.()) + '.bmp';
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
		if(typeof paintSelf.initializeMiniPaint === 'function')
		{
			this._instance = paintSelf.initializeMiniPaint();
			this.modules = this._instance?.GUI.modules;

			this._onLoadPaint();

			const instance = this._instance;
			if(this._initialContent instanceof ArrayBuffer)
			{
				this._initialContent = arrayBufferToDataUri(this._initialContent, this._fileId);
			}
			if(typeof this._initialContent === 'string' && this._initialContent.length > 0 && instance)
			{
				PaintWidget.stringToImageElement(this._initialContent)
					.then(img => PaintWidget.setInitialContent(this._fileId, img, instance));
			}

		}
	}


	protected onActivateRequest(msg: any): void
	{
		super.onActivateRequest(msg);
		paintSelf.injectMenus?.(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
		paintSelf.injectMenus?.(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		paintSelf.resizeHandler?.();
		this.node.focus();
	}


	protected onBeforeHide(msg: Message): void
	{
		paintSelf.removeMenus?.(PaintWidget.name);
		super.onBeforeHide(msg);
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
		paintSelf.removeMenus?.(PaintWidget.name);
		this._instance?.Events.destroy();
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

		this.attachHistoryListener(this._instance?.State, paintSelf.historyToolbar?.appendHistoryItem.bind(paintSelf.historyToolbar));
		paintSelf.registerAllCommands?.([IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
		paintSelf.registerAllCommands?.(this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		paintSelf.injectMenus?.(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
		paintSelf.injectMenus?.(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);

	}

	attachHistoryListener(actionsInstance, callback)
	{
		let _historyArray = actionsInstance.action_history || [];
		let _historyIndex = actionsInstance.action_history_index || 0;

		const arrayMutationHandler = {
			set(target, property, value, receiver)
			{
				const isNumericProp = !isNaN(Number(property));
				const oldLength = target.length;

				const success = Reflect.set(target, property, value, receiver);

				if(success)
				{
					// If an action was added directly via an index assignment or push
					if(isNumericProp && Number(property) >= oldLength)
					{
						callback({
							type: 'action_added',
							history: _historyArray,
							index: _historyIndex,
							...value
						}, "paint");
					} else if(property === 'length')
					{
						callback({
							type: 'history_mutated',
							history: _historyArray,
							index: _historyIndex
						}, "paint");
					}
				}
				return success;
			}
		};

		_historyArray = new Proxy(_historyArray, arrayMutationHandler);

		Object.defineProperties(actionsInstance, {
			'action_history': {
				get() { return _historyArray; },
				set(newArray)
				{
					_historyArray = Array.isArray(newArray) ? new Proxy(newArray, arrayMutationHandler) : newArray;
					callback({ type: 'history_reassigned', history: _historyArray, index: _historyIndex });
				},
				configurable: true,
				enumerable: true
			},
			'action_history_index': {
				get() { return _historyIndex; },
				set(newIndex)
				{
					_historyIndex = newIndex;
					callback({ type: 'index_changed', history: _historyArray, index: _historyIndex });
				},
				configurable: true,
				enumerable: true
			}
		});
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


	static async openFileInNewTab(fileId: string, fileName: string, fileContent?: string | ArrayBuffer | HTMLImageElement | Uint8Array | null | undefined)
	{
		const tabs = Array.from(paintSelf.mainDock?.widgets() ?? []);
		const existingTab = tabs.find(t => (t as PaintWidget).fileId === fileId);

		if(existingTab)
		{
			// If it's already open, just activate it and bring it to focus
			paintSelf.mainDock?.activateWidget(existingTab);
			return;
		}

		const existingDefault = tabs.find(t => t.constructor.name === PaintWidget.name
			&& (t as PaintWidget)._instance
			&& (t as PaintWidget)._instance?.Config
			&& (t as PaintWidget)._instance?.Layers
			&& (t as PaintWidget)._instance?.Config.layers.length === 1
			&& (t as PaintWidget)._instance?.Layers.is_layer_empty((t as PaintWidget)._instance?.Config.layer.id)
		) as PaintWidget;
		if(existingDefault)
		{
			existingDefault.title.label = fileName.split('/').pop() ?? fileName;
			existingDefault._initialContent = fileContent;
			let img: HTMLImageElement | undefined = undefined;
			if(fileContent instanceof ArrayBuffer || fileContent instanceof Uint8Array)
			{
				fileContent = arrayBufferToDataUri(fileContent, fileName);
			}
			if(typeof fileContent === 'string')
			{
				img = await this.stringToImageElement(fileContent);
			}
			if(img && existingDefault._instance)
			{
				this.setInitialContent(fileName, img, existingDefault._instance);
			}
			paintSelf.mainDock?.activateWidget(existingDefault);
			return;
		}

		const newTab = new PaintWidget(fileId);
		newTab._fileId = fileId;
		newTab._initialContent = fileContent;

		newTab.title.label = fileName.split('/').pop() ?? fileName;
		newTab.title.closable = true;

		if(paintSelf.mainDock)
		{
			paintSelf.LayoutAdjuster?.addOptimalWidgetLayout(paintSelf.mainDock, newTab, {
				type: 'editor',
				projectId: newTab.constructor.name
			});
		}
	}



	private static stringToImageElement(url: string): Promise<HTMLImageElement>
	{
		return new Promise((resolve) =>
		{
			const img = new Image();
			img.crossOrigin = "Anonymous";

			img.onload = () => resolve(img);

			img.onerror = (e) =>
			{
				console.error("Failed to decode image data stream.");
				resolve(img); // Avoid locking parent execution context threads on crash limits
			};

			// Fire single data stream translation pass
			img.src = url;
		});
	}


	private static setInitialContent(fileName: string, img: HTMLImageElement, instance: MiniPaintApp)
	{
		console.log(`[VFS Media] Decoded dimensions: ${img.naturalWidth}x${img.naturalHeight}`);

		// 1. Process EXIF hooks inline while the image memory context is active
		let exif;
		if((fileName.includes('.jpg') || fileName.includes('.jpeg')) && typeof instance.FileOpen.extract_exif === 'function')
		{
			try
			{
				exif = instance.FileOpen.extract_exif(img);
			} catch(exifErr)
			{
				console.warn("EXIF extraction skipped:", exifErr);
			}
		}

		// 2. Dispatch straight into miniPaint engine pipeline using the SAME image object instance reference
		if(instance.State && instance.Actions)
		{
			try
			{
				if(instance.Layers && typeof instance.Layers.get_layers === 'function')
				{
					const existingLayers = instance.Layers.get_layers();
					// Loop backwards to cleanly handle splicing indices out of the state trees
					for(let i = existingLayers.length - 1; i >= 0; i--)
					{
						instance.State.do_action(new instance.Actions.Delete_layer_action(existingLayers[i].id));
					}
				}

				const layerPayload = {
					name: fileName || "Data URL",
					type: "image",
					link: img, // Pass the already loaded element directly
					width: img.naturalWidth,
					height: img.naturalHeight,
					width_original: img.naturalWidth,
					height_original: img.naturalHeight,
					x: 0,
					y: 0,
					_exif: exif
				};

				instance.State.do_action(
					new instance.Actions.Bundle_action("open_file_data_url", "Open File Data URL", [
						new instance.Actions.Insert_layer_action(layerPayload),
						new instance.Actions.Autoresize_canvas_action(img.naturalWidth, img.naturalHeight, null, true, true)
					])
				);

			} catch(err)
			{
				console.error("Failed executing miniPaint bundled actions:", err);
			}
		} else
		{
			console.error("miniPaint core engine references missing during canvas load cycle.");
		}

	}

}


paintSelf.PaintWidget = PaintWidget;

