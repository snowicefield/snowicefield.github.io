// World of Snow Yang — wireframe sphere + lon/lat viewpoint navigation.
//
// This implements the first part of SPEC.md: the appearance of a huge
// wireframe sphere whose lower half fills the screen, and direction-key
// control that "rolls" the sphere so the viewpoint moves across it.
//
// Model: the camera is FIXED above the top of the sphere, looking North and
// slightly down. The sphere is a Group ("globe") that we rotate so the current
// (lon, lat) is brought to the top, directly under the camera, with North
// pointing into the screen. Moving therefore looks like the sphere rolling
// beneath a stationary observer — which is exactly the spec's intent.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------
const RADIUS = 100; // sphere radius (world units)
const GRID_STEP = 2; // degrees between graticule lines
const SAMPLE_STEP = 2; // degrees between sampled points along a line (smoothness)
const GROUND_INSET = 0.997; // opaque surface sits just under the grid lines

// Camera placement, relative to the anchor at the top of the sphere (0, R, 0).
const CAM_HEIGHT = 5; // how far above the surface the eye sits
const CAM_BACK = 6; // offset toward the viewer (South of the anchor)
const LOOK_DROP = 30; // how far below the anchor the camera aims
const LOOK_FORWARD = 80; // how far North the camera aims

// Movement (degrees / second). Speed ramps up the longer a key is held.
const BASE_SPEED = 10;
const MAX_SPEED = 70;
const RAMP = 40; // extra deg/s added per second of holding

const COLOR_BG = 0x222222;
const COLOR_FG = 0xaaaaaa;

const DEG2RAD = Math.PI / 180;

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
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(0, RADIUS + CAM_HEIGHT, CAM_BACK);
camera.lookAt(0, RADIUS - LOOK_DROP, -LOOK_FORWARD);

// ---------------------------------------------------------------------------
// Wireframe sphere as a lon/lat graticule (clean meridians + parallels,
// rather than a triangulated mesh wireframe).
// ---------------------------------------------------------------------------
function lonLatToVec(lonDeg, latDeg) {
  const lon = lonDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    RADIUS * cosLat * Math.sin(lon),
    RADIUS * Math.sin(lat),
    RADIUS * cosLat * Math.cos(lon),
  );
}

function buildGraticule() {
  const positions = [];
  const pushSegment = (a, b) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  // Meridians (lines of constant longitude), pole to pole.
  for (let lon = -180; lon < 180; lon += GRID_STEP) {
    for (let lat = -90; lat < 90; lat += SAMPLE_STEP) {
      pushSegment(lonLatToVec(lon, lat), lonLatToVec(lon, lat + SAMPLE_STEP));
    }
  }

  // Parallels (lines of constant latitude), full circles.
  for (let lat = -90 + GRID_STEP; lat < 90; lat += GRID_STEP) {
    for (let lon = -180; lon < 180; lon += SAMPLE_STEP) {
      pushSegment(lonLatToVec(lon, lat), lonLatToVec(lon + SAMPLE_STEP, lat));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const material = new THREE.LineBasicMaterial({ color: COLOR_FG });
  return new THREE.LineSegments(geometry, material);
}

// Opaque ground: a solid sphere just inside the grid radius. It is filled with
// the background color so it stays invisible against the sky, but it writes
// depth and therefore hides the grid lines on the far side of the sphere.
function buildGround() {
  const geometry = new THREE.SphereGeometry(RADIUS * GROUND_INSET, 96, 96);
  const material = new THREE.MeshBasicMaterial({ color: COLOR_BG });
  return new THREE.Mesh(geometry, material);
}

const globe = new THREE.Group();
globe.add(buildGround());
globe.add(buildGraticule());
scene.add(globe);

// ---------------------------------------------------------------------------
// Viewpoint state + globe orientation
// ---------------------------------------------------------------------------
const view = { lon: 0, lat: 0 }; // start at (0, 0), facing North

const qX = new THREE.Quaternion();
const qY = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

function updateGlobeOrientation() {
  // Bring (lon, lat) to the top (0, R, 0): first spin about Y by -lon to put
  // the meridian in front, then tilt about X by (lat - 90deg) to lift the
  // point to the top with North pointing into the screen (-Z).
  qY.setFromAxisAngle(AXIS_Y, -view.lon * DEG2RAD);
  qX.setFromAxisAngle(AXIS_X, (view.lat - 90) * DEG2RAD);
  globe.quaternion.copy(qX).multiply(qY); // apply qY first, then qX
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

function wrapLon(lon) {
  // Keep longitude in (-180, 180].
  let l = ((lon + 180) % 360 + 360) % 360 - 180;
  if (l <= -180) l += 360;
  return l;
}

function applyMovement(dt) {
  const dLat = (speedFor("north", dt) - speedFor("south", dt)) * dt;
  const dLon = (speedFor("east", dt) - speedFor("west", dt)) * dt;
  if (dLat !== 0) {
    // Clamp just short of the poles so North stays well-defined.
    view.lat = Math.max(-89.99, Math.min(89.99, view.lat + dLat));
  }
  if (dLon !== 0) view.lon = wrapLon(view.lon + dLon);
}

// ---------------------------------------------------------------------------
// HUD (debug lon/lat readout, top-right)
// ---------------------------------------------------------------------------
const hud = document.getElementById("hud");
function formatHud() {
  const lonDir = view.lon >= 0 ? "E" : "W";
  const latDir = view.lat >= 0 ? "N" : "S";
  const lon = Math.abs(view.lon).toFixed(1).padStart(5, " ");
  const lat = Math.abs(view.lat).toFixed(1).padStart(5, " ");
  hud.textContent = `Lon: ${lon}° ${lonDir}\nLat: ${lat}° ${latDir}`;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1); // guard against tab-switch jumps
  applyMovement(dt);
  updateGlobeOrientation();
  formatHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

updateGlobeOrientation();
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
