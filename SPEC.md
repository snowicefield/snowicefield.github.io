# World of Snow Yang
This is a github repository as a static personal webpage, made with Three.js.

## Appearance

- An grid plane with perspective view , the view point is above the plane, looking forward.

- The plane is "infinite" - the viewpoint might move across the plane, but never reach the edge of the grid plane.

- The plane is in a x-y coordinate system, display the current x-y position of the viewpoint on the top-right of the screen for debug.

- There some "mountain area" randomly appear on plane. In "mountain area" ,the points of grid plane is eleveated by noise, form shapes like mountains.

### Style Parameters
- COLOR_BG : background
- COLOR_PLANE : grid plane (surface fill) color
- COLOR_FG : grid line color
- PLANE_OPACITY : Grid plane opacity: 0 = fully transparent, 1 = opaque. Does not affect the grid lines, which always stay opaque.

## Navigation

- A constant little forward drift is applied when idle.

- Current no input navigation control - let us discuss it later.

## Content System

### Single .md Content System
- Seperate code of the system into another .js file.
- display a "floating window" in front of the view of 3D-grid world.
- Boundary of the window is the same color of the grid line
- Background of the window is the same color of 3D world background color but is transparent (please add a sytle parameter : window background opacity.)
- The floating window 's width and height is a fix portion of full viewport width and height. The window's size must varies across different window size and different device.
- The floating window display a single .md file (intro.md) and must be "baked" via a script before publish.


