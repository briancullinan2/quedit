import { BoxPanel, DockPanel, Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import * as widgets from '@lumino/widgets';
import * as messaging from '@lumino/messaging';
import { createTopBar, initializeMenus } from './menu';
import { StatusBarWidget } from './status';
import { ServiceWorkerManager } from './worker';
import { SettingConfig } from './settings';

import '@lumino/widgets/style/index.css';
import { ResponsiveManager } from './lumino-resize';



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
		commandRegistry: CommandRegistry;
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
	// TODO: interesting, i actually meant to do this in the previous version
	//   and now Gemini and Lumino combined forced me to set it up anyways.
	window.commandRegistry = commands;

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

	const resizeHandler = () =>
	{
		ResponsiveManager.getInstance().handleResize(windowRoot, workspaceBox, headerRow, menuBar, toolbar, mainDock);
	};
	setTimeout(resizeHandler, 100);
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
