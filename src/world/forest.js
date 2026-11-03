// FOREST — instanced, grounded, and deliberately sparse enough to walk through.
//
// A tree here is GROWN, not stacked. Each species is described by its habit —
// how the trunk runs, where the first limb leaves, how many times the branching
// splits, what the crown is made of — and one recursive routine builds all of
// them. That is the difference between a forest and 341 copies of a cylinder
// with a ball of quads on top:
//
//   * the trunk is a swept five-segment curve, not a vertical post, so no two
//     trees have the same axis;
//   * buttress roots leave the trunk a metre up and run out into the ground,
//     which is what makes a tree stand on the floor instead of being pushed
//     through it;
//   * limbs branch twice, so the silhouette is a tree fork, not a bundle of
//     spokes with leaves at the tip;
//   * foliage is placed in LAYERS — a ring of cards per height band of the
//     crown, plus a cloud at each twig end — so the canopy has strata, gaps and
//     a ragged edge instead of being a sphere.
//
// Ten archetypes (two per species) are built once and drawn with InstancedMesh,
// two draw calls each. Per-instance scale, height, lean, rotation and leaf tint
// give 341 trees with no two silhouettes alike. Leaf tint rides instanceColor,
// which costs no extra geometry or draw call.
//
// Every placement samples heightAt() for its root, so nothing floats; every
// placement is rejected if it falls on the road, the house pad, the approach
// path, the pond, or the ruins.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, MANSION, roadCenter, POND } from './terrain.js';
import { architecture } from './architecture.js';
import { materials, leafMaterial, fernMaterial, tileMaps, applyWind } from './materials.js';

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

// --- species --------------------------------------------------------------
// Five habits, not five sizes of one tree:
//   0 emergent dipterocarp — tall, straight trunk, crown high and spreading
//   1 broad hardwood       — short thick trunk, wide low dome, heavy limbs
//   2 slender subcanopy    — thin, leaning, small open crown, deep understorey
//   3 balete / banyan      — huge buttress, multi-stem crown, aerial roots
//   4 dead snag            — bare branching skeleton, broken top, no leaves
//
// `depth` is the number of limb levels: level 0 leaves the trunk, level 1
// forks, and the tips of the last level carry the twig cards.
const SPECIES = [
  {
    id: 'emergent', h: [17, 21.5], trunk: 0.40, taper: 0.52, sway: 0.22,
    roots: 6, rootRise: 1.15, limbs: 5, limbAt: [0.50, 0.86], limbLen: 3.5,
    depth: 3, kids: 3, droop: 0.50, branchUp: 0.62,
    crownY: [0.60, 1.00], crownR: 3.4, shell: 68, layers: 5, tip: 2, card: 1.15, leaf: 0,
  },
  {
    id: 'broad', h: [12, 16], trunk: 0.46, taper: 0.60, sway: 0.30,
    roots: 8, rootRise: 0.95, limbs: 6, limbAt: [0.32, 0.72], limbLen: 3.1,
    depth: 3, kids: 3, droop: 0.80, branchUp: 0.45,
    crownY: [0.44, 0.98], crownR: 4.2, shell: 76, layers: 5, tip: 2, card: 1.1, leaf: 1,
  },
  {
    id: 'slender', h: [7.5, 11], trunk: 0.20, taper: 0.50, sway: 0.38,
    roots: 5, rootRise: 0.55, limbs: 4, limbAt: [0.44, 0.80], limbLen: 1.9,
    depth: 2, kids: 3, droop: 0.95, branchUp: 0.55,
    crownY: [0.54, 1.00], crownR: 2.0, shell: 46, layers: 4, tip: 3, card: 0.82, leaf: 2,
  },
  {
    id: 'balete', h: [11, 14.5], trunk: 0.64, taper: 0.34, sway: 0.55,
    roots: 9, rootRise: 1.55, limbs: 5, limbAt: [0.34, 0.74], limbLen: 4.0,
    depth: 3, kids: 3, droop: 0.95, branchUp: 0.32,
    crownY: [0.33, 0.92], crownR: 5.0, shell: 88, layers: 5, tip: 2, card: 1.2, leaf: 0,
    aerial: 6,
  },
  {
    id: 'snag', h: [8, 14], trunk: 0.34, taper: 0.72, sway: 0.28,
    roots: 7, rootRise: 0.85, limbs: 5, limbAt: [0.34, 0.92], limbLen: 2.4,
    depth: 3, kids: 2, droop: 0.65, branchUp: 0.50,
    crownY: [0, 0], crownR: 0, shell: 0, layers: 0, tip: 0, card: 0, leaf: -1,
  },
];

const UP = new THREE.Vector3(0, 1, 0);

// A tapered cylinder between two points. Closed ends are used where a joint is
// thick enough to show a gap; open ends save triangles under the foliage.
function cylBetween(a, b, r0, r1, seg, closed = false) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 1e-3) return null;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, !closed);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// A foliage card. Crossed pairs are used on the outer crown, where a single
// quad seen edge-on would vanish and leave a hole in the silhouette.
function addCard(list, x, y, z, size) {
  const w = size * (0.80 + rand() * 0.5);
  const h = size * (0.72 + rand() * 0.45);
  let card = new THREE.PlaneGeometry(w, h);
  if (rand() < 0.55) {
    const b = new THREE.PlaneGeometry(w, h);
    b.rotateY(Math.PI / 2);
    card = mergeGeometries([card, b]);
  }
  card.rotateX(-0.65 + rand() * 1.3);
  card.rotateY(rand() * Math.PI * 2);
  card.rotateZ(-0.45 + rand() * 0.9);
  card.translate(x, y, z);
  list.push(card);
}

function trunkPointAt(pts, t) {
  const n = pts.length - 1;
  const f = Math.max(0, Math.min(0.9999, t)) * n;
  const i = Math.floor(f);
  return pts[i].clone().lerp(pts[i + 1], f - i);
}

// Recursive limb growth. Two chained segments per level, gravity bending the
// axis down and outwards, then either a fork or a twig cloud.
function growLimbs(bark, tips, sp, from, dir, len, r, depth) {
  let p = from.clone();
  const d = dir.clone().normalize();
  const SEG = 2;
  for (let i = 0; i < SEG; i++) {
    const q = p.clone().addScaledVector(d, len / SEG);
    const r0 = r * (1 - 0.30 * (i / SEG)) * 1.02;
    const r1 = r * (1 - 0.34 * ((i + 1) / SEG));
    const g = cylBetween(p, q, r0, r1, depth === 0 ? 6 : 4, depth === 0);
    if (g) bark.push(g);
    p = q;
    d.y -= sp.droop * 0.10 * (depth + 1);
    d.normalize();
  }

  if (depth >= sp.depth - 1) {
    tips.push({ p, d: d.clone(), r });
    return;
  }
  const baseA = Math.atan2(d.z, d.x);
  for (let k = 0; k < sp.kids; k++) {
    const a = baseA + (k / sp.kids) * Math.PI * 1.15 + (rand() - 0.5) * 0.9;
    const spread = 0.50 + rand() * 0.45;
    const nd = new THREE.Vector3(
      Math.cos(a) * spread + d.x * 0.55,
      Math.max(0.05, d.y * 0.72 + sp.branchUp * 0.55),
      Math.sin(a) * spread + d.z * 0.55,
    ).normalize();
    growLimbs(bark, tips, sp, p, nd, len * (0.56 + rand() * 0.16), r * 0.54, depth + 1);
  }
}

function buildTree(species) {
  const sp = SPECIES[species];
  const bark = [];
  const leaves = [];
  const tips = [];
  const H = sp.h[0] + rand() * (sp.h[1] - sp.h[0]);
  const phase = rand() * Math.PI * 2;

  // --- trunk: a swept curve, sunk 0.22 m so the base cannot float ----------
  const N = 5;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const wander = sp.sway * t * t;
    pts.push(new THREE.Vector3(
      Math.sin(t * 2.4 + phase) * wander + (rand() - 0.5) * 0.03,
      -0.22 + t * H,
      Math.cos(t * 1.9 + phase * 1.3) * wander + (rand() - 0.5) * 0.03,
    ));
  }
  for (let i = 0; i < N; i++) {
    const r0 = sp.trunk * (1 - sp.taper * (i / N)) * (i === 0 ? 1.22 : 1);
    const r1 = sp.trunk * (1 - sp.taper * ((i + 1) / N));
    const g = cylBetween(pts[i], pts[i + 1], r0, r1, 8, true);
    if (g) bark.push(g);
  }

  // --- buttress roots: leave the trunk high, run out and under the ground --
  for (let i = 0; i < sp.roots; i++) {
    const a = (i / sp.roots) * Math.PI * 2 + phase * 0.7 + rand() * 0.5;
    const rise = sp.rootRise * (0.78 + rand() * 0.5);
    const reach = sp.trunk * 1.1 + 0.45 + rand() * 0.5;
    const cos = Math.cos(a), sin = Math.sin(a);
    const p0 = new THREE.Vector3(cos * sp.trunk * 0.72, rise, sin * sp.trunk * 0.72);
    const p1 = new THREE.Vector3(cos * reach * 0.62, rise * 0.42, sin * reach * 0.62);
    const p2 = new THREE.Vector3(cos * reach * 1.05, 0.10, sin * reach * 1.05);
    const p3 = new THREE.Vector3(cos * reach * 1.34, -0.22, sin * reach * 1.34);
    const r0 = sp.trunk * (0.20 + rand() * 0.08);
    for (const [a1, b1, ra, rb] of [
      [p0, p1, r0, r0 * 0.62],
      [p1, p2, r0 * 0.62, r0 * 0.34],
      [p2, p3, r0 * 0.34, r0 * 0.10],
    ]) {
      const g = cylBetween(a1, b1, ra, rb, 4, false);
      if (g) bark.push(g);
    }
  }

  // --- limbs ---------------------------------------------------------------
  for (let i = 0; i < sp.limbs; i++) {
    const t = sp.limbAt[0] + (sp.limbAt[1] - sp.limbAt[0]) * (i / Math.max(1, sp.limbs - 1));
    const p = trunkPointAt(pts, t);
    const a = (i / sp.limbs) * Math.PI * 2 + phase + rand() * 0.6;
    const up = sp.branchUp + rand() * 0.28;
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
    growLimbs(bark, tips, sp, p, dir, sp.limbLen * (0.82 + rand() * 0.34), sp.trunk * 0.52, 0);
  }

  // --- aerial roots: the balete's giveaway, straight down to the ground ----
  if (sp.aerial) {
    for (let i = 0; i < sp.aerial; i++) {
      const t = 0.55 + rand() * 0.4;
      const p = trunkPointAt(pts, t);
      const a = rand() * Math.PI * 2;
      const out = 1.2 + rand() * 3.2;
      const top = p.clone().add(new THREE.Vector3(Math.cos(a) * out, 0.4, Math.sin(a) * out));
      const foot = new THREE.Vector3(
        top.x + (rand() - 0.5) * 0.6, -0.18, top.z + (rand() - 0.5) * 0.6,
      );
      const mid = top.clone().lerp(foot, 0.5).add(new THREE.Vector3((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3));
      const r = 0.045 + rand() * 0.055;
      for (const [a1, b1] of [[top, mid], [mid, foot]]) {
        const g = cylBetween(a1, b1, r, r * 0.85, 4, false);
        if (g) bark.push(g);
      }
    }
  }

  // --- foliage: layered shell + twig clouds -------------------------------
  if (sp.leaf >= 0 && sp.shell > 0) {
    const y0 = H * sp.crownY[0];
    const y1 = H * sp.crownY[1];
    const span = y1 - y0;
    for (let l = 0; l < sp.layers; l++) {
      const t = sp.layers === 1 ? 0.5 : l / (sp.layers - 1);
      // widest just under the middle: a crown is a dome, not a cylinder
      const shape = Math.sin(Math.PI * (0.30 + 0.60 * t));
      const R = sp.crownR * (0.52 + 0.52 * shape);
      const count = Math.max(3, Math.round((sp.shell / sp.layers) * (1.18 - 0.36 * t)));
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const rr = R * (0.30 + 0.70 * Math.sqrt(rand()));
        addCard(
          leaves,
          Math.cos(a) * rr,
          y0 + span * t + (rand() - 0.5) * span * 0.16,
          Math.sin(a) * rr,
          sp.card * (0.62 + rand() * 0.5),
        );
      }
    }
    for (const tip of tips) {
      const n = sp.tip + (rand() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        addCard(
          leaves,
          tip.p.x + (rand() - 0.5) * 1.1,
          tip.p.y + (rand() - 0.5) * 0.8,
          tip.p.z + (rand() - 0.5) * 1.1,
          sp.card * (0.48 + rand() * 0.32),
        );
      }
    }
  }

  const barkGeo = bark.length ? mergeGeometries(bark) : null;
  const leafGeo = leaves.length ? mergeGeometries(leaves) : null;
  if (barkGeo) barkGeo.computeBoundingSphere();
  if (leafGeo) leafGeo.computeBoundingSphere();
  return { bark: barkGeo, leaves: leafGeo, H, species };
}

const ARCHETYPES = [];
export const SPECIES_NAMES = SPECIES.map((s) => s.id);
for (let i = 0; i < SPECIES.length * 2; i++) {
  ARCHETYPES.push(buildTree(i % SPECIES.length));
}

// Per-instance colour: leaf cards are all one texture, and a forest of one
// green is a tell. This shifts each tree towards yellow, olive or deep blue-
// green without touching the geometry, the draw count or the shader program.
const TINTS = [
  new THREE.Color(0xd8e0b4), new THREE.Color(0xb9c79a), new THREE.Color(0xa9bd8c),
  new THREE.Color(0xc9cda0), new THREE.Color(0x93a87e), new THREE.Color(0xe0d9a8),
];

function placeInstances(scene, geo, mat, placements, name, tinted = false) {
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  placements.forEach((pl, i) => {
    p.set(pl.x, pl.y, pl.z);
    q.setFromEuler(new THREE.Euler(pl.tiltx || 0, pl.rot, pl.lean || 0));
    s.set(pl.s, pl.s * (pl.sy || 1), pl.s);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (tinted) mesh.setColorAt(i, pl.tint);
    // The phase is baked in so every instance sways on its own clock instead
    // of a global metronome. `windTarget` will be updated per frame outside
    // the instance loop (it is shared), but the phase is per instance so
    // neighbouring trees never move in lockstep.
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = true;
  // all instances share the archetype's bounding sphere; expand it so a tall
  // tree is never culled while its crown is still on screen
  mesh.computeBoundingSphere?.();
  scene.add(mesh);
  return mesh;
}

export function buildForest(scene) {
  const barkMat = materials.bark.clone();
  tileMaps(barkMat, 2, 6);
  // A second bark for the wet, shaded, low trunks: tree_bark_03 is a 1 m tile
  // with deep vertical fissures and moss in the crevices, against bark_brown_02
  // at 2 m. The trunks are TubeGeometry, whose UVs run 0..1 around and 0..1
  // along, so the repeats are per trunk: 3 around a 2.5 m girth is 0.83 m per
  // tile and 6 along a swept trunk is ~2.5 m per tile, which keeps the grain
  // the size a 1 m photograph says it is. Giving the banyan and the subcanopy
  // this bark means the wood is not one identical tree repeated 600 times.
  const mossMat = materials.barkMoss.clone();
  tileMaps(mossMat, 3, 6);
  const MOSSY = new Set(['balete', 'slender']);
  const leafMats = [leafMaterial(0), leafMaterial(1), leafMaterial(2)];

  const groups = ARCHETYPES.map(() => []);
  // Poisson-ish rejection: 1500 candidates, keep those with clearance.
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
    const far = Math.hypot(x, z) > 90;
    // species mix by distance: the outer ring is mostly emergent and slender
    // subcanopy, the near wood has the broad crowns and the rare balete
    let species;
    const roll = rand();
    if (far) species = roll < 0.45 ? 0 : roll < 0.85 ? 2 : roll < 0.95 ? 1 : 4;
    else species = roll < 0.30 ? 0 : roll < 0.60 ? 1 : roll < 0.80 ? 2 : roll < 0.92 ? 4 : 3;
    const variant = rand() < 0.5 ? 0 : 1;
    const sp = SPECIES[species];
    const heightScale = 0.86 + rand() * 0.34;
    groups[species * 2 + variant].push({
      x, y: heightAt(x, z) - 0.12, z,
      rot: rand() * Math.PI * 2,
      s: (0.82 + rand() * 0.36) * (sp.id === 'slender' ? 1.05 : 1),
      // height varies independently of girth, so a thin tree is not just a
      // scaled copy of a fat one
      sy: heightScale,
      lean: (rand() - 0.5) * 0.055,
      tiltx: (rand() - 0.5) * 0.04,
      tint: TINTS[(rand() * TINTS.length) | 0],
      phase: rand() * 6.28,
      // Normalized vertical position of the tree's crown centre, used to
      // scale the sway amplitude so a fern barely moves and a canopy bends
      // a metre. It is computed per instance (not per tree) so each crown
      // shears around its own mid-height.
      h: Math.max(0, Math.min(1, (Math.max(0, (heightAt(x, z) - 3.0)) / 12.0))),
    });
    if (groups.reduce((n, g) => n + g.length, 0) > 340) break;
  }

  // Trunk colliders: a walker (or a dying car) meets real wood. Degenerate
  // segments — a point — are handled by the same distance test the walls use.
  // The height band follows the trunk's own ground level: a fixed band was
  // wrong for every tree not standing at y=0, which is most of the estate.
  for (const g of groups) {
    for (const t of g) {
      architecture.colliders.push({
        x1: t.x, z1: t.z, x2: t.x, z2: t.z, kind: 'tree',
        y0: t.y - 1.0, y1: t.y + 4.0,
      });
    }
  }

  // Per-instance animation state: each tree keeps its own sway phase and its
  // crown-height mask, so neighbouring canopies never swing in lockstep. It is
  // per ARCHETYPE, because a vertex attribute has to match the instance count of
  // the geometry it is attached to — the previous version built one buffer for
  // the whole forest and hung it on every mesh, which is both the wrong length
  // and the wrong object (a Mesh has no per-instance attributes; its geometry
  // does, and only as an InstancedBufferAttribute).
  const trees = [];
  const stats = {};
  ARCHETYPES.forEach((a, i) => {
    const g = groups[i];
    if (!g.length || !a.bark) return;
    const anim = new Float32Array(g.length * 2);
    for (let k = 0; k < g.length; k++) {
      anim[k * 2] = g[k].phase;      // per-instance sway phase (radians)
      anim[k * 2 + 1] = g[k].h;      // crown height mask (0..1)
    }
    const leafMesh = a.leaves
      ? placeInstances(scene, a.leaves, leafMats[SPECIES[a.species].leaf], g, 'TreeLeaves' + i, true)
      : null;
    if (leafMesh) {
      leafMesh.geometry.setAttribute('anim', new THREE.InstancedBufferAttribute(anim, 2));
      trees.push(leafMesh);
    }
    const bark = MOSSY.has(SPECIES[a.species].id) ? mossMat : barkMat;
    trees.push(placeInstances(scene, a.bark, bark, g, 'TreeBark' + i));
    const name = SPECIES[a.species].id + (i % 2 ? 'B' : 'A');
    stats[name] = (stats[name] || 0) + g.length;
  });

  // --- understory: ferns, saplings, shrubs --------------------------------
  const fernGeo = (() => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.PlaneGeometry(1.1, 1.0);
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
    under.push({ x, y: heightAt(x, z) + 0.35, z, rot: rand() * 6, s: 0.7 + rand() * 0.9, tint: TINTS[(rand() * TINTS.length) | 0] });
  }
  const underMesh = placeInstances(scene, fernGeo, fernMaterial(), under, 'Understory', true);

  // Individual grass blades break up the smooth ground plane at player height.
  // A clump is one small crossed mesh (not a billboard), then the whole field is
  // instanced. It follows the sampled terrain and shares the same route and
  // building clearances as the ferns, so it cannot grow through the porch or
  // across a walkable path.
  const grassGeo = (() => {
    const vertices = [], indices = [];
    for (let blade = 0; blade < 7; blade++) {
      const a = (blade / 7) * Math.PI * 2 + rand() * 0.5;
      const h = 0.20 + rand() * 0.34;
      const w = 0.025 + rand() * 0.018;
      const bx = Math.cos(a) * (0.025 + rand() * 0.08);
      const bz = Math.sin(a) * (0.025 + rand() * 0.08);
      const dx = Math.cos(a + 0.7) * w, dz = Math.sin(a + 0.7) * w;
      const sway = 0.035 + rand() * 0.06;
      const base = vertices.length / 3;
      vertices.push(
        bx - dx, 0, bz - dz, bx + dx, 0, bz + dz,
        bx + Math.cos(a) * sway + dx * 0.42, h * 0.58, bz + Math.sin(a) * sway + dz * 0.42,
        bx + Math.cos(a) * sway * 1.8, h, bz + Math.sin(a) * sway * 1.8,
      );
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  })();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x8d9b69, roughness: 0.96, side: THREE.DoubleSide,
  });
  applyWind(grassMat, 0.16);
  const grass = [];
  const grassTints = [0x879461, 0x9c9d69, 0x78875d, 0xa9a276, 0x697951];
  for (let i = 0; i < 9800; i++) {
    const a = rand() * Math.PI * 2;
    const r = 9 + Math.sqrt(rand()) * 112;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!isClear(x, z)) continue;
    if (Math.hypot(x + 58.6, z + 6) < 8) continue;
    grass.push({
      x, y: heightAt(x, z) + 0.012, z, rot: rand() * Math.PI * 2,
      s: 0.72 + rand() * 0.70,
      tint: new THREE.Color(grassTints[(rand() * grassTints.length) | 0]),
    });
  }
  const grassMesh = placeInstances(scene, grassGeo, grassMat, grass, 'ForestGrass', true);
  const grassAnim = new Float32Array(grass.length * 2);
  for (let i = 0; i < grass.length; i++) {
    grassAnim[i * 2] = rand() * Math.PI * 2;
    grassAnim[i * 2 + 1] = 0.05;
  }
  grassMesh.geometry.setAttribute('anim', new THREE.InstancedBufferAttribute(grassAnim, 2));

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

  const treeCount = groups.reduce((n, g) => n + g.length, 0);
  scene.userData.forest = {
    trees, underMesh, grassMesh, grassClumps: grass.length, rocks: rocks.length, treeCount, species: stats,
    barkTris: ARCHETYPES.reduce((n, a) => n + (a.bark ? a.bark.attributes.position.count / 3 : 0), 0),
    leafCards: ARCHETYPES.reduce((n, a) => n + (a.leaves ? a.leaves.attributes.position.count / 6 : 0), 0),
  };
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
  forest.grassMesh.geometry.dispose();
}
