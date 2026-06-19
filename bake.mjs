#!/usr/bin/env node
// Bake step for snowicefield.github.io
//
// GitHub Pages is static and the browser cannot list directories, so this
// script scans contents/ and emits a single contents/manifest.json that the
// page fetches at startup. Re-run it whenever a content folder is added or
// changed, then commit the updated manifest.
//
// Usage:  npm run bake   (or: node bake.mjs)

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENTS_DIR = join(ROOT, "contents");
const MANIFEST_PATH = join(CONTENTS_DIR, "manifest.json");

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Collect errors and report them all at once so a single bad folder doesn't
// hide problems in the others.
const errors = [];

async function listDirectories(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function findImage(itemDir) {
  const entries = await readdir(itemDir);
  return entries.find((name) =>
    IMAGE_EXTENSIONS.includes(name.slice(name.lastIndexOf(".")).toLowerCase()),
  );
}

function validateLonLat(lonlat, id) {
  if (!Array.isArray(lonlat) || lonlat.length !== 2) {
    errors.push(`[${id}] position.json: "lonlat" must be an array of two numbers`);
    return false;
  }
  const [lon, lat] = lonlat;
  if (typeof lon !== "number" || lon < -180 || lon > 180) {
    errors.push(`[${id}] position.json: longitude ${lon} out of range [-180, 180]`);
    return false;
  }
  if (typeof lat !== "number" || lat < -90 || lat > 90) {
    errors.push(`[${id}] position.json: latitude ${lat} out of range [-90, 90]`);
    return false;
  }
  return true;
}

async function bakeItem(id) {
  const itemDir = join(CONTENTS_DIR, id);

  // position.json
  let lonlat;
  try {
    const raw = await readFile(join(itemDir, "position.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (!validateLonLat(parsed.lonlat, id)) return null;
    lonlat = parsed.lonlat;
  } catch (err) {
    errors.push(`[${id}] missing or invalid position.json (${err.message})`);
    return null;
  }

  // text.md -> html
  let html;
  try {
    const md = await readFile(join(itemDir, "text.md"), "utf8");
    html = marked.parse(md).trim();
  } catch (err) {
    errors.push(`[${id}] missing or unreadable text.md (${err.message})`);
    return null;
  }

  // image
  const image = await findImage(itemDir);
  if (!image) {
    errors.push(`[${id}] no image file found (expected one of: ${IMAGE_EXTENSIONS.join(", ")})`);
    return null;
  }

  return {
    id,
    lonlat,
    image: `contents/${id}/${image}`,
    html,
  };
}

async function main() {
  try {
    await stat(CONTENTS_DIR);
  } catch {
    console.error(`No contents/ directory found at ${CONTENTS_DIR}`);
    process.exit(1);
  }

  const dirs = (await listDirectories(CONTENTS_DIR)).sort();
  const items = [];
  for (const id of dirs) {
    const item = await bakeItem(id);
    if (item) items.push(item);
  }

  if (errors.length > 0) {
    console.error("Bake failed:\n" + errors.map((e) => "  - " + e).join("\n"));
    process.exit(1);
  }

  const manifest = {
    generated: new Date().toISOString(),
    items,
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`Baked ${items.length} content item(s) -> ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
