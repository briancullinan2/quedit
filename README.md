# Quedit

Quake 3 browser game editor.

## Goals/Bugs

Redoing my list of bugs because of AI slop.  My mind used to be employable. Now my memory is junk because anything that 
my brain thinks Google knows, it automatically discards and can only be recalled from exact context and wording 
surrounding it. I think if all of these things were done, this could be the first project where I actually consider it completed.

---

### Workspace

1. **Better GitHub Downloads:** Right now, the app splits your files into "engine", "game", and "assets". The `mount` command only downloads the file list, and code files are only downloaded when opened or compiled, this won't work in offline mode. Should be able to mount and manage unlimited repos all inside the same interface (adding quedit itself). Improve the `mount` command so it downloads your entire GitHub repository straight into the browser's permanent storage ([IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API))
2. **Sharable Coding Links:** Currently the proxy server tried to support addressing based on exact IP/port address. There is even a `hex` data type I added to cVars inside the Quake3e. Create a background [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to read remote network commands. This lets multiple people see and control the text editor cursor, send text over the wire using [Ace Editor Protocols](https://ace.c9.io/), and write code together. It will stream the live updates to players mid-game using standard game download settings (`cl_download`), so players don't have to freeze on a loading screen.
3. **Nice Git Staging UI:** Right now, saving changes to GitHub is "all or nothing." Build a clean interface to let you pick exactly which files or lines of code you want to stage and commit.
4. **Proxy Sync vs. Quake 3 Networking:** Currently there is code to open a new tab when the player walks through a portal. Cooler to use Quake 3's built-in 3D physics syncing to pass text changes back and forth, or if a standard web proxy server is enough. The ultimate goal: make code settings show up as real physical switches in the 3D game world. You walk up to a wall, flip a switch for "homing rockets," and the game instantly recompiles the code and turns the feature on without stopping.
5. **Connected Terminal and AI Chat:** Link the developer command line tool directly to the running game engine. Connect the AI chat box to it so it can read errors and filter out junk data. Make map load commands and player teleport settings work inside the Toji physics code, and make sure remote control commands (`rcon`) work perfectly on the [Quake 3 Engine Core](https://github.com/ec-/quake3e).
6. **ANSI Status HUD and Clickable History:** Currently the CLI Render tab shows the canvas in ANSI with misaligned and invisible resize decorations. Render redraw doesn't work well due to line wrapping. Turn the terminal layout into a movable, double-clickable window system that displays a retro, text-based ANSI graphics display. Instead of relying purely on regular keyboard inputs, show recent command history in a draggable, mouse-interactive list utilizing [Xterm.js Mouse Tracking Protocols](https://xtermjs.org/docs/api/terminal/interfaces/imodes/). Add live popups that display core game metrics like frame rates (FPS), ping, active team lists, and player counts.
7. **Mirrored Game Console:** Make sure the dedicated web console tab displays the exact same scrolling log text as the native in-game engine console.
8. **Full-History Deep Search:** Fix the search box so it doesn't just scan the code lines visible on your screen. Expand the lookups so they scan through your entire terminal history.
9. **Lazy-Loading Folder Trees:** Stop using the heavy recursive query flag (`?recursive=1`) on the [GitHub Git Trees API](https://docs.github.com/rest/git/trees) for the assets tree view. Since there are hundreds of media assets, optimize it to load folder contents one layer at a time, exactly like a standard database query.
10. **Terminal-to-Tree Navigation Sync:** Fix a descending error where opening a file directly from the command line fails to expand the file tree sidebar all the way down to that file. Fix the state loop so that once the parent folders load up, the hierarchy explicitly resets its target focus directly onto the active file (`tree.value = [currentFile]`).
11. **Isolated File Tree Selection:** Fix file highlighting in the sidebar. Disable the default [TreeJS Selection Overrides](https://www.google.com/search?q=https://cloudfour.com/thinks/a-guarded-defense-of-the-tree-view/) that automatically highlight every single sub-file when a parent folder expands. Restructure the selection handlers so clicking a folder only targets that specific folder, keeping the "Add File" and "Rename" buttons working properly.
12. **OFFLINE MODE!** I have a worker in quake3e-portals branch and in Atrium that I did more work on from the portals branchs originally. This has a special caveate that the whole environment is also editable and needs to upgrade itself.
13. **Load local environment javascripts** like core/ (anything other than module.js) off of the IDB store instead of from the webserver. Should install itself into IDB and offline mode first time the page loads.


---

### Interface

1. **Instant Code Hot-Reloading:** When you press `CTRL+S`, the browser should instantly recompile just that piece of code. It should either swap the running function inside a live [Virtual Method Table](https://en.wikipedia.org/wiki/Virtual_method_table) or restart that specific sub-component on a separate thread so the game canvas never freezes.
2. **Smart Asset Search:** Fix search so it doesn't just look for raw text. It needs to look for "known" game files like shader names and map textures, showing a smart list of where assets are actually used across GitHub and local storage.
3. **Fix File Name Collisions:** Right now, the engine and the game both use different files named `q_shared.h`. When you compile them together, they crash into each other. Fix this by giving every project its own isolated root folder inside IndexedDB so the virtual file system (`FS.virtual[path]` in [Emscripten File System](https://emscripten.org/docs/api_reference/Filesystem-API.html)) sees unique names.
4. **Code Maps with ANTLR:** Use the [ANTLR Parser](https://www.antlr.org/) to read code files, pull out function names, and build a clickable table of contents under your file list. If you `CTRL+Click` a function, the editor jumps straight to where it was written.
5. **Back/Next Navigation:** Wire up the browser's back and forward buttons to navigate through your open code files. Merge this with a unified undo/redo system for both text editing and texture painting.
6. **Fix miniPaint Shortcuts:** DONE: Stop the [miniPaint](https://github.com/viliusle/miniPaint) drawing tool from stealing keyboard shortcuts when you are working in a different code tab. Only listen to it when its specific tab is open.
7. **Scratchpad File Interception:** Block miniPaint's default "Open File" popups. Route any uploaded files into a temporary sandbox folder (`idb://scratchpad`) so they don't mess up your active workspace until you hit save.
8. **Zen Mode Layouts:** Build absolute layout stylesheets that hide all distracting panels, creating a clean full-screen look for editing code, painting textures, or viewing the engine.

9. **Smart Toolbar and Function Jump:** Hook up the toolbar buttons so you can easily add, save, or upload whole folders. Fix the back and forward buttons so they let you step through your file history and undo or redo actions. Populate the current filename dropdown so clicking it switches files, and make it even cooler by listing individual code blocks and functions inside that file.

10. **Layout Shifter and Share Links:** Wire up the shareable multiplayer game links, fullscreen toggle, and screen layout button. The layout button should instantly switch the app between side-by-side mode, a bottom-split terminal mode, and a stacked scrolling list designed for mobile phones using [CSS Flexible Box Layout (Flexbox)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout).
11. **Engine Controls and Canvas Protection:** Connect the play, pause, and stop buttons. The pause button should instantly freeze and swap engine behaviors using a [Dynamic WebAssembly Function Table](https://www.google.com/search?q=https://webassembly.github.io/spec/core/syntax/modules.html%23tables). Fix the stop button so it clears out old game states safely—right now, shutting down the engine completely deletes the HTML `<canvas>` element ([HTML Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)), which breaks the tool switcher. Add a clean toggle to swap back and forth between the Toji renderer and Quake 3.
12. **Unified File Menu:** Connect the entire top file menu before the [miniPaint Image Editor](https://github.com/viliusle/miniPaint) initializes, and merge its choices with the [nunuStudio Level Editor](https://github.com/tentone/nunuStudio) options. Duplicate all your main toolbar buttons into this top menu so the app stays fully usable when a mobile screen hides the main toolbar. Entire menu should take your to the correct screen display when used. i.e. uploading a code file takes you to the ace9 editor screen.


---

### Building

1. **Smart Build Scripts:** Get rid of hardcoded file lists inside `make.js`. Use an [ANTLR Grammar](https://www.antlr.org/) to read standard engine `Makefiles` directly. Then, your JavaScript build script only needs to list exceptions. This will let the app build other web projects (like Doom, Mario, or GoldSrc WASM) using the exact same interface.
2. **Smart Recompiling with Hashes:** When code compiles, object files go to specific paths. Save these by code branch. To speed things up, resolve all `#ifdef` macros and `#include` blocks into a clean text file and hash it ([Crypto Web Absolute Hashing](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)). If the hash hasn't changed between branches, skip compiling it. Only recompile the exact files changed by a feature flag.
3. **Live Variable Debugging:** Use [DWARF Debug Information](https://dwarfstd.org/) inside WebAssembly to see real variable names while the game runs. Mark debugged functions as [Emscripten Asyncify](https://emscripten.org/docs/porting/asyncify.html) routines so you can pause, unwind, and restart them at runtime.
4. **Fix the QVM Compiler Bug:** Figure out why the legacy `q3lcc` compiler outputs broken 64-byte files with missing debug lines. It is likely a standard input/output (STDIO) path bug or a virtual directory issue. Try setting up a file descriptor stack (`fd_renumber` in [WASI / POSIX Specifications](https://wasi.dev/)) to match standard Linux behavior, or try linking raw `.asm` files inside a Web Worker.
5. **Dynamic State Swaps:** When game files change, have the engine automatically pause, copy the current player's state (coordinates, health, ammo), boot a fresh virtual machine instance, and drop the player right back in without losing their place.
6. **Build Options and Map Spawner:** Wire up the build configuration panel. Connect the [WASI-SDK Compiler Toolchain](https://github.com/WebAssembly/wasi-sdk) dropdown so you can upgrade the compiler runtime with a live progress bar, untarring ([TAR File Format](https://en.wikipedia.org/wiki/Tar_(computing))) the files directly in the browser. Also, make the "current map" and "spawn point" boxes work so you can change levels instantly in both the Toji renderer and the Quake 3 engine.

---

### Features TODO

1. **Physics Engine Extraction:** Pull Quake 3’s movement and collision code out into its own standalone WebAssembly library. Connect it to [Toji's WebGL Renderer](https://github.com/toji/webgl-quake3) to handle player physics, animations, and model rendering smoothly without getting stuck on wall edges.
2. **Multi-Threaded Performance Split:** Move the heavy game simulation, rendering, and web requests off the main browser thread. Run them inside a background Web Worker using [OffscreenCanvas API](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas). Keep player inputs and sound on the frontend. To stop Cloudflare from disconnecting the [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) every 30 seconds, stagger three separate connections every 15 seconds to keep data flowing perfectly.
3. **Visual Regression Testing:** Integrate [OpenCV.js](https://www.google.com/search?q=https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) to take automated screenshots of the running game viewport to verify new code updates didn't accidentally break the graphics.
4. **In-Game 3D Printer:** Add a terminal inside the game where you can search external 3D asset libraries like [SketchFab API](https://www.google.com/search?q=https://sketchfab.com/developers/3d-viewer). It will download a model, pass it through a background, headless [Blender Script](https://docs.blender.org/api/current/info_overview.html), and pop the finished 3D object directly into the live game map.
5. **Live Map Editing via nunuStudio:** Add the open-source [nunuStudio Editor](https://github.com/tentone/nunuStudio) to your asset panel instead of trying to port heavy desktop map tools. This will let you edit `.map` files in the browser and watch the map walls move in real-time for all connected players, like a live Dungeon Master editing a VR space on the fly.
6. **Global Code Dependency Sweeper:** Build a tool using ANTLR that checks your entire codebase and highlights every global variable used outside of the file it was created in. This gives you a clear warning list of exactly what will break if you start moving files around.
7. **Spray paint live drawing:** Want to get the point where i can have the engine running next to miniPaint, and I save the image in paint and it automatically uploads it to the GPU between frames and swaps out the image in the engine using the replace texture interface. Then it streams the content to other players using the standard UDP downloads channel, without UI interruptions. This way i can spray tag on a wall, and then paint that sprayed image in real time to distract other players.


## So far


#### 6/9/2026

Trying to get offline mode working. Integrated nunuStudio more. Intercepted for menu options and undo/redo functions to show unified interface.

```bash
gcloud compute backend-buckets update quake-backend-bucket \
    --custom-response-header="Content-Security-Policy: script-src 'self' 'unsafe-eval'" \
    --custom-response-header="Cross-Origin-Opener-Policy: same-origin" \
    --custom-response-header="Cross-Origin-Embedder-Policy: require-corp"
```




#### 6/1/2026

Integrated nunuStudio. Procrastinating github commits.


![NUNU](./Screenshot%202026-06-01%20235232.png)

![NUNU2](./Screenshot%202026-06-02%20174947.png)






#### 5/21/2026

[https://quedit.quake.games/#docs/demoq3/pak0.pk3dir/maps/q3dm1.bsp]


![TOJI](./Screenshot%202026-05-21%20005134.png)



Connected miniPaint, still need to override the menu it generates and lookup IDs already on the page.
need to connect https://tentone.github.io/nunuStudio/editor/index.html
and https://github.com/pkalogiros/audiomass
Then I can prompt AI from the terminal and ask it to convert voice recording to demonic announcer sounds.
Need to tackle QVM building again and figure out whats wrong with fd_read interactions or simply change 
functions in q3lcc. If that doesn't work, i need to try and build with SHLIB parameters and link QVMs
like independent modules with publicized functions in between, slower, but might work.



#### 5/16/2026

Still fine tuning javascript build process and almost got to compiling QVMs but something is severely 
broken in final output of the qvm file. it's not a stopping point, i can still try "native"-wasm in
the browser, and i can still fallback to github CI like i had planned originally.

![BOTH](./Screenshot%202026-05-16%20140752.png)


####  5/14/2026

More build tools. QVMs nearly linking in the browser from wasms built with clang in the browser. 
Trying to harden start up process so basic commands can be run and every builds locally.


![ASM](./Screenshot%202026-05-14%20223006.png)




#### 5/9/2026

Entire engine builds and runs with clang wasm. needs to be able to save 
an entire commit to github, detect file mtime from logs, and #1 
is complete.

![Engine](./Screenshot%202026-05-09%20100538.png)



#### 5/7/2026

ace loads, treejs loads, xterm loads, no wiring between anything. 


