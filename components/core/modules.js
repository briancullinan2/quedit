

const DependencyLoader = {
    registry: new Map(
        [...document.scripts]
            .map(s => s.getAttribute('src'))
            .filter(Boolean)
            .concat([...document.styleSheets].map(s => s.href).filter(Boolean))
            .map(url => {
                const absoluteUrl = new URL(url, window.location.origin).pathname;
                // Pre-seed the Map with an instantly resolved promise for elements already loaded
                return [absoluteUrl, Promise.resolve()];
            })
    ),
    // Ensure your class constructor initializes a Map instead of a Set:
    // this.registry = new Map();

    async loadScript(src) {
        const absoluteUrl = new URL(src, window.location.origin).pathname;

        // ─── THE CONCURRENCY LOCK CHECK ───
        // If it's already loaded OR currently downloading, return the existing tracking handle
        if (this.registry.has(absoluteUrl)) {
            return this.registry.get(absoluteUrl);
        }

        // Create the promise and cache it immediately to block secondary asset creation runs
        const scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = false; // Preserves literal script tree order

            script.onload = () => resolve();
            script.onerror = () => {
                this.registry.delete(absoluteUrl); // Evict on failure so a retry can clear the pipe
                reject(new Error(`Failed execution pipeline: ${src}`));
            };

            document.head.appendChild(script);
        });

        this.registry.set(absoluteUrl, scriptPromise);
        return scriptPromise;
    },

    async loadStyle(href) {
        const absoluteUrl = new URL(href, window.location.origin).pathname;
        const existingTheme = document.querySelector('link[href*="/main.css"]', document.head)

        // ─── THE CONCURRENCY LOCK CHECK ───
        if (this.registry.has(absoluteUrl)) {
            return this.registry.get(absoluteUrl);
        }

        const stylePromise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;

            link.onload = () => resolve();
            link.onerror = () => {
                this.registry.delete(absoluteUrl); // Evict on failure
                reject(new Error(`Failed stylesheet mounting: ${href}`));
            };


            if (existingTheme)
                document.head.insertBefore(link, existingTheme)
            else
                document.head.appendChild(link);
        });

        this.registry.set(absoluteUrl, stylePromise);
        return stylePromise;
    },

    async loadModule(key) {
        const module = IMPORT_MODULES[key];
        if (!module || module.loaded) return;

        // Injects stylesheet links concurrently
        if (module.css) {
            await Promise.all(module.css.map(href => this.loadStyle(href)));
        }

        // Evaluates script tags sequentially 
        if (module.js) {
            for (const src of module.js) {
                await this.loadScript(src);
            }
        }

        // Executes functional initialization callbacks safely if provided
        if (typeof module.onLoad === 'function') {
            module.onLoad();
            module.loaded = true
        }

        console.log(`📦 Module [${key}] mapped & active.`);
    }
};


async function switchToQuakeEngine() {
    // Displays loader UI element if necessary
    await DependencyLoader.loadModule('quake3e');
    // Safe to call functions inside sys_wasm.js or start toji's WebGL map loops now
}

// Example: Triggering Build Execution System
async function compileProject() {
    await DependencyLoader.loadModule('build');
    // Safe to invoke internal logic from make.js / make-qvm.js
}



async function storeSettingsForWorker() {
    const database = SettingsManager.get('core', 'environmentRepository')
    const parts = database.split('/');
    const ownerName = parts[0];
    const repoName = parts[1];
    try {
        const branch = await getDefaultBranch(ownerName, repoName);
        const latestFileTime = await getBranchVersion(ownerName, repoName, branch);
        SettingsManager.applyValue(IMPORT_SETTINGS.core.environmentVersion, latestFileTime)
    } catch (e) {
        console.error(e)
    }
    const filePath = '/base/settings.json'
    const content = JSON.stringify(SettingsManager.exportPayload(), null, 4)
    const newSha = await getGitShaBrowser(content)
    FS.virtual[filePath] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new TextEncoder().encode(content),
        path: filePath,
        sha: newSha,
        parent: ''
    }
    const databases = await getDatabaseMetadata();
    const shouldInstall = (await needsInstall(database, DB_SCHEME)).item3
    if (databases.filter(d => d.key == database).length == 0 || shouldInstall) {
        await deleteOldDatabase(database)
        await setupDatabase(database, DB_SCHEME);
    }
    await putRecord(DB_STORE_NAME, FS.virtual[filePath], database)
}



async function manageServiceWorker() {

    if (!('serviceWorker' in navigator)) return;

    // 1. Get the Server's Truth first (our Token/Version)
    let serverUpdate = null;
    try {
        serverUpdate = await getBranchVersion('briancullinan2', 'quedit', 'main')
    } catch (e) {
        console.warn("Could not reach server for version check. Proceeding with caution.");
    }

    await storeSettingsForWorker()

    const registration = await navigator.serviceWorker.getRegistration();

    if (registration && registration.active) {
        let swVersion = null;
        let isCheckDone = false;
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
            if (event.data?.type === 'VERSION_REPORT') {
                isCheckDone = true;
                try {
                    if (event.data.version)
                        swVersion = JSON.parse(new TextDecoder('utf-8').decode(event.data.version))[1];
                }
                catch (e) { }
            }
        };

        // Ping the worker
        registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);

        // 2. The "Dumb" Poll: Wait for response or 10s timeout
        const startTime = Date.now();
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                if (isCheckDone || elapsed > 10000) {
                    clearInterval(checkInterval);
                    if (elapsed > 10000) console.warn("SW version check timed out.");
                    resolve();
                }
            }, 100); // Check every 100ms
        });

        // 3. Compare and Nuke if mismatched
        // We only unregister if we successfully got both versions and they differ
        if (serverUpdate && swVersion && serverUpdate !== swVersion) {
            console.warn(`Version Mismatch! Server: ${serverUpdate}, SW: ${swVersion}. Unregistering...`);

            let isDeregistered = false;

            const messageChannel2 = new MessageChannel();
            messageChannel2.port1.onmessage = (event) => {
                if (event.data?.type === 'DEREGISTERED') {

                    isDeregistered = true;
                }
            };

            // Ping the worker
            const registration2 = await navigator.serviceWorker.getRegistration();
            registration2.active.postMessage({ type: 'DEREGISTER' }, [messageChannel2.port2]);


            // 2. The "Dumb" Poll: Wait for response or 10s timeout
            const startTime = Date.now();
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    if (isDeregistered || elapsed > 10000) {
                        clearInterval(checkInterval);
                        if (elapsed > 10000) console.warn("SW deregister timed out.");
                        resolve();
                    }
                }, 100); // Check every 100ms
            });
        }
    }

    if (!serverUpdate
        || (registration && registration.active)) {
        return; // don't register unless we have a valid version from server
    }


    const swUrl = '/service-worker.js?t=' + Date.now();
    navigator.serviceWorker.register(swUrl)
        .then(reg => {
            console.info('Service Worker registered successfully:', reg.scope);
        })
        .catch(err => {
            console.error('Service Worker registration failed:', err);
        });
}


