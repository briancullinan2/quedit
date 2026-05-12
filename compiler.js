
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
        options.configuration = this.configuration = configuration.value
        options.github_token = this.github_token
        options.width = term.cols
        return this.runAsync('upload', options);
    }

    async download(options) {
        options.configuration = this.configuration = configuration.value
        options.github_token = this.github_token
        options.width = term.cols
        return this.runAsync('download', options);
    }

    async header(owner, repo, header, database) {
        let options = { owner, repo, header }
        this.configuration = options.configuration = options.configuration || configuration.value || this.configuration
        this.database = options.database = database
        this.width = options.width = term.cols
        options.github_token = this.github_token
        return this.runAsync('header', options);
    }

    async compile(options) {
        options.github_token = this.github_token
        this.configuration = options.configuration = options.configuration || configuration.value || this.configuration
        options.width = term.cols
        return this.runAsync('compile', options);
    }

    async build(database, action = 'all') {
        this.database = database || owner.value + '/' + repo.value || this.database
        return this.runAsync('build', {
            database: this.database,
            configuration: this.configuration,
            action,
            github_token: this.github_token,
            width: term.cols
        });
    }

    async run(options) {
        options.width = term.cols
        options.github_token = this.github_token
        this.configuration = options.configuration = options.configuration || configuration.value || this.configuration
        return this.runAsync('run', options);
    }

    async link(options) {
        options.width = term.cols
        options.github_token = this.github_token
        this.configuration = options.configuration = options.configuration || configuration.value || this.configuration
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
                if (event.data.data
                    && event.data.data.includes('memory access out of bounds')) {
                    needsHeaders = true
                }
                term.write(event.data.data);
                status.children[0].innerText = 'Status: ' + event.data.data
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

const api = new WorkerAPI({
    hostWrite: (msg) => term.write(msg)
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

