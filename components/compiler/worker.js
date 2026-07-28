
// @ts-check

/** @type {import('./worker.d').WorkerWindow} */
const workerSelf = /** @type {any} */ self;


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

self.importScripts('../core/preambles.js');
self.importScripts('../compiler/logging.js');
self.importScripts('../compiler/shared.js');
self.importScripts('../core/local.js');
self.importScripts('../engine/sys_fs.js');
self.importScripts('../engine/sys_std.js');
self.importScripts('../engine/sys_web.js');
self.importScripts('../filelist/github.js');
self.importScripts('../compiler/make.js');
self.importScripts('../compiler/make-tools.js');
self.importScripts('../compiler/make-qvm.js');

if(typeof self.TERMINATE === 'undefined')
{
	self.TERMINATE = false;
}

const Module = {

};
const ENV = {
	wasi_unstable: {}
};
ENV.ENV = ENV;

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


	hostWrite(s, source)
	{
		port.postMessage({ id: 'write', data: { text: s, source: source } });
	}
};

let currentApp = null;

const onAnyMessage = async event =>
{
	if(api && event.data.data && event.data.data.github_token)
		api.github_token = event.data.data.github_token;
	if(api && event.data.data && event.data.data.width)
		api.width = event.data.data.width;
	if(api && event.data.data && event.data.data.database)
		api.database = event.data.data.database;
	if(api && event.data.data && event.data.data.toolsRepo)
		api.toolsRepo = event.data.data.toolsRepo;
	if(api && event.data.data && event.data.data.engineRepo)
		api.engineRepo = event.data.data.engineRepo;
	if(api && event.data.data && event.data.data.gameRepo)
		api.gameRepo = event.data.data.gameRepo;
	if(api && event.data.data && event.data.data.assetRepo)
		api.assetRepo = event.data.data.assetRepo;
	if(api && event.data.data && event.data.data.toolsRepo2)
		api.toolsRepo2 = event.data.data.toolsRepo2;
	const responseId = event.data?.responseId || (event.data?.id === 0 ? 0 : null);
	switch(event.data.id)
	{
		case 'constructor':
			port = event.data.data;
			port.onmessage = onAnyMessage;
			api = new API(apiOptions);
			await api?.ready;
			break;

		case 'setShowTiming':
			if(api)
			{
				api.showTiming = event.data.data;
			}
			break;

		case 'compileToAssembly': {
			let output = null;

			try
			{
				output = await api?.compileToAssembly(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				output = await api?.compileTo6502(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
			api?.extract(event.data.data);

			try
			{
				output = await api?.header(event.data.data.header, true);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				output = await api?.upload(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
			let selected = event.data.data.database || api?.database;
			let mode = event.data.data.action;
			if(api && event.data.data.configuration)
			{
				api.database = selected;
				api.configuration = event.data.data.configuration;
			}

			try
			{
				api?.build(selected, mode);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				output = await api?.download?.(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				output = await api?.link(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				output = await api?.compile(event.data.data);
			}
			catch(e)
			{
				if(e instanceof Error)
				{
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
				if(api && event.data.data.database)
					api.database = event.data.data.database;
				if(api && event.data.data.toolsRepo)
					api.toolsRepo = event.data.data.toolsRepo;
				if(api && event.data.data.configuration)
					api.configuration = event.data.data.configuration;

				await api?.ready;

				let module = await api?.getModule(event.data.data.tool);
				let app = new API.App(api, api?.hostWrite, module, api?.sysrootFilename, ...event.data.data.args || []);


				let paths = event.data.data.paths;
				if(paths && api?.database)
				{
					for(filePath of paths)
					{
						if(!filePath) continue;
						await api.header(filePath, true);
					}
				}

				if(event.data.data.args)
				{
					for(filePath of event.data.data.args)
					{
						if(!filePath) continue;
						await api.header(filePath);
					}
				}

				await api?.run(
					app || event.data.data.tool,
					...event.data.data.args || []
				);


				if(paths && api?.database)
				{
					for(filePath of paths)
					{
						if(!filePath) continue;
						try
						{


							if(api.memfs && api.memfs.exists(filePath))
							{
								let bytes = api.memfs.getFileContents(filePath);
								if(bytes.length > 0)
								{
									self.FS.virtual[filePath] = {
										timestamp: new Date(),
										mode: self.FS_FILE,
										contents: bytes.slice(),
										path: filePath,
										sha: await self.getGitShaBrowser(bytes),
										parent: filePath.substring(0, filePath.lastIndexOf('/'))
									};

								}
							}
							else if(api.memfs && self.FS.virtual[filePath] && self.FS.virtual[filePath]?.contents)
							{
								api.memfs.addFile(filePath, self.FS.virtual[filePath]?.contents);
							}


							const record = self.FS.virtual[filePath];
							if(record && record.contents?.length)
							{
								console.log('Run succeeded: ' + filePath + '\n\r');

								if(api?.database)
								{
									await self.putRecord(self.DB_STORE_NAME, record, api?.database);
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
					api?.hostWrite?.(`${e.toString()}\n\r${e.stack}\n\r`);
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
			currentApp = await api?.compileLinkRun(event.data.data);
			console.log(`finished compileLinkRun. currentApp = ${currentApp}.`);
			break;

		case 'postCanvas':
			canvas = event.data.data;
			ctx2d = canvas.getContext('2d');
			break;
		//
		case 'remove':
			api.extract(event.data.data);
			const rx = window.globToRegex(filename);
			for(let path of Object.keys(self.FS.virtual))
			{
				if(rx.test(path))
				{
					delete self.FS.virtual[filename];
					terminalWrite(`Removing ${filename} from worker memory\n\r`);
				}
			}

			// TODO: fix this
			try
			{
				if(api?.memfs)
				{
					await api?.ready;
					api.memfs.mem.check();
					if(api.memfs.exists(filename))
					{
						api.memfs.mem.check();
						const buf = api.memfs.exports.GetPathBuf();
						api.memfs.mem.write(buf, path);
						api.memfs.exports.path_unlink_file(buf);
					}
				}
			} catch(e)
			{
				console.error(e);
			}
			break;
	}

	port.postMessage({ id: 'done', responseId, data: api?.pid || true });
};

self.addEventListener('message', onAnyMessage);

