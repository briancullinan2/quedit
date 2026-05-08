const owner = document.getElementById('owner');
const repo = document.getElementById('repository');
const branch = document.getElementById('branch');



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



function setRepository(newRepo)
{
  let parts = repo.split('/')
  let newOwner
  if(parts.length === 2)
  {
    newOwner = parts[1]
    newRepo = parts[0]
  }

  if(document.querySelector(`#repository option[value="${newRepo}"]`))
  {
    const option = document.createElement('option');
    
    option.value = newRepo;
    option.textContent = newRepo;
    option.selected = true;

    repo.appendChild(option);
  }

  if(newOwner && document.querySelector(`#owner option[value="${newOwner}"]`))
  {
    const option = document.createElement('option');
    
    option.value = newOwner;
    option.textContent = newOwner;
    option.selected = true;

    owner.appendChild(option);
  }

}

window.addEventListener('beforeunload', event => {
  event.preventDefault();
  event.returnValue = '';
});
