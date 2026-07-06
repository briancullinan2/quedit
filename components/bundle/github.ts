
import { SettingsManager } from "../bundle/settings";
import { githubRequest, getDefaultBranch, getBranchVersion } from "./github-api";
import { getGitShaBrowser } from "./github-tools";
import { config, dirs, FS, path } from "./global";
import { DB_STORE_NAME, FS_FILE, putRecord } from "./local";

declare const api: any;
declare const JSZip: any;
declare const Tree: any;

export async function downloadRepoZip(ownerName: string, repo: string, branch = 'master', database: string | null = null): Promise<void>
{
	const targetDatabase = database || `${ownerName}/${repo}`;

	try
	{
		console.info(`Requesting archive from ${ownerName}/${repo}...`);

		const buffer = await githubRequest(ownerName, repo, `zipball/${branch}`, true, true);
		const zipPath = path.join(config.MOUNT_DIR, 'branch.zip');

		FS.virtual[zipPath] = {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: buffer,
			path: zipPath,
			sha: await getGitShaBrowser(buffer),
			parent: zipPath.substring(0, zipPath.lastIndexOf('/'))
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
				const fullPath = path.join(config.MOUNT_DIR, cleanedPath);

				FS.virtual[fullPath] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: data,
					path: fullPath,
					sha: await getGitShaBrowser(data),
					parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
				};

				putRecord(DB_STORE_NAME, FS.virtual[fullPath], targetDatabase);
			}));
		});

		await Promise.all(unzipPromises);
		console.info("Repository successfully mounted to virtual FS.");
	} catch(err: any)
	{
		console.error(`Failed to download repo: ${err.message}`);
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
	getBranchVersion
};
