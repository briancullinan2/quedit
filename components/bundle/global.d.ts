
import type { RepositoryToolbar } from './menu-repos';
import type { GitHubBranchLike } from './github-settings';
import type { SettingsToolbar } from './menu-settings';
import type JSZipImport from 'jszip';
import type { SearchService } from './lumino-search';


export interface MainThreadDOMExtensions
{
	// UI Toolbar & Lumino Component Constructors
	RepositoryToolbar?: typeof RepositoryToolbar;
	SettingsToolbar?: typeof SettingsToolbar;
	SettingsManager: Settings;

	// DOM Manipulation Helpers
	updateSelectOptions: (
		elementId: string | Element | undefined | null,
		items: Record<string, string> | Array<string | GitHubBranchLike>,
		selectedValue?: string
	) => void;

	// Active Workspace Selected Repositories (Used by Workspace Dropdowns)
	engineRepository?: string | null;
	gameRepository?: string | null;
	assetRepository?: string | null;
	toolsRepository?: string | null;
	tools2Repository?: string | null;
	environmentRepository?: string | null;

	// Background Threads & Singletons
	searchWorker: Worker;
	searchService: SearchService; // UI Service Dispatcher
}


export interface BuildSystemGlobals
{
	needsHeaders: boolean;
	TERMINATE: boolean;
	undefinedFlags: string[];
	includeFlags: string[];
	CFLAGS: string[];
	building?: boolean;
	buildDebounce?: ReturnType<typeof setTimeout> | undefined;
	api: WorkerAPI | undefined;
	downloadHeaders(headers: any, batchSize?: number, database?: string | null): Promise<void>;
}



export interface SharedVirtualFSExtensions
{
	SYS: any;
	FILED: any;
	updateGlobalBufferAndViews: () => void;

	// In-Memory File & Tree Cache Stores
	trees: Record<string, any>;
	filesRepo: Record<string, any>; // GitHub file tree cache
	mapFiles: Record<string, string>; // Flat path mappings

	// Virtual In-Memory FS Storage
	FS: {
		virtual: Record<string, FileRecord | null | undefined>;
	};

	// Shared Path Utility Polyfill
	path: {
		join: (...parts: string[]) => string;
		resolve: (...parts: string[]) => string;
	};
}


export interface WorkerContextExtensions
{
	// Worker API Constructor & Runtime Binding
	API: typeof WorkerAPI;
	api?: WorkerAPI | MockAPI;

	// Standard Worker Script Loader
	importScripts(...urls: (string | URL)[]): void;

	// Intercepted / Preserved Worker Console
	originalConsole: {
		log: typeof console.log;
		warn: typeof console.warn;
		error: typeof console.error;
		info: typeof console.info;
	};
}

export interface SharedDatabaseConstants
{
	DB_STORE_NAME: string;
	DB_SCHEME: SchemaStoreConfig[];

	// File System Mode Flags (Emscripten / POSIX Mode Mask Constants)
	ST_DIR: number;
	ST_FILE: number;
	FS_FILE: number;
	FS_DIR: number;
}


export interface SharedGitHubNetworkUtils
{
	githubToken?: string | null;
	getAuthenticatedUser(): Promise<any>;
	getDefaultBranch(ownerName: string, repo: string): Promise<string>;
	loadGitHubTree(repoOwner: string, repoName: string, branch: string, path?: string): Promise<GitHubFileTree | undefined>;
	searchGitHubCode(query: string, activeRepositories: string[], token: string | null): Promise<any[]>;
}


export interface SharedStoragePrimitives
{
	terminalWrite(message: string, source?: SourceMetadata | string, skipActualWrite?: boolean): void;

	cacheFile(
		storeName?: string,
		repoOwner?: string,
		repoName?: string,
		filePath?: string,
		sha?: string | null,
		forceReload?: boolean
	): Promise<any>;

	// Direct IndexedDB / GitHub Worker Network Methods
	cacheFileInternal(
		storeName: string,
		repoOwner: string,
		repoName: string,
		localPath: string,
		sha?: string | null,
		forceReload?: boolean
	): Promise<any>;

	deleteRecord(storeName: string, key: string, dbName: string | null): Promise<boolean>;
	globToRegex(pattern: string, caseSensitive?: boolean): RegExp;
	JSZip: typeof JSZipImport;
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
	github_token?: string | null;
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

export interface MockAPI
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
	github_token?: string | null;

	constructor(options: WorkerAPIOptions);

	setShowTiming?: (value: boolean | any) => void;
	terminate?: () => void;
	inject?: (options: WorkerCommandOptions) => void;

	runAsync?: (id: string, options?: any) => Promise<any>;
	compileToAssembly(options?: WorkerCommandOptions): Promise<any>;
	compileTo6502(options?: WorkerCommandOptions): Promise<any>;
	upload(options?: WorkerCommandOptions | string): Promise<any>;
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

declare API: typeof WorkerAPI;

declare global
{
	interface Window extends
		MainThreadDOMExtensions,
		SharedVirtualFSExtensions,
		SharedDatabaseConstants,
		SharedGitHubNetworkUtils,
		SharedStoragePrimitives { }

	interface WorkerGlobalScope extends
		WorkerContextExtensions,
		SharedVirtualFSExtensions,
		SharedDatabaseConstants,
		SharedGitHubNetworkUtils,
		SharedStoragePrimitives { }
}

type SourceMetadata = [
	category: string,
	...trailingFilesAndFunc: string[],
	rawFileName: string,
	rawFilePath: string
];
