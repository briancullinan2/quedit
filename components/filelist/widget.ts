// components/FileListWidget.ts
import { Widget, DockPanel } from '@lumino/widgets';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type { GitHubFileEntry } from '../bundle/github-types';
import type { RepositoryToolbar } from '../bundle/menu-repos';
import type { Settings } from '../bundle/settings';
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
		convertFlatToNested: (data: FlatFileNode[]) => NestedTreeNode[];
		githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		loadFileTree: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
		cacheFile: (repoOwner?: string, repoName?: string, filePath?: string, sha?: string, forceReload?: boolean) => Promise<any>;
		mainDock: DockPanel;
		trees: Record<string, any>;
		filesRepo: Record<string, GitHubFileEntry>;
		RepositoryToolbar: typeof RepositoryToolbar;
		SettingsManager: Settings;
		FileManager: typeof FileManager;
		fileListWidgets?: Array<FileListWidget>;
		AceEditorWidget: typeof AceEditorWidget;
		PaintWidget: typeof PaintWidget;
	}
}


export class FileListWidget extends Widget
{
	private treeContainerId: string;
	public static fileListWidgets: Array<FileListWidget> = new Array<FileListWidget>();

	constructor(titleStr: string)
	{
		super();
		this.id = 'filelist-panel';
		this.title.label = titleStr;
		FileListWidget.fileListWidgets[FileListWidget.fileListWidgets.length] = this;
		this.title.closable = true;
		this.node.style.minWidth = '200px';
		this.addClass('ide-file-tree-widget');

		this.treeContainerId = `tree-${Date.now()}`;
		this.renderLayout();
		this.bindDOMEvents();

		// Defer file tree checking until element is mounted to layout viewport
		requestAnimationFrame(() => this.initializeFiletrees());
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


	protected get defaultRepository()
	{
		return window.SettingsManager.get('github', 'engineRepository');
	}


	/**
	 * Safe HTML Structure Injection
	 */
	private renderLayout(): void
	{
		this.node.innerHTML = `
      <div class="filelist-wrapper">
        <ul class="toolbar">
          <li><a alt="New file" href="#new-file" class="bx bx-file-plus"></a></li>
          <li><a alt="New folder" href="#new-folder" class="bx bx-folder-plus"></a></li>
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
              <option value="main">main</option>
              <option value="wasm-support">wasm-support</option>
              <option value="recent_updates">recent_updates</option>
            </select>
          </li>
        </ul>
        <div class="search-box">
          <input type="text" id="search" name="search" placeholder="Search many..." />
        </div>
        <div id="${this.treeContainerId}" class="treejs-render-target"></div>
      </div>
    `;
		const parts = this.defaultRepository.split('/');
		const ownerName = parts.length === 2 ? parts[0] : window.RepositoryToolbar.owner?.value;
		const repoName = parts.length === 2 ? parts[1] : parts[0] || window.RepositoryToolbar.repository?.value;

		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement);
		const owners = window.SettingsManager.get('github', 'ownersList');
		window.updateSelectOptions(owner, owners, ownerName);

		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement);
		const repositories = window.SettingsManager.get('github', 'repositoriesList');
		window.updateSelectOptions(repo, repositories, repoName);
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('.filelist-repository')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector('.filelist-branch')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector(`#${this.treeContainerId}`)?.addEventListener('click', treeHandler.bind(this, '#' + this.treeContainerId));
	}

	private async initializeFiletrees(): Promise<void>
	{
		const repoSelect = this.node.querySelector('.filelist-repository') as HTMLSelectElement;
		const pathRepo = window.location.pathname?.trim().replace(/\/$|^\//, '');

		if(pathRepo && pathRepo.length > 0)
		{
			repoSelect.value = pathRepo;
		}
		this.onRepositoryChanged();
	}

	private async onRepositoryChanged(): Promise<void>
	{
		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;

		const targetTreeElement = document.getElementById(this.treeContainerId);
		if(!targetTreeElement) return;
		targetTreeElement.innerHTML = '';

		await window.loadFileTree(owner, repo, branch, '#' + this.treeContainerId);
	}

	protected onResize(msg: Widget.ResizeMessage): void
	{
		// Keeps internal lists and heights optimized inside Lumino constraints
		if(msg.height < 0 || msg.width < 0) return;
	}
}


export const fileListWidgets = FileListWidget.fileListWidgets;
window.fileListWidgets = fileListWidgets;


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

		let selected = window.RepositoryToolbar.owner?.value + '/' + window.RepositoryToolbar.repository?.value;
		let nodeDB: string | null;

		if(nodeDB = node.getAttribute('data-database'))
		{
			selected = nodeDB;
		}
		if(node.closest('#filelist'))
		{
			selected = window.SettingsManager.get('github', 'engineRepository');
		}
		if(node.closest('#gamelist'))
		{
			selected = window.SettingsManager.get('github', 'gameRepository');
		}
		if(node.closest('#assetRepo'))
		{
			selected = window.SettingsManager.get('github', 'assetRepository');
		}
		if(node.closest('#database'))
		{
			const parent = node.closest('#database > div > ul > li[data-id]') as HTMLElement | null;
			if(parent && (nodeDB = parent.getAttribute('data-id')))
			{
				selected = nodeDB;
			}
		}
		if(node.closest('#github'))
		{
			const parent = node.closest('#github > div > ul > li[data-id]') as HTMLElement | null;
			if(parent && (nodeDB = parent.getAttribute('data-id')))
			{
				selected = nodeDB;
			}
		}

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
	protected override get defaultRepository() {
		return window.SettingsManager.get('github', 'gameRepository');
	}
}

