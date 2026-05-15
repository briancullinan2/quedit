
let tempCount = 1;
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


function currentSession() {
    return Object.keys(sessionCache).find(k => sessionCache[k] === editor.getSession())
}


const theme = document.getElementById('theme')
let savedTheme = localStorage.getItem('theme') || theme.value || 'ace/theme/monokai'
let themeName = savedTheme.split('/').pop()
document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
var editor = ace.edit("editor");
editor.setTheme(savedTheme);
editor.renderer.setShowGutter(true);
editor.renderer.$gutterLayer.setShowLineNumbers(true)
editor.renderer.$loop.schedule(editor.renderer.CHANGE_GUTTER);
const keybinding = document.getElementById('keybinding')
let savedKeybinding = localStorage.getItem('keybinding') || keybinding.value || 'ace/keybinding/vim'
if (!document.querySelector(`[value*="${savedKeybinding}"]`))
    savedKeybinding = keybinding.value || 'ace/keybinding/vim'
if (!savedKeybinding || savedKeybinding == 'null')
    editor.setKeyboardHandler(null);
else
    editor.setKeyboardHandler(savedKeybinding);
editor.session.setUseWorker(false);
editor.session.setMode("ace/mode/c_cpp");
; ++tempCount;
sessionCache['temp' + (tempCount)] = editor.session
let currentOpenFileId = 'temp' + (tempCount)

updateMaxLines()

setTimeout(() => {
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

editor.commands.addCommand({
    name: "save",
    bindKey: { win: "Ctrl-S", mac: "Command-S" },
    exec: function (editor) {
        saveFile()
    }
});

/*
ace.config.loadModule("ace/keybinding/vim", function(m) {
    var Vim = m.CodeMirror.Vim;
    Vim.defineEx("quit", "q", function(cm) {
        // Your logic to close the editor, tab, or window
        console.log("User requested quit");
    });
});

// Load the Vim module to access the Status Bar attachment
ace.config.loadModule("ace/keyboard/vim", function(m) {
    var VimApi = m.CodeMirror.Vim;
    // Some versions of Ace require this manual attachment:
    var statusBar = document.getElementById("status-bar");
    
    // This tells Ace to pipe ":commands" and "INSERT/NORMAL" modes to your div
    editor.setOption("showPrintMargin", false); // Optional cleanup
    
    // If using the official status bar extension:
    // var StatusBar = ace.require("ace/ext/statusbar").StatusBar;
    // var aceStatusBar = new StatusBar(editor, statusBar);
});

*/


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
    isModifierPressed = e.ctrlKey || e.metaKey;
});



async function newFile() {
    const session = getOrCreateAceSession('temp' + (++tempCount), '');
    editor.setSession(session);
    editor.resize();
    editor.renderer.updateFull();
    hideOpenPanels()
    document.getElementById('editor').classList.add('not-hidden')

}


async function saveFile() {
    var database = owner.value + '/' + repo.value
    var filePath = currentSession()
    if (!currentSession())
        filePath = trees[database].nodesById[currentOpenFileId].path
    var content = editor.getValue()
    var newSha = await getGitShaBrowser(content)
    FS.virtual[filePath] = {
        timestamp: new Date(),
        mode: FS_FILE,
        contents: new TextEncoder().encode(content),
        path: filePath,
        sha: newSha,
        parent: filePath.substring(0, filePath.lastIndexOf('/'))
    }
    currentOpenFileId = newSha
    if (files[database]) {
        await putRecord(DB_STORE_NAME, FS.virtual[filePath], database)
        if (files[database][filePath])
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
        'i': 'c_cpp',
        'a': 'c_cpp',
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



