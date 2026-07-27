import type { GlobalToolbars } from "./menu.d";


export interface DatabaseMetadata
{
	key: string;
	value: number;
}

export interface InstallCheckResult
{
	item1: string | null;
	item2: number;
	item3: boolean;
	item4: string[];
}

export interface SetupDatabaseResult
{
	item1: boolean;
	item2: string;
}

export interface FileRecord
{
	timestamp?: Date | null;
	mode: number;
	contents?: Uint8Array | ArrayBuffer | FileSystemDirectoryHandle | any;
	path: string;
	sha?: string | null;
	parent?: string | null;
}

export interface SchemaIndexConfig
{
	key: string;
	value: string;
}

export interface SchemaStoreConfig
{
	key: string;
	value: {
		item1: string; // keyPath
		item2: SchemaIndexConfig[]; // indexes
	};
}

export interface DebounceToken
{
	promise: Promise<any> | null;
	resolve: ((value: any) => void) | null;
	reject: ((reason: any) => void) | null;
	timer: ReturnType<typeof setTimeout> | null;
	latestArgs: {
		storeName: string;
		indexName: string;
		record: string | FileRecord | any;
		lower: any;
		upper: any;
		dbName: string | undefined | null;
		ownerName: string;
		repoName: string;
	};
}


export interface LocalWindow extends GlobalToolbars
{
	getDatabaseMetadata?: () => Promise<DatabaseMetadata[]>;
	queryIndex?: (
		storeName: string,
		indexName: string,
		exactIndex: any,
		lower: any,
		upper: any,
		dbName: string | null,
		noBounce?: boolean
	) => Promise<FileRecord[]>;
	putRecord?: (storeName: string, record: FileRecord, dbName: string | null, noBounce?: boolean) => Promise<any>;
	getRecord?: (storeName: string, record: string, dbName: string | null, dbVersion?: number, noBounce?: boolean) => Promise<FileRecord | null>;
	globToRegex?: (pattern: string, caseSensitive?: boolean) => RegExp;
	deleteRecord?: (storeName: string, key: string, dbName: string | null) => Promise<boolean>;

	DB_STORE_NAME?: string;
	DB_SCHEME?: SchemaStoreConfig[];

	ST_DIR?: number;
	ST_FILE?: number;
	FS_FILE?: number;
	FS_DIR?: number;
}

declare var self: Window & LocalWindow & typeof globalThis;
