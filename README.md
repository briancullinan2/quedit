# Quedit

Quake 3 browser game editor.

## Goals
This master blueprint consolidates your comprehensive development backlog with our previous architectural breakthroughs—including the dynamic console preambles, polymorphic diagnostics, formal `workspaceFileId` session cache bindings, and the automated `OpenCV.js` visual regression refactoring pipeline.

---

## 1. Virtual Workspace & P2P Core

*Foundational layer for multi-directory mounting, sandboxed build mechanics, and live collaboration.*

### 1.1 URI-Qualified File System Abstraction

* **Goal:** Shift the assets pane from flat relative naming to a multi-root mounting pipeline matching VS Code's project model.
* **Cascading Actions:**
* Implement root mounting array handlers for `github://`, `idb://workspace`, `idb://scratchpad`, and `local://` via the browser's File System Access API.
* DONE: Update the `getOrCreateAceSession(fileId, content)` constructor to formally enforce unique `session.workspaceFileId = fileId` properties across all mounted protocol schemes.



### 1.2 Programmatic Build Automation via `Make.js`

* **Goal:** Replace static compiler dropdown forms with fully executable pipeline code stored directly in user workspaces.
* **Cascading Actions:**
* Expose an isolated runtime context to evaluate a workspace `Make.js` script inside a web worker wrapper.
* Bind the worker thread directly to the in-browser `wasi-sdk` Clang layer to compile C files out of IndexedDB binary vectors into hot-swappable target payloads.
* Integrate Binji's raw WASM asset-loading and linking logic into the output pipeline for seamless artifact delivery.

Heard loud and clear. Let's strip away the philosophical filler, drop the "sovereign" framing, and lock the title down to what it mechanically is: a multi-user, engine-driven distributed workspace.


---


## 1.3 Distributed Editor Synchronization

* **Goal:** Eradicate heavy browser web-protocols and OT complexity. Leverage Quake 3's native delta-compressed network snapshot engine (`sv_snapshot`) to synchronize multi-user cursor coordinates, active code line mutations, and real-time compilation state distribution across a 3D workspace.

---

#### 1.3.1 Entity-Bound Cursor & Token Replication
* **Objective:** Map remote user typing vectors, selections, and editor interactions into native server-authoritative entities.


```

[Remote Ace Editor Session]
│ (On Change / Keystroke)
▼
[Client Input Command Engine] ──(clc_t via netchan)──► [Authoritative Server Instance]
│
[sv.snapshot Loop Engine]
│
[Local Ace Cache Update Layer] ◄──(entityState_t)──────[Client Snap Decode Loop]

```

* **Data Structure Definition:**
  Extend `entityState_t` inside `q_shared.h` with dedicated network fields using an explicit bitmask layout to minimize packet sizes:
```c
  typedef struct {
      int entityNum;
      int eType;              // ET_EDITOR_CURSOR or ET_TEXT_TOKEN
      trajectory_t pos;       // 3D position of cursor in spatial workspace
      
      // Editor state packaging (Delta-compressed fields)
      int clientNum;          // Owning programmer index
      int activeFileIdHash;   // CRC32 of workspaceFileId URI
      int cursorRow;          // Active line row index
      int cursorCol;          // Active line column index
      int selectionLength;    // Selection bounds length tracking
  } entityState_t;

```

* **Technical Execution Sequence:**
1. **Input Interception:** Trap the Ace `changeCursor` and `changeSelection` listener loops on the frontend. Pass the character offset values directly to the client network channel as un-reliable input moves (`usercmd_t`).
2. **Server State Allocation:** The server tracks each programmer as a persistent entity block. When a snapshot updates, the server calculates spatial trajectory updates using `BG_PlayerMove` logic so that the cursor models hover perfectly in front of the floating 3D matrix panels.
3. **Snapshot Broadcast:** The server pipes the entity mutations through `SV_WriteSnapshotToClient`, running native bit-packer macros (`MSG_WriteBits`) to strip out un-mutated positional fields.



---

#### 1.3.2 Delta-Compressed Line Synchronization

* **Objective:** Treat text rows as distinct, state-tracked net-entities to resolve collision updates and sync states natively over standard server frames.
* **Data Structure Definition:**

```c
  #define MAX_LINE_BUFFER_PACKET 64

  typedef struct {
      int lineEntityNum;      // Unique spatial row reference ID
      int fileIdHash;         // Owner document identifier tag
      int rowNumber;          // Zero-indexed row inside the document cache
      int revisionSequence;   // Monotonically increasing edit marker
      char textPayload[MAX_LINE_BUFFER_PACKET]; // Huffman-encoded characters
  } textLineEntity_t;

```

* **Technical Execution Sequence:**
1. **Row Entity Registration:** Map long files into dynamic linear arrays of entities. Each individual text row becomes an independently tracked network entity bound to a physical vector location in the 3D grid layout.
2. **Authoritative Conflict Resolution:** When multiple players modify an identical row range simultaneously, the client frames submit their requested updates via standard network execution command packets. The server serializes execution order on a per-frame basis, modifying its primary state layer and overriding out-of-order mutations.
3. **Environmental Physics Collisions:** If an in-game asset (such as a rocket explosion projectile) collides with a text token model floating inside the level boundaries, the server's `G_RunThink` loop detects the impact. It calculates string destruction parameters, mutates or truncates the `textPayload` vector, and passes the dropped line indices back down to the local editor session cache pools instantly via `cl.snap`.



---

#### 1.3.3 Verifiable Cache Verification & Hot Rebuilds

* **Objective:** Secure cryptographic verification on active document trees to calculate dirty targets and execute dynamic WASM hot-reloads without disconnecting clients.

```
  [Local Text Buffer Change] ──► [Compute Web Crypto SHA-256]
                                              │
                                     (Mismatch Detected)
                                              ▼
                                 [Query IndexedDB .o Cache]
                                              │
                                 [wasi-sdk Isolated Rebuild]
                                              │
                                 [Dynamic Link (.wasm Target)]
                                              │
                                 [Hot-Swap WebAssembly Memory]

```

* **Technical Execution Sequence:**
1. **Cryptographic Validation Tracking:** Bind a sub-hash monitor tracking layer straight to the file system core. Whenever a text line entity registers a complete modification pass, calculate an instantaneous SHA-256 string vector across the parent file scope using the browser's native `crypto.subtle.digest` pipeline.
2. **Object File Dependency Mapping:** Maintain a structured compilation manifest dictionary inside IndexedDB linking explicit source file chains directly to their pre-compiled compilation output blocks:



```javascript
{
    "src/game/g_weapon.c": {
        "sourceHash": "a1b2c3d4...",
        "objectFilePath": "idb://build/obj/g_weapon.o"
    }
}
```

  3. **Targeted Translation Recompiles:** Compare the newly modified runtime hash against the database storage record. If a variance flags a translation unit as dirty, bypass the global project tree entirely and run an isolated `wasi-sdk` worker compiler task targeting exclusively that file.
  4. **Dynamic WebAssembly Linking:** Feed the unmodified static `.o` files from the cache index directly into the linker step alongside the newly generated object artifact. Output a single dynamically linked asset binary, pause the engine thread for a single frame execution gap, and hot-swap the execution memory block seamlessly.

---

#### 1.3.4 Distributed Git Asset Layer
* **Objective:** Eliminate remote repository hosting dependencies. Re-architect version control operations as distributed game-state snapshots stored inside localized database nodes.

* **Data Structure Definition:**
```javascript
  // IndexedDB Git Object Storage Object Schema
  db.createObjectStore("git_objects", { keyPath: "sha" });
  db.createObjectStore("git_refs", { keyPath: "refName" });

```

* **Technical Execution Sequence:**
0. Fix all relative directories so files like qcommon/q_shared.c which is different in both repos don't collide. Problems downloading files from multiple potential sources, need to end up in the right virtual directory and path/key on IDB
1. **Immutable Blob Generation:** When a developer triggers a commit sequence from the game console or editor workspace, decompose the active workspace directory structure down into standardized Git format objects (`blobs`, `trees`, and `commits`). Serialize these object blocks as binary arrays directly into the `git_objects` store.
2. **Dynamic Game World Forking:** Treat branch switching actions as an alternate spatial game world load operation. When switching branches, update the target record under `git_refs`, clear out current workspace sessions, extract the directory structural layout matching the checkout snapshot, and populate the active `sessionCache` keys.
3. **P2P Branch Packages:** To push or share workspace histories with other developers connected via the network, package missing commit arrays into standard sequential chunk strings. Pipe them directly through the engine's un-reliable snapshot packaging layer, allowing alternative developer nodes to rebuild chronological histories locally inside their own isolated tracking states.


---

## 2. Low-Level WASM, AST Analysis & Compiler Diagnostics

*Fixing native compiler asset paths, tracing global state leakage, and routing diagnostic streams.*

### 2.1 Static Analysis Scope & Global State Coupling Analyzer

* **Goal:** Run ANTLR within the browser to isolate systemic dependencies and structural breakdown risks before physical code reorganization.
* **Cascading Actions:**
* Deploy an ANTLR worker thread configured with standard C/C++ grammars to construct an editor-wide Abstract Syntax Tree (AST).
* Compile an exhaustive cross-reference ledger tracking every global variable used outside its true declaring definition file.
* Expose this structural graph directly to the diagnostic bridge interface to flag high-risk coupling.



### 2.2 Native Code Generation & `q3lcc`/`q3asm` Pipeline Debugging

* **Goal:** Remediate line-information omission errors and directory relative tracking issues inside the bytecode assembly toolchain.
* **Cascading Actions:**
* Fix the compiler's current working directory (CWD) path-resolution loop inside the virtual file system layer to ensure `.loc` directives emit properly into intermediate files.
* Implement an explicit file descriptor stack (`fd_stack`) using WebIDL hooks to manage POSIX compatible `fd_renumber` constraints down to descriptor `0`.
* Refactor the compiler link worker to bulk-open raw arrays of pre-manufactured `.asm` files simultaneously to determine if structural drops stem from `q3rcc` segmentation faults or missing symbol headers.



### 2.3 Shared Movement Mechanics Dynamic Module

* **Goal:** Decouple character collision and physics calculation blocks out into an isolated compilation unit.
* **Cascading Actions:**
* Compile `bg_pmove.c` as a standalone WebAssembly dynamic module using `-Wl,--no-entry` and concealed global symbol mappings.
* Import and link the resulting target array into Toji’s specialized WebGL renderer loop, guaranteeing perfectly matched client-side client prediction mechanics.



---

## 3. High-Performance Multithreading Architecture

*Decoupling internal game engine states from browser UI operations to maximize compute headroom.*

### 3.1 Offscreen Canvas Subsystem Extraction

* **Goal:** Isolate raw game mechanics execution to secure a minimum 10% processing drop, maximizing compute headroom for specialized positional audio rendering.
* **Cascading Actions:**
* Migrate `cgame` client prediction routines, renderer backends, and networking protocols out of the main execution scope and into a dedicated background worker thread.
* Transfer rendering control entirely to an `OffscreenCanvas` container instance, feeding direct hardware input vectors from the primary loop to the background worker via low-latency `SharedArrayBuffer` vectors.
* Isolate the primary browser thread exclusively to manage direct DOM layout renders, `xterm.js` terminals, and high-priority spatial sound distribution channels (`S_Spatialize`).



---

## 4. Live Reality "God Mode" World Layers

*Merging visual layout regression tools, network asset generation, and interactive map manipulation blocks directly into a running universe.*

### 4.1 Automated Visual Refactoring Pipeline (Polymorphic Diagnostics Integration)

* **Goal:** Build a visual optimization system that alters cascading layouts, groups components, and hoists style overrides while verifying zero rendering breakage.
* **Cascading Actions:**
* Extend `DiagnosticsBridge.prototype.processAnnotations` to use the modular `DIAGNOSTIC_PARSERS` registry array, shifting gracefully between `.c`, `.shader`, and `.skin` log streams.
* Configure `OpenCV.js` (WASM) to execute visual validation passes using `cv.absdiff()` and `cv.countNonZero()` pixel analysis over hidden sandbox `iframe` captures during style modifications.
* Deploy automated AST restructuring passes to systematically extract variable themes, bundle repeating selector blocks, and merge media query rules to the bottom of target files.



### 4.2 Modular State Preservation & Dynamic Module Hot-Swapping

* **Goal:** Exchange active WebAssembly engine layers instantly mid-game without forcing the client out of the environment.
* **Cascading Actions:**
* Design a binary state snapshot struct (`engineStateSnapshot_t`) inside linear memory to capture explicit orientation, velocity vectors, equipment flags, and client variables.
* Implement a state-serialization script that preserves this memory layout, terminates the active target module instance, instantiates the updated build artifact, and passes the state back to the initialized loop.



### 4.3 Networked MAP Editing & Real-Time Geometry Injection

* **Goal:** Introduce a real-time world construction interface allowing users to adjust operational maps and inject physical assets live across active clients.
* **Cascading Actions:**
* Integrate a web-native `.map` geometry editor directly into the workspace tools to modify plane dimensions and brush entity properties.
* Rebuild engine leaf nodes on the fly to stream geometry changes to all active players over P2P data links.
* Build an in-game 3D printer module that connects to external open asset APIs (like SketchFab), passes downloaded elements through a specialized headless Blender script, and injects the resulting objects directly into the live map space.



---

## 5. UI Ergonomics & Zen Alignment

*Polishing user interfaces, input boundaries, and tracking history stacks.*

### 5.1 Event Listener Scoping & Temporary Scrapyard Databases

* **Goal:** Standardize workspace interface boundaries and prevent development artifacts from cluttering clean source repositories.
* **Cascading Actions:**
* Bind `miniPaint` keyboard and shortcut listeners to fire exclusively when its specific workspace tab is active.
* Override default browser `Open File` and `Open Directory` commands, routing target files to a temporary workspace storage space (`idb://scratchpad`) until explicit save events fire.
* Build a unified user history bus that aggregates global workspace undo/redo actions across code editing buffers and paint canvas states.
* Configure absolute layout distraction-free "Zen" styling sheets for code views, drawing tools, and engine display frames, overriding standard back/next navigation controls to move sequentially through active project paths.



## So far


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


