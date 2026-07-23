# Quedit

Quake 3 browser game editor.

## Goals/Bugs/TODO

Redoing my list of bugs because of AI slop.  My mind used to be employable. Now my memory is junk because anything that
my brain thinks Google knows, it automatically discards and can only be recalled from exact context and wording
surrounding it. I think if all of these things were done, this could be the first project where I actually consider it completed.

---

### Workspace

1. **Better GitHub Downloads:** Right now, the app splits your files into "engine", "game", and "assets". The `mount` command only downloads the file list, and code files are only downloaded when opened or compiled, this won't work in offline mode. Should be able to mount and manage unlimited repos all inside the same interface (adding quedit itself). Improve the `mount` command so it downloads your entire GitHub repository straight into the browser's permanent storage ([IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API))
2. **Sharable Coding Links:** Currently the proxy server tried to support addressing based on exact IP/port address. There is even a `hex` data type I added to cVars inside the Quake3e. Create a background [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to read remote network commands. This lets multiple people see and control the text editor cursor, send text over the wire using [Ace Editor Protocols](https://ace.c9.io/), and write code together. It will stream the live updates to players mid-game using standard game download settings (`cl_download`), so players don't have to freeze on a loading screen.
3. **Nice Git Staging UI:** Right now, saving changes to GitHub is "all or nothing." Build a clean interface to let you pick exactly which files or lines of code you want to stage and commit. Need to implement .gitignore into staging areas and also hidden files display that shows the full database inline with the repo instead of only showing the github tree.
4. **Proxy Sync vs. Quake 3 Networking:** Currently there is code to open a new tab when the player walks through a portal. Cooler to use Quake 3's built-in 3D physics syncing to pass text changes back and forth, or if a standard web proxy server is enough. The ultimate goal: make code settings show up as real physical switches in the 3D game world. You walk up to a wall, flip a switch for "homing rockets," and the game instantly recompiles the code and turns the feature on without stopping.
5. **Connected Terminal and AI Chat:** Link the developer command line tool directly to the running game engine. Connect the AI chat box to it so it can read errors and filter out junk data. Make map load commands and player teleport settings work inside the Toji physics code, and make sure remote control commands (`rcon`) work perfectly on the [Quake 3 Engine Core](https://github.com/ec-/quake3e).
6. **ANSI Status HUD and Clickable History:** Currently the CLI Render tab shows the canvas in ANSI with misaligned and invisible resize decorations. Render redraw doesn't work well due to line wrapping. Turn the terminal layout into a movable, double-clickable window system that displays a retro, text-based ANSI graphics display. Instead of relying purely on regular keyboard inputs, show recent command history in a draggable, mouse-interactive list utilizing [Xterm.js Mouse Tracking Protocols](https://xtermjs.org/docs/api/terminal/interfaces/imodes/). Add live popups that display core game metrics like frame rates (FPS), ping, active team lists, and player counts.
7. **Mirrored Game Console:** Make sure the dedicated web console tab displays the exact same scrolling log text as the native in-game engine console.
8. **Full-History Deep Search:** Fix the search box so it doesn't just scan the code lines visible on your screen. Expand the lookups so they scan through your entire terminal history.
9. DONE: **Lazy-Loading Folder Trees:** Stop using the heavy recursive query flag (`?recursive=1`) on the [GitHub Git Trees API](https://docs.github.com/rest/git/trees) for the assets tree view. Since there are hundreds of media assets, optimize it to load folder contents one layer at a time, exactly like a standard database query.
10. **Terminal-to-Tree Navigation Sync:** Fix a descending error where opening a file directly from the command line fails to expand the file tree sidebar all the way down to that file. Fix the state loop so that once the parent folders load up, the hierarchy explicitly resets its target focus directly onto the active file (`tree.value = [currentFile]`).
11. **Isolated File Tree Selection:** Fix file highlighting in the sidebar. Disable the default [TreeJS Selection Overrides](https://www.google.com/search?q=https://cloudfour.com/thinks/a-guarded-defense-of-the-tree-view/) that automatically highlight every single sub-file when a parent folder expands. Restructure the selection handlers so clicking a folder only targets that specific folder, keeping the "Add File" and "Rename" buttons working properly.
12. DONE: **OFFLINE MODE!** I have a worker in quake3e-portals branch and in Atrium that I did more work on from the portals branchs originally. This has a special caveate that the whole environment is also editable and needs to upgrade itself.
13. **Load local environment javascripts** like core/ (anything other than module.js) off of the IDB store instead of from the webserver. Should install itself into IDB and offline mode first time the page loads.
14. **FileSystemAccess API** for loading game assets directory or github stores directly off the file system, so we aren't copying those files twice into the IDB.


---

### Interface

1. **Instant Code Hot-Reloading:** When you press `CTRL+S`, the browser should instantly recompile just that piece of code. It should either swap the running function inside a live [Virtual Method Table](https://en.wikipedia.org/wiki/Virtual_method_table) or restart that specific sub-component on a separate thread so the game canvas never freezes.
2. **Smart Asset Search:** Fix search so it doesn't just look for raw text. It needs to look for "known" game files like shader names and map textures, showing a smart list of where assets are actually used across GitHub and local storage.
3. **Fix File Name Collisions:** Right now, the engine and the game both use different files named `q_shared.h`. When you compile them together, they crash into each other. Fix this by giving every project its own isolated root folder inside IndexedDB so the virtual file system (`FS.virtual[path]` in [Emscripten File System](https://emscripten.org/docs/api_reference/Filesystem-API.html)) sees unique names.
4. **Code Maps with ANTLR:** Use the [ANTLR Parser](https://www.antlr.org/) to read code files, pull out function names, and build a clickable table of contents under your file list. If you `CTRL+Click` a function, the editor jumps straight to where it was written.
5. **Back/Next Navigation:** Wire up the browser's back and forward buttons to navigate through your open code files. Merge this with a unified undo/redo system for both text editing and texture painting.
6. DONE: **Fix miniPaint Shortcuts:** Stop the [miniPaint](https://github.com/viliusle/miniPaint) drawing tool from stealing keyboard shortcuts when you are working in a different code tab. Only listen to it when its specific tab is open.
7. **Scratchpad File Interception:** Block miniPaint's default "Open File" popups. Route any uploaded files into a temporary sandbox folder (`idb://scratchpad`) so they don't mess up your active workspace until you hit save.
8. **Zen Mode Layouts:** Build absolute layout stylesheets that hide all distracting panels, creating a clean full-screen look for editing code, painting textures, or viewing the engine.

9. **Smart Toolbar and Function Jump:** Hook up the toolbar buttons so you can easily add, save, or upload whole folders. Fix the back and forward buttons so they let you step through your file history and undo or redo actions. Populate the current filename dropdown so clicking it switches files, and make it even cooler by listing individual code blocks and functions inside that file.

10. **Layout Shifter and Share Links:** Wire up the shareable multiplayer game links, fullscreen toggle, and screen layout button. The layout button should instantly switch the app between side-by-side mode, a bottom-split terminal mode, and a stacked scrolling list designed for mobile phones using [CSS Flexible Box Layout (Flexbox)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout).
11. **Engine Controls and Canvas Protection:** Connect the play, pause, and stop buttons. The pause button should instantly freeze and swap engine behaviors using a [Dynamic WebAssembly Function Table](https://www.google.com/search?q=https://webassembly.github.io/spec/core/syntax/modules.html%23tables). Fix the stop button so it clears out old game states safely—right now, shutting down the engine completely deletes the HTML `<canvas>` element ([HTML Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)), which breaks the tool switcher. Add a clean toggle to swap back and forth between the Toji renderer and Quake 3.
12. **Unified File Menu:** Connect the entire top file menu before the [miniPaint Image Editor](https://github.com/viliusle/miniPaint) initializes, and merge its choices with the [nunuStudio Level Editor](https://github.com/tentone/nunuStudio) options. Duplicate all your main toolbar buttons into this top menu so the app stays fully usable when a mobile screen hides the main toolbar. Entire menu should take your to the correct screen display when used. i.e. uploading a code file takes you to the ace9 editor screen.
13. **Terminal Autocomplete:** Similar to the quake3e console auto-complete, every path and command should be completable or offer a list of suggestions when TAB is used/twice? Additionally I added levenstein auto-correcting to the TAB auto-complete in case somebody types a name wrong it shows alternaive nearby spellings for the path they might have intended, even if they already typed past the word.
14. **Search Reverse Index:** Basically the most extreme form on ANTLR tokenization takes all the named tokens and builds a list of files where the token exists, so if you search for a file, it can quickly match partial or mispelled tokens, and slowly match full text searching with a closeness ranking, but even better if you search for the token it will return a complete list of files where the token exists.


---

### Building

1. **Smart Build Scripts:** Get rid of hardcoded file lists inside `make.js`. Use an [ANTLR Grammar](https://www.antlr.org/) to read standard engine `Makefiles` directly. Then, your JavaScript build script only needs to list exceptions. This will let the app build other web projects (like Doom, Mario, or GoldSrc WASM) using the exact same interface.
2. **Smart Recompiling with Hashes:** When code compiles, object files go to specific paths. Save these by code branch. To speed things up, resolve all `#ifdef` macros and `#include` blocks into a clean text file and hash it ([Crypto Web Absolute Hashing](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)). If the hash hasn't changed between branches, skip compiling it. Only recompile the exact files changed by a feature flag.
3. **Live Variable Debugging:** Use [DWARF Debug Information](https://dwarfstd.org/) inside WebAssembly to see real variable names while the game runs. Mark debugged functions as [Emscripten Asyncify](https://emscripten.org/docs/porting/asyncify.html) routines so you can pause, unwind, and restart them at runtime.
4. **Fix the QVM Compiler Bug:** Figure out why the legacy `q3lcc` compiler outputs broken 64-byte files with missing debug lines. It is likely a standard input/output (STDIO) path bug or a virtual directory issue. Try setting up a file descriptor stack (`fd_renumber` in [WASI / POSIX Specifications](https://wasi.dev/)) to match standard Linux behavior, or try linking raw `.asm` files inside a Web Worker.
5. **Dynamic State Swaps:** When game files change, have the engine automatically pause, copy the current player's state (coordinates, health, ammo), boot a fresh virtual machine instance, and drop the player right back in without losing their place.
6. **Build Options and Map Spawner:** Wire up the build configuration panel. Connect the [WASI-SDK Compiler Toolchain](https://github.com/WebAssembly/wasi-sdk) dropdown so you can upgrade the compiler runtime with a live progress bar, untarring ([TAR File Format](https://en.wikipedia.org/wiki/Tar_(computing))) the files directly in the browser. Also, make the DONE: "current map" and "spawn point" boxes work so you can change levels instantly in both the Toji renderer and the Quake 3 engine.

---

### Features TODO

1. **Physics Engine Extraction:** Pull Quake 3’s movement and collision code out into its own standalone WebAssembly library. Connect it to [Toji's WebGL Renderer](https://github.com/toji/webgl-quake3) to handle player physics, animations, and model rendering smoothly without getting stuck on wall edges.
2. **Multi-Threaded Performance Split:** Move the heavy game simulation, rendering, and web requests off the main browser thread. Run them inside a background Web Worker using [OffscreenCanvas API](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas). Keep player inputs and sound on the frontend. To stop Cloudflare from disconnecting the [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) every 30 seconds, stagger three separate connections every 15 seconds to keep data flowing perfectly.
3. **Visual Regression Testing:** Integrate [OpenCV.js](https://www.google.com/search?q=https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) to take automated screenshots of the running game viewport to verify new code updates didn't accidentally break the graphics.
4. **In-Game 3D Printer:** Add a terminal inside the game where you can search external 3D asset libraries like [SketchFab API](https://www.google.com/search?q=https://sketchfab.com/developers/3d-viewer). It will download a model, pass it through a background, headless [Blender Script](https://docs.blender.org/api/current/info_overview.html), and pop the finished 3D object directly into the live game map.
5. **Live Map Editing via nunuStudio:** DONE: Add the open-source [nunuStudio Editor](https://github.com/tentone/nunuStudio) to your asset panel instead of trying to port heavy desktop map tools. This will let you edit `.map` files in the browser and watch the map walls move in real-time for all connected players, like a live Dungeon Master editing a VR space on the fly.
6. **Global Code Dependency Sweeper:** Build a tool using ANTLR that checks your entire codebase and highlights every global variable used outside of the file it was created in. This gives you a clear warning list of exactly what will break if you start moving files around.
7. **Spray paint live drawing:** Want to get the point where i can have the engine running next to miniPaint, and I save the image in paint and it automatically uploads it to the GPU between frames and swaps out the image in the engine using the replace texture interface. Then it streams the content to other players using the standard UDP downloads channel, without UI interruptions. This way i can spray tag on a wall, and then paint that sprayed image in real time to distract other players.
8. 100% must show all the overlapping audio inside AudioMass as it is being played in the engine so somebody could pause the engine side and see all the effects sounds lined up to their current start offset marker with some positional (x,y,z) attributes noted inside audioMass effects so that audioMass reflects the same transformations that Quake3 is current running. that would be sick to see/hear the rocket fly past and have an audioMass capable view of that wave while it is going off into the distance.
9. Make the editor download nunuStudio, audioMass, miniPaint, etc, patch itself into the libraries by interpreting the JS code, and finding the window attachments, and adding window attachments for structural control over menus.

Need to implement all of these features as well:
3rdparty\wasm-git-master.zip
3rdparty\assimpjs-main.zip
3rdparty\githttpserver-master.zip
3rdparty\magick-wasm-main.zip
3rdparty\opentype.js-master.zip
3rdparty\toywasm-master.zip



## So far

---


#### 7/10/2026

Adding lumino interface for layout management. some of the TODO tasks above don't really make sense without it.

![Lumino](<Screenshot 2026-07-08 225309.png>)


#### 6/13/2026

I like this list from Gemini. These are really good ideas, and the image coallescing touches on something quake 3 engine suffers from.
Most IDEs lack "Interactive AST & Abstract Config Graph Tree Nodes"


When looking for solid, studio-grade tools to drop into a web ecosystem, you want things that compile neatly down to pure client-side execution (WASM/JS) and provide deep visual context.

Here is the exact landscape for WASM/JS decompilers, followed by the specific structural tools your platform needs to rival enterprise setups like Unreal or Visual Studio.

---

##### 1. Studio-Style WASM & JS Decompilers

For a professional web workspace, you do not want to write a raw static decompiler yourself. You should leverage tools that have been compiled into WASM modules so they run locally inside your app's service workers or main threads.

###### The Standard: WABT (`wasm-decompile`)

The WebAssembly Binary Toolkit (**WABT**) by the Bytecode Alliance is the gold standard.

* **How it works:** It has been fully compiled to JS/WASM via Emscripten.
* **What it does:** Instead of converting raw binary into hard-to-read, deeply nested S-expressions (`.wat`), it translates `.wasm` into a readable, expression-based, **C-like pseudo-syntax**. It automatically scans loads and stores to infer layout pointers and prints them out like inline objects.
* **Implementation:** You can pull the official `wabt.js` build directly into your front end, pass it a `Uint8Array`, and output completely decompiled code directly into an Ace Editor session configured for C-style syntax highlighting.

###### The JavaScript Equivalence: Prettier + Escodegen

For raw JavaScript files that are heavily minified or obfuscated:

* Combine a fast abstract syntax tree (AST) parser like **Merdian** or **Acorn** with **Escodegen** to reconstruct the structural layout.
* Pipe the result directly into an embedded instance of **Prettier**'s standalone browser build. This instantly normalizes messy script sheets into highly uniform, readable source code trees.

---

##### 2. Competitive "Studio Viewers" to Blow Past the Competition

If your web engine is going to compete with established studios, it needs to move beyond simple plain-text editing. It needs specialized visual layers for standard game assets.

By adding the following five panels into your dashboard interface, you can elevate your app from a basic code editor into a full-scale game suite:

###### 📊 1. Memory, Heap & Arena Budget Trackers

When modders assemble assets or maps, they often crash engines because they overflow allocations (like max textures, max brushes, or max entities).

* **The Visual Feature:** A dynamic, color-coded stack bar chart showing memory consumption.
* **How to build it:** Scan `.bsp` files for lump headers or inspect `.map` string structures to count structural arrays (e.g., entity counts, surfedges, visibility matrices). Display these allocations using a clean, responsive gauge dashboard. This lets designers quickly see if their changes approach engine limitations.

###### 🖼️ 2. Dynamic 2D Texture Atlas & Sprite Packing Sheets

* **The Visual Feature:** A visual container that displays image directories packed neatly into uniform texture maps.
* **How to build it:** Since you are already integrating image layers, combine them with an open-source, client-side bin-packing algorithm (like `maxrects-packer`). This allows users to drop a folder of loose PNG assets and instantly watch them snap together into an optimized texture sheet, complete with auto-generated JSON coordinates for their engine shaders.

###### 📜 3. Interactive AST & Abstract Config Graph Tree Nodes

* **The Visual Feature:** A node-graph layout canvas (similar to Blueprint or Material editors in Unreal) that maps out logical relationships.
* **How to build it:** Use a library like **Rete.js** or **Litegraph.js**. You can use your custom ANTLR grammars to parse `.cfg` configuration systems, entity chains, or complex Quake scripts. Instead of forcing users to read raw text strings, render them as connected visual node trees. For instance, you could show a map's target entities linking directly to their trigger source blocks.

```
 [Trigger_Once Entity] ──(target)──> [Target_Speaker Entity]

```

###### 🔈 4. Web Audio API Waveform & Loop Node Visualizers

Audio assets are often overlooked in web suites, but they are crucial for game feel.

* **The Visual Feature:** Interactive waveform bars equipped with drag-and-drop region markers to define looping points.
* **How to build it:** Use **Wavesurfer.js**. It hooks directly into the browser's Web Audio API and runs completely on the client side. When a user opens a `.wav` file, it calculates and displays the acoustic amplitude array. You can overlay boundary flags directly onto the timeline to visually read and write the exact frame data markers required for game engine loop parameters.

###### 🌐 5. Package Inspector & Virtual ZIP/PK3 File Trees

* **The Visual Feature:** A nested file directory sidebar that allows users to peek inside compressed packages without manually downloading or extracting them first.
* **How to build it:** Integrate **FFlate** or **JSZip**. When a modder drags a `.pk3` archive into the interface, you can instantly read its header indexes in memory. This lets users traverse deep internal folder paths (`/maps/`, `/textures/`, `/scripts/`) and view individual file contents on demand. Combining this with your new `AssetInspector` allows users to seamlessly preview images, view scripts, or load 3D viewports directly from compressed archives.




#### 6/11/2026

I added this wave form editor called AudioMass, because i am procrastinating what i really have to fix. File name collisions in make.js, make-qvms.js, and i got this list of top priorities from Gemini.


![audiomass](Screenshot%202026-06-11%20145546-1.png)


This is what gemini thinks i should be doing in addition to that build file collision bug, and i tend to agree, this would be very cool.


Looking at this backlog, you aren’t just building an IDE or a game engine—you are building a **live, self-bootstrapping development operating system inside a browser tab**.

When a project reaches this level of complexity—where a user is actively writing code, recompiling WebAssembly, streaming assets, and running a 3D physics simulation simultaneously—the traditional definitions of "User Experience" (like slick animations or button placements) go out the window. Here, UX protection means **preventing data loss, eliminating execution freezes, and making the platform resilient when the network drops.**

If you want to protect the user experience above all else, these are the top 3 highest-leverage architectural contributors from your backlog:

---

##### 1. OFFLINE MODE! (IndexedDB Bootstrapping + Service Workers)

> **Backlog items:** *OFFLINE MODE!, Load local environment javascripts off of the IDB store, Better GitHub Downloads.*

If a user opens their phone to write a game while sitting in a grocery store parking lot or on a flight, a single network drop cannot be allowed to crash or lock up the IDE workspace.

* **Why it's a UX lifesaver:** True UX protection means the environment is *invincible* to connectivity states. By shifting your entire asset tree, your repository files, `index.html`, and `modules.js` into **IndexedDB (via a robust Service Worker caching layer)**, your app fundamentally ceases to be a web page and becomes an installed desktop/mobile OS.
* **The UX Win:** Zero loading screens when transitioning between environments, instantaneous file tree rendering (eliminating the slow GitHub API roundtrips), and the absolute certainty that hitting save won't discard a chunk of work into a network black hole.

##### 2. Multi-Threaded Performance Split (OffscreenCanvas + Web Workers)

> **Backlog items:** *Multi-Threaded Performance Split, Sharable Coding Links via background Workers.*

In a single-threaded web architecture, if the Quake 3 engine compiles a complex shader, or an asset download takes a massive memory spike, the main browser thread hitches. For a user, a hitched main thread means the Ace Editor text cursor stops blinking, typing lags, and the UI feels broken or unresponsive.

* **Why it's a UX lifesaver:** By decoupling the application using the **OffscreenCanvas API** and background Web Workers, you isolate the heavy lifting. The game loop, physics engine, and network synchronization stream happen on a secondary thread. The main thread is left 100% unencumbered to handle user input, mouse tracking via Xterm.js, text input in Ace, and UI dropdown transitions.
* **The UX Win:** Perfect, unthrottled input responsiveness. Even if the game engine drops frames or pauses to reallocate memory hooks, the user can still fluidly type code, browse folders, or chat with the AI without a single micro-stutter.

##### 3. Dynamic State Swaps & Instant Hot-Reloading

> **Backlog items:** *Dynamic State Swaps, Instant Code Hot-Reloading, Spray Paint Live Drawing.*

The absolute ultimate killer of developer experience is the "break-mended-reboot" cycle. If a user modifies a character's jump height or changes a wall texture in miniPaint, forcing them to recompile, reload the tab, navigate the main menu, and walk back to the test zone completely shatters their flow state.

* **Why it's a UX lifesaver:** Implementing the virtual method table hot-swapping and memory snapshotting (saving player coordinates, health, and state vectors before booting a fresh WASM instance) turns your environment into an organic, live system.
* **The UX Win:** Immediate gratification and continuity. The experience shifts from "writing code for a game" to "molding a live universe." Saving an image in miniPaint or tweaking a velocity variable instantly alters the 3D viewport between frames, keeping the creator entirely locked in the zone without UI interruptions or state resets.

---

##### The Verdict

While having an ANSI HUD or a nice Git staging UI is great, **Offline Resilience, Input Thread Isolation, and Live Hot-Reloading** are the foundational structural columns. If you nail those three, your environment will feel tighter, faster, and more dependable than native desktop setups.



#### 6/9/2026

Trying to get offline mode working. Integrated nunuStudio more. Intercepted for menu options and undo/redo functions to show unified interface.

```bash
gcloud compute backend-buckets update quake-backend-bucket \
    --custom-response-header="Content-Security-Policy: script-src 'self' 'unsafe-eval'; worker-src 'self' blob:;" \
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


