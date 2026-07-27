
import type { RepositoryToolbar } from './menu-repos';
import type { GitHubBranchLike } from './github-settings';

interface Window
{
	trees: Record<string, any>;
	filesRepo: Record<string, any>; // or GitHubFileTree | undefined
	mapFiles: Record<string, string>;
	SettingsManager: Settings;
	api: any;
	updateSelectOptions: (
		elementId: string | Element | undefined | null,
		items: Record<string, string> | Array<string | GitHubBranchLike>,
		selectedValue?: string
	) => void;
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
	cacheFile: (storeName?: string, repoOwner?: string, repoName?: string, filePath?: string, sha?: string, forceReload?: boolean) => Promise<any>;
	FS: {
		virtual: Record<string, FileRecord | null | undefined>;
	};
	RepositoryToolbar?: typeof RepositoryToolbar;
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
}

declare var self: Window & WorkerGlobalScope & typeof globalThis;

