import { FileRecord } from "./local";

export interface GitHubFileTree
{
	[key: string]: GitHubFileEntry;
}


export interface GitHubFileEntry extends FileRecord
{
	name?: string;
	type?: 'file' | 'dir';
	size?: number | undefined;
}

export interface GitHubBranch
{
	name: string;
	commit: {
		sha: string;
		url: string;
		commit: {
			author: {
				name: string;
				email: string;
				date: string;
			};
			committer: {
				name: string;
				email: string;
				date: string;
			};
			message: string;
		};
	};
	[key: string]: any;
}

export interface GitHubReleaseAsset
{
	name: string;
	browser_download_url: string;
	[key: string]: any;
}

export interface GitHubRelease
{
	name: string;
	tag_name: string;
	assets: GitHubReleaseAsset[];
	[key: string]: any;
}

export interface GitHubUser
{
	login: string;
	id: number;
	avatar_url: string;
	name: string | null;
	[key: string]: any;
}

export interface GitHubRepository
{
	id: number;
	name: string;
	full_name: string;
	owner: GitHubUser;
	[key: string]: any;
}

export interface GitHubCodeSearchResult
{
	path: string;
	sha: string;
	repoSource: string;
	matchText: string;
	isRemote: true;
}

// --- State Repositories ---
export const defaultBranches: Record<string, string> = {};
export const mapFiles: Record<string, string> = {
	"": "Current map"
};
window.mapFiles = mapFiles;

export const trees: Record<string, any> = {};
export const filesRepo: Record<string, GitHubFileTree | undefined> = {};


declare global
{
	interface Window
	{
		trees: Record<string, any>;
		filesRepo: Record<string, GitHubFileTree | undefined>;
		mapFiles: Record<string, string>;
	}
}

window.trees = trees;
window.filesRepo = filesRepo;
