# Quedit

Quake 3 browser game editor.

## Goals

1) edit a file and auto-recompile using wasi-sdk in the browser.
2) pop a new engine in the exact same place/state player was before.
3) sharable network multiplayer links to current shared coding session.
4) search all map/local/shared content
5) git repository management, updating, branching, publishing

6) it might be interesting to implement a split mode where cgame, 
renderer and networking run in a worker with a "background canvas"
and the client with inputs sends directly to server, maintaining
cgame state, with only the input branches computed on front end
this could shave off another 10% in compute, leaving more room
for S_Spatialize

7) More of a general TODO item, make the filelist open anything in the assets pane
VS Code allows you to add multiple directories to a project.

8) More importantly, add custom build configurations, basically commit a Make.js
file to your IDB store or Github and then the build configuration evals the JS
code to build whatever .wasm the user wants straight from source. i.e. make my
default Ace9 text that pops up actually runable. also merge in the rest of 
binjis demo for posterity.

9) Minor UX bugs, not to lose track, remove keyboard listener from miniPaint 
until the tab is selected and refire. Similarly, override Open File and 
Open Directory to upload to our IDB storage instead of directly into paint
Maybe a new database for temporary junk until it gets an official save function?
Override multiple full screen modes for editor, paint, engine, so they all have
a "zen" layout. fix navigation back and next browser buttons to navigate code files
and change in UX back and next buttons to be undo buttons and merge with miniPaints
undo button, add redo?

10) Just thought of this one today with Iga, have a 3D printer in game when you 
activate it with an in game search UI you select a model from SketchFab or 
somewhere and download the model and process it with my blender script and
then import it into the game while players are connected.

11) major - componentize. build a tool inside the browser that can run an ANTLR 
script to show every global variable thats used NOT in the file that it's defined in.
that way i have a list of exactly how my app could break if i only move files around.

12) add quake 3 .map format to https://tentone.github.io/nunuStudio/editor and add that
as the map editor instead of trying to port Trench Broom to WebAssmebly. it would be 
amazing to edit BSP/MAP files directly and have the geometry update in the engine for 
networked players, like a GOD mode terrain editor that the dungeon master can change
while the players are connected in VR. welcome to my f**ked up reality, it already
exists, we all know the name lucifer.

13) Need to figure out whats wrong with QVM writing from q3lcc, i remember there being
some really obvious file system bug where the CWD has to the output directory or 
something. Gemini also suggested I try using a FD stack for fd_renumber to => 0
to make it more compatible with posix but i don't know what my .asm output doesn't
include line information like the native compiler does, i wonder if it would like if 
i opened the whole directory of .asm files inside the worker and then tried to link
the premanufactured ones, then i know its a bug in q3rcc.


## So far

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


