
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
theme.value = savedTheme
let themeName = savedTheme.split('/').pop()
document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
const editorContainer = document.getElementById('editor')
let editor = ace.edit("editor");
editor.setTheme(savedTheme);
editor.renderer.setShowGutter(true);
editor.renderer.$gutterLayer.setShowLineNumbers(true)
editor.renderer.$loop.schedule(editor.renderer.CHANGE_GUTTER);
editor.setOptions({
    // Core cursor placement optimizations
    scrollPastEnd: 0.9,       // Keeps cursor centered when adding new code at EOF
    showPrintMargin: true,
    navigateWithinSoftTabs: true,
    //animatedScroll: true,
    //autoScrollEditorIntoView: false,
})
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


function setTheme(theme) {
    const themeName = theme.split('/').pop(); // Gets 'monokai' or 'dracula'
    document.body.className = `theme-${themeName.replace(/_/g, '-')}`;
    localStorage.setItem('theme', theme)
    // Actually tell Ace to change its internal theme too
    editor.setTheme(theme);
    savedTheme = theme
    setTimeout(() => {
        const themeColors = getAceThemeColors();
        if (!themeColors) return;

        term.options.theme = {
            background: themeColors.background,
            foreground: themeColors.foreground,
            cursor: themeColors.foreground,
            selection: themeColors.selection,

            // Mapping for Inverse Logic:
            // Setting a marker to Black (0) + White (7) will now 
            // swap the Ace background and foreground colors.
            black: themeColors.background,   // ANSI 0
            white: themeColors.foreground,   // ANSI 7

            // Map syntax colors to ANSI indices
            magenta: themeColors.pink,       // ANSI 5
            cyan: themeColors.purple,        // ANSI 6
            blue: themeColors.blue,          // ANSI 4
            green: themeColors.green,        // ANSI 2

            // Optional: Gutter color for bright variants
            brightBlack: themeColors.gutter  // ANSI 8
        };
    }, 500);

}



function getAceThemeColors() {
    const editorEle = document.querySelector('.ace_editor');
    if (!editorEle) return null;

    // We pull directly from the computed style of the editor, 
    // which now contains your --ace variables.
    const style = getComputedStyle(editorEle);

    return {
        background: style.getPropertyValue('--ace-bg').trim(),
        foreground: style.getPropertyValue('--ace-foreground').trim(),
        gutter: style.getPropertyValue('--ace-gutter-bg').trim(),
        selection: style.getPropertyValue('--ace-selection-bg').trim(),
        pink: style.getPropertyValue('--ace-pink').trim(),
        purple: style.getPropertyValue('--ace-purple').trim(),
        blue: style.getPropertyValue('--ace-blue').trim(),
        green: style.getPropertyValue('--ace-green').trim(),
        comment: style.getPropertyValue('--ace-comment').trim()
    };
}




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
    let Vim = m.CodeMirror.Vim;
    Vim.defineEx("quit", "q", function(cm) {
        // Your logic to close the editor, tab, or window
        writeLog("User requested quit");
    });
});

// Load the Vim module to access the Status Bar attachment
ace.config.loadModule("ace/keyboard/vim", function(m) {
    let VimApi = m.CodeMirror.Vim;
    // Some versions of Ace require this manual attachment:
    let statusBar = document.getElementById("status-bar");
    
    // This tells Ace to pipe ":commands" and "INSERT/NORMAL" modes to your div
    editor.setOption("showPrintMargin", false); // Optional cleanup
    
    // If using the official status bar extension:
    // let StatusBar = ace.require("ace/ext/statusbar").StatusBar;
    // let aceStatusBar = new StatusBar(editor, statusBar);
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
    hideOpenPanels()
    resizeDebouncer()
    editorContainer.classList.add('not-hidden')
    editorContainer.classList.remove('hidden')

}


async function saveFile() {
    const database = owner.value + '/' + repo.value
    const filePath = currentSession()
    if (!currentSession())
        filePath = trees[database].nodesById[currentOpenFileId].path
    const content = editor.getValue()
    const newSha = await getGitShaBrowser(content)
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


function fullScreenLayout() {
    const width = window.document.body.clientWidth - SCROLLBAR_WIDTH
        - (window.document.body.clientWidth < 800 ? 60 : 0);
    return width < 800
}

function getFullScreenFit(defaultFactor = 0.25) {
    const isFull = fullScreenLayout()
    const tools = document.getElementById('toolbar').clientHeight
        + document.getElementById('statusbar').clientHeight
        + document.getElementById('terminals').clientHeight
        + 10;
    const height = (window.innerHeight - tools) * defaultFactor
    return height
}


function updateMaxLines() {
    const lineHeight = editor.renderer.lineHeight;
    //const availableHeight = document.getElementById('editor-container').clientHeight;

    // Calculate how many lines fit in that space
    const isFull = fullScreenLayout()
    const height = getFullScreenFit(0.99) // isFull ? 0.99 : 0.75) // opposite terminal 0.25
    //let calculatedMax = editor.getValue().split('\n').length
    // add scroll to bottom of files
    //    + (height * 0.25 / lineHeight)
    //if (!isFull) {
    calculatedMax = Math.floor(height / lineHeight);
    //}

    editorContainer.style.height = `${height}px`;
    editor.resize();
    editor.renderer.updateFull();

}

editor.on("changeSelection", () => {
    // Automatically aligns the viewport view frame whenever the cursor moves
    editor.renderer.scrollCursorIntoView(null, 0.5);
});


