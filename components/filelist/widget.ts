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
	}
}

window.fileListWidgets = new Array<FileListWidget>();


export class FileListWidget extends Widget
{
	protected treeContainerId: string;
	container?: HTMLDivElement;

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
		this.renderLayout().then(() =>
		{
			this.bindDOMEvents();
			requestAnimationFrame(() => this.initializeFiletrees());
		});
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('.filelist-repository')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector('.filelist-branch')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector('[href="#link"]')?.addEventListener('click', () =>
		{
			const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
			const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
			const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
			window.open('https://github.com/' + owner + '/' + repo + '/tree/' + branch);
		});
		this.node.querySelector('[href="#new-folder"]')?.addEventListener('click', async () =>
		{
			const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
				mode: 'readwrite'
			});
			const widgetHandle = getRegistryIdFromWidget(this);
			let settingKey: string | undefined;
			if(widgetHandle === 'filelist')
			{
				settingKey = 'engine_location';
			}
			else if(widgetHandle === 'gamelist')
			{
				settingKey = 'game_location';
			}
			else if(widgetHandle === 'assetlist')
			{
				settingKey = 'asset_location';
			}
			else
			{
				settingKey = 'default_location';
			}
			localStorage.setItem(settingKey, handle);
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
		this.onRepositoryChanged();
	}

	protected async onRepositoryChanged(): Promise<void>
	{
		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;

		if(!this.container) return;
		this.container.innerHTML = '';

		await window.loadFileTree(owner, repo, branch, this.selector);
	}

	protected onResize(msg: Widget.ResizeMessage): void
	{
		// Keeps internal lists and heights optimized inside Lumino constraints
		if(msg.height < 0 || msg.width < 0) return;
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


export function configureFileHandle(newLocation: FileSystemDirectoryHandle): void
{
	if(!newLocation || newLocation.name.includes('briancullinan2'))
	{
		console.error('Assertion local folder name is briancullinan2');
		debugger;
		return;
	}

	if(newLocation.name.trim().length > 0 && !window.RepositoryToolbar.locations?.querySelector(`option[value="${newLocation}"]`))
	{
		const option = document.createElement('option');

		option.value = `file-handle-${++window.tempCount}`;
		option.textContent = newLocation.name;

		window.RepositoryToolbar.locations?.appendChild(option);
	}
}


async function listDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void>
{
	for await(const entry of dirHandle.values())
	{
		if(entry.kind === 'file')
		{
			const fileHandle = entry as FileSystemFileHandle;
			console.log(`[File] ${fileHandle.name}`);
		} else if(entry.kind === 'directory')
		{
			const subDirHandle = entry as FileSystemDirectoryHandle;
			console.log(`[Directory] ${subDirHandle.name}`);
		}
	}
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

