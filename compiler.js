
const status = document.getElementById('statusbar')

class WorkerAPI {
    constructor(options) {
        this.nextResponseId = 0;
        this.responseCBs = new Map();
        this.worker = new Worker('worker.js');
        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = this.onmessage.bind(this);
        this.configuration = configuration.value
        this.hostWrite = options.hostWrite

        const remotePort = channel.port2;
        this.worker.postMessage({ id: 'constructor', data: remotePort },
            [remotePort]);
    }

    setShowTiming(value) {
        this.port.postMessage({ id: 'setShowTiming', data: value });
    }

    terminate() {
        this.worker.terminate();
    }


    inject(options) {

        this.configuration = options.configuration = options.configuration || configuration.value || this.configuration || 'release'
        this.database = options.database || engineRepo || this.database
        this.width = options.width = term.cols
        this.github_token = options.github_token = this.github_token
        this.toolsRepo = options.toolsRepo || toolsRepo || this.toolsRepo
        this.toolsRepo2 = options.toolsRepo2 || toolsRepo2 || this.toolsRepo2
        this.engineRepo = options.engineRepo || engineRepo || this.engineRepo
        this.gameRepo = options.gameRepo || gameRepo || this.gameRepo
        this.assetRepo = options.assetRepo || assetRepo || this.assetRepo
    }


    async runAsync(id, options) {
        const responseId = this.nextResponseId++;

        const responsePromise = new Promise((resolve, reject) => {
            // Create the timeout
            const timeoutId = setTimeout(() => {
                if (this.responseCBs.has(responseId)) {
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

        this.port.postMessage({ id, responseId, data: options });
        return await responsePromise;
    }

    async compileToAssembly(options) {
        return this.runAsync('compileToAssembly', options);
    }

    async compileTo6502(options) {
        return this.runAsync('compileTo6502', options);
    }

    async upload(options) {
        this.inject(options)
        return this.runAsync('upload', options);
    }

    async download(options) {

        return this.runAsync('download', options);
    }

    async header(owner, repo, header, database) {
        let options = { owner, repo, header, database }
        this.inject(options)
        return this.runAsync('header', options);
    }

    async compile(options) {
        this.inject(options)
        return this.runAsync('compile', options);
    }

    async build(database, action = 'all') {
        let options = {
            database: database || owner.value + '/' + repo.value || this.database,
            action,
        }
        this.inject(options)
        return this.runAsync('build', options);
    }

    async run(options) {
        this.inject(options)
        return this.runAsync('run', options);
    }

    async link(options) {
        this.inject(options)
        return this.runAsync('link', options);
    }

    compileLinkRun(contents, width = 80) {
        this.port.postMessage({ id: 'compileLinkRun', data: { contents, width } });
    }

    postCanvas(offscreenCanvas) {
        this.port.postMessage({ id: 'postCanvas', data: offscreenCanvas },
            [offscreenCanvas]);
    }

    onmessage(event) {
        switch (event.data.id) {
            case 'write':
                this.hostWrite(event.data.data)
                break;

            case 'runAsync': {
                const responseId = event.data.responseId;
                const promise = this.responseCBs.get(responseId);
                if (promise) {
                    this.responseCBs.delete(responseId);
                    promise.resolve(event.data.data);
                }
                break;
            }
        }
    }
}

const API_PREAMBLE = '\x1b[38;5;214m[COMPILER]\x1b[0m '


const api = new WorkerAPI({
    hostWrite: (msg) => {
        if (!msg) return;

        if (msg.includes('memory access out of bounds')) {
            needsHeaders = true;
        }

        // 1. Move to the start of the line and clear it
        // \x1b[2K clears the entire line
        // \x1b[G (or \r) moves cursor to column 0
        term.write(api.PREAMBLE || API_PREAMBLE);

        // 2. Write the log message
        // Ensure it ends with a newline so the prompt stays below it
        term.write(msg + '\r\n');

        // 3. Redraw the user's current input line
        // We use cursorPosition to put the blinking block back where it was
        term.write('> ' + currentLine);
        
        // 4. If the cursor wasn't at the end, move it back to the correct spot
        if (cursorPosition < currentLine.length) {
            const moveBack = currentLine.length - cursorPosition;
            term.write(`\x1b[${moveBack}D`);
        }

        // Standard maintenance
        status.children[0].innerText = 'Status: ' + msg;
        triggerIncrementalSave();
    }
});

if (typeof localStorage !== 'undefined')
    api.github_token = localStorage.getItem('github_token')
window.api = api;

// TODO: offline mode
// ServiceWorker stuff
/*
if (navigator.serviceWorker) {
  navigator.serviceWorker.register('./service_worker.js')
  .then(reg => {
    console.log('Registration succeeded. Scope is ' + reg.scope);
  }).catch(error => {
    console.log('Registration failed with ' + error);
  });
}
*/

