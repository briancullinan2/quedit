import { BoxPanel, DockPanel, Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import * as widgets from '@lumino/widgets';
import * as messaging from '@lumino/messaging';
import { createTopBar, initializeMenus } from './menu';
import { StatusBarWidget } from './status';
import { ServiceWorkerManager } from './worker';
import { SettingConfig } from './settings';

import '@lumino/widgets/style/index.css';

// 1. Expose Lumino globally for your future dynamic ES6 modules
(window as any).Lumino = {
	widgets,
	messaging
};

console.log("Lumino Core injected into global window space.");


function main(): void
{
	// Initialize the Command Registry
	const commands = new CommandRegistry();

	// Create the central DockPanel target area
	const mainDock = new DockPanel();
	mainDock.id = 'main-workspace';

	// Generate the top application header structures using our unified layout export
	const { headerRow, menuBar } = createTopBar(commands);

	// Build a manual sidebar widget for the left boundary (VSCode style)
	const toolbar = new Widget();
	toolbar.id = 'left-toolbar';
	toolbar.node.style.minWidth = '50px';

	// Initialize remaining menus safely passing down the clean tracking components
	initializeMenus(commands, menuBar, mainDock, toolbar.node);

	const statusBar = new StatusBarWidget();
	(window as any).appStatusBar = statusBar;
	const envStatusNode = statusBar.addStatusItem('env-state', 'Initializing Sync...', 'bx bx-sync bx-spin', 'left');
	statusBar.addStatusItem('git-branch', 'main', 'bx bx-git-branch', 'right');
	(window as any).envStatusNode = envStatusNode;

	// Construct the global parent layout anchor structure
	const workspaceBox = new BoxPanel({ direction: 'left-to-right', spacing: 0 });
	workspaceBox.id = 'workspace-box';
	BoxPanel.setStretch(toolbar, 0);
	BoxPanel.setStretch(mainDock, 1);
	workspaceBox.addWidget(toolbar);
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

	window.addEventListener('resize', () =>
	{
		windowRoot.update();
	});

	startServiceWorker();
}

function startServiceWorker()
{
	const swManager = new ServiceWorkerManager();
	const envStatusNode = (window as any).envStatusNode as HTMLDivElement;
	const statusBar = (window as any).statusBar as StatusBarWidget;

	swManager.initialize()
		.then(() =>
		{
			// Update status to 'Worker Ready' and swap spin icon to a solid verified check shield
			statusBar.updateStatusItem('env-state', 'Worker Ready');
			const iconNode = envStatusNode.querySelector('i');
			if(iconNode)
			{
				iconNode.className = 'bx bx-check-shield';
			}

			// 3. Clear the status notification text after exactly 5 seconds (5000ms)
			setTimeout(() =>
			{
				statusBar.updateStatusItem('env-state', '');
				if(iconNode)
				{
					iconNode.className = ''; // Remove the icon asset footprint too
				}
			}, 5000);
		})
		.catch((err) =>
		{
			console.error("Critical worker boot fault:", err);
			statusBar.updateStatusItem('env-state', 'Sync Error');
			const iconNode = envStatusNode.querySelector('i');
			if(iconNode)
			{
				iconNode.className = 'bx bx-error-circle';
			}
		});


}

declare global
{
	interface Window
	{
		IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
	}
}



const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	core: {
		workspaceDefault: {
			key: 'workspace_default',
			default: 'editor',
			description: 'Specifies the default active panel or system layout view presented to users upon launching the application interface.'
		}
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
