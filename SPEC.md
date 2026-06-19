# World of Snow Yang
This is a github repository as a static personal webpage, made with Three.js.

## Appearence

- Part of a huge wire-frame sphere shows at lower half of the page. The camera viewpoint is always above the sphere surface.

- A Longitude-Latitude coordinate is applied on the sphere. The initial viewpoint is at (0,0) , facing North.

- When the direction key pressed, The sphere rolls and the viewpoint change position relative to the sphere. Key Up = Move North , Key Down = Move South , Key Left = Move West and Key Right = Move East. If the key got pressed longer, the viewpoint move faster. For the mobile devices, using finger drag instead of direction key.

- display the current Longitude and Latitude of the viewpoint on the top-right of the screen for debug.

- Color style : dark-grey for background , light-grey for foreground (drawed line and text).

## Content System

- Since github only support static page, the content is stored in folders and need to "bake" to the page manually when new content added or existing content modified.

- The content stored in "contents" folder. Every subfolder is a set of content , contains an image file, and a .md file for text, and a position.json file. The json file contains a 2D vector "lonlat": fist float is Longitude (positive for East, negative for West), second float is Latitude (positive for North, negative for South).

- The content status: Activated/Inactivated. When not activated, only show the image thumbnail at the given lon-lat position on the sphere. The thumbnail always face the viewpoint, and no need to appear if the content position is far from viewpoint.

- When activated, a rectagle canvas appear on the center of screen, display image and text (image is on top). The canvas has edge with foreground color, and half-transparent background.

- The content only activate when the viewpoint close to the content position, and inactivate when viewpoint leaves. Only one content can activate at the same time.



