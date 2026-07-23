// components/FileListWidget.ts
import { Widget, DockPanel } from '@lumino/widgets';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type { GitHubBranch, GitHubFileEntry, GitHubFileTree } from '../bundle/github-types';
import type { RepositoryToolbar } from '../bundle/menu-repos';
import type { SettingConfig, Settings } from '../bundle/settings';
import type { FileManager } from '../bundle/lumino-files';
import { Message, MessageLoop } from '@lumino/messaging';
import Tree from './tree.js';
import { AssetInspector, hasSequentialBinaryRegex, hexDump } from '../rosetta/binary.mjs';
import type { AceEditorWidget } from '../editor/widget';
import type { PaintWidget } from '../paint/widget';
import type { GitHubBranchLike } from '../bundle/github-settings';
import type { FileRecord } from '../bundle/local';

declare global
{
	interface Window
	{
		updateSelectOptions: (
			elementId: string | Element | undefined | null,
			items: Record<string, string> | Array<string | GitHubBranchLike>,
			selectedValue: string
		) => void;
		getBranches: (repoOwner: string | undefined, repoName: string | undefined) => Promise<GitHubBranch[]>;
		convertFlatToNested: (data: FlatFileNode[]) => NestedTreeNode[];
		githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		loadFileTree: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
		cacheFile: (repoOwner?: string, repoName?: string, filePath?: string, sha?: string, forceReload?: boolean) => Promise<any>;
		mainDock: DockPanel;
		trees: Record<string, any>;
		filesRepo: Record<string, GitHubFileTree | undefined>;
		RepositoryToolbar: typeof RepositoryToolbar;
		SettingsManager: Settings;
		FileManager: typeof FileManager;
		fileListWidgets?: Array<FileListWidget>;
		AceEditorWidget: typeof AceEditorWidget;
		PaintWidget: typeof PaintWidget;
		IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
		getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void;
		putRecord(storeName: string, record: FileRecord, dbName: string | null, noBounce?: boolean): Promise<any>;
		getRecord(storeName: string, record: string, dbName: string | null, dbVersion?: number, noBounce?: boolean): Promise<FileRecord | null>;
		DB_STORE_NAME: string;
		FS_FILE: number;
		ensureDatabaseContainer(database: string): Promise<void>;
	}
}

type PermissionState = 'granted' | 'denied' | 'prompt';

interface FileSystemHandlePermissionDescriptor
{
	mode?: 'read' | 'readwrite';
}


declare global
{
	interface FileSystemHandle
	{
		queryPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
		requestPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
	}
}


window.fileListWidgets = new Array<FileListWidget>();


export class FileListWidget extends Widget
{
	protected treeContainerId: string;
	container?: HTMLDivElement;
	handle?: FileSystemDirectoryHandle;
	private observer!: MutationObserver;
	protected loadedDatabases: Record<string, NestedTreeNode> = {};
	handleKey?: string;
	protected treeLoading: boolean = false;
	protected refreshTreeTimer: any;

	protected get selector()
	{
		return '#' + this.treeContainerId;
	}

	constructor(titleStr: string)
	{
		super();
		this.id = `filelist-panel-${++window.tempCount}`;
		this.title.label = titleStr;
		if(window.fileListWidgets)
		{
			window.fileListWidgets[window.fileListWidgets.length] = this;
		}
		this.title.closable = true;
		this.node.style.minWidth = '200px';
		this.addClass('ide-file-tree-widget');

		this.treeContainerId = `tree-${Date.now()}`;
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);
			// Hijack the close! Instead of destroying, hide the panel
			this.hide();
			this.parent = null;

			// Notify the parent DockPanel to recalculate layout paths immediately
			if(this.parent)
			{
				// Forcing an internal update pass so layout sizes collapse seamlessly
				MessageLoop.sendMessage(this.parent, new Message('layout-request'));
			}
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}


	public get defaultRepository()
	{
		return window.SettingsManager.get('github', 'engineRepository');
	}


	/**
	 * Safe HTML Structure Injection
	 */
	private async renderLayout(): Promise<void>
	{
		if(this.node.innerHTML === '')
		{
			this.node.innerHTML = `
			<div class="filelist-wrapper">
				<ul class="toolbar">
				<li><a alt="New file" href="#new-file" class="bx bx-file-plus"></a></li>
				<li><a alt="New folder" href="#new-folder" class="bx bx-folder-plus"></a></li>
				<li><a alt="Google Drive" href="#new-gdrive" class="bx bxl bx-google-cloud"></a></li>
				<li><a alt="Hidden files" href="#hidden" class="bx bx-eye-slash"></a></li>
				<li><a alt="Github link" href="#link" class="bx bx-link"></a></li>
				<li><a alt="Refresh list" href="#refresh" class="bx bx-refresh-cw"></a></li>
				<li class="setting" data-placeholder="Owner">
					<select name="owner" class="filelist-owner">
					</select>
				</li>
				<li class="setting" data-placeholder="Repository">
					<select name="repository" class="filelist-repository">
					</select>
				</li>
				<li class="setting" data-placeholder="Branch">
					<select name="branch" class="filelist-branch">
					</select>
				</li>
				</ul>
				<div class="search-box">
				<input type="text" id="search" name="search" placeholder="Search many..." />
				</div>
				<div id="${this.treeContainerId}" class="treejs-render-target"></div>
			</div>
			`;
		}
		const parts = this.defaultRepository.split('/');
		const ownerName = parts.length === 2 ? parts[0] : window.RepositoryToolbar.owner?.value;
		const repoName = parts.length === 2 ? parts[1] : parts[0] || window.RepositoryToolbar.repository?.value;

		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement);
		const owners = window.SettingsManager.get('github', 'ownersList');
		window.addOwnerIfNotExists(ownerName);
		window.updateSelectOptions(owner, owners, ownerName);

		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement);
		const repositories = window.SettingsManager.get('github', 'repositoriesList');
		window.addRepoIfNotExists(repoName);
		window.updateSelectOptions(repo, repositories, repoName);

		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement);
		const branches = await window.getBranches(ownerName, repoName);
		window.updateSelectOptions(branch, branches, branches[0].name);
	}

	protected override onAfterAttach(msg: Message): void
	{
		requestAnimationFrame(() =>
		{
			this.renderLayout().then(async () =>
			{
				this.bindDOMEvents();
				const widgetHandle = getRegistryIdFromWidget(this);
				const settingKey: string = getSettingFromRegistryId(widgetHandle);
				const database = window.SettingsManager.get('github', 'environmentRepository');
				const handle: FileSystemDirectoryHandle = (await window.getRecord(window.DB_STORE_NAME, '/' + settingKey, database))?.contents;
				if(await verifyPermission(handle))
				{
					this.handle = handle;
					const settingsConfig = Object.values(LOCAL_SETTINGS.filelist).find(s => s.key === settingKey);
					this.handleKey = configureFileHandle(this.handle, settingsConfig);
				}

				this.initializeFiletrees();
			});
		});
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('.filelist-repository')?.addEventListener('change', () => this.initializeFiletrees());
		this.node.querySelector('.filelist-branch')?.addEventListener('change', () => this.initializeFiletrees());
		this.node.querySelector('[href="#link"]')?.addEventListener('click', (event) =>
		{
			event.preventDefault();
			const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
			const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
			const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
			window.open('https://github.com/' + owner + '/' + repo + '/tree/' + branch);
		});
		this.node.querySelector('[href="#new-folder"]')?.addEventListener('click', async (event) =>
		{
			event.preventDefault();
			let handle: FileSystemDirectoryHandle;
			try
			{
				handle = await window.showDirectoryPicker({
					mode: 'readwrite'
				});
			}
			catch(e)
			{
				this.handle = undefined;
				console.error(e);
				return;
			}
			const widgetHandle = getRegistryIdFromWidget(this);
			const settingKey: string = getSettingFromRegistryId(widgetHandle);
			const database = window.SettingsManager.get('github', 'environmentRepository');
			await window.ensureDatabaseContainer(database);
			await window.putRecord(window.DB_STORE_NAME, {
				timestamp: new Date(),
				mode: window.FS_FILE,
				contents: handle,
				path: '/' + settingKey,
				parent: '/'
			}, database);
		});
		this.container = this.node.querySelector(this.selector) as HTMLDivElement;
		this.container?.addEventListener('click', treeHandler.bind(this, this.selector));
	}

	protected async initializeFiletrees(): Promise<void>
	{
		if(this.container && this.container.innerHTML !== '')
		{
			return;
		}

		const repoSelect = this.node.querySelector('.filelist-repository') as HTMLSelectElement;
		const pathRepo = window.location.pathname?.trim().replace(/\/$|^\//, '');

		if(pathRepo && pathRepo.length > 0)
		{
			repoSelect.value = pathRepo;
		}


		if(!this.container) return;
		this.container.innerHTML = '';

		if(this.handle)
		{
			await this.showLocalFilesystem();
			this.bindMutationObserver();
		}
		else
		{
			const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
			const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
			const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
			await window.loadFileTree(owner, repo, branch, this.selector);
		}
	}


	private async showLocalFilesystem(folderId?: string): Promise<void>
	{
		if(!this.handle || !this.handleKey)
		{
			return;
		}

		const database = this.handleKey;

		if(!this.loadedDatabases[database])
		{
			// Scan root level items from local directory handle
			const localEntries = await listDirectory(this.handle, '');

			window.filesRepo[this.selector] = localEntries;
			if(!window.filesRepo[database])
			{
				window.filesRepo[database] = {};
			}

			const nodes = window.convertFlatToNested(Object.values(window.filesRepo[this.selector] ?? {}));
			for(let n of nodes)
			{
				n.id = database + '/' + n.id;
				const isDir = n.mode ? (n.mode >> 12) & window.ST_DIR : false;
				n.children = isDir ? [{ text: 'Loading...', id: `${n.path}/loading`, path: `${n.path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null;

				window.filesRepo[database][n.path] = window.FS.virtual[n.path] = this.loadedDatabases[n.id] = Object.assign(n, {
					mode: n.mode ?? window.FS_FILE,
				});
			}

			this.loadedDatabases[database] = {
				id: database,
				text: database,
				status: 0,
				state: { open: false, expanded: false },
				path: database,
				children: nodes
			};
		}

		const activeTree = window.trees[this.selector];
		if(!activeTree)
		{
			window.trees[this.selector] = window.trees[database] = new Tree(this.selector, {
				data: this.loadedDatabases[database].children,
				autoOpen: false,
				closeDepth: null
			});
		} else if(folderId)
		{
			activeTree.options.data = this.loadedDatabases[database].children;
			activeTree.renderPartial(folderId);
		}
	}


	/**
	 * Lazy load local folders and render structural updates
	 */
	protected async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(this.treeLoading) return;
		if(folderId.endsWith('[Recursive]') || folderId.endsWith('/loading')) return;

		const activeTree = window.trees[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		if(!this.handle || !this.handleKey) return;

		const database = this.handleKey;
		const parts = folderId.split('/');

		// Strip the database handle prefix to isolate the relative folder path
		const relativeSegments = parts.slice(1);
		const baseDir = relativeSegments.join('/');

		const targetNode = this.loadedDatabases[folderId];
		const basePath = targetNode?.path ?? baseDir;
		const dirPath = basePath.substring(0, basePath.lastIndexOf('/'));
		const parentDir = database + (dirPath.trim().length > 0 ? `/${dirPath}` : '');

		try
		{
			this.treeLoading = true;

			if(!window.filesRepo[database])
			{
				window.filesRepo[database] = {};
			}

			// Resolve sub-directory handle and list its children
			const targetDirHandle = await resolveDirectoryHandle(this.handle, relativeSegments);
			const result = await listDirectory(targetDirHandle, baseDir);

			const nodes = window.convertFlatToNested(Object.values(result ?? {}));
			for(const r of nodes)
			{
				window.filesRepo[database][r.path] = window.FS.virtual[r.path] = Object.assign(r, {
					mode: r.mode ?? window.FS_FILE,
				});
			}

			const resultSet = Object.values(window.filesRepo[database]).reduce((acc: Record<string, any>, r: any) =>
			{
				acc[r.path] = r;
				return acc;
			}, {});

			const resultKeys = Object.keys(resultSet);

			// Isolate immediate children belonging to baseDir
			const childrenKeys = resultKeys.filter(path =>
			{
				const firstMatch = basePath === '/' || basePath === '' || path.startsWith(`${basePath}/`)
					|| path.startsWith(`/${basePath}/`);
				if(!firstMatch) return false;

				const relativePath = path.replace(/^[\/\\]|[\/\\]$/gi, '').substring(basePath.length + 1);
				const slashIndex = relativePath.indexOf('/');
				return slashIndex === -1 || slashIndex === relativePath.length - 1;
			});

			// Construct lazy nodes for TreeJS
			const newChildren = childrenKeys.map(path =>
			{
				const node = resultSet[path];
				const isDir = (node.mode >> 12) & window.ST_DIR;
				const name = path.split('/').pop() || path;

				const newNode: NestedTreeNode = {
					id: database + '/' + (node.id ?? path),
					text: name,
					path: path,
					parent: activeTree.nodesById[folderId],
					status: 0,
					state: { open: false, expanded: false },
					children: isDir ? [{ text: 'Loading...', id: `${database}/${path}/loading`, path: `${path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null
				};

				this.loadedDatabases[newNode.id] = activeTree.nodesById[newNode.id] = newNode;

				const searchParent = this.loadedDatabases[parentDir]?.children;
				if(searchParent)
				{
					const parentIndex = searchParent.findIndex(n => n.id === newNode.id);
					if(parentIndex > -1)
					{
						searchParent[parentIndex] = newNode;
					}
				}

				return newNode;
			});

			if(newChildren.length === 0)
			{
				newChildren.push({
					text: 'Empty...',
					id: `${folderId}/empty`,
					path: `${folderId}/empty`,
					status: 0,
					state: { open: false, expanded: false }
				});
			}

			window.sortNodes(newChildren);
			this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;

		} catch(err: any)
		{
			console.error(`Failed to load local filesystem node: ${err.message}\n${err.stack ?? err.stacktrace}`);
			this.loadedDatabases[folderId] = { text: 'Error loading files', id: 'err', path: 'err', status: 0, state: { open: false, expanded: false } } as NestedTreeNode;
		}

		await this.showLocalFilesystem(folderId);

		if(this.refreshTreeTimer)
		{
			clearTimeout(this.refreshTreeTimer);
		}

		this.refreshTreeTimer = setTimeout(async () =>
		{
			activeTree.values = [];
			const node = activeTree.nodesById[folderId];
			if(node)
			{
				activeTree.open(node);
			}
			setTimeout(() =>
			{
				this.treeLoading = false;
			}, 300);
		}, 200);
	}

	/**
	 * Sets up MutationObserver to intercept class toggles on folder expansion.
	 */
	protected bindMutationObserver(): void
	{
		this.observer = new MutationObserver((mutations) =>
		{
			mutations.forEach(async (mutation) =>
			{
				if(mutation.type === 'attributes' && mutation.attributeName === 'class')
				{
					const target = mutation.target as HTMLElement;
					const folderId = target.getAttribute('data-id');

					if(folderId && target.classList.contains('treejs-node__open'))
					{
						await this.expandDatabaseTree(target, folderId);
					}
				}
			});
		});

		this.observer.observe(this.node, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class']
		});
	}


	protected onResize(msg: Widget.ResizeMessage): void
	{
		// Keeps internal lists and heights optimized inside Lumino constraints
		if(msg.height < 0 || msg.width < 0) return;
	}


	protected override onBeforeDetach(msg: Message): void
	{
		if(this.observer)
		{
			this.observer.disconnect();
		}
		super.onBeforeDetach(msg);
	}
}


async function verifyPermission(
	fileHandle: FileSystemDirectoryHandle,
	readWrite: boolean = true
): Promise<boolean>
{
	const options: FileSystemHandlePermissionDescriptor = {
		mode: readWrite ? 'readwrite' : 'read'
	};

	// Check if permission was already granted
	if((await fileHandle.queryPermission(options)) === 'granted')
	{
		return true;
	}

	// Request permission from the user
	if((await fileHandle.requestPermission(options)) === 'granted')
	{
		return true;
	}

	return false;
}


function getSettingFromRegistryId(widgetHandle?: string | null | undefined | void): string
{
	if(widgetHandle === 'filelist')
	{
		return 'engine_location';
	}
	else if(widgetHandle === 'gamelist')
	{
		return 'game_location';
	}
	else if(widgetHandle === 'assetlist')
	{
		return 'asset_location';
	}
	else
	{
		return 'default_location';
	}
}


function getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void
{
	let selectedRespository: string | undefined;
	if(widget instanceof HTMLElement)
	{
		widget = (Array.from(window.mainDock.widgets()).find(w =>
			w.node === widget || (widget as HTMLElement).closest('.lm-Widget') === w.node
		) as FileListWidget);
	}

	if(widget instanceof FileListWidget)
	{
		if(widget instanceof GameListWidget)
		{
			return 'gamelist';
		}
		else if(widget.constructor.name === 'AssetListWidget')
		{
			return 'assetlist';
		}
		else if(widget.constructor.name === 'FileListWidget')
		{
			return 'filelist';
		}
		else if(widget.constructor.name === 'DatabaseListWidget')
		{
			return 'database';
		}
		else
		{
			selectedRespository = widget.defaultRepository;
		}
	}
	else if(typeof widget === 'string')
	{
		const entry = Object.entries(window.IMPORT_SETTINGS?.github ?? {})
			.find(([propName, config]) =>
			{
				if(propName === widget)
				{
					return true;
				} else if(window.SettingsManager.get('github', propName) === widget)
				{
					return true;
				}
			});
		if(entry)
		{
			selectedRespository = entry[0];
		}
	}

	if(!selectedRespository)
	{
		return;
	}

	if(selectedRespository === window.SettingsManager.get('github', 'engineRepository'))
	{
		return 'filelist';
	}

	if(selectedRespository === window.SettingsManager.get('github', 'gameRepository'))
	{
		return 'gamelist';
	}

	if(selectedRespository === window.SettingsManager.get('github', 'assetRepository'))
	{
		return 'assetlist';
	}

}


window.getRegistryIdFromWidget = getRegistryIdFromWidget;


async function treeHandler(selector: string, e: Event): Promise<void>
{
	const target = e.target as HTMLElement | null;
	if(!target) return;

	const node = target.closest('.treejs-node') as HTMLElement | null;
	if(!node) return;

	const fileId = node.getAttribute('data-id');
	if(!fileId) return;

	// Fixed bug: changed .endsWith['...'] to .endsWith('...')
	if(fileId.endsWith('[Recursive]'))
	{
		return;
	}

	if(node.classList.contains('treejs-placeholder'))
	{
		const tree = window.trees[selector];
		if(!tree || !tree.nodesById[fileId]) return;

		const filePath = tree.nodesById[fileId].path;

		const [realFilePath, selectedGithub, dbFile, lineNumber] = await window.FileManager.findFileTestPath(filePath);
		console.warn('openFile: ' + filePath + ' length: ' + dbFile?.contents?.length + ' from: ' + selectedGithub);
		let contents = dbFile?.contents;
		if(!contents && selectedGithub && (!dbFile?.contents || dbFile.contents?.length === 0))
		{
			const parts = selectedGithub.split('/');
			const newRepo = parts.length === 2 ? parts[1] : parts[0] || window.RepositoryToolbar.repository?.value;
			const newOwner = parts.length === 2 ? parts[0] : window.RepositoryToolbar.owner?.value;
			contents = await window.cacheFile(newOwner, newRepo, filePath) as ArrayBuffer;
		}

		const byteView = new Uint8Array(contents).subarray(0, 8192);
		const sampleText = new TextDecoder().decode(byteView);

		const isImageFile = AssetInspector.isActuallyImage(byteView, filePath);
		if(isImageFile)
		{
			if(typeof window.PaintWidget === 'undefined')
			{
				await window.triggerPanelRoute('paint', window.mainDock);
			}

			window.PaintWidget.openFileInNewTab(realFilePath ?? filePath, realFilePath ?? filePath, contents);
		} else
		{
			if(hasSequentialBinaryRegex.test(sampleText))
			{
				contents = hexDump(byteView, contents, filePath);
			} else
			{
				contents = new TextDecoder().decode(contents);
			}

			if(typeof window.AceEditorWidget === 'undefined')
			{
				await window.triggerPanelRoute('editor', window.mainDock);
			}

			window.AceEditorWidget.openFileInNewTab(realFilePath ?? filePath, realFilePath ?? filePath, contents);
		}

	}
}


export class GameListWidget extends FileListWidget
{
	public override get defaultRepository()
	{
		return window.SettingsManager.get('github', 'gameRepository');
	}
}


export function configureFileHandle(newLocation: FileSystemDirectoryHandle, config?: SettingConfig): string | undefined
{
	if(!newLocation || newLocation.name.includes('briancullinan2'))
	{
		console.error('Assertion local folder name is briancullinan2');
		debugger;
		return;
	}

	const handleValue = `${config?.key}/${newLocation.name}-${++window.tempCount}`;

	if(newLocation.name.trim().length > 0 && !window.RepositoryToolbar.locations?.querySelector(`option[value="${handleValue}"]`))
	{
		const option = document.createElement('option');

		option.value = handleValue;
		option.textContent = newLocation.name;

		window.RepositoryToolbar.locations?.appendChild(option);
	}

	return handleValue;
}

async function listDirectory(
	dirHandle: FileSystemDirectoryHandle,
	relPath: string = ''
): Promise<Record<string, GitHubFileEntry>>
{
	const records: Record<string, GitHubFileEntry> = {};

	for await(const entry of dirHandle.values())
	{
		const itemPath = relPath ? `${relPath}/${entry.name}` : entry.name;

		if(entry.kind === 'file')
		{
			const fileHandle = entry as FileSystemFileHandle;
			let size: number | undefined;
			let timestamp: Date | null = null;

			try
			{
				const file = await fileHandle.getFile();
				size = file.size;
				timestamp = new Date(file.lastModified);
			} catch
			{
				// If permission or handle access fails temporarily, fall back gracefully
			}

			records[itemPath] = {
				name: entry.name,
				path: itemPath,
				type: 'file',
				mode: window.FS_FILE,
				size: size,
				timestamp: timestamp,
				contents: fileHandle,
				parent: relPath || null
			};
		} else if(entry.kind === 'directory')
		{
			const subDirHandle = entry as FileSystemDirectoryHandle;

			records[itemPath] = {
				name: entry.name,
				path: itemPath,
				type: 'dir',
				mode: window.FS_DIR,
				contents: subDirHandle,
				parent: relPath || null
			};
		}
	}

	return records;
}


async function resolveDirectoryHandle(
	rootHandle: FileSystemDirectoryHandle,
	pathSegments: string[]
): Promise<FileSystemDirectoryHandle>
{
	let current = rootHandle;
	for(const segment of pathSegments)
	{
		if(!segment) continue;
		current = await current.getDirectoryHandle(segment);
	}
	return current;
}


const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	filelist: {
		defaultLocation: {
			key: 'default_location',
			default: '',
			elementId: window.RepositoryToolbar.locations?.id,
			description: 'The fallback or preferred primary repository string formatted as "owner/repo" used when loading the workspace workspace initial state.',
			get: (storage: string | null, defaultLocation: string): string =>
			{
				return window.RepositoryToolbar.locations?.value
					? window.RepositoryToolbar.locations?.value
					: (storage || defaultLocation);
			},
			set: configureFileHandle
		},
		engineLocation: {
			key: 'engine_location',
			default: '',
			description: 'The specific local folder designated for compiling the core Quake 3 WebAssembly engine architecture.',
			set: configureFileHandle
		},
		gameLocation: {
			key: 'game_location',
			default: '',
			description: 'The local folder source housing the game logic mod components, including cgame, game, and ui modules.',
			set: configureFileHandle
		},
		assetLocation: {
			key: 'asset_location',
			default: '',
			description: 'Optional local folder dedicated to static game assets, maps, texturing bundles, or audio assets required to run the game.',
			set: configureFileHandle
		},
		toolsLocation: {
			key: 'tools_location',
			default: '',
			description: 'Primary compiler tooling local folder containing components such as q3lcc (the Quake 3 ANSI C compiler targeting virtual machine bytecode).',
			set: configureFileHandle
		},
		tools2Location: {
			key: 'tools_location',
			default: '',
			description: 'Secondary toolchain local folder hosting utilities like q3asm to assemble the intermediate bytecode files into final .qvm files.',
			set: configureFileHandle
		},
		rendererLocation: {
			key: 'renderer_location',
			default: '',
			description: 'Local folder handling the graphical subsystems and pipeline routines tasked with translating engine calculations to browser contexts.',
			set: configureFileHandle
		},
		environmentLocation: {
			key: 'environment_location',
			default: '',
			description: 'Local folder for this workspace, the entire IDE, code editor and engine runner, for editing the environment inside the workspace.',
			set: configureFileHandle
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

export const IMPORT_SETTINGS = window.IMPORT_SETTINGS;

