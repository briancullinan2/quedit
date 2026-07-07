// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';

import './menu.css';
import { ScriptToolbar } from './menu-repos';
import * as Babel from '@babel/standalone';


export interface TopBarComponents
{
	headerRow: Widget;
	menuBar: MenuBar;
}



interface ComponentRoute
{
	label: string;
	url?: string;
	className?: string;
	iconClass: string; // The specific Boxicons layout string tokens
}

// 1. Unified metadata tree tracking every panel type and icon token
const MODULE_REGISTRY: Record<string, ComponentRoute> = {
	'collapse': { label: 'Collapse', iconClass: 'bx bx-arrow-in-left-square-half' },
	'editor': { label: 'Code Editor', url: './components/AceEditorWidget.ts', className: 'AceEditorWidget', iconClass: 'bx bx-code' },
	'paint': { label: 'miniPaint', url: './components/PaintWidget.ts', className: 'PaintWidget', iconClass: 'bx bx-palette' },
	'nunu': { label: 'nunuStudio', url: './components/NunuStudioWidget.ts', className: 'NunuStudioWidget', iconClass: 'bx bx-vector-triangle' },
	'audio-editor': { label: 'AudioMass', url: './components/AudioEditorWidget.ts', className: 'AudioEditorWidget', iconClass: 'bx bx-sine-wave' },
	'searchlist': { label: 'Search Files', url: './components/SearchWidget.ts', className: 'SearchWidget', iconClass: 'bx bx-search' },
	'filelist': { label: 'Engine Files', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-folder-code' },
	'gamelist': { label: 'Game Files', url: './components/GameListWidget.ts', className: 'GameListWidget', iconClass: 'bx bx-handheld-alt' },
	'assetlist': { label: 'Assets', url: './components/AssetListWidget.ts', className: 'AssetListWidget', iconClass: 'bx bx-treasure-chest' },
	'database': { label: 'Local Database', url: './components/DatabaseWidget.ts', className: 'DatabaseWidget', iconClass: 'bx bx-database' },
	'github': { label: 'Github Commit', url: './components/GithubWidget.ts', className: 'GithubWidget', iconClass: 'bx bx-git-repo-forked' },
	'settings': { label: 'Edit Settings', url: './components/SettingsWidget.ts', className: 'SettingsWidget', iconClass: 'bx bx-gear' },
	'viewport-frame': { label: '3D Viewport', url: './components/DedicatedCanvasWidget.ts', className: 'DedicatedCanvasWidget', iconClass: 'bx bx-joystick' },
	'terminal-container': { label: 'Show Console', url: './components/ConsoleWidget.ts', className: 'ConsoleWidget', iconClass: 'bx bx-terminal' },
};

async function loadAndInstantiate(route: ComponentRoute): Promise<any>
{
	if(!route.url || !route.className)
	{
		throw new Error(`Route definition "${route.label}" is missing execution target pathways.`);
	}

	const response = await fetch(route.url);
	const rawCode = await response.text();

	if(!Babel) throw new Error("Babel standalone runner not found on the window context.");

	const transpiled = Babel.transform(rawCode, {
		presets: ['env'],
		plugins: [
			['transform-typescript', { isTSX: false }],
			['transform-modules-commonjs', { loose: true }],

			// A lightweight, custom plugin to intercept requirements and link them to our window
			function ()
			{
				return {
					visitor: {
						CallExpression(path)
						{
							if(
								path.node.callee.name === 'require' &&
								path.node.arguments.length === 1 &&
								path.node.arguments[0].type === 'StringLiteral'
							)
							{
								const moduleName = path.node.arguments[0].value;

								// Map the Node modules cleanly to your exposed globals
								if(moduleName === '@lumino/widgets')
								{
									path.replaceWithSourceString('window.Lumino.widgets');
								} else if(moduleName === '@lumino/messaging')
								{
									path.replaceWithSourceString('window.Lumino.messaging');
								}
							}
						}
					}
				};
			}
		],
		filename: route.url
	});

	const blob = new Blob([transpiled.code ?? ''], { type: 'application/javascript' });
	const blobURL = URL.createObjectURL(blob);

	try
	{
		const module = await import(/* webpackIgnore: true */ blobURL);
		return new module[route.className](route.label);
	} finally
	{
		URL.revokeObjectURL(blobURL);
	}
}

export async function triggerPanelRoute(panelId: string, mainDock: DockPanel): Promise<void>
{
	const route = MODULE_REGISTRY[panelId];
	if(!route || !route.url) return; // Skip routes without code targets (like collapse)

	try
	{
		const widgetInstance = await loadAndInstantiate(route);
		mainDock.addWidget(widgetInstance, { mode: 'tab-after' });
		mainDock.activateWidget(widgetInstance);
	} catch(err)
	{
		console.error(`Module initialization fault on pathway [${panelId}]:`, err);
	}
}

/**
 * System Context Initialization
 */
export function initializeMenus(commands: CommandRegistry, menuBar: MenuBar, mainDock: DockPanel, toolbarNode: HTMLElement): void
{
	const viewMenu = new Menu({ commands });
	viewMenu.title.label = 'Window';

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
	toolbarNode.addEventListener('click', (event: MouseEvent) =>
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
			}

			if(panelId === 'collapse')
			{
				toolbarNode.classList.toggle('collapsed');
				return;
			}

			triggerPanelRoute(panelId, mainDock);
		}
	});
}



/**
 * Registers script lifecycle commands into the central command registry.
 */
export function registerAllCommands(commands: CommandRegistry): void
{
	// File Commands
	if(!commands.hasCommand('file-exit'))
	{
		commands.addCommand('file-exit', {
			label: 'Exit IDE',
			iconClass: 'bx bx-power',
			execute: () =>
			{
				if(confirm('Are you sure you want to exit?'))
				{
					window.close();
				}
			}
		});
	}

	// Script Lifecycle Commands
	if(!commands.hasCommand('script-play'))
	{
		commands.addCommand('script-play', {
			label: 'Play Script',
			iconClass: 'bx bx-play',
			execute: () =>
			{
				const ownerSelect = ScriptToolbar.owner;
				const repoSelect = ScriptToolbar.repository;
				console.log(`Starting script execution for targets: ${ownerSelect?.value}/${repoSelect?.value}`);
			}
		});
	}

	if(!commands.hasCommand('script-stop'))
	{
		commands.addCommand('script-stop', {
			label: 'Stop Script',
			iconClass: 'bx bx-stop',
			execute: () =>
			{
				console.log('Halting script execution.');
			}
		});
	}
}

/**
 * Main export to assemble and return the unified top header row.
 */
export function createTopBar(commands: CommandRegistry): TopBarComponents
{
	// 1. Core registration of all commands in one place
	registerAllCommands(commands);

	// 2. Build the File dropdown Menu system
	const fileMenu = new Menu({ commands });
	fileMenu.title.label = 'File';
	fileMenu.addItem({ command: 'file-exit' });

	// 3. Assemble the base MenuBar
	const menuBar = new MenuBar();
	menuBar.id = 'top-menubar';
	menuBar.addMenu(fileMenu);

	// 4. Build the inline toolbar segment
	const scriptToolbar = ScriptToolbar.getInstance().initialize(commands);

	// 5. Use a standard Widget container with CSS styling instead of a rigid BoxPanel.
	// This stops Lumino from hard-coding absolute 0px widths and overlapping elements.
	const headerRow = new Panel();
	headerRow.id = 'app-top-header-row';
	headerRow.node.style.minHeight = '30px';
	headerRow.addWidget(menuBar);
	headerRow.addWidget(scriptToolbar);

	return { headerRow, menuBar };
}


