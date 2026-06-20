// World of Snow Yang — infinite grid plane with random mountain areas.
//
// Implements the appearance from SPEC.md: a perspective grid plane viewed from
// above looking forward, that you travel across with arrow keys or drag without
// ever reaching an edge, with randomly scattered "mountain areas" where the
// grid points are raised by noise.
//
// Model: the camera is FIXED. A tessellated line grid sits centered under it.
// The viewpoint position V (world X/Z) drives two shader uniforms — a per-cell
// snapped origin (uBase) and the exact position (uV) — so the grid scrolls
// seamlessly beneath the camera and never shows an edge. Vertex heights are
// computed in the vertex shader from a world-space noise field, so mountains
// stay attached to the world as you move. A distance fade dissolves the grid
// into the background at the horizon, selling the "infinite" look.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------
// Grid geometry
const CELL = 4; // world units between grid lines
const HALF = 320; // grid extends [-HALF, HALF] around the viewpoint
const FADE_START = 170; // distance where lines begin to fade
const FADE_END = 300; // distance where lines fully vanish (< HALF)

// Camera (horizon perspective)
const FOV = 60;
const EYE_HEIGHT = 18; // camera height above the plane
const CAM_BACK = 6; // camera sits slightly behind the viewpoint (+Z)
const LOOK_FORWARD = 400; // how far ahead (-Z) the camera aims
const LOOK_DROP = 6; // how far below eye level the aim point is

// Mountains (noise-driven elevation)
const MASK_FREQ = 0.0045; // low frequency: where mountain areas appear
const MOUNTAIN_THRESHOLD = 0.55; // mask above this becomes mountainous
const MOUNTAIN_BAND = 0.15; // soft edge width of mountain areas
const DETAIL_FREQ = 0.02; // higher frequency: the mountain shapes
const AMPLITUDE = 48; // peak mountain height
const NOISE_SEED = new THREE.Vector2(37.2, 11.7);

// Movement (world units / second). Speed ramps the longer a key is held.
const BASE_SPEED = 30;
const MAX_SPEED = 200;
const RAMP = 130; // extra units/s added per second of holding
const DRAG_SPEED = 0.6; // world units per pixel of pointer drag

const COLOR_BG = 0x222222;
const COLOR_FG = 0xaaaaaa;

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOR_BG);

const camera = new THREE.PerspectiveCamera(
  FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
// The viewpoint maps to the world origin in render space, so the camera is
// fixed just above and slightly behind it, looking forward (-Z) and down.
camera.position.set(0, EYE_HEIGHT, CAM_BACK);
camera.lookAt(0, EYE_HEIGHT - LOOK_DROP, -LOOK_FORWARD);

// ---------------------------------------------------------------------------
// Grid geometry: a regular CELL lattice over [-HALF, HALF], connected only
// horizontally and vertically (clean squares, no triangulated diagonals).
// Heights are filled in by the vertex shader, so y is left at 0 here.
// ---------------------------------------------------------------------------
function buildGrid() {
  const positions = [];
  const n = Math.round((HALF * 2) / CELL); // divisions per axis
  const min = -HALF;

  // Lines of constant Z (run along X).
  for (let j = 0; j <= n; j++) {
    const z = min + j * CELL;
    for (let i = 0; i < n; i++) {
      const x0 = min + i * CELL;
      const x1 = x0 + CELL;
      positions.push(x0, 0, z, x1, 0, z);
    }
  }
  // Lines of constant X (run along Z).
  for (let i = 0; i <= n; i++) {
    const x = min + i * CELL;
    for (let j = 0; j < n; j++) {
      const z0 = min + j * CELL;
      const z1 = z0 + CELL;
      positions.push(x, 0, z0, x, 0, z1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

const uniforms = {
  uBase: { value: new THREE.Vector2(0, 0) },
  uV: { value: new THREE.Vector2(0, 0) },
  uMaskFreq: { value: MASK_FREQ },
  uDetailFreq: { value: DETAIL_FREQ },
  uThreshold: { value: MOUNTAIN_THRESHOLD },
  uBand: { value: MOUNTAIN_BAND },
  uAmplitude: { value: AMPLITUDE },
  uSeed: { value: NOISE_SEED },
  uColor: { value: new THREE.Color(COLOR_FG) },
  uFadeStart: { value: FADE_START },
  uFadeEnd: { value: FADE_END },
};

const vertexShader = /* glsl */ `
  uniform vec2 uBase;
  uniform vec2 uV;
  uniform float uMaskFreq;
  uniform float uDetailFreq;
  uniform float uThreshold;
  uniform float uBand;
  uniform float uAmplitude;
  uniform vec2 uSeed;
  varying float vDist;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int k = 0; k < 5; k++) {
      v += amp * vnoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }
  float terrainHeight(vec2 w) {
    float mask = fbm(w * uMaskFreq + uSeed);
    float m = smoothstep(uThreshold, uThreshold + uBand, mask);
    float detail = fbm(w * uDetailFreq + uSeed * 1.7);
    return m * uAmplitude * detail;
  }

  void main() {
    vec2 worldXZ = uBase + position.xz; // world-attached grid coordinate
    vec2 r = worldXZ - uV;              // position relative to the viewpoint
    float h = terrainHeight(worldXZ);
    vDist = length(r);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(r.x, h, r.y, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying float vDist;

  void main() {
    float alpha = 1.0 - smoothstep(uFadeStart, uFadeEnd, vDist);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const gridMaterial = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
});

const grid = new THREE.LineSegments(buildGrid(), gridMaterial);
grid.frustumCulled = false; // the shader moves vertices; keep it always drawn
scene.add(grid);

// ---------------------------------------------------------------------------
// Viewpoint state. V is the world (X, Z) position of the viewpoint.
// Forward (into the screen) is -Z, so HUD Y is reported as -V.z.
// ---------------------------------------------------------------------------
const V = { x: 0, z: 0 };

function syncGridUniforms() {
  uniforms.uV.value.set(V.x, V.z);
  uniforms.uBase.value.set(
    Math.floor(V.x / CELL) * CELL,
    Math.floor(V.z / CELL) * CELL,
  );
}

// ---------------------------------------------------------------------------
// Direction-key control. Holding longer accelerates (BASE -> MAX).
// ---------------------------------------------------------------------------
const KEY_DIRS = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};
// Per-direction held time in seconds, or null when released.
const held = { north: null, south: null, west: null, east: null };

window.addEventListener("keydown", (e) => {
  const dir = KEY_DIRS[e.key];
  if (!dir) return;
  e.preventDefault();
  if (held[dir] === null) held[dir] = 0;
});
window.addEventListener("keyup", (e) => {
  const dir = KEY_DIRS[e.key];
  if (!dir) return;
  held[dir] = null;
});

function speedFor(dir, dt) {
  if (held[dir] === null) return 0;
  held[dir] += dt;
  return Math.min(MAX_SPEED, BASE_SPEED + RAMP * held[dir]);
}

function applyKeys(dt) {
  const forward = (speedFor("north", dt) - speedFor("south", dt)) * dt;
  const strafe = (speedFor("east", dt) - speedFor("west", dt)) * dt;
  V.z -= forward; // North/forward = -Z
  V.x += strafe; // East = +X
}

// ---------------------------------------------------------------------------
// Pointer drag (mouse + touch via Pointer Events): grab-the-ground panning.
// ---------------------------------------------------------------------------
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  // Move the viewpoint opposite the drag so the ground follows the finger.
  V.x -= dx * DRAG_SPEED;
  V.z -= dy * DRAG_SPEED;
});
function endDrag() {
  dragging = false;
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// ---------------------------------------------------------------------------
// HUD (debug X/Y readout, top-right)
// ---------------------------------------------------------------------------
const hud = document.getElementById("hud");
function formatHud() {
  const x = V.x.toFixed(1).padStart(7, " ");
  const y = (-V.z).toFixed(1).padStart(7, " ");
  hud.textContent = `X: ${x}\nY: ${y}`;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1); // guard against tab-switch jumps
  applyKeys(dt);
  syncGridUniforms();
  formatHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

syncGridUniforms();
formatHud();
tick();

// ---------------------------------------------------------------------------
// Resize handling
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
