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

self.importScripts('shared.js');
self.importScripts('local.js');
self.importScripts('sys_fs.js');
self.importScripts('sys_std.js');
self.importScripts('sys_web.js');

const Module = {

}
const ENV = {
    wasi_unstable: {}
}
ENV.ENV = ENV
const window = self
window.Module = Module
window.STD = STD

let api;
let port;
let canvas;
let ctx2d;

const apiOptions = {
  async readBuffer(filename) {
    const response = await fetch(filename);
    return response.arrayBuffer();
  },

  async compileStreaming(filename) {
    // TODO: make compileStreaming work. It needs the server to use the
    // application/wasm mimetype.
    if (filename instanceof Uint8Array || filename instanceof ArrayBuffer) {
      return await WebAssembly.compile(filename);
    }

    if (false && WebAssembly.compileStreaming) {
      return WebAssembly.compileStreaming(fetch(filename));
    } else {
      const response = await fetch(filename);
      return WebAssembly.compile(await response.arrayBuffer());
    }
  },

  hostWrite(s) {
    port.postMessage({ id: 'write', data: s });
  }
};

let currentApp = null;

const onAnyMessage = async event => {
  switch (event.data.id) {
    case 'constructor':
      port = event.data.data;
      port.onmessage = onAnyMessage;
      api = new API(apiOptions);
      break;

    case 'setShowTiming':
      api.showTiming = event.data.data;
      break;

    case 'compileToAssembly': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.compileToAssembly(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`);
        throw e;
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'compileTo6502': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.compileTo6502(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'header': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.header(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'upload': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.upload(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'download': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.download(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'link': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.link(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'compile': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        output = await api.compile(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'run': {
      const responseId = event.data.responseId;
      let output = null;
      let transferList;
      try {
        if (event.data.data.database)
          api.database = event.data.data.database


        let paths = event.data.data.paths
        if (paths && api.database) {
          for (var filePath of paths) {
            if (!filePath) continue
            if (api.memfs.exists(filePath)) continue
            try {
              if (filePath.startsWith('--allow-undefined-file=')) {
                filePath = filePath.substring('--allow-undefined-file='.length)
              }

              const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
              if (fileDir.trim().length > 0)
                api.memfs.mkdirp(fileDir)


              var record = await getRecord(DB_STORE_NAME, filePath, api.database)
              if (!record) continue

              api.memfs.hostWrite('\n\rLoading: ' + record.path + '\n\r')
              api.memfs.addFile(record.path, record.contents);
            } catch (e) {
              console.log(e)
            }
          }
        }



        output = await api.run(
          event.data.data.tool,
          ...event.data.data.args || []
        );

      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}`)
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output },
          transferList);
      }
      break;
    }

    case 'compileLinkRun':
      if (currentApp) {
        console.log('First, disallowing rAF from previous app.');
        // Stop running rAF on the previous app, if any.
        currentApp.allowRequestAnimationFrame = false;
      }
      currentApp = await api.compileLinkRun(event.data.data);
      console.log(`finished compileLinkRun. currentApp = ${currentApp}.`);
      break;

    case 'postCanvas':
      canvas = event.data.data;
      ctx2d = canvas.getContext('2d');
      break;
  }
};

self.onmessage = onAnyMessage;
