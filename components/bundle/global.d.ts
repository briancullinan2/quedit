
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
