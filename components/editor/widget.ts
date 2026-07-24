import { DockPanel, Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Ace } from 'ace-builds';
import type { SettingConfig, Settings } from '../bundle/settings';
import type { HistoryToolbar, NavPoint } from '../bundle/menu-history';
import type { LayoutAdjuster } from '../bundle/lumino-widget';
import type { TerminalLogEntry } from '../terminal/widget-types';
import { AceEventManager, bindBlockTrackerToSession, onBlockTrackerCursorChange } from "./events";
import { getModeByFilename } from './widget-modes';
import { ACE_MODULES, VSCODE_ACE_MENUS } from './widget-menu';
import type { MenuModules } from '../bundle/menu-manager';

interface ISessionCache
{
	[fileId: string]: any;
}

declare module "ace-builds" {
	interface Editor
	{
		getSession(): AceSession;
	}
}

export interface AceSession extends Ace.EditSession
{
	workspaceFileId?: string;
	$worker?: Worker;
}

export type AceEditor = typeof Ace & {
	edit(el: string | HTMLElement, options?: any): any;
	createEditSession(text: string | Ace.Document, mode?: any): AceSession;
	Range: new (startRow: number, startColumn: number, endRow: number, endColumn: number) => Ace.Range;
	config: {
		loadModule: (module: [string, string], callback: () => void) => void;
		set: (key: string, value: string) => void;
	};
	require: (modules: string[], callback: (moduleExports: any) => void) => void;
};

declare global
{
	const ace: AceEditor;

	interface Window
	{
		tempCount: number;
		IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
		ace: typeof ace;
		LayoutAdjuster: typeof LayoutAdjuster;
		mainDock: DockPanel;
		getGitShaBrowser: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
		compilerDiagnostics?: {
			log: (msg: string) => void;
			clear: () => void;
			getBridge: () => {
				refreshActiveEditorView: (session: AceSession) => void;
			};
		};
		diagnosticsBridge: any;
		AceEditorWidget: typeof AceEditorWidget;
		historyToolbar: HistoryToolbar;
		SettingsManager: Settings;
		terminalLog: TerminalLogEntry[];
	}
}



/**
 * Global static coordinator managing pool instances to facilitate cross-widget reuse.
 */
class AceEditorPool
{
	static instances: Array<{ editor: Ace.Editor; inUse: boolean; }> = [];
	public static sessionCache: ISessionCache = {};

	public static getOrCreateAceSession(fileId: string, content: string, editor: Ace.Editor): any
	{
		if(this.sessionCache[fileId])
		{
			return this.sessionCache[fileId];
		}

		const session = ace.createEditSession(content);
		session.workspaceFileId = fileId;

		if(typeof window.getGitShaBrowser === 'function')
		{
			window.getGitShaBrowser(content).then((sha: string) =>
			{
				this.sessionCache[sha] = session;
			});
		}

		const mode = getModeByFilename(fileId);
		console.warn('Setting ace9 language highlighter: ' + mode + ' from ' + fileId);
		session.setMode(mode);

		bindBlockTrackerToSession(session, editor);
		onBlockTrackerCursorChange(session, editor);

		if(fileId.endsWith('.c') || fileId.endsWith('.h'))
		{
			session.setTabSize(4);
		}

		this.sessionCache[fileId] = session;

		editor.setSession(session);
		editor.resize();
		editor.renderer.updateFull();
		tryLoadingTerminalEditorBridge(editor);
		ace.require(["ace/mode/antlr_worker"], (antlrWorkerModule) =>
		{
			if(antlrWorkerModule && antlrWorkerModule.switchActiveSession)
			{
				antlrWorkerModule.switchActiveSession(session);
			}
		});

		return session;
	}

	public static acquireEditor(): Ace.Editor
	{
		// Find an editor instance that is not currently bound to an active DOM layout
		let item = this.instances.find(inst => !inst.inUse);
		if(!item)
		{
			const container = document.createElement('div');
			container.className = 'ace-shared-pool-element';
			container.style.width = '100%';
			container.style.height = '100%';
			ace.config.set('basePath', '/ace');
			ace.config.set('modePath', '/ace');
			ace.config.set('workerPath', '/ace');
			ace.config.set('themePath', '/ace');

			const editor: Ace.Editor = ace.edit(container);
			const theme = window.SettingsManager.get('editor', 'savedTheme');
			if(theme)
			{
				editor.setTheme(theme);
			}
			const renderer = editor.renderer as Ace.VirtualRenderer & {
				$gutterLayer: { setShowLineNumbers(show: boolean): void; };
				$loop: { schedule(command: any): void; };
				CHANGE_GUTTER: any;
			};
			renderer.setShowGutter(true);
			renderer.$gutterLayer.setShowLineNumbers(true);
			renderer.$loop.schedule(renderer.CHANGE_GUTTER);
			editor.setOptions({
				scrollPastEnd: 0.9,
				showPrintMargin: true,
				navigateWithinSoftTabs: true,
				printMarginColumn: 80,
				foldStyle: 'markbegin',
				showFoldWidgets: true,
				fadeFoldWidgets: false
			});

			editor.commands.addCommand({
				name: "save",
				bindKey: { win: "Ctrl-S", mac: "Command-S" },
				exec: function (ed: any)
				{
					if(typeof (window as any).saveFile === 'function')
					{
						(window as any).saveFile();
					}
				}
			});
			editor.on('change', AceEditorPool.recordChanges.bind(editor, editor));

			item = { editor, inUse: true };
			this.instances.push(item);
		} else
		{
			item.inUse = true;
		}
		return item.editor;
	}


	static recordChanges(editor: Ace.Editor, delta: Ace.Delta)
	{
		// 1. Get the real-time position from the editor instance
		const pos = editor.getCursorPosition();

		// 2. Format a human-readable action description based on the event delta
		let changeType = "Code Modified";
		if(delta.action === "insert")
		{
			changeType = delta.lines.length > 1 ? "Lines added" : "Inserted text";
		} else if(delta.action === "remove")
		{
			changeType = delta.lines.length > 1 ? "Lines deleted" : "Removed text";
		}

		const fileName = editor.getSession().workspaceFileId;

		// 3. Match the structural payload requirements for extractAceMetadata
		const actionPayload = {
			action_id: "ace_edit_action",
			action_description: changeType,
			fileName: fileName,                  // Assumes 'fileName' is accessible in your scope
			filePath: fileName,                  // Keeps it compatible with file path extraction splitting
			row: pos?.row,                        // Pass raw index; extractAceMetadata adds +1 for display
			column: pos?.column,
			delta: delta
		};

		window.historyToolbar.appendHistoryItem(actionPayload, 'editor');
	}

	public static releaseEditor(editor: any): void
	{
		const item = this.instances.find(inst => inst.editor === editor);
		if(item)
		{
			item.inUse = false;
			// Detach safely from the DOM parent node container to keep it free-floating
			if(editor.container && editor.container.parentNode)
			{
				editor.container.parentNode.removeChild(editor.container);
			}
		}
	}

	public static getNextTempName(): string
	{
		return 'temp' + (++window.tempCount) + '.c';
	}

	public static get keybinding(): HTMLSelectElement | null
	{
		return document.querySelector('top-bar-sel-keybinding');
	}

	public static get theme(): HTMLSelectElement | null
	{
		return document.querySelector('top-bar-sel-theme');
	}

}

/**
 * Lumino Widget encapsulating targeted tab lifecycle bindings to Ace singleton allocation layers.
 */
export class AceEditorWidget extends Widget implements MenuModules
{
	protected _fileId: string;
	protected _initialContent: string;
	public _editor: Ace.Editor | undefined = undefined;
	protected static _defaultContent: string = '#include <stdio.h>\n\n// this is a comment\n\nint main() {\n    printf("Hello, Lumino!\\n")\n    printf("WASI Compiler Check: SUCCESS\\n");\n    return 0;\n}\n';
	private _eventManager: any;
	autoSaveEnabled: boolean = true;
	public modules?: Record<string, Record<string, Function>> = ACE_MODULES;


	constructor(fileId?: string, initialContent?: string)
	{
		super();
		this.addClass('lm-AceEditorWidget');

		// TODO: so it starts with .c
		this._fileId = AceEditorPool.getNextTempName();
		this.id = `ace-editor-${this.fileId.replace(/[^a-z0-9]/ig, '_')}`;
		this._initialContent = initialContent || AceEditorWidget._defaultContent;
		this._eventManager = new AceEventManager(this);

		// Ensure Lumino layout updates do not break text selection systems
		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';

		this.title.label = fileId || this._fileId;
		this.title.closable = true;

		window.SettingsManager.hydrateAll(LOCAL_SETTINGS.editor);

		this.node.addEventListener('focusin', () =>
		{
			window.injectMenus(AceEditorWidget.name, VSCODE_ACE_MENUS);
		});
		this.node.addEventListener('focusout', (e) =>
		{
			// Only remove if focus didn't move somewhere else inside this same panel
			if(!this.node.contains(e.relatedTarget as Node))
			{
				//window.removeMenus(AceEditorWidget.name);
			}
		});

	}

	public get fileId(): string
	{
		return this._fileId;
	}


	protected onBeforeHide(msg: Message): void
	{
		window.removeMenus(AceEditorWidget.name);
		super.onBeforeHide(msg);
	}

	/**
	 * Fired when the Widget is being injected directly into the active browser DOM.
	 */
	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);

		// Claim or initialize an instance allocated within the singleton pool structures
		this._editor = AceEditorPool.acquireEditor();

		// Wire up structural DOM attachments cleanly
		this.node.appendChild(this._editor?.container);

		// Fetch original or structural cache descriptors targeting tracking layers
		const session = AceEditorPool.getOrCreateAceSession(this._fileId, this._initialContent, this._editor);
		tryLoadingTerminalEditorBridge(this._editor);
		window.registerAllCommands(VSCODE_ACE_MENUS);
		window.injectMenus(AceEditorWidget.name, VSCODE_ACE_MENUS);
	}

	/**
	 * Fired when Lumino swaps tabs out of layout visibility scope.
	 */
	protected onBeforeDetach(msg: Message): void
	{
		if(this._editor)
		{
			AceEditorPool.releaseEditor(this._editor);
			this._editor = undefined;
		}
		super.onBeforeDetach(msg);
		this._eventManager.detachListeners();
	}

	/**
	 * Invoked when layouts change container dimensions or parent components shift sizes.
	 */
	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		if(this._editor)
		{
			this._editor.resize();
		}
	}

	/**
	 * Invoked by Lumino tracking stacks to shift programmatic interaction capture target states.
	 */
	protected onActivateRequest(msg: Message): void
	{
		super.onActivateRequest(msg);
		if(this._editor)
		{
			this._editor.focus();
		}
		window.injectMenus(AceEditorWidget.name, VSCODE_ACE_MENUS);
	}

	// Call this function inside your file tree selection/click event listener
	static openFileInNewTab(fileId: string, fileName: string, fileContent: string | ArrayBuffer | Uint8Array)
	{
		if(fileContent instanceof ArrayBuffer || fileContent instanceof Uint8Array)
		{
			fileContent = new TextDecoder().decode(fileContent);
		}
		// 1. Optional Check: Look for an existing open tab matching this file ID to prevent duplicates
		const tabs = Array.from(window.mainDock.widgets());
		const existingTab = tabs.find(t => t.constructor.name === AceEditorWidget.name
			&& (t as AceEditorWidget).fileId === fileId);

		if(existingTab)
		{
			// If it's already open, just activate it and bring it to focus
			window.mainDock.activateWidget(existingTab);
			return;
		}

		// take over the default tab instead of creating a new one
		const existingDefault = tabs.find(t => t.constructor.name === AceEditorWidget.name
			&& ((t as AceEditorWidget)._editor?.getValue() === AceEditorWidget._defaultContent
				|| (t as AceEditorWidget)._editor?.getValue().trim() === '')
		) as AceEditorWidget;
		if(existingDefault && typeof existingDefault._editor !== 'undefined')
		{
			existingDefault.title.label = fileName.split('/').pop() ?? fileName;
			existingDefault._initialContent = fileContent;
			const session = AceEditorPool.getOrCreateAceSession(fileId, fileContent, existingDefault._editor);
			window.mainDock.activateWidget(existingDefault);
			return;
		}

		// 2. Create the new custom Ace Lumino widget instance
		const newTab = new AceEditorWidget(fileId, fileContent);
		newTab._fileId = fileId;
		newTab._initialContent = fileContent;

		newTab.title.label = fileName.split('/').pop() ?? fileName;
		newTab.title.closable = true;

		window.LayoutAdjuster.addOptimalWidgetLayout(window.mainDock, newTab, {
			type: 'editor',
			projectId: newTab.constructor.name
		});
	}
}

window.AceEditorWidget = AceEditorWidget;


export class SettingsWidget extends AceEditorWidget
{
	constructor(fileId?: string, initialContent?: string)
	{
		super(fileId, initialContent);
		const self = this;
		window.SettingsManager.settings().then(settings =>
		{
			self._fileId = settings[0] ?? self._fileId;
			self._initialContent = settings[2] ?? self._initialContent;

			if(self._editor)
			{
				const session = AceEditorPool.getOrCreateAceSession(self._fileId, self._initialContent, self._editor);
			}
		});
	}

	// TODO: on save, also call window.SettingsManager.saveSettings
}



const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	editor: {
		savedTheme: {
			key: 'theme',
			default: 'ace/theme/monokai',
			elementId: 'theme',
			description: 'The visual theme layout package used to style the interactive Ace code editor window background and syntax colors.',
			set: (val) =>
			{
				for(let instance of AceEditorPool.instances)
				{
					instance.editor.setTheme(val);
				}
				if(AceEditorPool.theme)
				{
					AceEditorPool.theme.value = val;
				}
			}
		},
		savedKeyBinding: {
			key: 'keybinding',
			default: 'ace/keybinding/vim',
			elementId: 'keybinding',
			description: 'Defines the keyboard mapping protocol (e.g., standard, Vim, or Emacs configurations) utilized inside the script editor workspace.',
			set: (val) =>
			{
				for(let instance of AceEditorPool.instances)
				{
					if(!val || val === 'null')
					{
						instance.editor.setKeyboardHandler(val);
					} else
					{
						instance.editor.setKeyboardHandler(val);
					}
				}

				if(AceEditorPool.keybinding)
				{
					if(!val || val === 'null')
					{
						AceEditorPool.keybinding.value = '';
					}
					else
					{
						AceEditorPool.keybinding.value = val;
					}
				}
			}
		}
	},
};


if(!window.IMPORT_SETTINGS)
{
	window.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	window.IMPORT_SETTINGS[moduleKey] = {
		...(window.IMPORT_SETTINGS[moduleKey] || {}),
		...configs
	};
}

// 4. Export the unified reference for standard module compilation tracking
export const IMPORT_SETTINGS = window.IMPORT_SETTINGS;

// Define declarations for Ace and missing global window bindings


function tryLoadingTerminalEditorBridge(aceEditor: Ace.Editor | null | undefined): void
{
	if(!aceEditor)
	{
		return;
	}

	if(window.compilerDiagnostics /* already setup */)
	{
		window.compilerDiagnostics.getBridge().refreshActiveEditorView(aceEditor?.getSession());
		return;
	}

	// Force Ace to locate, download, and compile the extension module asynchronously
	ace.config.loadModule(["ext", "compiler_diagnostics"], function ()
	{
		ace.require(["ace/ext/compiler_diagnostics"], function (moduleExports: any)
		{
			if(!moduleExports)
			{
				console.error("[Ace Lazy] Failed to initialize compiler_diagnostics extension.");
				return;
			}

			window.compilerDiagnostics = moduleExports;
			window.diagnosticsBridge = moduleExports.getBridge(aceEditor?.getSession());

			if(window.diagnosticsBridge)
			{
				// TODO: the bridge takes errors from parsing and displays little squigglies and gutter exclaimnations
				//   this on the other hand, takes error from actually compiling with clang and adds them to the bridge
				window.diagnosticsBridge.collectedLogLines = window.terminalLog?.map(log =>
					typeof log === 'object' && log !== null ? (log.text || '') : log
				);
				window.diagnosticsBridge.triggerBridgeRefresh(aceEditor.getSession());
			}

			console.log("[Ace Lazy] Compiler diagnostics overlay successfully linked.");
		});
	});
}
