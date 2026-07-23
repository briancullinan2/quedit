import type { NestedTreeNode } from '../bundle/github-tools';
import type { DatabaseMetadata, FileRecord } from '../bundle/local';
import { FileListWidget } from './widget';
import Tree from './tree.js';
import type { GitHubFileEntry, GitHubFileTree } from '../bundle/github-types';
import { Message } from '@lumino/messaging';



declare global
{
	interface Window
	{
		getDatabaseMetadata(): Promise<DatabaseMetadata[]>;
		sortNodes(nodes: NestedTreeNode[]): NestedTreeNode[];
		queryIndex(
			storeName: string,
			indexName: string,
			exactIndex: any,
			lower: any,
			upper: any,
			dbName: string | null,
			noBounce?: boolean
		): Promise<FileRecord[]>;
		filesRepo: Record<string, GitHubFileTree | undefined>;
		FS: {
			virtual: Record<string, FileRecord | null | undefined>;
		};
		DB_STORE_NAME: string;
		ST_DIR: number;
	}
}


export class DatabaseListWidget extends FileListWidget
{
	constructor(titleStr: string)
	{
		super(titleStr);
		//this.treeContainerId = 'database-' + Date.now();
	}

	protected override async initializeFiletrees(): Promise<void>
	{
		await this.showDatabases();
		this.bindMutationObserver();
	}

	/**
	 * Lazy load folders and render structural updates
	 */
	protected override async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
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

			if(database === 'Virtual Memory')
			{
				resultSet = window.FS?.virtual ?? {};
				resultKeys = Object.keys(window.FS?.virtual ?? {});
			} else
			{
				if(!window.filesRepo[database])
				{
					window.filesRepo[database] = {};
				}
				// Query both trailing-slash combinations safely
				const result = await window.queryIndex(window.DB_STORE_NAME, 'parent', baseDir, null, null, database);
				for(const r of result)
				{
					window.filesRepo[database][r.path] = window.FS.virtual[r.path] = r;
				}
				const result2 = await window.queryIndex(window.DB_STORE_NAME, 'parent', `${baseDir}/`, null, null, database);
				for(const r of result2)
				{
					window.filesRepo[database][r.path] = window.FS.virtual[r.path] = r;
				}
				const result3 = await window.queryIndex(window.DB_STORE_NAME, 'parent', `/${baseDir}`, null, null, database);
				for(const r of result3)
				{
					window.filesRepo[database][r.path] = window.FS.virtual[r.path] = r;
				}

				resultSet = Object.values(window.filesRepo[database]).reduce((acc: any, r: any) =>
				{
					acc[r.path] = r;
					return acc;
				}, {});
				resultKeys = Object.keys(resultSet);
			}

			// Isolate immediate children
			const childrenKeys = resultKeys.filter(path =>
			{
				const firstMatch = baseDir === '/' || baseDir === '' || path.startsWith(`${baseDir}/`)
					|| path.startsWith(`/${baseDir}/`);
				if(!firstMatch) return false;

				const relativePath = path.replace(/^[\/\\]|[\/\\]$/gi, '').substring(baseDir.length + 1);
				const slashIndex = relativePath.indexOf('/');
				return slashIndex === -1 || slashIndex === relativePath.length - 1;
			});

			// Construct lazy nodes
			const newChildren = childrenKeys.map(path =>
			{
				const node = resultSet[path];
				const isDir = (node.mode >> 12) & window.ST_DIR; // FS_DIR mock or standard directory mode mask
				const name = path.split('/').pop() || path;

				const newNode: NestedTreeNode = {
					id: database + (path.length === 0 || path[0] === '/' ? '' : '/') + path,
					text: name,
					path: path,
					parent: activeTree.nodesById[folderId],
					status: 0,
					state: { open: false, expanded: false },
					children: isDir ? [{ text: 'Loading...', id: `${path}/loading`, path: `${path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null
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
			console.error(`Failed to load tree node: ${err.message}`);
			this.loadedDatabases[folderId] = { text: 'Error loading files', id: 'err', path: 'err', status: 0, state: { open: false, expanded: false } } as NestedTreeNode;
		}

		await this.showDatabases(folderId);

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
	 * Re-evaluates metadata and patches the TreeJS instance
	 */
	private async showDatabases(folderId?: string): Promise<void>
	{
		const databases = await window.getDatabaseMetadata();
		const topDatabases: NestedTreeNode[] = [];

		for(const d of databases)
		{
			if(!this.loadedDatabases[d.key])
			{
				this.loadedDatabases[d.key] = {
					id: `${d.key}`,
					text: d.key,
					status: 0,
					state: { open: false, expanded: false },
					path: d.key,
					children: [{
						id: `${d.key}/loading`,
						text: 'Loading...',
						status: 0,
						state: { open: false, expanded: false },
						path: `${d.key}/loading`
					}]
				};
			}
			topDatabases.push(this.loadedDatabases[d.key]);
		}

		if(!this.loadedDatabases['Virtual Memory'])
		{
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

}
