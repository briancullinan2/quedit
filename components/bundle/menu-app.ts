import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";

declare global
{
	interface Window
	{
		appToolbar: ApplicationToolbar;
		ApplicationToolbar: typeof ApplicationToolbar;
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
				execute: () =>
				{
					console.log('Edit Settings Command Executed');
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
				execute: () =>
				{
					console.log('Toggle Layout Command Executed');
				}
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
