// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget, BoxPanel } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { RepositoryToolbar } from './menu-repos';

import { ScriptToolbar } from './menu-script';
import { ApplicationToolbar } from './menu-app';
import { FileToolbar } from './menu-file';
import { SettingsToolbar } from './menu-settings';
import { EngineToolbar } from './menu-engine';
import { HistoryToolbar } from './menu-history';
import { LayoutAdjuster } from './lumino-widget';
import type { FileListWidget } from '../filelist/widget';
import { MenuConfig } from './menu-manager';
import { loadAndInstantiate } from './babel-compile';
import { OUTLINE_WIDGET_TYPES } from './lumino-resize';
import type { TerminalWidget } from '../terminal/widget';


export interface TopBarComponents
{
	headerRow: Panel;
	menuBar: MenuBar;
}


declare global
{
	interface Window
	{
		resizeHandler: () => void;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		registerAllCommands: (menuItems: MenuConfig[] | MenuConfig, commands?: CommandRegistry) => void;
		repoToolbar: RepositoryToolbar;
		scriptToolbar: ScriptToolbar;
		appToolbar: ApplicationToolbar;
		fileToolbar: FileToolbar;
		historyToolbar: HistoryToolbar;
		settingsToolbar: SettingsToolbar;
		engineToolbar: EngineToolbar;
		fileListWidgets?: Array<FileListWidget>;
		terminalWidgets?: Array<TerminalWidget>;
		globalMenuBar: MenuBar;
		tabsMenu: Menu;
	}
}



export interface ComponentRoute
{
	label: string;
	url?: string;
	className?: string;
	iconClass: string; // The specific Boxicons layout string tokens
}

// 1. Unified metadata tree tracking every panel type and icon token
const MODULE_REGISTRY: Record<string, ComponentRoute> = {
	'collapse': { label: 'Collapse', iconClass: 'bx bx-arrow-in-left-square-half' },
	'editor': { label: 'Code Editor', url: './components/editor/widget.ts', className: 'AceEditorWidget', iconClass: 'bx bx-code' },
	'paint': { label: 'miniPaint', url: './components/paint/widget.ts', className: 'PaintWidget', iconClass: 'bx bx-palette' },
	'nunu': { label: 'nunuStudio', url: './components/NunuStudioWidget.ts', className: 'NunuStudioWidget', iconClass: 'bx bx-vector-triangle' },
	'audio-editor': { label: 'AudioMass', url: './components/AudioEditorWidget.ts', className: 'AudioEditorWidget', iconClass: 'bx bx-sine-wave' },
	'searchlist': { label: 'Search Files', url: './components/SearchWidget.ts', className: 'SearchWidget', iconClass: 'bx bx-search' },
	'filelist': { label: 'Engine Files', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-folder-code' },
	'gamelist': { label: 'Game Files', url: './components/filelist/widget.ts', className: 'GameListWidget', iconClass: 'bx bx-handheld-alt' },
	'assetlist': { label: 'Assets', url: './components/filelist/widget-assets.ts', className: 'AssetListWidget', iconClass: 'bx bx-treasure-chest' },
	'database': { label: 'Local Database', url: './components/filelist/widget-database.ts', className: 'DatabaseListWidget', iconClass: 'bx bx-database' },
	'github': { label: 'Github Commit', url: './components/GithubWidget.ts', className: 'GithubWidget', iconClass: 'bx bx-git-repo-forked' },
	'settings': { label: 'Edit Settings', url: './components/editor/widget.ts', className: 'SettingsWidget', iconClass: 'bx bx-gear' },
	'viewport-frame': { label: '3D Viewport', url: './components/map-loader/widget.ts', className: 'TojiWidget', iconClass: 'bx bx-joystick' },
	'terminal-container': { label: 'Show Console', url: './components/terminal/widget.ts', className: 'TerminalWidget', iconClass: 'bx bx-terminal' },
};

export async function triggerPanelRoute(panelId: string, mainDock: DockPanel): Promise<void>
{
	const route = MODULE_REGISTRY[panelId];
	if(!route || !route.url)
	{
		console.log('Panel route not found: ' + panelId);
		return; // Skip routes without code targets (like collapse)
	}

	try
	{
		// 1. Gather active DOM widgets
		const currentDOMWidgets = Array.from(mainDock.widgets());

		// 2. Identify target instances stored in memory
		let targetMemoryWidgets: Widget[] = [];

		if(route.className === 'TerminalWidget')
		{
			targetMemoryWidgets = (window as any).terminalWidgets || [];
		} else if(route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
		{
			targetMemoryWidgets = ((window as any).fileListWidgets || []).filter(
				(w: any) => w.constructor.name === route.className
			);
		}

		// 3. Handle toggling and activation
		if(targetMemoryWidgets.length > 0)
		{
			console.log('Panel route already loaded in memory: ' + panelId);

			// Find if a matching widget is mounted in the DOM dock
			const matchingDOMWidget = currentDOMWidgets.find(
				domWidget => domWidget.constructor.name === route.className
			);

			if(matchingDOMWidget)
			{
				// Lumino check: Widget is active on top if it's currently selected in its dock tab area
				// and its root node isn't hidden by display: none
				const selectedWidgets = typeof (mainDock as any).selectedWidgets === 'function'
					? Array.from((mainDock as any).selectedWidgets())
					: [];

				const isTabSelectedOnTop = selectedWidgets.includes(matchingDOMWidget) ||
					(matchingDOMWidget.isVisible && matchingDOMWidget.node.style.display !== 'none');

				if(isTabSelectedOnTop)
				{
					// Already active and visible on top -> Collapse/Hide
					collapseWidgets(mainDock, true, route);
				} else
				{
					// Mounted in DOM, but hidden behind another tab -> Activate & bring to top
					mainDock.activateWidget(matchingDOMWidget);
					if(typeof matchingDOMWidget.activate === 'function')
					{
						matchingDOMWidget.activate();
					}
				}
			} else
			{
				// Exists in memory but completely removed/detached from DOM -> Expand/Restore
				collapseWidgets(mainDock, false, route);

				targetMemoryWidgets.forEach(w =>
				{
					if(typeof w.show === 'function') w.show();
				});

				mainDock.activateWidget(targetMemoryWidgets[0]);
				if(typeof targetMemoryWidgets[0].activate === 'function')
				{
					targetMemoryWidgets[0].activate();
				}
			}
			return;
		}


		const widgetInstance = await loadAndInstantiate(route);
		if(widgetInstance.constructor.name === 'TerminalWidget')
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'terminal',
				projectId: widgetInstance.constructor.name
			});
		}
		else if(OUTLINE_WIDGET_TYPES.includes(widgetInstance.constructor.name))
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'outline',
				projectId: widgetInstance.constructor.name
			});
		} else
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'editor',
				projectId: widgetInstance.constructor.name
			});
		}

		await new Promise(resolve =>
		{
			window.requestAnimationFrame(resolve);
		});
	} catch(err)
	{
		console.error(`Module initialization fault on pathway [${panelId}]:`, err);
	}
}


window.triggerPanelRoute = triggerPanelRoute;


/**
 * System Context Initialization
 */
export function initializeMenus(commands: CommandRegistry, menuBar: MenuBar, mainDock: DockPanel, toolbarNode: HTMLElement): void
{
	document.addEventListener('keydown', (event: KeyboardEvent) =>
	{
		commands.processKeydownEvent(event);
	}, true);

	const viewMenu = new Menu({ commands });
	viewMenu.title.label = 'Window';

	// 0. setup tabs menu
	commands.addCommand('select-tab', {
		iconClass: 'bx bx-tabs',
		label: (args) =>
		{
			return Array.from(mainDock.widgets()).find(w =>
			{
				return w.id === args.value;
			})?.title.label
				?? (args.label as string) ?? 'Select Tab';
		},
		execute: (args: any) =>
		{
			Array.from(mainDock.widgets()).forEach(w =>
			{
				if(w.id === args.value)
				{
					mainDock.activateWidget(w);
					w.activate();
				}
			});
		}
	});

	commands.addCommand('next-tab', {
		label: 'Next Tab',
		iconClass: 'bx bx-chevron-right-square',
		isEnabled: () =>
		{
			return true;
			// Optional: don't switch tabs if the user is typing in a text field
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!window.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(window.lastInteractedWidget);
			if(currentWidgetIndex === widgets.length - 1)
			{
				window.lastInteractedWidget = widgets[0];
				mainDock.activateWidget(widgets[0]);
				widgets[0].activate();
			} else
			{
				window.lastInteractedWidget = widgets[currentWidgetIndex + 1];
				mainDock.activateWidget(widgets[currentWidgetIndex + 1]);
				widgets[currentWidgetIndex + 1].activate();
			}
			return false;
		}
	});
	commands.addCommand('previous-tab', {
		label: 'Previous Tab',
		iconClass: 'bx bx-chevron-left-square',
		isEnabled: () =>
		{
			return true;
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!window.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(window.lastInteractedWidget);
			if(currentWidgetIndex === 0)
			{
				window.lastInteractedWidget = widgets[widgets.length - 1];
				mainDock.activateWidget(widgets[widgets.length - 1]);
				widgets[widgets.length - 1].activate();
			} else
			{
				window.lastInteractedWidget = widgets[currentWidgetIndex - 1];
				mainDock.activateWidget(widgets[currentWidgetIndex - 1]);
				widgets[currentWidgetIndex - 1].activate();
			}
		}
	});

	commands.addKeyBinding({
		command: 'previous-tab',
		keys: ['Alt N'],
		selector: '*'
	});
	commands.addKeyBinding({
		command: 'next-tab',
		keys: ['Alt M'],
		selector: '*'
	});

	const tabsMenu = new Menu({ commands });
	tabsMenu.title.label = 'Open Tabs';
	tabsMenu.title.iconClass = 'bx bx-tabs';
	window.tabsMenu = tabsMenu;
	viewMenu.addItem({ type: 'submenu', submenu: tabsMenu });
	viewMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ command: 'next-tab' });
	tabsMenu.addItem({ command: 'previous-tab' });


	// 1. Render the HTML list structural tree directly inside the left toolbar container node
	const ul = document.createElement('ul');
	Object.entries(MODULE_REGISTRY).forEach(([id, route]) =>
	{
		const li = document.createElement('li');
		const a = document.createElement('a');
		a.setAttribute('href', `#${id}`);
		a.setAttribute('alt', route.label);
		a.className = route.iconClass;

		// Set 'active' style override state specifically for your engine files entry point
		if(id === 'filelist')
		{
			a.classList.add('active');
		}

		li.appendChild(a);
		ul.appendChild(li);

		// 2. Map standard commands to Top Menu Bar targets (skipping collapse navigation)
		if(route.url)
		{
			const commandId = `spawn-panel:${id}`;
			commands.addCommand(commandId, {
				label: route.label,
				iconClass: route.iconClass, // <-- Add this line to attach the Boxicon classes to the command
				execute: () => triggerPanelRoute(id, mainDock)
			});
			viewMenu.addItem({ command: commandId });
		}
	});

	toolbarNode.appendChild(ul);
	menuBar.addMenu(viewMenu);

	// 3. Isolated internal event capture handling bounded to the toolbar container
	toolbarNode.addEventListener('click', mainModuleHandler.bind(toolbarNode, mainDock, toolbarNode));
}


function mainModuleHandler(mainDock: DockPanel, toolbarNode: HTMLElement, event: MouseEvent)
{
	const anchor = (event.target as HTMLElement).closest('a');
	if(!anchor) return;

	const href = anchor.getAttribute('href');
	if(href && href.startsWith('#'))
	{
		event.preventDefault();
		const panelId = href.substring(1);

		// Manage localized highlight toggle styles across the sidebar icons
		toolbarNode.querySelectorAll('a').forEach(el => el.classList.remove('active'));
		if(panelId !== 'collapse')
		{
			anchor.classList.add('active');
		} else
		{
			const shouldCollapse = (window.fileListWidgets && window.fileListWidgets.length > 0)
				|| (window.terminalWidgets && window.terminalWidgets.length > 0);
			if(!shouldCollapse)
			{
				return;
			}
			console.log('Panel singleton toggle: ' + panelId);
			if(toolbarNode.classList.contains('collapsed'))
			{
				toolbarNode.classList.remove('collapsed');
				collapseWidgets(mainDock, false);
			} else
			{
				toolbarNode.classList.add('collapsed');
				collapseWidgets(mainDock, true);
			}
			return;
		}

		triggerPanelRoute(panelId, mainDock);
	}
}


function collapseWidgets(mainDock: DockPanel, collapse: boolean, route?: ComponentRoute)
{
	if(window.fileListWidgets && window.fileListWidgets.length > 0
		&& (!route || route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
	)
	{
		if(collapse)
		{
			for(let widget of window.fileListWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of window.fileListWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'outline',
					projectId: widget.constructor.name
				});
			}
		}
	}

	if(window.terminalWidgets && window.terminalWidgets.length > 0
		&& (!route || route.className && route.className === 'TerminalWidget')
	)
	{
		if(collapse)
		{
			for(let widget of window.terminalWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of window.terminalWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'terminal',
					projectId: widget.constructor.name
				});
			}
		}
	}

	window.requestAnimationFrame(() =>
	{
		window.resizeHandler();
		setTimeout(() =>
		{
			window.resizeHandler();
		}, 200);
	});
}





/**
 * Main export to assemble and return the unified top header row.
 */
export function createTopBar(commands: CommandRegistry): TopBarComponents
{
	// 3. Assemble the base MenuBar
	const menuBar = new MenuBar({
		overflowMenuOptions: {
			isVisible: false
		}
	});
	window.globalMenuBar = menuBar;
	menuBar.id = 'top-menubar';

	const headerRow = new Panel();
	headerRow.id = 'app-top-header-row';
	headerRow.node.style.minHeight = '30px';

	// 4. Build the inline toolbar segment
	const repoToolbar = RepositoryToolbar.getInstance().initialize(commands);
	window.repoToolbar = repoToolbar;
	const scriptToolbar = ScriptToolbar.getInstance().initialize(commands);
	window.scriptToolbar = scriptToolbar;
	const appToolbar = ApplicationToolbar.getInstance().initialize(commands);
	window.appToolbar = appToolbar;
	const fileToolbar = FileToolbar.getInstance().initialize(commands);
	window.fileToolbar = fileToolbar;
	const historyToolbar = HistoryToolbar.getInstance().initialize(commands);
	window.historyToolbar = historyToolbar;
	const settingsToolbar = SettingsToolbar.getInstance().initialize(commands);
	window.settingsToolbar = settingsToolbar;
	const engineToolbar = EngineToolbar.getInstance().initialize(commands);
	window.engineToolbar = engineToolbar;

	headerRow.addWidget(menuBar);
	headerRow.addWidget(repoToolbar);
	headerRow.addWidget(scriptToolbar);
	headerRow.addWidget(appToolbar);
	headerRow.addWidget(fileToolbar);
	headerRow.addWidget(historyToolbar);
	headerRow.addWidget(settingsToolbar);
	headerRow.addWidget(engineToolbar);

	return { headerRow, menuBar };
}


