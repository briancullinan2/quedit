import { DockPanel, Widget } from '@lumino/widgets';
import { OUTLINE_WIDGET_TYPES } from './lumino-resize';

export const WIDESCREEN = 1200;
export const MOBILEMODE = 600;

declare global
{
	interface Window
	{
		LayoutAdjuster: typeof LayoutAdjuster;
		lastInteractedWidget: Widget | null;
		previousInteractedWidget: Widget | null;
		resizeHandler: () => void;
	}
}

// Define strict types for our layout configuration
export type WidgetType = 'editor' | 'outline' | 'terminal' | 'sidebar';

export interface LayoutOptions
{
	type: WidgetType;
	projectId?: string;
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

		// Track interactions on the new widget moving forward
		trackWidgetInteraction(newWidget);

		const HTMLElement = newWidget.node as HTMLElement;
		// Safely apply metadata to DOM dataset for responsive query selection later
		HTMLElement.dataset.projectId = projectId;
		HTMLElement.dataset.type = type;

		// --- BRANCH 1: TERMINAL LAYOUT ---
		if(type === 'terminal')
		{
			dockPanel.addWidget(newWidget, {
				mode: 'split-bottom',
				ref: window.lastInteractedWidget ?? undefined
			});
			dockPanel.activateWidget(newWidget);
			window.resizeHandler();
			return;
		}

		// --- BRANCH 2: OUTLINE VIEW ---
		if(type === 'outline')
		{
			const targetRef = this._findBestEditorForProject(dockPanel, projectId);
			if(targetRef)
			{
				dockPanel.addWidget(newWidget, {
					mode: 'split-left',
					ref: targetRef
				});
			} else
			{
				dockPanel.addWidget(newWidget, { mode: 'split-left' });
			}
			dockPanel.activateWidget(newWidget);
			window.resizeHandler();
			return;
		}

		// --- BRANCH 3: THE CORE EDITOR / PROJECT TAB RANKING SYSTEM ---
		if(type === 'editor')
		{
			const isWidescreen = window.innerWidth >= WIDESCREEN;
			if(isWidescreen)
			{
				HTMLElement.dataset.layoutGroup = 'split-column';
			} else
			{
				HTMLElement.dataset.layoutGroup = 'original-main';
			}

			const bestRef = this._findRankedReference(dockPanel, projectId);

			if(bestRef)
			{
				const refHTMLElement = bestRef.node as HTMLElement;
				const shouldSplit = (isWidescreen && refHTMLElement.dataset.projectId !== projectId)
					|| refHTMLElement.dataset.type === 'outline';
				console.log('Opening tab ' + (shouldSplit ? 'split-right' : 'tab-after') + ' ' + bestRef.constructor.name);
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
			dockPanel.activateWidget(newWidget);
			window.resizeHandler();
			return;
		}

		// Default Fallback
		dockPanel.addWidget(newWidget, {
			mode: 'tab-after',
			ref: window.lastInteractedWidget ?? undefined
		});
		dockPanel.activateWidget(newWidget);
		window.resizeHandler();
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
	private static _findBestEditorForProject(dockPanel: DockPanel, projectId: string): Widget | null
	{
		if(window.lastInteractedWidget && window.lastInteractedWidget.isAttached)
		{
			const lastEl = window.lastInteractedWidget.node as HTMLElement;
			if(lastEl.dataset?.projectId === projectId)
			{
				return window.lastInteractedWidget;
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
			current = iterator.next();
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

