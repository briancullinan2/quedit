const owner = document.getElementById('owner');
const repo = document.getElementById('repository');
const branch = document.getElementById('branch');

let savedToken;


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
async function loadGitHubTree(repoOwner, repoName, branch) {
  savedToken = localStorage.getItem('github_token');

  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`;
  
  try {
    const response = await fetch(url, {
        method: 'GET',
        headers: savedToken ? {
            'Authorization': `Bearer ${savedToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        } : {}
    });
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


var editor = ace.edit("editor");
editor.session.setUseWorker(false);
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/c_cpp");

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

async function getDefaultBranch(owner, repo) {
    const savedToken = localStorage.getItem('github_token');
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {}
    });
    const data = await response.json();
    return data.default_branch; // Usually "main" or "master"
}


async function getBranches(repoOwner, repoName) {
    const savedToken = localStorage.getItem('github_token');
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/branches`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: savedToken ? {
                'Authorization': `Bearer ${savedToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            } : {}
        });

        if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);

        const branches = await response.json();
        const defaultName = await getDefaultBranch(repoOwner, repoName)

        const sortedBranches = branches.sort((a, b) => {
          if (a.name === defaultName) return -1;
          if (b.name === defaultName) return 1;
          return a.name.localeCompare(b.name);
        });

        updateSelectOptions('branch', branches)
        return branches;
    } catch (error) {
        console.error("Failed to fetch branches:", error);
        return [];
    }
}


getBranches(owner.value, repo.value)
  .then(branches => loadGitHubTree(owner.value, repo.value, branches[0]?.name))

  


function updateSelectOptions(elementId, items, selectedValue = 'main') {
    const selector = document.getElementById(elementId);
    if (!selector) return;

    // 1. Clear existing options
    selector.innerHTML = '';

    // 2. Create and append new options
    items.forEach(item => {
        // Handle both simple strings or GitHub branch objects
        const name = typeof item === 'object' ? item.name : item;
        const option = document.createElement('option');
        
        option.value = name;
        option.textContent = name;
        
        if (name === selectedValue) {
            option.selected = true;
        }
        
        selector.appendChild(option);
    });

    // 3. Force layout recalculation 
    // This helps with the "wont shrink" issue if the new text is shorter
    selector.style.minWidth = '0'; 
}



async function openFile(repoOwner, repoName, fileId, recordHistory = true) {
    savedToken = localStorage.getItem('github_token');

    const rawUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${myTree.nodesById[fileId].path}`;
    currentOpenFileId = fileId;
    var result = await fetch(rawUrl, {
        method: 'GET',
        headers: savedToken ? {
            'Authorization': `Bearer ${savedToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        } : {}
    })

    if (!result.ok) throw new Error(`HTTP error! status: ${result.status}`);

    const jsonResponse = await result.json();
    
    // --- DECODING LOGIC ---
    // GitHub wraps the file content in a JSON object and encodes it in Base64
    // We strip newlines and decode it back to a standard UTF-8 string
    let content = "";
    if (jsonResponse.encoding === 'base64') {
        content = atob(jsonResponse.content.replace(/\n/g, ''));
    } else {
        content = jsonResponse.content || ""; 
    }
    
    // 1. Update your TreeJS selection
    myTree.values = [fileId];

    // 2. Ace Session
    const session = getOrCreateAceSession(fileId, content);
    const mode = getModeByFileId(fileId);
    session.setMode(mode);
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();

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
        openFile(owner.value, repo.value, fileId);
    }
});


const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

// ANSI Escape Code Definitions
const colors = {
    reset: "\x1b[0m",
    log:   "\x1b[32m", // Green
    warn:  "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    info:  "\x1b[36m", // Cyan
    gray:  "\x1b[90m"  // Gray for timestamps/meta
};

const formatMessage = (level, args) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `${colors.gray}[${timestamp}]${colors.reset} ${colors[level]}[${level.toUpperCase()}]${colors.reset} `;
    
    // Convert objects to strings so they don't show up as [object Object] in xterm
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    return `${prefix}${message}\r\n`;
};

window.console.log = (...args) => {
    term.write(formatMessage('log', args));
    originalConsole.log.apply(console, args);
};

window.console.warn = (...args) => {
    term.write(formatMessage('warn', args));
    originalConsole.warn.apply(console, args);
};

window.console.error = (...args) => {
    term.write(formatMessage('error', args));
    originalConsole.error.apply(console, args);
};

window.console.info = (...args) => {
    term.write(formatMessage('info', args));
    originalConsole.info.apply(console, args);
};


const tokenInput = document.getElementById('gh-token-input');
const modal = document.getElementById('token-modal');

function updatePlaceholder() {
    savedToken = localStorage.getItem('github_token');
    
    if (savedToken && savedToken.length > 0) {
        // Show a masked version so the user knows it's set
        const masked = savedToken.substring(0, 4) + "•".repeat(12);
        tokenInput.placeholder = `Currently set: ${masked}`;
        tokenInput.classList.add('has-token');
    } else {
        tokenInput.placeholder = "Enter ghp_your_token_here...";
        tokenInput.classList.remove('has-token');
    }

    modal.classList.remove('hidden');
}

function saveToken() {
    savedToken = tokenInput.value.trim();
    if (savedToken) {
        localStorage.setItem('github_token', savedToken);
        tokenInput.value = ''; // Clear input for security
        updatePlaceholder();
        alert('Token saved to local storage.');
    }
    modal.classList.add('hidden');
}

function clearToken() {
    localStorage.removeItem('github_token');
    updatePlaceholder();
}


document.getElementById('theme').addEventListener('change', (e) => {
    const themeName = e.target.value.split('/').pop(); // Gets 'monokai' or 'dracula'
    // Clean up old classes and add new one
    document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
    
    // Actually tell Ace to change its internal theme too
    editor.setTheme(e.target.value);
});

