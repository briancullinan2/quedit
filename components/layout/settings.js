const IMPORT_SETTINGS = {

    build: {
        currentConfig: {
            key: 'configuration',
            default: 'client',
            elementId: 'configuration',
            description: 'Determines the target compilation profile rules, distinguishing targets such as full client builds or dedicated server binaries.'
        },
        hotReload: {
            key: 'hot_reload',
            default: true,
            elementId: 'reload',
            type: 'boolean',
            description: 'When true, enables immediate compilation triggers and injection changes directly into the live executable WASM state upon saving files.'
        }
    },

    quake3e: {
        preferredRenderer: {
            key: 'renderer_preference',
            default: 'toji',
            description: 'Instructs the underlying Quake3e engine wrapper build profile to leverage specific WebGL pipeline optimizations (e.g., Brandon Jones\' Toji renderer optimizations).'
        }
    },

    nunu: {
        preferredRenderer: {
            key: 'renderer_preference',
            default: 'nunu',
            description: 'Use nunuStudio as the default map renderer.'
        }
    }
};

