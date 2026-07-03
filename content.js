// content.js — Single .md content system.
//
// Renders a "floating window" centered in front of the 3D grid world that
// displays the baked markdown content (intro.md). Kept separate from main.js
// per SPEC.md.
//
// The markdown is NOT parsed here: `intro.baked.js` is generated from intro.md
// by `node bake.js` before publishing, so the runtime stays dependency-free.
// main.js owns the palette and passes the colors in, so this module doesn't
// duplicate them.

import { introHtml } from "./intro.baked.js";

// 0xRRGGBB number -> CSS "#rrggbb".
function hex(color) {
  return "#" + color.toString(16).padStart(6, "0");
}
// 0xRRGGBB number + alpha -> CSS "rgba(...)".
function rgba(color, alpha) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

let injectedStyle = false;
function injectStyle(fg) {
  if (injectedStyle) return;
  injectedStyle = true;
  const style = document.createElement("style");
  style.textContent = `
    #content-window h1,
    #content-window h2,
    #content-window h3,
    #content-window h4 { font-weight: 600; line-height: 1.25; margin: 0.8em 0 0.4em; }
    #content-window h1 { font-size: 1.9em; }
    #content-window h2 { font-size: 1.45em; }
    #content-window h3 { font-size: 1.2em; }
    #content-window > :first-child { margin-top: 0; }
    #content-window p { margin: 0.6em 0; }
    #content-window ul,
    #content-window ol { margin: 0.6em 0; padding-left: 1.6em; }
    #content-window li { margin: 0.25em 0; }
    #content-window a { color: inherit; text-decoration: underline; }
    #content-window code {
      font-family: "Courier New", monospace;
      border: 1px solid ${rgba(fg, 0.5)};
      border-radius: 3px;
      padding: 0 3px;
    }
  `;
  document.head.appendChild(style);
}

// Build the floating content window and append it to the page.
//   colorFg    grid-line color: reused for the window border and text
//   colorBg    world background color: reused for the window background
//   bgOpacity  how opaque the window background is (0 transparent .. 1 opaque)
//   widthFrac / heightFrac  window size as a fraction of the viewport
export function initContent({
  colorFg,
  colorBg,
  bgOpacity,
  widthFrac,
  heightFrac,
}) {
  injectStyle(colorFg);

  const win = document.createElement("div");
  win.id = "content-window";
  Object.assign(win.style, {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    // Fractions of the viewport keep the window proportional on every device.
    width: `${widthFrac * 100}vw`,
    height: `${heightFrac * 100}vh`,
    boxSizing: "border-box",
    border: `1px solid ${hex(colorFg)}`,
    background: rgba(colorBg, bgOpacity),
    color: hex(colorFg),
    overflowY: "auto",
    // Padding scales a little with the viewport too, staying within bounds.
    padding: "clamp(16px, 4vh, 40px) clamp(20px, 5vw, 56px)",
    fontFamily: '"Courier New", monospace',
    fontSize: "16px",
    lineHeight: "1.6",
    zIndex: "10", // in front of the canvas
  });
  win.innerHTML = introHtml;
  document.body.appendChild(win);
  return win;
}
