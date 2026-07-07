import { BoxPanel, DockPanel, Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import * as widgets from '@lumino/widgets';
import * as messaging from '@lumino/messaging';
import { createTopBar, initializeMenus } from './menu';
import { StatusBarWidget } from './status';
import { ServiceWorkerManager } from './worker';
import { SettingConfig } from './settings';

import '@lumino/widgets/style/index.css';



declare global
{
	interface Window
	{
		IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
		Lumino?: {
			widgets: any;  // Replace 'any' with the actual type of widgets if available
			messaging: any; // Replace 'any' with the actual type of messaging if available
		};
		statusBar: StatusBarWidget;
		envStatusNode: HTMLDivElement;
		mainDock: DockPanel;
		//sidebarPanel: BoxPanel;
		resizeHandler: () => void;
	}
}

window.Lumino = {
	widgets,
	messaging
};



console.log("Lumino Core injected into global window space.");


function main(): void
{
	// Initialize the Command Registry
	const commands = new CommandRegistry();

	// Create the central DockPanel target area
	const mainDock = new DockPanel({
		mode: 'multiple-document'
	});
	mainDock.id = 'main-workspace';
	window.mainDock = mainDock;

	// Generate the top application header structures using our unified layout export
	const { headerRow, menuBar } = createTopBar(commands);

	// Build a manual sidebar widget for the left boundary (VSCode style)
	const toolbar = new Widget();
	toolbar.id = 'left-toolbar';
	toolbar.node.style.minWidth = '50px';

	// Initialize remaining menus safely passing down the clean tracking components
	initializeMenus(commands, menuBar, mainDock, toolbar.node);

	/*
	const sidebarPanel = new BoxPanel({ direction: 'top-to-bottom', spacing: 0 });
	sidebarPanel.id = 'sidebar-panel';
	sidebarPanel.node.style.width = '250px'; // Give the file list its explicit sidebar width
	sidebarPanel.node.style.minWidth = '250px';
	window.sidebarPanel = sidebarPanel;
	*/


	const statusBar = new StatusBarWidget();
	window.statusBar = statusBar;
	const envStatusNode = statusBar.addStatusItem('env-state', 'Initializing Sync...', 'bx bx-sync bx-spin', 'left');
	statusBar.addStatusItem('git-branch', 'main', 'bx bx-git-branch', 'right');
	window.envStatusNode = envStatusNode;

	// Construct the global parent layout anchor structure
	const workspaceBox = new BoxPanel({ direction: 'left-to-right', spacing: 0 });
	workspaceBox.id = 'workspace-box';
	BoxPanel.setStretch(toolbar, 0);
	//BoxPanel.setStretch(sidebarPanel, 0);
	BoxPanel.setStretch(mainDock, 1);
	workspaceBox.addWidget(toolbar);
	//workspaceBox.addWidget(sidebarPanel);
	workspaceBox.addWidget(mainDock);

	// Assemble Main Window layout
	const windowRoot = new BoxPanel({ direction: 'top-to-bottom', spacing: 0 });
	windowRoot.id = 'app-root';
	BoxPanel.setStretch(headerRow, 0);
	BoxPanel.setStretch(workspaceBox, 1);
	BoxPanel.setStretch(statusBar, 0);

	windowRoot.addWidget(headerRow);
	windowRoot.addWidget(workspaceBox);
	windowRoot.addWidget(statusBar);

	// Attach directly to the viewport boundary frame
	Widget.attach(windowRoot, document.body);
	windowRoot.fit();

	handleResponsiveLayout(windowRoot, workspaceBox, toolbar, mainDock);

	const resizeHandler = () =>
	{
		handleResponsiveLayout(windowRoot, workspaceBox, toolbar, mainDock);
		windowRoot.update();
	};
	window.resizeHandler = resizeHandler;
	window.addEventListener('resize', resizeHandler);

	startServiceWorker();
}

function startServiceWorker()
{
	const swManager = new ServiceWorkerManager();

	swManager.initialize()
		.then(() =>
		{
			// Update status to 'Worker Ready' and swap spin icon to a solid verified check shield
			window.statusBar.updateStatusItem('env-state', 'Worker Ready');
			const iconNode = window.envStatusNode.querySelector('i');
			if(iconNode)
			{
				iconNode.className = 'bx bx-check-shield';
			}

			// 3. Clear the status notification text after exactly 5 seconds (5000ms)
			setTimeout(() =>
			{
				window.statusBar.updateStatusItem('env-state', '');
				if(iconNode)
				{
					iconNode.className = ''; // Remove the icon asset footprint too
				}
			}, 5000);
		})
		.catch((err) =>
		{
			console.error("Critical worker boot fault:", err);
			window.statusBar.updateStatusItem('env-state', 'Sync Error');
			const iconNode = window.envStatusNode.querySelector('i');
			if(iconNode)
			{
				iconNode.className = 'bx bx-error-circle';
			}
		});


}


let prevWidgetCount = 0;

interface LuminoLayoutNode
{
	type: 'tab-area' | 'split-area';
	orientation?: 'horizontal' | 'vertical';
	children?: LuminoLayoutNode[];
	widgets?: any[];
	sizes?: number[];
}

function handleResponsiveLayout(
	windowRoot: BoxPanel,
	workspaceBox: BoxPanel,
	toolbar: Widget,
	mainDock: DockPanel
): void
{
	const width = window.innerWidth;
	const isMobile = width < 768;
	const isWidescreen = width >= 1200;
	const currentWidgets = Array.from(mainDock.widgets());
	const hasContent = currentWidgets.length > 0;
	const inlineToolbar = document.getElementById('script-inline-toolbar');

	if(isMobile)
	{
		workspaceBox.direction = 'top-to-bottom';
		console.warn('Mobile mode: hiding sidebar');
		toolbar.node.style.display = 'none';
		toolbar.node.style.minWidth = '0px';
		if(inlineToolbar)
		{
			inlineToolbar.style.display = 'none';
		}
	} else
	{
		workspaceBox.direction = 'left-to-right';

		toolbar.node.style.display = 'flex';
		toolbar.node.style.minWidth = '50px';
		if(inlineToolbar)
		{
			inlineToolbar.style.display = 'flex';
		}
		if(/*isWidescreen &&*/ hasContent)
		{
			console.warn('Normal mode: showing sidebar ' + currentWidgets.length);
		} else
		{
			console.warn('Normal mode: hiding sidebar ' + currentWidgets.length);
		}
	}

	// Process constraints if widget count increased
	if(currentWidgets.length > prevWidgetCount)
	{
		const layout = mainDock.saveLayout() as unknown as { main: LuminoLayoutNode | null; };

		if(layout && layout.main)
		{
			// Find target FileListWidgets IDs
			const targetIds = new Set<string>();
			currentWidgets.forEach(widget =>
			{
				if(widget.constructor.name === 'FileListWidget')
				{
					targetIds.add(widget.id);
				}
			});

			if(targetIds.size > 0)
			{
				// Get the base bounding limits of the dock layout area
				const totalWidth = mainDock.node.clientWidth || 800;
				const totalHeight = mainDock.node.clientHeight || 600;

				// Recursive checker for leaves
				const containsTargetWidget = (node: LuminoLayoutNode, ids: Set<string>): boolean =>
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
						return node.children.some(child => containsTargetWidget(child, ids));
					}
					return false;
				};

				// Recursive function to adjust fractional sizes mapping to pixel requirements
				const adjustLayoutSizes = (node: LuminoLayoutNode, availablePixelSpace: number): void =>
				{
					if(node.type === 'split-area' && node.children && node.sizes)
					{
						const orientation = node.orientation || 'horizontal';
						let targetIndex = -1;

						// Identify which child slot holds the targeted widget view
						node.children.forEach((child, index) =>
						{
							if(containsTargetWidget(child, targetIds))
							{
								targetIndex = index;
							}
						});

						if(targetIndex !== -1 && node.sizes.length > 0)
						{
							// Calculate fractional ratio equivalent to exactly 200px
							const targetRatio = Math.min(200 / availablePixelSpace, 0.8);
							const currentTargetRatio = node.sizes[targetIndex];
							const remainingRatioBefore = 1 - currentTargetRatio;
							const remainingRatioAfter = 1 - targetRatio;

							// Scale the other siblings down/up proportionally to balance the 1.0 total
							node.sizes = node.sizes.map((size, index) =>
							{
								if(index === targetIndex)
								{
									return targetRatio;
								}
								if(remainingRatioBefore > 0)
								{
									return (size / remainingRatioBefore) * remainingRatioAfter;
								}
								return remainingRatioAfter / (node.sizes!.length - 1);
							});
						}

						// Bubble down allocations to sub-splits if they exist
						node.children.forEach((child, index) =>
						{
							const childRatio = node.sizes ? node.sizes[index] : (1 / node.children!.length);
							const childPixels = availablePixelSpace * childRatio;
							adjustLayoutSizes(child, childPixels);
						});
					} else if(node.children)
					{
						node.children.forEach(child => adjustLayoutSizes(child, availablePixelSpace));
					}
				};

				// Initialize pass starting with total available dock boundaries
				const rootOrientation = layout.main.orientation || 'horizontal';
				const initialSpace = rootOrientation === 'horizontal' ? totalWidth : totalHeight;

				adjustLayoutSizes(layout.main, initialSpace);

				// Reapply the updated layout scheme to force layout system mutation
				mainDock.restoreLayout(layout as any);
			}
		}
	}

	prevWidgetCount = currentWidgets.length;

	// Force Lumino refresh — order matters
	workspaceBox.fit();
	windowRoot.update();
}


const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	core: {
		workspaceDefault: {
			key: 'workspace_default',
			default: 'editor',
			description: 'Specifies the default active panel or system layout view presented to users upon launching the application interface.'
		},
		environmentVersion: {
			key: 'environment_version',
			default: new Date(0),
			description: 'The last commit date for the environment repository set automatically.',
		},
	}
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

// 4. Export the unified reference for standard module compilation tracking
export const IMPORT_SETTINGS = window.IMPORT_SETTINGS;



window.onload = main;
