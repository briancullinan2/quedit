
import type { WorkerAPI } from './global.d';

export interface SearchMatchItem
{
	path: string;
	repoSource: string;
	isRemote?: boolean;
	line?: number;
	matchText: string;
	matchIndex?: number;
	matchLength?: number;
	sha?: string;
}

export interface GroupedSearchResult
{
	path: string;
	repo: string;
	localMatches: SearchMatchItem[];
	remoteMatches: SearchMatchItem[];
}

export interface SearchTransactionState
{
	paths: SearchMatchItem[];
	contents: SearchMatchItem[];
	github: SearchMatchItem[];
	onProgress?: (results: GroupedSearchResult[]) => void;
	resolve?: (results: GroupedSearchResult[]) => void;
	reject?: (error: Error) => void;
}

export interface SearchParams
{
	query: string;
	caseSensitive?: boolean;
	activeRepositories?: string[];
	gitHubToken?: string;
}

declare global
{
	interface Window
	{
		searchWorker?: Worker;
		engineRepository?: string | null;
		gameRepository?: string | null;
		assetRepository?: string | null;
		toolsRepository?: string | null;
		tools2Repository?: string | null;
		environmentRepository?: string | null;
		api?: WorkerAPI;
		SearchService: typeof SearchService;
		searchService: SearchService;
	}
}

export class SearchService
{
	private worker: Worker | null = null;
	private transactions = new Map<string, SearchTransactionState>();
	private requestCounter = 0;

	constructor()
	{
		this.initWorker();
	}

	private initWorker(): void
	{
		if(typeof window === 'undefined') return;

		if(!window.searchWorker)
		{
			window.searchWorker = new Worker('/components/filelist/search-worker.js');
		}
		this.worker = window.searchWorker;
		this.worker.onmessage = this.handleWorkerMessage.bind(this);
	}

	private handleWorkerMessage(e: MessageEvent): void
	{
		const { type, results, callbackId, query } = e.data;
		if(!callbackId) return;

		const txn = this.transactions.get(callbackId);

		if(type === 'clear')
		{
			if(txn)
			{
				if(txn.onProgress) txn.onProgress([]);
				if(txn.resolve) txn.resolve([]);
				this.transactions.delete(callbackId);
			}
			return;
		}

		if(!txn) return;

		// Store intermediate responses by channel (paths, contents, github, etc.)
		if(type in txn)
		{
			(txn as any)[type] = results || [];
		}

		const aggregatedMatches = [...txn.paths, ...txn.contents, ...txn.github];
		const grouped = this.groupSearchMatches(aggregatedMatches);

		if(txn.onProgress)
		{
			txn.onProgress(grouped);
		}
	}

	public search(
		params: SearchParams,
		onProgress?: (results: GroupedSearchResult[]) => void,
		callbackIdPrefix: string = 'req'
	): { callbackId: string; promise: Promise<GroupedSearchResult[]>; }
	{
		if(!this.worker)
		{
			this.initWorker();
		}

		const callbackId = `${callbackIdPrefix}-${++this.requestCounter}-${Date.now()}`;

		const activeRepositories = params.activeRepositories || [
			window.engineRepository,
			window.gameRepository,
			window.assetRepository,
			window.toolsRepository,
			window.tools2Repository,
			window.environmentRepository
		].filter(Boolean) as string[];

		const gitHubToken = params.gitHubToken || localStorage.getItem('github_token') || window.api?.github_token || '';

		let resolveFn!: (results: GroupedSearchResult[]) => void;
		let rejectFn!: (error: Error) => void;

		const promise = new Promise<GroupedSearchResult[]>((resolve, reject) =>
		{
			resolveFn = resolve;
			rejectFn = reject;
		});

		this.transactions.set(callbackId, {
			paths: [],
			contents: [],
			github: [],
			onProgress,
			resolve: resolveFn,
			reject: rejectFn
		});

		this.worker?.postMessage({
			callbackId,
			query: params.query,
			caseSensitive: params.caseSensitive ?? false,
			gitHubToken,
			activeRepositories
		});

		return { callbackId, promise };
	}

	public cancelSearch(callbackId: string): void
	{
		if(!this.transactions.has(callbackId)) return;

		this.worker?.postMessage({
			callbackId,
			type: 'cancel'
		});

		const txn = this.transactions.get(callbackId);
		if(txn?.resolve)
		{
			txn.resolve([]);
		}
		this.transactions.delete(callbackId);
	}

	public groupSearchMatches(matches: SearchMatchItem[]): GroupedSearchResult[]
	{
		const groupedMap = new Map<string, GroupedSearchResult>();

		matches.forEach(item =>
		{
			const key = `${item.repoSource}:${item.path}`;
			if(!groupedMap.has(key))
			{
				groupedMap.set(key, {
					path: item.path,
					repo: item.repoSource,
					localMatches: [],
					remoteMatches: []
				});
			}

			const group = groupedMap.get(key)!;
			if(item.isRemote)
			{
				group.remoteMatches.push(item);
			} else if(!group.localMatches.some(l => l.line === item.line && l.matchText === item.matchText))
			{
				group.localMatches.push(item);
			}
		});

		return Array.from(groupedMap.values());
	}
}

export const searchService = new SearchService();
window.searchService = searchService;
