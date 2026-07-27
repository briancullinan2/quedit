import { SourceMetadata } from "./global.d";

declare global
{
	interface Window
	{
		COMMAND_SCHEMA: CommandSchema;
	}
	var TERMINATE: boolean;
	var needsHeaders: boolean;
	var api: WorkerAPI | MockAPI;
	function terminalWrite(message: string, source?: SourceMetadata | string, skipActualWrite?: boolean): void;
	function downloadHeaders(headers: any, batchSize?: number, database?: string | null): Promise<void>;
}



