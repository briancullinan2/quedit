import { BoxPanel, DockPanel, FocusTracker, MenuBar, Panel, Widget } from "@lumino/widgets";
import { LayoutAdjuster, WIDESCREEN } from "./lumino-widget";
import type { RepositoryToolbar } from "./menu-repos";
import type { ScriptToolbar } from "./menu-script";
import type { ApplicationToolbar } from "./menu-app";
import type { FileToolbar } from "./menu-file";
import type { HistoryToolbar } from "./menu-history";
import type { SettingsToolbar } from "./menu-settings";
import type { EngineToolbar } from "./menu-engine";

export interface LuminoLayoutNode
{
	type: 'tab-area' | 'split-area';
	orientation?: 'horizontal' | 'vertical';
	children?: LuminoLayoutNode[];
	widgets?: any[];
	sizes?: number[];
}



declare global
{
	interface Window
	{
		activityTracker: FocusTracker<Widget>;
		workspaceBox: BoxPanel;
		toolbarWidget: Widget;
		lastInteractedWidget: Widget | null;
		previousInteractedWidget: Widget | null;
		repoToolbar: RepositoryToolbar;
		scriptToolbar: ScriptToolbar;
		appToolbar: ApplicationToolbar;
		fileToolbar: FileToolbar;
		historyToolbar: HistoryToolbar;
		settingsToolbar: SettingsToolbar;
		engineToolbar: EngineToolbar;
	}
}

export type ToolbarKey = 'repoToolbar' | 'scriptToolbar' | 'appToolbar' | 'fileToolbar' | 'historyToolbar' | 'settingsToolbar' | 'engineToolbar';

/**
 * Inverted Registry: Maps each Toolbar to the Widget classes that activate it.
 */
const TOOLBAR_CONTEXT_MAP: Record<ToolbarKey, string[]> = {
	appToolbar: [
		'ConsoleWidget', 'AceEditorWidget', 'PaintWidget', 'NunuStudioWidget',
		'DedicatedCanvasWidget', 'FileListWidget', 'GameListWidget',
		'AssetListWidget', 'GithubWidget', 'SettingsWidget', 'SearchWidget', 'AudioEditorWidget'
	],
	fileToolbar: [
		'AceEditorWidget', 'FileListWidget', 'GameListWidget', 'AssetListWidget'
	],
	scriptToolbar: [
		'ConsoleWidget', 'AceEditorWidget'
	],
	repoToolbar: [
		'FileListWidget', 'GameListWidget', 'GithubWidget'
	],
	engineToolbar: [
		'PaintWidget', 'NunuStudioWidget', 'DedicatedCanvasWidget', 'AssetListWidget'
	],
	historyToolbar: [
		'ConsoleWidget', 'GithubWidget', 'AceEditorWidget'
	],
	settingsToolbar: [
		'NunuStudioWidget', 'SettingsWidget'
	]
};

// Array for iterating through your global window instances safely
const ALL_TOOLBARS = Object.keys(TOOLBAR_CONTEXT_MAP) as ToolbarKey[];

export const activityTracker = new FocusTracker<Widget>();
window.activityTracker = activityTracker;

export class ResponsiveManager
{
	private static _instance: ResponsiveManager | null = null;
	private _prevWidgetCount: number = 0;

	private constructor() { }

	public static getInstance(): ResponsiveManager
	{
		if(!ResponsiveManager._instance)
		{
			ResponsiveManager._instance = new ResponsiveManager();

			// 2. Connect directly to the active widget change signal
			activityTracker.currentChanged.connect((sender: FocusTracker<Widget>, args: FocusTracker.IChangedArgs<Widget>) =>
			{
				// args.oldValue -> The widget that lost focus
				// args.newValue -> The widget that gained focus

				const newType = args.newValue?.constructor.name;
				const lastType = window.lastInteractedWidget?.constructor.name;

				// Only update history if the incoming widget type is different from the last tracked type
				if(newType !== lastType)
				{
					window.previousInteractedWidget = window.lastInteractedWidget;
					window.lastInteractedWidget = args.newValue;
				}

				console.log('Active: ' + window.lastInteractedWidget?.constructor.name + ' inActive: ' + window.previousInteractedWidget?.constructor.name);
				window.resizeHandler();
			});

		}
		return ResponsiveManager._instance;
	}

	/**
	 * Single Entry Chain Controller
	 */
	public handleResize(
		windowRoot: BoxPanel,
		workspaceBox: BoxPanel,
		headerRow: Panel,
		menuBar: MenuBar,
		toolbar: Widget,
		mainDock: DockPanel
	): void
	{
		const currentWidgets = Array.from(mainDock.widgets());

		// 1. Process responsive visibility rules & directions
		this._updateVisibility(workspaceBox, toolbar);

		// 2. Measure wrapped DOM layout sizes & update Lumino layout limits
		this._recalculateToolbarHeight(headerRow);

		// 3. Process layout constraints if widget viewport configurations change
		this._adjustDockPanelLayout(mainDock, currentWidgets);

		// 4. Run synchronized layout updates cascading down the layout trees
		workspaceBox.fit();
		headerRow.fit();
		windowRoot.update();
	}


	/**
	 * Utility 1: Handle UI Visibility, State and Mobile Adaptations
	 */
	private _updateVisibility(workspaceBox: BoxPanel, toolbar: Widget): void
	{
		const isWidescreen = window.innerWidth >= WIDESCREEN;
		const isNormal = window.innerWidth < 800;
		const isMobile = window.innerWidth < 600;
		const isToolbarScrollable = window.innerHeight < 700;

		// 1. ORIGINAL TOOLBAR PARAMETER LOGIC (UNTOUCHED)
		if(isToolbarScrollable)
		{
			toolbar.node.style.minWidth = '60px';
		} else
		{
			toolbar.node.style.minWidth = '50px';
		}

		if(isMobile)
		{
			workspaceBox.direction = 'top-to-bottom';
			toolbar.node.style.display = 'none';
			toolbar.node.style.minWidth = '0px';
		} else
		{
			workspaceBox.direction = 'left-to-right';
			toolbar.node.style.display = 'flex';
		}

		// 2. DYNAMIC REGISTRY VISIBILITY LOGIC (ON GLOBAL WINDOW TOOLBARS)
		const currentClass = window.lastInteractedWidget?.constructor.name || '';
		const previousClass = window.previousInteractedWidget?.constructor.name || '';

		ALL_TOOLBARS.forEach((key) =>
		{
			const globalToolbar = window[key];
			if(!globalToolbar || !globalToolbar.node) return;

			const allowedWidgets = TOOLBAR_CONTEXT_MAP[key] || [];
			const isNeededByCurrent = allowedWidgets.includes(currentClass);
			const isNeededByPrevious = allowedWidgets.includes(previousClass);

			let dynamicContextMatch = isNeededByCurrent;
			if(isWidescreen && !dynamicContextMatch)
			{
				dynamicContextMatch ||= isNeededByPrevious;
			}

			if(isMobile)
			{
				globalToolbar.node.style.display = 'none';
				globalToolbar.node.style.minWidth = '0px';
			} else
			{
				if(dynamicContextMatch)
				{
					globalToolbar.node.style.display = 'flex';
				} else
				{
					globalToolbar.node.style.display = 'none';
				}
			}
		});
	}


	/**
	 * Utility 2: Dynamic Scroll Height Profiler (Fixes the wrapping clipping bug)
	 */
	private _recalculateToolbarHeight(headerRow: Panel): void
	{
		// Clear old inline styles to allow natural text wrapping evaluations
		headerRow.node.style.minHeight = '';
		headerRow.node.style.height = '';

		// Grab the actual rendered height required by CSS flex-wrap
		const currentNeededHeight = headerRow.node.scrollHeight;

		// Update headerRow constraints if your layouts restrict it
		headerRow.node.style.minHeight = `${currentNeededHeight + 10}px`;
		headerRow.update();
	}

	/**
	 * Utility 3: Tree Split Area Layout Size Allocation
	 */
	private _adjustDockPanelLayout(mainDock: DockPanel, currentWidgets: any[]): void
	{
		if(currentWidgets.length <= this._prevWidgetCount)
		{
			this._prevWidgetCount = currentWidgets.length;
			return;
		}

		const layout = mainDock.saveLayout() as unknown as { main: LuminoLayoutNode | null; };
		if(!layout || !layout.main)
		{
			this._prevWidgetCount = currentWidgets.length;
			return;
		}

		// 1. Gather file list widget targets
		const targetIds = this._extractTargetWidgetIds(currentWidgets);
		console.log('Resizing file list target: ' + targetIds.size);

		if(targetIds.size > 0)
		{
			const totalWidth = mainDock.node.clientWidth || 800;
			const totalHeight = mainDock.node.clientHeight || 600;

			const rootOrientation = layout.main.orientation || 'horizontal';
			const initialSpace = rootOrientation === 'horizontal' ? totalWidth : totalHeight;

			// 2. Execute the recursive layout size mutations
			LayoutAdjuster.handleResponsiveLayoutCollapse(mainDock);
			this._traverseAndAdjustSizes(layout.main, initialSpace, targetIds);

			// 3. Flush layout modifications back to the dock
			mainDock.restoreLayout(layout as any);
		}

		this._prevWidgetCount = currentWidgets.length;
	}

	/**
	 * Filter and extract active targets safely
	 */
	private _extractTargetWidgetIds(widgets: any[]): Set<string>
	{
		const targetIds = new Set<string>();
		widgets.forEach(widget =>
		{
			if(widget.constructor.name === 'FileListWidget')
			{
				targetIds.add(widget.id);
			}
		});
		return targetIds;
	}

	/**
	 * Recursive layout node walker that maps dimensions down the node tree branches
	 */
	private _traverseAndAdjustSizes(node: LuminoLayoutNode, availablePixelSpace: number, targetIds: Set<string>): void
	{
		if(node.type === 'split-area' && node.children)
		{
			// FIX: If sizes array is missing or unpopulated, initialize it to equal shares
			if(!node.sizes || node.sizes.length !== node.children.length)
			{
				node.sizes = new Array(node.children.length).fill(1 / node.children.length);
			}

			let targetIndex = -1;

			// Locate which split slot sibling branch contains our matching view frame
			node.children.forEach((child, index) =>
			{
				if(this._containsTargetWidget(child, targetIds))
				{
					targetIndex = index;
				}
			});

			// Mutate fractional scales for this split boundary layout inline
			if(targetIndex !== -1)
			{
				node.sizes = this._calculateProportionalSizes(node.sizes, targetIndex, availablePixelSpace);
			}

			// Bubble allocations downward to deep sub-splits
			node.children.forEach((child, index) =>
			{
				const childRatio = node.sizes![index]; // Guaranteed to exist now
				const childPixels = availablePixelSpace * childRatio;
				this._traverseAndAdjustSizes(child, childPixels, targetIds);
			});
		}
		else if(node.children)
		{
			node.children.forEach(child => this._traverseAndAdjustSizes(child, availablePixelSpace, targetIds));
		}
	}

	/**
	 * Deep recursive checker to locate specific layout leaf widgets
	 */
	private _containsTargetWidget(node: LuminoLayoutNode, ids: Set<string>): boolean
	{
		if(node.type === 'tab-area' && node.widgets)
		{
			return node.widgets.some(wRef =>
			{
				const id = typeof wRef === 'string' ? wRef : wRef.id;
				return ids.has(id);
			});
		}
		if(node.children)
		{
			return node.children.some(child => this._containsTargetWidget(child, ids));
		}
		return false;
	}

	/**
	 * Mathematical normalization strategy that preserves a 1.0 sum across siblings
	 */
	private _calculateProportionalSizes(sizes: number[], targetIndex: number, availableSpace: number): number[]
	{
		// Sanity check: If zero or negative space is available (hidden/collapsed view), abort mutation
		if(availableSpace <= 0 || isNaN(availableSpace) || !isFinite(availableSpace))
		{
			return sizes;
		}

		const targetRatio = Math.min(200 / availableSpace, 0.8);

		// Safety check: prevent an impossible ratio break
		if(targetRatio >= 1 || targetRatio <= 0)
		{
			return sizes;
		}

		const currentTargetRatio = sizes[targetIndex];
		const remainingRatioBefore = 1 - currentTargetRatio;
		const remainingRatioAfter = 1 - targetRatio;

		// Guard against negative ratio remaining space bounds
		if(remainingRatioAfter <= 0 || remainingRatioBefore <= 0)
		{
			return sizes;
		}

		return sizes.map((size, index) =>
		{
			if(index === targetIndex) return targetRatio;
			if(remainingRatioBefore > 0)
			{
				return (size / remainingRatioBefore) * remainingRatioAfter;
			}
			return remainingRatioAfter / (sizes.length - 1);
		});
	}
}

export function isDevToolsOpen(): boolean
{
	const threshold = 160; // Cushion for window borders

	const widthThreshold = window.outerWidth - window.innerWidth > threshold;
	const heightThreshold = window.outerHeight - window.innerHeight > threshold;

	const hasClass = document.body?.classList.contains('debugger') ?? false;
	const debuggerIsOpen = widthThreshold || heightThreshold;

	if(document.body)
	{
		if(debuggerIsOpen && !hasClass)
		{
			document.body.classList.add('debugger');
		} else if(!debuggerIsOpen && hasClass)
		{
			document.body.classList.remove('debugger');
		}
	}

	return debuggerIsOpen;
}
