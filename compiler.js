
const status = document.getElementById('statusbar')

class WorkerAPI {
    constructor() {
        this.nextResponseId = 0;
        this.responseCBs = new Map();
        this.worker = new Worker('worker.js');
        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = this.onmessage.bind(this);

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
            this.responseCBs.set(responseId, { resolve, reject });
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
        return this.runAsync('upload', options);
    }

    async download(options) {
        return this.runAsync('download', options);
    }

    async compile(options) {
        return this.runAsync('compile', options);
    }

    async link(options) {
        return this.runAsync('link', options);
    }

    compileLinkRun(contents, width = 80) {
        this.port.postMessage({ id: 'compileLinkRun', data: {contents, width} });
    }

    postCanvas(offscreenCanvas) {
        this.port.postMessage({ id: 'postCanvas', data: offscreenCanvas },
            [offscreenCanvas]);
    }

    onmessage(event) {
        switch (event.data.id) {
            case 'write':
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

const api = new WorkerAPI();
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

