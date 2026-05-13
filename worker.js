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
self.importScripts('github.js');
self.importScripts('make.js');
self.importScripts('make-tools.js');
self.importScripts('make-qvm.js');


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
      if (!response.ok) throw new Error('Response code: ' + response.status)
      return WebAssembly.compile(await response.arrayBuffer());
    }
  },

  hostWrite(s) {
    port.postMessage({ id: 'write', data: s });
  }
};

let currentApp = null;

const onAnyMessage = async event => {
  if (event.data.data && event.data.data.github_token)
    api.github_token = event.data.data.github_token
  if (event.data.data && event.data.data.width)
    api.width = event.data.data.width
  if (event.data.data && event.data.data.database)
    api.database = event.data.data.database
  if (event.data.data && event.data.data.toolsRepo)
    api.toolsRepo = event.data.data.toolsRepo
  if (event.data.data && event.data.data.engineRepo)
    api.engineRepo = event.data.data.engineRepo
  if (event.data.data && event.data.data.gameRepo)
    api.gameRepo = event.data.data.gameRepo
  if (event.data.data && event.data.data.assetRepo)
    api.assetRepo = event.data.data.assetRepo
  if (event.data.data && event.data.data.toolsRepo2)
    api.toolsRepo2 = event.data.data.toolsRepo2
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

      try {
        output = await api.compileToAssembly(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`);
        output = e
        throw e;
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'compileTo6502': {
      const responseId = event.data.responseId;
      let output = null;

      try {
        output = await api.compileTo6502(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'header': {
      const responseId = event.data.responseId;
      let output = null;
      api.extract(event.data.data)

      try {
        output = await api.header(event.data.data.header);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'upload': {
      const responseId = event.data.responseId;
      let output = null;

      try {
        output = await api.upload(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }


    case 'build': {
      const responseId = event.data.responseId;
      let output = null;
      let selected = api.database = event.data.data.database || api.database;
      let mode = event.data.data.action;
      if (event.data.data.configuration)
        api.configuration = event.data.data.configuration

      try {
        api.build(selected, mode)
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }




    case 'download': {
      const responseId = event.data.responseId;
      let output = null;

      try {
        output = await api.download(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'link': {
      const responseId = event.data.responseId;
      let output = null;

      try {
        output = await api.link(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'compile': {
      const responseId = event.data.responseId;
      let output = null;

      try {
        output = await api.compile(event.data.data);
      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: output });
      }
      break;
    }

    case 'run': {
      const responseId = event.data.responseId;
      let output = null;
      let filePath
      try {
        if (event.data.data.database)
          api.database = event.data.data.database
        if (event.data.data.toolsRepo)
          api.toolsRepo = event.data.data.toolsRepo
        if (event.data.data.configuration)
          api.configuration = event.data.data.configuration

        await api.ready

        let module = await api.getModule(event.data.data.tool)
        let app = new API.App(api, api.hostWrite, module, api.sysrootFilename, ...event.data.data.args || [])


        let paths = event.data.data.paths
        if (paths && api.database) {
          for (filePath of paths) {
            if (!filePath) continue
            if (FS.virtual[filePath]) continue
            try {
              if (filePath.startsWith('--allow-undefined-file=')) {
                filePath = filePath.substring('--allow-undefined-file='.length)
              }

              const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
              if (fileDir.trim().length > 0)
                api.mkdirp(fileDir)


              var record = await getRecord(DB_STORE_NAME, filePath, api.database)
              if (!record) continue
              FS.virtual[record.path] = record

              if (api.memfs)
                api.memfs.addFile(record.path, record.contents);

              api.hostWrite('Loading: ' + record.path + '\n\r')
            } catch (e) {
              console.log(e)
            }
          }
        }

        await api.run(
          app || event.data.data.tool,
          ...event.data.data.args || []
        );


        if (paths && api.database && api.memfs) {
          for (filePath of paths) {
            if (!filePath) continue
            try {


              if (api.memfs.exists(filePath)) {
                try {
                  var bytes = api.memfs.getFileContents(filePath)
                  if (bytes.length > 0) {
                    FS.virtual[filePath] = {
                      timestamp: new Date(),
                      mode: FS_FILE,
                      contents: bytes,
                      path: filePath,
                      sha: await getGitShaBrowser(bytes),
                      parent: filePath.substring(0, filePath.lastIndexOf('/'))
                    }

                    if (api.database)
                      await putRecord(DB_STORE_NAME, FS.virtual[filePath], api.database)
                  }
                  else if(FS.virtual[filePath].contents.length) {
                    api.memfs.addFile(filePath, FS.virtual[filePath].contents)
                  }
                } catch (e) {

                }

                api.hostWrite('Succeeded: ' + filePath + '\n\r')
              }

            } catch (e) {
              console.log(e)
            }
          }
        }

      }
      catch (e) {
        const redArrow = '\x1b[1;33m>\x1b[0m ';
        api.hostWrite(`${redArrow}${e.toString()}\n\r${e.stack || e.stacktrace}\n\r`)
        output = e
        throw e
      }
      finally {
        port.postMessage({ id: 'runAsync', responseId, data: FS.virtual[filePath] });
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
