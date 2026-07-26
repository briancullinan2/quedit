import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { RepositoryToolbar } from "./menu-repos";
import { triggerPanelRoute } from "./menu";


declare global
{
	interface Window
	{
		scriptToolbar: ScriptToolbar;
		ScriptToolbar: typeof ScriptToolbar;
		RepositoryToolbar: typeof RepositoryToolbar;
		BUILD_SCRIPTS: string[];
		buildTools: (database?: string | null) => Promise<void>;
		buildQVM: (database?: string | null) => Promise<void>;
		buildClient: (database?: string | null) => Promise<void>;
		engineRepository?: string | undefined | null;
		gameRepository?: string | undefined | null;
		assetRepository?: string | undefined | null;
		toolsRepository?: string | undefined | null;
		tools2Repository?: string | undefined | null;
		environmentRepository?: string | undefined | null;
		TERMINATE: boolean;
	}
}


const BUILD_SCRIPTS = [
	'/components/compiler/compiler.js',
	'/components/compiler/shared.js',
	'/components/engine/sys_fs.js',
	'/components/compiler/make.js',
	'/components/compiler/make-tools.js',
	'/components/compiler/make-qvm.js',
];

window.BUILD_SCRIPTS = BUILD_SCRIPTS;

export class ScriptToolbar extends Widget
{
	private static _instance: ScriptToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'script-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): ScriptToolbar
	{
		if(!ScriptToolbar._instance)
		{
			ScriptToolbar._instance = new ScriptToolbar();
			window.scriptToolbar = ScriptToolbar._instance;
		}
		return ScriptToolbar._instance;
	}

	public initialize(commands: CommandRegistry): ScriptToolbar
	{
		this._commands = commands;
		this._registerCommands();
		return this;
	}


	private _registerCommands()
	{
		if(!this._commands)
		{
			return;
		}

		if(!this._commands.hasCommand('script-compile'))
		{
			this._commands.addCommand('script-compile', {
				label: 'Compile Script',
				iconClass: 'bx bx-code',
				execute: async () =>
				{
					for(let src of window.BUILD_SCRIPTS)
					{
						await window.loadScript(src);
					}
					window.TERMINATE = false;
					const configuration = document.getElementById('configuration') as HTMLSelectElement;
					if(configuration.value === 'tools') await window.buildTools(window.toolsRepository);
					else if(configuration.value === 'qvms') await window.buildQVM(window.gameRepository);
					else await window.buildClient(window.engineRepository);

				}
			});
		}

		if(!this._commands.hasCommand('script-play'))
		{
			this._commands.addCommand('script-play', {
				label: 'Play Script',
				iconClass: 'bx bx-play',
				execute: async () =>
				{
					//const ownerSelect = RepositoryToolbar.owner;
					//const repoSelect = RepositoryToolbar.repository;
					//console.log(`Starting script execution for targets: ${ownerSelect?.value}/${repoSelect?.value}`);
					await triggerPanelRoute('viewport-frame', window.mainDock);
				}
			});
		}

		if(!this._commands.hasCommand('script-stop'))
		{
			this._commands.addCommand('script-stop', {
				label: 'Stop Script',
				iconClass: 'bx bx-stop',
				execute: () =>
				{
					console.log('Halting script execution.');
				}
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="top-bar-btn-compile" title="Compile Script" class="bx bx-code"></button>
            <button id="top-bar-btn-play" title="Play Script" class="bx bx-play"></button>
            <button id="top-bar-btn-pause" title="Pause Script" class="bx bx-pause"></button>
            <button id="top-bar-btn-stop" title="Stop Script" class="bx bx-stop"></button>
            <button id="top-bar-btn-reload" title="Reload Engine" class="bx bx-refresh-cw-alt"></button>
        `;

		this.node.querySelector('#top-bar-btn-compile')?.addEventListener('click', () =>
		{
			if(this._commands)
			{
				this._commands.execute('script-compile');
			}
		});

		this.node.querySelector('#top-bar-btn-play')?.addEventListener('click', () =>
		{
			if(this._commands)
			{
				this._commands.execute('script-play');
			}
		});

		this.node.querySelector('#top-bar-btn-stop')?.addEventListener('click', () =>
		{
			if(this._commands)
			{
				this._commands.execute('script-stop');
			}
		});
	}
}

window.ScriptToolbar = ScriptToolbar;
