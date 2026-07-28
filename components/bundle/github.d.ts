import type { ApiWindow } from "../compiler/worker.d";
import type { NestedTreeNode } from "./github-tools";
import type { GitHubBranch, GitHubFileTree } from "./github-types";
import type { LocalWindow } from "./local.d";
import type { RepositorySettingsWindow } from "./menu.d";

export interface GithubWindow extends RepositorySettingsWindow, LocalWindow, ApiWindow
{
	githubRequest?: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
	loadGitHubTree?: (repoOwner: string, repoName: string, branch: string, path?: string) => Promise<GitHubFileTree | undefined>;
	getBranches?: (repoOwner: string | undefined, repoName: string | undefined) => Promise<GitHubBranch[]>;
	getDefaultBranch?: (ownerName: string, repo: string) => Promise<string>;
	searchGitHubCode?: (query: string, activeRepositories: string[], token: string | null) => Promise<any[]>;
	sortNodes?: (nodes: NestedTreeNode[]) => NestedTreeNode[];
	convertFlatToNested?: (data: FlatFileNode[]) => NestedTreeNode[];
	getGitShaBrowser?: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
	getAuthenticatedUser?: () => Promise<any>;

	cacheFile?: (
		storeName?: string,
		repoOwner?: string,
		repoName?: string,
		filePath?: string,
		sha?: string | null,
		forceReload?: boolean
	) => Promise<any>;

	// Direct IndexedDB / GitHub Worker Network Methods
	cacheFileInternal?: (
		storeName: string,
		repoOwner: string,
		repoName: string,
		localPath: string,
		sha?: string | null,
		forceReload?: boolean
	) => Promise<any>;

	trees?: Record<string, any>;
	filesRepo?: Record<string, GitHubFileTree | undefined>;
	mapFiles?: Record<string, string>;
	githubToken?: string;
}
