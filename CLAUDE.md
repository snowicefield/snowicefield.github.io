# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a **pre-implementation** repo. The only files present are `SPEC.md` (the design spec) and a sample content folder. There is no application code, build system, or test suite yet — when implementing, follow `SPEC.md` as the source of truth. Update this file once a toolchain exists.

## What this is

`snowicefield.github.io` — a static personal webpage served by GitHub Pages, built with **Three.js**. The page renders a wireframe sphere (only the lower half visible, camera always above the surface) with a longitude/latitude coordinate grid. Arrow keys (desktop) or finger drag (mobile) roll the sphere to move the viewpoint; longer presses move faster. Initial viewpoint is `(0,0)` facing North. Color scheme: dark-grey background, light-grey foreground for lines and text. Current lon/lat is shown top-right for debugging.

Because GitHub Pages is static, there is no server-side rendering — everything runs client-side in the browser.

## Content system

Content lives in `contents/`. Each subfolder is one content item containing exactly:
- an image file (e.g. `image.jpg`) — used as the thumbnail
- `text.md` — the body text
- `position.json` — `{ "lonlat": [lon, lat] }` where lon is positive East / negative West, lat is positive North / negative South

Content has two states:
- **Inactivated**: only the image thumbnail shows at its lon/lat on the sphere, always facing the viewpoint, and hidden when far from the viewpoint.
- **Activated**: a centered rectangular canvas (foreground-color border, half-transparent background) shows the image on top and text below. Activates when the viewpoint is near the content position, deactivates on leaving. **Only one content item may be active at a time.**

### The "bake" step

GitHub Pages is static, so content cannot be discovered at runtime by listing folders. Per `SPEC.md`, content must be **baked manually** into the page whenever a content folder is added or modified — i.e. a build/generation step that reads `contents/` and emits a static manifest (or inlined data) the page consumes. Any implementation must provide and document this bake step, and it must be re-run after content changes.
