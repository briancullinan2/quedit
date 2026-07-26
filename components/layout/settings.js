const IMPORT_SETTINGS = {
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

