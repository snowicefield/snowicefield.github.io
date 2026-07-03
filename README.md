# World of Snow Yang

A personal webpage rendered with **Three.js**: an infinite, perspective grid
plane you travel across, with randomly scattered "mountain areas" where the grid
rises into peaks. Served as a static site on GitHub Pages.

See [`SPEC.md`](./SPEC.md) for the design.

## Running the site locally

The page is plain static files (`index.html` + `main.js`) and loads Three.js
from a CDN via an import map. ES modules will **not** load from a `file://`
path, so serve the folder over HTTP. Any static server works — no build step and
no dependencies to install:

```sh
# Option A — Node (no install, uses npx)
npx serve .

# Option B — Python
python -m http.server 8000
```

Then open the printed URL (e.g. <http://localhost:3000> for `serve`, or
<http://localhost:8000> for Python). An internet connection is required so the
CDN can supply Three.js.

### Navigation

- The viewpoint **drifts forward on its own**; there are no input controls yet
  (to be decided later).
- The current X/Y position is shown top-right for debugging.

## Content window

A floating window over the 3D world shows the contents of [`intro.md`](./intro.md).
So the site never has to parse markdown at runtime, `intro.md` is **baked** into
`intro.baked.js` (a pre-rendered HTML module) by a small Node script.

After editing `intro.md`, regenerate the baked file and commit it:

```sh
node bake.js
```

This reads `intro.md`, converts it to HTML, and writes `intro.baked.js`. It has
no dependencies to install. If you forget to re-bake, the window keeps showing
the previously baked content.

## Deploying

Because the repo is named `snowicefield.github.io`, GitHub Pages serves it at
<https://snowicefield.github.io/> from the default branch — just push and the
live site updates. No build step is required.
