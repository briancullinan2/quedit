
import JSZip from "jszip";
import { githubRequest, getDefaultBranch, getBranchVersion } from "./github-api";
import { getGitShaBrowser } from "./github-tools";
import { filesRepo, trees } from "./github-types";
import { config, dirs, FS, path } from "./global";
import { DB_STORE_NAME, FS_FILE, putRecord } from "./local";
import type { GithubWindow, ProgressFunction } from "./github.d";
import type { GlobalToolbarsWindow } from "./menu.d";

const githubSelf: GithubWindow & GlobalToolbarsWindow = self as unknown as any;

export async function downloadRepoZip(ownerName: string, repo: string, branch = 'master', database: string | null = null, onProgress?: ProgressFunction): Promise<string | undefined | null>
{
	const targetDatabase = database ?? `${ownerName}/${repo}`;

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');

	try
	{
		console.info(`Requesting archive from ${ownerName}/${repo}...`);

		const headers: HeadersInit = {
			'Accept': 'application/vnd.github+json'
		};

		if(token)
		{
			headers['Authorization'] = `Bearer ${token}`;
		}

		// 1. Fetch archive stream from GitHub API (follows redirects automatically)
		const response = await fetch(`https://api.github.com/repos/${ownerName}/${repo}/zipball/${branch}`, {
			headers
		});

		if(!response.ok)
		{
			throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
		}

		// 2. Extract total expected file size if present in response headers
		const contentLength = response.headers.get('Content-Length');
		const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

		// 3. Obtain stream reader from response body
		if(!response.body)
		{
			throw new Error('ReadableStream not supported on target response body.');
		}

		const reader = response.body.getReader();
		let receivedBytes = 0;

		const chunks: Uint8Array[] = [];

		// 4. Read data stream chunk-by-chunk
		while(true)
		{
			const { done, value } = await reader.read();

			if(done)
			{
				break;
			}

			chunks.push(value);
			receivedBytes += value.length;

			// Compute percentage if total size is supplied by host
			const percent = totalBytes > 0
				? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
				: 0;

			if(typeof onProgress === 'function')
			{
				onProgress({
					loaded: receivedBytes,
					total: totalBytes,
					percent
				});
			}
		}

		// 5. Concatenate binary chunks into unified Uint8Array buffer
		const buffer = new Uint8Array(receivedBytes);
		let position = 0;
		for(const chunk of chunks)
		{
			buffer.set(chunk, position);
			position += chunk.length;
		}

		const zipPath = path.join(config.MOUNT_DIR, `${branch}.zip`);
		const localPath = path.join(config.MOUNT_DIR, 'branch.zip');

		FS.virtual[zipPath] = {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: buffer,
			path: localPath,
			sha: await getGitShaBrowser(buffer),
			parent: localPath.substring(0, localPath.lastIndexOf('/'))
		};

		putRecord(DB_STORE_NAME, FS.virtual[zipPath], targetDatabase);
		console.info(`Downloaded ${buffer.byteLength} bytes. Processing...`);

		const zip = new JSZip();
		const contents = await zip.loadAsync(buffer);
		const unzipPromises: Promise<void>[] = [];

		contents.forEach((relativePath: string, file: any) =>
		{
			if(file.dir) return;

			unzipPromises.push(file.async('uint8array').then(async (data: Uint8Array) =>
			{
				const cleanedPath = relativePath.substring(relativePath.indexOf('/') + 1);
				const fullPath = path.join(targetDatabase, config.MOUNT_DIR, cleanedPath);
				const localPath = path.join(config.MOUNT_DIR, cleanedPath);

				FS.virtual[fullPath] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: data,
					path: localPath,
					sha: await getGitShaBrowser(data),
					parent: localPath.substring(0, localPath.lastIndexOf('/'))
				};

				return putRecord(DB_STORE_NAME, FS.virtual[fullPath], targetDatabase);
			}));
		});

		await Promise.all(unzipPromises);
		console.info("Repository successfully mounted to virtual FS.");

		return FS.virtual[zipPath].sha;
	} catch(err: any)
	{
		console.error(`Failed to download repo: ${err.message}`);
		throw err;
	}
}

export async function listReleases(ownerName: string, repo: string): Promise<any[]>
{
	try
	{
		const releases = await githubRequest(ownerName, repo, 'releases');

		releases.forEach((release: any) =>
		{
			console.info(`Release: ${release.name} (${release.tag_name})`);

			release.assets.forEach((asset: any) =>
			{
				console.info(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
			});
		});

		return releases;
	} catch(err)
	{
		console.error("Failed to list releases: " + err);
		return [];
	}
}


export
{
	getGitShaBrowser,
	getDefaultBranch,
	getBranchVersion,
	trees,
	filesRepo,
};
