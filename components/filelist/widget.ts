// components/FileListWidget.ts
import { Widget, DockPanel } from '@lumino/widgets';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type { GitHubFileEntry } from '../bundle/github-types.js';
import type { RepositoryToolbar } from '../bundle/menu-repos.js';
import type { Settings } from '../bundle/settings.js';
import Tree from './tree.js';

declare global
{
	interface Window
	{
		convertFlatToNested: (data: FlatFileNode[]) => NestedTreeNode[];
		githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		loadFileTree: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
		mainDock: DockPanel;
		trees: Record<string, any>;
		filesRepo: Record<string, GitHubFileEntry>;
		RepositoryToolbar: typeof RepositoryToolbar;
		SettingsManager: Settings;
	}
}


export class FileListWidget extends Widget
{
	private treeContainerId: string;

	constructor(titleStr: string)
	{
		super();
		this.id = 'filelist-panel';
		this.title.label = titleStr;
		this.title.closable = true;
		this.addClass('ide-file-tree-widget');

		this.treeContainerId = `tree-${Date.now()}`;
		this.renderLayout();
		this.bindDOMEvents();

		// Defer file tree checking until element is mounted to layout viewport
		requestAnimationFrame(() => this.initializeFiletrees());
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
            <select name="owner" id="owner">
              <option value="briancullinan2">briancullinan2</option>
              <option value="ec-">ec-</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Repository">
            <select name="repository" id="repository">
              <option value="Quake3e">Quake3e</option>
              <option value="baseq3a">baseq3a</option>
              <option value="q3lcc">q3lcc</option>
              <option value="q3asm">q3asm</option>
              <option value="quedit">quedit</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Branch">
            <select name="branch" id="branch">
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
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('#repository')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector('#branch')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector(`#${this.treeContainerId}`)?.addEventListener('click', treeHandler.bind(this, '#' + this.treeContainerId));
	}

	private async initializeFiletrees(): Promise<void>
	{
		const repoSelect = this.node.querySelector('#repository') as HTMLSelectElement;
		const pathRepo = window.location.pathname?.trim().replace(/\/$|^\//, '');

		if(pathRepo && pathRepo.length > 0)
		{
			repoSelect.value = pathRepo;
		}
		this.onRepositoryChanged();
	}

	private async onRepositoryChanged(): Promise<void>
	{
		const owner = (this.node.querySelector('#owner') as HTMLSelectElement).value;
		const repo = (this.node.querySelector('#repository') as HTMLSelectElement).value;
		const branch = (this.node.querySelector('#branch') as HTMLSelectElement).value;

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




function treeHandler(selector: string, e: Event): void
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

		const parts = selected.split('/');
		const newRepo = parts.length === 2 ? parts[1] : parts[0] || window.RepositoryToolbar.repository?.value;
		const newOwner = parts.length === 2 ? parts[0] : window.RepositoryToolbar.owner?.value;

		console.warn('TODO: openFile: ' + filePath);
		//openFile(newOwner, newRepo, filePath, tree.nodesById[fileId].sha);
	}
}
