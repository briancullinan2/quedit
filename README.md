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


