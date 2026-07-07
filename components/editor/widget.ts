import { DockPanel, Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import type { Ace } from 'ace-builds';

interface ISessionCache
{
	[fileId: string]: any;
}

declare global
{
	const ace: typeof Ace & {
		edit(el: string | HTMLElement, options?: any): any;
		createEditSession(text: string | Ace.Document, mode?: any): any;
		Range: new (startRow: number, startColumn: number, endRow: number, endColumn: number) => Ace.Range;
		config: any;
		require(moduleName: string): any;
	};

	interface Window
	{
		ace: typeof ace;
		mainDock: DockPanel;
		getGitShaBrowser: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
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
	private static instances: Array<{ editor: any; inUse: boolean; }> = [];
	public static sessionCache: ISessionCache = {};
	private static tempCount = 1;

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
				(window as any).initialTextSha = (window as any).currentOpenFileId = sha;
			});
		}

		const mode = getModeByFilename(fileId);
		session.setMode(mode);

		bindBlockTrackerToSession(session);

		if(fileId.endsWith('.c') || fileId.endsWith('.h'))
		{
			session.setTabSize(4);
		}

		this.sessionCache[fileId] = session;
		return session;
	}

	public static acquireEditor(): any
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
			if((window as any).savedTheme)
			{
				editor.setTheme((window as any).savedTheme);
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

			item = { editor, inUse: true };
			this.instances.push(item);
		} else
		{
			item.inUse = true;
		}
		return item.editor;
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
		return 'temp' + (++this.tempCount) + '.c';
	}
}

/**
 * Lumino Widget encapsulating targeted tab lifecycle bindings to Ace singleton allocation layers.
 */
export class AceEditorWidget extends Widget
{
	private _fileId: string;
	private _initialContent: string;
	private _editor: any | null = null;
	private _defaultContent: string = '#include <stdio.h>\n\nint main() {\n    printf("Hello, Lumino!\\n")\n    printf("WASI Compiler Check: SUCCESS\n");    return 0;\n}\n';

	constructor(fileId?: string, initialContent?: string)
	{
		super();
		this.addClass('lm-AceEditorWidget');

		this._fileId = fileId || AceEditorPool.getNextTempName();
		this._initialContent = initialContent || this._defaultContent;

		// Ensure Lumino layout updates do not break text selection systems
		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';

		this.title.label = this._fileId;
		this.title.closable = true;
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
		this.node.appendChild(this._editor.container);

		// Fetch original or structural cache descriptors targeting tracking layers
		const session = AceEditorPool.getOrCreateAceSession(this._fileId, this._initialContent);
		this._editor.setSession(session);

		// Synchronize and render bounds accurately
		this._editor.resize();
		this._editor.renderer.updateFull();
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
		const tabs = Array.from(window.mainDock.widgets()) as AceEditorWidget[];
		const existingTab = tabs.find(t => t.fileId === fileId);

		if(existingTab)
		{
			// If it's already open, just activate it and bring it to focus
			window.mainDock.activateWidget(existingTab);
			return;
		}

		// 2. Create the new custom Ace Lumino widget instance
		const newTab = new AceEditorWidget(fileId, fileContent);
		newTab._fileId = fileId;
		newTab._initialContent = fileContent;

		newTab.title.label = fileName;
		newTab.title.closable = true;

		// 3. Drop it directly into the active Dock tab layout stack
		window.mainDock.addWidget(newTab);
		window.mainDock.activateWidget(newTab);
		window.mainDock.fit();
	}
}

