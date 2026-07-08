// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget, BoxPanel } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { ScriptToolbar } from './menu-repos';
import
{
	transformFromAstSync, PluginObj, NodePath, transform
	, types as tType, parseSync, traverse
	, packages
} from '@babel/standalone';
import { DB_STORE_NAME, FS_FILE, putRecord } from './local';
import { Settings, SettingsManager } from './settings';
import { getGitShaBrowser } from './github-tools';
import { path } from './global';

const parseBabel = packages.parser.parse;
const traverse = packages.traverse.default;

export interface TopBarComponents
{
	headerRow: Widget;
	menuBar: MenuBar;
}


declare global
{
	interface Window
	{
		resizeHandler: () => void;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
	}
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
	'editor': { label: 'Code Editor', url: './components/editor/widget.ts', className: 'AceEditorWidget', iconClass: 'bx bx-code' },
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

export const registry = new Map<string, Promise<void>>(
	[...document.scripts]
		.map((s: HTMLScriptElement) => s.getAttribute('src'))
		.filter((src): src is string => Boolean(src))
		.concat([...document.styleSheets].map((s: CSSStyleSheet) => s.href).filter((href): href is string => Boolean(href)))
		.map((url: string): [string, Promise<void>] =>
		{
			const absoluteUrl = new URL(url, window.location.origin).pathname;
			// Pre-seed the Map with an instantly resolved promise for elements already loaded
			return [absoluteUrl, Promise.resolve()];
		})
);



async function loadAndInstantiate(route: ComponentRoute): Promise<any>
{
	if(!route.url || !route.className)
	{
		throw new Error(`Route definition "${route.label}" is missing execution target pathways.`);
	}

	if(route.url.endsWith('.js'))
	{
		const module = await import(/* webpackIgnore: true */ route.url + '?t=' + Date.now() + '&local-csp=true');
		return new module[route.className](route.label);
	}

	const response = await fetch(route.url + '?t=' + Date.now());
	const rawCode = await response.text();

	if(!response.ok) throw new Error('Component not found: ' + route.url);
	if(!transform) throw new Error("Babel standalone runner not found on the window context.");

	const dependenciesToFetch: string[] = [];
	const ast = parseBabel(rawCode, {
		sourceType: 'module',
		plugins: [
			'typescript' // Enables parsing of TS syntax like interfaces and type annotations
		]
	});

	// 2. Traverse the AST using a custom visitor
	traverse(ast, {
		ImportDeclaration(babelPath)
		{
			const moduleName = babelPath.node.source.value;
			console.log('Overloading: ' + moduleName);
			if(moduleName === 'ace-builds')
			{
				dependenciesToFetch.push('/ace/ace-noconflict.js');
			} else if(moduleName === './tree.js' && route.url)
			{
				dependenciesToFetch.push(path.resolve(route.url.substring(0, route.url.lastIndexOf('/')), moduleName));
			}
		},
		CallExpression(babelPath)
		{
			if(
				babelPath.node.callee.name === 'require' &&
				babelPath.node.arguments.length === 1 &&
				babelPath.node.arguments[0].type === 'StringLiteral'
			)
			{
				const moduleName = babelPath.node.arguments[0].value;
				console.log('Overloading: ' + moduleName);

				if(moduleName === './tree.js' && route.url)
				{
					dependenciesToFetch.push(path.resolve(route.url.substring(0, route.url.lastIndexOf('/')), moduleName));
				}
			}
		},

	});



	if(dependenciesToFetch.length > 0)
	{
		await Promise.all(dependenciesToFetch.map(url =>
		{
			if(url.includes('.mjs'))
			{
				const existingPromise = registry.get(url);
				if(existingPromise)
				{
					return existingPromise;
				}

				var scriptPromise = import(url + '?t=' + Date.now());

				registry.set(url + '?t=' + Date.now(), scriptPromise);
				return scriptPromise;
			} else
			{
				return loadScript(url);
			}
		}));
	}


	const transpiled = transform(rawCode, {
		presets: ['env'],
		plugins: [
			['transform-typescript', { isTSX: false }],
			function (babel: { types: typeof tType, template: any; }): PluginObj
			{
				const { types: t, template } = babel;
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

								console.warn('replacing: ' + moduleName);

								// Map the Node modules cleanly to your exposed globals
								if(moduleName === '@lumino/widgets')
								{
									path.replaceWithSourceString('window.Lumino.widgets');
								} else if(moduleName === '@lumino/messaging')
								{
									path.replaceWithSourceString('window.Lumino.messaging');
								} else if(moduleName === './tree.js')
								{
									path.replaceWithSourceString('window.Tree');
								}
							}
						},
						ImportDeclaration(path: NodePath<tType.ImportDeclaration>)
						{
							const moduleName = path.node.source.value;
							let globalExpression: tType.Expression | null = null;

							console.warn('replacing: ' + moduleName);

							// Resolve the clean global base path node safely based on matching string declarations
							if(moduleName === '@lumino/widgets')
							{
								globalExpression = t.memberExpression(
									t.memberExpression(t.identifier('window'), t.identifier('Lumino')),
									t.identifier('widgets')
								);
							} else if(moduleName === '@lumino/messaging')
							{
								globalExpression = t.memberExpression(
									t.memberExpression(t.identifier('window'), t.identifier('Lumino')),
									t.identifier('messaging')
								);
							} else if(moduleName === 'ace-builds')
							{
								globalExpression = t.memberExpression(
									t.memberExpression(t.identifier('window'), t.identifier('Lumino')),
									t.identifier('ace')
								);
							} else if(moduleName === './tree.js')
							{
								globalExpression = t.memberExpression(
									t.identifier('window'),
									t.identifier('Tree')
								);
							}

							if(globalExpression)
							{
								const declarations: tType.VariableDeclaration[] = [];

								// Handle named imports safely: import { Widget, Panel } from '...'
								const specifiers = path.node.specifiers.filter(
									(spec): spec is tType.ImportSpecifier => t.isImportSpecifier(spec)
								);

								if(specifiers.length > 0)
								{
									const properties = specifiers.map(spec =>
									{
										const importedName = t.isIdentifier(spec.imported)
											? spec.imported.name
											: spec.imported.value;

										return t.objectProperty(
											t.identifier(importedName),
											t.identifier(spec.local.name),
											false,
											importedName === spec.local.name
										);
									});

									declarations.push(
										t.variableDeclaration('const', [
											t.variableDeclarator(
												t.objectPattern(properties),
												globalExpression!
											)
										])
									);
								}

								// Handle namespace/default imports smoothly: import * as widgets from '...' or import Tree from '...'
								const namespaceOrDefaultSpecifier = path.node.specifiers.find(
									spec => t.isImportNamespaceSpecifier(spec) || t.isImportDefaultSpecifier(spec)
								);

								if(namespaceOrDefaultSpecifier)
								{
									declarations.push(
										t.variableDeclaration('const', [
											t.variableDeclarator(
												t.identifier(namespaceOrDefaultSpecifier.local.name),
												globalExpression!
											)
										])
									);
								}

								// Replace or drop the nodes cleanly to maintain content security standards
								if(declarations.length > 0)
								{
									path.replaceWithMultiple(declarations);
								} else
								{
									path.remove();
								}
							}
						}
					}
				};
			}
		],
		filename: route.url
	});

	const encoder = new TextEncoder();
	const arrayBuffer = encoder.encode(transpiled.code ?? '').buffer;

	// Direct the target URL from .ts to .js for the Service Worker's consumption
	const targetUrl = route.url.replace(/\.ts$/, '.js').replace(/^\.\//, '/base/');
	const editorDatabase = SettingsManager.get('github', 'environmentRepository');

	// Commit the compiled asset to your service worker pipeline
	await putRecord(DB_STORE_NAME, {
		timestamp: new Date(),
		mode: FS_FILE,
		contents: arrayBuffer,
		path: targetUrl,
		parent: targetUrl.substring(0, targetUrl.lastIndexOf('/')),
		sha: await getGitShaBrowser(arrayBuffer)
	}, editorDatabase);

	const existingPromise = registry.get(targetUrl);
	if(existingPromise)
	{
		return existingPromise;
	}

	// Import directly from the pipeline URL rather than an ephemeral blob URL
	const modulePromise = import(/* webpackIgnore: true */ targetUrl + '?t=' + Date.now() + '&local-csp=true');
	registry.set(targetUrl + '?t=' + Date.now(), modulePromise);
	const module = await modulePromise;
	return new module[route.className](route.label);
}


// Define the class property registry somewhere above this method in your class:
// private registry = new Map<string, Promise<any>>();

export async function loadScript(src: string): Promise<any>
{
	const absoluteUrl: string = new URL(src, window.location.origin).pathname;

	// ─── THE CONCURRENCY LOCK CHECK ───
	// If it's already loaded OR currently downloading, return the existing tracking handle
	const existingPromise = registry.get(absoluteUrl);
	if(existingPromise)
	{
		return existingPromise;
	}

	// Create the promise and cache it immediately to block secondary asset creation runs
	const scriptPromise = new Promise<void>((resolve, reject) =>
	{
		const script: HTMLScriptElement = document.createElement('script');
		script.src = src + '?t=' + Date.now();
		script.type = 'text/javascript';
		script.async = false; // Preserves literal script tree order

		script.onload = () => resolve();
		script.onerror = () =>
		{
			registry.delete(absoluteUrl); // Evict on failure so a retry can clear the pipe
			reject(new Error(`Failed execution pipeline: ${src}`));
		};

		document.head.appendChild(script);
	});

	registry.set(absoluteUrl, scriptPromise);
	return scriptPromise;
}

export async function triggerPanelRoute(panelId: string, mainDock: DockPanel): Promise<void>
{
	const route = MODULE_REGISTRY[panelId];
	if(!route || !route.url) return; // Skip routes without code targets (like collapse)

	try
	{
		const widgetInstance = await loadAndInstantiate(route);
		/*
		if(route.port)
		{
			const sidePanel = window[route.port] as BoxPanel;
			sidePanel.addWidget(widgetInstance);
		} else
		*/
		{
			mainDock.addWidget(widgetInstance, { mode: 'split-right' });
			mainDock.activateWidget(widgetInstance);
		}
		window.resizeHandler();
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


