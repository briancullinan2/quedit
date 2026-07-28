
// @ts-check


/** @type {import('./make.d').CompilerWindow} */
const workerSelf = /** @type {any} */ (self);

class LanguageAPI
{

	database = null;
	github_token = null;

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	constructor(options)
	{
		this.nextResponseId = 0;
		this.responseCBs = new Map();

		// Target your dedicated ANTLR background worker thread
		this.worker = new Worker('components/rosetta/worker-language.js');

		const channel = new MessageChannel();
		this.port = channel.port1;
		this.port.onmessage = this.onmessage.bind(this);

		this.hostWrite = options.hostWrite;
		this.configuration = options.configuration || 'release';

		const remotePort = channel.port2;
		this.worker.postMessage({ id: 'constructor', data: remotePort }, [remotePort]);
	}

	/**
	 * Propagates environment constants over to the parsing pipeline worker context
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	inject(options)
	{
		options.configuration = options.configuration || workerSelf.SettingsToolbar?.configuration?.value || this.configuration || 'release';
		options.database = options.database || workerSelf.engineRepository || this.database;
		options.github_token = options.github_token || workerSelf.githubToken || this.github_token;
	}

	/**
	 *
	 * @param {number} value
	 */
	setShowTiming(value)
	{
		this.port.postMessage({ id: 'setShowTiming', data: value });
	}

	terminate()
	{
		this.worker.terminate();
	}

	/**
	 * Core Promisified Worker Loop Execution Gateway with 60-second timeouts
	 * @param {string} id
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async runAsync(id, options)
	{
		const responseId = ++this.nextResponseId;

		workerSelf.runningCommand = true;

		const responsePromise = new Promise((resolve, reject) =>
		{
			const timeoutId = setTimeout(() =>
			{
				if(this.responseCBs.has(responseId))
				{
					this.responseCBs.delete(responseId);
					reject(new Error(`LanguageAPI runAsync timeout: No response for id ${id} (responseId: ${responseId}) after 60 seconds.`));
				}
			}, 60000);

			this.responseCBs.set(responseId, { resolve, reject, timeoutId });
		});

		this.port.postMessage({ id, responseId, data: options });
		return await responsePromise;
	}

	// =====================================================================
	// HIGH-FIDELITY PARSING ENDPOINT HOOKS
	// =====================================================================

	/**
	 * Line-bounded fast text tokenizer endpoint (Cursor tracking / Light decorators)
	 * @param {string} text - Complete source code string block
	 * @param {string} language - Target language key match (e.g. "c", "javascript", "rust")
	 * @param {number} line - Target row boundary line target (1-indexed matching ANTLR spec)
	 */
	async getLineTokens(text, language, line)
	{
		const options = { text, language, line };
		this.inject(options);
		return this.runAsync('lineToken', options);
	}

	/**
	 * Massive flat stream extraction engine (Ace syntax highlighting / Token map dumps)
	 * @param {string} text - Complete source code string block
	 * @param {string} language - Target language key match
	 */
	async getAllTokens(text, language)
	{
		const options = { text, language };
		this.inject(options);
		return this.runAsync('tokens', options);
	}

	/**
	 * Deep Abstract Syntax Tree Context Semantic Explorer
	 * @param {string} text - Complete source code string block
	 * @param {string} language - Target language key match
	 */
	async getAnnotations(text, language)
	{
		const options = { text, language };
		this.inject(options);
		return this.runAsync('annotations', options);
	}

	/**
	 * Event Router Callback
	 * @param {MessageEvent} event
	 */
	onmessage(event)
	{
		switch(event.data.id)
		{
			case 'write':
				if(event.data.data && typeof event.data.data.text !== 'undefined'
					&& !event.data.data.text
				) return;

				if(this.hostWrite)
				{
					this.hostWrite(event.data.data.text || event.data.data, event.data.data.source);
				}
				break;

			case 'done':
				workerSelf.detachedConsole = false;
				workerSelf.runningWorker = false;
			// Fall-through intended matching base pipeline patterns

			case 'runAsync': {
				const responseId = event.data.responseId;
				const promise = this.responseCBs.get(responseId);
				if(promise)
				{
					// Clear structural safety timeout instantly
					clearTimeout(promise.timeoutId);
					this.responseCBs.delete(responseId);

					if(event.data.data && event.data.data.error)
					{
						promise.reject(new Error(event.data.data.error));
					} else
					{
						promise.resolve(event.data.data);
					}
				}
				break;
			}
		}
	}
}



class WorkerAPI
{
	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	constructor(options)
	{
		this.nextResponseId = 0;
		this.responseCBs = new Map();
		this.worker = new Worker('components/compiler/worker.js');
		const channel = new MessageChannel();
		this.port = channel.port1;
		this.port.onmessage = this.onmessage.bind(this);
		this.configuration = options.configuration || 'release';
		this.hostWrite = options.hostWrite;

		const remotePort = channel.port2;
		this.worker.postMessage({ id: 'constructor', data: remotePort },
			[remotePort]);
	}

	/**
	 *
	 * @param {number} value
	 */
	setShowTiming(value)
	{
		this.port.postMessage({ id: 'setShowTiming', data: value });
	}

	terminate()
	{
		this.worker.terminate();
	}


	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	inject(options)
	{
		let currentConfig = options.configuration || workerSelf.SettingsToolbar?.configuration?.value || this.configuration || 'release';
		this.configuration = options.configuration = currentConfig === 'debug' ? 'debug' : 'release';
		this.database = options.database = options.database || workerSelf.engineRepository || this.database;
		this.width = options.width = options.width = workerSelf.mostRecentTerminalCols || 120;
		this.github_token = options.github_token = options.github_token = this.github_token;
		this.toolsRepo = options.toolsRepo = options.toolsRepo || workerSelf.toolsRepository || this.toolsRepo;
		this.toolsRepo2 = options.toolsRepo2 = options.toolsRepo2 || workerSelf.tools2Repository || this.toolsRepo2;
		this.engineRepo = options.engineRepo = options.engineRepo || workerSelf.engineRepository || this.engineRepo;
		this.gameRepo = options.gameRepo = options.gameRepo || workerSelf.gameRepository || this.gameRepo;
		this.assetRepo = options.assetRepo = options.assetRepo || workerSelf.assetRepository || this.assetRepo;
	}


	/**
	 * @param {string} id
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async runAsync(id, options)
	{
		const responseId = ++this.nextResponseId;

		const responsePromise = new Promise((resolve, reject) =>
		{
			// Create the timeout
			const timeoutId = setTimeout(() =>
			{
				if(this.responseCBs.has(responseId))
				{
					this.responseCBs.delete(responseId);
					reject(new Error(`runAsync timeout: No response for id ${id} (responseId: ${responseId}) after 60 seconds.`));
				}
			}, 60000);

			// Store resolve/reject AND the timeoutId so we can cancel it later
			this.responseCBs.set(responseId, {
				resolve,
				reject,
				timeoutId
			});
		});

		workerSelf.runningWorker = true;
		this.port.postMessage({ id, responseId, data: options });
		return await responsePromise;
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async compileToAssembly(options)
	{
		return this.runAsync('compileToAssembly', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async compileTo6502(options)
	{
		return this.runAsync('compileTo6502', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async upload(options)
	{
		this.inject(options);
		return this.runAsync('upload', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async download(options)
	{

		return this.runAsync('download', options);
	}

	/**
	 *
	 * @param {string} owner
	 * @param {string} repo
	 * @param {string} header
	 * @param {string} database
	 * @returns
	 */
	async header(owner, repo, header, database)
	{
		let options = { owner, repo, header, database };
		this.inject(options);
		return this.runAsync('header', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async compile(options)
	{
		this.inject(options);
		return this.runAsync('compile', options);
	}

	/**
	 *
	 * @param {string} database
	 * @param {string} action
	 * @returns
	 */
	async build(database, action = 'all')
	{
		let options = {
			database: database || this.database || (workerSelf.RepositoryToolbar?.owner?.value + '/' + workerSelf.RepositoryToolbar?.repository?.value),
			action,
		};
		this.inject(options);
		return this.runAsync('build', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async run(options)
	{
		this.inject(options);
		return this.runAsync('run', options);
	}

	/**
	 * @param {import('./worker').WorkerCommandOptions} options
	 */
	async link(options)
	{
		this.inject(options);
		return this.runAsync('link', options);
	}

	/**
	 *
	 * @param {ArrayBuffer} contents
	 * @param {number} width
	 */
	compileLinkRun(contents, width = 80)
	{
		this.port.postMessage({ id: 'compileLinkRun', data: { contents, width } });
	}

	/**
	 *
	 * @param {OffscreenCanvas} offscreenCanvas
	 */
	postCanvas(offscreenCanvas)
	{
		this.port.postMessage({ id: 'postCanvas', data: offscreenCanvas },
			[offscreenCanvas]);
	}

	/**
	 *
	 * @param {string} filename
	 * @returns
	 */
	async remove(filename)
	{
		const options = {
			filename: filename
		};
		this.inject(options);
		return await this.runAsync('remove', options);
	}

	/**
	 *
	 * @param {MessageEvent} event
	 * @returns
	 */
	onmessage(event)
	{
		switch(event.data.id)
		{
			case 'write':
				if(event.data.data && typeof event.data.data.text !== 'undefined'
					&& !event.data.data.text
				) return;
				this.hostWrite(event.data.data.text || event.data.data, event.data.data.source);
				break;

			case 'done':
				workerSelf.detachedConsole = false;
				workerSelf.runningWorker = false;
			case 'runAsync': {
				const responseId = event.data.responseId;
				const promise = this.responseCBs.get(responseId);
				if(promise)
				{
					this.responseCBs.delete(responseId);

					if(event.data.data instanceof Error)
					{
						if(event.data.data.message.includes('memory access out of bounds'))
						{
							workerSelf.needsHeaders = true;
						}
						promise.reject(event.data.data);
					}
					else
						promise.resolve(event.data.data);
				}
				break;
			}
		}
	}
}

const language = new LanguageAPI({
	hostWrite: workerSelf.specialWrite
});

workerSelf.api = new WorkerAPI({
	hostWrite: workerSelf.specialWrite
});
workerSelf.api.github_token = workerSelf.githubToken;
