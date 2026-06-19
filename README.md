# World of Snow Yang

A personal webpage rendered as a **Three.js** wireframe sphere. You navigate
across the sphere by longitude/latitude; when the viewpoint nears a piece of
content, it reveals an image and text. Served as a static site on GitHub Pages.

See [`SPEC.md`](./SPEC.md) for the full design.

## Running the site locally

The page is plain static files (`index.html` + `main.js`) and loads Three.js
from a CDN via an import map. ES modules will **not** load from a `file://`
path, so you must serve the folder over HTTP. Any static server works:

```sh
# Option A — Node (no install, uses npx)
npx serve .

# Option B — Python
python -m http.server 8000
```

Then open the printed URL (e.g. <http://localhost:3000> for `serve`, or
<http://localhost:8000> for Python). An internet connection is required the
first time so the CDN can supply Three.js.

### Controls

- **Arrow keys** roll the sphere and move the viewpoint:
  Up = North, Down = South, Left = West, Right = East.
  Hold a key longer to move faster.
- The current longitude/latitude is shown top-right for debugging.

### Deploying

Because the repo is named `snowicefield.github.io`, GitHub Pages serves it at
<https://snowicefield.github.io/> from the default branch — just push and the
live site updates. No build step is needed for the page itself (only the
content [bake step](#the-bake-step) below).

## Adding or editing content

Content lives in [`contents/`](./contents). Each item is a subfolder named by
its `id` (the folder name) containing exactly three things:

```
contents/
  about_me/
    image.jpg        # thumbnail / full image (jpg, jpeg, png, webp, or gif)
    text.md          # body text, written in Markdown
    position.json    # where it sits on the sphere
```

`position.json` places the item on the sphere:

```json
{
  "lonlat": [0, 0]
}
```

- First number = **longitude**, range `-180..180` (positive = East, negative = West)
- Second number = **latitude**, range `-90..90` (positive = North, negative = South)

To add content: create a new subfolder under `contents/` with those three
files, then **bake** (below).

## The bake step

GitHub Pages is static and the browser cannot list folders, so the page reads a
generated `contents/manifest.json` instead. You must regenerate it whenever you
add or change anything under `contents/`.

### One-time setup

```sh
npm install
```

### Bake

```sh
npm run bake
```

This scans `contents/`, validates every item (required files present,
`lonlat` in range), renders each `text.md` to HTML, and writes
`contents/manifest.json`. If any folder is malformed, the bake **fails and
prints every problem** without writing a manifest — fix the listed issues and
run it again.

### Publish

Commit the regenerated manifest along with your content, then push:

```sh
git add contents/
git commit -m "Add content: <id>"
git push
```

Because there is no CI build, the committed `manifest.json` **is** the deployed
state — if you forget to bake, your new content won't appear on the live site.
