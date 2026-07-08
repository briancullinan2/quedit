import { getGitShaBrowser } from "./github";
import { filesRepo } from "./github-types";
import { FS_FILE } from "./local";
import { ScriptToolbar } from "./menu-repos";
import type { AceEditorWidget } from "../editor/widget";
import { DockPanel } from "@lumino/widgets";

export interface SettingConfig
{
	key: string;
	type?: 'boolean' | 'csv' | 'json' | 'array' | string;
	default: any;
	windowName?: string;
	description?: string;
	elementId?: string;
	edit?: boolean;
	currentValue?: any;
	set?(value: any): void;
	get?(storedValue: string | null, defaultValue: any, config: SettingConfig): any;
}

// Environmental Declarations
declare let IMPORT_SETTINGS: Record<string, Record<string, SettingConfig>>;

declare global
{
	interface Window
	{
		mainDock: DockPanel;
		SettingsManager: Settings;
		engineRepository: string | null;
		AceEditorWidget: typeof AceEditorWidget;
		triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;

	}
}

export class Settings
{
	private static _instance: Settings | null = null;


	private previousSettings: any = null;
	private tempCount: number = 0;


	private constructor() { }


	public static get instance(): Settings
	{
		if(!Settings._instance)
		{
			Settings._instance = new Settings();
			window.SettingsManager = Settings._instance;
		}
		return Settings._instance;
	}


	/**
	 * 1. Initial hydration loop running across local storage on boot
	 */
	public hydrateAll(): void
	{
		for(const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS))
		{
			for(const [camelKey, config] of Object.entries(settings))
			{
				config.windowName = camelKey;
				const raw = localStorage.getItem(config.key);
				let finalValue: any = raw;

				if(raw === null)
				{
					finalValue = config.default;
				} else if(config.type === 'boolean')
				{
					finalValue = raw === 'true';
				} else if(config.type === 'json' || config.type === 'array')
				{
					try
					{
						finalValue = JSON.parse(raw);
						if(config.type === 'array' && !Array.isArray(finalValue))
						{
							debugger;
							finalValue = [];
						}
					} catch(e)
					{
						debugger;
						console.error(e);
						finalValue = config.default;
					}
				} else if(config.type === 'csv')
				{
					finalValue = raw.split(';').filter(Boolean);
				}

				this.applyValue(config, finalValue);
			}
		}
	}

	/**
	 * 2. Applies the translated state to elements or core configurations
	 */
	public applyValue(config: SettingConfig, value: any): void
	{
		config.currentValue = value;
		if(config.windowName)
		{
			(window as any)[config.windowName] = value;
		}

		if(typeof config.set === 'function')
		{
			config.set(value);
		} else if(config.elementId)
		{
			const el = document.getElementById(config.elementId) as HTMLInputElement | HTMLSelectElement | null;
			if(el)
			{
				if(config.type === 'boolean' || (el as HTMLInputElement).type === 'checkbox')
				{
					(el as HTMLInputElement).checked = !!value;
				} else if(el.tagName.toUpperCase() === 'SELECT')
				{
					if(el.querySelector(`[value*="${value}"]`))
					{
						el.value = value;
					} else
					{
						el.value = config.default;
					}
				} else
				{
					el.value = value;
				}
			}
		}
	}

	/**
	 * 3. Gathers active settings configurations ordered by keys
	 */
	public exportPayload(): Record<string, any>
	{
		const payload: Record<string, any> = {};
		const flatConfigs: SettingConfig[] = [];

		for(const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS))
		{
			for(const [camelKey, config] of Object.entries(settings))
			{
				if(config.edit === false) continue;
				flatConfigs.push(config);
			}
		}

		flatConfigs.sort((a, b) => a.key.localeCompare(b.key));

		for(const config of flatConfigs)
		{
			let currentVal: any;
			if(typeof config.get === 'function')
			{
				currentVal = config.get(localStorage.getItem(config.key), config.default, config);
			} else if(config.elementId)
			{
				const el = document.getElementById(config.elementId);
				if(el)
				{
					if(config.type === 'csv' && el.nodeName.toUpperCase() === 'SELECT')
					{
						currentVal = Array.from(el.children).map(c => (c as HTMLOptionElement).value).join(';');
					} else
					{
						currentVal = (config.type === 'boolean' || (el as HTMLInputElement).type === 'checkbox')
							? (el as HTMLInputElement).checked
							: (el as HTMLInputElement | HTMLSelectElement).value;
					}
				}
			} else
			{
				currentVal = localStorage.getItem(config.key);
			}

			if(config.type === 'csv' && typeof currentVal === 'string')
			{
				currentVal = currentVal.split(';');
			}
			if((config.type === 'array' || config.type === 'json') && typeof currentVal === 'string')
			{
				try
				{
					currentVal = JSON.parse(currentVal);
				} catch(e)
				{
					currentVal = config.type === 'array' ? [] : {};
				}
			}

			currentVal = currentVal !== undefined && currentVal !== null ? currentVal : config.default;
			payload[config.key] = currentVal;
		}

		return payload;
	}

	/**
	 * 4. Safe lookup targeting a single config definition string or Element pointer
	 */
	public get(moduleKey: string, settingKey: string | Element): any
	{
		let config: SettingConfig | undefined = IMPORT_SETTINGS[moduleKey]?.[settingKey as string];
		if(!config)
		{
			config = Object.values(IMPORT_SETTINGS[moduleKey] || {})
				.find(c => c.key === settingKey)
				|| Object.values(IMPORT_SETTINGS[moduleKey] || {})
					.find(c => (settingKey instanceof Element && c.elementId === (settingKey as Element)?.getAttribute('name')) || c.elementId === settingKey);

			if(!config) return null;
		}

		const stored = localStorage.getItem(config.key);
		if(stored)
		{
			if(!config.type) return stored;
			if(config.type === 'boolean') return stored === 'true';
			if(config.type === 'csv') return stored.split(';').filter(Boolean);
			if(config.type === 'json' || config.type === 'array')
			{
				try
				{
					const parsed = JSON.parse(stored);
					if(config.type === 'array')
					{
						return Array.isArray(parsed) ? parsed : [];
					}
					return parsed;
				} catch(e)
				{
					console.error(e);
					debugger;
					return stored || config.default;
				}
			}
		}

		if(config.elementId)
		{
			const el = document.getElementById(config.elementId) as HTMLInputElement | null;
			if(el)
			{
				return (config.type === 'boolean' || el.type === 'checkbox') ? el.checked : el.value;
			}
		}

		return config.default;
	}

	/**
	 * 5. Spawns the in-memory filesystem changes and updates the target workspace editor
	 */
	public async settings(): Promise<void>
	{
		const database = `${ScriptToolbar.owner?.value}/${ScriptToolbar.repository?.value}`;
		const filePath = `settings${++this.tempCount}.json`;

		if(window.engineRepository?.startsWith('Quake3e'))
		{
			console.error('Assertion owner set to Quake3e instead of briancullinan');
			debugger;
		}

		this.previousSettings = this.exportPayload();
		const settingsString = JSON.stringify(this.previousSettings, null, 4);
		const newSha = await getGitShaBrowser(settingsString);

		if(filesRepo[database])
		{
			filesRepo[database][filePath] = {
				timestamp: new Date(),
				mode: FS_FILE,
				contents: new TextEncoder().encode(settingsString),
				path: filePath,
				sha: newSha,
				parent: filePath.substring(0, filePath.lastIndexOf('/'))
			};
		}

		if(typeof window.AceEditorWidget === 'undefined')
		{
			await window.triggerPanelRoute('editor', window.mainDock);
		}

		window.AceEditorWidget.openFileInNewTab(filePath, 'settings.json', settingsString);
	}

	/**
	 * 6. Processes incoming editor session content directly down to layout targets
	 */
	public saveSettings(content: string): void
	{
		try
		{
			const freshSettings = JSON.parse(content);

			for(const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS))
			{
				for(const [camelKey, config] of Object.entries(settings))
				{
					if(freshSettings[config.key] !== undefined)
					{
						const value = freshSettings[config.key];

						if(config.type === 'array')
						{
							localStorage.setItem(config.key, JSON.stringify(value));
						} else if(config.type === 'csv')
						{
							if(typeof value === 'string') localStorage.setItem(config.key, value);
							else if(Array.isArray(value)) localStorage.setItem(config.key, value.join(';'));
							else localStorage.setItem(config.key, value.toString());
						} else if(config.type === 'json' || Array.isArray(value))
						{
							if(!Array.isArray(value)) localStorage.setItem(config.key, JSON.stringify([value]));
							else localStorage.setItem(config.key, JSON.stringify(value));
						} else
						{
							localStorage.setItem(config.key, value);
						}

						if(this.previousSettings && value !== this.previousSettings[config.key]?.currentValue)
						{
							this.applyValue(config, value);
						}
					}
				}
			}
		} catch(e: any)
		{
			console.warn(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}
	}
}

export const SettingsManager = Settings.instance;

