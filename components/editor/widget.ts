import { DockPanel, Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Ace } from 'ace-builds';
import type { SettingConfig, Settings } from '../bundle/settings';
import type { HistoryToolbar } from '../bundle/menu-history';
import type { LayoutAdjuster } from '../bundle/lumino-widget';
import type { TerminalLogEntry } from '../terminal/widget';

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

interface AceSession extends Ace.EditSession
{
	workspaceFileId?: string;
	$worker?: Worker;
}

declare global
{
	const ace: typeof Ace & {
		edit(el: string | HTMLElement, options?: any): any;
		createEditSession(text: string | Ace.Document, mode?: any): AceSession;
		Range: new (startRow: number, startColumn: number, endRow: number, endColumn: number) => Ace.Range;
		config: {
			loadModule: (module: [string, string], callback: () => void) => void;
		};
		require: (modules: string[], callback: (moduleExports: any) => void) => void;
	};

	interface Window
	{
		tempCount: number;
		IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
		ace: typeof ace;
		LayoutAdjuster: typeof LayoutAdjuster;
		mainDock: DockPanel;
		getGitShaBrowser: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
		compilerDiagnostics?: any;
		diagnosticsBridge: any;
		AceEditorWidget: typeof AceEditorWidget;
		historyToolbar: HistoryToolbar;
		SettingsManager: Settings;
		terminalLog: TerminalLogEntry[];
	}
}

const EXTENSION_TO_MODE: Record<string, string> = {
	// =====================================================================
	// 1. ACTIVE ANTLR PIPELINE ROUTING LAYER ('antlr_worker')
	// =====================================================================
	'c': 'antlr_worker', 'cc': 'antlr_worker', 'cpp': 'antlr_worker',
	'cxx': 'antlr_worker', 'h': 'antlr_worker', 'hh': 'antlr_worker',
	'hpp': 'antlr_worker', 'hxx': 'antlr_worker', 'i': 'antlr_worker',
	'ino': 'antlr_worker',

	'angelscript': 'antlr_worker', 'lua': 'antlr_worker',

	'wat': 'antlr_worker', 'asm': 'antlr_worker', 's': 'antlr_worker',
	'pdp7': 'antlr_worker',

	'js': 'antlr_worker', 'cjs': 'antlr_worker', 'mjs': 'antlr_worker',
	'jsm': 'antlr_worker', 'ts': 'antlr_worker', 'html': 'antlr_worker',
	'htm': 'antlr_worker', 'xhtml': 'antlr_worker', 'css': 'antlr_worker',
	'json': 'antlr_worker', 'gql': 'antlr_worker', 'graphql': 'antlr_worker',

	'php': 'antlr_worker', 'phtml': 'antlr_worker', 'cs': 'antlr_worker',
	'csx': 'antlr_worker', 'go': 'antlr_worker', 'rs': 'antlr_worker',

	'java': 'antlr_worker', 'py': 'antlr_worker', 'pyw': 'antlr_worker',

	'postgresql': 'antlr_worker', 'pgsql': 'antlr_worker', 'sqlite': 'antlr_worker',
	'plsql': 'antlr_worker', 'tsql': 'antlr_worker', 'mysql': 'antlr_worker',
	'sql': 'antlr_worker',

	'cmakelists.txt': 'antlr_worker',
	'cmake': 'antlr_worker', 'proto': 'antlr_worker', 'toml': 'antlr_worker',
	'xml': 'antlr_worker', 'xsd': 'antlr_worker', 'xsl': 'antlr_worker',
	'csv': 'antlr_worker', 'properties': 'antlr_worker', 'props': 'antlr_worker',
	'terraform': 'antlr_worker',

	// =====================================================================
	// 2. ID TECH 3 / QUAKE DEDICATED ASSET PIPELINE LAYER ('antlr_worker')
	// =====================================================================
	'arena': 'antlr_worker',     // Q3ArenaParser
	'cam': 'antlr_worker',       // Q3CameraParser
	'cfg': 'antlr_worker',       // Q3ConfigParser
	'map': 'antlr_worker',       // Q3MapParser / QuakeMapParser
	'menu': 'antlr_worker',      // Q3MenuParser
	'shader': 'antlr_worker',    // Q3ShaderParser
	'shaderx': 'antlr_worker',   // Q3ShaderParser variant
	'skin': 'antlr_worker',      // Q3SkinParser

	// =====================================================================
	// 3. PRESERVED EXTENSIONS & FALLBACK MODES (UNCOVERED PIPELINES)
	// =====================================================================
	'abap': 'abap',
	'abc': 'abc',
	'ada': 'ada',
	'adb': 'ada',
	'ahk': 'autohotkey',
	'apex': 'apex',
	'applescript': 'applescript',
	'as': 'actionscript',
	'bat': 'batchfile',
	'cbl': 'cobol',
	'cfc': 'coldfusion',
	'cfm': 'coldfusion',
	'cl': 'lisp',
	'clj': 'clojure',
	'cljs': 'clojure',
	'cls': 'apex',
	'cmd': 'batchfile',
	'cob': 'cobol',
	'coffee': 'coffee',
	'conf': 'apache_conf',
	'd': 'd',
	'dart': 'dart',
	'diff': 'diff',
	'dockerfile': 'dockerfile',
	'dot': 'dot',
	'e': 'eiffel',
	'edn': 'clojure',
	'ejs': 'ejs',
	'erl': 'erlang',
	'ex': 'elixir',
	'exs': 'elixir',
	'f': 'fortran',
	'f90': 'fortran',
	'f95': 'fortran',
	'for': 'fortran',
	'forth': 'forth',
	'frag': 'glsl',
	'fs': 'fsharp',
	'fsi': 'fsharp',
	'fsx': 'fsharp',
	'fth': 'forth',
	'ftl': 'freemarker',
	'gcode': 'gcode',
	'gitignore': 'ini',
	'glsl': 'glsl',
	'vlsl': 'glsl',
	'hlsl': 'glsl',
	'groovy': 'groovy',
	'gsh': 'groovy',
	'gvy': 'groovy',
	'gy': 'groovy',
	'haml': 'haml',
	'handlebars': 'handlebars',
	'hbs': 'handlebars',
	'hjson': 'hjson',
	'hrl': 'erlang',
	'hs': 'haskell',
	'htaccess': 'apache_conf',
	'ini': 'ini',
	'jade': 'pug',
	'jl': 'julia',
	'jsp': 'jsp',
	'jsx': 'jsx',
	'kt': 'kotlin',
	'kts': 'kotlin',
	'less': 'less',
	'liquid': 'liquid',
	'lisp': 'lisp',
	'log': 'text',
	'ls': 'livescript',
	'lsp': 'lisp',
	'ltx': 'latex',
	'm': 'matlab',
	'makefile': 'makefile',
	'make': 'makefile',
	'markdown': 'markdown',
	'md': 'markdown',
	'mel': 'mel',
	'mk': 'makefile',
	'ml': 'ocaml',
	'mli': 'ocaml',
	'mm': 'objectivec',
	'nginx': 'nginx',
	'nim': 'nim',
	'nix': 'nix',
	'nsh': 'nsis',
	'nsi': 'nsis',
	'pas': 'pascal',
	'patch': 'diff',
	'perl': 'perl',
	'pig': 'pig',
	'pl': 'perl',
	'pm': 'perl',
	'pp': 'pascal',
	'powershell': 'powershell',
	'prefs': 'ini',
	'ps1': 'powershell',
	'psm1': 'powershell',
	'pug': 'pug',
	'puppet': 'puppet',
	'q': 'q',
	'r': 'r',
	'rb': 'ruby',
	'rdoc': 'rdoc',
	'rhtml': 'ruby',
	'rprofile': 'r',
	'sass': 'sass',
	'sbt': 'scala',
	'scad': 'scad',
	'scala': 'scala',
	'scheme': 'scheme',
	'scm': 'scheme',
	'scss': 'scss',
	'sh': 'sh',
	'sieve': 'sieve',
	'slim': 'slim',
	'smali': 'smali',
	'smarty': 'smarty',
	'ss': 'scheme',
	'styl': 'stylus',
	'svg': 'svg',
	'swift': 'swift',
	'tcl': 'tcl',
	'tex': 'latex',
	'tpl': 'smarty',
	'tsx': 'tsx',
	'twig': 'twig',
	'txt': 'text',
	'wasm': 'wasm_disassembly',
	'qvm': 'qvm_disassembly',
	'v': 'verilog',
	'vala': 'vala',
	'vapi': 'vala',
	'vbe': 'vbscript',
	'vbs': 'vbscript',
	'vert': 'glsl',
	'vh': 'verilog',
	'vhd': 'vhdl',
	'vhdl': 'vhdl',
	'vue': 'vue',
	'yaml': 'yaml',
	'yml': 'yaml',
	'zig': 'zig',
	'zsh': 'sh'
};

function getModeByFilename(filePath: string)
{
	const ext = filePath.split('.').pop()?.toLowerCase();
	const filenameAsType = filePath.split('/').pop()?.toLowerCase();
	const modeKey = ((!ext || !EXTENSION_TO_MODE[ext] || ext === 'txt')
		&& filenameAsType && EXTENSION_TO_MODE[filenameAsType])
		? filenameAsType : ext;
	if(modeKey)
	{
		return `ace/mode/${EXTENSION_TO_MODE[modeKey] || 'text'}`;
	} else
	{
		return `ace/mode/'text'`;
	}
}


let navTimer: ReturnType<typeof setTimeout> | undefined;


/*
// TODO: fix block tracker
function onBlockTrackerCursorChange(aceEditor: Ace.Editor): void
{
	if(typeof NavHistory !== "undefined" && NavHistory.isNavigating)
	{
		return;
	}

	if(navTimer)
	{
		clearTimeout(navTimer);
	}

	navTimer = setTimeout(() =>
	{
		const session = aceEditor.getSession() as Ace.EditSession & { workspaceFileId?: string | number; };
		if(!session) return;

		const pos = aceEditor.getCursorPosition();
		const currentFile = typeof window.currentOpenFileId !== "undefined" ? window.currentOpenFileId : null;

		const humanRow = pos.row + 1;
		const humanCol = pos.column + 1;

		const lastPoint: NavPoint | null = typeof NavHistory !== "undefined"
			? NavHistory.stack[NavHistory.index]
			: null;

		if(!lastPoint || lastPoint.fileId !== currentFile || Math.abs(lastPoint.row - humanRow) > 5)
		{
			if(typeof NavHistory !== "undefined")
			{
				NavHistory.push(currentFile, humanRow, humanCol);
			}
		}

		if(typeof window.updateEditorLineIds === "function")
		{
			window.updateEditorLineIds();
		}

		// Strongly type the hidden multi-layered Web Worker client inside Ace
		const workerContainer = session as AceSession;
		const activeWorker = workerContainer.$worker?.$worker;

		if(activeWorker)
		{
			activeWorker.postMessage({
				event: "calculateActiveBlockRange",
				data: { lineNumber: humanRow }
			});

			activeWorker.postMessage({
				event: "getFoldRegions",
				data: { fileId: session.workspaceFileId ?? null }
			});
		}

	}, 150);
}
*/

function bindBlockTrackerToSession(session: Ace.EditSession)
{
	if(!session || !session.selection) return;

	// Remove any pre-existing tracker handle on this session to prevent duplicate fire leaks
	//session.selection.off("changeCursor", onBlockTrackerCursorChange);

	// Bind the execution frame cleanly
	//session.selection.on("changeCursor", onBlockTrackerCursorChange);
}



/**
 * Global static coordinator managing pool instances to facilitate cross-widget reuse.
 */
class AceEditorPool
{
	static instances: Array<{ editor: Ace.Editor; inUse: boolean; }> = [];
	public static sessionCache: ISessionCache = {};

	public static getOrCreateAceSession(fileId: string, content: string): any
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

		bindBlockTrackerToSession(session);

		if(fileId.endsWith('.c') || fileId.endsWith('.h'))
		{
			session.setTabSize(4);
		}

		this.sessionCache[fileId] = session;
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
export class AceEditorWidget extends Widget
{
	protected _fileId: string;
	protected _initialContent: string;
	protected _editor: Ace.Editor | null = null;
	protected static _defaultContent: string = '#include <stdio.h>\n\n// this is a comment\n\nint main() {\n    printf("Hello, Lumino!\\n")\n    printf("WASI Compiler Check: SUCCESS\\n");\n    return 0;\n}\n';

	constructor(fileId?: string, initialContent?: string)
	{
		super();
		this.addClass('lm-AceEditorWidget');

		this._fileId = fileId || AceEditorPool.getNextTempName();
		this._initialContent = initialContent || AceEditorWidget._defaultContent;

		// Ensure Lumino layout updates do not break text selection systems
		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';

		this.title.label = fileId || this._fileId;
		this.title.closable = true;

		window.SettingsManager.hydrateAll(LOCAL_SETTINGS.editor);
	}

	public get fileId(): string
	{
		return this._fileId;
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
		const session = AceEditorPool.getOrCreateAceSession(this._fileId, this._initialContent);
		this._editor.setSession(session);

		// Synchronize and render bounds accurately
		this._editor.resize();
		this._editor.renderer.updateFull();

		tryLoadingTerminalEditorBridge(this._editor);
	}

	/**
	 * Fired when Lumino swaps tabs out of layout visibility scope.
	 */
	protected onBeforeDetach(msg: Message): void
	{
		if(this._editor)
		{
			AceEditorPool.releaseEditor(this._editor);
			this._editor = null;
		}
		super.onBeforeDetach(msg);
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
	}

	// Call this function inside your file tree selection/click event listener
	static openFileInNewTab(fileId: string, fileName: string, fileContent: string)
	{
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
			&& (t as AceEditorWidget)._editor?.getValue() === AceEditorWidget._defaultContent
		) as AceEditorWidget;
		if(existingDefault)
		{
			existingDefault.title.label = fileName;
			existingDefault._initialContent = fileContent;
			const session = AceEditorPool.getOrCreateAceSession(fileId, fileContent);
			existingDefault._editor?.setSession(session);

			// Synchronize and render bounds accurately
			existingDefault._editor?.resize();
			existingDefault._editor?.renderer.updateFull();

			tryLoadingTerminalEditorBridge(existingDefault._editor);
			window.mainDock.activateWidget(existingDefault);
			return;
		}

		// 2. Create the new custom Ace Lumino widget instance
		const newTab = new AceEditorWidget(fileId, fileContent);
		newTab._fileId = fileId;
		newTab._initialContent = fileContent;

		newTab.title.label = fileName;
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
				const session = AceEditorPool.getOrCreateAceSession(self._fileId, self._initialContent);
				self._editor.setSession(session);
				self._editor.resize();
				self._editor.renderer.updateFull();
				tryLoadingTerminalEditorBridge(self._editor);
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


function tryLoadingTerminalEditorBridge(aceEditor: Ace.Editor | null): void
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
