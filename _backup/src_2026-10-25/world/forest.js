// FOREST — instanced, grounded, and deliberately sparse enough to walk through.
//
// Three tree archetypes are built once from cylinders and leaf cards and then
// drawn as two InstancedMeshes each (bark + foliage). Every placement samples
// heightAt() for its root, so nothing floats; every placement is rejected if it
// falls on the road, the house pad, the approach path, the pond, or the ruins.
// That is the whole reason the old forest had branches through the porch: trees
// were scattered on a grid and the house was added afterwards.
//
// Foliage is alpha-tested cards with a procedural leaf map. It is not a
// photogrammetry canopy, but it gives a real silhouette at night, costs one
// draw call per archetype, and can be shadowed by the moon without tanking the
// frame rate on an integrated GPU.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, MANSION, ROAD_X, roadCenter, POND } from './terrain.js';
import { architecture } from './architecture.js';
import { materials, leafMaterial, fernMaterial, tileMaps } from './materials.js';

const rand = (() => {
  let s = 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
})();

export const APPROACH = [
  [-55, 32], [-48, 30], [-40, 27], [-32, 24], [-24, 21], [-18, 19], [-15, 17.5], [-8, 16], [-1, 14.5],
];

function pointSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l = dx * dx + dz * dz;
  let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function nearApproach(x, z, pad = 3) {
  for (let i = 0; i < APPROACH.length - 1; i++) {
    const a = APPROACH[i], b = APPROACH[i + 1];
    if (pointSegDist(x, z, a[0], a[1], b[0], b[1]) < pad) return true;
  }
  return false;
}

export function isClear(x, z, tree = 0) {
  if (x > MANSION.x0 - 7 && x < MANSION.x1 + 7 && z > MANSION.z0 - 7 && z < MANSION.z1 + 7) return false;
  if (Math.abs(x - roadCenter(z)) < 9.2) return false;
  if (nearApproach(x, z, 3.2)) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5) return false;
  // ruins clearing east of the approach
  if (Math.hypot(x - 10, z + 19) < 7) return false;
  // camp clearing south-west of the pond
  if (Math.hypot(x + 12, z - 34) < 6) return false;
  if (tree > 0 && rand() < tree) return false;
  return true;
}

// --- tree archetypes -------------------------------------------------------
function taper(r0, r1, h, seg = 7) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true);
  g.translate(0, h / 2, 0);
  return g;
}

function card(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  return g;
}

function buildTree(kind) {
  const bark = [];
  const leaves = [];
  const tier = [
    { h: [11, 15], r: 1.9, trunk: 0.34, crown: 3.4, cards: 26 },
    { h: [14, 19], r: 2.2, trunk: 0.44, crown: 4.1, cards: 30 },
    { h: [9, 12], r: 1.5, trunk: 0.26, crown: 2.8, cards: 20 },
  ][kind];
  const H = tier.h[0] + rand() * (tier.h[1] - tier.h[0]);

  // trunk with a buttressed base: the flare is four angled cylinders, so the
  // tree meets the ground instead of being pushed into it like a post
  bark.push(taper(tier.trunk * 1.18, tier.trunk * 0.52, H, 8));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.4;
    const g = taper(tier.trunk * 0.8, tier.trunk * 0.18, 1.2, 5);
    g.rotateZ(0.55 + rand() * 0.2);
    g.rotateY(a);
    g.translate(Math.cos(a) * tier.trunk * 0.5, 0.05, Math.sin(a) * tier.trunk * 0.5);
    bark.push(g);
  }

  // limbs: leaning out of the upper trunk, each ending in a leaf cluster
  const limbs = 7;
  for (let i = 0; i < limbs; i++) {
    const y = H * (0.5 + 0.42 * (i / limbs));
    const a = (i / limbs) * Math.PI * 2 + rand() * 0.7;
    const len = 2.2 + rand() * 2.6;
    const g = taper(tier.trunk * 0.34, tier.trunk * 0.1, len, 5);
    g.rotateZ(0.95 + rand() * 0.35);
    g.rotateY(-a);
    g.translate(Math.cos(a) * tier.trunk * 0.4, y, Math.sin(a) * tier.trunk * 0.4);
    bark.push(g);

    const ex = Math.cos(a) * (tier.trunk * 0.4 + len * 0.55);
    const ez = Math.sin(a) * (tier.trunk * 0.4 + len * 0.55);
    const ey = y + len * 0.45;
    for (let c = 0; c < 4; c++) {
      const p = card(tier.crown * (0.7 + rand() * 0.5), tier.crown * (0.6 + rand() * 0.4));
      p.rotateX(-0.2 + rand() * 0.5);
      p.rotateY(rand() * Math.PI * 2);
      p.translate(ex + (rand() - 0.5) * 2.4, ey + (rand() - 0.5) * 1.6, ez + (rand() - 0.5) * 2.4);
      leaves.push(p);
    }
  }

  // crown cards
  for (let i = 0; i < tier.cards; i++) {
    const a = rand() * Math.PI * 2;
    const r = tier.r * Math.sqrt(rand());
    const y = H * (0.68 + rand() * 0.34);
    const p = card(tier.crown * (0.65 + rand() * 0.65), tier.crown * (0.55 + rand() * 0.5));
    p.rotateX(-0.45 + rand() * 0.9);
    p.rotateY(rand() * Math.PI * 2);
    p.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    leaves.push(p);
  }

  return {
    bark: mergeGeometries(bark),
    leaves: mergeGeometries(leaves),
    H,
  };
}

function placeInstances(scene, geo, mat, placements, name) {
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  placements.forEach((pl, i) => {
    p.set(pl.x, pl.y, pl.z);
    q.setFromEuler(new THREE.Euler(0, pl.rot, pl.lean || 0));
    s.set(pl.s, pl.s * (pl.sy || 1), pl.s);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  // three instances share the archetype's bounding sphere; expand it so a
  // tall tree is never culled while its crown is still on screen
  mesh.computeBoundingSphere?.();
  scene.add(mesh);
  return mesh;
}

export function buildForest(scene) {
  const archetypes = [0, 1, 2].map(buildTree);
  const barkMat = materials.bark.clone();
  tileMaps(barkMat, 2, 6);
  const leafMats = [leafMaterial(0), leafMaterial(1), leafMaterial(2)];

  const groups = [[], [], []];
  // Poisson-ish rejection: 900 candidates, keep those with clearance.
  for (let i = 0; i < 1500; i++) {
    const a = rand() * Math.PI * 2;
    const r = 12 + Math.sqrt(rand()) * 128;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!isClear(x, z, 0.12)) continue;
    // keep a 7 m island around the breakdown pull-off and the gate readable:
    // the car ends up on the west shoulder at (-58.6, -6) and the headlights
    // need space to fall on it, not on a wall of bark
    if (Math.hypot(x + 58.6, z + 6) < 7) continue;
    if (Math.hypot(x + 15, z - 18) < 6) continue;
    // thin the trees right on the road verge so the headlights have a wall of
    // trunks and not a tunnel of leaves
    const kind = Math.hypot(x, z) > 90 ? (rand() < 0.5 ? 2 : 0) : (rand() < 0.55 ? 0 : rand() < 0.7 ? 1 : 2);
    groups[kind].push({
      x, y: heightAt(x, z) - 0.12, z,
      rot: rand() * Math.PI * 2,
      s: 0.82 + rand() * 0.4,
      lean: (rand() - 0.5) * 0.05,
    });
    if (groups[0].length + groups[1].length + groups[2].length > 340) break;
  }

  // Trunk colliders: a walker (or a dying car) meets real wood. Degenerate
  // segments — a point — are handled by the same distance test the walls use.
  for (const g of groups) {
    for (const t of g) {
      architecture.colliders.push({
        x1: t.x, z1: t.z, x2: t.x, z2: t.z, kind: 'tree', y0: -2, y1: 3.5,
      });
    }
  }

  const trees = [];
  archetypes.forEach((a, i) => {
    if (!groups[i].length) return;
    trees.push(placeInstances(scene, a.bark, barkMat, groups[i], 'TreeBark' + i));
    trees.push(placeInstances(scene, a.leaves, leafMats[i], groups[i], 'TreeLeaves' + i));
  });

  // --- understory: ferns, saplings, shrubs --------------------------------
  const fernGeo = (() => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const p = card(1.1, 1.0);
      p.rotateY((i / 3) * Math.PI);
      parts.push(p);
    }
    return mergeGeometries(parts);
  })();
  const under = [];
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2;
    const r = 10 + Math.sqrt(rand()) * 110;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!isClear(x, z)) continue;
    if (Math.abs(x - roadCenter(z)) < 5) continue;
    if (Math.hypot(x + 58, z - 26) < 4) continue;
    under.push({ x, y: heightAt(x, z) + 0.35, z, rot: rand() * 6, s: 0.7 + rand() * 0.9 });
  }
  const underMesh = placeInstances(scene, fernGeo, fernMaterial(), under, 'Understory');

  // --- rocks: deformed, half-buried, never floating -----------------------
  const rockGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = 1 + 0.22 * Math.sin(x * 3.1 + z * 2.3) + 0.12 * Math.cos(y * 4.2);
      pos.setXYZ(i, x * n * 1.25, y * n * 0.8, z * n);
    }
    g.computeVertexNormals();
    return g;
  })();
  const rockMat = materials.boulder.clone();
  tileMaps(rockMat, 1, 1);
  const rocks = [];
  for (let i = 0; i < 220; i++) {
    const a = rand() * Math.PI * 2;
    const r = 14 + Math.sqrt(rand()) * 105;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!isClear(x, z)) continue;
    if (Math.hypot(x + 58, z - 26) < 5) continue;
    const s = 0.35 + Math.pow(rand(), 2) * 1.5;
    rocks.push({ x, y: heightAt(x, z) - s * 0.28, z, rot: rand() * 6.28, s, sy: 0.6 + rand() * 0.3 });
  }
  placeInstances(scene, rockGeo, rockMat, rocks, 'Rocks');

  // --- fallen logs --------------------------------------------------------
  const logGeo = new THREE.CylinderGeometry(0.17, 0.22, 4.2, 7);
  logGeo.rotateZ(Math.PI / 2);
  const logs = [];
  for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!isClear(x, z)) continue;
    logs.push({ x, y: heightAt(x, z) + 0.18, z, rot: rand() * 6.28, s: 1 });
  }
  placeInstances(scene, logGeo, barkMat, logs, 'FallenLogs');

  scene.userData.forest = { trees, underMesh, rocks: rocks.length, treeCount: groups.reduce((n, g) => n + g.length, 0) };
  return scene.userData.forest;
}

// --- trails ---------------------------------------------------------------
// The approach is a compacted-earth track from the road verge to the porch.
// It is a ribbon laid on the height field + 2 cm, not a decal, and trees are
// rejected along it above, so it is walkable by construction.
export function buildTrails(scene) {
  const mat = materials.groundForest.clone();
  mat.color.setHex(0x8b7c5c);
  tileMaps(mat, 1.2, 12);
  mat.roughness = 1;

  const pts = APPROACH.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.04, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
  const steps = 90;
  const pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(tan, up).normalize();
    const w = (2.6 - t * 1.1) / 2;
    const l = p.clone().addScaledVector(side, -w);
    const r = p.clone().addScaledVector(side, w);
    pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
    uv.push(0, t * 16, 1, t * 16);
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'SM_ApproachPath';
  scene.add(mesh);

  // forecourt: a gravel apron between the porch and the gate
  const fore = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), mat);
  fore.rotation.x = -Math.PI / 2;
  fore.position.set(-3, 0.045, 16);
  fore.name = 'SM_Forecourt';
  scene.add(fore);
  return mesh;
}

export function disposeForest(forest) {
  for (const m of forest.trees) m.geometry.dispose();
  forest.underMesh.geometry.dispose();
}
