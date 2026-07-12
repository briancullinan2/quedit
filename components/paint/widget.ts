import { Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import type { MenuConfig, MenuModules } from '../bundle/menu-manager';
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
	alertify: Alertify;
	destroy: () => void;
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
		injectMenus: (ownerId: string, config: MenuConfig[] | MenuConfig) => void;
		removeMenus: (ownerId: string) => void;
		initializeMiniPaint?: (targetNode?: HTMLElement | null) => MiniPaintApp;
		registerAllCommands: (menuItems: MenuConfig[] | MenuConfig, commands?: CommandRegistry) => void;
		commandRegistry: CommandRegistry;
		globalMenuBar: MenuBar;
	}
}


const IMAGE_MENU: MenuConfig = {
	name: "Image",
	iconClass: "bx bx-image",
	children: [{
		name: "Information",
		shortcut: "I",
		ellipsis: true,
		target: "image/information.information",
		iconClass: "bx bx-info-circle"
	}, {
		name: "Canvas Size",
		ellipsis: true,
		target: "image/size.size",
		iconClass: "bx bx-frame"
	}, {
		name: "Trim",
		ellipsis: true,
		shortcut: "T",
		target: "image/trim.trim",
		iconClass: "bx bx-shape-trim"
	}, {
		divider: true
	}, {
		name: "Resize",
		ellipsis: true,
		shortcut: "R",
		target: "image/resize.resize",
		iconClass: "bx bx-area"
	}, {
		name: "Rotate",
		ellipsis: true,
		target: "image/rotate.rotate",
		iconClass: "bx bx-rotate-cw"
	}, {
		name: "Flip",
		iconClass: "bx bx-reflect-vertical",
		children: [{
			name: "Vertical",
			target: "image/flip.vertical",
			iconClass: "bx bx-reflect-vertical"
		}, {
			name: "Horizontal",
			target: "image/flip.horizontal",
			iconClass: "bx bx-reflect-horizontal"
		}]
	}, {
		name: "Translate",
		ellipsis: true,
		target: "image/translate.translate",
		iconClass: "bx bx-move"
	}, {
		name: "Opacity",
		ellipsis: true,
		target: "image/opacity.opacity",
		iconClass: "bx bx-brightness-half"
	}, {
		divider: true
	}, {
		name: "Color Corrections",
		ellipsis: true,
		target: "image/color_corrections.color_corrections",
		iconClass: "bx bx-slider"
	}, {
		name: "Auto Adjust Colors",
		shortcut: "F",
		target: "image/auto_adjust.auto_adjust",
		iconClass: "bx bx-magic-wand"
	}, {
		name: "Decrease Color Depth",
		target: "image/decrease_colors.decrease_colors",
		iconClass: "bx bx-layer-minus-alt"
	}, {
		name: "Color Palette",
		ellipsis: true,
		target: "image/palette.palette",
		iconClass: "bx bx-palette"
	}, {
		divider: true
	}, {
		name: "Histogram",
		ellipsis: true,
		target: "image/histogram.histogram",
		iconClass: "bx bx-bar-chart-square"
	}]
};


const LAYER_MENU: MenuConfig = {
	name: "Layer",
	iconClass: "bx bx-layers",
	children: [{
		name: "New",
		shortcut: "N",
		target: "layer/new.new",
		iconClass: "bx bx-file-plus"
	}, {
		name: "New from Selection",
		target: "layer/new.new_selection",
		iconClass: "bx bx-copy-plus"
	}, {
		divider: true
	}, {
		name: "Duplicate",
		shortcut: "D",
		target: "layer/duplicate.duplicate",
		iconClass: "bx bx-copy"
	}, {
		name: "Show / Hide",
		target: "layer/visibility.toggle",
		iconClass: "bx bx-eye-slash"
	}, {
		name: "Delete",
		target: "layer/delete.delete",
		iconClass: "bx bx-trash"
	}, {
		name: "Convert to Raster",
		target: "layer/raster.raster",
		iconClass: "bx bx-image"
	}, {
		divider: true
	}, {
		name: "Move",
		iconClass: "bx bx-move",
		children: [{
			name: "Up",
			target: "layer/move.up",
			iconClass: "bx bx-arrow-up"
		}, {
			name: "Down",
			target: "layer/move.down",
			iconClass: "bx bx-arrow-down"
		}]
	}, {
		name: "Composition",
		ellipsis: true,
		target: "layer/composition.composition",
		iconClass: "bx bx-component"
	}, {
		name: "Rename",
		ellipsis: true,
		target: "layer/rename.rename",
		iconClass: "bx bx-rename"
	}, {
		name: "Clear",
		target: "layer/clear.clear",
		iconClass: "bx bx-x-square"
	}, {
		divider: true
	}, {
		name: "Differences Down",
		target: "layer/differences.differences",
		iconClass: "bx bx-compare"
	}, {
		name: "Merge Down",
		target: "layer/merge.merge",
		iconClass: "bx bx-merge"
	}, {
		name: "Flatten Image",
		target: "layer/flatten.flatten",
		iconClass: "bx bx-layers-minus-alt"
	}]
};


const EFFECTS_MENU: MenuConfig = {
	name: "Effects",
	iconClass: "bx bx-magic-wand",
	children: [{
		name: "Effect browser",
		ellipsis: true,
		target: "effects/browser.browser",
		iconClass: "bx bx-search-alt"
	}, {
		divider: true
	}, {
		name: "Common Filters",
		iconClass: "bx bx-filter",
		children: [{
			name: "Gaussian Blur",
			ellipsis: true,
			target: "effects/common/blur.blur",
			iconClass: "bx bx-blur"
		}, {
			name: "Brightness",
			ellipsis: true,
			target: "effects/common/brightness.brightness",
			iconClass: "bx bx-sun"
		}, {
			name: "Contrast",
			ellipsis: true,
			target: "effects/common/contrast.contrast",
			iconClass: "bx bx-contrast"
		}, {
			name: "Grayscale",
			ellipsis: true,
			target: "effects/common/grayscale.grayscale",
			iconClass: "bx bx-circle-half"
		}, {
			name: "Hue Rotate",
			ellipsis: true,
			target: "effects/common/hue-rotate.hue_rotate",
			iconClass: "bx bx-refresh"
		}, {
			name: "Negative",
			ellipsis: true,
			target: "effects/common/invert.invert",
			iconClass: "bx bx-invert"
		}, {
			name: "Saturate",
			ellipsis: true,
			target: "effects/common/saturate.saturate",
			iconClass: "bx bx-sun-bright"
		}, {
			name: "Sepia",
			ellipsis: true,
			target: "effects/common/sepia.sepia",
			iconClass: "bx bx-color-fill"
		}, {
			name: "Shadow",
			ellipsis: true,
			target: "effects/common/shadow.shadow",
			iconClass: "bx bx-inner-shadow"
		}]
	}, {
		name: "Instagram Filters",
		iconClass: "bx bx-photo-album",
		children: [{
			name: "1977",
			target: "effects/instagram/1977.1977",
			iconClass: "bx bx-image"
		}, {
			name: "Aden",
			target: "effects/instagram/aden.aden",
			iconClass: "bx bx-image"
		}, {
			name: "Clarendon",
			target: "effects/instagram/clarendon.clarendon",
			iconClass: "bx bx-image"
		}, {
			name: "Gingham",
			target: "effects/instagram/gingham.gingham",
			iconClass: "bx bx-image"
		}, {
			name: "Inkwell",
			target: "effects/instagram/inkwell.inkwell",
			iconClass: "bx bx-image"
		}, {
			name: "Lo-fi",
			target: "effects/instagram/lofi.lofi",
			iconClass: "bx bx-image"
		}, {
			name: "Toaster",
			target: "effects/instagram/toaster.toaster",
			iconClass: "bx bx-image"
		}, {
			name: "Valencia",
			target: "effects/instagram/valencia.valencia",
			iconClass: "bx bx-image"
		}, {
			name: "X-Pro II",
			target: "effects/instagram/xpro2.xpro2",
			iconClass: "bx bx-image"
		}]
	}, {
		name: "Black and White",
		ellipsis: true,
		target: "effects/black_and_white.black_and_white",
		iconClass: "bx bx-circle-half"
	}, {
		name: "Borders",
		ellipsis: true,
		target: "effects/borders.borders",
		iconClass: "bx bx-border-outer"
	}, {
		name: "Blueprint",
		target: "effects/blueprint.blueprint",
		iconClass: "bx bx-article"
	}, {
		name: "Box Blur",
		ellipsis: true,
		target: "effects/box_blur.box_blur",
		iconClass: "bx bx-blur"
	}, {
		name: "Denoise",
		ellipsis: true,
		target: "effects/denoise.denoise",
		iconClass: "bx bx-noise"
	}, {
		name: "Dither",
		ellipsis: true,
		target: "effects/dither.dither",
		iconClass: "bx bx-grid"
	}, {
		name: "Dot Screen",
		ellipsis: true,
		target: "effects/dot_screen.dot_screen",
		iconClass: "bx bx-dot-screen"
	}, {
		name: "Edge",
		target: "effects/edge.edge",
		iconClass: "bx bx-border-radius"
	}, {
		name: "Emboss",
		target: "effects/emboss.emboss",
		iconClass: "bx bx-cube"
	}, {
		name: "Enrich",
		ellipsis: true,
		target: "effects/enrich.enrich",
		iconClass: "bx bx-sparkles"
	}, {
		name: "Grains",
		ellipsis: true,
		target: "effects/grains.grains",
		iconClass: "bx bx-noise"
	}, {
		name: "Heatmap",
		target: "effects/heatmap.heatmap",
		iconClass: "bx bx-heatmap"
	}, {
		name: "Mosaic",
		ellipsis: true,
		target: "effects/mosaic.mosaic",
		iconClass: "bx bx-grid-9"
	}, {
		name: "Night Vision",
		target: "effects/night_vision.night_vision",
		iconClass: "bx bx-eye"
	}, {
		name: "Oil",
		ellipsis: true,
		target: "effects/oil.oil",
		iconClass: "bx bx-brush"
	}, {
		name: "Pencil",
		target: "effects/pencil.pencil",
		iconClass: "bx bx-pencil"
	}, {
		name: "Sharpen",
		ellipsis: true,
		target: "effects/sharpen.sharpen",
		iconClass: "bx bx-triangle"
	}, {
		name: "Solarize",
		target: "effects/solarize.solarize",
		iconClass: "bx bx-sun-bright"
	}, {
		name: "Tilt Shift",
		ellipsis: true,
		target: "effects/tilt_shift.tilt_shift",
		iconClass: "bx bx-slider-vertical"
	}, {
		name: "Vignette",
		ellipsis: true,
		target: "effects/vignette.vignette",
		iconClass: "bx bx-vignette"
	}, {
		name: "Vibrance",
		ellipsis: true,
		target: "effects/vibrance.vibrance",
		iconClass: "bx bx-sun-bright"
	}, {
		name: "Vintage",
		ellipsis: true,
		target: "effects/vintage.vintage",
		iconClass: "bx bx-history"
	}, {
		name: "Zoom Blur",
		ellipsis: true,
		target: "effects/zoom_blur.zoom_blur",
		iconClass: "bx bx-blur"
	}]
};



const TOOLS_MENU: MenuConfig = {
	name: "Tools",
	iconClass: "bx bx-wrench",
	children: [{
		name: "Sprites",
		target: "tools/sprites.sprites",
		iconClass: "bx bx-images"
	}, {
		name: "Key-Points",
		target: "tools/keypoints.keypoints",
		iconClass: "bx bx-vector-triangle"
	}, {
		name: "Content Fill",
		ellipsis: true,
		target: "tools/content_fill.content_fill",
		iconClass: "bx bx-paint"
	}, {
		divider: true
	}, {
		name: "Color Zoom",
		ellipsis: true,
		target: "tools/color_zoom.color_zoom",
		iconClass: "bx bx-search-plus"
	}, {
		name: "Replace Color",
		ellipsis: true,
		target: "tools/replace_color.replace_color",
		iconClass: "bx bx-refresh"
	}, {
		name: "Restore Alpha",
		ellipsis: true,
		target: "tools/restore_alpha.restore_alpha",
		iconClass: "bx bx-transparency"
	}, {
		name: "External",
		iconClass: "bx bx-link-external",
		children: [{
			name: "TINYPNG - Compress PNG and JPEG",
			href: "https://tinypng.com",
			iconClass: "bx bx-export"
		}, {
			name: "REMOVE.BG - Remove Image Background",
			href: "https://www.remove.bg",
			iconClass: "bx bx-image-no-background"
		}, {
			name: "PNGTOSVG - Convert Image to SVG",
			href: "https://www.pngtosvg.com",
			iconClass: "bx bx-vector"
		}, {
			name: "SQUOOSH - Compress and Compare Images",
			href: "https://squoosh.app",
			iconClass: "bx bx-compare"
		}]
	}, {
		divider: true
	}, {
		name: "Language",
		iconClass: "bx bx-translate",
		children: [{
			name: "English",
			target: "tools/translate.translate",
			parameter: "en",
			iconClass: "bx bx-globe"
		}, {
			divider: true
		}, {
			name: "عربي",
			target: "tools/translate.translate",
			parameter: "ar",
			iconClass: "bx bx-globe"
		}, {
			name: "简体中文",
			target: "tools/translate.translate",
			parameter: "zh",
			iconClass: "bx bx-globe"
		}, {
			name: "Deutsch",
			target: "tools/translate.translate",
			parameter: "de",
			iconClass: "bx bx-globe"
		}, {
			name: "Dutch",
			target: "tools/translate.translate",
			parameter: "nl",
			iconClass: "bx bx-globe"
		}, {
			name: "English (UK)",
			target: "tools/translate.translate",
			parameter: "uk",
			iconClass: "bx bx-globe"
		}, {
			name: "Español",
			target: "tools/translate.translate",
			parameter: "es",
			iconClass: "bx bx-globe"
		}, {
			name: "Français",
			target: "tools/translate.translate",
			parameter: "fr",
			iconClass: "bx bx-globe"
		}, {
			name: "Greek",
			target: "tools/translate.translate",
			parameter: "el",
			iconClass: "bx bx-globe"
		}, {
			name: "Italiano",
			target: "tools/translate.translate",
			parameter: "it",
			iconClass: "bx bx-globe"
		}, {
			name: "日本語",
			target: "tools/translate.translate",
			parameter: "ja",
			iconClass: "bx bx-globe"
		}, {
			name: "한국어",
			target: "tools/translate.translate",
			parameter: "ko",
			iconClass: "bx bx-globe"
		}, {
			name: "Lietuvių",
			target: "tools/translate.translate",
			parameter: "lt",
			iconClass: "bx bx-globe"
		}, {
			name: "Português",
			target: "tools/translate.translate",
			parameter: "pt",
			iconClass: "bx bx-globe"
		}, {
			name: "русский язык",
			target: "tools/translate.translate",
			parameter: "ru",
			iconClass: "bx bx-globe"
		}, {
			name: "Türkçe",
			target: "tools/translate.translate",
			parameter: "tr",
			iconClass: "bx bx-globe"
		}]
	}, {
		name: "Search",
		shortcut: "F3",
		ellipsis: true,
		target: "tools/search.search",
		iconClass: "bx bx-search"
	}, {
		name: "Settings",
		ellipsis: true,
		target: "tools/settings.settings",
		iconClass: "bx bx-cog"
	}, {
		divider: true
	}, {
		name: "Create Scene",
		target: "project/create_scene",
		iconClass: "bx bx-plus-circle"
	}, {
		name: "Execute Script",
		target: "project/execute_script",
		iconClass: "bx bx-code"
	}]
};



export class PaintWidget extends Widget implements MenuModules
{
	private _paintMenu: Menu | null = null;
	private _isAttachedToMenu = false;
	public _instance?: MiniPaintApp;
	public modules?: Record<string, Record<string, Function>>;

	constructor(fileId?: string, initialContent?: string)
	{
		super();

		this.id = 'mini-paint-panel';
		this.title.label = fileId ?? 'Canvas Editor';
		this.title.closable = true;
		this.addClass('lm-miniPaintPanel');

		this._buildInterface();

		this.node.addEventListener('focusin', () =>
		{
			window.injectMenus(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
			window.injectMenus(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		});
		this.node.addEventListener('focusout', (e) =>
		{
			// Only remove if focus didn't move somewhere else inside this same panel
			if(!this.node.contains(e.relatedTarget as Node))
			{
				window.removeMenus(PaintWidget.name);
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
			this.modules = this._instance?.GUI.modules;
			this._onLoadPaint();
			window.registerAllCommands([IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
			window.registerAllCommands(this._instance?.GUI.GUI_menu.menuDefinition ?? []);
			window.injectMenus(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
			window.injectMenus(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		}
	}


	protected onActivateRequest(msg: any): void
	{
		super.onActivateRequest(msg);
		window.injectMenus(PaintWidget.name, [IMAGE_MENU, LAYER_MENU, EFFECTS_MENU, TOOLS_MENU]);
		window.injectMenus(PaintWidget.name, this._instance?.GUI.GUI_menu.menuDefinition ?? []);
		this.node.focus();
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
		window.removeMenus(PaintWidget.name);
		this._instance?.destroy();
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



}
