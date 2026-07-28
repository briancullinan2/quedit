
import type { AceEditor, AceEditorWidget, AceSession } from "./widget";

declare const ace: AceEditor;

export interface EditorWindow
{
	tempCount?: number;
	compilerDiagnostics?: {
		log: (msg: string) => void;
		clear: () => void;
		getBridge: () => {
			refreshActiveEditorView: (session: AceSession) => void;
		};
	};
	ace?: typeof ace;

	diagnosticsBridge?: any;
	AceEditorWidget?: typeof AceEditorWidget;
	previousHashLineNumber?: number | null;
}
