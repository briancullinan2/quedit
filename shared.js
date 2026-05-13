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

function sleep(ms) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

function readStr(u8, o, len = -1) {
  let str = '';
  let end = u8.length;
  if (len != -1)
    end = o + len;
  for (let i = o; i < end && u8[i] != 0; ++i)
    str += String.fromCharCode(u8[i]);
  return str;
}

function debounceLazy(f, ms) {
  let waiting = 0;
  let running = false;

  const wait = async () => {
    ++waiting;
    await sleep(ms);
    return --waiting === 0;
  };

  const wrapped = async (...args) => {
    if (await wait()) {
      while (running) await wait();
      running = true;
      try {
        await f(...args);
      } finally {
        running = false;
      }
    }
  };
  return wrapped;
}

if (!self.needsHeaders)
  self.needsHeaders = true

const API = (function () {

  class ProcExit extends Error {
    constructor(code) {
      super(`process exited with code ${code}.`);
      this.code = code;
    }
  };

  class NotImplemented extends Error {
    constructor(modname, fieldname) {
      super(`${modname}.${fieldname} not implemented.`);
    }
  }

  class AbortError extends Error {
    constructor(msg = 'abort') { super(msg); }
  }

  class AssertError extends Error {
    constructor(msg) { super(msg); }
  }

  function assert(cond) {
    if (!cond) {
      throw new AssertError('assertion failed.');
    }
  }

  function getInstance(module, imports) {
    return WebAssembly.instantiate(module, imports);
  }

  function getImportObject(obj, names) {
    const result = {};
    for (let name of names) {
      result[name] = obj[name].bind(obj);
    }
    return result;
  }

  function msToSec(start, end) {
    return ((end - start) / 1000).toFixed(2);
  }

  const ESUCCESS = 0;

  class Memory {
    constructor(memory) {
      this.memory = memory;
      this.buffer = this.memory.buffer;
      this.u8 = new Uint8Array(this.buffer);
      this.u32 = new Uint32Array(this.buffer);
    }

    check() {
      if (this.buffer.byteLength === 0) {
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

    readStr(o, len) {
      return readStr(this.u8, o, len);
    }

    // Null-terminated string.
    writeStr(o, str) {
      o += this.write(o, str);
      this.write8(o, 0);
      return str.length + 1;
    }

    write(o, buf) {
      if (buf instanceof ArrayBuffer) {
        return this.write(o, new Uint8Array(buf));
      } else if (typeof buf === 'string') {
        return this.write(o, buf.split('').map(x => x.charCodeAt(0)));
      } else {
        const dst = new Uint8Array(this.buffer, o, buf.length);
        dst.set(buf);
        return buf.length;
      }
    }
  };

  class MemFS {
    constructor(options) {
      const compileStreaming = options.compileStreaming;
      this.hostWrite = options.hostWrite;
      this.stdinStr = options.stdinStr || "";
      this.stdinStrPos = 0;
      this.memfsFilename = options.memfsFilename;

      this.hostMem_ = null;  // Set later when wired up to application.

      // Imports for memfs this.exports.
      const env = getImportObject(
        this, ['abort', 'host_write', 'host_read', 'memfs_log', 'copy_in', 'copy_out']);

      this.ready = compileStreaming(this.memfsFilename)
        .then(module => WebAssembly.instantiate(module, { env }))
        .then(instance => {
          this.instance = instance;
          this.exports = instance.exports;
          this.mem = new Memory(this.exports.memory);
          this.exports.init();
        })
    }

    set hostMem(mem) {
      this.hostMem_ = mem;
    }

    setStdinStr(str) {
      this.stdinStr = str;
      this.stdinStrPos = 0;
    }

    addDirectory(path) {
      this.mem.check();
      this.mem.write(this.exports.GetPathBuf(), path);
      this.exports.AddDirectoryNode(path.length);
    }

    exists(path) {
      try {
        this.mem.check();
        this.mem.write(this.exports.GetPathBuf(), path);
        const inode = this.exports.FindNode(path.length);

        // 0 or a specific constant usually represents INVALID_INODE
        return inode !== 0;
      }
      catch (e) {
        return false
      }
    }

    mkdirp(path) {
      // Ensure we have a clean array of directory segments
      // Filter(Boolean) removes empty strings from leading/double slashes
      const parts = path.split('/').filter(Boolean);
      let currentPath = path.startsWith('/') ? '/' : '';

      for (const part of parts) {
        // If we're at the root, don't double up the slash
        currentPath = currentPath === '' ? `${part}` : `${currentPath}/${part}`;

        try {
          this.mem.check();
          this.mem.write(this.exports.GetPathBuf(), currentPath);

          // We call the Wasm export to create the directory node
          // Note: If your Wasm AddDirectoryNode asserts on existing dirs, 
          // you'll need to check existence first or wrap this in a try/catch.
          if (!this.exists(currentPath))
            this.exports.AddDirectoryNode(currentPath.length);
        } catch (e) {
          // Log only if it's a real crash, not just an "already exists" error
          if (!e.message.includes("exists")) {
            console.warn(`mkdirp segment failed: ${currentPath}`, e);
          }
        }
      }
    }

    addFile(path, contents) {
      try {
        const dirPath = path.substring(0, path.lastIndexOf('/'));
        if (dirPath) {
          this.mkdirp(dirPath);
        }

        const length =
          contents instanceof ArrayBuffer ? contents.byteLength : contents.length;
        this.mem.check();
        this.mem.write(this.exports.GetPathBuf(), path);
        const inode = this.exports.AddFileNode(path.length, length);
        const addr = this.exports.GetFileNodeAddress(inode);
        this.mem.check();
        this.mem.write(addr, contents);
      }
      catch (e) {
        console.error(path + ' - ' + e)
      }
    }

    directoryList(fd) {
      // 1. Use your established scratch space
      const bufPtr = this.exports.GetPathBuf();
      const bufLen = this.exports.GetPathBufLen();

      // 2. We'll use the last 4 bytes of the scratch buffer for nreadPtr
      // to avoid a separate allocation or hardcoded address.
      const nreadPtr = bufPtr + bufLen - 4;
      const PAGE_SIZE = bufLen - 4;

      const results = [];
      let cookie = 0n;

      while (true) {
        // Call WASI export using the scratch buffer
        const errno = this.exports.fd_readdir(fd, bufPtr, PAGE_SIZE, cookie, nreadPtr);

        if (errno !== 0) {
          console.error(`readdir failed with errno: ${errno}`);
          break;
        }

        const view = new DataView(this.exports.memory.buffer);
        const nread = view.getUint32(nreadPtr, true);
        if (nread === 0) break;

        let offset = 0;
        while (offset < nread) {
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

        if (nread < PAGE_SIZE) break;
      }

      return results;
    }


    async recursiveDir(dirFd, pathStr = "") {
      // 1. Get the scratch space provided by your Wasm module
      const scratchPtr = this.exports.GetPathBuf();
      const scratchLen = this.exports.GetPathBufLen();

      if (scratchLen < 4096) {
        throw new Error("Scratch buffer too small for readdir");
      }

      const entries = this.directoryList(dirFd, scratchPtr, scratchLen);

      for (const entry of entries) {
        const fullPath = pathStr ? `${pathStr}/${entry.name}` : entry.name;

        if (entry.type === 4) { // Directory
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

          if (errno === 0) {
            const subDirFd = new DataView(this.exports.memory.buffer).getUint32(resultFdPtr, true);

            await recursiveDir(subDirFd, fullPath);
            this.exports.fd_close(subDirFd);
          }
        } else {
          console.log(`File: ${fullPath}`);
        }
      }
    }

    openPath(pathString) {
      const scratchPtr = this.exports.GetPathBuf();
      const scratchLen = this.exports.GetPathBufLen();

      // 1. Write the path string into the Wasm memory
      const encoder = new TextEncoder();
      const encodedPath = encoder.encode(pathString);
      new Uint8Array(this.exports.memory.buffer).set(encodedPath, scratchPtr);

      // 2. Prepare space for the returned FD (4 bytes)
      // We'll put it at the end of the scratch buffer
      const resultFdPtr = scratchPtr + scratchLen - 4;

      // 3. Call path_open
      // We use FD 3 as the base (the first pre-opened directory)
      const errno = this.exports.path_open(
        3,                    // dirfd (The first pre-open)
        1,                    // lookupflags (1 = symlink follow)
        scratchPtr,           // path_ptr
        encodedPath.length,   // path_len
        0,                    // oflags
        0x2000000n,           // rights (DIRECTORY_LIST / OPEN)
        0x2000000n,           // inheriting rights
        0,                    // fdflags
        resultFdPtr           // output pointer
      );

      if (errno !== 0) {
        console.error(`Failed to open path "${pathString}": Errno ${errno}`);
        return -1;
      }

      // 4. Read the new FD from memory
      return new DataView(this.exports.memory.buffer).getUint32(resultFdPtr, true);
    }

    getFileContents(path) {
      this.mem.check();
      this.mem.write(this.exports.GetPathBuf(), path);
      const inode = this.exports.FindNode(path.length);
      const addr = this.exports.GetFileNodeAddress(inode);
      const size = this.exports.GetFileNodeSize(inode);
      return new Uint8Array(this.mem.buffer, addr, size);
    }

    abort() { throw new AbortError(); }

    host_write(fd, iovs, iovs_len, nwritten_out) {
      this.hostMem_.check();
      assert(fd <= 2);
      let size = 0;
      let str = '';
      for (let i = 0; i < iovs_len; ++i) {
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

    host_read(fd, iovs, iovs_len, nread) {
      this.hostMem_.check();
      assert(fd === 0);
      let size = 0;
      for (let i = 0; i < iovs_len; ++i) {
        const buf = this.hostMem_.read32(iovs);
        iovs += 4;
        const len = this.hostMem_.read32(iovs);
        iovs += 4;
        const lenToWrite = Math.min(len, (this.stdinStr.length - this.stdinStrPos));
        if (lenToWrite === 0) {
          break;
        }
        this.hostMem_.write(buf, this.stdinStr.substr(this.stdinStrPos, lenToWrite));
        size += lenToWrite;
        this.stdinStrPos += lenToWrite;
        if (lenToWrite !== len) {
          break;
        }
      }
      // For logging
      // this.hostWrite("Read "+ size + "bytes, pos: "+ this.stdinStrPos + "\n");
      this.hostMem_.write32(nread, size);
      return ESUCCESS;
    }

    memfs_log(buf, len) {
      this.mem.check();
      console.log(this.mem.readStr(buf, len));
    }

    copy_out(clang_dst, memfs_src, size) {
      this.hostMem_.check();
      const dst = new Uint8Array(this.hostMem_.buffer, clang_dst, size);
      this.mem.check();
      const src = new Uint8Array(this.mem.buffer, memfs_src, size);
      // console.log(`copy_out(${clang_dst.toString(16)}, ${memfs_src.toString(16)}, ${size})`);
      dst.set(src);
    }

    copy_in(memfs_dst, clang_src, size) {
      this.mem.check();
      const dst = new Uint8Array(this.mem.buffer, memfs_dst, size);
      this.hostMem_.check();
      const src = new Uint8Array(this.hostMem_.buffer, clang_src, size);
      // console.log(`copy_in(${memfs_dst.toString(16)}, ${clang_src.toString(16)}, ${size})`);
      dst.set(src);
    }
  }

  const RAF_PROC_EXIT_CODE = 0xC0C0A;

  class App {
    constructor(api, hostWrite, module, sysrootFilename, name, ...args) {
      this.api = api;
      this.hostWrite = hostWrite
      this.sysrootFilename = sysrootFilename;
      SYS.startArgs = this.argv = [name, ...args];
      Module.environment = this.environ = { USER: 'alice' };
      this.allowRequestAnimationFrame = true;
      this.handles = new Map();
      this.nextHandle = 0;
      Module.database = this.api.database

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
        'args_get', 'random_get', 'clock_time_get', 'poll_oneoff'
      ]);
      Module.errno = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
      //const wasi_unstable = {
      //  'errno': Module.errno
      //}

      let needMemfs = module.name.includes('lld')
        || module.name.includes('clang')

      if (!needMemfs) {
        if (!wasi_unstable.table) {
          const importTable = new WebAssembly.Table({
            initial: 2000,
            element: 'anyfunc',
            maximum: 10000
          })
          env.__indirect_function_table = wasi_unstable.table = ENV.__indirect_function_table = importTable
        }
        if (!wasi_unstable.memory) {
          ENV.memory = Module.memory = wasi_unstable.memory = new WebAssembly.Memory({
            initial: 4096,
            maximum: 32000,
            //'shared': true
          })
        }
        //wasi_unstable.env = ENV.wasi_snapshot_preview1 = wasi_unstable
        wasi_unstable.imports = wasi_unstable
        Object.assign(wasi_unstable, FS);
      }
      else {
        Object.assign(wasi_unstable, this.api.memfs.exports);
        // TODO: make optional until i know its working?
        Object.assign(wasi_unstable, FS);
      }






      Object.assign(wasi_unstable, {
        fork: () => 0,
        execv: function (path, ...argv) {
          debugger
          var cmdArgs = FS.getStringsFromArgv(argv)
          this.api.run(cmdArgs)
          return 0
        }
      });

      //else
      if (needMemfs) {
        //wasi_unstable.fd_prestat_dir_name = this.api.memfs.exports.fd_prestat_dir_name
        //wasi_unstable.fd_prestat_get = this.api.memfs.exports.fd_prestat_get
        wasi_unstable.path_open = this.api.memfs.exports.path_open
        wasi_unstable.fd_read = this.api.memfs.exports.fd_read
        wasi_unstable.fd_pread = this.api.memfs.exports.fd_pread
        wasi_unstable.fd_seek = this.api.memfs.exports.fd_seek
        wasi_unstable.fd_filestat_get = this.api.memfs.exports.fd_filestat_get
        wasi_unstable.fd_fdstat_get = this.api.memfs.exports.fd_fdstat_get
        wasi_unstable.path_filestat_get = this.api.memfs.exports.path_filestat_get
        wasi_unstable.path_rename = this.api.memfs.exports.path_rename
        wasi_unstable.fd_readdir = this.api.memfs.exports.fd_readdir
        //wasi_unstable.fd_close = this.api.memfs.exports.fd_close
        //wasi_unstable.path_unlink_file = this.api.memfs.exports.path_unlink_file
        //wasi_unstable.path_readlink = this.api.memfs.exports.path_readlink

        //wasi_unstable.fd_allocate = this.api.memfs.exports.fd_allocate
        //wasi_unstable.fd_fdstat_set_flags = this.api.memfs.exports.fd_fdstat_set_flags
        //wasi_unstable.fd_filestat_set_size = this.api.memfs.exports.fd_filestat_set_size
        wasi_unstable.fd_write = this.api.memfs.exports.fd_write
        //wasi_unstable.path_create_directory = this.api.memfs.exports.path_create_directory
        //wasi_unstable.path_remove_directory = this.api.memfs.exports.path_remove_directory
        //wasi_unstable.path_symlink = this.api.memfs.exports.path_symlink
      }


      Object.assign(env, wasi_unstable)
      const imports = WebAssembly.Module.imports(module);

      this.ready = getInstance(module, { wasi_unstable, env }).then(instance => {
        this.instance = instance;
        Module.exports = this.exports = this.instance.exports;
        this.mem = new Memory(this.exports.memory);
        if (this.api.memfs)
          this.api.memfs.hostMem = this.mem;
        if (!Module.memory || needMemfs)
          ENV.memory = Module.memory = this.exports.memory
        window.STD.sharedMemory = Module.__heap_base = this.exports.__heap_base.value
        Module.errno.value = (this.exports['___errno_location'])
          ? this.exports['___errno_location']()
          : 0 || this.exports['errno'];
        updateGlobalBufferAndViews()
      });
    }

    async run() {
      await this.ready;
      try {
        this.exports._start();
      } catch (exn) {
        let writeStack = true;

        if (exn.message.includes('memory access out of bounds')) {
          this.api.initMemFS()
        }

        if (exn instanceof ProcExit
          || exn.message === 'WASI_ENOSYS'
        ) {
          if (exn.code === RAF_PROC_EXIT_CODE
            || exn.code === 0
          ) {
            console.log('Allowing rAF after exit.');
            return true;
          }
          // Don't allow rAF unless you return the right code.
          console.log(`Disallowing rAF since exit code is ${exn.code}.`);
          this.allowRequestAnimationFrame = false;
          if (exn.code == 0) {
            return false;
          }
          writeStack = false;
        }


        if (exn.message === 'WASI_ENOSYS') {
          let msg = `\x1b[91mError: Exit code ${exn.code}`;
          if (writeStack) {
            msg = msg + `\n${exn.stack}`;
          }
          msg += '\x1b[0m\n\r';
          this.hostWrite(msg);
        }
        else {
          // Write error message.
          let msg = `\x1b[91mError: ${exn.message}`;
          if (writeStack) {
            msg = msg + `\n${exn.stack}`;
          }
          msg += '\x1b[0m\n\r';
          this.hostWrite(msg);
        }

        // Propagate error.
        throw exn;
      }
    }

    proc_exit(code) {
      throw new ProcExit(code);
    }

    environ_sizes_get(environ_count_out, environ_buf_size_out) {
      this.mem.check();
      let size = 0;
      const names = Object.getOwnPropertyNames(this.environ);
      for (const name of names) {
        const value = this.environ[name];
        // +2 to account for = and \0 in "name=value\0".
        size += name.length + value.length + 2;
      }
      this.mem.write64(environ_count_out, names.length);
      this.mem.write64(environ_buf_size_out, size);
      return ESUCCESS;
    }

    environ_get(environ_ptrs, environ_buf) {
      this.mem.check();
      const names = Object.getOwnPropertyNames(this.environ);
      for (const name of names) {
        this.mem.write32(environ_ptrs, environ_buf);
        environ_ptrs += 4;
        environ_buf +=
          this.mem.writeStr(environ_buf, `${name}=${this.environ[name]}`);
      }
      this.mem.write32(environ_ptrs, 0);
      return ESUCCESS;
    }

    args_sizes_get(argc_out, argv_buf_size_out) {
      this.mem.check();
      let size = 0;
      for (let arg of this.argv) {
        size += arg.length + 1;  // "arg\0".
      }
      this.mem.write64(argc_out, this.argv.length);
      this.mem.write64(argv_buf_size_out, size);
      return ESUCCESS;
    }

    args_get(argv_ptrs, argv_buf) {
      this.mem.check();
      for (let arg of this.argv) {
        this.mem.write32(argv_ptrs, argv_buf);
        argv_ptrs += 4;
        argv_buf += this.mem.writeStr(argv_buf, arg);
      }
      this.mem.write32(argv_ptrs, 0);
      return ESUCCESS;
    }

    random_get(buf, buf_len) {
      const data = new Uint8Array(this.mem.buffer, buf, buf_len);
      for (let i = 0; i < buf_len; ++i) {
        data[i] = (Math.random() * 256) | 0;
      }
    }

    clock_time_get(id, precision, result_ptr) {
      this.mem.check();
      // id: 0 = REALTIME, 1 = MONOTONIC
      // result_ptr: index in WASM memory where the 64-bit timestamp goes

      let timeInNanoseconds;

      if (id === 1) { // MONOTONIC
        timeInNanoseconds = BigInt(Math.floor(performance.now() * 1000000));
      } else { // REALTIME
        timeInNanoseconds = BigInt(Date.now()) * 1000000n;
      }

      // Use BigUint64Array to write the 8-byte value into memory
      // result_ptr is the offset in the shared buffer
      const memory = new BigUint64Array(this.mem.buffer);
      memory[result_ptr >> 3] = timeInNanoseconds;

      return 0; // 0 is the WASI 'success' code (errno.SUCCESS)
    }


    poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out) {
      this.mem.check();
      const mem = new DataView(this.mem.buffer);
      let eventsCreated = 0;

      for (let i = 0; i < nsubscriptions; i++) {
        // WASI Subscription struct is 40 bytes
        const subPtr = in_ptr + (i * 40);
        const userdata = mem.getBigUint64(subPtr, true);
        const type = mem.getUint8(subPtr + 8); // 0 = Clock, 1 = FD_READ, 2 = FD_WRITE

        if (type === 0) { // EVENTTYPE_CLOCK
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
        } else {
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

    canvas_destroyHandle(handle) {
      this.handles.delete(handle);
    }

    // Canvas API
    canvas_setWidth(width) { if (canvas) canvas.width = width; }
    canvas_setHeight(height) { if (canvas) canvas.height = height; }
    canvas_requestAnimationFrame() {
      if (this.allowRequestAnimationFrame) {
        requestAnimationFrame(ms => {
          if (this.allowRequestAnimationFrame) {
            this.exports.canvas_loop(ms);
          }
        });
      }
    }

    // ImageData stuff
    canvas_createImageData(w, h) {
      if (ctx2d) {
        const imageData = ctx2d.createImageData(w, h);
        const handle = this.nextHandle++;
        this.handles.set(handle, imageData);
        return handle;
      }
      return -1;
    }
    canvas_putImageData(handle, x, y) {
      if (ctx2d) {
        const imageData = this.handles.get(handle);
        if (imageData) {
          ctx2d.putImageData(imageData, x, y);
        }
      }
    }
    canvas_imageDataSetData(handle, buffer, offset, size) {
      const imageData = this.handles.get(handle);
      if (imageData) {
        this.mem.check();
        const src = new Uint8Array(this.mem.buffer, buffer, size);
        imageData.data.set(src, offset);
      }
    }

    // Other Canvas methods.
    canvas_arc(...args) { if (ctx2d) ctx2d.arc(...args); }
    canvas_arcTo(...args) { if (ctx2d) ctx2d.arcTo(...args); }
    canvas_beginPath(...args) { if (ctx2d) ctx2d.beginPath(...args); }
    canvas_bezierCurveTo(...args) { if (ctx2d) ctx2d.bezierCurveTo(...args); }
    canvas_clearRect(...args) { if (ctx2d) ctx2d.clearRect(...args); }
    canvas_clip(value) { if (ctx2d) ctx2d.clip(['nonzero', 'evenodd'][value]); }
    canvas_closePath(...args) { if (ctx2d) ctx2d.closePath(...args); }
    canvas_ellipse(...args) { if (ctx2d) ctx2d.ellipse(...args); }
    canvas_fill(value) { if (ctx2d) ctx2d.fill(['nonzero', 'evenodd'][value]); }
    canvas_fillRect(...args) { if (ctx2d) ctx2d.fillRect(...args); }
    canvas_fillText(text, text_len, x, y) {  // TODO: maxwidth
      this.mem.check();
      if (ctx2d) ctx2d.fillText(this.mem.readStr(text, text_len), x, y);
    }
    canvas_lineTo(...args) { if (ctx2d) ctx2d.lineTo(...args); }
    canvas_measureText(text, text_len) {
      this.mem.check();
      if (ctx2d) return ctx2d.measureText(this.mem.readStr(text, text_len)).width;
      return 0;
    }
    canvas_moveTo(...args) { if (ctx2d) ctx2d.moveTo(...args); }
    canvas_quadraticCurveTo(...args) { if (ctx2d) ctx2d.quadraticCurveTo(...args); }
    canvas_rect(...args) { if (ctx2d) ctx2d.rect(...args); }
    canvas_restore(...args) { if (ctx2d) ctx2d.restore(...args); }
    canvas_rotate(...args) { if (ctx2d) ctx2d.rotate(...args); }
    canvas_save(...args) { if (ctx2d) ctx2d.save(...args); }
    canvas_scale(...args) { if (ctx2d) ctx2d.scale(...args); }
    canvas_setTransform(...args) { if (ctx2d) ctx2d.setTransform(...args); }
    canvas_stroke(...args) { if (ctx2d) ctx2d.stroke(...args); }
    canvas_strokeRect(...args) { if (ctx2d) ctx2d.strokeRect(...args); }
    canvas_strokeText(text, text_len, x, y) {  // TODO: maxwidth
      this.mem.check();
      if (ctx2d) ctx2d.strokeText(this.mem.readStr(text, text_len), x, y);
    }
    canvas_transform(...args) { if (ctx2d) ctx2d.transform(...args); }
    canvas_translate(...args) { if (ctx2d) ctx2d.translate(...args); }

    // Canvas properties.
    canvas_setFillStyle(buf, len) {
      this.mem.check();
      if (ctx2d) ctx2d.fillStyle = this.mem.readStr(buf, len);
    }
    canvas_setFont(buf, len) {
      this.mem.check();
      if (ctx2d) ctx2d.font = this.mem.readStr(buf, len);
    }
    canvas_setGlobalAlpha(value) { if (ctx2d) ctx2d.globalAlpha = value; }
    canvas_setLineCap(value) {
      if (ctx2d) ctx2d.lineCap = ['butt', 'round', 'square'][value];
    }
    canvas_setLineDashOffset(value) { if (ctx2d) ctx2d.lineDashOffset = value; }
    canvas_setLineJoin(value) {
      if (ctx2d) ctx2d.lineJoin = ['bevel', 'round', 'miter'][value];
    }
    canvas_setLineWidth(value) { if (ctx2d) ctx2d.lineWidth = value; }
    canvas_setMiterLimit(value) { if (ctx2d) ctx2d.miterLimit = value; }
    canvas_setShadowBlur(value) { if (ctx2d) ctx2d.shadowBlur = value; }
    canvas_setShadowColor(buf, len) {
      this.mem.check();
      if (ctx2d) ctx2d.shadowColor = this.mem.readStr(buf, len);
    }
    canvas_setShadowOffsetX(value) { if (ctx2d) ctx2d.setShadowOffsetX = value; }
    canvas_setShadowOffsetY(value) { if (ctx2d) ctx2d.setShadowOffsetY = value; }
    canvas_setStrokeStyle(buf, len) {
      this.mem.check();
      if (ctx2d) ctx2d.strokeStyle = this.mem.readStr(buf, len);
    }
    canvas_setTextAlign(value) {
      if (ctx2d)
        ctx2d.textAlign = ['left', 'right', 'center', 'start', 'end'][value];
    }
    canvas_setTextBaseline(value) {
      if (ctx2d)
        ctx2d.textBaseline = [
          'top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'
        ][value];
    }
  }

  class Tar {
    constructor(buffer) {
      this.u8 = new Uint8Array(buffer);
      this.offset = 0;
    }

    readStr(len) {
      const result = readStr(this.u8, this.offset, len);
      this.offset += len;
      return result;
    }

    readOctal(len) {
      return parseInt(this.readStr(len), 8);
    }

    alignUp() {
      this.offset = (this.offset + 511) & ~511;
    }

    readEntry() {
      if (this.offset + 512 > this.u8.length) {
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

      if (this.readStr(8) !== 'ustar  ') {
        return null;
      }

      entry.ownerName = this.readStr(32);
      entry.groupName = this.readStr(32);
      entry.devMajor = this.readStr(8);
      entry.devMinor = this.readStr(8);
      entry.filenamePrefix = this.readStr(155);
      this.alignUp();

      if (entry.type === '0') {        // Regular file.
        entry.contents = this.u8.subarray(this.offset, this.offset + entry.size);
        this.offset += entry.size;
        this.alignUp();
      } else if (entry.type !== '5') { // Directory.
        console.log('type', entry.type);
        assert(false);
      }
      return entry;
    }

    async untar(memfs) {
      let entry;
      while (entry = this.readEntry()) {
        switch (entry.type) {
          case '0': // Regular file.
            if (memfs)
              memfs.addFile(entry.filename, entry.contents);
            FS.virtual[entry.filename] = {
              timestamp: new Date(),
              mode: FS_FILE,
              contents: entry.contents,
              path: entry.filename,
              sha: await getGitShaBrowser(entry.contents),
              parent: entry.filename.substring(0, entry.filename.lastIndexOf('/'))
            }
            //putRecord(DB_STORE_NAME, FS.virtual[entry.filename], )
            break;
          case '5':
            if (memfs)
              memfs.addDirectory(entry.filename);
            if (entry.filename.endsWith('/'))
              entry.filename = entry.filename.substring(0, entry.filename.length - 1)
            FS.virtual[entry.filename] = {
              timestamp: new Date(),
              mode: FS_DIR,
              path: entry.filename,
              parent: entry.filename.substring(0, entry.filename.lastIndexOf('/'))
            }
            break;
        }
      }
    }
  }

  class API {
    constructor(options) {
      this.options = options;
      this.moduleCache = {};
      this.readBuffer = options.readBuffer;
      this.compileStreaming = options.compileStreaming;
      Module.hostWrite = this.hostWrite = options.hostWrite;
      this.clangFilename = options.clang || 'clang.wasm';
      this.lldFilename = options.lld || 'lld.wasm';
      this.sysrootFilename = options.sysroot || 'sysroot.tar';
      this.showTiming = options.showTiming || false;

      this.initMemFS()
      /*
      this.ready = new Promise((resolve) => {
        this.untar(null, this.sysrootFilename);
        resolve();
      });
      */
    }


    initMemFS() {

      this.memfs = new MemFS({
        compileStreaming: this.compileStreaming,
        hostWrite: this.hostWrite,
        memfsFilename: this.options.memfs || 'memfs.wasm',
      });
      this.ready = this.memfs.ready.then(
        () => { return this.untar(this.memfs, this.sysrootFilename); });

    }


    hostLog(message) {
      const yellowArrow = '\x1b[1;93m>\x1b[0m ';
      this.hostWrite(`${yellowArrow}${message}`);
    }

    async hostLogAsync(message, promise) {
      const start = +new Date();
      this.hostLog(`${message}...`);
      const result = await promise;
      const end = +new Date();
      this.hostWrite(' done.\n\r');
      if (this.showTiming) {
        const green = '\x1b[92m';
        const normal = '\x1b[0m';
        this.hostWrite(` ${green}(${msToSec(start, end)}s)${normal}\n`);
      }
      this.hostWrite('\n');
      return result;
    }


    commonPaths(name) {
      return [
        name,
        'build/release-wasm-js/' + name,
        'build/debug-wasm-js/' + name,
        name + '.js.wasm',
        'build/release-wasm-js/' + name + '.js.wasm',
        'build/debug-wasm-js/' + name + '.js.wasm',
      ]
    }

    async getModule(name, database = null, alreadyTried = false) {

      if (typeof name !== 'string') throw new Error('Module name must be a string: ' + typeof (name) + ' given. ' + new String(name))
      if (this.moduleCache[name]) return this.moduleCache[name];

      try {
        const module = await this.hostLogAsync(`Fetching and compiling ${name}`,
          this.compileStreaming(name));
        if (!module) throw new Error('No module! ' + name)
        module.name = name
        this.moduleCache[name] = module;
        return module;
      }
      catch (up) {
        this.hostWrite('\n\r' + name + ' not found at: ' + this.commonPaths(name).join('\n\r')
          + '\n\r' + window.location + '/' + name + '\n\r')
        console.error(up)
        if (up.message.includes('Response code: 404')
          && (this.toolsRepo || this.database)
          && !alreadyTried
        ) {


          // TODO: try compiling ourselves if its a known module + result
          if (name.includes('q3lcc.js.wasm'))
            await buildLCC(this.toolsRepo || this.database)
          if (name.includes('q3rcc.js.wasm'))
            await buildRCC(this.toolsRepo || this.database)
          if (name.includes('lburg.js.wasm'))
            await buildLBurg(this.toolsRepo || this.database)
          if (name.includes('q3cpp.js.wasm'))
            await buildCPP(this.toolsRepo || this.database)
          if (name.includes('q3asm.js.wasm'))
            await buildAsmTool(this.toolsRepo || this.database)
          if (name.includes('quake3e.js.wasm'))
            await buildClient(this.toolsRepo || this.database)
          if (name.includes('quake3e.ded.js.wasm'))
            await buildDedicated(this.toolsRepo || this.database)
          if (name.includes('stringify.js.wasm'))
            await buildStringify(this.toolsRepo || this.database)


          return await this.getModule(name, database, true)
        }
        throw up
      }
    }


    async untar(memfs, filename) {
      if (this.memfs)
        await this.memfs.ready;
      const promise = (async () => {
        const tar = new Tar(await this.readBuffer(filename));
        await tar.untar(this.memfs);
      })();
      await this.hostLogAsync(`Untaring ${filename}`, promise);
    }

    async loadEntry(cursor) {
      if (!cursor) {
        return resolve()
      }
      FS.virtual[cursor.path] = cursor
    }


    mkdirp(path) {
      if (this.memfs)
        this.memfs.mkdirp(path)
      // Ensure we have a clean array of directory segments
      // Filter(Boolean) removes empty strings from leading/double slashes
      const parts = path.split('/').filter(Boolean);
      let currentPath = path.startsWith('/') ? '/' : '';
      let previousPath = ''
      for (const part of parts) {
        // If we're at the root, don't double up the slash
        previousPath = currentPath
        currentPath = currentPath === '' ? `${part}` : `${currentPath}/${part}`;

        try {
          FS.virtual[currentPath] = {
            timestamp: new Date(),
            mode: FS_DIR,
            path: currentPath,
            parent: currentPath.substring(0, currentPath.lastIndexOf('/'))
          }
          FS.virtual[currentPath + '/.'] = FS.virtual[currentPath]
          if (previousPath)
            FS.virtual[currentPath + '/..'] = FS.virtual[previousPath]
        } catch (e) {
          // Log only if it's a real crash, not just an "already exists" error
          if (!e.message.includes("exists")) {
            console.warn(`mkdirp segment failed: ${currentPath}`, e);
          }
        }
      }
    }


    extract(options, database) {
      if (options.configuration)
        this.configuration = options.configuration
      if (options.github_token)
        this.github_token = options.github_token
      if (options.database)
        this.database = options.database || database
    }


    async header(filePath) {
      await this.ready;

      if (!this.database)
        return

      let record = await getRecord(DB_STORE_NAME, filePath, this.database)
      if (!record) return
      FS.virtual[record.path] = record

      const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (fileDir.trim().length > 0)
        this.mkdirp(fileDir)

      if (this.memfs)
        this.memfs.addFile(record.path, record.contents);

      return true
    }

    async upload(database = null) {
      await this.ready;
      this.database = database || this.database
      if (!this.database) return

      // TODO: this needs to be optimized
      //await readAll(this.database, this.loadEntry.bind(this))
    }



    async compile(options) {
      await this.ready
      this.extract(options)
      const input = options.input;
      const contents = options.contents;
      const obj = options.obj;
      const opt = options.opt || '2';
      if (input) {
        const inDir = input.substring(0, input.lastIndexOf('/'));
        if (inDir.trim().length > 0)
          this.mkdirp(inDir)

        if (this.memfs && input && contents)
          this.memfs.addFile(input, Uint8Array.from(contents, c => c.charCodeAt(0)));

        FS.virtual[input] = {
          timestamp: new Date(),
          mode: FS_FILE,
          contents: Uint8Array.from(contents, c => c.charCodeAt(0)),
          path: input,
          parent: input.substring(0, input.lastIndexOf('/'))
        }
      }
      if (obj) {
        const dirPath = obj.substring(0, obj.lastIndexOf('/'));
        if (dirPath.trim().length > 0)
          this.mkdirp(dirPath)
      }

      await this.ready;

      if (!FS.virtual['/tmp'])
        this.mkdirp('tmp')


      if (options.CFLAGS && this.database) {

        for (var filePath of options.CFLAGS) {
          if (!filePath) continue
          //if (FS.virtual[filePath]) continue
          try {
            if (filePath.startsWith('--allow-undefined-file=')) {
              filePath = syms[0].substring('--allow-undefined-file='.length)
            }
            var record = await getRecord(DB_STORE_NAME, filePath, this.database)
            if (!record) continue
            FS.virtual[record.path] = record

            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (fileDir.trim().length > 0)
              this.mkdirp(fileDir)


          } catch (e) {
            console.log(e)
          }
        }
      }

      const clang = await this.getModule(this.clangFilename);
      var result = await this.run(clang, 'clang', ...options.CFLAGS || []);
      if (this.memfs && this.memfs.exists(obj)) {
        var bytes = this.memfs.getFileContents(obj)
        FS.virtual[obj] = {
          timestamp: new Date(),
          mode: FS_FILE,
          contents: bytes,
          path: obj,
          parent: obj.substring(0, obj.lastIndexOf('/'))
        }

        if (this.database)
          await putRecord(DB_STORE_NAME, FS.virtual[obj], this.database)

        this.hostWrite('\n\rSucceeded: ' + obj + '\n\r')
      }

      if (this.database && FS.virtual[obj])
        await putRecord(DB_STORE_NAME, FS.virtual[obj], this.database)
      return result
    }

    async compileToAssembly(options) {
      const input = options.input;
      const output = options.output;
      const contents = options.contents;
      const obj = options.obj;
      const triple = options.triple || 'x86_64';
      const opt = options.opt || '2';

      await this.ready;
      if (input && contents) {

        if (this.memfs)
          this.memfs.addFile(input, contents);

        FS.virtual[input] = {
          timestamp: new Date(),
          mode: FS_FILE,
          contents: Uint8Array.from(contents, c => c.charCodeAt(0)),
          path: input,
          sha: await getGitShaBrowser(contents),
          parent: input.substring(0, input.lastIndexOf('/'))
        }

      }

      const clang = await this.getModule(this.clangFilename);
      await this.run(clang, 'clang', '-cc1', '-S',
        `-triple=${triple}`, '-mllvm',
        '--x86-asm-syntax=intel', `-O${opt}`,
        '-o', output, '-x', 'c++', input);
      return FS.virtual[output];
    }

    async compileTo6502(options) {
      const input = options.input;
      const output = options.output;
      const contents = options.contents;
      const flags = options.flags;

      await this.ready;

      FS.virtual[input] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: Uint8Array.from(contents, c => c.charCodeAt(0)),
        path: input,
        parent: input.substring(0, input.lastIndexOf('/'))
      }


      const vasm = await this.getModule('vasm6502_oldstyle');
      await this.run(vasm, 'vasm6502_oldstyle', ...flags, '-o', output, input);
      return FS.virtual[output];
    }

    async link(options) {

      await this.ready;
      this.extract(options)

      const stackSize = 1024 * 1024;
      const obj = options.obj;
      const wasm = options.wasm;


      if (wasm) {
        const dirPath = wasm.substring(0, wasm.lastIndexOf('/'));
        if (dirPath.trim().length > 0)
          this.mkdirp(dirPath)
      }



      const lld = await this.getModule(this.lldFilename);

      if (this.database) {

        for (var filePath of obj instanceof Array ? obj : [obj]) {
          if (!filePath) continue
          try {
            var record = await getRecord(DB_STORE_NAME, filePath, this.database)
            if (!record) continue
            FS.virtual[record.path] = record

            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (fileDir.trim().length > 0)
              this.mkdirp(fileDir)

            if (this.memfs)
              this.memfs.addFile(record.path, record.contents);

            this.hostWrite('\n\rLoading: ' + record.path + '\n\r')
          } catch (e) {
            console.log(e)
          }
        }
      }

      if (options.LDFLAGS && this.database) {
        for (var filePath of options.LDFLAGS) {
          if (!filePath) continue
          //if (FS.virtual[filePath]) continue
          try {
            if (filePath.startsWith('--allow-undefined-file=')) {
              filePath = filePath.substring('--allow-undefined-file='.length)
            }
            var record = await getRecord(DB_STORE_NAME, filePath, this.database)
            if (!record) continue
            FS.virtual[record.path] = record

            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (fileDir.trim().length > 0)
              this.mkdirp(fileDir)

            if (this.memfs) {
              this.memfs.addFile(record.path, record.contents);
            }

            this.hostWrite('\n\rLoading: ' + record.path + '\n\r')
          } catch (e) {
            console.log(e)
          }
        }
      }



      //const libdir = 'lib/wasm32-wasi';
      //const crt1 = `${libdir}/crt1.o`;


      await this.run(
        lld, 'wasm-ld', ...options.LDFLAGS || [])

      if (wasm && this.memfs && this.memfs.exists(wasm)) {
        var bytes = this.memfs.getFileContents(wasm)
        FS.virtual[wasm] = {
          timestamp: new Date(),
          mode: FS_FILE,
          contents: bytes,
          path: wasm,
          parent: wasm.substring(0, wasm.lastIndexOf('/'))
        }

        if (this.database)
          await putRecord(DB_STORE_NAME, FS.virtual[wasm], this.database)

        this.hostWrite('\n\rSucceeded: ' + wasm + '\n\r')
      }

      if (this.database && FS.virtual[wasm])
        await putRecord(DB_STORE_NAME, FS.virtual[wasm], this.database)

      return FS.virtual[wasm];
    }


    async build(selected, mode = 'all') {


      if (mode === 'stringify' || mode === 'engine'
        || mode === 'release' || mode === 'debug' || mode === 'all')
        await buildStringify(selected)
      if (mode === 'shaders' || mode === 'engine'
        || mode === 'release' || mode === 'debug' || mode === 'all')
        await buildShaders(selected)
      if (mode === 'client' || mode === 'engine'
        || mode === 'release' || mode === 'debug' || mode === 'all')
        await buildClient(selected)


      if (!selected)
        selected = this.database;
      if (mode === 'lburg' || mode === 'tools' || mode === 'all')
        await buildLBurg(selected)
      if (mode === 'q3rcc' || mode === 'tools' || mode === 'all')
        await buildRCC(selected)
      if (mode === 'q3cpp' || mode === 'tools' || mode === 'all')
        await buildCPP(selected)
      if (mode === 'q3lcc' || mode === 'tools' || mode === 'all')
        await buildLCC(selected)
      if (mode == 'asm' || mode === 'tools' || mode === 'all')
        await buildAsmTool(selected)

      if (mode == 'game' || mode === 'qvms' || mode === 'all')
        await buildGame(selected)
      if (mode == 'cgame' || mode === 'qvms' || mode === 'all')
        await buildCGame(selected)
      if (mode == 'ui' || mode === 'qvms' || mode === 'all')
        await buildUI(selected)


    }

    async run(module, ...args) {
      await this.ready

      if (typeof module === 'string') {
        let name = module

        for (let filePath of this.commonPaths(module)) {
          if (!filePath) continue
          let contents
          try {
            if (this.database) {
              let record = await getRecord(DB_STORE_NAME, filePath, this.database)
              if (record) {
                contents = record.contents
              }
            }
          } catch (e) {
            console.log(e)
          }

          try {
            if (!contents && this.toolsRepo) {
              let record = await getRecord(DB_STORE_NAME, filePath, this.toolsRepo)
              if (record) {
                contents = record.contents
              }
            }
          } catch (e) {
            console.log(e)
          }

          if (this.memfs && this.memfs.exists(filePath)) {
            contents = this.memfs.getFileContents(filePath)
            if (!FS.virtual[filePath] || !FS.virtual[filePath].contents || FS.virtual[filePath].contents.length == 0) {
              console.error('Assetion virtual fs not empty for wasm: ' + name)
              debugger
            }
          }
          else if (FS.virtual[filePath]) {
            contents = FS.virtual[filePath].contents
          }

          if (contents) {
            module = await this.hostLogAsync(`Fetching and compiling from local: ${name}`,
              this.compileStreaming(contents));
            module.name = name
            this.moduleCache[name] = this.moduleCache[filePath] = module;
            break
          }

        }

        if (typeof module == 'string' || !module)
          module = await this.getModule(module);

      }


      if (typeof module == 'string' || !module)
        throw new Error('Cannot load module: ' + name)


      if (args) {
        for (var filePath of args) {
          if (!filePath) continue
          //if (FS.virtual[filePath]) continue
          try {

            var record = await getRecord(DB_STORE_NAME, filePath, this.database)
            if (!record) continue
            FS.virtual[record.path] = record

            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (fileDir.trim().length > 0)
              this.mkdirp(fileDir)

            if (this.memfs)
              this.memfs.addFile(record.path, record.contents);

            this.hostWrite('\n\rLoading: ' + record.path + '\n\r')
          } catch (e) {
            console.log(e)
          }
        }
      }


      if (!args)
        args = []

      if (args.length == 0)
        args[0] = module.name

      this.hostLog(`${args.join(' ')}\n`);

      const start = +new Date();
      const app = new App(this, this.hostWrite, module, this.sysrootFilename, ...args || []);
      const instantiate = +new Date();
      const stillRunning = await app.run();
      const end = +new Date();
      this.hostWrite('\n');
      if (this.showTiming) {
        const green = '\x1b[92m';
        const normal = '\x1b[0m';
        let msg = `${green}(${msToSec(start, instantiate)}s`;
        msg += `/${msToSec(instantiate, end)}s)${normal}\n`;
        this.hostWrite(msg);
      }

      return stillRunning ? app : null;
    }

    async compileLinkRun(options) {
      const input = `test.cc`;
      const obj = `test.o`;
      const wasm = `test.wasm`;
      await this.compile({ input, contents: options.contents, obj });
      await this.link({ obj, wasm });

      const testMod = await this.hostLogAsync(`Compiling ${wasm}`,
        WebAssembly.compile(FS.virtual[wasm].contents));
      return await this.run(testMod, wasm);
    }
  }


  const ST_FILE = 8
  const ST_DIR = 4
  const FS_DEFAULT = (6 << 3) + (6 << 6) + (6)
  const FS_FILE = (ST_FILE << 12) + FS_DEFAULT
  const FS_DIR = (ST_DIR << 12) + FS_DEFAULT

  return API;

})();
