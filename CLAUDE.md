# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`snowicefield.github.io` — a static personal webpage served by GitHub Pages,
built with **Three.js**. `SPEC.md` is the source of truth for the design.

The page renders an **infinite, perspective grid plane** viewed from above
looking forward, with randomly scattered "mountain areas" where the grid points
are raised by noise. The viewpoint drifts forward on its own across the plane
(no input controls yet — TBD) and never reaches an edge. Palette: dark-grey
background, light-grey lines and text. Current X/Y position is shown top-right
for debugging.

A content system existed earlier but was removed to keep the project small; it
will be revisited after the appearance is finished. Don't reintroduce it
unprompted.

## Build / run

There is **no build step and no dependencies** — the site is `index.html` +
`main.js`, with Three.js loaded from a CDN via an import map in `index.html`.
Serve the folder over HTTP to run it locally (ES modules don't load from
`file://`): `npx serve .` or `python -m http.server`. Deploy by pushing to the
default branch; GitHub Pages serves it at https://snowicefield.github.io/.

## Architecture (main.js)

The whole app is `main.js`. The non-obvious parts:

- **Fixed camera, scrolling world.** The camera never moves. The viewpoint is a
  world position `V = { x, z }`; the grid scrolls beneath the camera instead.
  This keeps all geometry near the origin and avoids float drift over distance.
- **Infinite grid via a shader + cell snapping.** A finite `LineSegments`
  lattice (`buildGrid`, spanning `[-HALF, HALF]` at `CELL` spacing) is reused
  every frame. Two uniforms drive it: `uV` (exact viewpoint) and `uBase`
  (`floor(V / CELL) * CELL`). In the vertex shader, `worldXZ = uBase + position.xz`
  and the vertex renders at `worldXZ - uV`, so the grid shifts by the sub-cell
  remainder and jumps a whole cell at boundaries — seamless because the lattice
  is periodic in `CELL`. The jump happens out past `FADE_END` where lines are
  invisible.
- **Mountains are real geometry, displaced in the vertex shader.** Heights come
  from a GLSL value-noise `fbm`: a low-frequency `mask` decides *where* mountain
  areas are (`MOUNTAIN_THRESHOLD`), a higher-frequency `fbm` shapes them. Because
  height is a pure function of `worldXZ`, mountains stay world-attached as you
  move. (A flat fragment-shader grid can't do this — elevation needs vertices.)
- **Distance fade** in the fragment shader dissolves lines into the background
  before the lattice edge, which is what makes the plane read as infinite.
- **Camera rides the terrain.** The camera's height tracks the ground so it
  climbs mountains instead of clipping through. Because the height field lives in
  the GPU vertex shader, there is a **CPU mirror** of it (`terrainHeightAt` and
  its `nHash`/`nVnoise`/`nFbm` helpers) wrapped in `Math.fround` to reproduce the
  GPU's 32-bit field exactly (a naive 64-bit port diverges into different terrain
  far from the origin). **If you change the GLSL noise, change the JS mirror to
  match, and vice-versa.**

All tuning lives in the constants block at the top of `main.js` (grid size,
camera framing, mountain noise parameters, movement speeds).
