

export interface LuminoWindow
{
	resolveDirectoryHandle(
		rootHandle: FileSystemDirectoryHandle,
		pathSegments: string[]
	): Promise<FileSystemDirectoryHandle>;

	ensureDatabaseContainer(database: string): Promise<void>;

	IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
}
