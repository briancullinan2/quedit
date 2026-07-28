import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import type { GitHubFileEntry } from "./github-types";
import type { TojiWidget } from '../map-loader/widget';
import type { GlobalToolbarsWindow } from "./menu.d";
import type { GithubWindow } from "./github.d";
import type { LuminoLayoutWindow } from "./lumino.d";

const menuSelf: GlobalToolbarsWindow & GithubWindow & LuminoLayoutWindow = self as unknown as any;


type EngineControl = {
	id: string;
	placeholder: string;
	name: string;
};

const ENGINE_CONTROLS: EngineControl[] = [
	{ id: 'spawn', placeholder: 'Spawn Point', name: 'spawn' },
	{ id: 'map', placeholder: 'Current Map', name: 'map' }
];

export const spawnPoints: Record<string, string> = {
	"": "Spawn point"
};
menuSelf.spawnPoints = spawnPoints;


export class EngineToolbar extends Widget
{
	private static _instance: EngineToolbar | null = null;
	private _commands: CommandRegistry | null = null;
	triedGithub: boolean = false;

	private constructor()
	{
		super();
		this.id = 'engine-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): EngineToolbar
	{
		if(!EngineToolbar._instance)
		{
			EngineToolbar._instance = new EngineToolbar();
			menuSelf.engineToolbar = EngineToolbar._instance;
		}
		return EngineToolbar._instance;
	}

	public initialize(commands: CommandRegistry): EngineToolbar
	{
		this._commands = commands;
		this._registerCommands();
		this._bindChangeListeners();
		return this;
	}


	public async tryGithubs()
	{
		if(this.triedGithub)
		{
			return;
		}
		this.triedGithub = true;
		const promises = menuSelf.FileManager?.getActiveRepositories().map(repoKey =>
		{
			const parts = repoKey.split('/');
			const ownerName = parts.length === 2 ? parts[0] : menuSelf.RepositoryToolbar?.owner?.value || '';
			const repoName = parts.length === 2 ? parts[1] : (parts[0] || menuSelf.RepositoryToolbar?.repository?.value || '');

			const promises = menuSelf.FileManager?.roots.map(async root =>
			{
				try
				{
					const jsonResponse = await menuSelf.githubRequest?.(ownerName, repoName, `contents/${root}`);
					if(jsonResponse instanceof Array)
					{
						const hasMaps = jsonResponse.find((r: GitHubFileEntry) => r.name === 'maps');
						if(hasMaps)
						{
							const treeData = await menuSelf.githubRequest?.(ownerName, repoName, `git/trees/${hasMaps.sha}?recursive=1`);
							for(let a of treeData.tree)
							{
								if(a.path.toLowerCase().includes('.map') || a.path.toLowerCase().includes('.bsp'))
								{
									if(menuSelf.mapFiles && !menuSelf.mapFiles[root + '/' + a.path])
									{
										menuSelf.mapFiles[root + '/' + a.path] = a.path.split('/').pop() || '';
									}
								}
							}
						}
					}
				} catch(e: any)
				{
					console.warn('Couldn\'t find maps on: ' + repoKey + '/' + root + '\n' + e.message + '\n' + (e.stack ?? e.stacktrace));
				}
			});
			return promises;
		}).flat();

		await Promise.all(promises ?? []);

		if(Object.keys(menuSelf.mapFiles ?? {}).length > 1)
		{
			menuSelf.updateSelectOptions?.('map', menuSelf.mapFiles ?? {}, '');
		}
	}


	// --- Dynamic Public API Setters ---
	public updateSpawns(spawns: { value: string; label: string; selected?: boolean; }[]): void
	{
		menuSelf.updateSelectOptions?.('spawn', spawns.reduce((obj, cur) =>
		{
			obj[cur.value] = cur.label;
			return obj;
		}, {}), spawns.find(s => s.selected)?.value ?? '');
	}

	public updateMaps(maps: { value: string; label: string; selected?: boolean; }[]): void
	{
		menuSelf.updateSelectOptions?.('map', maps.reduce((obj, cur) =>
		{
			obj[cur.value] = cur.label;
			return obj;
		}, {}), maps.find(s => s.selected)?.value ?? '');
	}

	private _registerCommands(): void
	{
		if(!this._commands) return;

		ENGINE_CONTROLS.forEach(control =>
		{
			const commandId = `engine-update-${control.id}`;
			if(!this._commands!.hasCommand(commandId))
			{
				this._commands!.addCommand(commandId, {
					label: `Update Engine ${control.placeholder}`,
					execute: async (args: any) =>
					{
						const currentWidget = Array.from(menuSelf.mainDock?.widgets() ?? []).find(w => w.constructor.name === 'TojiWidget') as TojiWidget;
						if(!currentWidget) return;

						if(control.id === 'spawn')
						{
							await currentWidget.enginePromise;
							currentWidget.respawnPlayer(args.value);
						}
						console.log(`Engine setting [${control.id}] updated to: ${args.value}`);
					}
				});
			}
		});
	}

	private _bindChangeListeners(): void
	{
		ENGINE_CONTROLS.forEach(control =>
		{
			const select = this.node.querySelector(`#${control.id}`);
			select?.addEventListener('input', () =>
			{
				const value = (select as HTMLSelectElement).value;
				this._commands?.execute(`engine-update-${control.id}`, { value });
			});
		});
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
			<ul class="engine">
				${ENGINE_CONTROLS.map(control => `
					<li placeholder="${control.placeholder}">
						<select required name="${control.name}" id="${control.id}">
							<option value="" selected disabled>${control.placeholder}</option>
						</select>
					</li>
				`).join('')}
			</ul>
        `;
	}
}

menuSelf.EngineToolbar = EngineToolbar;
