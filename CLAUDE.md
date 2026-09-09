# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript with HTML5 Canvas. No build process, no package manager, no external dependencies — three files (`index.html`, `style.css`, `game.js`) that run directly in the browser.

## Running the game

No install or build step. Either open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or build tooling in this repo.

## Architecture

All game logic lives in `game.js` as top-level functions operating on module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — there are no classes or modules.

- **Board model**: `board` is a `ROWS × COLS` matrix where `0` is empty and `1–7` is a color index identifying which piece type occupies that cell.
- **Pieces**: the 7 standard tetrominoes are defined in `PIECES` as square matrices. Rotation (`rotateCW`) transposes and reverses rows rather than using precomputed rotation states.
- **Collision** (`collide`): checks board bounds and existing fixed blocks for a shape at a given offset.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until a non-colliding position is found, else the rotation is discarded.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded.
- **Locking/clearing** (`lockPiece` → `merge` + `clearLines` + `spawn`): fixes the piece into `board`, clears completed rows (shifting rows down, unshifting an empty row at top), then spawns the next piece.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/cell dropped, soft drop 1 pt/row. Level increments every 10 lines cleared; `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.
- **Rendering**: `draw()` redraws the full board canvas each frame (grid, locked blocks, ghost, current piece); `drawNext()` renders the preview piece on a separate canvas.
- **Game over**: triggered in `spawn()` when a freshly spawned piece immediately collides.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, and the initial `dropInterval` set in `init()`. If `COLS`/`ROWS`/`BLOCK` change, the `<canvas id="board">` `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).

## Controls

`←`/`→` move, `↑`/`X` rotate, `↓` soft drop, `Space` hard drop, `P` pause.
