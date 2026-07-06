// menu.ts
import { Menu, MenuBar, DockPanel } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';

interface ComponentRoute {
    label: string;
    url?: string;
    className?: string;
    iconClass: string; // The specific Boxicons layout string tokens
}

// 1. Unified metadata tree tracking every panel type and icon token
const MODULE_REGISTRY: Record<string, ComponentRoute> = {
    'collapse': { label: 'Collapse', iconClass: 'bx bx-arrow-in-left-square-half' },
    'editor': { label: 'Code Editor', url: './components/AceEditorWidget.ts', className: 'AceEditorWidget', iconClass: 'bx bx-code' },
    'paint': { label: 'Image Editor', url: './components/PaintWidget.ts', className: 'PaintWidget', iconClass: 'bx bx-palette' },
    'nunu': { label: 'nunuStudio', url: './components/NunuStudioWidget.ts', className: 'NunuStudioWidget', iconClass: 'bx bx-vector-triangle' },
    'audio-editor': { label: 'Audio Engine', url: './components/AudioEditorWidget.ts', className: 'AudioEditorWidget', iconClass: 'bx bx-sine-wave' },
    'searchlist': { label: 'Search Files', url: './components/SearchWidget.ts', className: 'SearchWidget', iconClass: 'bx bx-search' },
    'filelist': { label: 'Engine Files', url: './components/filelist/widget.ts', className: 'FileListWidget', iconClass: 'bx bx-folder-code' },
    'gamelist': { label: 'Game Files', url: './components/GameListWidget.ts', className: 'GameListWidget', iconClass: 'bx bx-handheld-alt' },
    'assetlist': { label: 'Assets', url: './components/AssetListWidget.ts', className: 'AssetListWidget', iconClass: 'bx bx-treasure-chest' },
    'database': { label: 'Local Database', url: './components/DatabaseWidget.ts', className: 'DatabaseWidget', iconClass: 'bx bx-database' },
    'github': { label: 'Github Commit', url: './components/GithubWidget.ts', className: 'GithubWidget', iconClass: 'bx bx-git-repo-forked' },
    'settings': { label: 'Edit Settings', url: './components/SettingsWidget.ts', className: 'SettingsWidget', iconClass: 'bx bx-gear' },
    'viewport-frame': { label: '3D Viewport', url: './components/DedicatedCanvasWidget.ts', className: 'DedicatedCanvasWidget', iconClass: 'bx bx-joystick' },
    'terminal-container': { label: 'Show Console', url: './components/ConsoleWidget.ts', className: 'ConsoleWidget', iconClass: 'bx bx-terminal' },
};

async function loadAndInstantiate(route: ComponentRoute): Promise<any> {
    if (!route.url || !route.className) {
        throw new Error(`Route definition "${route.label}" is missing execution target pathways.`);
    }

    const response = await fetch(route.url);
    const rawCode = await response.text();

    const Babel = (window as any).Babel;
    if (!Babel) throw new Error("Babel standalone runner not found on the window context.");

    const transpiled = Babel.transform(rawCode, {
        presets: ['env'],
        plugins: [
            ['transform-typescript', { isTSX: false }],
            ['transform-modules-commonjs', { loose: true }],

            // A lightweight, custom plugin to intercept requirements and link them to our window
            function () {
                return {
                    visitor: {
                        CallExpression(path) {
                            if (
                                path.node.callee.name === 'require' &&
                                path.node.arguments.length === 1 &&
                                path.node.arguments[0].type === 'StringLiteral'
                            ) {
                                const moduleName = path.node.arguments[0].value;

                                // Map the Node modules cleanly to your exposed globals
                                if (moduleName === '@lumino/widgets') {
                                    path.replaceWithSourceString('window.Lumino.widgets');
                                } else if (moduleName === '@lumino/messaging') {
                                    path.replaceWithSourceString('window.Lumino.messaging');
                                }
                            }
                        }
                    }
                };
            }
        ],
        filename: route.url
    });

    const blob = new Blob([transpiled.code], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);

    try {
        const module = await import(/* webpackIgnore: true */ blobURL);
        return new module[route.className](route.label);
    } finally {
        URL.revokeObjectURL(blobURL);
    }
}

export async function triggerPanelRoute(panelId: string, mainDock: DockPanel): Promise<void> {
    const route = MODULE_REGISTRY[panelId];
    if (!route || !route.url) return; // Skip routes without code targets (like collapse)

    try {
        const widgetInstance = await loadAndInstantiate(route);
        mainDock.addWidget(widgetInstance, { mode: 'tab-after' });
        mainDock.activateWidget(widgetInstance);
    } catch (err) {
        console.error(`Module initialization fault on pathway [${panelId}]:`, err);
    }
}

/**
 * System Context Initialization
 */
export function initializeMenus(commands: CommandRegistry, menuBar: MenuBar, mainDock: DockPanel, toolbarNode: HTMLElement): void {
    const viewMenu = new Menu({ commands });
    viewMenu.title.label = 'Window';

    // 1. Render the HTML list structural tree directly inside the left toolbar container node
    const ul = document.createElement('ul');
    Object.entries(MODULE_REGISTRY).forEach(([id, route]) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.setAttribute('href', `#${id}`);
        a.setAttribute('alt', route.label);
        a.className = route.iconClass;

        // Set 'active' style override state specifically for your engine files entry point
        if (id === 'filelist') {
            a.classList.add('active');
        }

        li.appendChild(a);
        ul.appendChild(li);

        // 2. Map standard commands to Top Menu Bar targets (skipping collapse navigation)
        if (route.url) {
            const commandId = `spawn-panel:${id}`;
            commands.addCommand(commandId, {
                label: route.label,
                iconClass: route.iconClass, // <-- Add this line to attach the Boxicon classes to the command
                execute: () => triggerPanelRoute(id, mainDock)
            });
            viewMenu.addItem({ command: commandId });
        }
    });

    toolbarNode.appendChild(ul);
    menuBar.addMenu(viewMenu);

    // 3. Isolated internal event capture handling bounded to the toolbar container
    toolbarNode.addEventListener('click', (event: MouseEvent) => {
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
            event.preventDefault();
            const panelId = href.substring(1);

            // Manage localized highlight toggle styles across the sidebar icons
            toolbarNode.querySelectorAll('a').forEach(el => el.classList.remove('active'));
            if (panelId !== 'collapse') {
                anchor.classList.add('active');
            }

            if (panelId === 'collapse') {
                toolbarNode.classList.toggle('collapsed');
                return;
            }

            triggerPanelRoute(panelId, mainDock);
        }
    });
}