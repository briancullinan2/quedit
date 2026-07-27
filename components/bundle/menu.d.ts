import { GitHubBranchLike } from "./github-settings";
import { RepositoryToolbar } from "./menu-repos";
import { Settings } from "./settings";

export interface SettingsWindow
{
	updateSelectOptions: (
		elementId: string | Element | undefined | null,
		items: Record<string, string> | Array<string | GitHubBranchLike>,
		selectedValue?: string
	) => void;
	addRepoIfNotExists(newRepo: string): void;
	addOwnerIfNotExists(newOwner: string): void;
}

export interface GlobalToolbars
{
	SettingsManager: Settings;
	RepositoryToolbar: typeof RepositoryToolbar;
}

