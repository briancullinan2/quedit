var term = new Terminal();
term.open(document.getElementById('terminal'));
term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ')

const container = document.getElementById('terminal');

window.addEventListener('resize', () => {
    forceFit(term, container); 
});

function forceFit(term, container) {
    // 1. Get the internal dimension service (where Xterm 5 stores sizing)
    const core = term._core;
    const dims = core._renderService.dimensions;

    if (!dims || dims.css.cell.width === 0) {
        // The renderer isn't ready yet—try again in the next frame
        requestAnimationFrame(() => forceFit(term, container));
        return;
    }

    // 2. Calculate based on the parent's actual pixel size
    const scrollbarWidth = 15; // Standard buffer for the scrollbar
    const width = container.clientWidth - scrollbarWidth;
    const height = container.clientHeight;

    const cols = Math.max(2, Math.floor(width / dims.css.cell.width));
    const rows = Math.max(1, Math.floor(height / dims.css.cell.height));

    // 3. Force the resize
    term.resize(cols, rows);
}

term.onRender(() => {
    // Now the core services are guaranteed to exist
    setTimeout(() => forceFit(term, container), 100); 
});


const convertFlatToNested = (data) => {
  return data.reduce((acc, item) => {
    const parts = item.path.split('/');
    let currentLevel = acc;

    parts.forEach((part, i) => {
      let existingPath = currentLevel.find(node => node.text === part);

      if (!existingPath) {
        existingPath = { 
          id: `${item.sha}-${i}`, 
          text: part,
          state: {
            open: false, 
            expanded: false 
          },
          path: item.path
        };
        if (i < parts.length - 1 || item.type === 'tree') {
          existingPath.children = [];
        }
        currentLevel.push(existingPath);
      }
      currentLevel = existingPath.children;
    });

    return sortNodes(acc);
  }, []);
};


const sortNodes = (nodes) => {
  nodes.sort((a, b) => {
    const aHasChildren = Array.isArray(a.children);
    const bHasChildren = Array.isArray(b.children);

    // 1. Sort by "Folder-ness" (true/false)
    if (aHasChildren && !bHasChildren) return -1;
    if (!aHasChildren && bHasChildren) return 1;

    // 2. Then sort alphabetically by text
    return a.text.localeCompare(b.text);
  });

  // 3. Recurse into children
  nodes.forEach(node => {
    if (node.children) sortNodes(node.children);
  });

  return nodes;
};

const sessionCache = {};

function getOrCreateAceSession(fileId, content) {
    if (sessionCache[fileId]) {
        return sessionCache[fileId];
    }

    // Create a new session with the file content
    const session = ace.createEditSession(content);
    
    // Set the language mode based on the file extension
    const mode = getModeByFileId(fileId);
    session.setMode(mode);

    // Optional: Set tab size or wrap mode for specific languages
    if (fileId.endsWith('.c') || fileId.endsWith('.h')) {
        session.setTabSize(4);
    }

    // Store in cache so we don't lose the UndoStack for this file
    sessionCache[fileId] = session;
    return session;
}


let myTree;
async function loadGitHubTree() {
  const url = 'https://api.github.com/repos/briancullinan2/Quake3e/git/trees/main?recursive=1';
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    // Transform the flat GitHub 'tree' array into nested children
    const nestedData = convertFlatToNested(data.tree);

    // Initialize Tree.js with the transformed data
    // Note: Use 'data' property instead of 'url' to provide the object directly
    myTree = new Tree('#filelist', {
      data: nestedData,
      autoOpen: false,
      closeDepth: 2,
      
    });

  } catch (error) {
    console.error('Failed to load GitHub tree:', error);
  }
}

const treeContainer = document.querySelector('#filelist');

const observer = new MutationObserver(() => {
    // This runs every single time the library touches the HTML
    const nodes = treeContainer.querySelectorAll('.treejs-node');
    
    nodes.forEach(node => {
        // Skip files/placeholders
        if (node.querySelector('.treejs-placeholder')) return;

        // If it's NOT closed, force the open class
        if (!node.classList.contains('treejs-node__close')) {
            node.classList.add('treejs-node__open');
        } else {
            node.classList.remove('treejs-node__open');
        }
    });
});

// Start watching the tree for any internal "erasing"
observer.observe(treeContainer, {
    childList: true,
    subtree: true
});

loadGitHubTree();

var editor = ace.edit("editor");
editor.session.setUseWorker(false);
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/javascript");

setTimeout(() => {
  editor.resize();
  editor.renderer.updateFull();
}, 300)


let currentOpenFileId;
let navTimer;
editor.on("changeSelection", function() {
    if (NavHistory.isNavigating) return;

    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
        const pos = editor.getCursorPosition();
        const currentFile = currentOpenFileId; // Your global var
        
        // Only push if it's a different file or a significantly different line
        const lastPoint = NavHistory.stack[NavHistory.index];
        if (!lastPoint || lastPoint.fileId !== currentFile || Math.abs(lastPoint.row - pos.row) > 5) {
            NavHistory.push(currentFile, pos.row, pos.column);
        }
    }, 500); // Wait 500ms of idle time
});

const NavHistory = {
    stack: [],
    index: -1,
    isNavigating: false,

    // Call this whenever a file is opened or a "jump" happens
    push(fileId, row, column) {
        if (this.isNavigating) return;

        // If we were in the middle of the stack and did a new action, 
        // truncate the "forward" history (standard browser behavior)
        if (this.index < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.index + 1);
        }

        this.stack.push({ fileId, row, column });
        this.index = this.stack.length - 1;
    },

    back() {
        if (this.index > 0) {
            this.isNavigating = true;
            this.index--;
            this.apply();
            this.isNavigating = false;
        }
    },

    forward() {
        if (this.index < this.stack.length - 1) {
            this.isNavigating = true;
            this.index++;
            this.apply();
            this.isNavigating = false;
        }
    },

    apply() {
        const point = this.stack[this.index];
        // 1. Switch file in your UI (Dockview/TreeJS logic)
        loadFileById(point.fileId); 
        
        // 2. Move Ace cursor
        editor.gotoLine(point.row + 1, point.column);
    }
};

window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') NavHistory.back();
    if (e.altKey && e.key === 'ArrowRight') NavHistory.forward();
});

const getModeByFileId = (fileId) => {
    const filePath = myTree.nodesById[fileId].path;
    const ext = filePath.split('.').pop().toLowerCase();
    const modes = {
        'js': 'javascript',
        'c': 'c_cpp',
        'cpp': 'c_cpp',
        'h': 'c_cpp',
        'cs': 'csharp',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'txt': 'text'
    };
    return `ace/mode/${modes[ext] || 'text'}`;
};

async function openFile(fileId, recordHistory = true) {
    const rawUrl = `https://raw.githubusercontent.com/briancullinan2/Quake3e/main/${myTree.nodesById[fileId].path}`;
    currentOpenFileId = fileId;
    var result = await fetch(rawUrl)
    var content = await result.text()
    
    // 1. Update your TreeJS selection
    myTree.values = [fileId];

    // 2. Ace Session
    const session = getOrCreateAceSession(fileId, content);
    const mode = getModeByFileId(fileId);
    session.setMode(mode);
    editor.setSession(session);

    // 3. Record it in history if this isn't a "Back/Forward" action
    if (recordHistory) {
        const pos = editor.getCursorPosition();
        NavHistory.push(fileId, pos.row, pos.column);
    }
}

treeContainer.addEventListener('click', (e) => {
    const node = e.target.closest('.treejs-node');
    if (node && node.classList.contains('treejs-placeholder')) {
        const fileId = node.getAttribute('data-id'); // Assuming you set this
        openFile(fileId);
    }
});

// Dockview Tab Switch (if the user clicks a tab)
/*
dockviewApi.onDidActivePanelChange((event) => {
    const panel = event.panel;
    if (panel) {
        openFile(panel.id, true);
    }
});
*/

/*
window.addEventListener("hashchange", function(e) {
    // This stops the browser from doing its "helpful" scrolling
    e.preventDefault();
}, false);
*/

