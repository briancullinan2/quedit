const IMPORT_SETTINGS = {
    core: {
        githubToken: {
            key: 'github_token',
            default: '',
            set: (val) => {
                modal.classList.add('hidden');
                if (!window.api) return
                window.api.github_token = val; // share with worker
            }
        },
        ownersList: {
            key: 'owners',
            default: ['briancullinan2', 'ec-'],
            elementId: 'owner',
            type: 'csv', // Semicolon separated array mapping
            set: (val) => {
                updateSelectOptions('owner', val);
            }
        },
        repositoriesList: {
            key: 'repositories',
            default: ['Quake3e', 'baseq3a'],
            elementId: 'repository',
            type: 'csv',
            set: (val) => {
                updateSelectOptions('repository', val);
            }
        },
        defaultRepository: {
            key: 'default_repository',
            default: 'briancullinan2/Quake3e',
            elementId: 'repository',
            get: (storage, defaultRepo) => owner.value && repository.value
                ? owner.value + '/' + repository.value
                : storage || defaultRepo,
            set: setRepository
        },
        engineRepository: {
            key: 'engine_repository',
            default: 'briancullinan2/Quake3e',
            set: configureRepository
        },
        gameRepository: {
            key: 'game_repository',
            default: 'ec-/baseq3a',
            set: configureRepository
        },
        assetRepository: {
            key: 'asset_repository',
            default: '',
            set: configureRepository
        },
        toolsRepository: {
            key: 'tools_repository',
            default: 'briancullinan2/q3lcc',
            set: configureRepository
        },
        tools2Repository: {
            key: 'tools_repository',
            default: 'ec-/q3asm',
            set: configureRepository
        },
        rendererRepository: {
            key: 'renderer_repository',
            default: 'briancullinan2/Quake3e',
            set: configureRepository
        },
        workspaceDefault: {
            key: 'workspace_default',
            default: 'editor'
        }
    },

    editor: {
        savedTheme: {
            key: 'theme',
            default: 'ace/theme/monokai',
            elementId: 'theme',
            set: (val) => {
                if (typeof setTheme === 'function') setTheme(val);
                theme.value = val
            }
        },
        savedKeyBinding: {
            key: 'keybinding',
            default: 'ace/keybinding/vim',
            elementId: 'keybinding',
            set: (val) => {
                if (!window.aceEditor) return;
                if (!val || val === 'null') {
                    window.aceEditor.setKeyboardHandler(null);
                } else {
                    keybinding.value = val
                    window.aceEditor.setKeyboardHandler(val);
                }
            }
        }
    },

    build: {
        currentConfig: {
            key: 'configuration',
            default: 'client',
            elementId: 'configuration',
        },
        hotReload: {
            key: 'hot_reload',
            default: true,
            elementId: 'reload',
            type: 'boolean'
        }
    },

    terminal: {
        commandHistory: {
            key: 'history',
            default: [],
            type: 'array',
            set: (val) => {
                const newValue = val.slice(0)
                if (!window.commandHistory) window.commandHistory = [];
                window.commandHistory.length = 0;
                if (Array.isArray(newValue)) {
                    newValue.forEach(cmd => { if (cmd.trim()) window.commandHistory.push(cmd); });
                }
            }
        },
        terminalLog: {
            edit: false,
            key: 'terminal_log',
            default: [],
            type: 'json'
        }
    },

    paint: {
        transparency: { key: 'paint_transparency', default: false, elementId: 'pop_data_transparency', type: 'boolean' },
        transparencyType: { key: 'paint_transparency_type', default: 'squares', elementId: 'pop_data_transparency_type' },
        theme: { key: 'paint_theme', default: 'dark', elementId: 'pop_data_theme' },
        units: { key: 'paint_units', default: 'pixels', elementId: 'pop_data_default_units' },
        resolution: { key: 'paint_resolution', default: '72', elementId: 'pop_data_resolution' },
        enableSnap: { key: 'paint_snap', default: true, elementId: 'pop_data_snap', type: 'boolean' },
        enableGuides: { key: 'paint_guides', default: true, elementId: 'pop_data_guides', type: 'boolean' },
        safeSearch: { key: 'paint_safe_search', default: true, elementId: 'pop_data_safe_search', type: 'boolean' },
        exitConfirm: { key: 'paint_exit_confirm', default: true, elementId: 'pop_data_exit_confirm', type: 'boolean' },
        thickGuides: { key: 'paint_thick_guides', default: false, elementId: 'pop_data_thick_guides', type: 'boolean' },
        enableAutoResize: { key: 'paint_autoresize', default: true, elementId: 'pop_data_enable_autoresize', type: 'boolean' },
        quickSaveData: { key: 'quicksave_data', default: '' }
    },

    quake3e: {
        preferredRenderer: {
            key: 'renderer_preference',
            default: 'toji'
        }
    },

    toji: {
        preferredRenderer: {
            key: 'renderer_preference',
            default: 'toji'
        }
    }
};


const SettingsManager = {
    // 1. Initial hydration loop running across local storage on boot
    hydrateAll() {
        for (const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS)) {
            for (const [camelKey, config] of Object.entries(settings)) {
                config.windowName = camelKey
                let raw = localStorage.getItem(config.key);
                let finalValue = raw;

                if (raw === null) {
                    finalValue = config.default;
                } else if (config.type === 'boolean') {
                    finalValue = raw === 'true';
                } else if (config.type === 'json' || config.type === 'array') {
                    try {
                        finalValue = JSON.parse(raw);
                        if (config.type === 'array' && !(Array.isArray(finalValue))) {
                            debugger
                            finalValue = []
                        }
                    } catch (e) {
                        debugger
                        console.error(e)
                        finalValue = config.default;
                    }
                } else if (config.type === 'csv') {
                    finalValue = raw.split(';').filter(Boolean);
                }

                // Apply back downstream directly into memory/DOM elements
                this.applyValue(config, finalValue);
            }
        }
    },

    // 2. Applies the translated state to elements or core configurations
    applyValue(config, value) {

        config.currentValue = window[config.windowName] = value
        if (typeof config.set === 'function') {
            config.set(value);
        } else if (config.elementId) {
            const el = document.getElementById(config.elementId);
            if (el) {
                if (config.type === 'boolean' || el.type === 'checkbox') {
                    el.checked = !!value;
                } else if (el.tagName.toUpperCase() === 'SELECT') {
                    if (el.querySelector(`[value*="${value}"]`)) {
                        el.value = value
                    } else {
                        el.value = config.default
                    }
                }
                else {
                    el.value = value;
                }
            }
        }
    },

    exportPayload() {
        const payload = {};

        // 1. Gather all valid configs into a flat list
        const flatConfigs = [];
        for (const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS)) {
            for (const [camelKey, config] of Object.entries(settings)) {
                if (config.edit === false) continue;
                flatConfigs.push(config);
            }
        }

        // 2. Alphabetize the configs up front by their payload key
        flatConfigs.sort((a, b) => a.key.localeCompare(b.key));

        // 3. Process the sorted configs to build the ordered payload
        for (const config of flatConfigs) {
            let currentVal;
            if (typeof config.get === 'function') {
                currentVal = config.get(localStorage.getItem(config.key), config.default, config);
            } else if (config.elementId) {
                const el = document.getElementById(config.elementId);
                if (el) {
                    if (config.type === 'csv' && el.nodeName === 'SELECT') {
                        currentVal = Array.from(el.children).map(c => c.value).join(';')
                    }
                    else {
                        currentVal = (config.type === 'boolean' || el.type === 'checkbox') ? el.checked : el.value;
                    }
                }
            } else {
                // Fallback reading directly from storage state
                currentVal = localStorage.getItem(config.key);
            }

            if (config.type === 'csv') {
                currentVal = currentVal.split(';')
            }
            if (config.type === 'array' || config.type === 'json') {
                try {
                    currentVal = JSON.parse(currentVal);
                } catch (e) {
                    currentVal = config.type === 'array' ? [] : {};
                }
            }
            currentVal = currentVal !== null ? currentVal : config.default;
            payload[config.key] = currentVal
        }

        return payload;
    },

    get(moduleKey, settingKey) {
        let config = IMPORT_SETTINGS[moduleKey]?.[settingKey];
        if (!config) {
            config = Object.values(IMPORT_SETTINGS[moduleKey] || {})
                .find(config => config.key === settingKey)
                || Object.values(IMPORT_SETTINGS[moduleKey] || {})
                    .find(c => settingKey instanceof Element
                        && c.elementId === settingKey.name
                        || c.elementId === settingKey)
            if (!config)
                return null;
        }


        // If it has a custom getter, use it
        //if (typeof config.get === 'function') return config.get();
        const stored = localStorage.getItem(config.key);
        if (stored) {
            if (!config.type) return stored
            if (config.type === 'boolean') return stored === 'true';
            if (config.type === 'csv') return stored.split(';').filter(Boolean);
            if (config.type === 'json' || config.type === 'array') {
                // return default because threes no form element for json?
                try {
                    let parsed = JSON.parse(stored);
                    if (config.type === 'array') {
                        return Array.isArray(parsed) ? parsed : []
                    }
                    return parsed
                } catch (e) {
                    console.error(e)
                    debugger
                    return stored || config.default;
                }
            }
        }


        // If it binds to a DOM element, read the live UI state
        if (config.elementId) {
            const el = document.getElementById(config.elementId);
            if (el) {
                return (config.type === 'boolean' || el.type === 'checkbox') ? el.checked : el.value;
            }
        }

        // Fallback to local storage state or hardcoded schema default
        return config.default
    }

};

let previousSettings = null

async function settings() {
    const database = owner.value + '/' + repository.value;
    const filePath = 'settings.json' + (++tempCount);

    if (window.engineRepo?.startsWith('Quake3e')) {
        console.error('Assertion owner set to Quake3e instead of briancullinan');
        debugger;
    }

    // Generates the clean payload directly from our structured definitions
    previousSettings = SettingsManager.exportPayload();
    const settingsString = JSON.stringify(previousSettings, null, 4);
    const newSha = await getGitShaBrowser(settingsString);

    if (files[database]) {
        files[database][filePath] = {
            timestamp: new Date(),
            mode: FS_FILE,
            contents: new TextEncoder().encode(settingsString),
            path: filePath,
            sha: newSha,
            parent: filePath.substring(0, filePath.lastIndexOf('/'))
        };
    }

    const session = getOrCreateAceSession(filePath, settingsString);
    aceEditor.setSession(session);

    hideOpenPanels();
    editorContainer.classList.add('not-hidden');
    editorContainer.classList.remove('hidden');
}

function saveSettings(content) {
    try {
        let freshSettings = JSON.parse(content);

        // Run across every item inside the payload, push to storage, and apply logic dynamically
        for (const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS)) {
            for (const [camelKey, config] of Object.entries(settings)) {
                if (freshSettings[config.key] !== undefined) {
                    let value = freshSettings[config.key];

                    // Sync browser storage
                    if (config.type === 'array') {
                        localStorage.setItem(config.key, JSON.stringify(value));
                    } else if (config.type === 'csv') {
                        if (typeof value === 'string')
                            localStorage.setItem(config.key, value);
                        else if (Array.isArray(value))
                            localStorage.setItem(config.key, value.join(';'));
                        else
                            localStorage.setItem(config.key, value.toString());
                    } else if (config.type === 'json' || Array.isArray(value)) {
                        if (!Array.isArray(value))
                            localStorage.setItem(config.key, JSON.stringify([value]));
                        else
                            localStorage.setItem(config.key, JSON.stringify(value));
                    } else {
                        localStorage.setItem(config.key, value);
                    }

                    // Force DOM / Runtime Engine update
                    if (value !== previousSettings[config.key].currentValue)
                        SettingsManager.applyValue(config, value);
                }
            }
        }
    } catch (e) {
        PREAMBLE = EDITOR_PREAMBLE;
        writeLog(`${e.message}\n\r${e.stack || e.stacktrace}`);
    }
}


