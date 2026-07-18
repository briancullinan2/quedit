import { Message } from "@lumino/messaging";
import type { NestedTreeNode } from "../bundle/github-tools";
import { FileListWidget } from "./widget";
import Tree from './tree.js';


declare global
{
	interface Window
	{
		loadGitHubTree: (repoOwner: string, repoName: string, branch: string, path?: string) => Promise<any>;
	}
}


export class DatabaseListWidget extends FileListWidget
{
	private loadedDatabases: Record<string, NestedTreeNode> = {};
	private treeLoading = false;
	private refreshTreeTimer: any = null;
	private observer!: MutationObserver;

	protected override async initializeFiletrees(): Promise<void>
	{
		await this.showDatabases();
		this.bindMutationObserver();
	}


	protected override get defaultRepository()
	{
		return window.SettingsManager.get('github', 'assetRepository');
	}


	/**
	 * Sets up MutationObserver to intercept class toggles on folder expansion.
	 */
	private bindMutationObserver(): void
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

	/**
	 * Lazy load folders and render structural updates
	 */
	private async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(this.treeLoading) return;
		if(folderId.endsWith('[Recursive]')) return;

		const activeTree = window.trees[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		const parts = folderId.split('/');
		const database = folderId.startsWith('Virtual Memory') ? 'Virtual Memory' : `${parts[0]}/${parts[1]}`;
		const baseDir = folderId.startsWith('Virtual Memory') ? parts.slice(1).join('/') : parts.slice(2).join('/');
		const dirPath = baseDir.substring(0, baseDir.lastIndexOf('/'));
		const parentDir = database + (dirPath.trim().length > 0 ? `/${dirPath}` : '');

		try
		{
			this.treeLoading = true;

			let resultSet: Record<string, any> = {};
			let resultKeys: string[] = [];

			// TODO: load the next level from loadGitHubTree(path = baseDir)

		} catch(err: any)
		{
			console.error(`Failed to load tree node: ${err.message}`);
			this.loadedDatabases[folderId] = { text: 'Error loading files', id: 'err', path: 'err', status: 0, state: { open: false, expanded: false } } as NestedTreeNode;
		}

		await this.showDatabases(folderId);

		if(this.refreshTreeTimer)
		{
			clearTimeout(this.refreshTreeTimer);
		}
	}


	/**
	 * Re-evaluates metadata and patches the TreeJS instance
	 */
	private async showDatabases(folderId?: string): Promise<void>
	{
		const topDatabases: NestedTreeNode[] = [];

		if(!this.loadedDatabases['Virtual Memory'])
		{
			// TODO: replace with call to loadGitHubTree(path = '/')
			this.loadedDatabases['Virtual Memory'] = {
				id: 'Virtual Memory',
				text: 'Virtual Memory',
				status: 0,
				state: { open: false, expanded: false },
				path: 'Virtual Memory',
				children: [{
					id: 'Virtual Memory/loading',
					text: 'Loading...',
					status: 0,
					state: { open: false, expanded: false },
					path: 'Virtual Memory/loading'
				}]
			};
		}
		topDatabases.push(this.loadedDatabases['Virtual Memory']);

		const activeTree = window.trees[this.selector];
		if(!activeTree)
		{
			window.trees[this.selector] = new Tree(this.selector, {
				data: topDatabases,
				autoOpen: false,
				closeDepth: null
			});
		} else if(folderId)
		{
			activeTree.options.data = topDatabases;
			activeTree.renderPartial(folderId);
		}
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


