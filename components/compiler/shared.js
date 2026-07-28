

// @ts-check

/** @type {import('./make.d').SharedWindow} */
const sharedSelf = /** @type {any} */ (self);

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

function sleep(ms)
{
	return new Promise((resolve, _) => setTimeout(resolve, ms));
}

function readStr(u8, o, len = -1)
{
	let str = '';
	let end = u8.length;
	if(len != -1)
		end = o + len;
	for(let i = o; i < end && u8[i] != 0; ++i)
		str += String.fromCharCode(u8[i]);
	return str;
}

function debounceLazy(f, ms)
{
	let waiting = 0;
	let running = false;

	const wait = async () =>
	{
		++waiting;
		await sleep(ms);
		return --waiting === 0;
	};

	const wrapped = async (...args) =>
	{
		if(await wait())
		{
			while(running) await wait();
			running = true;
			try
			{
				await f(...args);
			} finally
			{
				running = false;
			}
		}
	};
	return wrapped;
}



if(typeof sharedSelf.needsHeaders === 'undefined')
{
	sharedSelf.needsHeaders = true;
}

sharedSelf.API = (function ()
{

	class ProcExit extends Error
	{
		code = 0;
		constructor(code)
		{
			super(`process exited with code ${code}.`);
			this.code = code;
		}
	};

	class NotImplemented extends Error
	{
		constructor(modname, fieldname)
		{
			super(`${modname}.${fieldname} not implemented.`);
		}
	}

	class AbortError extends Error
	{
		constructor(msg = 'abort') { super(msg); }
	}

	class AssertError extends Error
	{
		constructor(msg) { super(msg); }
	}

	function assert(cond)
	{
		if(!cond)
		{
			throw new AssertError('assertion failed.');
		}
	}

	function getInstanceSync(module, imports)
	{
		// This is synchronous and returns the instance immediately
		return new WebAssembly.Instance(module, imports);
	}

	function getInstance(module, imports)
	{
		return WebAssembly.instantiate(module, imports);
	}

	/**
	 *
	 * @param {MemFS | App} obj
	 * @param {string[]} names
	 * @returns {any}
	 */
	function getImportObject(obj, names)
	{
		const result = {};
		for(let name of names)
		{
			result[name] = obj[name].bind(obj);
		}
		return result;
	}

	function msToSec(start, end)
	{
		return ((end - start) / 1000).toFixed(2);
	}

	const ESUCCESS = 0;

	class Memory
	{
		constructor(memory)
		{
			this.memory = memory;
			this.buffer = this.memory.buffer;
			this.u8 = new Uint8Array(this.buffer);
			this.u32 = new Uint32Array(this.buffer);
		}

		check()
		{
			if(this.buffer.byteLength === 0)
			{
				this.buffer = this.memory.buffer;
				this.u8 = new Uint8Array(this.buffer);
				this.u32 = new Uint32Array(this.buffer);
			}
		}

		read8(o) { return this.u8[o]; }
		read32(o) { return this.u32[o >> 2]; }
		write8(o, v) { this.u8[o] = v; }
		write32(o, v) { this.u32[o >> 2] = v; }
		write64(o, vlo, vhi = 0) { this.write32(o, vlo); this.write32(o + 4, vhi); }

		readStr(o, len)
		{
			return readStr(this.u8, o, len);
		}

		// Null-terminated string.
		writeStr(o, str)
		{
			o += this.write(o, str);
			this.write8(o, 0);
			return str.length + 1;
		}

		write(o, buf)
		{
			if(buf instanceof ArrayBuffer)
			{
				return this.write(o, new Uint8Array(buf));
			} else if(typeof buf === 'string')
			{
				return this.write(o, buf.split('').map(x => x.charCodeAt(0)));
			} else
			{
				const dst = new Uint8Array(this.buffer, o, buf.length);
				dst.set(buf);
				return buf.length;
			}
		}
	};

	class MemFS
	{
		constructor(options, api)
		{
			const compileStreaming = options.compileStreaming;
			this.hostWrite = options.hostWrite;
			this.stdinStr = options.stdinStr || "";
			this.stdinStrPos = 0;
			this.memfsFilename = options.memfsFilename;

			this.hostMem_ = null;  // Set later when wired up to application.

			// Imports for memfs this.exports.
			const env = getImportObject(
				this, ['abort', 'host_write', 'host_read', 'memfs_log', 'copy_in', 'copy_out']);

			this.ready = api.getModule(this.memfsFilename)
				.then(module => WebAssembly.instantiate(module, { env: env }))
				.then(instance =>
				{
					this.instance = instance;
					this.exports = instance.exports;
					this.mem = new Memory(this.exports.memory);
					this.exports.init();
				});
		}

		set hostMem(mem)
		{
			this.hostMem_ = mem;
		}

		setStdinStr(str)
		{
			this.stdinStr = str;
			this.stdinStrPos = 0;
		}

		addDirectory(path)
		{
			this.mem.check();
			this.mem.write(this.exports.GetPathBuf(), path);
			this.exports.AddDirectoryNode(path.length);
		}

		exists(path)
		{
			try
			{
				this.mem.check();
				this.mem.write(this.exports.GetPathBuf(), path);
				const inode = this.exports.FindNode(path.length);

				// 0 or a specific constant usually represents INVALID_INODE
				return inode !== 0;
			}
			catch(e)
			{
				return false;
			}
		}

		/*
		fd_write(fd, iovs, iovs_len, nwritten_out) {
		  this.mem.check(); // Ensure memory buffer references are live

		  let targetFd = fd;

		  // ─── THE OUT_FD REDIRECTION GHOST ───
		  // If the binary is trying to write to standard stdout (1)...
		  if (fd === 1 && this.exports.out_fd) {
			try {
			  // 1. Resolve the memory location of the out_fd pointer symbol
			  const outFdSymbolPtr = this.exports.out_fd.value || this.exports.out_fd;

			  // 2. Read the 32-bit address stored inside out_fd
			  const view = new DataView(this.mem.buffer);
			  const actualFileStructureAddr = view.getUint32(outFdSymbolPtr, true);

			  // 3. If out_fd has been changed from NULL/stdout to a real file node structure pointer,
			  // grab the underlying file descriptor number mapped inside it!
			  if (actualFileStructureAddr !== 0) {
				// In musl libc, the file descriptor integer is typically the first field in the struct,
				// or found via fileno check offsets. Read it straight out of the structure:
				const mappedFd = view.getUint32(actualFileStructureAddr, true);

				// If it successfully extracts a valid redirected file descriptor, swap the target track!
				if (mappedFd > 2 && mappedFd < 1024) {
				  targetFd = mappedFd;
				}
			  }
			} catch (err) {
			  // Silent fallback to standard stdout if structure parsing encounters unaligned offsets
			}
		  }

		  // 4. Delegate to your existing memfs descriptor writing architecture
		  return this.exports.fd_write(targetFd, iovs, iovs_len, nwritten_out);
		}
		*/

		mkdirp(path)
		{
			// Normalize: remove leading/trailing slashes for segmenting
			const parts = path.split('/').filter(Boolean);

			// Track where we are in the tree
			// Start with an empty string or '.' to signify relative to root
			let accumulated = "";

			for(const part of parts)
			{
				accumulated = accumulated === "" ? part : `${accumulated}/${part}`;

				try
				{
					this.mem.check();

					if(!this.exists(accumulated))
					{
						// Existence check using your internal helper
						// Write the segment to the WASM buffer
						// TRICK: Ensure you don't have a leading slash here
						this.mem.write(this.exports.GetPathBuf(), accumulated);

						// Call the export.
						// NOTE: If unreachable persists, try accumulated.length + 1
						this.exports.AddDirectoryNode(accumulated.length);
					}
				} catch(e)
				{
					// Catching the WASM abort
					console.error(`Crashed creating: ${accumulated}`, e);
					throw e;
				}
			}
		}

		addFile(path, contents)
		{
			try
			{
				if(!contents)
				{
					debugger;
					return;
				}

				// --- DETACHED OR SHARED MEMORY DETECTOR HOOK ---
				if(contents instanceof ArrayBuffer)
				{
					// A byteLength of 0 on a non-empty expected asset means it's ALREADY detached!
					if(contents.byteLength === 0)
					{
						//console.error(`[VFS CRITICAL] ${path} arrived with an ALREADY detached ArrayBuffer allocation!`);
						//debugger; // Snaps thread cursor right here
					}
				} else if(contents.buffer instanceof ArrayBuffer)
				{
					// If it's a view (Uint8Array, etc.), check if its underlying buffer is dead or detached
					if(contents.buffer.byteLength === 0)
					{
						//console.error(`[VFS CRITICAL] ${path} typed view container is backed by a detached ArrayBuffer!`);
						//debugger;
					}

					// CRITICAL PREVENTATIVE SAFEGUARD:
					// If this is a live WASM memory sub-view reference, FORCE a decoupled deep copy clone
					// right now so it survives if the parent WASM instance shuts down or grows pages!
					if(contents.buffer === this.exports?.memory?.buffer || contents.buffer.detached)
					{
						//console.warn(`[VFS Warning] Cloning vulnerable shared WASM heap reference for: ${path}`);
						contents = contents.slice(0); // Deep copies the bytes into isolated JS heap spaces
					}
				}

				// TODO: remove memfs after read input bug is figured out
				const dirPath = path.substring(0, path.lastIndexOf('/'));
				if(dirPath)
				{
					this.mkdirp(dirPath);
				}

				const length =
					contents instanceof ArrayBuffer ? contents.byteLength : contents.length;

				this.mem.check();
				this.mem.write(this.exports.GetPathBuf(), path);
				const inode = this.exports.AddFileNode(path.length, length);
				const addr = this.exports.GetFileNodeAddress(inode);
				this.mem.check();

				// This is the line that currently crashes when writing a detached state reference
				this.mem.write(addr, contents);
			}
			catch(e)
			{
				console.error(path + ' - ' + e);
				debugger; // Allow step-back lookup maps inside DevTools
			}
		}

		directoryList(fd)
		{
			// 1. Use your established scratch space
			const bufPtr = this.exports.GetPathBuf();
			const bufLen = this.exports.GetPathBufLen();

			// 2. We'll use the last 4 bytes of the scratch buffer for nreadPtr
			// to avoid a separate allocation or hardcoded address.
			const nreadPtr = bufPtr + bufLen - 4;
			const PAGE_SIZE = bufLen - 4;

			const results = [];
			let cookie = 0n;

			while(true)
			{
				// Call WASI export using the scratch buffer
				const errno = this.exports.fd_readdir(fd, bufPtr, PAGE_SIZE, cookie, nreadPtr);

				if(errno !== 0)
				{
					console.error(`readdir failed with errno: ${errno}`);
					break;
				}

				const view = new DataView(this.exports.memory.buffer);
				const nread = view.getUint32(nreadPtr, true);
				if(nread === 0) break;

				let offset = 0;
				while(offset < nread)
				{
					// WASI Dirent Header (24 bytes):
					// 0-7: d_next (8) | 8-15: d_ino (8) | 16-19: d_namlen (4) | 20: d_type (1)
					const d_next = view.getBigUint64(offset, true);
					const d_namlen = view.getUint32(offset + 16, true);
					const d_type = view.getUint8(offset + 20);

					// Name immediately follows the 24-byte header
					const namePtr = bufPtr + offset + 24;
					const nameBuffer = new Uint8Array(this.exports.memory.buffer, namePtr, d_namlen);
					const name = new TextDecoder().decode(nameBuffer);

					results.push({
						name: name,
						type: d_type, // 4 = Dir, 8 = File
						inode: view.getBigUint64(offset + 8, true)
					});

					cookie = d_next;
					offset += 24 + d_namlen;
				}

				if(nread < PAGE_SIZE) break;
			}

			return results;
		}


		async recursiveDir(dirFd, pathStr = "")
		{
			// 1. Get the scratch space provided by your Wasm module
			const scratchPtr = this.exports.GetPathBuf();
			const scratchLen = this.exports.GetPathBufLen();

			if(scratchLen < 4096)
			{
				throw new Error("Scratch buffer too small for readdir");
			}

			const entries = this.directoryList(dirFd); //, scratchPtr, scratchLen);

			for(const entry of entries)
			{
				const fullPath = pathStr ? `${pathStr}/${entry.name}` : entry.name;

				if(entry.type === 4)
				{ // Directory
					// Use the scratch space to encode the directory name for path_open
					const encoder = new TextEncoder();
					const encoded = encoder.encode(entry.name);

					// Write name to scratch space (reusing GetPathBuf)
					new Uint8Array(this.exports.memory.buffer).set(encoded, scratchPtr);

					// We need 4 bytes for the result FD.
					// We can put this at the very end of our scratch buffer to avoid overlap.
					const resultFdPtr = scratchPtr + scratchLen - 4;

					const errno = this.exports.path_open(
						dirFd,
						0,
						scratchPtr, encoded.length,
						0,
						0x2000000n, 0x2000000n,
						0,
						resultFdPtr
					);

					if(errno === 0)
					{
						const subDirFd = new DataView(this.exports.memory.buffer).getUint32(resultFdPtr, true);

						await this.recursiveDir(subDirFd, fullPath);
						this.exports.fd_close(subDirFd);
					}
				} else
				{
					console.log(`resursiveDir: ${fullPath}`);
				}
			}
		}


		getFileContents(path)
		{
			this.mem.check();

			// 1. Write path to shared buffer
			this.mem.write(this.exports.GetPathBuf(), path);

			// 2. Try to find the node.
			// Try passing the root FD (usually 3) if path.length alone fails.
			const inode = this.exports.FindNode(path.length);

			if(inode === 0)
			{
				console.error(`FindNode failed for path: ${path}. Inode is 0.`);
				return new Uint8Array(0);
			}

			const addr = this.exports.GetFileNodeAddress(inode);
			const size = this.exports.GetFileNodeSize(inode);

			console.log(`Node found: Inode=${inode}, Addr=${addr}, Size=${size}`);

			// 3. Slice the buffer to get a clean copy, or use subarray to stay linked
			return new Uint8Array(this.mem.buffer, addr, size);
		}

		abort() { throw new AbortError(); }

		host_write(fd, iovs, iovs_len, nwritten_out)
		{
			this.hostMem_.check();
			assert(fd <= 2);
			let size = 0;
			let str = '';
			for(let i = 0; i < iovs_len; ++i)
			{
				const buf = this.hostMem_.read32(iovs);
				iovs += 4;
				const len = this.hostMem_.read32(iovs);
				iovs += 4;
				str += this.hostMem_.readStr(buf, len);
				size += len;
			}
			this.hostMem_.write32(nwritten_out, size);
			this.hostWrite(str);
			return ESUCCESS;
		}

		host_read(fd, iovs, iovs_len, nread)
		{
			this.hostMem_.check();
			assert(fd === 0);
			let size = 0;
			for(let i = 0; i < iovs_len; ++i)
			{
				const buf = this.hostMem_.read32(iovs);
				iovs += 4;
				const len = this.hostMem_.read32(iovs);
				iovs += 4;
				const lenToWrite = Math.min(len, (this.stdinStr.length - this.stdinStrPos));
				if(lenToWrite === 0)
				{
					break;
				}
				this.hostMem_.write(buf, this.stdinStr.substr(this.stdinStrPos, lenToWrite));
				size += lenToWrite;
				this.stdinStrPos += lenToWrite;
				if(lenToWrite !== len)
				{
					break;
				}
			}
			// For logging
			// this.hostWrite("Read "+ size + "bytes, pos: "+ this.stdinStrPos + "\n");
			this.hostMem_.write32(nread, size);
			return ESUCCESS;
		}

		memfs_log(buf, len)
		{
			this.mem.check();
			let message = this.mem.readStr(buf, len);
			if(typeof sharedSelf.originalConsole !== 'undefined')
				sharedSelf.originalConsole.warn(message);
			sharedSelf.api?.hostWrite?.(message);
		}

		/*

		copy_out(clang_dst, memfs_src, size) {
		  this.hostMem_.check();
		  this.mem.check();

		  const liveHostBuffer = this.hostMem_.buffer || Module.memory.buffer;
		  const liveMemfsBuffer = this.exports?.memory?.buffer || this.mem.buffer;

		  // ─── SCATTER-GATHER INTERCEPTION GHOST ───
		  // If memfs_src is a very small address (lower than standard heap limits like 64KB),
		  // it means the binary is passing an internal stack variable or an iovec structure list!
		  if (memfs_src < 65536 && size > 0) {
			try {
			  const view = new DataView(liveMemfsBuffer);

			  // In an iovec array layout, each block is 8 bytes wide (4 bytes base pointer, 4 bytes length)
			  // Look inside the structure to resolve where the TRUE file byte pointer is stored!
			  const realMemfsSrc = view.getUint32(memfs_src, true);
			  const realSize = view.getUint32(memfs_src + 4, true);

			  // If the dereferenced pointers are clean and aligned, swap them out before the blit
			  if (realMemfsSrc > 0 && realMemfsSrc + size <= liveMemfsBuffer.byteLength) {
				memfs_src = realMemfsSrc;
				if (realSize > 0 && realSize < size) {
				  size = realSize;
				}
			  }
			} catch (e) {
			  // Fallback to flat blit if memory boundaries are unaligned
			}
		  }

		  // Final boundary guard safety check to stop RangeError panics
		  if (clang_dst + size > liveHostBuffer.byteLength || memfs_src + size > liveMemfsBuffer.byteLength) {
			console.warn(`[VFS Boundary Intercept] Adjusting out-of-bounds copy size pass safely.`);
			size = Math.min(size, liveHostBuffer.byteLength - clang_dst, liveMemfsBuffer.byteLength - memfs_src);
		  }

		  if (size > 0) {
			const dst = new Uint8Array(liveHostBuffer, clang_dst, size);
			const src = new Uint8Array(liveMemfsBuffer, memfs_src, size);
			dst.set(src);
		  }
		}

		copy_in(memfs_dst, clang_src, size) {
		  this.mem.check();
		  this.hostMem_.check();

		  const liveMemfsBuffer = this.exports?.memory?.buffer || this.mem.buffer;
		  const liveHostBuffer = this.hostMem_.buffer || Module.memory.buffer;

		  if (clang_src < 65536 && size > 0) {
			try {
			  const view = new DataView(liveHostBuffer);
			  const realClangSrc = view.getUint32(clang_src, true);
			  const realSize = view.getUint32(clang_src + 4, true);

			  if (realClangSrc > 0 && realClangSrc + size <= liveHostBuffer.byteLength) {
				clang_src = realClangSrc;
				if (realSize > 0 && realSize < size) {
				  size = realSize;
				}
			  }
			} catch (e) {}
		  }

		  if (memfs_dst + size > liveMemfsBuffer.byteLength || clang_src + size > liveHostBuffer.byteLength) {
			size = Math.min(size, liveMemfsBuffer.byteLength - memfs_dst, liveHostBuffer.byteLength - clang_src);
		  }

		  if (size > 0) {
			const dst = new Uint8Array(liveMemfsBuffer, memfs_dst, size);
			const src = new Uint8Array(liveHostBuffer, clang_src, size);
			dst.set(src);
		  }
		}

		*/

		copy_out(clang_dst, memfs_src, size)
		{
			this.hostMem_.check();
			const dst = new Uint8Array(this.hostMem_.buffer, clang_dst, size);
			this.mem.check();
			const src = new Uint8Array(this.mem.buffer, memfs_src, size);
			// console.log(`copy_out(${clang_dst.toString(16)}, ${memfs_src.toString(16)}, ${size})`);
			dst.set(src);
		}

		copy_in(memfs_dst, clang_src, size)
		{
			this.mem.check();
			const dst = new Uint8Array(this.mem.buffer, memfs_dst, size);
			if(this.hostMem_)
			{
				this.hostMem_.check();
				const src = new Uint8Array(this.hostMem_.buffer, clang_src, size);
				// console.log(`copy_in(${memfs_dst.toString(16)}, ${clang_src.toString(16)}, ${size})`);
				dst.set(src);
			}
		}
	}

	const RAF_PROC_EXIT_CODE = 0xC0C0A;

	class App
	{
		constructor(api, hostWrite, module, sysrootFilename, name, ...args)
		{
			this.module = module;
			this.api = api;
			this.hostWrite = hostWrite;
			this.sysrootFilename = sysrootFilename;
			SYS.startArgs = this.argv = [name, ...args];
			Module.environment = this.environ = { USER: 'alice' };
			this.allowRequestAnimationFrame = true;
			this.handles = new Map();
			this.nextHandle = 0;
			Module.database = this.api?.database;

			const env = getImportObject(this, [
				'canvas_arc',
				'canvas_arcTo',
				'canvas_beginPath',
				'canvas_bezierCurveTo',
				'canvas_clearRect',
				'canvas_clip',
				'canvas_closePath',
				'canvas_createImageData',
				'canvas_destroyHandle',
				'canvas_ellipse',
				'canvas_fill',
				'canvas_fillRect',
				'canvas_fillText',
				'canvas_imageDataSetData',
				'canvas_lineTo',
				'canvas_measureText',
				'canvas_moveTo',
				'canvas_putImageData',
				'canvas_quadraticCurveTo',
				'canvas_rect',
				'canvas_requestAnimationFrame',
				'canvas_restore',
				'canvas_rotate',
				'canvas_save',
				'canvas_scale',
				'canvas_setFillStyle',
				'canvas_setFont',
				'canvas_setGlobalAlpha',
				'canvas_setHeight',
				'canvas_setLineCap',
				'canvas_setLineDashOffset',
				'canvas_setLineJoin',
				'canvas_setLineWidth',
				'canvas_setMiterLimit',
				'canvas_setShadowBlur',
				'canvas_setShadowColor',
				'canvas_setShadowOffsetX',
				'canvas_setShadowOffsetY',
				'canvas_setStrokeStyle',
				'canvas_setTextAlign',
				'canvas_setTextBaseline',
				'canvas_setTransform',
				'canvas_setWidth',
				'canvas_stroke',
				'canvas_strokeRect',
				'canvas_strokeText',
				'canvas_transform',
				'canvas_translate',
			]);

			const wasi_unstable = getImportObject(this, [
				'proc_exit', 'environ_sizes_get', 'environ_get', 'args_sizes_get',
				'args_get', 'random_get', 'clock_time_get', 'poll_oneoff',
				// 'fork', // 'execv' // , 'fd_renumber'
			]);
			Module.errno = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
			//const wasi_unstable = {
			//  'errno': Module.errno
			//}

			if(!module.name)
			{
				debugger;
				console.error('Goddamnit wheres the fucking module name?');
			}
			let needMemfs = module.name.includes('lld') || module.name.includes('clang');

			if(!sharedSelf.FS.pointers?.[0] || !sharedSelf.FS.pointers[0][2])
			{
				debugger;
			}

			//this.previousFd = FS.pointers[0][2].rewrite
			//this.previousContents = FS.pointers[0][2].contents
			this.previousExports = Module.exports;
			this.previousErrno = Module.errno.value;
			this.previousMemory = ENV.memory || Module.memory;
			this.previousHeap = window.STD.sharedMemory || Module.__heap_base;
			this.previousPid = this.api.pid;
			//if (this.api.memfs) {
			//  this.previousHostMem = this.api.memfs.hostMem_
			//}

			if(!needMemfs)
			{


				if(!wasi_unstable.table)
				{
					const importTable = new WebAssembly.Table({
						initial: 2000,
						element: 'anyfunc',
						maximum: 10000
					});
					this.table = env.__indirect_function_table = wasi_unstable.table = ENV.__indirect_function_table = importTable;
				}

				if(!wasi_unstable.memory)
				{
					env.memory = ENV.memory = Module.memory = wasi_unstable.memory = new WebAssembly.Memory({
						initial: 4096,
						maximum: 32000,
						//'shared': true
					});
					if(this.api.memfs)
						this.api.memfs.hostMem = this.mem = new Memory(Module.memory);
				}

				wasi_unstable.env = ENV.wasi_snapshot_preview1 = wasi_unstable;
				wasi_unstable.imports = wasi_unstable;

				/*
				wasi_unstable.fd_prestat_get = FS.fd_prestat_get
				wasi_unstable.fd_prestat_dir_name = FS.fd_prestat_dir_name
				wasi_unstable.fd_fdstat_get = FS.fd_fdstat_get
				wasi_unstable.path_open = FS.path_open
				wasi_unstable.path_unlink_file = FS.path_unlink_file
				wasi_unstable.path_remove_directory = FS.path_remove_directory
				wasi_unstable.path_create_directory = FS.path_create_directory
				wasi_unstable.fd_close = FS.fd_close
				wasi_unstable.fd_fdstat_set_flags = FS.fd_fdstat_set_flags
				wasi_unstable.fd_seek = FS.fd_seek
				wasi_unstable.fd_read = FS.fd_read
				wasi_unstable.fd_write = FS.fd_write
				*/

				//Object.assign(wasi_unstable, this.api.memfs.exports);
				Object.assign(wasi_unstable, FILED);
			}
			else
			{
				Object.assign(wasi_unstable, this.api.memfs.exports);
				// TODO: make optional until i know its working?
				//Object.assign(wasi_unstable, FS);
			}

			//wasi_unstable.callsys = FS.callsys
			//wasi_unstable.getpid = FS.getpid


			Object.assign(env, wasi_unstable);
			const imports = WebAssembly.Module.imports(module);

			if(module.sync)
			{
				this.instance = getInstanceSync(module, { wasi_unstable, env });
				this.exports = this.instance.exports;
				this.assignExports(this.instance);
				this.ready = Promise.resolve();
			}
			else
				this.ready = getInstance(module, { wasi_unstable, env }).then(instance => this.assignExports(instance));
		}


		assignExports(instance)
		{

			this.instance = instance;

			this.exports = this.instance?.exports;
			if(this.exports?.memory)
			{
				this.mem = new Memory(this.exports.memory);
				ENV.memory = this.exports.memory;
			}
			if(this.api.memfs)
			{
				this.api.memfs.hostMem = this.mem;
			}
			if(this.exports?.__indirect_function_table)
			{
				this.table = this.exports.__indirect_function_table;
			}
			//this.exports.__heap_base.value;
		}

		runSync()
		{
			try
			{
				//FS.virtual['/dev/stdin'].rewrite = 0
				//FS.virtual['/dev/stdout'].rewrite = 0
				//FS.virtual['/dev/stderr'].rewrite = 0
				Module.exports = this.exports || this.instance?.exports;
				Module.errno.value = (this.exports['___errno_location'])
					? this.exports['___errno_location']()
					: 0 || this.exports['errno'];
				window.STD.sharedMemory = Module.__heap_base = this.exports.__heap_base.value;
				if(this.exports.memory)
					ENV.memory = Module.memory = this.exports.memory;
				if(this.api.memfs)
				{
					this.api.memfs.hostMem = this.mem;
				}
				updateGlobalBufferAndViews();
				let result = this.runInternal();
				return result;
			} finally
			{

				if(this.previousExports)
				{
					Module.exports = this.previousExports;
					window.STD.sharedMemory = Module.__heap_base = this.previousHeap;
					ENV.memory = Module.memory = this.previousMemory;
					Module.errno.value = this.previousErrno;
					if(this.api.memfs)
					{
						//this.api.memfs.hostMem = this.previousHostMem;
					}
					this.api.pid = this.previousPid;
					//sharedSelf.FS.pointers[0][2].rewrite = this.previousFd;
					//sharedSelf.FS.pointers[0][2].contents = this.previousContents;
					updateGlobalBufferAndViews();
				}
			}
		}


		runInternal()
		{
			try
			{
				this.pid = ++this.api.pid;
				this.output = this.exports?._start();
				return this.output || 0;
			} catch(exn)
			{
				let writeStack = true;

				if(!(exn instanceof Error))
				{
					return;
				}

				if(exn.message.includes('memory access out of bounds'))
				{
					this.api.initMemFS();
				}

				if(exn instanceof ProcExit)
				{
					this.output = exn.code;

					if(exn.code === RAF_PROC_EXIT_CODE
						|| exn.code === 0
					)
					{
						console.log('Allowing rAF after exit.');
						return true;
					}
					// Don't allow rAF unless you return the right code.
					console.log(`Disallowing rAF since exit code is ${exn.code}.`);
					this.allowRequestAnimationFrame = false;
					if(exn.code == 0)
					{
						return false;
					}
					writeStack = false;
				}


				if(exn.message === 'WASI_ENOSYS')
				{
					this.hostWrite(`Error: Exit code ${exn.code}\n${exn.stack}`);
				}
				else
				{
					// Write error message.
					let msg = `\x1b[91mError: ${exn.message}`;
					if(writeStack)
					{
						msg = msg + `\n${exn.stack}`;
					}
					msg += '\x1b[0m\n\r';
					this.hostWrite(msg);
				}

				// Propagate error.
				throw exn;
			}
		}


		async run()
		{
			await this.ready;
			let result = await this.runSync();
			return this.output || result;
		}

		async runAsync()
		{
			await this.ready;

			debugger;
			//FS.virtual['/dev/stdin'].rewrite = 0
			//FS.virtual['/dev/stdout'].rewrite = 0
			//FS.virtual['/dev/stderr'].rewrite = 0
			Module.exports = this.exports || this.instance.exports;
			Module.errno.value = (this.exports['___errno_location'])
				? this.exports['___errno_location']()
				: 0 || this.exports['errno'];
			window.STD.sharedMemory = Module.__heap_base = this.exports.__heap_base.value;
			if(this.exports.memory)
				ENV.memory = Module.memory = this.exports.memory;
			if(this.api.memfs)
			{
				this.api.memfs.hostMem = this.mem;
			}

			updateGlobalBufferAndViews();
			let result = this.runInternal();

			return this.output || result;

			// TODO: don't swap global back
		}

		/*
		fork() { return 0 }

		execv(pathPtr, argvPtr) {
		  const path = this.mem.readStr(pathPtr);
		  const cmdArgs = this.getStringsFromArgv(argvPtr);
		  if (this.api.moduleCache[path || cmdArgs[0]]) {
			let result = this.api.runSync(path || cmdArgs[0], ...cmdArgs)
			return result
		  }
		  else {
			console.log('Would have run: ' + [path, ...cmdArgs].join(' '))
			Module.errno = WASI_ENOSYS;
			return -1;
		  }
		  return 0;
		}
		*/


		proc_exit(code)
		{
			throw new ProcExit(code);
		}

		getStringsFromArgv(argv)
		{
			if(!this.mem) return;
			this.mem.check();
			const args = [];

			// If argv is a number, it's a pointer to a NULL-terminated array in WASM memory
			if(typeof argv === 'number')
			{
				const view = new DataView(this.mem.buffer);
				for(let i = 0; ; i++)
				{
					const stringPointer = view.getUint32(argv + (i * 4), true);
					if(stringPointer === 0) break; // NULL terminator

					// Using your Mem lib's string reader (assuming it's called readString or similar)
					args.push(this.mem.readStr(stringPointer));
				}
			}
			// If argv is already an array (passed via ...argv in JS), just sanitize it
			else if(Array.isArray(argv))
			{
				return argv.map(arg => (typeof arg === 'number' && this.mem ? this.mem.readStr(arg) : arg));
			}

			return args;
		}

		environ_sizes_get(environ_count_out, environ_buf_size_out)
		{
			if(!this.mem) return;
			this.mem.check();
			let size = 0;
			const names = Object.getOwnPropertyNames(this.environ);
			for(const name of names)
			{
				const value = this.environ[name];
				// +2 to account for = and \0 in "name=value\0".
				size += name.length + value.length + 2;
			}
			this.mem.write64(environ_count_out, names.length);
			this.mem.write64(environ_buf_size_out, size);
			return ESUCCESS;
		}

		environ_get(environ_ptrs, environ_buf)
		{
			if(!this.mem) return;
			this.mem.check();
			const names = Object.getOwnPropertyNames(this.environ);
			for(const name of names)
			{
				this.mem.write32(environ_ptrs, environ_buf);
				environ_ptrs += 4;
				environ_buf +=
					this.mem.writeStr(environ_buf, `${name}=${this.environ[name]}`);
			}
			this.mem.write32(environ_ptrs, 0);
			return ESUCCESS;
		}

		args_sizes_get(argc_out, argv_buf_size_out)
		{
			if(!this.mem) return;
			this.mem.check();
			let size = 0;
			for(let arg of this.argv)
			{
				size += arg.length + 1;  // "arg\0".
			}
			this.mem.write64(argc_out, this.argv.length);
			this.mem.write64(argv_buf_size_out, size);
			return ESUCCESS;
		}

		args_get(argv_ptrs, argv_buf)
		{
			if(!this.mem) return;
			this.mem.check();
			for(let arg of this.argv)
			{
				this.mem.write32(argv_ptrs, argv_buf);
				argv_ptrs += 4;
				argv_buf += this.mem.writeStr(argv_buf, arg);
			}
			this.mem.write32(argv_ptrs, 0);
			return ESUCCESS;
		}

		random_get(buf, buf_len)
		{
			if(!this.mem) return;
			const data = new Uint8Array(this.mem.buffer, buf, buf_len);
			for(let i = 0; i < buf_len; ++i)
			{
				data[i] = (Math.random() * 256) | 0;
			}
		}

		clock_time_get(id, precision, result_ptr)
		{
			if(!this.mem) return;
			this.mem.check();
			// id: 0 = REALTIME, 1 = MONOTONIC
			// result_ptr: index in WASM memory where the 64-bit timestamp goes

			let timeInNanoseconds;

			if(id === 1)
			{ // MONOTONIC
				timeInNanoseconds = BigInt(Math.floor(performance.now() * 1000000));
			} else
			{ // REALTIME
				timeInNanoseconds = BigInt(Date.now()) * 1000000n;
			}

			// Use BigUint64Array to write the 8-byte value into memory
			// result_ptr is the offset in the shared buffer
			const memory = new BigUint64Array(this.mem.buffer);
			memory[result_ptr >> 3] = timeInNanoseconds;

			return 0; // 0 is the WASI 'success' code (errno.SUCCESS)
		}


		poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out)
		{
			if(!this.mem) return;
			this.mem.check();
			const mem = new DataView(this.mem.buffer);
			let eventsCreated = 0;

			for(let i = 0; i < nsubscriptions; i++)
			{
				// WASI Subscription struct is 40 bytes
				const subPtr = in_ptr + (i * 40);
				const userdata = mem.getBigUint64(subPtr, true);
				const type = mem.getUint8(subPtr + 8); // 0 = Clock, 1 = FD_READ, 2 = FD_WRITE

				if(type === 0)
				{ // EVENTTYPE_CLOCK
					// Clock subscription starts at offset 16
					const clockId = mem.getUint32(subPtr + 16, true);
					const timeout = mem.getBigUint64(subPtr + 24, true);
					const precision = mem.getBigUint64(subPtr + 32, true);
					const flags = mem.getUint16(subPtr + 40, true);

					// In a browser, we can't actually "sleep" synchronously
					// without blocking the UI thread, so we just report success
					// immediately or check if the timeout is valid.

					// Write the Event back to out_ptr (32 bytes)
					const eventPtr = out_ptr + (eventsCreated * 32);
					mem.setBigUint64(eventPtr, userdata, true); // Userdata
					mem.setUint16(eventPtr + 8, 0, true);       // error (0 = Success)
					mem.setUint8(eventPtr + 10, 0);             // type (Clock)

					eventsCreated++;
				} else
				{
					// For FD_READ/WRITE, we usually just report success for standard streams
					const eventPtr = out_ptr + (eventsCreated * 32);
					mem.setBigUint64(eventPtr, userdata, true);
					mem.setUint16(eventPtr + 8, 0, true);
					mem.setUint8(eventPtr + 10, type);
					eventsCreated++;
				}
			}

			// Write number of events created to the output pointer
			const outEventsView = new Uint32Array(this.mem.buffer, nevents_out, 1);
			outEventsView[0] = eventsCreated;

			return 0; // errno.SUCCESS
		}

		canvas_destroyHandle(handle)
		{
			this.handles.delete(handle);
		}

		// Canvas API
		canvas_setWidth(width) { if(canvas) canvas.width = width; }
		canvas_setHeight(height) { if(canvas) canvas.height = height; }
		canvas_requestAnimationFrame()
		{
			if(this.allowRequestAnimationFrame)
			{
				requestAnimationFrame(ms =>
				{
					if(this.allowRequestAnimationFrame)
					{
						this.exports?.canvas_loop(ms);
					}
				});
			}
		}

		// ImageData stuff
		canvas_createImageData(w, h)
		{
			if(ctx2d)
			{
				const imageData = ctx2d.createImageData(w, h);
				const handle = this.nextHandle++;
				this.handles.set(handle, imageData);
				return handle;
			}
			return -1;
		}
		canvas_putImageData(handle, x, y)
		{
			if(ctx2d)
			{
				const imageData = this.handles.get(handle);
				if(imageData)
				{
					ctx2d.putImageData(imageData, x, y);
				}
			}
		}
		canvas_imageDataSetData(handle, buffer, offset, size)
		{
			if(!this.mem) return;
			const imageData = this.handles.get(handle);
			if(imageData)
			{
				this.mem.check();
				const src = new Uint8Array(this.mem.buffer, buffer, size);
				imageData.data.set(src, offset);
			}
		}

		// Other Canvas methods.
		canvas_arc(...args) { if(ctx2d) ctx2d.arc(...args); }
		canvas_arcTo(...args) { if(ctx2d) ctx2d.arcTo(...args); }
		canvas_beginPath(...args) { if(ctx2d) ctx2d.beginPath(...args); }
		canvas_bezierCurveTo(...args) { if(ctx2d) ctx2d.bezierCurveTo(...args); }
		canvas_clearRect(...args) { if(ctx2d) ctx2d.clearRect(...args); }
		canvas_clip(value) { if(ctx2d) ctx2d.clip(['nonzero', 'evenodd'][value]); }
		canvas_closePath(...args) { if(ctx2d) ctx2d.closePath(...args); }
		canvas_ellipse(...args) { if(ctx2d) ctx2d.ellipse(...args); }
		canvas_fill(value) { if(ctx2d) ctx2d.fill(['nonzero', 'evenodd'][value]); }
		canvas_fillRect(...args) { if(ctx2d) ctx2d.fillRect(...args); }
		canvas_fillText(text, text_len, x, y)
		{  // TODO: maxwidth
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.fillText(this.mem.readStr(text, text_len), x, y);
		}
		canvas_lineTo(...args) { if(ctx2d) ctx2d.lineTo(...args); }
		canvas_measureText(text, text_len)
		{
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) return ctx2d.measureText(this.mem.readStr(text, text_len)).width;
			return 0;
		}
		canvas_moveTo(...args) { if(ctx2d) ctx2d.moveTo(...args); }
		canvas_quadraticCurveTo(...args) { if(ctx2d) ctx2d.quadraticCurveTo(...args); }
		canvas_rect(...args) { if(ctx2d) ctx2d.rect(...args); }
		canvas_restore(...args) { if(ctx2d) ctx2d.restore(...args); }
		canvas_rotate(...args) { if(ctx2d) ctx2d.rotate(...args); }
		canvas_save(...args) { if(ctx2d) ctx2d.save(...args); }
		canvas_scale(...args) { if(ctx2d) ctx2d.scale(...args); }
		canvas_setTransform(...args) { if(ctx2d) ctx2d.setTransform(...args); }
		canvas_stroke(...args) { if(ctx2d) ctx2d.stroke(...args); }
		canvas_strokeRect(...args) { if(ctx2d) ctx2d.strokeRect(...args); }
		canvas_strokeText(text, text_len, x, y)
		{  // TODO: maxwidth
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.strokeText(this.mem.readStr(text, text_len), x, y);
		}
		canvas_transform(...args) { if(ctx2d) ctx2d.transform(...args); }
		canvas_translate(...args) { if(ctx2d) ctx2d.translate(...args); }

		// Canvas properties.
		canvas_setFillStyle(buf, len)
		{
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.fillStyle = this.mem.readStr(buf, len);
		}
		canvas_setFont(buf, len)
		{
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.font = this.mem.readStr(buf, len);
		}
		canvas_setGlobalAlpha(value) { if(ctx2d) ctx2d.globalAlpha = value; }
		canvas_setLineCap(value)
		{
			if(ctx2d) ctx2d.lineCap = ['butt', 'round', 'square'][value];
		}
		canvas_setLineDashOffset(value) { if(ctx2d) ctx2d.lineDashOffset = value; }
		canvas_setLineJoin(value)
		{
			if(ctx2d) ctx2d.lineJoin = ['bevel', 'round', 'miter'][value];
		}
		canvas_setLineWidth(value) { if(ctx2d) ctx2d.lineWidth = value; }
		canvas_setMiterLimit(value) { if(ctx2d) ctx2d.miterLimit = value; }
		canvas_setShadowBlur(value) { if(ctx2d) ctx2d.shadowBlur = value; }
		canvas_setShadowColor(buf, len)
		{
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.shadowColor = this.mem.readStr(buf, len);
		}
		canvas_setShadowOffsetX(value) { if(ctx2d) ctx2d.setShadowOffsetX = value; }
		canvas_setShadowOffsetY(value) { if(ctx2d) ctx2d.setShadowOffsetY = value; }
		canvas_setStrokeStyle(buf, len)
		{
			if(!this.mem) return;
			this.mem.check();
			if(ctx2d) ctx2d.strokeStyle = this.mem.readStr(buf, len);
		}
		canvas_setTextAlign(value)
		{
			if(ctx2d)
				ctx2d.textAlign = ['left', 'right', 'center', 'start', 'end'][value];
		}
		canvas_setTextBaseline(value)
		{
			if(ctx2d)
				ctx2d.textBaseline = [
					'top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'
				][value];
		}
	}

	class Tar
	{
		constructor(buffer)
		{
			this.u8 = new Uint8Array(buffer);
			this.offset = 0;
		}

		readStr(len)
		{
			const result = readStr(this.u8, this.offset, len);
			this.offset += len;
			return result;
		}

		readOctal(len)
		{
			return parseInt(this.readStr(len), 8);
		}

		alignUp()
		{
			this.offset = (this.offset + 511) & ~511;
		}
		async scanTarMetadata()
		{
			while(this.offset + 512 <= this.u8.length)
			{
				// 1. Read Header Block (First 512 bytes)
				const headerOffset = this.offset;
				const filename = readStr(this.u8, headerOffset, 100).replace(/\0+$/, '');

				// Terminate on empty header (TAR end-of-archive marker)
				if(!filename) break;

				// 2. Extract Metadata (Octal strings in TAR)
				const size = parseInt(readStr(this.u8, headerOffset + 124, 12), 8);
				const typeStr = readStr(this.u8, headerOffset + 156, 1);
				const modeOctal = parseInt(readStr(this.u8, headerOffset + 100, 8), 8);

				// 3. Register in Virtual FS (Placeholder only)
				if(!sharedSelf.FS.virtual[filename])
				{
					const isDir = typeStr === '5' || filename.endsWith('/');

					sharedSelf.FS.virtual[filename] = {
						timestamp: new Date(),
						mode: isDir ? FS_DIR : FS_FILE,
						path: filename,
						parent: filename.substring(0, filename.lastIndexOf('/')),
					};
				}

				// 4. THE SEEK: Jump over the header (512) + the data (aligned to 512)
				this.offset += 512;
				this.offset += (size + 511) & ~511;
			}
			// Reset offset if you plan to reuse the Tar instance for actual extraction
			this.offset = 0;
		}
		readEntry()
		{
			if(this.offset + 512 > this.u8.length)
			{
				return null;
			}

			const entry = {
				filename: this.readStr(100),
				mode: this.readOctal(8),
				owner: this.readOctal(8),
				group: this.readOctal(8),
				size: this.readOctal(12),
				mtim: this.readOctal(12),
				checksum: this.readOctal(8),
				type: this.readStr(1),
				linkname: this.readStr(100),
			};

			if(this.readStr(8) !== 'ustar  ')
			{
				return null;
			}

			entry.ownerName = this.readStr(32);
			entry.groupName = this.readStr(32);
			entry.devMajor = this.readStr(8);
			entry.devMinor = this.readStr(8);
			entry.filenamePrefix = this.readStr(155);
			this.alignUp();

			if(entry.type === '0')
			{        // Regular file.
				entry.contents = this.u8.subarray(this.offset, this.offset + entry.size);
				this.offset += entry.size;
				this.alignUp();
			} else if(entry.type !== '5')
			{ // Directory.
				console.log('type', entry.type);
				assert(false);
			}
			return entry;
		}

		async untar(memfs)
		{
			let entry;
			let count = 0;
			while(entry = this.readEntry())
			{
				//while (this.offset + 512 <= this.u8.length) {
				// 1. Peek at the filename and size without consuming the whole entry yet
				// The filename is the first 100 bytes of the current 512-byte block
				/*
				const filename = readStr(this.u8, this.offset, 100).replace(/\0+$/, '');

				// 2. Check existence in your Virtual FS
				if (FS.virtual[filename]) {
				  debugger
				  // SKIP LOGIC:
				  // Grab the size to know how far to jump (at offset 124, length 12)
				  const sizeStr = readStr(this.u8, this.offset + 124, 12);
				  const size = parseInt(sizeStr, 8);

				  // Move offset: 512 (header) + aligned size (data)
				  this.offset += 512;
				  this.offset += (size + 511) & ~511;

				  try {
					if (memfs)
					  memfs.mkdirp(entry.filename.substring(0, entry.filename.lastIndexOf('/')));
				  } catch (e) {
					debugger
				  }
				  try {

					if (memfs && !memfs.exists(entry.filename))
					  memfs.addFile(entry.filename, FS.virtual[filename].contents);
				  } catch (e) {
					debugger
				  }

				  continue;
				}

				// 3. If it doesn't exist, proceed with full readEntry
				entry = this.readEntry();
				*/

				if(!entry) break;

				count++;

				switch(entry.type)
				{
					case '0': // Regular file.
						sharedSelf.FS.virtual[entry.filename] = {
							timestamp: new Date(),
							mode: FS_FILE,
							contents: entry.contents,
							path: entry.filename,
							sha: null,
							parent: entry.filename.substring(0, entry.filename.lastIndexOf('/'))
						};
						try
						{
							memfs.addFile(entry.filename, entry.contents);
						} catch(e)
						{
							debugger;
						}
						//putRecord(DB_STORE_NAME, FS.virtual[entry.filename], )
						break;
					case '5':
						if(entry.filename.endsWith('/'))
							entry.filename = entry.filename.substring(0, entry.filename.length - 1);
						sharedSelf.FS.virtual[entry.filename] = {
							timestamp: new Date(),
							mode: FS_DIR,
							path: entry.filename,
							parent: entry.filename.substring(0, entry.filename.lastIndexOf('/'))
						};
						try
						{
							memfs.addDirectory(entry.filename);
							//if (memfs)
							//memfs.mkdirp(entry.filename);
						} catch(e)
						{
							debugger;
						}
						break;
				}
			}

			return count;
		}
	}

	class API
	{
		constructor(options)
		{
			this.pid = 0;
			this.options = options;
			this.moduleCache = {};
			this.readBuffer = options.readBuffer;
			this.compileStreaming = options.compileStreaming;
			Module.hostWrite = this.hostWrite = options.hostWrite;
			this.clangFilename = options.clang || 'clang.wasm';
			this.lldFilename = options.lld || 'lld.wasm';
			this.sysrootFilename = options.sysroot || 'sysroot.tar';
			this.showTiming = options.showTiming || false;

			this.initMemFS();
			/*
			this.ready = new Promise((resolve) => {
			  this.untar(null, this.sysrootFilename);
			  resolve();
			});
			*/
		}



		initMemFS()
		{

			this.memfs = new MemFS({
				compileStreaming: this.compileStreaming,
				hostWrite: this.hostWrite,
				memfsFilename: this.options.memfs || 'memfs.wasm',
			}, this);

			this.ready = this.memfs.ready.then(
				() => { return this.untar(this.memfs, this.sysrootFilename); });

		}


		hostLog(message)
		{
			const timestamp = new Date().toLocaleTimeString();
			const [func, trailingFiles, rawFile] = getCalleeInfoFromStackTrace();
			const source = [
				...trailingFiles,     // <-- ['make', 'shared', 'worker']
				func,
				rawFile.split('/').pop().replace('.js', ''),
				rawFile
			];
			this.hostWrite(message, source);
		}

		async hostLogAsync(message, promise)
		{
			const start = +new Date();
			try
			{
				this.hostLog(`${message}...`);
				const result = await promise;
				this.hostWrite(' done.');
				return result;
			} catch(e)
			{
				if(e instanceof Error && e.message && !e.message.includes('Response code: 404'))
					this.hostWrite(` failed.\n\r${e.message}\n\r${e.stack}`);
				throw e;
			} finally
			{
				if(true || this.showTiming)
				{
					const end = +new Date();
					const green = '\x1b[92m';
					const normal = '\x1b[0m';
					this.hostWrite(` ${green}(${msToSec(start, end)}s)${normal}\n\r`);
				}

			}
		}


		commonPaths(name)
		{
			let result = [
				name,
				sharedSelf.dirs.ENGINE_RELEASE + '/' + name,
				sharedSelf.dirs.ENGINE_DEBUG + '/' + name,
				'components/compiler/' + name,
			];
			if(!name.endsWith('.js.wasm'))
			{
				result = result.concat(name + '.js.wasm',
					sharedSelf.dirs.ENGINE_RELEASE + '/' + name + '.js.wasm',
					sharedSelf.dirs.ENGINE_DEBUG + '/' + name + '.js.wasm',
					'components/compiler/' + name + '.js.wasm',
				);
			}
			if(!name.endsWith('.wasm'))
			{
				result = result.concat(name + '.wasm',
					sharedSelf.dirs.ENGINE_RELEASE + '/' + name + '.wasm',
					sharedSelf.dirs.ENGINE_DEBUG + '/' + name + '.wasm',
					'components/compiler/' + name + '.wasm',
				);
			}
			if(name.endsWith('.js.wasm'))
			{
				result = result.concat(name.replace('.js.wasm', '.wasm'),
					sharedSelf.dirs.ENGINE_RELEASE + '/' + name.replace('.js.wasm', '.wasm'),
					sharedSelf.dirs.ENGINE_DEBUG + '/' + name.replace('.js.wasm', '.wasm'),
					'components/compiler/' + name.replace('.js.wasm', '.wasm'),
				);
			}
			return result;
		}

		async getModule(name, database = null, alreadyTried = false)
		{

			if(typeof name !== 'string') throw new Error('Module name must be a string: ' + typeof (name) + ' given. ' + new String(name));
			if(this.moduleCache[name]) return this.moduleCache[name];
			let checkedPaths = [];

			try
			{
				let module;
				const tryDatabases = [database, this.engineRepo, this.assetRepo, this.gameRepo, this.toolsRepo, this.toolsRepo2, this.database];

				for(let filePath of this.commonPaths(name))
				{
					if(!filePath) continue;
					let contents;

					for(let selected of tryDatabases)
					{
						if(!selected) continue;
						try
						{
							const parts = selected.split('/');
							const ownerName = parts.length == 2 ? parts[0] : sharedSelf.RepositoryToolbar?.owner?.value;
							const repoName = parts.length == 2 ? parts[1] : parts[0] || sharedSelf.RepositoryToolbar?.repository?.value;
							// because this also creates the database with setupDatabase
							if(!sharedSelf.filesRepo?.[selected])
							{
								let branch = await sharedSelf.getDefaultBranch?.(ownerName, repoName);
								if(branch)
								{
									await sharedSelf.loadGitHubTree?.(ownerName, repoName, branch);
								}
							}

							let record = await sharedSelf.getRecord?.(sharedSelf.DB_STORE_NAME ?? '', filePath, selected);
							checkedPaths.push(filePath + ' on ' + selected);
							if(record)
							{
								contents = record.contents;
								break;
							}
						} catch(e)
						{
							if(e instanceof Error)
							{
								console.log(`${e.message}\n\r${e.stack}`);
							}
						}
					}

					if(this.memfs && this.memfs.exists(filePath)
						&& sharedSelf.FS.virtual[filePath]
					)
					{
						contents = this.memfs.getFileContents(filePath);
						if(!sharedSelf.FS.virtual[filePath] || contents.length === 0)
						{
							console.error('Assetion virtual fs not empty for wasm: ' + name);
							debugger;
						}
						sharedSelf.FS.virtual[filePath].contents = contents;
					}
					else if(sharedSelf.FS.virtual[filePath])
					{
						contents = sharedSelf.FS.virtual[filePath].contents;
					}

					if(contents)
					{
						module = await this.hostLogAsync(`Fetching and compiling from local: ${name}`,
							this.compileStreaming(contents));
						module.name = name;
						this.moduleCache[name] = this.moduleCache[filePath] = module;
						break;
					}

					try
					{
						if(!module || typeof module === 'string')
						{

							module = await this.hostLogAsync(`Fetching and compiling ${filePath}`,
								this.compileStreaming(filePath));
							module.name = name;
							this.moduleCache[name] = this.moduleCache[filePath] = module;
							break;
						}
					} catch(e)
					{
						if(e instanceof Error && e.message.includes('Response code: 404'))
						{
							console.warn('Tried: ' + filePath + ' and got ' + e.message + ' in getModule()');
						} else
						{
							console.warn(e);
						}
					}


				}
				if(!module) throw new Error('No module! ' + name);

				if(name.includes('q3lcc'))
				{
					try
					{
						let q3cpp = await this.getModule('q3cpp', database || this.toolsRepo, false);
						q3cpp.sync = true;
					} catch(e) { debugger; }
					try
					{
						let q3rcc = await this.getModule('q3rcc', database || this.toolsRepo, false);
						q3rcc.sync = true;
					} catch(e) { debugger; }
					try
					{
						let q3asm = await this.getModule('q3asm', this.toolsRepo2 || database, false);
						q3asm.sync = true;
					} catch(e) { debugger; }
				}

				return module;
			}
			catch(up)
			{

				this.hostWrite(name + ' not found at: \n\r' + checkedPaths.join('\n\r')
					+ '\n\r' + window.location + '/' + name + '\n\r');
				console.error(up);
				if(up instanceof Error
					&& (up.message.includes('Response code: 404')
						|| up.message.includes('HTTP status code is not ok'))
					|| (up instanceof Error && up.message.includes('No module!'))
					&& (this.toolsRepo || this.toolsRepo2 || this.database)
					&& !alreadyTried
				)
				{
					const selected = this.toolsRepo || database || this.database;
					sharedSelf.needsHeaders = true;

					// TODO: try compiling ourselves if its a known module + result
					if(name.includes('q3lcc'))
						await sharedSelf.buildLCC(selected, false);
					if(name.includes('q3rcc'))
						await sharedSelf.buildRCC(selected, false, false);
					if(name.includes('lburg'))
						await sharedSelf.buildLBurg(selected, false);
					if(name.includes('q3cpp'))
						await sharedSelf.buildCPP(selected, false);
					if(name.includes('q3asm'))
					{
						await sharedSelf.buildAsmTool(this.toolsRepo2 || selected, false);
					}
					if(name.includes('quake3e'))
						await sharedSelf.buildClient?.(selected, false, false, true /* no bounce */);
					//if(name.includes('quake3e.ded'))
					//	await buildDedicated(selected, false);
					if(name.includes('stringify'))
						await sharedSelf.buildStringify(selected, false);

					try
					{
						console.log("Compiling required tool: " + name + " on databases: " + selected);
						return await this.getModule(name, selected, true);
					} catch(e)
					{
						console.log("Error while compiling required tool: " + name + " on databases: " + selected);
						if(e instanceof Error)
						{
							console.log(`${e.message}\n\r${e.stack}`);
						}
						console.log('Cannot continue with building...');
						throw e;
					}
				}
				throw up;
			}
		}


		async untar(memfs, filename)
		{

			if(this.memfs)
				await this.memfs.ready;
			const promise = (async () =>
			{
				const tar = new Tar(await this.readBuffer(filename)); //, this.hostWrite);
				const count = await tar.untar(this.memfs);
				this.hostWrite(`${count} files read.`);
			})();
			await this.hostLogAsync(`Untaring ${filename}`, promise);
		}


		extract(options, database)
		{
			if(options.configuration)
				this.configuration = options.configuration;
			if(options.github_token)
				this.github_token = options.github_token;
			if(options.database)
				this.database = options.database || database;
			if(options.toolsRepo)
				this.toolsRepo = options.toolsRepo;
			if(options.toolsRepo2)
				this.toolsRepo2 = options.toolsRepo2;
			if(options.engineRepo)
				this.engineRepo = options.engineRepo;
			if(options.gameRepo)
				this.gameRepo = options.gameRepo;
			if(options.assetRepo)
				this.assetRepo = options.assetRepo;
		}


		async header(filePath, alwaysMkdir = false)
		{
			try
			{

				await this.ready;

				if(!this.database)
					return;

				if(filePath.startsWith('--allow-undefined-file='))
				{
					filePath = filePath.substring('--allow-undefined-file='.length);
				}

				let buildDir = filePath.substring(0, filePath.lastIndexOf('/'));
				if(alwaysMkdir)
					console.log('Header loading (worker): ' + filePath);

				if(filePath.includes(sharedSelf.dirs.ENGINE_RELEASE) || filePath.includes(sharedSelf.dirs.ENGINE_DEBUG))
				{
					//debugger
				}
				await sharedSelf.prepInputOutput(filePath, null, this.database, alwaysMkdir);

				return true;
			} catch(e)
			{
				if(e instanceof Error)
				{
					console.log(`${e.message}\n\r${e.stack}`);
				}
				return false;
			}
		}

		async upload(database = null)
		{
			await this.ready;
			this.database = database || this.database;
			if(!this.database) return;
		}



		async compile(options)
		{

			await this.ready;
			this.extract(options);
			const input = options.input;
			const virtualInput = path.join(this.database, input);
			const contents = options.contents;
			const obj = options.obj;
			const virtualObj = path.join(this.database, obj);
			const opt = options.opt || '2';


			if(input && contents)
				sharedSelf.FS.virtual[virtualInput] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: contents,
					path: input,
					parent: input.substring(0, input.lastIndexOf('/'))
				};

			await sharedSelf.prepInputOutput(input, obj, this.database, true);

			if(!sharedSelf.FS.virtual[virtualInput] || !sharedSelf.FS.virtual[virtualInput].contents)
			{
				debugger;
				console.error('Input file empty: ' + input);
			}

			sharedSelf.mkdirp(sharedSelf.config.TEMPDIR, this.database);

			if(input && this.memfs && sharedSelf.FS.virtual[virtualInput])
			{
				this.memfs.mkdirp(input.substring(0, input.lastIndexOf('/')));
				this.memfs.mkdirp(obj.substring(0, obj.lastIndexOf('/')));
				this.memfs.addFile(input, sharedSelf.FS.virtual[virtualInput].contents);
			}


			if(options.CFLAGS && this.database)
			{

				for(let filePath of options.CFLAGS)
				{
					if(!filePath) continue;
					await this.header(filePath);
				}
			}

			const clang = await this.getModule(this.clangFilename);
			let result = await this.run(clang, 'clang', ...options.CFLAGS || []);
			if(!obj)
				debugger;
			if(this.memfs && this.memfs.exists(obj))
			{
				let bytes = this.memfs.getFileContents(obj);
				sharedSelf.FS.virtual[virtualObj] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: bytes.slice(),
					path: obj,
					parent: obj.substring(0, obj.lastIndexOf('/'))
				};

				try
				{
					if(this.database)
						await sharedSelf.putRecord?.(sharedSelf.DB_STORE_NAME ?? '', sharedSelf.FS.virtual[virtualObj], this.database);

					console.log('Compile succeeded: ' + obj + '\n\r');
				} catch(e)
				{
					debugger;
					if(e instanceof Error)
					{
						console.log(`${e.message}\n\r${e.stack}`);
					}
				}
			}
			else if(this.database && sharedSelf.FS.virtual[virtualObj])
			{
				try
				{
					await sharedSelf.putRecord?.(sharedSelf.DB_STORE_NAME ?? '', sharedSelf.FS.virtual[virtualObj], this.database);
				} catch(e)
				{
					debugger;
					if(e instanceof Error)
					{
						console.log(`${e.message}\n\r${e.stack}`);
					}
				}
			}


			return result;
		}

		async compileToAssembly(options)
		{

			const input = options.input;
			const output = options.output;
			const contents = options.contents;
			const obj = options.obj;
			const triple = options.triple || 'x86_64';
			const opt = options.opt || '2';

			if(!contents)
			{
				debugger;
			}
			await this.ready;
			if(input && contents)
			{

				if(this.memfs)
					this.memfs.addFile(input, contents);

				sharedSelf.FS.virtual[input] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: contents,
					path: input,
					sha: await sharedSelf.getGitShaBrowser?.(contents),
					parent: input.substring(0, input.lastIndexOf('/'))
				};

			}

			const clang = await this.getModule(this.clangFilename);
			await this.run(clang, 'clang', '-cc1', '-S',
				`-triple=${triple}`, '-mllvm',
				'--x86-asm-syntax=intel', `-O${opt}`,
				'-o', output, '-x', 'c++', input);
			return sharedSelf.FS.virtual[output];
		}

		async compileTo6502(options)
		{

			const input = options.input;
			const output = options.output;
			const contents = options.contents;
			const flags = options.flags;

			await this.ready;

			sharedSelf.FS.virtual[input] = {
				timestamp: new Date(),
				mode: FS_FILE,
				contents: contents,
				path: input,
				parent: input.substring(0, input.lastIndexOf('/'))
			};


			const vasm = await this.getModule('vasm6502_oldstyle');
			await this.run(vasm, 'vasm6502_oldstyle', ...flags, '-o', output, input);
			return sharedSelf.FS.virtual[output];
		}

		async link(options)
		{

			await this.ready;
			this.extract(options);

			const obj = options.obj;
			const wasm = options.wasm;
			const virtualWasm = sharedSelf.path.join(this.database, wasm);


			if(wasm)
			{
				const dirPath = wasm.substring(0, wasm.lastIndexOf('/'));
				if(dirPath.trim().length > 0)
					sharedSelf.mkdirp(dirPath);
			}

			sharedSelf.mkdirp(sharedSelf.config.TEMPDIR, this.database);


			const loadedObjs = [];
			const lld = await this.getModule(this.lldFilename);

			if(this.database)
			{

				for(let filePath of Array.isArray(obj) ? obj : [obj])
				{
					if(!filePath) continue;
					await this.header(filePath, true);
					loadedObjs.push(filePath);

				}
			}

			if(options.LDFLAGS && this.database)
			{
				for(let filePath of options.LDFLAGS)
				{
					if(!filePath) continue;
					if(loadedObjs.includes(filePath)) continue;
					await this.header(filePath);

				}
			}



			//const libdir = 'lib/wasm32-wasi';
			//const crt1 = `${libdir}/crt1.o`;


			await this.run(
				lld, 'wasm-ld', ...options.LDFLAGS || []);

			try
			{
				if(wasm && this.memfs && this.memfs.exists(wasm))
				{
					let bytes = this.memfs.getFileContents(wasm);
					if(bytes.length > 0)
					{
						sharedSelf.FS.virtual[virtualWasm] = {
							timestamp: new Date(),
							mode: FS_FILE,
							contents: bytes,
							path: wasm,
							parent: wasm.substring(0, wasm.lastIndexOf('/'))
						};

						if(this.database)
							await sharedSelf.putRecord?.(sharedSelf.DB_STORE_NAME ?? '', sharedSelf.FS.virtual[virtualWasm], this.database);

					}
				} else if(this.database && sharedSelf.FS.virtual[virtualWasm] && sharedSelf.FS.virtual[virtualWasm].contents)
				{
					await sharedSelf.putRecord?.(sharedSelf.DB_STORE_NAME ?? '', sharedSelf.FS.virtual[virtualWasm], this.database);
				}

			} catch(e)
			{
				if(e instanceof Error)
				{
					console.log(`${e.message}\n\r${e.stack}`);
				}
			}

			if(sharedSelf.FS.virtual[virtualWasm] && sharedSelf.FS.virtual[virtualWasm].contents.length > 1024)
				console.log('Link succeeded: ' + wasm + '\n\r');

			return sharedSelf.FS.virtual[virtualWasm];
		}


		async build(selected, mode = 'all')
		{


			sharedSelf.needsHeaders = true;

			if(mode === 'stringify' || mode === 'engine'
				|| mode === 'release' || mode === 'debug' || mode === 'all')
				await sharedSelf.buildStringify(selected, mode === 'stringify');
			if(mode === 'shaders' || mode === 'engine'
				|| mode === 'release' || mode === 'debug' || mode === 'all')
				await sharedSelf.buildShaders(selected, mode === 'shaders');
			if(mode === 'client' || mode === 'engine'
				|| mode === 'release' || mode === 'debug' || mode === 'all')
				await sharedSelf.buildClient(selected, mode === 'client' || mode === 'engine', false, true);


			if(!selected)
				selected = this.database;
			if(mode === 'lburg' || mode === 'tools' || mode === 'all')
				await sharedSelf.buildTools(selected, 'lburg', mode === 'lburg', true); // shared debouncer
			if(mode === 'q3rcc' || mode === 'tools' || mode === 'all')
				await sharedSelf.buildTools(selected, 'q3rcc', mode === 'q3rcc', true); // implicit forceChanged = true
			if(mode === 'q3cpp' || mode === 'tools' || mode === 'all')
				await sharedSelf.buildTools(selected, 'q3cpp', mode === 'q3cpp', true);
			if(mode === 'q3lcc' || mode === 'tools' || mode === 'all')
				await sharedSelf.buildTools(selected, 'q3lcc', mode === 'q3lcc', true);
			if(mode == 'q3asm' || mode === 'tools' || mode === 'all')
				await sharedSelf.buildTools(selected, 'q3asm', mode === 'q3asm', true);

			if(mode == 'game' || mode === 'qvms' || mode === 'all')
				await sharedSelf.buildModule('game', sharedSelf.dirs.QADIR, gameFiles, selected, ['QAGAME'], mode === 'game', false, true);
			if(mode == 'cgame' || mode === 'qvms' || mode === 'all')
				await sharedSelf.buildModule('cgame', sharedSelf.dirs.CGDIR, cgameFiles, selected, ['CGAME'], mode === 'cgame', false, true);
			if(mode == 'ui' || mode === 'qvms' || mode === 'all')
				await sharedSelf.buildModule('ui', sharedSelf.dirs.UIDIR, uiFiles, selected, ['UI'], mode === 'ui', false, true);
			if(mode == 'q3_ui' || mode === 'qvms' || mode === 'all')
				await sharedSelf.buildModule('q3_ui', sharedSelf.dirs.Q3UIDIR, q3uiFiles, selected, ['UI'], mode === 'q3_ui', false, true);


		}


		runSync(module, ...args)
		{



			if(typeof module == 'string' || !module)
				module = this.moduleCache[module];

			if(typeof module == 'string' || !module)
				throw new Error('Cannot load module: ' + name);

			sharedSelf.mkdirp(sharedSelf.config.TEMPDIR, this.database);

			/*
			if (args) {
			  for (let filePath of args) {
				if (!filePath) continue
				await this.header(filePath)
			  }
			}
			*/

			if(!args)
				args = [];

			if(args.length == 0)
				args[0] = module.name;

			console.log(`${args.join(' ')}\n`);

			const start = +new Date();
			const instantiate = +new Date();
			if(!(module instanceof App))
			{
				module = new App(this, this.hostWrite, module, this.sysrootFilename, ...args || []);
			}
			const stillRunning = module.runSync();

			const end = +new Date();

			if(this.showTiming)
			{
				const green = '\x1b[92m';
				const normal = '\x1b[0m';
				let msg = `${green}(${msToSec(start, instantiate)}s`;
				msg += `/${msToSec(instantiate, end)}s)${normal}\n\r`;
				this.hostWrite(msg);
			}

			return module.output || stillRunning === 0 || stillRunning === true ? 0 : stillRunning;
		}

		async run(module, ...args)
		{
			await this.ready;

			if(module.args)
				args = module.args;
			if(module.tool)
				module = module.tool;

			if(typeof module == 'string' || !module)
				module = await this.getModule(module);


			if(typeof module == 'string' || !module)
				throw new Error('Cannot load module: ' + name);


			sharedSelf.mkdirp(sharedSelf.config.TEMPDIR, this.database);

			/*
			if (args) {
			  for (let filePath of args) {
				if (!filePath) continue
				await this.header(filePath)

			  }
			}
			*/



			if(!args)
				args = [];

			if(args.length == 0)
				args[0] = module.name;

			console.log(`${args.join(' ')}\n`);

			const start = +new Date();
			const instantiate = +new Date();
			if(!(module instanceof App))
			{
				module = new App(this, this.hostWrite, module, this.sysrootFilename, ...args || []);
			}
			const stillRunning = await module.run();
			const end = +new Date();

			if(this.showTiming)
			{
				const green = '\x1b[92m';
				const normal = '\x1b[0m';
				let msg = `${green}(${msToSec(start, instantiate)}s`;
				msg += `/${msToSec(instantiate, end)}s)${normal}\n\r`;
				this.hostWrite(msg);
			}

			return module.output || stillRunning ? module : null;
		}

		async compileLinkRun(options)
		{

			const input = `test.cc`;
			const obj = `test.o`;
			const wasm = `test.wasm`;
			const virtualWasm = sharedSelf.path.join(this.database, wasm);
			await this.compile({ input, contents: options.contents, obj });
			await this.link({ obj, wasm });

			const testMod = await this.hostLogAsync(`Compiling ${wasm}`,
				WebAssembly.compile(sharedSelf.FS.virtual[virtualWasm]?.contents));
			return await this.run(testMod, wasm);
		}
	}


	const ST_FILE = 8;
	const ST_DIR = 4;
	const FS_DEFAULT = (6 << 3) + (6 << 6) + (6);
	const FS_FILE = (ST_FILE << 12) + FS_DEFAULT;
	const FS_DIR = (ST_DIR << 12) + FS_DEFAULT;

	API.App = App;
	API.Tar = Tar;

	return API;

})();
