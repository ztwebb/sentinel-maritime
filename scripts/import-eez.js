#!/usr/bin/env node
/**
 * import-eez.js
 *
 * Fetches EEZ boundary lines from the VLIZ Marine Regions WFS and writes
 * a simplified GeoJSON to public/data/eez-boundaries.json.
 *
 * Source: Flanders Marine Institute (VLIZ) — marineregions.org
 *   Layer: MarineRegions:eez_boundaries (MultiLineString, 2349 features)
 *   License: CC BY 4.0
 *
 * Uses the `eez_boundaries` line layer rather than the full polygon EEZ layer
 * because:
 *   - Lines are 10× smaller than polygons at full resolution
 *   - Lines don't intercept mouse clicks in Cesium (no fill surface)
 *   - Each feature carries both adjacent sovereign states, enabling future
 *     tooltip and intelligence-panel integration
 *
 * Fetches 3 concurrent batches of 800 features each (WFS 2.0 startIndex),
 * applies Ramer-Douglas-Peucker simplification (epsilon = 0.1°, ~11 km),
 * rounds coordinates to 4 decimal places (~11 m precision), and strips
 * properties to the minimum needed for display and selection.
 *
 * Usage:
 *   node scripts/import-eez.js
 */

const { writeFileSync, mkdirSync, existsSync } = require("fs");
const path = require("path");

const WFS_BASE =
  "https://geo.vliz.be/geoserver/MarineRegions/wfs?" +
  "service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=MarineRegions:eez_boundaries&outputFormat=application/json";

const OUT_DIR  = path.join(__dirname, "../public/data");
const OUT_PATH = path.join(OUT_DIR, "eez-boundaries.json");

const BATCH_SIZE = 800;
const TOTAL      = 2349;
const EPSILON    = 0.1; // degrees — Ramer-Douglas-Peucker tolerance (~11 km)

// ——————————————————————————————————————————
// Iterative Ramer-Douglas-Peucker simplification
// ——————————————————————————————————————————

function perpDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  const tc = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - tc * dx, py - ay - tc * dy);
}

function simplifyLine(coords, epsilon) {
  if (coords.length <= 2) return coords;

  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;

  const stack = [[0, coords.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    if (e - s <= 1) continue;

    let maxD = 0;
    let maxI = s;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(
        coords[i][0], coords[i][1],
        coords[s][0], coords[s][1],
        coords[e][0], coords[e][1]
      );
      if (d > maxD) { maxD = d; maxI = i; }
    }

    if (maxD > epsilon) {
      keep[maxI] = 1;
      if (maxI - s > 1) stack.push([s, maxI]);
      if (e - maxI > 1) stack.push([maxI, e]);
    }
  }

  return coords.filter((_, i) => keep[i]);
}

function round4(n) { return Math.round(n * 10000) / 10000; }

function simplifyMultiLineString(geometry) {
  return {
    type: "MultiLineString",
    coordinates: geometry.coordinates
      .map((line) => simplifyLine(line, EPSILON).map(([x, y]) => [round4(x), round4(y)]))
      .filter((line) => line.length >= 2),
  };
}

// ——————————————————————————————————————————
// Property stripping
// ——————————————————————————————————————————

function stripProps(props) {
  return {
    line_id:    props.line_id,
    line_type:  props.line_type,
    sovereign1: props.sovereign1 ?? null,
    sovereign2: props.sovereign2 ?? null,
    eez1:       props.eez1 ?? null,
    eez2:       props.eez2 ?? null,
    length_km:  props.length_km != null ? Math.round(props.length_km) : null,
  };
}

// ——————————————————————————————————————————
// Fetch a single page
// ——————————————————————————————————————————

async function fetchPage(startIndex, count) {
  const url = `${WFS_BASE}&count=${count}&startIndex=${startIndex}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for startIndex=${startIndex}`);
  const json = await res.json();
  return json.features ?? [];
}

// ——————————————————————————————————————————
// Main
// ——————————————————————————————————————————

async function main() {
  console.log("Fetching VLIZ EEZ boundaries (3 concurrent batches)…");

  const batches = [];
  for (let start = 0; start < TOTAL; start += BATCH_SIZE) {
    batches.push(fetchPage(start, BATCH_SIZE));
  }

  let rawFeatures;
  try {
    const pages = await Promise.all(batches);
    rawFeatures = pages.flat();
  } catch (err) {
    console.error("Fetch failed:", err.message);
    process.exit(1);
  }

  console.log(`  Downloaded ${rawFeatures.length} raw features`);

  // ——————————————————
  // Simplify + transform
  // ——————————————————
  const features = rawFeatures
    .filter((f) => f.geometry?.type === "MultiLineString" && f.geometry.coordinates.length > 0)
    .map((f) => ({
      type: "Feature",
      properties: stripProps(f.properties),
      geometry: simplifyMultiLineString(f.geometry),
    }))
    .filter((f) => f.geometry.coordinates.length > 0);

  // ——————————————————
  // Stats
  // ——————————————————
  let totalCoords = 0;
  for (const f of features) {
    for (const line of f.geometry.coordinates) totalCoords += line.length;
  }

  const lineTypes = {};
  for (const f of features) {
    const lt = f.properties.line_type ?? "null";
    lineTypes[lt] = (lineTypes[lt] || 0) + 1;
  }

  console.log(`  Output features:  ${features.length}`);
  console.log(`  Total coords:     ${totalCoords.toLocaleString()} (after simplification)`);
  console.log("  Line types:");
  Object.entries(lineTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${v.toString().padStart(4)}  ${k}`));

  // ——————————————————
  // Write
  // ——————————————————
  const geojson = { type: "FeatureCollection", features };
  const json = JSON.stringify(geojson);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, json, "utf8");

  const sizeKB = (json.length / 1024).toFixed(0);
  console.log(`\n✓ Written ${features.length} features (${sizeKB} KB) → ${OUT_PATH}`);
}

main();
