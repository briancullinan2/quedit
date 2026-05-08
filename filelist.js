
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


let savedToken;
let myTree;
async function loadGitHubTree(repoOwner, repoName, branch, selector) {
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
    myTree = new Tree(selector, {
      data: nestedData,
      autoOpen: false,
      closeDepth: 2,
      
    });

  } catch (error) {
    console.error('Failed to load GitHub tree:', error);
  }
}


async function initializeFiletrees()
{
    var parts = document.getElementById('filelist').dataset['repository']?.split('/')
    var newRepo = parts.length == 2 ? parts[1] : parts[0] || repo.value
    var newOwner = parts.length == 2 ? parts[0] : owner.value
    var branches = await getBranches(newOwner, newRepo)

    await loadGitHubTree(newOwner, newRepo, branches[0]?.name || 'main', '#filelist')

    var parts2 = document.getElementById('gamelist').dataset['repository']?.split('/')
    var newRepo2 = parts2.length == 2 ? parts2[1] : parts2[0] || repo.value
    var newOwner2 = parts2.length == 2 ? parts2[0] : owner.value
    var branches2 = await getBranches(newOwner2, newRepo2)

    await loadGitHubTree(newOwner2, newRepo2, branches2[0]?.name || 'main', '#gamelist')

    
}

initializeFiletrees();
  


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

document.getElementById('filelist').addEventListener('click', (e) => {
    const node = e.target.closest('.treejs-node');
    if (node && node.classList.contains('treejs-placeholder')) {
        const fileId = node.getAttribute('data-id'); // Assuming you set this
        openFile(owner.value, repo.value, fileId);
    }
});



var panels = document.querySelectorAll('#filesearch, #filelist, #gamelist, #assetlist, #database')

document.getElementById('tabs').addEventListener('click', (e) => {

  if(e.target.href?.split('#').pop() == 'collapse')
  {
    let hasOpen = hideOpenPanels()
    if(!hasOpen)
      document.getElementById('filelist').classList.remove('hidden')
  }
  else 
  {
    let panel = e.target.href?.split('#').pop()
    if(panel)
    {
      hideOpenPanels()
      document.getElementById(panel).classList.remove('hidden')
    }
  }

});


function hideOpenPanels()
{
  var hasOpen = false;
  for(let panel of panels)
  {
    if(!panel.classList.contains('hidden'))
    {
      panel.classList.add('hidden')
      hasOpen = true
    }
  }
  return hasOpen
}


