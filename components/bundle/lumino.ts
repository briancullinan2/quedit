import { BoxPanel, DockPanel, Widget, Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import * as widgets from '@lumino/widgets';
import * as messaging from '@lumino/messaging';
import { initializeMenus } from './menu';
import '@lumino/widgets/style/index.css';

// 1. Expose Lumino globally for your future dynamic ES6 modules
(window as any).Lumino = {
    widgets,
    messaging
};

console.log("Lumino Core injected into global window space.");

function main(): void {
    // Initialize the Command Registry for our File Menu system
    const commands = new CommandRegistry();

    // Create the central DockPanel target area
    const mainDock = new DockPanel();
    mainDock.id = 'main-workspace';

    // Add a sample command to demonstrate the File Menu system
    commands.addCommand('file-exit', {
        label: 'Exit IDE',
        execute: () => {
            if (confirm('Are you sure you want to exit?')) {
                window.close();
            }
        }
    });

    // Build the File Menu structure
    const fileMenu = new Menu({ commands });
    fileMenu.title.label = 'File';
    fileMenu.addItem({ command: 'file-exit' });

    // Instantiate the global Top MenuBar
    const menuBar = new MenuBar();
    menuBar.id = 'top-menubar';
    menuBar.node.style.minHeight = '30px';
    menuBar.addMenu(fileMenu);

    // Build a manual sidebar widget for the left boundary (VSCode style)
    const toolbar = new Widget();
    toolbar.id = 'left-toolbar';
    toolbar.node.style.minWidth = '50px';

    initializeMenus(commands, menuBar, mainDock, toolbar.node);

    // Construct the global parent layout anchor structure
    const workspaceBox = new BoxPanel({ direction: 'left-to-right', spacing: 0 });
    workspaceBox.id = 'workspace-box';
    BoxPanel.setStretch(toolbar, 0);
    BoxPanel.setStretch(mainDock, 1);
    workspaceBox.addWidget(toolbar);
    workspaceBox.addWidget(mainDock);

    // Assemble Main Window (MenuBar Stacked Top-to-Bottom above Workspace)
    const windowRoot = new BoxPanel({ direction: 'top-to-bottom', spacing: 0 });
    windowRoot.id = 'app-root';
    BoxPanel.setStretch(menuBar, 0);
    BoxPanel.setStretch(workspaceBox, 1);
    windowRoot.addWidget(menuBar);
    windowRoot.addWidget(workspaceBox);

    // Attach directly to the viewport boundary frame
    Widget.attach(windowRoot, document.body);

    window.addEventListener('resize', () => {
        windowRoot.update();
    });
}

window.onload = main;