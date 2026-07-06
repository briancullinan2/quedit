

import { SettingsManager } from "../bundle/settings";
import { getDefaultBranch, githubRequest, loadGitHubTree } from "./github-api";
import { filesRepo, trees } from "./github-types";
import { config, dirs, FS, path } from "./global";
import
{
	DB_STORE_NAME, debounceRecords
	, FS_FILE, getRecord, putRecord
} from "./local";

declare const api: any;
declare const JSZip: any;
declare const Tree: any;

export async function getGitShaBrowser(content: string | Uint8Array | ArrayBuffer): Promise<string>
{
	const encoder = new TextEncoder();
	let contentBytes: Uint8Array;

	if(content instanceof Uint8Array)
	{
		contentBytes = content;
	} else if(content instanceof ArrayBuffer)
	{
		contentBytes = new Uint8Array(content);
	} else
	{
		contentBytes = encoder.encode(content);
	}

	const header = `blob ${contentBytes.byteLength}\0`;
	const headerBytes = encoder.encode(header);

	const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
	finalBytes.set(headerBytes);
	finalBytes.set(contentBytes, headerBytes.byteLength);

	const hashBuffer = await crypto.subtle.digest('SHA-1', finalBytes);

	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function cacheFile(repoOwner: string, repoName: string, filePath: string, sha: string, forceReload = false): Promise<any>
{
	return await debounceRecords(DB_STORE_NAME, 'path', filePath, sha, forceReload, `${repoOwner}/${repoName}`, 'cache');
}

export async function cacheFileInternal(repoOwner: string, repoName: string, filePath: string, sha: string, forceReload = false): Promise<any>
{
	const selected = `${repoOwner}/${repoName}`;
	try
	{
		if(!filesRepo[selected])
		{
			const branch = await getDefaultBranch(repoOwner, repoName);
			await loadGitHubTree(repoOwner, repoName, branch);
		}

		if(!FS.virtual[filePath]
			|| !FS.virtual[filePath].contents
			|| FS.virtual[filePath].contents.length === 0
		)
		{
			FS.virtual[filePath] = await getRecord(DB_STORE_NAME, filePath, selected);
		}

		if(filesRepo[selected][filePath] && FS.virtual[filePath])
		{
			if(FS.virtual[filePath].timestamp > filesRepo[selected][filePath].timestamp)
			{
				console.info(`Skipping changed (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			}
		}

		try
		{
			if(typeof api !== 'undefined' && api.memfs && FS.virtual[filePath] && !api.memfs.exists(filePath))
			{
				api.memfs.addFile(filePath, FS.virtual[filePath].contents);
			}
		} catch(e: any)
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(filePath.includes('tmp/')
			|| filePath.includes(dirs.ENGINE_RELEASE)
			|| filePath.includes(dirs.ENGINE_DEBUG))
		{
			if(FS.virtual[filePath])
			{
				console.info(`Already compiled (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			} else
			{
				console.info(`Skipping output (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return null;
			}
		}

		const shouldDownload = filesRepo[selected] && filesRepo[selected][filePath];

		if(!shouldDownload && FS.virtual[filePath])
		{
			if(filePath.includes('.syms'))
			{
				debugger;
				console.error('No you fucking dont: ' + filePath);
			}
			console.info(`Already have cached (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		}

		if(!shouldDownload)
		{
			console.info(`Skipping unimportant (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return null;
		}

		if(!forceReload && FS.virtual[filePath])
		{
			console.info(`Skipping important (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		} else
		{
			console.info(`Downloading important (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		}

		const jsonResponse = await githubRequest(repoOwner, repoName, `contents/${filePath}`);

		let bytes: Uint8Array;
		if(jsonResponse.encoding === 'base64')
		{
			const binString = atob(jsonResponse.content.replace(/\s/g, ''));
			bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
		} else
		{
			bytes = new TextEncoder().encode(jsonResponse.content || "");
		}

		FS.virtual[filePath] = {
			timestamp: filesRepo[selected][filePath].timestamp,
			mode: FS_FILE,
			contents: bytes,
			path: filePath,
			sha: jsonResponse.sha,
			parent: filePath.substring(0, filePath.lastIndexOf('/'))
		};

		await putRecord(DB_STORE_NAME, FS.virtual[filePath], selected);

		try
		{
			if(typeof api !== 'undefined' && api.memfs && !api.memfs.exists(filePath))
			{
				api.memfs.addFile(filePath, bytes);
			}
		} catch(e: any)
		{
			console.warn(`Memfs Error: ${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		console.info(`Downloaded fresh (${typeof api !== 'undefined' && api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		return bytes;
	} catch(e: any)
	{
		console.error(`Cache file error in ${filePath}`);
		if(!e.message.includes('HTTP_ERROR:'))
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(filesRepo[selected] && filesRepo[selected][filePath])
		{
			return filesRepo[selected][filePath].contents;
		}
		throw e;
	}
}




export async function loadFileTree(repoOwner: string, repoName: string, branch: string, selector: string): Promise<void>
{
	try
	{
		const database = `${repoOwner}/${repoName}`;
		filesRepo[selector] = await loadGitHubTree(repoOwner, repoName, branch);

		if(!filesRepo[selector]) return;

		trees[selector] = trees[database] = new Tree(selector, {
			data: convertFlatToNested(Object.values(filesRepo[selector])),
			autoOpen: false,
			closeDepth: 2,
		});
	} catch(error)
	{
		console.error('Failed to load file list tree:', error);
	}
}


export async function getAuthenticatedUser(): Promise<any>
{
	const token = SettingsManager.get('core', 'githubToken');
	if(!token) return null;

	try
	{
		const response = await fetch('https://api.github.com/user', {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if(response.status === 401)
		{
			console.error("Token is invalid or expired.");
			return null;
		}

		const userData = await response.json();
		console.info(`Authenticated as: ${userData.login}`);
		return userData;
	} catch(err)
	{
		console.error("Failed to fetch user data: " + err);
		return null;
	}
}



export interface FlatFileNode
{
	path: string;
	sha: string;
	type?: 'blob' | 'tree' | string;
	[key: string]: any;
}

export interface NestedTreeNode
{
	id: string;
	text: string;
	status: number;
	state: {
		open: boolean;
		expanded: boolean;
	};
	path: string;
	sha: string;
	children?: NestedTreeNode[];
}

export function convertFlatToNested(data: FlatFileNode[]): NestedTreeNode[]
{
	return data.reduce((acc: NestedTreeNode[], item: FlatFileNode) =>
	{
		const parts = item.path.split('/');
		let currentLevel = acc;

		parts.forEach((part, i) =>
		{
			let existingPath = currentLevel.find(node => node.text === part);

			if(!existingPath)
			{
				existingPath = {
					id: `${item.sha}`,
					text: part,
					status: 0,
					state: {
						open: false,
						expanded: false
					},
					path: item.path,
					sha: item.sha
				};

				if(i < parts.length - 1 || item.type === 'tree')
				{
					existingPath.children = [];
				}

				currentLevel.push(existingPath);
			}

			if(!existingPath.children)
			{
				return;
			}

			currentLevel = existingPath.children;
		});

		return sortNodes(acc);
	}, []);
};

export function sortNodes(nodes: NestedTreeNode[]): NestedTreeNode[]
{
	nodes.sort((a, b) =>
	{
		const aHasChildren = Array.isArray(a.children);
		const bHasChildren = Array.isArray(b.children);

		// 1. Sort by "Folder-ness" (directories up front)
		if(aHasChildren && !bHasChildren) return -1;
		if(!aHasChildren && bHasChildren) return 1;

		// 2. Then sort alphabetically by text
		return a.text.localeCompare(b.text);
	});

	// 3. Recurse into children
	nodes.forEach(node =>
	{
		if(node.children)
		{
			sortNodes(node.children);
		}
	});

	return nodes;
}


