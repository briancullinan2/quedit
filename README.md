# Quedit

Quake 3 browser game editor.

## Goals

1) edit a file and auto-recompile using wasi-sdk in the browser.
2) pop a new engine in the exact same place/state player was before.
3) sharable network multiplayer links to current shared coding session.
4) search all map/local/shared content
5) git repository management, updating, branching, publishing

## So far


#### 5/9/2026

Entire engine builds and runs with clang wasm. needs to be able to save 
an entire commit to github, detect file mtime from logs, and #1 
is complete.

![Engine](./Screenshot%202026-05-09%20100538.png)



#### 5/7/2026

ace loads, treejs loads, xterm loads, no wiring between anything. 


