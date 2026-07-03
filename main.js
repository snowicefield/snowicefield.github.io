// World of Snow Yang — infinite grid plane with random mountain areas.
//
// Implements the appearance from SPEC.md: a perspective grid plane viewed from
// above looking forward, that drifts forward on its own and never reaches an
// edge, with randomly scattered "mountain areas" where the grid points are
// raised by noise.
//
// Model: the camera is FIXED. A tessellated line grid sits centered under it.
// The viewpoint position V (world X/Z) drives two shader uniforms — a per-cell
// snapped origin (uBase) and the exact position (uV) — so the grid scrolls
// seamlessly beneath the camera and never shows an edge. Vertex heights are
// computed in the vertex shader from a world-space noise field, so mountains
// stay attached to the world as you move. A distance fade dissolves the grid
// into the background at the horizon, selling the "infinite" look.

import * as THREE from "three";
import { initContent } from "./content.js";

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

// Navigation: a constant little forward drift when idle (world units / second).
const DRIFT_SPEED = 4;

// Colors
const COLOR_BG = 0x000000; // background
const COLOR_PLANE = 0xaaaaaa; // grid plane (surface fill) color
const COLOR_FG = 0xffffff; // grid line color
// Grid plane opacity: 0 = fully transparent, 1 = opaque. Does not affect the
// grid lines, which always stay opaque.
const PLANE_OPACITY = 0.5;

// Content window (the single-.md floating window; rendered by content.js).
// The border and text reuse COLOR_FG; the background reuses COLOR_BG at this
// opacity (0 = fully transparent, 1 = opaque). Size is a fraction of the
// viewport so the window scales across screen sizes and devices.
const WINDOW_BG_OPACITY = 0.85;
const WINDOW_WIDTH_FRAC = 0.7;
const WINDOW_HEIGHT_FRAC = 0.7;

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
// The viewpoint maps to the world origin in render space, so the camera stays
// fixed in X/Z just above and slightly behind it, looking forward (-Z) and
// down. Its height is updated every frame to ride over the terrain (see tick).
camera.position.set(0, EYE_HEIGHT, CAM_BACK);

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

// Uniforms shared by the grid lines and the grid-plane fill (terrain
// displacement + horizon fade). Color-specific uniforms are added per material
// below; the wrapper objects are shared by reference, so syncGridUniforms only
// has to update them once.
const shared = {
  uBase: { value: new THREE.Vector2(0, 0) },
  uV: { value: new THREE.Vector2(0, 0) },
  uMaskFreq: { value: MASK_FREQ },
  uDetailFreq: { value: DETAIL_FREQ },
  uThreshold: { value: MOUNTAIN_THRESHOLD },
  uBand: { value: MOUNTAIN_BAND },
  uAmplitude: { value: AMPLITUDE },
  uSeed: { value: NOISE_SEED },
  uFadeStart: { value: FADE_START },
  uFadeEnd: { value: FADE_END },
};

// GLSL noise + terrain height, shared by the vertex shader below.
const terrainGLSL = /* glsl */ `
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
`;

// Vertex shader shared by the lines and the plane fill: displaces each vertex
// onto the terrain and passes the viewpoint-relative distance for fading.
const vertexShader = /* glsl */ `
  ${terrainGLSL}
  void main() {
    vec2 worldXZ = uBase + position.xz; // world-attached grid coordinate
    vec2 r = worldXZ - uV;              // position relative to the viewpoint
    float h = terrainHeight(worldXZ);
    vDist = length(r);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(r.x, h, r.y, 1.0);
  }
`;

// Grid lines: their own color, always opaque, fading out at the horizon.
const lineFragmentShader = /* glsl */ `
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

// Grid plane (surface fill): its own color and opacity, independent of lines.
const planeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying float vDist;

  void main() {
    float alpha = (1.0 - smoothstep(uFadeStart, uFadeEnd, vDist)) * uOpacity;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const lineMaterial = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, shared, {
    uColor: { value: new THREE.Color(COLOR_FG) },
  }),
  vertexShader,
  fragmentShader: lineFragmentShader,
  transparent: true,
  depthWrite: false,
});

const planeMaterial = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, shared, {
    uColor: { value: new THREE.Color(COLOR_PLANE) },
    uOpacity: { value: PLANE_OPACITY },
  }),
  vertexShader,
  fragmentShader: planeFragmentShader,
  transparent: true,
  depthWrite: true, // write depth so the surface hides grid lines behind ridges
  polygonOffset: true, // push the fill slightly back so coincident lines win
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

// Grid-plane fill: a triangulated lattice matching the line grid, displaced by
// the same terrain. Drawn first (renderOrder 0) so the lines sit on top.
const planeDivs = Math.round((HALF * 2) / CELL);
const planeGeometry = new THREE.PlaneGeometry(
  HALF * 2,
  HALF * 2,
  planeDivs,
  planeDivs,
);
planeGeometry.rotateX(-Math.PI / 2); // lay it flat in the XZ plane
const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
planeMesh.frustumCulled = false;
planeMesh.renderOrder = 0;
scene.add(planeMesh);

const grid = new THREE.LineSegments(buildGrid(), lineMaterial);
grid.frustumCulled = false; // the shader moves vertices; keep it always drawn
grid.renderOrder = 1;
scene.add(grid);

// ---------------------------------------------------------------------------
// Viewpoint state. V is the world (X, Z) position of the viewpoint.
// Forward (into the screen) is -Z, so HUD Y is reported as -V.z.
// ---------------------------------------------------------------------------
const V = { x: 0, z: 0 };

function syncGridUniforms() {
  shared.uV.value.set(V.x, V.z);
  shared.uBase.value.set(
    Math.floor(V.x / CELL) * CELL,
    Math.floor(V.z / CELL) * CELL,
  );
}

// ---------------------------------------------------------------------------
// CPU mirror of the vertex-shader terrain height, used to lift the camera so
// it rides over the mountains instead of clipping through them.
//
// The GPU evaluates the noise in 32-bit floats; to sample the SAME field on
// the CPU (so the camera stays glued to the rendered surface even far from the
// origin), every operation below is wrapped in Math.fround to emulate float32.
// This is a faithful port of `terrainHeight`/`fbm`/`vnoise`/`hash` in the
// vertex shader above — keep the two in sync if either changes.
// ---------------------------------------------------------------------------
const fr = Math.fround;
const N_C1 = fr(123.34);
const N_C2 = fr(456.21);
const N_C3 = fr(45.32);
const N_MF = fr(MASK_FREQ);
const N_DF = fr(DETAIL_FREQ);
const N_TH = fr(MOUNTAIN_THRESHOLD);
const N_TH1 = fr(MOUNTAIN_THRESHOLD + MOUNTAIN_BAND);
const N_AMP = fr(AMPLITUDE);
const N_SX = fr(NOISE_SEED.x);
const N_SY = fr(NOISE_SEED.y);
const N_SX2 = fr(N_SX * fr(1.7));
const N_SY2 = fr(N_SY * fr(1.7));

function nFract(x) {
  return fr(x - Math.floor(x));
}
function nMix(a, b, t) {
  return fr(fr(a * fr(1 - t)) + fr(b * t)); // GLSL mix: a*(1-t) + b*t
}
function nHash(px, py) {
  px = nFract(fr(px * N_C1));
  py = nFract(fr(py * N_C2));
  const t1 = fr(px + N_C3);
  const t2 = fr(py + N_C3);
  const d = fr(fr(px * t1) + fr(py * t2)); // dot(p, p + 45.32)
  px = fr(px + d);
  py = fr(py + d);
  return nFract(fr(px * py));
}
function nVnoise(px, py) {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = nFract(px);
  const fy = nFract(py);
  const a = nHash(ix, iy);
  const b = nHash(ix + 1, iy);
  const c = nHash(ix, iy + 1);
  const d = nHash(ix + 1, iy + 1);
  const ux = fr(fr(fx * fx) * fr(3 - fr(2 * fx)));
  const uy = fr(fr(fy * fy) * fr(3 - fr(2 * fy)));
  return nMix(nMix(a, b, ux), nMix(c, d, ux), uy);
}
function nFbm(px, py) {
  let v = 0;
  let amp = 0.5;
  for (let k = 0; k < 5; k++) {
    v = fr(v + fr(amp * nVnoise(px, py)));
    px = fr(px * 2);
    py = fr(py * 2);
    amp = fr(amp * 0.5);
  }
  return v;
}
function nSmoothstep(e0, e1, x) {
  let t = fr(fr(x - e0) / fr(e1 - e0));
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return fr(fr(t * t) * fr(3 - fr(2 * t)));
}
function terrainHeightAt(wx, wz) {
  wx = fr(wx);
  wz = fr(wz);
  const mask = nFbm(fr(fr(wx * N_MF) + N_SX), fr(fr(wz * N_MF) + N_SY));
  const m = nSmoothstep(N_TH, N_TH1, mask);
  const detail = nFbm(fr(fr(wx * N_DF) + N_SX2), fr(fr(wz * N_DF) + N_SY2));
  return fr(fr(m * N_AMP) * detail);
}

// ---------------------------------------------------------------------------
// Navigation. No input controls yet (TBD) — just a constant forward drift.
// ---------------------------------------------------------------------------
function applyDrift(dt) {
  V.z -= DRIFT_SPEED * dt; // forward = -Z
}

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
// Content: the single-.md floating window, in front of the 3D world. Reuses
// the palette so the window stays consistent with the grid.
// ---------------------------------------------------------------------------
initContent({
  colorFg: COLOR_FG,
  colorBg: COLOR_BG,
  bgOpacity: WINDOW_BG_OPACITY,
  widthFrac: WINDOW_WIDTH_FRAC,
  heightFrac: WINDOW_HEIGHT_FRAC,
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1); // guard against tab-switch jumps
  applyDrift(dt);
  syncGridUniforms();
  // Lift the camera onto the terrain so it climbs mountains instead of clipping
  // through them, keeping a constant eye height above the local ground.
  const groundH = terrainHeightAt(V.x, V.z);
  camera.position.y = EYE_HEIGHT + groundH;
  camera.lookAt(0, camera.position.y - LOOK_DROP, -LOOK_FORWARD);
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
