import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";

declare global
{
	interface Window
	{
		settingsToolbar: SettingsToolbar;
		SettingsToolbar: typeof SettingsToolbar;
	}
}

type SelectOption = { value: string; label: string; selected?: boolean; };
type OptGroup = { label: string; options: SelectOption[]; };

type ControlConfig = {
	id: string;
	placeholder: string;
	type: 'select' | 'checkbox';
	name: string;
	// For select types: mix of direct options and grouped options
	options?: (SelectOption | OptGroup)[];
	// For checkbox types:
	labelText?: string;
	checked?: boolean;
};

const SETTINGS_CONTROLS: ControlConfig[] = [
	{
		id: 'keybinding',
		placeholder: 'Key Binding',
		type: 'select',
		name: 'keybinding',
		options: [
			{ value: '', label: 'Key Binding' },
			{ value: 'null', label: 'Ace' },
			{ value: 'ace/keybinding/combined', label: 'Combined', selected: true },
			{ value: 'ace/keybinding/vim', label: 'Vim' },
			{ value: 'ace/keybinding/emacs', label: 'Emacs' },
			{ value: 'ace/keybinding/sublime', label: 'Sublime' },
			{ value: 'ace/keybinding/vscode', label: 'VS Code' }
		]
	},
	{
		id: 'configuration',
		placeholder: 'Build Configuration',
		type: 'select',
		name: 'configuration',
		options: [
			{ value: '', label: 'Build Configuration' },
			{ value: 'debug', label: 'Debug' },
			{ value: 'release', label: 'Release' },
			{ value: 'pre', label: 'Preprocess' },
			{ value: 'qvms', label: 'Renderer Only' },
			{ value: 'qvms', label: 'Shared Libraries' },
			{ value: 'qvms', label: 'QVMs Only' },
			{ value: 'tools', label: 'QVM Tools Only' },
			{ value: 'assets', label: 'Assets Only' },
			{ value: 'publish', label: 'Publish' },
			{ value: 'sanitize', label: 'Sanitize' },
			{ value: 'analyze', label: 'Analyze' }
		]
	},
	{
		id: 'reload',
		placeholder: 'Automatically Reload',
		type: 'checkbox',
		name: 'reload',
		labelText: 'Hot Reload:&nbsp;',
		checked: true
	},
	{
		id: 'wasi',
		placeholder: 'Current WASI-SDK',
		type: 'select',
		name: 'wasi',
		options: [
			{ value: '', label: 'WASI-SDK v33 (Not downloaded)' }
		]
	},
	{
		id: 'theme',
		placeholder: 'Current Theme',
		type: 'select',
		name: 'theme',
		options: [
			{ value: '', label: 'Current Theme' },
			{
				label: "The Coders' Heritage",
				options: [
					{ value: 'ace/theme/monokai', label: 'Monokai (OG High Contrast)', selected: true },
					{ value: 'ace/theme/textmate', label: 'TextMate (The Standard)' },
					{ value: 'ace/theme/github', label: 'GitHub (Legacy Light)' },
					{ value: 'ace/theme/eclipse', label: 'Eclipse (Java Classic)' },
					{ value: 'ace/theme/xcode', label: 'XCode (Apple Classic)' }
				]
			},
			{
				label: 'Sci-Fi Voids & Cyber Terminals',
				options: [
					{ value: 'ace/theme/terminal', label: 'Retro Terminal (Classic Amber/Green)' },
					{ value: 'ace/theme/gob', label: 'Green on Black (The Matrix)' },
					{ value: 'ace/theme/nightvision', label: 'Night Vision (Matrix Green)' },
					{ value: 'ace/theme/invertedneon', label: 'Inverted Neon (vs Night Vision)' },
					{ value: 'ace/theme/vibrant_ink', label: 'Vibrant Ink (Neon)' },
					{ value: 'ace/theme/chaos', label: 'Chaos (Extreme Contrast)' },
					{ value: 'ace/theme/midnightvoid', label: 'Midnight Void (vs Daybreak)' }
				]
			},
			{
				label: 'Atmospheric Dawns & Sunsets',
				options: [
					{ value: 'ace/theme/daybreak', label: 'Daybreak (Classic Sunrise)' },
					{ value: 'ace/theme/dawn', label: 'Dawn (Soft Sunrise)' },
					{ value: 'ace/theme/desertsunset', label: 'Desert Sunset (Banded Gold)' },
					{ value: 'ace/theme/arcticthaw', label: 'Arctic Thaw (vs Desert Sunset)' },
					{ value: 'ace/theme/solarflare', label: 'Solar Flare (vs Dusk)' },
					{ value: 'ace/theme/dusk', label: 'Dusk (Atmospheric Night)' }
				]
			},
			{
				label: 'Deep Water & Organic Ecosystems',
				options: [
					{ value: 'ace/theme/cobalt', label: 'Cobalt (Deep Sea Blue)' },
					{ value: 'ace/theme/oceanripple', label: 'Ocean Ripple (Deep Reflective)' },
					{ value: 'ace/theme/abyssaltrench', label: 'Abyssal Trench (vs Ocean Ripple)' },
					{ value: 'ace/theme/coralreef', label: 'Coral Reef (Tropical Cyan)' },
					{ value: 'ace/theme/deepseakelp', label: 'Deep Sea Kelp (vs Coral Reef)' },
					{ value: 'ace/theme/emeraldforest', label: 'Emerald Forest (Vibrant Green)' },
					{ value: 'ace/theme/sourlime', label: 'Sour Lime (vs Berry Blast)' },
					{ value: 'ace/theme/berryblast', label: 'Berry Blast (Candy Red/Blue)' }
				]
			},
			{
				label: 'Industrial Foundry & Metallic Elements',
				options: [
					{ value: 'ace/theme/mono_industrial', label: 'Mono Industrial (Raw Slate)' },
					{ value: 'ace/theme/darkslate', label: 'Dark Slate (vs Shale Life)' },
					{ value: 'ace/theme/silverchrome', label: 'Silver Chrome (Metallic)' },
					{ value: 'ace/theme/oxidizediron', label: 'Oxidized Iron (vs Silver Chrome)' },
					{ value: 'ace/theme/leadfortress', label: 'Lead Fortress (vs Golden Gate)' },
					{ value: 'ace/theme/goldengate', label: 'Golden Gate (Polished Gold)' }
				]
			},
			{
				label: 'Academic Pages & Editorial Finishes',
				options: [
					{ value: 'ace/theme/ivory', label: 'Atrium Ivory (vs Default Purple)' },
					{ value: 'ace/theme/parchment', label: 'Parchment (Academic Beige)' },
					{ value: 'ace/theme/obsidianledger', label: 'Obsidian Ledger (vs Parchment)' },
					{ value: 'ace/theme/kuroir', label: 'Paper White' },
					{ value: 'ace/theme/crimson_editor', label: 'Crimson Editor' },
					{ value: 'ace/theme/sqlserver', label: 'SQL Server Management Studio' },
					{ value: 'ace/theme/dreamweaver', label: 'Dreamweaver Classic' }
				]
			},
			{
				label: 'Cozy Studio Earth Tones',
				options: [
					{ value: 'ace/theme/dracula', label: 'Dracula (Vampire Mode)' },
					{ value: 'ace/theme/one_dark', label: 'One Dark (Atom Style)' },
					{ value: 'ace/theme/nord_dark', label: 'Nord Dark (Arctic Frost)' },
					{ value: 'ace/theme/gruvbox', label: 'Gruvbox (Earth Tones)' },
					{ value: 'ace/theme/pastel_on_dark', label: 'Pastel on Dark' },
					{ value: 'ace/theme/twilight', label: 'Twilight (Warm Dark)' },
					{ value: 'ace/theme/ambiance', label: 'Ambiance (Smooth Espresso)' },
					{ value: 'ace/theme/idle_fingers', label: 'idle Fingers' },
					{ value: 'ace/theme/merbivore_soft', label: 'Merbivore Soft' },
					{ value: 'ace/theme/merbivore', label: 'Merbivore' }
				]
			},
			{
				label: 'Prisms & Chromatic Experiments',
				options: [
					{ value: 'ace/theme/solarized_dark', label: 'Solarized Dark (Precision Calibrated)' },
					{ value: 'ace/theme/solarized_light', label: 'Solarized Light (Precision Calibrated)' },
					{ value: 'ace/theme/rainbowpeak', label: 'Rainbow Peak (Full Spectrum)' },
					{ value: 'ace/theme/monochromematrix', label: 'Monochrome Matrix (vs Rainbow)' },
					{ value: 'ace/theme/tomorrow_night_blue', label: 'Tomorrow Night Blue' },
					{ value: 'ace/theme/tomorrow_night_bright', label: 'Tomorrow Night Bright' },
					{ value: 'ace/theme/tomorrow_night_eighties', label: 'Tomorrow Night 80s' },
					{ value: 'ace/theme/tomorrow_night', label: 'Tomorrow Night' },
					{ value: 'ace/theme/tomorrow', label: 'Tomorrow Light' },
					{ value: 'ace/theme/katzenmilch', label: 'KatzenMilch (Warm Gray)' },
					{ value: 'ace/theme/iplastic', label: 'IPlastic' },
					{ value: 'ace/theme/kr_theme', label: 'krTheme' },
					{ value: 'ace/theme/clouds_midnight', label: 'Clouds Midnight' },
					{ value: 'ace/theme/clouds', label: 'Clouds Light' }
				]
			}
		]
	}
];


export class SettingsToolbar extends Widget
{
	private static _instance: SettingsToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'settings-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): SettingsToolbar
	{
		if(!SettingsToolbar._instance)
		{
			SettingsToolbar._instance = new SettingsToolbar();
			window.settingsToolbar = SettingsToolbar._instance;
		}
		return SettingsToolbar._instance;
	}

	public initialize(commands: CommandRegistry): SettingsToolbar
	{
		this._commands = commands;
		this._registerCommands();
		this._bindChangeListeners();
		return this;
	}

	private _getCommandDefinitions(): Record<string, { label: string; action: (val: any) => void; }>
	{
		return {
			'keybinding': {
				label: 'Change Key Binding',
				action: (value) => console.log(`Keybinding updated: ${value}`)
			},
			'configuration': {
				label: 'Change Build Configuration',
				action: (value) => console.log(`Build configuration updated: ${value}`)
			},
			'reload': {
				label: 'Toggle Hot Reload',
				action: (checked) => console.log(`Hot reload toggled: ${checked}`)
			},
			'wasi': {
				label: 'Change WASI SDK',
				action: (value) => console.log(`WASI SDK updated: ${value}`)
			},
			'theme': {
				label: 'Change Editor Theme',
				action: (value) => console.log(`Theme updated: ${value}`)
			}
		};
	}

	private _registerCommands(): void
	{
		if(!this._commands) return;

		const defs = this._getCommandDefinitions();
		for(const [id, config] of Object.entries(defs))
		{
			const commandId = `settings-update-${id}`;
			if(!this._commands.hasCommand(commandId))
			{
				this._commands.addCommand(commandId, {
					label: config.label,
					execute: (args: any) => config.action(args.value)
				});
			}
		}
	}

	private _bindChangeListeners(): void
	{
		const defs = this._getCommandDefinitions();
		for(const id of Object.keys(defs))
		{
			const element = this.node.querySelector(`#${id}`);
			if(!element) continue;

			const isCheckbox = element.getAttribute('type') === 'checkbox';
			const eventType = isCheckbox ? 'change' : 'input';

			element.addEventListener(eventType, () =>
			{
				const value = isCheckbox ? (element as HTMLInputElement).checked : (element as HTMLSelectElement).value;
				this._commands?.execute(`settings-update-${id}`, { value });
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = '<ul>' +  SETTINGS_CONTROLS.map(control =>
		{
			//const disabledAttr = (control.options?.[0] as SelectOption)?.value === '' || control.options?.length === 1 ? 'disabled' : '';

			if(control.type === 'select')
			{
				const innerContent = (control.options || []).map(opt =>
				{
					if('options' in opt)
					{
						const groupOptions = opt.options.map(o =>
							`<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`
						).join('');
						return `<optgroup label="${opt.label}">${groupOptions}</optgroup>`;
					}
					const isPlaceholder = opt.value === '';
					return `<option value="${opt.value}" ${isPlaceholder ? 'disabled' : ''} ${opt.selected ? 'selected' : ''}>${opt.label}</option>`;
				}).join('');

				return `
                <li id="${control.name}-container" class="setting" placeholder="${control.placeholder}">
                    <select required name="${control.name}" id="${control.id}">
                        ${innerContent}
                    </select>
                </li>`;
			} else
			{
				return `
                <li id="${control.name}-container" class="setting" placeholder="${control.placeholder}">
					<span>${control.labelText || ''}</span>
					<input type="checkbox" name="${control.name}" id="${control.id}" ${control.checked ? 'checked="checked"' : ''} />
                </li>`;
			}
		}).join('') + '</ul>';
	}
}

window.SettingsToolbar = SettingsToolbar;
