// RUINS — the estate's old storehouse, in the clearing behind the mansion.
//
// Identity, fixed here so every later prop agrees with it: the stone storehouse
// that served the estate before the mansion's service wing existed. It was
// abandoned, the roof came down, the south wall fell outward, and nobody ever
// cleared it. The yard in front of it holds the draw well (landmarks.js). It is
// not a chapel and not a folly — it is a working building that stopped working.
//
// What the geometry has to prove, per the placement rules:
//   * every wall sits on the height field, sunk 0.15 m so no face can float or
//     show a light line at its base;
//   * the building is enterable: a 1.10 m doorway, with the walker's floor
//     registered in `architecture.extraFloors` so the player stands ON the
//     stone slabs instead of ankle-deep in them;
//   * the collapse has a cause: a low, uneven south wall with the rubble that
//     came off it lying on the ground outside it, denser at the breach;
//   * nothing is placed in the well's yard within reach of its rim.
//
// Draw cost: the whole ruin is merged into four meshes, one per material.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials } from './materials.js';
import { heightAt } from './terrain.js';
import { architecture } from './architecture.js';
import { box, stoneGeometry } from './primitives.js';

// Outer faces of the standing walls. The well is at (10.6, -20.4); the north
// wall's outer face is 1.34 m from its rim, which is the yard.
export const RUIN = { x0: 6.17, x1: 12.82, z0: -18.42, z1: -13.97, wall: 0.45 };

export const ruins = {
  group: null,
  colliders: 0,
  stones: 0,
  groundY: 0,
  floorY: 0,
  parts: {},
};

const rand = (() => {
  let s = 0x2f6e2b1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
})();

export function buildRuins(scene) {
  const h = heightAt((RUIN.x0 + RUIN.x1) / 2, (RUIN.z0 + RUIN.z1) / 2);
  const parts = { stone: [], stoneDark: [], boulder: [], rust: [], woodDirt: [] };
  const SUMP = 0.15; // how far every wall foot is buried

  // A slab from box faces to world coordinates, in absolute Y.
  function slab(key, x0, x1, z0, z1, y0, y1, scale = 0.45) {
    const g = box(x1 - x0, y1 - y0, z1 - z0, scale);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts[key].push(g);
    return g;
  }

  // A collider on the long axis of a wall footprint.
  function solid(x0, x1, z0, z1, y1) {
    const horizontal = (x1 - x0) >= (z1 - z0);
    architecture.colliders.push(horizontal
      ? { x1: x0, z1: (z0 + z1) / 2, x2: x1, z2: (z0 + z1) / 2, y0: h - SUMP, y1, kind: 'ruin' }
      : { x1: (x0 + x1) / 2, z1: z0, x2: (x0 + x1) / 2, z2: z1, y0: h - SUMP, y1, kind: 'ruin' });
  }

  // --- west wall: two leaves, with the storage niche between them -----------
  // Outer leaf is solid to full height; the inner leaf is cut around a 0.9 m
  // by 1.0 m recess, which is how a niche in a thick masonry wall is built.
  slab('stone', 6.17, 6.40, -18.42, -13.97, h - SUMP, h + 2.35);
  slab('stone', 6.40, 6.62, -18.42, -13.97, h - SUMP, h + 0.95); // below the niche
  slab('stone', 6.40, 6.62, -18.42, -13.97, h + 1.95, h + 2.35); // above it
  slab('stone', 6.40, 6.62, -18.42, -16.55, h + 0.95, h + 1.95); // north of it
  slab('stone', 6.40, 6.62, -15.65, -13.97, h + 0.95, h + 1.95); // south of it
  // the shelf that spans the niche, broken off at its south end
  slab('stoneDark', 6.42, 6.60, -16.50, -15.98, h + 0.95, h + 1.00, 0.8);
  solid(6.17, 6.62, -18.42, -13.97, h + 2.35);

  // --- north wall: the doorway, and the top stepping down to the east ------
  slab('stone', 6.17, 9.35, -18.42, -17.97, h - SUMP, h + 2.55);
  slab('stone', 10.45, 11.60, -18.42, -17.97, h - SUMP, h + 1.35);
  slab('stone', 11.60, 12.82, -18.42, -17.97, h - SUMP, h + 0.75);
  solid(6.17, 9.35, -18.42, -17.97, h + 2.55);
  solid(10.45, 11.60, -18.42, -17.97, h + 1.35);
  solid(11.60, 12.82, -18.42, -17.97, h + 0.75);

  // --- east wall with the window void (sill 1.0 m, head 1.75 m) ------------
  slab('stone', 12.37, 12.82, -17.97, -13.97, h - SUMP, h + 1.00);
  slab('stone', 12.37, 12.82, -17.97, -16.85, h + 1.00, h + 1.75);
  slab('stone', 12.37, 12.82, -15.85, -13.97, h + 1.00, h + 1.75);
  slab('stone', 12.37, 12.82, -17.97, -13.97, h + 1.75, h + 1.95);
  solid(12.37, 12.82, -17.97, -13.97, h + 1.95);

  // --- south wall: fallen outward, three uneven heights --------------------
  slab('stone', 6.17, 9.00, -14.42, -13.97, h - SUMP, h + 0.62);
  slab('stone', 9.00, 11.00, -14.42, -13.97, h - SUMP, h + 0.58);
  slab('stone', 11.00, 12.82, -14.42, -13.97, h - SUMP, h + 0.66);
  solid(6.17, 9.00, -14.42, -13.97, h + 0.62);
  solid(9.00, 11.00, -14.42, -13.97, h + 0.58);
  solid(11.00, 12.82, -14.42, -13.97, h + 0.66);

  // --- floor: three worn slabs, the south-east corner gone to soil --------
  const pads = [
    ['A', 6.62, 9.60, -17.97, -16.50, 0.05],
    ['B', 6.62, 9.20, -16.50, -14.42, 0.04],
    ['C', 9.60, 12.37, -17.97, -15.40, 0.06],
  ];
  for (const [id, x0, x1, z0, z1, lift] of pads) {
    slab('stone', x0, x1, z0, z1, h - 0.05, h + lift, 0.6);
    architecture.extraFloors.push({ x0, x1, z0, z1, y: h + lift, id: 'ruin' + id });
  }
  // the worn sill through the doorway, half a step up
  slab('stoneDark', 9.30, 10.50, -18.50, -17.90, h - 0.20, h + 0.13, 0.9);
  architecture.extraFloors.push({ x0: 9.30, x1: 10.50, z0: -18.50, z1: -17.90, y: h + 0.13, id: 'ruinSill' });

  // --- the former footprint: foundation stubs south of the fallen wall ----
  for (let i = 0; i < 6; i++) {
    const x = 6.70 + i * 1.02 + (rand() - 0.5) * 0.16;
    const top = h + 0.09 + rand() * 0.09;
    slab('stoneDark', x, x + 0.62, -13.60, -13.18, h - SUMP, top, 0.7);
  }
  // and the corner of it further out, where the yard wall turned
  slab('stoneDark', 12.30, 12.80, -13.30, -12.55, h - SUMP, h + 0.17, 0.7);
  slab('stoneDark', 11.30, 12.28, -12.95, -12.55, h - SUMP, h + 0.11, 0.7);

  // --- the fallen wall itself: blocks on the ground outside the breach ----
  const blocks = [
    [8.20, -13.30, 0.62, 0.26, 0.44, 0.12],
    [9.75, -13.15, 0.78, 0.22, 0.36, -0.4],
    [11.30, -13.05, 0.52, 0.30, 0.48, 0.7],
    [10.55, -12.85, 0.40, 0.18, 0.30, 0.2],
  ];
  for (const [x, z, w, ht, d, rot] of blocks) {
    const g = box(w, ht, d, 0.55);
    g.rotateY(rot);
    // ground the block by its own bounding box: a rotated box that is placed
    // by its centre always has one corner in the air otherwise
    g.computeBoundingBox();
    g.translate(x, h - 0.02 - g.boundingBox.min.y, z);
    parts.stoneDark.push(g);
  }

  // --- rubble: irregular stones, half-buried, densest at the breach -------
  const rubbleSpots = [];
  // 240 attempts for ~34 stones: each candidate is kept unless it would sink
  // into an accepted one. Piled rubble touches and leans; it does not share the
  // same space, which is what makes two overlapping blobs read as one blob.
  for (let i = 0; i < 240 && rubbleSpots.length < 34; i++) {
    const x = 6.4 + rand() * 6.6;
    const z = -14.0 + rand() * 1.5;
    const s = 0.10 + Math.pow(rand(), 2) * 0.32;
    // keep the doorway's approach and the well's yard clear
    if (Math.hypot(x - 9.9, z + 17.9) < 0.9) continue;
    if (Math.hypot(x - 10.6, z + 20.4) < 1.3) continue;
    let clear = true;
    for (const [ox, oz, os] of rubbleSpots) {
      if (Math.hypot(x - ox, z - oz) < 0.46 * (s + os)) { clear = false; break; }
    }
    if (!clear) continue;
    rubbleSpots.push([x, z, s]);
  }
  // a few inside, fallen from the east window onto the soil where the
  // south-east corner's slabs are gone
  for (const [x, z, s] of [[9.90, -14.85, 0.16], [10.90, -15.05, 0.13], [11.90, -14.80, 0.11]]) {
    rubbleSpots.push([x, z, s]);
  }
  for (const [x, z, s] of rubbleSpots) {
    const g = stoneGeometry(s, 1, rand() * 6.28);
    g.rotateY(rand() * 6.28);
    // The stone's vertical half-extent is 0.82·s, so 0.42·s puts about a quarter
    // of it under the surface: contact guaranteed, no stone perched on the
    // grass, and none of them sunk to the equator.
    g.translate(x, h + s * 0.42, z);
    parts.boulder.push(g);
  }

  // --- a fallen rafter: base on the surviving floor, top against the wall --
  {
    const a = new THREE.Vector3(11.60, h + 0.06, -16.10);
    const b = new THREE.Vector3(12.40, h + 1.88, -16.45);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(0.072, 0.095, len, 7);
    const dir = b.clone().sub(a).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.woodDirt.push(g);
  }

  // --- a rusted tin left on the niche shelf --------------------------------
  {
    const g = new THREE.CylinderGeometry(0.055, 0.048, 0.13, 10);
    g.translate(6.51, h + 1.00 + 0.065, -16.22);
    parts.rust.push(g);
  }

  // --- merge by material ---------------------------------------------------
  const group = new THREE.Group();
  group.name = 'SM_Ruins';
  const mats = {
    stone: materials.stone,
    stoneDark: materials.stoneDark,
    boulder: materials.boulder,
    rust: materials.rust,
    woodDirt: materials.woodDirt,
  };
  for (const [key, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) {
      console.warn('[ruins] merge failed for', key);
      continue;
    }
    const mesh = new THREE.Mesh(merged, mats[key].clone());
    mesh.name = 'Ruin_' + key;
    mesh.receiveShadow = true;
    group.add(mesh);
    // the merge made new buffers; the sources were never uploaded
    if (merged !== geos[0]) for (const g of geos) g.dispose();
  }
  scene.add(group);

  ruins.group = group;
  ruins.groundY = h;
  ruins.floorY = h + 0.05;
  ruins.colliders = architecture.colliders.filter((c) => c.kind === 'ruin').length;
  ruins.stones = rubbleSpots.length + blocks.length;
  ruins.parts = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length]));
  scene.userData.ruins = ruins;
  return ruins;
}
