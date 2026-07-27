export interface GithubWindow
{
	githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
	loadGitHubTree: (repoOwner: string, repoName: string, branch: string, path?: string) => Promise<GitHubFileTree | undefined>;
	getBranches: (repoOwner: string | undefined, repoName: string | undefined) => Promise<GitHubBranch[]>;
	getDefaultBranch(ownerName: string, repo: string): Promise<string>;
	searchGitHubCode(query: string, activeRepositories: string[], token: string | null): Promise<any[]>;
	sortNodes(nodes: NestedTreeNode[]): NestedTreeNode[];
	trees: Record<string, any>;
	filesRepo: Record<string, GitHubFileTree | undefined>;
}
