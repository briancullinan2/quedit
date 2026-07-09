import { DockPanel, Widget } from '@lumino/widgets';

declare global
{
	interface Window
	{
		LayoutAdjuster: typeof LayoutAdjuster;
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
let lastInteractedWidget: Widget | null = null;
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
		lastInteractedWidget = widget;
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
				ref: lastInteractedWidget ?? undefined
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

			const isWidescreen = window.innerWidth >= 1200;
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
			} else
			{
				console.log('Opening tab split-right');
				dockPanel.addWidget(newWidget, { mode: 'split-right' });
			}
			dockPanel.activateWidget(newWidget);
			window.resizeHandler();
			return;
		}

		// Default Fallback
		dockPanel.addWidget(newWidget, {
			mode: 'tab-after',
			ref: lastInteractedWidget ?? undefined
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
		if(lastInteractedWidget && lastInteractedWidget.isAttached)
		{
			const lastEl = lastInteractedWidget.node as HTMLElement;
			if(lastEl.dataset?.projectId === projectId)
			{
				return lastInteractedWidget;
			}
		}

		// Rank 2: Scan for the largest existing project match
		let largestProjectWidget: Widget | null = null;
		let maxArea = -1;

		const iterator = dockPanel.widgets();
		let current = iterator.next();

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
			}
			current = iterator.next();
		}

		if(largestProjectWidget)
		{
			return largestProjectWidget;
		}

		// Rank 3: Fallback to whatever was last touched globally
		if(lastInteractedWidget && lastInteractedWidget.isAttached)
		{
			return lastInteractedWidget;
		}

		return null;
	}

	/**
	 * Helper to look up an editor matching a specific project context
	 */
	private static _findBestEditorForProject(dockPanel: DockPanel, projectId: string): Widget | null
	{
		if(lastInteractedWidget && lastInteractedWidget.isAttached)
		{
			const lastEl = lastInteractedWidget.node as HTMLElement;
			if(lastEl.dataset?.projectId === projectId)
			{
				return lastInteractedWidget;
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
		const isWidescreen = window.innerWidth >= 1200;
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

