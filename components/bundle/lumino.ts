import { BoxPanel, DockPanel, Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import * as widgets from '@lumino/widgets';
import * as messaging from '@lumino/messaging';
import { createTopBar, initializeMenus } from './menu';
import { StatusBarWidget } from './status';
import { ServiceWorkerManager } from './worker';
import { SettingConfig, SettingsManager } from './settings';
import { isDevToolsOpen, ResponsiveManager } from './lumino-resize';

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
		commandRegistry: CommandRegistry;
		workspaceBox: BoxPanel;
		toolbarWidget: Widget;
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
	window.toolbarWidget = toolbar;
	toolbar.node.style.minWidth = '50px';

	// Initialize remaining menus safely passing down the clean tracking components
	initializeMenus(commands, menuBar, mainDock, toolbar.node);

	const statusBar = new StatusBarWidget();
	window.statusBar = statusBar;
	const envStatusNode = statusBar.addStatusItem('env-state', 'Initializing Sync...', 'bx bx-sync bx-spin', 'left');
	statusBar.addStatusItem('git-branch', 'main', 'bx bx-git-branch', 'right');
	window.envStatusNode = envStatusNode;

	// Construct the global parent layout anchor structure
	const workspaceBox = new BoxPanel({ direction: 'left-to-right', spacing: 0 });
	workspaceBox.id = 'workspace-box';
	window.workspaceBox = workspaceBox;
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

	mainDock.layoutModified.connect(() =>
	{
		const remainingWidgets = Array.from(mainDock.widgets());
		console.log('Dock layout updated. Remaining widget count:', remainingWidgets.length);
		window.resizeHandler();
	});


	messaging.MessageLoop.installMessageHook(mainDock, (handler, msg: messaging.Message) =>
	{
		console.warn(msg);
		// 1. Check if the message is a close request hitting the dock
		if(msg.type === 'close-request')
		{
			// The handler in this context is the widget receiving the close command
			const closingWidget = handler as Widget;
			console.log(`Intercepted close event for: ${closingWidget.id}`);

			// 2. Determine your fallback activation target
			let fallbackWidget: Widget | null = null;

			// Strategy A: Fallback to the last tracked active widget if it's still alive and not the closing one
			if(window.previousInteractedWidget && window.previousInteractedWidget !== closingWidget && !window.previousInteractedWidget.isDisposed)
			{
				fallbackWidget = window.previousInteractedWidget;
			} else
			{
				// Strategy B: Pull remaining widgets and find the first non-filelist editor
				const remaining = Array.from(mainDock.widgets()).filter(w => w !== closingWidget && !w.isHidden);
				fallbackWidget = remaining.find(w => w.constructor.name !== 'FileListWidget') || remaining[0] || null;
			}

			// 3. Queue the activation right after the layout pass finishes processing the removal
			if(fallbackWidget)
			{
				const target = fallbackWidget;
				requestAnimationFrame(() =>
				{
					if(!target.isDisposed && !target.isHidden)
					{
						mainDock.activateWidget(target);
					}
				});
			}
		}

		// CRITICAL: Always return true so the message continues down the pipeline
		// to let Lumino finish removing and disposing the closed widget.
		return true;
	});

	const resizeHandler = () =>
	{
		ResponsiveManager.getInstance().handleResize(windowRoot, workspaceBox, headerRow, menuBar, toolbar, mainDock);
	};
	setTimeout(resizeHandler, 100);
	window.resizeHandler = resizeHandler;
	window.addEventListener('resize', resizeHandler);

	SettingsManager.hydrateAll();

	startServiceWorker();

	const userWorkspaceChoice = SettingsManager.get('core', 'workspaceDefault');

	// TODO: load default editor specified in localStorage

	isDevToolsOpen();
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


function setTheme(theme: string)
{
	const themeName = theme.split('/').pop(); // Gets 'monokai' or 'dracula'

	if(!themeName)
	{
		return;
	}

	for(let cn of document.body.classList)
	{
		if(cn.startsWith('theme-'))
		{
			document.body.classList.remove(cn);
		}
	}

	document.body.classList.add(`theme-${themeName.replace(/_/g, '-')}`);
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
		savedTheme: {
			key: 'theme',
			default: 'ace/theme/monokai',
			elementId: 'theme',
			description: 'The visual theme layout package used to style the interactive Ace code editor window background and syntax colors.',
			set: setTheme
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

window.document.addEventListener('DOMContentLoaded', main);
