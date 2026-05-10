
const sessionCache = {};

function getOrCreateAceSession(fileId, content) {
    if (sessionCache[fileId]) {
        return sessionCache[fileId];
    }

    // Create a new session with the file content
    const session = ace.createEditSession(content);

    // Set the language mode based on the file extension
    const mode = getModeByFilename(fileId);
    session.setMode(mode);

    // Optional: Set tab size or wrap mode for specific languages
    if (fileId.endsWith('.c') || fileId.endsWith('.h')) {
        session.setTabSize(4);
    }

    // Store in cache so we don't lose the UndoStack for this file
    sessionCache[fileId] = session;
    return session;
}


function currentSession()
{
    return Object.keys(sessionCache).find(k => sessionCache[k] === editor.getSession())
}


let savedTheme
var theme = document.getElementById('theme')
var editor = ace.edit("editor");
editor.session.setUseWorker(false);
editor.session.setMode("ace/mode/c_cpp");

setTimeout(() => {
    savedTheme = localStorage.getItem('theme');
    const newtheme = savedTheme || theme.value || 'ace/theme/monokai'
    const themeName = newtheme.split('/').pop(); // Gets 'monokai' or 'dracula'
    // Clean up old classes and add new one
    document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
    editor.setTheme(newtheme);
    updateMaxLines()
    editor.resize();
    editor.renderer.updateFull();
}, 300)


function setTheme(theme) {
    const themeName = theme.split('/').pop(); // Gets 'monokai' or 'dracula'
    document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
    localStorage.setItem('theme', theme)
    // Actually tell Ace to change its internal theme too
    editor.setTheme(theme);
    savedTheme = theme
}



theme.addEventListener('change', (e) => {
    // Clean up old classes and add new one
    setTheme(e.target.value)

});


let currentOpenFileId;
let navTimer;
editor.on("changeSelection", function () {
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
        let database = owner.value + '/' + repo.value
        const filePath = trees[database].nodesById[point.fileId].path
        currentOpenFileId = point.fileId;
        trees[database].values = [point.fileId];
        openFile(owner.value, repo.value, filePath, trees[database].nodesById[point.fileId].sha, false);

        editor.gotoLine(point.row + 1, point.column);
    }
};

window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') NavHistory.back();
    if (e.altKey && e.key === 'ArrowRight') NavHistory.forward();
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
    if (e.key === 'Escape') {
        modal.classList.add('hidden')
    }
});


async function saveFile() {
    var database = owner.value + '/' + repo.value
    var filePath = 
        currentSession()
        || trees[database].nodesById[currentOpenFileId].path
    var content = editor.getValue()
    var newSha = await getGitShaBrowser(content)
    FS.virtual[filePath] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new TextEncoder().encode(content),
        path: filePath,
        sha: newSha
    }
    currentOpenFileId = newSha
    if(files[database])
    {
        await putRecord(DB_STORE_NAME, FS.virtual[filePath], database)
        if(files[database][filePath])
            files[database][filePath].sha = newSha
        else
            files[database][filePath] = FS.virtual[filePath]
        trees[database].nodesById[newSha] = files[database][filePath]
    }

    if (filePath.includes('settings.json'))
        saveSettings(content)
}


const getModeByFilename = (filePath) => {
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
        'txt': 'text',
        's': 'assembly_x86',
        'S': 'assembly_x86',
        'asm': 'assembly_x86',
    };
    return `ace/mode/${modes[ext] || 'text'}`;
};


function updateMaxLines() {
    const lineHeight = editor.renderer.lineHeight;
    const availableHeight = document.getElementById('editor-container').clientHeight;

    // Calculate how many lines fit in that space
    const calculatedMax = Math.floor(availableHeight / lineHeight);

    if (window.document.body.clientWidth < 800) {
        editor.setOptions({
            maxLines: Infinity,
            minLines: 10 // Optional: ensure it doesn't disappear
        });
    }
    else {
        editor.setOptions({
            maxLines: calculatedMax - 1,
            minLines: calculatedMax - 1 // Optional: ensure it doesn't disappear
        });
    }
}


