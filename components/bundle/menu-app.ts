import { CommandRegistry } from "@lumino/commands";
import { DockPanel, Widget } from "@lumino/widgets";
import { triggerPanelRoute } from "./menu";
import type { FrameRater } from "../terminal/widget";
import { SettingsManager } from "./settings";
import type { AceEditorWidget } from "../editor/widget";
import { loadAndInstantiate } from "./babel-compile";

declare global
{
	interface Window
	{
		appToolbar: ApplicationToolbar;
		ApplicationToolbar: typeof ApplicationToolbar;
		mainDock: DockPanel;
		terminalFrameLimiter: typeof FrameRater;
		AceEditorWidget: typeof AceEditorWidget;
	}
}

export class ApplicationToolbar extends Widget
{
	private static _instance: ApplicationToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'application-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): ApplicationToolbar
	{
		if(!ApplicationToolbar._instance)
		{
			ApplicationToolbar._instance = new ApplicationToolbar();
			window.appToolbar = ApplicationToolbar._instance;
		}
		return ApplicationToolbar._instance;
	}

	public initialize(commands: CommandRegistry): ApplicationToolbar
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

		if(!this._commands.hasCommand('app-fullscreen'))
		{
			this._commands.addCommand('app-fullscreen', {
				label: 'Fullscreen Mode',
				iconClass: 'bx bx-fullscreen',
				execute: () =>
				{
					if(document.fullscreenElement === document.body)
					{
						document.exitFullscreen();
					} else
					{
						document.body.requestFullscreen();
					}
				}
			});
		}

		if(!this._commands.hasCommand('app-github-login'))
		{
			this._commands.addCommand('app-github-login', {
				label: 'Github Login',
				iconClass: 'bx bx-key',
				execute: () =>
				{
					window.open('https://github.com/settings/tokens?type=beta', '_blank');
					await loadAndInstantiate({
						label: 'Enter Github Token',
						url: './components/layout/token-modal.ts',
						className: 'TokenModal',
						iconClass: 'bx bx-key' })
				}
			});
		}

		if(!this._commands.hasCommand('app-toggle-console'))
		{
			this._commands.addCommand('app-toggle-console', {
				label: 'Console',
				iconClass: 'bx bx-terminal',
				execute: () =>
				{
					console.log('Toggle Console Command Executed');
				}
			});
		}

		if(!this._commands.hasCommand('app-edit-settings'))
		{
			this._commands.addCommand('app-edit-settings', {
				label: 'Edit Settings',
				iconClass: 'bx bx-gear',
				execute: async () =>
				{
					const [fileId, fileName, settingsJson] = await SettingsManager.settings();
					window.AceEditorWidget.openFileInNewTab(fileId ?? 'settings.json', fileName ?? 'settings.json', settingsJson ?? '');
				}
			});
		}

		if(!this._commands.hasCommand('app-share-link'))
		{
			this._commands.addCommand('app-share-link', {
				label: 'Shareable Link',
				iconClass: 'bx bx-share',
				execute: () =>
				{
					navigator.clipboard.writeText(window.location.href);
				}
			});
		}

		if(!this._commands.hasCommand('app-toggle-layout'))
		{
			this._commands.addCommand('app-toggle-layout', {
				label: 'Toggle Layout',
				iconClass: 'bx bx-iframe',
				execute: rotateLayout
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="top-bar-btn-github" title="Github Login" class="bx bx-key"></button>
            <button id="top-bar-btn-console" title="Console" class="bx bx-terminal"></button>
            <button id="top-bar-btn-settings" title="Edit Settings" class="bx bx-gear"></button>
            <button id="top-bar-btn-link" title="Sharable Link" class="bx bx-share"></button>
            <button id="top-bar-btn-layout" title="Toggle Layout" class="bx bx-iframe"></button>
            <button id="top-bar-btn-fullscreen" title="Fullscreen Mode" class="bx bx-fullscreen"></button>
        `;

		this.node.querySelector('#top-bar-btn-github')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-github-login');
		});

		this.node.querySelector('#top-bar-btn-console')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-toggle-console');
		});

		this.node.querySelector('#top-bar-btn-settings')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-edit-settings');
		});

		this.node.querySelector('#top-bar-btn-link')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-share-link');
		});

		this.node.querySelector('#top-bar-btn-layout')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-toggle-layout');
		});

		this.node.querySelector('#top-bar-btn-fullscreen')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-fullscreen');
		});
	}
}

window.ApplicationToolbar = ApplicationToolbar;


// TODO: lumino-resize and lumino-widget will adjust their behavior based on the selected layout
//   switching split-left and split-right
const LAYOUT_AXES = {
	panels: ['left-hand-files', 'right-hand-files'],
	order: ['normal-order', 'reverse-order'],
	terminal: ['terminal', 'no-terminal'],
	mode: ['full-mode', 'focus-mode']
};

const layoutState = {
	panels: 'left-hand-files',
	order: 'normal-order',
	terminal: 'terminal',
	mode: 'full-mode'
};


async function rotateLayout()
{

	Object.keys(LAYOUT_AXES).forEach(axis =>
	{
		// Find which variant inside this specific axis array is currently on the element
		const matchedClass = LAYOUT_AXES[axis].find(variant => document.body.classList.contains(`layout-${variant}`));

		if(matchedClass)
		{
			// Update the state with the discovered active class
			layoutState[axis] = matchedClass;

			// Strip the old atomic layout class from the DOM token list
			document.body.classList.remove(`layout-${matchedClass}`);
		}
	});

	const currentLayoutClass = `layout-${layoutState.panels} layout-${layoutState.order} layout-${layoutState.terminal} layout-${layoutState.mode}`;

	// Find where it lives in your 16-element permutation list
	const currentIndex = ALL_LAYOUTS.indexOf(currentLayoutClass);

	// Step forward by exactly +1, wrapping cleanly back to 0 when hitting the end boundary
	const nextIndex = (currentIndex + 1) % ALL_LAYOUTS.length;
	const newLayoutClass = ALL_LAYOUTS[nextIndex].split(' ');

	if(newLayoutClass.includes('layout-terminal') && typeof window.terminalFrameLimiter === 'undefined')
	{
		await triggerPanelRoute('terminal', window.mainDock);
	}

	// 5. Inject it back onto the target DOM node element
	document.body.classList.add(...newLayoutClass);

	console.log(`🔄 Layout rotated from [${currentLayoutClass || 'None'}] ➡️ [${newLayoutClass}] (Index: ${nextIndex})`);
	return newLayoutClass;
}

const ALL_LAYOUTS = Object.values(LAYOUT_AXES).reduce((combinations, currentAxisVariants) =>
{
	// If it's the first axis (panels), initialize the array with its base variants
	if(combinations.length === 0) return currentAxisVariants;

	// Cross-multiply the existing strings with the variants of the next axis
	return combinations.flatMap(existingString =>
		currentAxisVariants.map(variant => `${existingString} layout-${variant}`)
	);
}, []).map(combinedString => `layout-${combinedString}`);

