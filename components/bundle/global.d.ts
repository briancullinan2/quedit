
import type { RepositoryToolbar } from './menu-repos';
import type { GitHubBranchLike } from './github-settings';
import type { SettingsToolbar } from './menu-settings';
import type JSZipImport from 'jszip';
import type { SearchService } from './lumino-search';

interface Window
{
	trees: Record<string, any>;
	filesRepo: Record<string, any>; // or GitHubFileTree | undefined
	mapFiles: Record<string, string>;
	SettingsManager: Settings;
	api: WorkerAPI;
	updateSelectOptions: (
		elementId: string | Element | undefined | null,
		items: Record<string, string> | Array<string | GitHubBranchLike>,
		selectedValue?: string
	) => void;
	DB_STORE_NAME: string;
	ST_DIR: number;
	ST_FILE: number;
	FS_FILE: number;
	FS_DIR: number;
	path: {
		join: (...parts: string[]) => string;
		resolve: (...parts: string[]) => string;
	};
	engineRepository?: string | undefined | null;
	gameRepository?: string | undefined | null;
	assetRepository?: string | undefined | null;
	toolsRepository?: string | undefined | null;
	tools2Repository?: string | undefined | null;
	environmentRepository?: string | undefined | null;
	getDefaultBranch(ownerName: string, repo: string): Promise<string>;
	loadGitHubTree: (repoOwner: string, repoName: string, branch: string, path?: string) => Promise<GitHubFileTree | undefined>;
	cacheFile: (storeName?: string, repoOwner?: string, repoName?: string, filePath?: string, sha?: string | null, forceReload?: boolean) => Promise<any>;
	deleteRecord(storeName: string, key: string, dbName: string | null): Promise<boolean>;
	searchGitHubCode(query: string, activeRepositories: string[], token: string | null): Promise<any[]>;
	FS: {
		virtual: Record<string, FileRecord | null | undefined>;
	};
	globToRegex(pattern: string, caseSensitive?: boolean): RegExp;
	RepositoryToolbar?: typeof RepositoryToolbar;
	SettingsToolbar?: typeof SettingsToolbar;
	JSZip: typeof JSZipImport;
	searchWorker: Worker;
	searchService: SearchService;
	DB_SCHEME: SchemaStoreConfig[];
}



export interface SchemaIndexConfig
{
	key: string;
	value: string;
}

export interface SchemaStoreConfig
{
	key: string;
	value: {
		item1: string; // keyPath
		item2: SchemaIndexConfig[]; // indexes
	};
}


// Also extend WorkerGlobalScope / globalThis so `self.trees` works cleanly
interface WorkerGlobalScope
{
	trees: Record<string, any>;
	filesRepo: Record<string, any>;
	mapFiles: Record<string, string>;
	path: {
		join: (...parts: string[]) => string;
		resolve: (...parts: string[]) => string;
	};
	FS: {
		virtual: Record<string, FileRecord | null | undefined>;
	};
	JSZip: typeof JSZipImport;
	searchService: SearchService;
	DB_SCHEME: SchemaStoreConfig[];
	importScripts: (...urls: (string | URL)[]) => void;
}

declare var self: Window & WorkerGlobalScope & typeof globalThis;
// global.d.ts

/** Options passed into the WorkerAPI constructor */
interface WorkerAPIOptions
{
	configuration?: 'release' | 'debug' | string;
	hostWrite?: (text: any, source?: any) => void;
	[key: string]: any;
}

/** Configuration/Repo options accepted by inject and worker execution methods */
interface WorkerCommandOptions
{
	configuration?: 'release' | 'debug' | string;
	database?: string | null;
	width?: number;
	github_token?: string;
	toolsRepo?: string | null;
	toolsRepo2?: string | null;
	engineRepo?: string | null;
	gameRepo?: string | null;
	assetRepo?: string | null;
	[key: string]: any;
}

/** Callback registry internal state */
interface ResponseCallback
{
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
	timeoutId: ReturnType<typeof setTimeout>;
}

declare class MockAPI
{
	github_token?: string | null;
}

declare class WorkerAPI extends MockAPI
{
	nextResponseId?: number;
	responseCBs?: Map<number, ResponseCallback>;
	worker?: Worker;
	port?: MessagePort;
	configuration: string;
	hostWrite?: (text: any, source?: any) => void;
	database?: string;
	width?: number;
	toolsRepo?: string;
	toolsRepo2?: string;
	engineRepo?: string;
	gameRepo?: string;
	assetRepo?: string;
	memfs?: any;
	ready?: boolean;

	constructor(options: WorkerAPIOptions);

	setShowTiming?: (value: boolean | any) => void;
	terminate?: () => void;
	inject?: (options: WorkerCommandOptions) => void;

	runAsync?: (id: string, options?: any) => Promise<any>;
	compileToAssembly(options?: WorkerCommandOptions): Promise<any>;
	compileTo6502(options?: WorkerCommandOptions): Promise<any>;
	upload(options?: WorkerCommandOptions): Promise<any>;
	download?: (options?: WorkerCommandOptions) => Promise<any>;
	header(owner: string, repo: string, header: any, database?: string): Promise<any>;
	compile(options?: WorkerCommandOptions): Promise<any>;
	build(database?: string, action?: string): Promise<any>;
	run(options?: WorkerCommandOptions): Promise<any>;
	link(options?: WorkerCommandOptions): Promise<any>;

	compileLinkRun(contents: string, width?: number): void;
	postCanvas?: (offscreenCanvas: OffscreenCanvas) => void;
	remove?: (filename: string) => Promise<any>;
	onmessage?: (event: MessageEvent) => void;
}


interface DirectoryPickerOptions
{
	/** An optional string identifier to remember the last opened directory */
	id?: string;
	/** Defaults to "read" for read-only access or "readwrite" for read/write access */
	mode?: 'read' | 'readwrite';
	/** A FileSystemHandle or a well-known directory name ("desktop", "documents", "downloads", "music", "pictures", "videos") */
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

declare global
{
	let api: WorkerAPI | undefined;
	let needsHeaders: boolean;
	let TERMINATE: boolean;

	interface Window
	{
		WorkerAPI: typeof WorkerAPI;
		api?: typeof api;
		detachedConsole?: boolean;
		runningWorker?: boolean | WorkerAPI;
		mostRecentTerminalCols?: number;
		previousHashLineNumber?: number | null;
		showDirectoryPicker(
			options?: DirectoryPickerOptions
		): Promise<FileSystemDirectoryHandle>;
		runEngine?: () => void;
		DB_SCHEME: SchemaStoreConfig[];
		importScripts: (...urls: (string | URL)[]) => void;
	}
	interface WorkerGlobalScope
	{
		api: WorkerAPI | MockAPI;
	}

	const terminalWrite: (message: string, source?: SourceMetadata | string, skipActualWrite?: boolean) => void;

	const SYS: any;
	const FILED: any;
	const updateGlobalBufferAndViews: () => void;
	const path: {
		join: (...parts: string[]) => string;
		resolve: (...parts: string[]) => string;
	};

	const FS: {
		virtual: Record<string, FileRecord | null | undefined>;
	};
	const JSZip: typeof JSZipImport;
	const importScripts: (...urls: (string | URL)[]) => void;
}

type SourceMetadata = [
	category: string,
	...trailingFilesAndFunc: string[],
	rawFileName: string,
	rawFilePath: string
];
