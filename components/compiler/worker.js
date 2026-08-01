
// @ts-check

/** @type {Worker & import('./worker.d').WorkerWindow} */
const workerSelf = /** @type {any} */ (self);


/*
 * Copyright 2020 WebAssembly Community Group participants
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

workerSelf.importScripts?.('../core/preambles.js');
workerSelf.importScripts?.('../compiler/logging.js');
workerSelf.importScripts?.('../compiler/shared.js');
workerSelf.importScripts?.('../core/local.js');
workerSelf.importScripts?.('../engine/sys_fs.js');
workerSelf.importScripts?.('../engine/sys_std.js');
workerSelf.importScripts?.('../engine/sys_web.js');
workerSelf.importScripts?.('../workers/github.js');
workerSelf.importScripts?.('../compiler/make.js');
workerSelf.importScripts?.('../compiler/make-tools.js');
workerSelf.importScripts?.('../compiler/make-qvm.js');

if(typeof workerSelf.TERMINATE === 'undefined')
{
	workerSelf.TERMINATE = false;
}

const Module = {

};
const ENV = {
	wasi_unstable: {}
};
ENV.ENV = ENV;

/** @type {MessagePort} */
let port;
let canvas;
let ctx2d;

const apiOptions = {

	/**
	 *
	 * @param {string} filename
	 * @returns
	 */
	async readBuffer(filename)
	{
		const response = await fetch(filename, {
			mode: 'cors',
			credentials: 'omit'
		});
		return response.arrayBuffer();
	},

	/**
	 *
	 * @param {string | Uint8Array | ArrayBuffer} filename
	 * @returns
	 */
	async compileStreaming(filename)
	{
		try
		{
			if(filename instanceof Uint8Array)
			{
				return await WebAssembly.compile(/** @type {BufferSource} */(filename.buffer));
			}
			if(filename instanceof ArrayBuffer)
			{
				return await WebAssembly.compile(filename);
			}

			const targetUrl = filename.startsWith('/') ? filename : ('/' + filename);
			let response;
			if(targetUrl.includes('github.com'))
			{
				response = await fetch(targetUrl, {
					mode: 'cors',
					credentials: 'omit'
				});
			} else
			{
				response = await fetch(targetUrl, {
					mode: 'cors',
					credentials: 'omit'
				});
			}

			if(!response.ok)
			{
				throw new Error('Response code: ' + response.status);
			}

			// Verify the MIME type matches the spec requirement for streaming
			const contentType = response.headers.get('Content-Type');
			if(WebAssembly.compileStreaming && contentType === 'application/wasm')
			{
				return await WebAssembly.compileStreaming(response);
			} else
			{
				// Safe fallback if server sent wrong headers or if the connection was flaky
				const result = await response.arrayBuffer();
				return await WebAssembly.compile(result);
			}
		}
		catch(e)
		{
			throw e;
		}
	},

	/**
	 *
	 * @param {string} s
	 * @param {string | string[]} source
	 */
	hostWrite(s, source)
	{
		port.postMessage({ id: 'write', data: { text: s, source: source } });
	}
};

let currentApp = null;

/**
 *
 * @param {MessageEvent} event
 */
const onAnyMessage = async event =>
{
	if(workerSelf.api && event.data.data && event.data.data.github_token)
		workerSelf.api.github_token = event.data.data.github_token;
	if(workerSelf.api && event.data.data && event.data.data.width)
		workerSelf.api.width = event.data.data.width;
	if(workerSelf.api && event.data.data && event.data.data.database)
		workerSelf.api.database = event.data.data.database;
	if(workerSelf.api && event.data.data && event.data.data.toolsRepo)
		workerSelf.api.toolsRepo = event.data.data.toolsRepo;
	if(workerSelf.api && event.data.data && event.data.data.engineRepo)
		workerSelf.api.engineRepo = event.data.data.engineRepo;
	if(workerSelf.api && event.data.data && event.data.data.gameRepo)
		workerSelf.api.gameRepo = event.data.data.gameRepo;
	if(workerSelf.api && event.data.data && event.data.data.assetRepo)
		workerSelf.api.assetRepo = event.data.data.assetRepo;
	if(workerSelf.api && event.data.data && event.data.data.toolsRepo2)
		workerSelf.api.toolsRepo2 = event.data.data.toolsRepo2;
	const responseId = event.data?.responseId || (event.data?.id === 0 ? 0 : null);
	switch(event.data.id)
	{
		case 'constructor':
			port = event.data.data;
			port.onmessage = onAnyMessage;
			workerSelf.api = new workerSelf.API(apiOptions);
			await workerSelf.api?.ready;
			break;

		case 'setShowTiming':
			if(workerSelf.api)
			{
				workerSelf.api.showTiming = event.data.data;
			}
			break;

		case 'compileToAssembly': {
			let output = null;

			try
			{
				output = await workerSelf.api?.compileToAssembly(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'compileTo6502': {
			let output = null;

			try
			{
				output = await workerSelf.api?.compileTo6502(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'header': {
			let output = null;
			workerSelf.api?.extract(event.data.data);

			try
			{
				output = await workerSelf.api?.header?.(event.data.data.header, true);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'upload': {
			let output = null;

			try
			{
				output = await workerSelf.api?.upload(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}


		case 'build': {
			let output = null;
			let selected = event.data.data.database || workerSelf.api?.database;
			let mode = event.data.data.action;
			if(workerSelf.api && event.data.data.configuration)
			{
				workerSelf.api.database = selected;
				workerSelf.api.configuration = event.data.data.configuration;
			}

			try
			{
				workerSelf.api?.build?.(selected, mode);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}




		case 'download': {
			let output = null;

			try
			{
				output = await workerSelf.api?.download?.(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'link': {
			let output = null;

			try
			{
				output = await workerSelf.api?.link?.(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'compile': {
			let output = null;

			try
			{
				output = await workerSelf.api?.compile?.(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'run': {
			let output = null;
			let filePath;
			try
			{
				if(workerSelf.api && event.data.data.database)
					workerSelf.api.database = event.data.data.database;
				if(workerSelf.api && event.data.data.toolsRepo)
					workerSelf.api.toolsRepo = event.data.data.toolsRepo;
				if(workerSelf.api && event.data.data.configuration)
					workerSelf.api.configuration = event.data.data.configuration;

				await workerSelf.api?.ready;

				let module = await workerSelf.api?.getModule(event.data.data.tool);
				let app = new workerSelf.API.App(workerSelf.api, workerSelf.api?.hostWrite, module, workerSelf.api?.sysrootFilename, ...event.data.data.args || []);


				let paths = event.data.data.paths;
				if(paths && workerSelf.api?.database)
				{
					for(filePath of paths)
					{
						if(!filePath) continue;
						await workerSelf.api.header?.(filePath, true);
					}
				}

				if(event.data.data.args)
				{
					for(filePath of event.data.data.args)
					{
						if(!filePath) continue;
						await workerSelf.api?.header?.(filePath);
					}
				}

				await workerSelf.api?.run?.(
					app || event.data.data.tool,
					...event.data.data.args || []
				);


				if(paths && workerSelf.api?.database)
				{
					for(filePath of paths)
					{
						if(!filePath) continue;
						try
						{


							if(workerSelf.api.memfs && workerSelf.api.memfs.exists(filePath))
							{
								let bytes = workerSelf.api.memfs.getFileContents(filePath);
								if(bytes.length > 0)
								{
									workerSelf.FS.virtual[filePath] = {
										timestamp: new Date(),
										mode: workerSelf.FS_FILE ?? (0o100000 | 0o666),
										contents: bytes.slice(),
										path: filePath,
										sha: await workerSelf.getGitShaBrowser(bytes),
										parent: filePath.substring(0, filePath.lastIndexOf('/'))
									};

								}
							}
							else if(workerSelf.api.memfs && workerSelf.FS.virtual[filePath] && workerSelf.FS.virtual[filePath]?.contents)
							{
								workerSelf.api.memfs.addFile(filePath, workerSelf.FS.virtual[filePath]?.contents);
							}


							const record = workerSelf.FS.virtual[filePath];
							if(record && record.contents?.length)
							{
								console.log('Run succeeded: ' + filePath + '\n\r');

								if(workerSelf.api?.database)
								{
									await workerSelf.putRecord?.(workerSelf.DB_STORE_NAME ?? '', record, workerSelf.api.database);
								}
							}
						} catch(e)
						{
							if(e instanceof Error)
							{
								console.log(`${e.message}\n\r${e.stack}`);
							}
						}
					}
				}

			}
			catch(e)
			{
				if(e instanceof Error)
				{
					workerSelf.api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
				}
				output = e;
				throw e;
			}
			finally
			{
				port.postMessage({ id: 'runAsync', responseId, data: output });
			}
			break;
		}

		case 'compileLinkRun':
			if(currentApp)
			{
				console.log('First, disallowing rAF from previous app.');
				// Stop running rAF on the previous app, if any.
				currentApp.allowRequestAnimationFrame = false;
			}
			currentApp = await workerSelf.api?.compileLinkRun(event.data.data);
			console.log(`finished compileLinkRun. currentApp = ${currentApp}.`);
			break;

		case 'postCanvas':
			canvas = event.data.data;
			ctx2d = canvas.getContext('2d');
			break;
		//
		case 'remove':
			const filename = event.data.filename;
			workerSelf.api?.extract(event.data.data);
			const rx = workerSelf.globToRegex?.(filename);
			for(let path of Object.keys(workerSelf.FS.virtual))
			{
				if(rx?.test(path))
				{
					delete workerSelf.FS.virtual[filename];
					console.log(`Removing ${filename} from worker memory\n\r`);
				}
			}

			// TODO: fix this
			try
			{
				if(workerSelf.api?.memfs)
				{
					await workerSelf.api?.ready;
					workerSelf.api.memfs.mem.check();
					if(workerSelf.api.memfs.exists(filename))
					{
						workerSelf.api.memfs.mem.check();
						const buf = workerSelf.api.memfs.exports.GetPathBuf();
						workerSelf.api.memfs.mem.write(buf, filename);
						workerSelf.api.memfs.exports.path_unlink_file(buf);
					}
				}
			} catch(e)
			{
				console.error(e);
			}
			break;
	}

	port.postMessage({ id: 'done', responseId, data: workerSelf.api?.pid || true });
};

workerSelf.addEventListener('message', onAnyMessage);

