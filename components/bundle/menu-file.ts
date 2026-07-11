import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { MenuConfig, MenuManager } from "./menu-manager";

declare global
{
	interface Window
	{
		globalModules?: Record<string, Record<string, Function>>;
		fileToolbar: FileToolbar;
		FileToolbar: typeof FileToolbar;
		registerAllCommands: (menuItems: MenuConfig[] | MenuConfig, commands?: CommandRegistry) => void;
	}
}

const FILE_MENU: MenuConfig = {
	name: "File",
	iconClass: "bx bx-file",
	children: [{
		name: "New",
		target: "file/new.new",
		iconClass: "bx bx-file"
	}, {
		divider: true
	}, {
		name: "Open",
		iconClass: "bx bx-folder-open",
		children: [{
			name: "Open File",
			shortcut: "O",
			ellipsis: true,
			target: "file/open.open_file",
			iconClass: "bx bx-file"
		}, {
			name: "Open Directory",
			ellipsis: true,
			target: "file/open.open_dir",
			iconClass: "bx bx-folder"
		}, {
			name: "Open from Webcam",
			target: "file/open.open_webcam",
			iconClass: "bx bx-webcam"
		}, {
			name: "Open URL",
			ellipsis: true,
			target: "file/open.open_url",
			iconClass: "bx bx-link"
		}, {
			name: "Open Data URL",
			ellipsis: true,
			target: "file/open.open_data_url",
			iconClass: "bx bx-code-alt"
		}, {
			name: "Open Test Template",
			target: "file/open.open_template_test",
			iconClass: "bx bx-extension"
		}]
	}, {
		name: "Load Sample File",
		target: "file/load_sample",
		iconClass: "bx bx-file"
	},
	{
		name: "New Recording",
		target: "file/new_recording",
		iconClass: "bx bx-video-plus"
	},
	{
		name: "Save Draft Locally",
		ellipsis: true,
		target: "file/save_draft_local",
		iconClass: "bx bx-save"
	},
	{
		name: "Open Local Drafts",
		ellipsis: true,
		target: "file/open_drafts_local",
		iconClass: "bx bx-folder-open"
	}, {
		divider: true
	},
	{
		name: "Search Images",
		ellipsis: true,
		target: "file/open.search",
		iconClass: "bx bx-search-alt"
	}, {
		divider: true
	}, {
		name: "Export",
		ellipsis: true,
		shortcut: "S",
		target: "file/save.export",
		iconClass: "bx bx-export"
	}, {
		name: "Save As",
		ellipsis: true,
		shortcut: "Shift + S",
		target: "file/save.save",
		iconClass: "bx bx-save"
	}, {
		name: "Save As Data URL",
		ellipsis: true,
		target: "file/save.save_data_url",
		iconClass: "bx bx-code-alt"
	}, {
		name: "Print",
		ellipsis: true,
		shortcut: "Ctrl+P",
		target: "file/print.print",
		iconClass: "bx bx-printer"
	}, {
		divider: true
	},
	{
		name: "Settings",
		target: "file/settings",
		iconClass: "bx bx-cog"
	},
	{
		divider: true
	},
	{
		name: "Publish",
		iconClass: "bx bx-export",
		children: [
			{ name: "Web", target: "file/publish/web", iconClass: "bx bx-globe" },
			{ name: "Windows", target: "file/publish/windows", iconClass: "bxl bx-microsoft" },
			{ name: "Linux", target: "file/publish/linux", iconClass: "bxl bx-tux" },
			{ name: "macOS", target: "file/publish/macos", iconClass: "bxl bx-apple" }
		]
	},
	{
		name: "Import",
		target: "file/import"
	},
	{
		divider: true
	},
	{
		name: "Quick Save",
		shortcut: "F9",
		target: "file/quicksave.quicksave",
		iconClass: "bx bx-bolt-circle"
	}, {
		name: "Quick Load",
		shortcut: "F10",
		target: "file/quickload.quickload",
		iconClass: "bx bx-refresh"
	}, {
		divider: true
	},
	{
		name: "Exit IDE",
		shortcut: "F10",
		target: "file/exit.exit",
		iconClass: "bx bx-power"
	}]
};


const EDIT_MENU: MenuConfig = {
	name: "Edit",
	iconClass: "bx bx-edit",
	children: [{
		name: "Undo",
		shortcut: "Ctrl+Z",
		target: "edit/undo.undo",
		iconClass: "bx bx-undo"
	}, {
		name: "Redo",
		shortcut: "Ctrl+Y",
		target: "edit/redo.redo",
		iconClass: "bx bx-redo"
	}, {
		divider: true
	}, {
		name: "Delete Selection",
		shortcut: "Del",
		target: "edit/selection.delete",
		iconClass: "bx bx-trash"
	}, {
		name: "Copy Selection",
		target: "layer/new.new_selection",
		iconClass: "bx bx-copy"
	}, {
		name: "Copy to Clipboard",
		shortcut: "Ctrl+C",
		target: "edit/copy.copy_to_clipboard",
		iconClass: "bx bx-copy"
	}, {
		name: "Cut",
		target: "edit/cut",
		iconClass: "bx bx-cut"
	}, {
		name: "Paste",
		shortcut: "Ctrl+V",
		target: "edit/paste.paste",
		iconClass: "bx bx-paste"
	}, {
		name: "Delete",
		target: "edit/delete",
		iconClass: "bx bx-trash"
	}, {
		divider: true
	}, {
		name: "Select All",
		shortcut: "Ctrl+A",
		target: "edit/selection.select_all",
		iconClass: "bx bx-select-all"
	}, {
		name: "Deselect All",
		shortcut: "~",
		target: "edit/deselect_all"
	}]
};


const VIEW_MENU: MenuConfig = {
	name: "View",
	iconClass: "bx bx-eye",
	children: [{
		name: "Zoom",
		iconClass: "bx bx-search-alt",
		children: [{
			name: "Zoom In",
			target: "view/zoom.in",
			iconClass: "bx bx-search-plus"
		}, {
			name: "Zoom Out",
			target: "view/zoom.out",
			iconClass: "bx bx-search-minus"
		}, {
			divider: true
		}, {
			name: "Original Size",
			target: "view/zoom.original",
			iconClass: "bx bx-size-uniform"
		}, {
			name: "Fit Window",
			target: "view/zoom.auto",
			iconClass: "bx bx-fullscreen"
		}]
	}, {
		name: "Grid",
		shortcut: "G",
		target: "view/grid.grid",
		iconClass: "bx bx-grid"
	}, {
		name: "Guides",
		iconClass: "bx bx-border-inner",
		children: [{
			name: "Insert",
			ellipsis: true,
			target: "view/guides.insert",
			iconClass: "bx bx-plus"
		}, {
			name: "Update",
			target: "view/guides.update",
			iconClass: "bx bx-refresh"
		}, {
			name: "Remove all",
			target: "view/guides.remove",
			iconClass: "bx bx-trash"
		}]
	}, {
		name: "Ruler",
		target: "view/ruler.ruler",
		iconClass: "bx bx-ruler"
	}, {
		divider: true
	}, {
		name: "Full Screen",
		target: "view/full_screen.fs",
		iconClass: "bx bx-fullscreen"
	}]
};


const HELP_MENU: MenuConfig = {
	name: "Help",
	iconClass: "bx bx-help-circle",
	children: [{
		name: "Keyboard Shortcuts",
		ellipsis: true,
		target: "help/shortcuts.shortcuts",
		iconClass: "bx bx-keyboard"
	}, {
		name: "Report Issues",
		href: "https://github.com/briancullinan2/quedit/issues",
		iconClass: "bx bx-bug"
	}, {
		divider: true
	}, {
		name: "About",
		ellipsis: true,
		target: "help/about.about",
		iconClass: "bx bx-info-circle"
	}, {
		divider: true
	}, {
		name: "Store Offline Version",
		target: "help/store_offline",
		iconClass: "bx bx-download"
	}, {
		name: "See Welcome Message",
		target: "help/see_welcome",
		iconClass: "bx bx-smile"
	}, {
		name: "SourceCode on Github",
		href: "https://github.com/briancullinan2/quedit",
		iconClass: "bxl bx-github"
	}]
};


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
		window.registerAllCommands(FILE_MENU);
		window.registerAllCommands(EDIT_MENU);
		window.registerAllCommands(VIEW_MENU);
		window.registerAllCommands(HELP_MENU);
		MenuManager.injectMenus(null, FILE_MENU);
		MenuManager.injectMenus(null, EDIT_MENU);
		MenuManager.injectMenus(null, VIEW_MENU);
		MenuManager.injectMenus(null, HELP_MENU);
		return this;
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
			this._commands?.execute('file/new.new');
		});

		this.node.querySelector('#file-bar-btn-save')?.addEventListener('click', () =>
		{
			this._commands?.execute('file/save.save');
		});

		this.node.querySelector('#file-bar-btn-upload')?.addEventListener('click', () =>
		{
			this._commands?.execute('file/open.open_dir');
		});

		this.node.querySelector('#file-bar-btn-undo')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/undo.undo');
		});

		this.node.querySelector('#file-bar-btn-redo')?.addEventListener('click', () =>
		{
			this._commands?.execute('edit/redo.redo');
		});
	}

	public static closeApp()
	{
		if(confirm('Are you sure you want to exit?'))
		{
			window.close();
		}
	}
}

window.FileToolbar = FileToolbar;

if(!window.globalModules)
{
	window.globalModules = {};
}

if(!window.globalModules['file/exit'])
{
	window.globalModules['file/exit'] = {
		exit: FileToolbar.closeApp
	};
}

