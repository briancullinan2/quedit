class LanguageAPI {
    constructor(options) {
        this.nextResponseId = 0;
        this.responseCBs = new Map();

        // Target your dedicated ANTLR background worker thread
        this.worker = new Worker('components/rosetta/worker-language.js');

        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = this.onmessage.bind(this);

        this.hostWrite = options.hostWrite;
        this.configuration = options.configuration || 'release';

        const remotePort = channel.port2;
        this.worker.postMessage({ id: 'constructor', data: remotePort }, [remotePort]);
    }

    /**
     * Propagates environment constants over to the parsing pipeline worker context
     */
    inject(options) {
        options.configuration = options.configuration || this.configuration || 'release';
        options.database = options.database || window.engineRepository || this.database;
        options.github_token = options.github_token || window.githubToken || this.github_token;
    }

    setShowTiming(value) {
        this.port.postMessage({ id: 'setShowTiming', data: value });
    }

    terminate() {
        this.worker.terminate();
    }

    /**
     * Core Promisified Worker Loop Execution Gateway with 60-second timeouts
     */
    async runAsync(id, options) {
        const responseId = ++this.nextResponseId;

        window.runningCommand = true

        const responsePromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.responseCBs.has(responseId)) {
                    this.responseCBs.delete(responseId);
                    reject(new Error(`LanguageAPI runAsync timeout: No response for id ${id} (responseId: ${responseId}) after 60 seconds.`));
                }
            }, 60000);

            this.responseCBs.set(responseId, { resolve, reject, timeoutId });
        });

        this.port.postMessage({ id, responseId, data: options });
        return await responsePromise;
    }

    // =====================================================================
    // HIGH-FIDELITY PARSING ENDPOINT HOOKS
    // =====================================================================

    /**
     * Line-bounded fast text tokenizer endpoint (Cursor tracking / Light decorators)
     * @param {string} text - Complete source code string block
     * @param {string} language - Target language key match (e.g. "c", "javascript", "rust")
     * @param {number} line - Target row boundary line target (1-indexed matching ANTLR spec)
     */
    async getLineTokens(text, language, line) {
        const options = { text, language, line };
        this.inject(options);
        return this.runAsync('lineToken', options);
    }

    /**
     * Massive flat stream extraction engine (Ace syntax highlighting / Token map dumps)
     * @param {string} text - Complete source code string block
     * @param {string} language - Target language key match
     */
    async getAllTokens(text, language) {
        const options = { text, language };
        this.inject(options);
        return this.runAsync('tokens', options);
    }

    /**
     * Deep Abstract Syntax Tree Context Semantic Explorer
     * @param {string} text - Complete source code string block
     * @param {string} language - Target language key match
     */
    async getAnnotations(text, language) {
        const options = { text, language };
        this.inject(options);
        return this.runAsync('annotations', options);
    }

    /**
     * Event Router Callback
     */
    onmessage(event) {
        switch (event.data.id) {
            case 'write':
                if (this.hostWrite) {
                    this.hostWrite(event.data.data.text || event.data.data, event.data.data.source);
                }
                break;

            case 'done':
                window.detachedConsole = false;
                window.runningWorker = false;
            // Fall-through intended matching base pipeline patterns

            case 'runAsync': {
                const responseId = event.data.responseId;
                const promise = this.responseCBs.get(responseId);
                if (promise) {
                    // Clear structural safety timeout instantly
                    clearTimeout(promise.timeoutId);
                    this.responseCBs.delete(responseId);

                    if (event.data.data && event.data.data.error) {
                        promise.reject(new Error(event.data.data.error));
                    } else {
                        promise.resolve(event.data.data);
                    }
                }
                break;
            }
        }
    }
}



class WorkerAPI {
    constructor(options) {
        this.nextResponseId = 0;
        this.responseCBs = new Map();
        this.worker = new Worker('components/compiler/worker.js');
        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = this.onmessage.bind(this);
        this.configuration = options.configuration || 'release';
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
        let currentConfig = options.configuration || configuration.value || this.configuration || 'release'
        this.configuration = options.configuration = currentConfig === 'debug' ? 'debug' : 'release'
        this.database = options.database = options.database || engineRepository || this.database
        this.width = options.width = options.width = term.cols
        this.github_token = options.github_token = options.github_token = this.github_token
        this.toolsRepo = options.toolsRepo = options.toolsRepo || toolsRepository || this.toolsRepo
        this.toolsRepo2 = options.toolsRepo2 = options.toolsRepo2 || tools2Repository || this.toolsRepo2
        this.engineRepo = options.engineRepo = options.engineRepo || engineRepository || this.engineRepo
        this.gameRepo = options.gameRepo = options.gameRepo || gameRepository || this.gameRepo
        this.assetRepo = options.assetRepo = options.assetRepo || assetRepository || this.assetRepo
    }


    async runAsync(id, options) {
        const responseId = ++this.nextResponseId;

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
            database: database || owner.value + '/' + repository.value || this.database,
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

    remove(filename) {
        const options = {
            filename: filename
        }
        this.inject(options)
        this.port.postMessage({ id: 'remove', data: options });
    }

    onmessage(event) {
        switch (event.data.id) {
            case 'write':
                this.hostWrite(event.data.data.text || event.data.data, event.data.data.source)
                break;

            case 'done':
                window.detachedConsole = false
                window.runningWorker = false
            case 'runAsync': {
                const responseId = event.data.responseId;
                const promise = this.responseCBs.get(responseId);
                if (promise) {
                    this.responseCBs.delete(responseId);

                    if (event.data.data instanceof Error) {
                        if (event.data.data.message.includes('memory access out of bounds')) {
                            needsHeaders = true
                        }
                        promise.reject(event.data.data)
                    }
                    else
                        promise.resolve(event.data.data);
                }
                break;
            }
        }
    }
}

const language = new LanguageAPI({
    hostWrite: window.specialWrite
});

const api = new WorkerAPI({
    hostWrite: window.specialWrite
});
window.api = api;
window.api.github_token = window.githubToken

// TODO: offline mode
// ServiceWorker stuff
/*
if (navigator.serviceWorker) {
  navigator.serviceWorker.register('./service_worker.js')
  .then(reg => {
    writeLog('Registration succeeded. Scope is ' + reg.scope);
  }).catch(error => {
    writeLog('Registration failed with ' + error);
  });
}
*/

