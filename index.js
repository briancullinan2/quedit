var term = new Terminal();
term.open(document.getElementById('terminal'));
term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ')


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
          }
        };
        if (i < parts.length - 1 || item.type === 'tree') {
          existingPath.children = [];
        }
        currentLevel.push(existingPath);
      }
      currentLevel = existingPath.children;
    });

    return acc;
  }, []);
};


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
    const myTree = new Tree('#filelist', {
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
editor.resize();