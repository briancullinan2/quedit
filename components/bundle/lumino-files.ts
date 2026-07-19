import { getDefaultBranch, loadGitHubTree } from "./github-api";
import { cacheFile } from "./github-tools";
import { filesRepo, trees } from "./github-types";
import { FS } from "./global";
import { DB_STORE_NAME, FileRecord, getDatabaseMetadata, getRecord } from "./local";
import type { HistoryToolbar } from "./menu-history";
import { AssetInspector, hasSequentialBinaryRegex, hexDump } from "../rosetta/binary.mjs";
import type { DockPanel } from "@lumino/widgets";
import type { AceEditorWidget } from "../editor/widget";


export interface DatabaseMetadata
{
	key: string;
	[key: string]: any;
}

export interface PathCandidate
{
	testPath: string;
	line: number | null;
}

export type ResolvedLocationTuple = [
	resolvedLocation: string | null,
	repositoryKey: string | null,
	fileNode: FileRecord | null,
	lineNumber: number | null
];

export interface FilePayload
{
	content: ArrayBuffer;
	sampleBytes: Uint8Array;
	sampleStr: string;
	isImageFile: boolean;
	isMapFile: boolean;
	outputString: string;
}

// Global type declarations for window variables and side-effects
declare global
{
	interface Window
	{
		engineRepository?: string | undefined | null;
		gameRepository?: string;
		assetRepository?: string;
		toolsRepository?: string;
		tools2Repository?: string;
		environmentRepository?: string;
		owner?: { value: string; };
		repository?: { value: string; };
		writeLog?: (message: string) => void;
		FileManager: typeof FileManager;
		resizeHandler: () => void;
		historyToolbar: HistoryToolbar;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
		mainDock: DockPanel;
		AceEditorWidget: typeof AceEditorWidget;
	}
}



export class FileManager
{
	private static readonly roots: string[] = ['', 'demoq3/pak0.pk3dir', 'docs/demoq3/pak0.pk3dir'];

	/**
	 * High-level workspace resolver. Ingests raw window paths, hashes, or explicit links,
	 * extracts line numbers, runs prefix multiplexing, scans active VFS/IDB spaces,
	 * and maps the request to a final active file node.
	 */
	public static async findFileTestPath(hintPath?: string): Promise<ResolvedLocationTuple>
	{
		const candidates = this.extractCandidates(hintPath);
		if(candidates.length === 0)
		{
			console.log(`[VFS Lookup Failed] File: ${hintPath}`);
			return [null, null, null, null];
		}

		const activeRepositories = this.getActiveRepositories();

		for(const item of candidates)
		{
			const currentPath = item.testPath;

			// LAYER A: Check Memory-Cached Repositories
			const memoryResult = await this.checkMemoryRepositories(currentPath, activeRepositories);
			if(memoryResult)
			{
				console.log(`[VFS Resolved Memory] File: ${currentPath} | Line: ${item.line}`);
				return [currentPath, memoryResult.repoKey, memoryResult.fileNode, item.line];
			}

			// LAYER B: Check Client IndexedDB Database Contexts
			const dbResult = await this.checkIndexedDatabases(currentPath);
			if(dbResult)
			{
				console.log(`[VFS Resolved IndexedDB] File: ${currentPath} | Line: ${item.line}`);
				return [currentPath, dbResult.dbKey, dbResult.fileNode, item.line];
			}
		}

		console.log(`[VFS Lookup Failed] File: ${hintPath}\nTried:\n${candidates.map(c => c.testPath).join('\n')}\n${activeRepositories.join('\n')}`);
		return [null, null, null, null];
	}

	/**
	 * Extracts path and line candidates based on parameters and environment states
	 */
	private static extractCandidates(hintPath?: string): PathCandidate[]
	{
		const rawPathCandidates = [
			hintPath,
			window.location?.hash?.substring(1),
			window.location?.pathname?.substring(1)
		].filter((loc): loc is string => typeof loc === 'string' && loc.trim().length > 0);

		return rawPathCandidates.flatMap((rawCandidate) =>
		{
			const hasColon = rawCandidate.includes(':');
			const cleanPathPart = hasColon ? rawCandidate.split(':')[0] : rawCandidate;
			const extractedLine = hasColon ? parseInt(rawCandidate.split(':').pop() || '', 10) : null;
			const line = isNaN(extractedLine as number) ? null : extractedLine;

			return this.roots.map((root) =>
			{
				const delimiter = root.length > 0 && !root.endsWith('/') ? '/' : '';
				return {
					testPath: root + delimiter + cleanPathPart,
					line
				};
			});
		});
	}

	/**
	 * Extracts active repository strings from window context
	 */
	private static getActiveRepositories(): string[]
	{
		return [
			window.engineRepository,
			window.gameRepository,
			window.assetRepository,
			window.toolsRepository,
			window.tools2Repository,
			window.environmentRepository
		].filter((repo): repo is string => typeof repo === 'string' && repo.length > 0);
	}

	/**
	 * Evaluates Layer A (In-memory / Github Tree layers)
	 */
	private static async checkMemoryRepositories(
		currentPath: string,
		repositories: string[]
	): Promise<{ repoKey: string; fileNode: FileRecord; } | null>
	{
		for(const repoKey of repositories)
		{
			if(!filesRepo[repoKey])
			{
				const parts = repoKey.split('/');
				const ownerName = parts.length === 2 ? parts[0] : window.owner?.value || '';
				const repoName = parts.length === 2 ? parts[1] : (parts[0] || window.repository?.value || '');

				try
				{
					const branch = await getDefaultBranch(ownerName, repoName);
					await loadGitHubTree(ownerName, repoName, branch);
				} catch(err)
				{
					console.warn(`Dynamic tree resolve failure for: ${repoKey}`, err);
					continue;
				}
			}

			if(filesRepo[repoKey] && filesRepo[repoKey][currentPath])
			{
				const fileNode = filesRepo[repoKey][currentPath];
				if(trees[repoKey])
				{
					trees[repoKey].values = fileNode.sha ? [fileNode.sha] : [];
				}
				return { repoKey, fileNode };
			}
		}
		return null;
	}

	/**
	 * Evaluates Layer B (IndexedDB fallback storage context)
	 */
	private static async checkIndexedDatabases(
		currentPath: string
	): Promise<{ dbKey: string; fileNode: FileRecord; } | null>
	{
		const databases = await getDatabaseMetadata();

		for(const dbMeta of databases)
		{
			const testFileKey = `${dbMeta.key}/${currentPath}`;
			try
			{
				// Check local runtime index cache first
				if(trees['#database']?.nodesById?.[testFileKey])
				{
					const fileNode = trees['#database'].nodesById[testFileKey];
					this.updateDatabaseTreeValues(dbMeta.key);
					return { dbKey: dbMeta.key, fileNode };
				}

				// Fallback to indexed lookup query
				const record = await getRecord(DB_STORE_NAME, currentPath, dbMeta.key);
				if(record)
				{
					if(trees['#database'])
					{
						if(!trees['#database'].nodesById)
						{
							trees['#database'].nodesById = {};
						}
						trees['#database'].nodesById[testFileKey] = record;
					}
					FS.virtual[currentPath] = record;
					this.updateDatabaseTreeValues(dbMeta.key);
					return { dbKey: dbMeta.key, fileNode: record };
				}
			} catch(e)
			{
				console.error(e);
			}
		}
		return null;
	}

	/**
	 * Cleaned secondary update mutation for application engine side-effects
	 */
	private static updateDatabaseTreeValues(dbKey: string): void
	{
		if(trees['#database'])
		{
			trees['#database'].values = [dbKey];
		}
	}


	private openFileDebounce: ReturnType<typeof setTimeout> | null = null;
	private latestOpenRequest: (() => void) | null = null;

	/**
	 * CORE ORCHESTRATOR
	 * Controls the high-level life cycle of opening a file target.
	 */
	public async openFile(
		repoOwner: string,
		repoName: string,
		filePath: string,
		sha: string,
		recordHistory: boolean = true,
		hidePanels: boolean = true,
		noBounce: boolean = false
	): Promise<void>
	{
		// Phase 1: Bounce Protection
		if(this.handleDebounce(repoOwner, repoName, filePath, sha, recordHistory, hidePanels, noBounce))
		{
			return;
		}

		// Phase 2: Ingestion (Cache Ring & Network Layer)
		const content = await this.ingestFileContent(repoOwner, repoName, filePath, sha);
		if(!content) return;

		// Phase 3: Binary Inspection & Content Parsing
		const payload = await this.analyzeAndParsePayload(content, filePath);

		// Phase 4: Dynamic Asset/Plugin Engine Bootstrapping
		await this.bootstrapVisualEngines(payload, filePath);

		// Phase 6: Core UI / DOM Terminal Routing
		this.updateUIVisibility(payload, filePath);

		// Phase 7: Post-render Updates
		window.resizeHandler();
		if(recordHistory)
		{
			window.historyToolbar.recordFileHistory(filePath, sha);
		}
	}

	/**
	 * PHASE 1: Debounce Controller
	 * Captures incoming rapid-fire operations to protect the engine thread.
	 */
	private handleDebounce(
		owner: string, repo: string, path: string, sha: string,
		history: boolean, panels: boolean, noBounce: boolean
	): boolean
	{
		this.latestOpenRequest = () =>
		{
			this.openFile(owner, repo, path, sha, history, panels, true);
		};

		if(!noBounce && this.openFileDebounce) return true;

		if(!noBounce)
		{
			this.openFileDebounce = setTimeout(() =>
			{
				if(this.latestOpenRequest) this.latestOpenRequest();
				this.openFileDebounce = null;
			}, 400);
			return true;
		}

		return false;
	}


	/**
	 * PHASE 2: Ingestion Layer
	 * Tries memory caches first, falling back to a cascading network check.
	 */
	private async ingestFileContent(owner: string, repo: string, path: string, sha: string): Promise<ArrayBuffer | null>
	{
		let content = await cacheFile(owner, repo, path, sha, true);
		if(content && content.byteLength > 0)
		{
			return content;
		}

		const urls = [
			path,
			`https://quake.games/${path}`,
			`https://quake.games/${path.replace('docs/', '')}`
		];

		for(const url of urls)
		{
			try
			{
				const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
				if(response.ok)
				{
					const buf = await response.arrayBuffer();
					if(buf.byteLength > 0) return buf;
				}
			} catch
			{
				// Silent pass to next location hook
			}
		}
		return null;
	}


	/**
	 * PHASE 3: Payload Processing Engine
	 * Inspects magic numbers/heuristics and parses buffer payloads into strings.
	 */
	private async analyzeAndParsePayload(content: ArrayBuffer, filePath: string): Promise<FilePayload>
	{
		const byteView = new Uint8Array(content);
		const sampleBytes = byteView.subarray(0, 8192);
		const decoder = new TextDecoder();
		const sampleStr = decoder.decode(sampleBytes);

		const isImageFile = AssetInspector.isActuallyImage(sampleBytes, filePath);
		const isMapFile = AssetInspector.isActuallyMap(sampleBytes, filePath);

		let outputString = "";

		if(isImageFile)
		{
			outputString = "[Binary Image Layer Inserted]";
		} else if(isMapFile)
		{
			//TODO: await openMap(content, filePath, sampleBytes);
			outputString = hexDump(sampleBytes, content, filePath);
		} else if(hasSequentialBinaryRegex.test(sampleStr))
		{
			outputString = hexDump(sampleBytes, content, filePath);
		} else
		{
			outputString = decoder.decode(content);
		}

		return { content, sampleBytes, sampleStr, isImageFile, isMapFile, outputString };
	}

	/**
	 * PHASE 4: Visual Bootstrapper
	 * Dynamically pulls asset runtime dependencies on-demand.
	 */
	private async bootstrapVisualEngines(payload: FilePayload, filePath: string): Promise<void>
	{
		if(payload.isImageFile)
		{
			await window.triggerPanelRoute('paint', window.mainDock);

			// TODO: openImage(payload.content, filePath);
		} else
		{
			await window.triggerPanelRoute('editor', window.mainDock);
		}
	}

	/**
	 * PHASE 6: UI Render Routing
	 * Directs prepared states to the DOM nodes.
	 */
	private updateUIVisibility(payload: FilePayload, filePath: string): void
	{
		const viewportWrapper = document.getElementById('viewport-frame');

		if(payload.isImageFile)
		{

		} else if(typeof window.AceEditorWidget !== 'undefined')
		{
			window.AceEditorWidget.openFileInNewTab(filePath, filePath, payload.outputString);
		}
	}
}

window.FileManager = FileManager;

