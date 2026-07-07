// components/FileListWidget.ts
import { Widget, DockPanel } from '@lumino/widgets';
import { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';

// Declaring tree.js interfaces for type safety
declare class Tree
{
	constructor(elementIdOrNode: HTMLElement, config: any);
}

declare global
{
	interface Window
	{
		convertFlatToNested: (data: FlatFileNode[]) => NestedTreeNode[];
		githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		mainDock: DockPanel;
	}
}


export class FileListWidget extends Widget
{
	private treeContainerId: string;
	private treeInstance: any = null;
	private filesCache: Record<string, any> = {};

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
      <div class="filelist-wrapper" style="display: flex; flex-direction: column; height: 100%; width: 100%;">
        <ul class="toolbar" style="display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 8px; margin: 0; background: #252526;">
          <li><a alt="New file" href="#new-file" class="bx bx-file-plus"></a></li>
          <li><a alt="New folder" href="#new-folder" class="bx bx-folder-plus"></a></li>
          <li><a alt="Hidden files" href="#hidden" class="bx bx-eye-slash"></a></li>
          <li><a alt="Github link" href="#link" class="bx bx-link"></a></li>
          <li><a alt="Refresh list" href="#refresh" class="bx bx-refresh-cw"></a></li>
          <li class="setting" data-placeholder="Owner">
            <select name="owner" id="owner" style="min-width: 80px; background: #3c3c3c; color: #fff; border: 1px solid #555;">
              <option value="briancullinan2">briancullinan2</option>
              <option value="ec-">ec-</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Repository">
            <select name="repository" id="repository" style="min-width: 80px; background: #3c3c3c; color: #fff; border: 1px solid #555;">
              <option value="Quake3e">Quake3e</option>
              <option value="baseq3a">baseq3a</option>
              <option value="q3lcc">q3lcc</option>
              <option value="q3asm">q3asm</option>
              <option value="quedit">quedit</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Branch">
            <select name="branch" id="branch" style="min-width: 80px; background: #3c3c3c; color: #fff; border: 1px solid #555;">
              <option value="main">main</option>
              <option value="wasm-support">wasm-support</option>
              <option value="recent_updates">recent_updates</option>
            </select>
          </li>
        </ul>
        <div class="search-box" style="padding: 6px 8px; background: #2d2d2d;">
          <input type="text" id="search" name="search" placeholder="Search many..." style="width: 100%; background: #1e1e1e; color: #fff; border: 1px solid #555; padding: 4px;" />
        </div>
        <div id="${this.treeContainerId}" class="treejs-render-target" style="flex-grow: 1; overflow-y: auto; padding: 8px; background: #1e1e1e;"></div>
      </div>
    `;
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('#repository')?.addEventListener('change', () => this.onRepositoryChanged());
		this.node.querySelector('#branch')?.addEventListener('change', () => this.onRepositoryChanged());

		// Intercept row item selection inside the tree element
		this.node.querySelector(`#${this.treeContainerId}`)?.addEventListener('click', (e: Event) =>
		{
			const target = e.target as HTMLElement;
			const fileRow = target.closest('.treejs-node-label'); // Adjust class token to match your Tree.js output rows
			if(fileRow)
			{
				const filePath = fileRow.getAttribute('data-path') || fileRow.textContent?.trim();
				if(filePath && filePath.includes('.'))
				{
					this.dispatchFileActivation(filePath);
				}
			}
		});
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

		// Fetch and construct your flat file nodes array
		const treeData = await this.loadGitHubTree(owner, repo, branch);
		if(!treeData) return;

		// Build or update the structural TreeJS component
		targetTreeElement.innerHTML = ''; // Clear container bounds
		this.treeInstance = new Tree(targetTreeElement, {
			data: window.convertFlatToNested(Object.values(treeData)),
			autoOpen: false,
			closeDepth: 2,
		});
	}

	private async loadGitHubTree(owner: string, repo: string, branch: string): Promise<any>
	{
		const dbKey = `${owner}/${repo}`;
		try
		{
			// Assuming your global context utilities are loaded on the window space
			const treeData = await window.githubRequest(owner, repo, `git/trees/${branch}?recursive=1`);
			const commitData = await window.githubRequest(owner, repo, `commits/${branch}`);
			const buildDate = new Date(commitData.commit.author.date);

			this.filesCache[dbKey] = treeData.tree.reduce((obj: any, asset: any) =>
			{
				asset.timestamp = buildDate;
				obj[asset.path] = asset;
				return obj;
			}, {});

			return this.filesCache[dbKey];
		} catch(err)
		{
			console.error('Failed to fetch structural data stream from GitHub source:', err);
			return null;
		}
	}

	/**
	 * Router Dispatcher
	 * Automatically targets correct panel configurations depending on asset file extension types
	 */
	private dispatchFileActivation(filePath: string): void
	{
		const ext = filePath.split('.').pop()?.toLowerCase();
		let targetRoute = 'editor'; // Fallback text file baseline handler

		if(['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tga'].includes(ext ?? ''))
		{
			targetRoute = 'paint';
		} else if(['wav', 'mp3', 'ogg', 'mid'].includes(ext ?? ''))
		{
			targetRoute = 'audio-editor';
		}

		console.log(`Routing layout asset focus [${filePath}] down pathway: [${targetRoute}]`);

		window.triggerPanelRoute(targetRoute, window.mainDock);
	}

	protected onResize(msg: Widget.ResizeMessage): void
	{
		// Keeps internal lists and heights optimized inside Lumino constraints
		if(msg.height < 0 || msg.width < 0) return;
	}
}
