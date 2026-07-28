import type { GitHubBranchLike } from "../bundle/github-settings";
import type { RepositoryToolbar } from "../bundle/menu-repos";
import type { Settings } from "../bundle/settings";
import type { GlobalToolbars, GlobalToolbarsWindow, SettingsWindow } from '../bundle/menu.d';
import type { GithubWindow } from '../bundle/github.d';
import type { LocalWindow } from "../bundle/local.d";
import type { FileListWidget, GameListWidget } from "./widget";
import type { LuminoWindow } from '../bundle/lumino.d';
import type { ApiWindow } from "../compiler/worker.d";
import type { BuildWindow } from "../compiler/make.d";


type PermissionState = 'granted' | 'denied' | 'prompt';


interface FileSystemHandle extends FileSystemDirectoryHandle
{
	queryPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
	requestPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
}

export interface DirectoryPickerOptions
{
	/** An optional string identifier to remember the last opened directory */
	id?: string;
	/** Defaults to "read" for read-only access or "readwrite" for read/write access */
	mode?: 'read' | 'readwrite';
	/** A FileSystemHandle or a well-known directory name ("desktop", "documents", "downloads", "music", "pictures", "videos") */
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}


export interface FilelistWindow extends EditorUtilities, GlobalToolbars, SettingsWindow, GithubWindow, LocalWindow, LuminoWindow
{
	loadFileTree?: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
	fileListWidgets?: Array<FileListWidget>;
	showDirectoryPicker?: (
		options?: DirectoryPickerOptions
	) => Promise<FileSystemDirectoryHandle>;
	getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void;
	FileListWidget?: typeof FileListWidget;
	GameListWidget?: typeof GameListWidget;
}

declare var self: Window & FilelistWindow & typeof globalThis;

export interface GithubWorkerWindow extends ApiWindow, GithubWindow, GlobalToolbarsWindow, BuildWindow
{

}
