To solve this cleanly, we can design a highly reusable, object-oriented class hierarchy using **TypeScript subclassing**.

By refactoring your parent `FileListWidget`, we can extract the common layout, setup, and event bindings into generic lifecycle methods. Then, we can extend it to create the **`AssetFileListWidget`** (which loads a single tree flat or with standard boolean-based recursive fetching) and the **`IDBFileListWidget`** (which overrides node expansion dynamically to implement the lazy database-style loading you provided).

### What We Need to Refactor in Your Original `FileListWidget`

To make the class cleanly extendable:

1. **Dynamic Target Selector:** Instead of hardcoding `#${this.treeContainerId}` or relying on global window selectors, subclasses must declare their target selector (e.g., `#database` or `#github`).
2. **Abstract/Overridable Hooks:**
* `initializeFiletrees()` becomes protected and overridable.
* Node-expansion observation (the `MutationObserver` code) will be moved into an overridable method `bindMutationObserver()`.
* Node clicks will be delegated to an overridable `handleNodeClick(fileId: string, nodeEl: HTMLElement)` method.



---

### Step 1: Updated Base `FileListWidget`

Replace your existing `FileListWidget` file (or update its internal structure) with this refined, inheritance-friendly design:

```typescript
// components/FileListWidget.ts
import { Widget, DockPanel } from '@lumino/widgets';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type { GitHubFileEntry } from '../bundle/github-types';
import type { RepositoryToolbar } from '../bundle/menu-repos';
import type { Settings } from '../bundle/settings';
import type { FileManager } from '../bundle/lumino-files';
import { Message, MessageLoop } from '@lumino/messaging';
import Tree from './tree.js';
import { AssetInspector, hasSequentialBinaryRegex, hexDump } from '../rosetta/binary.mjs';
import type { AceEditorWidget } from '../editor/widget';
import type { PaintWidget } from '../paint/widget';

declare global {
  interface Window {
    convertFlatToNested: (data: FlatFileNode[]) => NestedTreeNode[];
    githubRequest: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
    triggerPanelRoute: (panelId: string, mainDock: DockPanel) => Promise<void>;
    loadFileTree: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
    cacheFile: (repoOwner?: string, repoName?: string, filePath?: string, sha?: string, forceReload?: boolean) => Promise<any>;
    mainDock: DockPanel;
    trees: Record<string, any>;
    filesRepo: Record<string, GitHubFileEntry>;
    RepositoryToolbar: typeof RepositoryToolbar;
    SettingsManager: Settings;
    FileManager: typeof FileManager;
    fileListWidgets?: Array<FileListWidget>;
    AceEditorWidget: typeof AceEditorWidget;
    PaintWidget: typeof PaintWidget;
  }
}

export class FileListWidget extends Widget {
  protected treeContainerId: string;
  protected selector: string;
  public static fileListWidgets: Array<FileListWidget> = new Array<FileListWidget>();

  constructor(titleStr: string, customId = 'filelist-panel', customClass = 'ide-file-tree-widget') {
    super();
    this.id = customId;
    this.title.label = titleStr;
    FileListWidget.fileListWidgets.push(this);
    this.title.closable = true;
    this.node.style.minWidth = '200px';
    this.addClass(customClass);

    this.treeContainerId = `tree-${Date.now()}`;
    this.selector = `#${this.treeContainerId}`;

    this.renderLayout();
    this.bindDOMEvents();

    requestAnimationFrame(() => this.initializeFiletrees());
  }

  public processMessage(msg: Message): void {
    if (msg.type === 'close-request') {
      console.log('Intercepted close request, hiding instead: ' + this.title.label);
      this.hide();
      this.parent = null;
      if (this.parent) {
        MessageLoop.sendMessage(this.parent, new Message('layout-request'));
      }
      return;
    }
    super.processMessage(msg);
  }

  /**
   * Overridable layout structure injection.
   */
  protected renderLayout(): void {
    this.node.innerHTML = `
      <div class="filelist-wrapper">
        <ul class="toolbar">
          <li><a alt="New file" href="#new-file" class="bx bx-file-plus"></a></li>
          <li><a alt="New folder" href="#new-folder" class="bx bx-folder-plus"></a></li>
          <li><a alt="Hidden files" href="#hidden" class="bx bx-eye-slash"></a></li>
          <li><a alt="Github link" href="#link" class="bx bx-link"></a></li>
          <li><a alt="Refresh list" href="#refresh" class="bx bx-refresh-cw"></a></li>
          <li class="setting" data-placeholder="Owner">
            <select name="owner" class="filelist-owner">
              <option value="briancullinan2">briancullinan2</option>
              <option value="ec-">ec-</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Repository">
            <select name="repository" class="filelist-repository">
              <option value="Quake3e">Quake3e</option>
              <option value="baseq3a">baseq3a</option>
              <option value="q3lcc">q3lcc</option>
              <option value="q3asm">q3asm</option>
              <option value="quedit">quedit</option>
            </select>
          </li>
          <li class="setting" data-placeholder="Branch">
            <select name="branch" class="filelist-branch">
              <option value="main">main</option>
              <option value="wasm-support">wasm-support</option>
              <option value="recent_updates">recent_updates</option>
            </select>
          </li>
        </ul>
        <div class="search-box">
          <input type="text" id="search" name="search" placeholder="Search many..." />
        </div>
        <div id="${this.treeContainerId}" class="treejs-render-target"></div>
      </div>
    `;
  }

  protected bindDOMEvents(): void {
    this.node.querySelector('.filelist-repository')?.addEventListener('change', () => this.onRepositoryChanged());
    this.node.querySelector('.filelist-branch')?.addEventListener('change', () => this.onRepositoryChanged());

    // Dynamically bind to our target selector
    this.node.querySelector(this.selector)?.addEventListener('click', (e) => this.treeHandler(e));
  }

  protected async initializeFiletrees(): Promise<void> {
    const repoSelect = this.node.querySelector('.filelist-repository') as HTMLSelectElement;
    const pathRepo = window.location.pathname?.trim().replace(/\/$|^\//, '');

    if (pathRepo && pathRepo.length > 0) {
      repoSelect.value = pathRepo;
    }
    this.onRepositoryChanged();
  }

  protected async onRepositoryChanged(): Promise<void> {
    const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
    const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
    const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;

    const targetTreeElement = document.getElementById(this.treeContainerId);
    if (!targetTreeElement) return;
    targetTreeElement.innerHTML = '';

    await window.loadFileTree(owner, repo, branch, this.selector);
  }

  /**
   * Safe Click-handler that delegates file selections to overridable file loading actions.
   */
  protected async treeHandler(e: Event): Promise<void> {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const node = target.closest('.treejs-node') as HTMLElement | null;
    if (!node) return;

    const fileId = node.getAttribute('data-id');
    if (!fileId || fileId.endsWith('[Recursive]')) return;

    if (node.classList.contains('treejs-placeholder')) {
      await this.handleNodeClick(fileId, node);
    }
  }

  /**
   * Overridable leaf file opener
   */
  protected async handleNodeClick(fileId: string, node: HTMLElement): Promise<void> {
    const tree = window.trees[this.selector];
    if (!tree || !tree.nodesById[fileId]) return;

    const filePath = tree.nodesById[fileId].path;
    let selected = window.RepositoryToolbar.owner?.value + '/' + window.RepositoryToolbar.repository?.value;
    let nodeDB: string | null;

    if (nodeDB = node.getAttribute('data-database')) {
      selected = nodeDB;
    }
    if (node.closest('#filelist')) {
      selected = window.SettingsManager.get('github', 'engineRepository');
    }
    if (node.closest('#gamelist')) {
      selected = window.SettingsManager.get('github', 'gameRepository');
    }
    if (node.closest('#assetRepo')) {
      selected = window.SettingsManager.get('github', 'assetRepository');
    }
    if (node.closest('#database')) {
      const parent = node.closest('#database > div > ul > li[data-id]') as HTMLElement | null;
      if (parent && (nodeDB = parent.getAttribute('data-id'))) {
        selected = nodeDB;
      }
    }
    if (node.closest('#github')) {
      const parent = node.closest('#github > div > ul > li[data-id]') as HTMLElement | null;
      if (parent && (nodeDB = parent.getAttribute('data-id'))) {
        selected = nodeDB;
      }
    }

    const [realFilePath, selectedGithub, dbFile] = await window.FileManager.findFileTestPath(filePath);
    let contents = dbFile?.contents;
    if (!contents && selectedGithub && (!dbFile?.contents || dbFile.contents?.length === 0)) {
      const parts = selectedGithub.split('/');
      const newRepo = parts.length === 2 ? parts[1] : parts[0] || window.RepositoryToolbar.repository?.value;
      const newOwner = parts.length === 2 ? parts[0] : window.RepositoryToolbar.owner?.value;
      contents = await window.cacheFile(newOwner, newRepo, filePath) as ArrayBuffer;
    }

    const byteView = new Uint8Array(contents).subarray(0, 8192);
    const sampleText = new TextDecoder().decode(byteView);

    const isImageFile = AssetInspector.isActuallyImage(byteView, filePath);
    if (isImageFile) {
      if (typeof window.PaintWidget === 'undefined') {
        await window.triggerPanelRoute('paint', window.mainDock);
      }
      window.PaintWidget.openFileInNewTab(realFilePath ?? filePath, realFilePath ?? filePath, contents);
    } else {
      let decodedContents: string;
      if (hasSequentialBinaryRegex.test(sampleText)) {
        decodedContents = hexDump(byteView, contents, filePath);
      } else {
        decodedContents = new TextDecoder().decode(contents);
      }

      if (typeof window.AceEditorWidget === 'undefined') {
        await window.triggerPanelRoute('editor', window.mainDock);
      }
      window.AceEditorWidget.openFileInNewTab(realFilePath ?? filePath, realFilePath ?? filePath, decodedContents);
    }
  }

  protected onResize(msg: Widget.ResizeMessage): void {
    if (msg.height < 0 || msg.width < 0) return;
  }
}

```

---

### Step 2: The Asset Widget (`AssetFileListWidget`)

This class extends our base `FileListWidget` to render inside `#assetlist`. It fetches files sequentially one layer or one specific repository query list at a time. It leaves hints intact for your boolean API changes:

```typescript
// components/AssetFileListWidget.ts
import { FileListWidget } from './FileListWidget';

export class AssetFileListWidget extends FileListWidget {
  constructor(titleStr: string) {
    // Instantiate with custom panel id and selector mapping
    super(titleStr, 'assetlist-panel', 'ide-asset-tree-widget');
    this.treeContainerId = 'assetlist'; // Hardcoded selector bind point as required
    this.selector = '#assetlist';
  }

  /**
   * Simplified Layout for Assets Sidebar (no dense selector toolbars needed)
   */
  protected override renderLayout(): void {
    this.node.innerHTML = `
      <div class="filelist-wrapper">
        <div class="search-box">
          <input type="text" id="asset-search" name="search" placeholder="Search assets..." />
        </div>
        <div id="${this.treeContainerId}" class="treejs-render-target"></div>
      </div>
    `;
  }

  protected override async initializeFiletrees(): Promise<void> {
    const assetRepository = window.SettingsManager.get('core', 'assetRepository');
    const parts = assetRepository?.split('/') || [];

    if (parts && parts[0]) {
      const newRepo = parts.length === 2 ? parts[1] : parts[0];
      const newOwner = parts.length === 2 ? parts[0] : 'briancullinan2';

      // HINT: Pass false/true as a custom query boolean to specify recursive behavior on GitHub API
      const recursiveFetch = false;

      if (newOwner && newRepo) {
        await window.loadFileTree(newOwner, newRepo, 'main', this.selector);
      }
    }
  }
}

```

---

### Step 3: The Lazy Loader IDB Widget (`IDBFileListWidget`)

This class handles complex IndexedDB directory expansion dynamically. It intercepts directory clicks, queries the IndexedDB indexes sequentially on demand, constructs virtual subtree folders with temporary `Loading...` nodes, and updates the view via `Tree.renderPartial(folderId)` cleanly using object-oriented state.

```typescript
// components/IDBFileListWidget.ts
import { FileListWidget } from './FileListWidget';

// Custom Typings for Virtual Nodes
interface VirtualNode {
  id: string;
  text: string;
  path: string;
  parent?: any;
  status: number;
  state: { open: boolean; expanded: boolean };
  children?: VirtualNode[] | null;
}

// Emulating runtime environments
declare const queryIndex: (store: string, index: string, base: string, a?: any, b?: any, db?: string) => Promise<any[]>;
declare const getDatabaseMetadata: () => Promise<any[]>;
declare const sortNodes: (nodes: any[]) => void;
declare const DB_STORE_NAME: string;
declare const FS: { virtual: Record<string, any> };
declare const files: Record<string, any>;

export class IDBFileListWidget extends FileListWidget {
  private loadedDatabases: Record<string, VirtualNode> = {};
  private treeLoading = false;
  private refreshTreeTimer: any = null;
  private observer!: MutationObserver;

  constructor(titleStr: string) {
    super(titleStr, 'database-panel', 'ide-database-tree-widget');
    this.treeContainerId = 'database';
    this.selector = '#database';
  }

  protected override renderLayout(): void {
    this.node.innerHTML = `
      <div class="filelist-wrapper">
        <div class="search-box">
          <input type="text" id="db-search" name="search" placeholder="Search database indexes..." />
        </div>
        <div id="${this.treeContainerId}" class="treejs-render-target"></div>
      </div>
    `;
  }

  protected override async initializeFiletrees(): Promise<void> {
    await this.showDatabases();
    this.bindMutationObserver();
  }

  /**
   * Sets up MutationObserver to intercept class toggles on folder expansion.
   */
  private bindMutationObserver(): void {
    const targetElement = document.querySelector(this.selector);
    if (!targetElement) return;

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(async (mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          const folderId = target.getAttribute('data-id');

          if (folderId && target.classList.contains('treejs-node__open')) {
            await this.expandDatabaseTree(target, folderId);
          }
        }
      });
    });

    this.observer.observe(targetElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Lazy load folders and render structural updates
   */
  private async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void> {
    if (this.treeLoading) return;
    if (folderId.endsWith('[Recursive]')) return;

    const activeTree = window.trees[this.selector];
    if (!activeTree || !activeTree.nodesById[folderId]) return;

    const parts = folderId.split('/');
    const database = folderId.startsWith('Virtual Memory') ? 'Virtual Memory' : `${parts[0]}/${parts[1]}`;
    const baseDir = folderId.startsWith('Virtual Memory') ? parts.slice(1).join('/') : parts.slice(2).join('/');
    const dirPath = baseDir.substring(0, baseDir.lastIndexOf('/'));
    const parentDir = database + (dirPath.trim().length > 0 ? `/${dirPath}` : '');

    try {
      this.treeLoading = true;

      let resultSet: Record<string, any> = {};
      let resultKeys: string[] = [];

      if (database === 'Virtual Memory') {
        resultSet = FS.virtual;
        resultKeys = Object.keys(FS.virtual);
      } else {
        // Query both trailing-slash combinations safely
        const result = await queryIndex(DB_STORE_NAME, 'parent', baseDir, null, null, database);
        for (const r of result) {
          files[database][r.path] = FS.virtual[r.path] = r;
        }
        const result2 = await queryIndex(DB_STORE_NAME, 'parent', `${baseDir}/`, null, null, database);
        for (const r of result2) {
          files[database][r.path] = FS.virtual[r.path] = r;
        }

        resultSet = Object.values(files[database]).reduce((acc: any, r: any) => {
          acc[r.path] = r;
          return acc;
        }, {});
        resultKeys = Object.keys(resultSet);
      }

      // Isolate immediate children
      const childrenKeys = resultKeys.filter(path => {
        const firstMatch = baseDir === '/' || baseDir === '' || path.startsWith(`${baseDir}/`);
        if (!firstMatch) return false;

        const relativePath = path.substring(baseDir.length + 1);
        const slashIndex = relativePath.indexOf('/');
        return slashIndex === -1 || slashIndex === relativePath.length - 1;
      });

      // Construct lazy nodes
      const newChildren = childrenKeys.map(path => {
        const node = resultSet[path];
        const isDir = node.mode === 16384; // FS_DIR mock or standard directory mode mask
        const name = path.split('/').pop() || path;

        const newNode: VirtualNode = {
          id: database + (path.length === 0 || path[0] === '/' ? '' : '/') + path,
          text: name,
          path: path,
          parent: activeTree.nodesById[folderId],
          status: 0,
          state: { open: false, expanded: false },
          children: isDir ? [{ text: 'Loading...', id: `${path}/loading`, path: `${path}/loading`, status: 0, state: { open: false, expanded: false } }] : null
        };

        this.loadedDatabases[newNode.id] = activeTree.nodesById[newNode.id] = newNode;

        const searchParent = this.loadedDatabases[parentDir]?.children;
        if (searchParent) {
          const parentIndex = searchParent.findIndex(n => n.id === newNode.id);
          if (parentIndex > -1) {
            searchParent[parentIndex] = newNode;
          }
        }

        return newNode;
      });

      if (newChildren.length === 0) {
        newChildren.push({
          text: 'Empty...',
          id: `${folderId}/empty`,
          path: `${folderId}/empty`,
          status: 0,
          state: { open: false, expanded: false }
        });
      }

      sortNodes(newChildren);
      this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;

    } catch (err: any) {
      console.error(`Failed to load tree node: ${err.message}`);
      this.loadedDatabases[folderId] = [{ text: 'Error loading files', id: 'err', path: 'err', status: 0, state: { open: false, expanded: false } }];
    }

    await this.showDatabases(folderId);

    if (this.refreshTreeTimer) {
      clearTimeout(this.refreshTreeTimer);
    }

    this.refreshTreeTimer = setTimeout(async () => {
      activeTree.values = [];
      const node = activeTree.nodesById[folderId];
      if (node) {
        activeTree.open(node);
      }
      setTimeout(() => {
        this.treeLoading = false;
      }, 300);
    }, 200);
  }

  /**
   * Re-evaluates metadata and patches the TreeJS instance
   */
  private async showDatabases(folderId?: string): Promise<void> {
    const databases = await getDatabaseMetadata();
    const topDatabases: VirtualNode[] = [];

    for (const d of databases) {
      if (!this.loadedDatabases[d.key]) {
        this.loadedDatabases[d.key] = {
          id: `${d.key}`,
          text: d.key,
          status: 0,
          state: { open: false, expanded: false },
          path: d.key,
          children: [{
            id: `${d.key}/loading`,
            text: 'Loading...',
            status: 0,
            state: { open: false, expanded: false },
            path: `${d.key}/loading`
          }]
        };
      }
      topDatabases.push(this.loadedDatabases[d.key]);
    }

    if (!this.loadedDatabases['Virtual Memory']) {
      this.loadedDatabases['Virtual Memory'] = {
        id: 'Virtual Memory',
        text: 'Virtual Memory',
        status: 0,
        state: { open: false, expanded: false },
        path: 'Virtual Memory',
        children: [{
          id: 'Virtual Memory/loading',
          text: 'Loading...',
          status: 0,
          state: { open: false, expanded: false },
          path: 'Virtual Memory/loading'
        }]
      };
    }
    topDatabases.push(this.loadedDatabases['Virtual Memory']);

    const activeTree = window.trees[this.selector];
    if (!activeTree) {
      window.trees[this.selector] = new Tree(this.selector, {
        data: topDatabases,
        autoOpen: false,
        closeDepth: null
      });
    } else if (folderId) {
      activeTree.options.data = topDatabases;
      activeTree.renderPartial(folderId);
    }
  }

  protected override onBeforeDetach(msg: Message): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    super.onBeforeDetach(msg);
  }
}

```
