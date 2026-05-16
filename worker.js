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
    try {
      if (filename instanceof Uint8Array || filename instanceof ArrayBuffer) {
        return await WebAssembly.compile(filename);
      }

      const targetUrl = filename.startsWith('/') ? filename : ('/' + filename);
      const response = await fetch(targetUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) throw new Error('Response code: ' + response.status);

      // Verify the MIME type matches the spec requirement for streaming
      const contentType = response.headers.get('Content-Type');
      if (WebAssembly.compileStreaming && contentType === 'application/wasm') {
        return await WebAssembly.compileStreaming(response);
      } else {
        // Safe fallback if server sent wrong headers or if the connection was flaky
        const result = await response.arrayBuffer();
        return await WebAssembly.compile(result);
      }
    }
    catch (e) {
      debugger;
      throw e;
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
        output = await api.header(event.data.data.header, true);
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
            api.header(filePath)
          }
        }

        if (event.data.data.args) {
          for (filePath of event.data.data.args) {
            if (!filePath) continue
            await this.header(filePath)
          }
        }

        await api.run(
          app || event.data.data.tool,
          ...event.data.data.args || []
        );


        if (paths && api.database) {
          for (filePath of paths) {
            if (!filePath) continue
            try {


              /*
              try {
                if (api.memfs && api.memfs.exists(filePath)) {
                  let bytes = api.memfs.getFileContents(filePath)
                  if (bytes.length > 0) {
                    FS.virtual[filePath] = {
                      timestamp: new Date(),
                      mode: FS_FILE,
                      contents: bytes,
                      path: filePath,
                      sha: await getGitShaBrowser(bytes),
                      parent: filePath.substring(0, filePath.lastIndexOf('/'))
                    }

                  }
                }
                else if (api.memfs && FS.virtual[filePath].contents.length) {
                  api.memfs.addFile(filePath, FS.virtual[filePath].contents)
                }
              } catch (e) {

              }
              */

              if (FS.virtual[filePath] && FS.virtual[filePath].contents.length) {
                api.hostWrite('Succeeded: ' + filePath + '\n\r')

                if (api.database)
                  await putRecord(DB_STORE_NAME, FS.virtual[filePath], api.database)
              }
            } catch (e) {
              log(`${e.message}\n\r${e.stack || e.stacktrace}`)
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
        port.postMessage({ id: 'runAsync', responseId, data: output });
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
    // 
    case 'remove':
      api.extract(event.data.data)
      const databases = [this.database, this.engineRepo, this.assetRepo, this.gameRepo, this.toolsRepo, this.toolsRepo2]
      const filename = event.data.data.filename
      for (let db of databases) {
        try {
          if (!db) continue
          await deleteRecord(DB_STORE_NAME, filename, db)
        } catch (e) {
          console.error(r)
        }
      }
      delete FS.virtual[filename]
      try {
        //if(api.memfs)
        //api.memfs.
      } catch (e) {
        console.error(e)
      }
      break;
  }
};

self.onmessage = onAnyMessage;
