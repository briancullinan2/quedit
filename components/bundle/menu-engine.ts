import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";

declare global
{
	interface Window
	{
		engineToolbar: EngineToolbar;
		EngineToolbar: typeof EngineToolbar;
	}
}

type EngineControl = {
	id: string;
	placeholder: string;
	name: string;
};

const ENGINE_CONTROLS: EngineControl[] = [
	{ id: 'spawn', placeholder: 'Spawn Point', name: 'spawn' },
	{ id: 'map', placeholder: 'Current Map', name: 'map' }
];

export class EngineToolbar extends Widget
{
	private static _instance: EngineToolbar | null = null;
	private _commands: CommandRegistry | null = null;

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
			window.engineToolbar = EngineToolbar._instance;
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

	// --- Dynamic Public API Setters ---
	public updateSpawns(spawns: { value: string; label: string; selected?: boolean; }[]): void
	{
		this._populateSelect('spawn', 'Spawn point', spawns);
	}

	public updateMaps(maps: { value: string; label: string; selected?: boolean; }[]): void
	{
		this._populateSelect('map', 'Current map', maps);
	}

	private _populateSelect(id: string, placeholder: string, items: { value: string; label: string; selected?: boolean; }[]): void
	{
		const select = this.node.querySelector(`#${id}`) as HTMLSelectElement;
		if(!select) return;

		// Maintain the initial disabled placeholder behavior if empty or reset
		let html = `<option value="" disabled ${!items.some(i => i.selected) ? 'selected' : ''}>${placeholder}</option>`;

		html += items.map(item =>
			`<option value="${item.value}" ${item.selected ? 'selected' : ''}>${item.label}</option>`
		).join('');

		select.innerHTML = html;
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
					execute: (args: any) =>
					{
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
            <li class="engine">
                <ul>
                    ${ENGINE_CONTROLS.map(control => `
                        <li placeholder="${control.placeholder}">
                            <select required name="${control.name}" id="${control.id}">
                                <option value="" selected disabled>${control.placeholder}</option>
                            </select>
                        </li>
                    `).join('')}
                </ul>
            </li>
        `;
	}
}

window.EngineToolbar = EngineToolbar;
