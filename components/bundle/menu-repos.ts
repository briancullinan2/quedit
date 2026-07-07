import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";


declare global
{
	interface Window
	{
		scriptToolbar?: ScriptToolbar;
	}
}



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
		return this;
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="top-bar-btn-play" title="Play Script"><i class="bx bx-play"></i></button>
            <button id="top-bar-btn-stop" title="Stop Script"><i class="bx bx-stop"></i></button>
            <div class="top-bar-divider"></div>
            <label for="top-bar-sel-owner">Owner:</label>
            <select id="top-bar-sel-owner">
                <option value="org-1">Organization One</option>
                <option value="org-2">Organization Two</option>
            </select>
            <label for="top-bar-sel-repo">Repo:</label>
            <select id="top-bar-sel-repo">
                <option value="repo-a">Repository A</option>
                <option value="repo-b">Repository B</option>
            </select>
        `;

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

	public static get owner(): HTMLSelectElement | null
	{
		return ScriptToolbar.getInstance().node.querySelector('top-bar-sel-owner');
	}

	public static get repository(): HTMLSelectElement | null
	{
		return ScriptToolbar.getInstance().node.querySelector('top-bar-sel-repo');
	}
}
