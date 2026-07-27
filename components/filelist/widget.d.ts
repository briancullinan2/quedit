import type { GitHubBranchLike } from "../bundle/github-settings";
import type { RepositoryToolbar } from "../bundle/menu-repos";
import type { Settings } from "../bundle/settings";
import type { GlobalToolbars, SettingsWindow } from '../bundle/menu.d';
import type { GithubWindow } from '../bundle/github.d';
import type { LocalWindow } from "../bundle/local.d";
import { FileListWidget, GameListWidget } from "./widget";

export interface EditorUtilities
{
	tempCount: number;
}

export interface FilelistWindow extends EditorUtilities, GlobalToolbars, SettingsWindow, GithubWindow, LocalWindow
{
	fileListWidgets?: Array<FileListWidget>;
	showDirectoryPicker?: (
		options?: DirectoryPickerOptions
	) => Promise<FileSystemDirectoryHandle>;
	FileListWidget: typeof FileListWidget;
	GameListWidget: typeof GameListWidget;
}

declare var self: Window & FilelistWindow & typeof globalThis;
