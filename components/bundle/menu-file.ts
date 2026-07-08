import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";

declare global
{
	interface Window
	{
		fileToolbar: FileToolbar;
		FileToolbar: typeof FileToolbar;
	}
}

export class FileToolbar extends Widget
{
	private static _instance: FileToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'file-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): FileToolbar
	{
		if(!FileToolbar._instance)
		{
			FileToolbar._instance = new FileToolbar();
			window.fileToolbar = FileToolbar._instance;
		}
		return FileToolbar._instance;
	}

	public initialize(commands: CommandRegistry): FileToolbar
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

		if(!this._commands.hasCommand('file-new'))
		{
			this._commands.addCommand('file-new', {
				label: 'New File',
				iconClass: 'bx bx-file-plus',
				execute: () =>
				{
					console.log('New File Command Executed');
				}
			});
		}

		if(!this._commands.hasCommand('file-save'))
		{
			this._commands.addCommand('file-save', {
				label: 'Save File',
				iconClass: 'bx bx-save',
				execute: () =>
				{
					console.log('Save File Command Executed');
				}
			});
		}

		if(!this._commands.hasCommand('file-upload'))
		{
			this._commands.addCommand('file-upload', {
				label: 'Upload File',
				iconClass: 'bx bx-folder-up-arrow',
				execute: () =>
				{
					console.log('Upload File Command Executed');
				}
			});
		}

		if(!this._commands.hasCommand('file-undo'))
		{
			this._commands.addCommand('file-undo', {
				label: 'Undo',
				iconClass: 'bx bx-undo',
				execute: () =>
				{
					console.log('Undo Command Executed');
				}
			});
		}

		if(!this._commands.hasCommand('file-redo'))
		{
			this._commands.addCommand('file-redo', {
				label: 'Redo',
				iconClass: 'bx bx-redo',
				execute: () =>
				{
					console.log('Redo Command Executed');
				}
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="file-bar-btn-new" title="New File" class="bx bx-file-plus"></button>
            <button id="file-bar-btn-save" title="Save File" class="bx bx-save"></button>
            <button id="file-bar-btn-upload" title="Upload File" class="bx bx-folder-up-arrow"></button>
            <button id="file-bar-btn-undo" title="Back" class="bx bx-undo"></button>
            <button id="file-bar-btn-redo" title="Next" class="bx bx-redo"></button>
        `;

		this.node.querySelector('#file-bar-btn-new')?.addEventListener('click', () =>
		{
			this._commands?.execute('file-new');
		});

		this.node.querySelector('#file-bar-btn-save')?.addEventListener('click', () =>
		{
			this._commands?.execute('file-save');
		});

		this.node.querySelector('#file-bar-btn-upload')?.addEventListener('click', () =>
		{
			this._commands?.execute('file-upload');
		});

		this.node.querySelector('#file-bar-btn-undo')?.addEventListener('click', () =>
		{
			this._commands?.execute('file-undo');
		});

		this.node.querySelector('#file-bar-btn-redo')?.addEventListener('click', () =>
		{
			this._commands?.execute('file-redo');
		});
	}
}

window.FileToolbar = FileToolbar;
