// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget, BoxPanel } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { RepositoryToolbar } from './menu-repos';
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
import { ScriptToolbar } from './menu-script';
import { ApplicationToolbar } from './menu-app';
import { FileToolbar } from './menu-file';
import { SettingsToolbar } from './menu-settings';
import { EngineToolbar } from './menu-engine';
import { HistoryToolbar } from './menu-history';
import { LayoutAdjuster } from './lumino-widget';
import type { FileListWidget } from '../filelist/widget';
import { MenuConfig } from './menu-manager';


const parseBabel = packages.parser.parse;
const traverse = packages.traverse.default;

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
		globalMenuBar: MenuBar;
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
	'paint': { label: 'miniPaint', url: './components/paint/widget.ts', className: 'PaintWidget', iconClass: 'bx bx-palette' },
	'nunu': { label: 'nunuStudio', url: './components/NunuStudioWidget.ts', className: 'NunuStudioWidget', iconClass: 'bx bx-vector-triangle' },
	'audio-editor': { label: 'AudioMass', url: './components/AudioEditorWidget.ts', className: 'AudioEditorWidget', iconClass: 'bx bx-sine-wave' },
	'searchlist': { label: 'Search Files', url: './components/SearchWidget.ts', className: 'SearchWidget', iconClass: 'bx bx-search' },
	'filelist': { label: 'Engine Files', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-folder-code' },
	'gamelist': { label: 'Game Files', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-handheld-alt' },
	'assetlist': { label: 'Assets', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-treasure-chest' },
	'database': { label: 'Local Database', url: './components/DatabaseWidget.ts', className: 'DatabaseWidget', iconClass: 'bx bx-database' },
	'github': { label: 'Github Commit', url: './components/GithubWidget.ts', className: 'GithubWidget', iconClass: 'bx bx-git-repo-forked' },
	'settings': { label: 'Edit Settings', url: './components/editor/widget.ts', className: 'SettingsWidget', iconClass: 'bx bx-gear' },
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



function collectDependencies(rawCode: string, route: ComponentRoute): string[]
{

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
			} else if(moduleName === './bundle.js' && route.url)
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
				} else if(moduleName === './bundle.js' && route.url)
				{
					dependenciesToFetch.push(path.resolve(route.url.substring(0, route.url.lastIndexOf('/')), moduleName));
				}
			}
		},

	});

	return dependenciesToFetch;
}


async function preloadDependencies(dependenciesToFetch: string[]): Promise<void>
{
	if(dependenciesToFetch.length === 0)
	{
		return;
	}
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


function transpileTypescriptWidget(rawCode: string, route: ComponentRoute): any
{

	const transpiled = transform(rawCode, {
		presets: ['env'],
		sourceMaps: 'inline',
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
								} else if(moduleName === './bundle.js')
								{
									path.replaceWithSourceString('window');
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
							} else if(moduleName === './bundle.js')
							{
								globalExpression = t.identifier('window');
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


	return transpiled;
}



async function loadAndInstantiate(route: ComponentRoute): Promise<any>
{
	if(!route.url || !route.className)
	{
		throw new Error(`Route definition "${route.label}" is missing execution target pathways.`);
	}

	if(route.url.endsWith('.js'))
	{
		const modulePromise = import(/* webpackIgnore: true */ route.url + '?t=' + Date.now() + '&local-csp=true');
		registry.set(route.url, modulePromise);
		const module = await modulePromise;
		return new module[route.className](route.label);
	}

	const response = await fetch(route.url + '?t=' + Date.now());
	const rawCode = await response.text();

	if(!response.ok) throw new Error('Component not found: ' + route.url);
	if(!transform) throw new Error("Babel standalone runner not found on the window context.");
	const targetUrl = route.url.replace(/\.ts$/, '.js').replace(/^\.\//, '/base/');

	const existingPromise = registry.get(targetUrl);
	if(existingPromise)
	{
		console.log('Already transpiled: ' + route.className);
		const module2 = await existingPromise;
		return new module2[route.className](route.label);
	}

	const dependenciesToFetch = collectDependencies(rawCode, route);

	await preloadDependencies(dependenciesToFetch);

	const transpiled = transpileTypescriptWidget(rawCode, route);
	const encoder = new TextEncoder();
	const arrayBuffer = encoder.encode(transpiled.code ?? '').buffer;

	// Direct the target URL from .ts to .js for the Service Worker's consumption
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


	if(transpiled.map)
	{
		const sourceMapBuffer = encoder.encode(transpiled.map ?? '').buffer;
		await putRecord(DB_STORE_NAME, {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: sourceMapBuffer,
			path: targetUrl.replace('.js', '.map'),
			parent: targetUrl.substring(0, targetUrl.lastIndexOf('/')),
			sha: await getGitShaBrowser(arrayBuffer)
		}, editorDatabase);
	}


	// Import directly from the pipeline URL rather than an ephemeral blob URL
	const modulePromise = import(/* webpackIgnore: true */ targetUrl + '?t=' + Date.now() + '&local-csp=true');
	registry.set(targetUrl, modulePromise);
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
	if(!route || !route.url)
	{
		console.log('Panel route not found: ' + panelId);
		return; // Skip routes without code targets (like collapse)
	}

	try
	{
		const currentWidgets = Array.from(mainDock.widgets());
		const existing = currentWidgets.filter(w => w.constructor.name === route.className);
		if(existing.length > 0)
		{
			console.log('Panel route already loaded: ' + panelId);
			if(route.className === 'FileListWidget')
			{
				existing[0].hide();
				existing[0].parent = null;
				window.resizeHandler();
				return;
			}

			existing[0].show();
			existing[0].activate();
			return;
		}

		// TODO: make this a global singleton list?
		const currentFileList = window.fileListWidgets?.filter(f => f.title.label === route.label);
		if(currentFileList && currentFileList.length > 0)
		{
			console.log('Panel singleton toggle: ' + panelId);
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, currentFileList[0], {
				type: 'outline',
				projectId: currentFileList[0].constructor.name
			});
			//currentFileList[0].show();
			//currentFileList[0].activate();
			return;
		}

		const widgetInstance = await loadAndInstantiate(route);
		if(widgetInstance.constructor.name === 'FileListWidget')
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
		}

		if(panelId === 'collapse')
		{
			toolbarNode.classList.toggle('collapsed');
			return;
		}

		triggerPanelRoute(panelId, mainDock);
	}
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


