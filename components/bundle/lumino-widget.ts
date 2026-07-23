import { DockPanel, Widget } from '@lumino/widgets';
import { OUTLINE_WIDGET_TYPES } from './lumino-resize';
import { LayoutState } from './menu-app';

export const WIDESCREEN = 1200;
export const MOBILEMODE = 600;
export const TALLSCREEN = 700;

declare global
{
	interface Window
	{
		LayoutAdjuster: typeof LayoutAdjuster;
		lastInteractedWidget: Widget | null;
		previousInteractedWidget: Widget | null;
		resizeHandler: () => void;
		layoutState: LayoutState;
	}
}

// Define strict types for our layout configuration
export type WidgetType = 'editor' | 'outline' | 'terminal' | 'sidebar';

export interface LayoutOptions
{
	type: WidgetType;
	projectId?: string;
	activate?: boolean;
	resize?: boolean;
}

// Global tracking structures
const trackedWidgets = new WeakSet<Widget>();

/**
 * Global tracker function to handle focus and clicks safely on Lumino elements.
 */
function trackWidgetInteraction(widget: Widget): void
{
	if(!widget || !widget.node || trackedWidgets.has(widget))
	{
		return;
	}

	const registerSelection = (): void =>
	{
		const newType = widget?.constructor.name;
		const lastType = window.lastInteractedWidget?.constructor.name;

		if(newType !== lastType)
		{
			window.previousInteractedWidget = window.lastInteractedWidget;
			window.lastInteractedWidget = widget;
		}

		console.log('Focused: ' + window.lastInteractedWidget?.constructor.name + ' unFocused: ' + window.previousInteractedWidget?.constructor.name);
		window.resizeHandler();
	};

	widget.node.addEventListener('focusin', registerSelection);
	widget.node.addEventListener('mousedown', registerSelection);

	trackedWidgets.add(widget);
}

/**
 * Smart Layout Orchestrator wrapper for Lumino DockPanel in TypeScript
 */
export class LayoutAdjuster
{
	/**
	 * Main entry point to add a widget using your interactive ranking system
	 */
	public static addOptimalWidgetLayout(
		dockPanel: DockPanel,
		newWidget: Widget,
		options: LayoutOptions = { type: 'editor' }
	): void
	{
		const type = options.type;
		const projectId = options.projectId || '';
		const shouldActivate = options.activate !== false;
		const shouldResize = options.resize !== false;

		// Track interactions on the new widget moving forward
		trackWidgetInteraction(newWidget);

		const HTMLElement = newWidget.node as HTMLElement;
		// Safely apply metadata to DOM dataset for responsive query selection later
		HTMLElement.dataset.projectId = projectId;
		HTMLElement.dataset.type = type;

		// --- BRANCH 1: TERMINAL LAYOUT ---
		if(type === 'terminal')
		{
			const existingTerminal = this._findBestEditorForProject(dockPanel, projectId, type);
			const lastNonOutline = this._findNonOutline(dockPanel);
			const isTallscreen = window.innerHeight >= TALLSCREEN;
			if(lastNonOutline && isTallscreen && !existingTerminal)
			{
				dockPanel.addWidget(newWidget, {
					mode: 'split-bottom',
					ref: lastNonOutline ?? window.lastInteractedWidget ?? undefined
				});
			} else if(lastNonOutline || existingTerminal)
			{
				dockPanel.addWidget(newWidget, {
					mode: 'tab-after',
					ref: existingTerminal ?? lastNonOutline ?? window.lastInteractedWidget ?? undefined
				});
			} else
			{
				dockPanel.addWidget(newWidget, {
					mode: 'split-right'
				});
			}
			if(shouldActivate)
			{
				dockPanel.activateWidget(newWidget);
			}
			if(shouldResize)
			{
				window.resizeHandler();
			}
			return;
		}

		// --- BRANCH 2: OUTLINE VIEW ---
		if(type === 'outline')
		{
			const targetRef = this._findBestEditorForProject(dockPanel, projectId, type);
			if(targetRef)
			{
				dockPanel.addWidget(newWidget, {
					mode: 'tab-after',
					ref: targetRef
				});
			} else
			{
				dockPanel.addWidget(newWidget, { mode: 'split-left' });
			}
			if(shouldActivate)
			{
				dockPanel.activateWidget(newWidget);
			}
			if(shouldResize)
			{
				window.resizeHandler();
			}
			return;
		}

		// --- BRANCH 3: THE CORE EDITOR / PROJECT TAB RANKING SYSTEM ---
		if(type === 'editor')
		{
			const isWidescreen = window.innerWidth >= WIDESCREEN;
			const isTallscreen = window.innerHeight >= TALLSCREEN;
			if(isWidescreen)
			{
				HTMLElement.dataset.layoutGroup = 'split-column';
			} else
			{
				HTMLElement.dataset.layoutGroup = 'original-main';
			}

			const bestRef = this._findRankedReference(dockPanel, projectId);

			if(bestRef && bestRef.dataset?.type === 'terminal')
			{
				const shouldSplit = (isTallscreen && bestRef.dataset.projectId !== projectId);
				dockPanel.addWidget(newWidget, {
					mode: shouldSplit ? 'split-top' : 'tab-after',
					ref: bestRef
				});
			}
			else if(bestRef)
			{
				const refHTMLElement = bestRef.node as HTMLElement;
				const shouldSplit = (isWidescreen && refHTMLElement.dataset.projectId !== projectId)
					|| refHTMLElement.dataset.type === 'outline';
				console.log('Opening tab:' + newWidget.constructor.name + ' ' + (shouldSplit ? 'split-right' : 'tab-after') + ' ' + bestRef.constructor.name);
				dockPanel.addWidget(newWidget, {
					mode: shouldSplit ? 'split-right' : 'tab-after',
					ref: bestRef
				});
			} else if(isWidescreen)
			{
				console.log('Opening tab split-right');
				dockPanel.addWidget(newWidget, { mode: 'split-right' });
			} else
			{
				console.log('Opening tab-after');
				dockPanel.addWidget(newWidget, { mode: 'tab-after' });
			}
			if(shouldActivate)
			{
				dockPanel.activateWidget(newWidget);
			}
			if(shouldResize)
			{
				window.resizeHandler();
			}
			return;
		}

		// Default Fallback
		dockPanel.addWidget(newWidget, {
			mode: 'tab-after',
			ref: window.lastInteractedWidget ?? undefined
		});
		if(shouldActivate)
		{
			dockPanel.activateWidget(newWidget);
		}
		if(shouldResize)
		{
			window.resizeHandler();
		}
	}


	public static _findNonOutline(dockPanel: DockPanel): Widget | null
	{

		const iterator = dockPanel.widgets();
		let current = iterator.next();
		while(current && current.value)
		{
			const el = current.value.node as HTMLElement;
			if(!OUTLINE_WIDGET_TYPES.includes(el.dataset?.projectId ?? current.value.constructor.name))
			{
				return current.value;
			}
			current = iterator.next();
		}
		return null;
	}

	public static _findNonOutlineOrTerminal(dockPanel: DockPanel): Widget | null
	{

		const iterator = dockPanel.widgets();
		let current = iterator.next();
		while(current && current.value)
		{
			const el = current.value.node as HTMLElement;
			if(!OUTLINE_WIDGET_TYPES.includes(el.dataset?.projectId ?? current.value.constructor.name)
				&& current.value.constructor.name !== 'TerminalWidget')
			{
				return current.value;
			}
			current = iterator.next();
		}
		return null;
	}

	/**
	 * Ranks existing widgets to find the optimal reference sibling.
	 */
	private static _findRankedReference(dockPanel: DockPanel, projectId: string): Widget | null
	{
		// Rank 1: Check last global interaction
		if(window.lastInteractedWidget && window.lastInteractedWidget.isAttached)
		{
			const lastEl = window.lastInteractedWidget.node as HTMLElement;
			if(lastEl.dataset?.projectId === projectId)
			{
				return window.lastInteractedWidget;
			}
		}

		// Rank 2: Scan for the largest existing project match
		let largestProjectWidget: Widget | null = null;
		let maxArea = -1;
		let maxAreaNotFiles = -1;

		const iterator = dockPanel.widgets();
		let current = iterator.next();
		let notFiles = null;

		while(current && current.value)
		{
			const w = current.value;
			const el = w.node as HTMLElement;

			if(el.dataset?.projectId === projectId)
			{
				const rect = el.getBoundingClientRect();
				const area = rect.width * rect.height;
				if(area > maxArea)
				{
					maxArea = area;
					largestProjectWidget = w;
				}
			} else if(!OUTLINE_WIDGET_TYPES.includes(w.constructor.name))
			{
				const rect = el.getBoundingClientRect();
				const area = rect.width * rect.height;
				if(area > maxAreaNotFiles)
				{
					maxAreaNotFiles = area;
					notFiles = w;
				}
			}
			current = iterator.next();
		}

		if(largestProjectWidget)
		{
			return largestProjectWidget;
		}

		if(notFiles)
		{
			return notFiles;
		}

		// Rank 3: Fallback to whatever was last touched globally
		if(window.lastInteractedWidget && window.lastInteractedWidget.isAttached)
		{
			return window.lastInteractedWidget;
		}

		return null;
	}

	/**
	 * Helper to look up an editor matching a specific project context
	 */
	public static _findBestEditorForProject(dockPanel: DockPanel, projectId: string | null | undefined, type: string): Widget | null
	{
		let fallbackType: Widget | null = null;
		if(window.lastInteractedWidget && window.lastInteractedWidget.isAttached)
		{
			const lastEl = window.lastInteractedWidget.node as HTMLElement;
			if(lastEl.dataset?.projectId === projectId)
			{
				return window.lastInteractedWidget;
			}
			if(lastEl.dataset?.type === type)
			{
				fallbackType = window.lastInteractedWidget;
			}
		}

		const iterator = dockPanel.widgets();
		let current = iterator.next();
		while(current && current.value)
		{
			const el = current.value.node as HTMLElement;
			if(el.dataset?.projectId === projectId)
			{
				return current.value;
			}
			if(el.dataset?.type === type)
			{
				fallbackType = current.value;
			}
			current = iterator.next();
		}

		if(fallbackType)
		{
			return fallbackType;
		}

		return null;
	}

	/**
	 * Responsive window compression layout flattener
	 */
	public static handleResponsiveLayoutCollapse(dockPanel: DockPanel): void
	{
		const isWidescreen = window.innerWidth >= WIDESCREEN;
		if(isWidescreen) return;

		const iterator = dockPanel.widgets();
		let current = iterator.next();

		const splitWidgets: Widget[] = [];
		let mainGroupRef: Widget | null = null;

		while(current && current.value)
		{
			const w = current.value;
			const el = w.node as HTMLElement;

			if(el.dataset?.layoutGroup === 'split-column')
			{
				splitWidgets.push(w);
			} else if(el.dataset?.layoutGroup === 'original-main' && !mainGroupRef)
			{
				mainGroupRef = w;
			}
			current = iterator.next();
		}

		if(mainGroupRef && splitWidgets.length > 0)
		{
			splitWidgets.forEach(w =>
			{
				const el = w.node as HTMLElement;
				el.dataset.layoutGroup = 'original-main';
				dockPanel.addWidget(w, {
					mode: 'tab-after',
					ref: mainGroupRef!
				});
			});
		}
	}
}

window.LayoutAdjuster = LayoutAdjuster;

