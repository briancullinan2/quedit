function getCalleeInfo() {
    try {
        throw new Error();
    } catch (error) {
        const stackLines = error.stack.split('\n');

        // stackLines[2] is the function that called getCalleeInfo
        const callerLine = stackLines[2];

        if (callerLine) {
            // V8 stack format example: "    at processOrder (file:///path/to/app.js:25:3)"
            // This regex captures the function name and everything inside the last set of parentheses
            const match = callerLine.match(/at\s+([^\s(]+)\s+\((.+):[0-9]+:[0-9]+\)/)
                || callerLine.match(/at\s+(.+):[0-9]+:[0-9]+/); // Fallback for global context without a function name

            if (match) {
                // If it matched the standard function structure:
                // match[1] = function name, match[2] = file path/URL
                if (match[2]) {
                    return [match[1], match[2]];
                }
                // If it's global execution context (no function name, just file):
                return ['global', match[1]];
            }
        }

        return ['unknown', 'unknown'];
    }
}

// --- How to use it ---

function processOrder() {
    const [func, file] = getCalleeInfo();
    console.log(`Function: ${func}`);
    console.log(`File: ${file}`);
}


const DependencyLoader = {
    registry: new Set(
        [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean)
            .concat([...document.styleSheets].map(s => s.href).filter(Boolean))
    ),

    async loadScript(src) {
        const absoluteUrl = new URL(src, window.location.origin).pathname;
        if (this.registry.has(absoluteUrl)) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = false; // Preserves literal script tree order
            script.onload = () => {
                this.registry.add(absoluteUrl);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed execution pipeline: ${src}`));
            document.head.appendChild(script);
        });
    },

    async loadStyle(href) {
        const absoluteUrl = new URL(href, window.location.origin).pathname;
        if (this.registry.has(absoluteUrl)) return;

        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => {
                this.registry.add(absoluteUrl);
                resolve();
            };
            link.onerror = () => reject(new Error(`Failed stylesheet mounting: ${href}`));
            document.head.appendChild(link);
        });
    },

    async loadModule(key) {
        const module = IMPORT_MODULES[key];
        if (!module) return;

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
        }

        console.log(`📦 Module [${key}] mapped & active.`);
    }
};


async function switchToQuakeEngine() {
    // Displays loader UI element if necessary
    await DependencyLoader.loadModule('q3');
    // Safe to call functions inside sys_wasm.js or start toji's WebGL map loops now
}

// Example: Triggering Build Execution System
async function compileProject() {
    await DependencyLoader.loadModule('build');
    // Safe to invoke internal logic from make.js / make-qvm.js
}
