// CABINETS — furniture you can actually open.
//
// The mansion's furniture GLB is a beautiful set of static pieces: each chest
// and dresser was exported as ONE merged mesh, so its drawer fronts are fused
// into the carcass and nothing about it can move. Rather than leave the player
// pulling at a painted box, the containers that are meant to be searchable are
// built here, as real joinery:
//
//   * a carcass with two sides, a top, a bottom, a back and a plinth — the
//     cavity between them is empty, so a drawer has somewhere to go;
//   * drawers with a bottom, two sides, a back and a separate front panel,
//     with 4 mm of clearance all round;
//   * brass handles, an inset front panel, and a runner on each side;
//   * a bounded 0.30 m travel along the cabinet's own front axis.
//
// The collision box is only the carcass. The drawer never pushes the player:
// it slides into space that was already validated as clear. Interactables are
// per drawer, at the drawer's own front, so the prompt appears on the drawer
// you are looking at rather than on the whole cabinet.
//
// These are placed only in rooms where a searchable container belongs. The
// static wardrobes and cupboards elsewhere stay scenery — the point of a
// searchable drawer is that not every box in the house is one.
//
// Everything is parented to one Group per unit and animated in game.update().

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps } from './materials.js';
import { box } from './primitives.js';
import { wallFace } from './architecture.js';
import { props } from './props.js';

export const cabinets = { units: [], errors: [], count: 0 };

const T = 0.022;          // carcass panel thickness
const GAP = 0.004;        // drawer-to-carcass clearance
const TRAVEL = 0.30;      // how far a drawer slides out

function mat(key, name) {
  // clone the material, share the texture: the map is already tiled in metres
  const m = materials[key].clone();
  m.name = name;
  tileMaps(m, 1, 1);
  return m;
}

// One cabinet. Local space: origin on the floor at the centre of the carcass,
// front facing +z, so a unit against a north wall is simply rotated by PI.
function makeUnit({ scene, level, room, x, z, rot, width, height, depth, drawers, label, contents }) {
  const group = new THREE.Group();
  group.name = 'Cabinet_' + label;
  group.position.set(x, level.y, z);
  group.rotation.y = rot;

  const W = width, H = height, D = depth;
  const carcass = [];

  // plinth and carcass shell
  carcass.push(box(W, 0.075, D - 0.05, 1).translate(0, 0.0375, -0.01));
  for (const sx of [-1, 1]) {
    const g = box(T, H - 0.075, D, 1);
    g.translate(sx * (W / 2 - T / 2), 0.075 + (H - 0.075) / 2, 0);
    carcass.push(g);
  }
  const top = box(W, 0.028, D, 1);
  top.translate(0, H - 0.014, 0);
  carcass.push(top);
  const bottom = box(W - 2 * T, 0.020, D - 0.02, 1);
  bottom.translate(0, 0.075 + 0.01, 0.01);
  carcass.push(bottom);
  const back = box(W - 2 * T, H - 0.11, 0.018, 1);
  back.translate(0, 0.075 + (H - 0.11) / 2, -D / 2 + 0.009);
  carcass.push(back);
  // a mid rail and a kick rail: without these the front reads as an open box
  for (const yy of [0.075 + 0.03, H - 0.06]) {
    const g = box(W - 2 * T, 0.05, 0.03, 1);
    g.translate(0, yy, D / 2 - 0.02);
    carcass.push(g);
  }

  const carcassMesh = new THREE.Mesh(merge(carcass), mat('woodDark', 'cabinet_carcass'));
  carcassMesh.castShadow = true;
  carcassMesh.receiveShadow = true;
  group.add(carcassMesh);

  const unit = {
    kind: 'cabinet', level: level.id, room: room.id, label,
    x, z, rot, w: W, h: H, d: D, y: level.y,
    group, drawers: [], open: false, contentsTaken: false,
  };

  // vertical split of the opening between the rails
  const inner0 = 0.075 + 0.06;
  const inner1 = H - 0.09;
  const innerH = inner1 - inner0;
  const n = drawers;
  for (let i = 0; i < n; i++) {
    const dh = innerH / n;
    const yc = inner0 + dh * (i + 0.5);

    const holder = new THREE.Group();
    holder.position.set(0, yc, 0);
    group.add(holder);

    const dw = W - 2 * T - GAP * 2;
    const dH = dh - GAP * 2 - 0.004;
    const dDepth = D - 0.075;

    const inner = [];   // the drawer box: bottom, sides, back
    const floor = box(dw - 0.028, 0.010, dDepth - 0.03, 1);
    floor.translate(0, -dH / 2 + 0.012, -0.012);
    inner.push(floor);
    for (const sx of [-1, 1]) {
      const g = box(0.012, dH - 0.028, dDepth - 0.03, 1);
      g.translate(sx * (dw / 2 - 0.018), 0, -0.012);
      inner.push(g);
    }
    const rb = box(dw - 0.03, dH - 0.028, 0.012, 1);
    rb.translate(0, 0, -D / 2 + 0.05);
    inner.push(rb);
    const innerMesh = new THREE.Mesh(merge(inner), mat('wood', 'drawer_interior'));
    innerMesh.receiveShadow = true;
    holder.add(innerMesh);

    // the front is a separate panel, proud of the carcass and not fused to it
    const frontParts = [];
    const fh = dH;
    frontParts.push(box(dw, fh, 0.022, 1).translate(0, 0, D / 2 - 0.011));
    // raised centre panel
    frontParts.push(box(dw - 0.10, fh - 0.075, 0.012, 1).translate(0, 0, D / 2 + 0.006));
    // handle: two posts and a bar
    for (const sx of [-1, 1]) {
      const post = box(0.012, 0.012, 0.028, 1);
      post.translate(sx * 0.075, 0.012, D / 2 + 0.024);
      frontParts.push(post);
    }
    frontParts.push(box(0.17, 0.018, 0.018, 1).translate(0, 0.012, D / 2 + 0.045));
    const frontMesh = new THREE.Mesh(merge(frontParts), mat('wood', 'drawer_front'));
    frontMesh.castShadow = true;
    holder.add(frontMesh);

    // runners: a visible slide each side, so the drawer reads as supported
    const runnerParts = [];
    for (const sx of [-1, 1]) {
      const g = box(0.016, 0.03, dDepth, 1);
      g.translate(sx * (dw / 2 + GAP + 0.008), -dH / 2 + 0.012, -0.012);
      runnerParts.push(g);
    }
    const runnerMesh = new THREE.Mesh(merge(runnerParts), mat('iron', 'drawer_runner'));
    holder.add(runnerMesh);

    const drawer = {
      index: i, holder, open: false, target: 0,
      travel: TRAVEL, yc,
      contents: null,
    };

    if (contents && i === contents.drawer) {
      const c = contents;
      const item = new THREE.Group();
      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xcfc3a4, roughness: 0.95, side: THREE.DoubleSide,
      });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.21), paperMat);
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = 0.08;
      sheet.position.set(0.02, -dH / 2 + 0.02, 0.02);
      item.add(sheet);
      holder.add(item);
      drawer.contents = { ...c, mesh: item };
    }

    unit.drawers.push(drawer);
  }

  // one collision box: the carcass only, so a drawer can never shove the body
  props.colliders.push({
    x1: x - W / 2, x2: x + W / 2, z1: z - D / 2, z2: z + D / 2,
    kind: 'furniture', y0: level.y, y1: level.y + H,
  });

  // register one interaction per drawer, at that drawer's front face
  const cos = Math.cos(rot), sin = Math.sin(rot);
  for (const drawer of unit.drawers) {
    const lx = 0, lz = D / 2 + 0.03;
    const wx = x + lx * cos + lz * sin;
    const wz = z - lx * sin + lz * cos;
    const target = {
      id: `drawer:${label}:${drawer.index}`,
      name: drawer.index === 0 ? 'the top drawer' : drawer.index === 1 ? 'the middle drawer' : 'the bottom drawer',
      kind: 'drawer', unit, drawer, room: room.name,
      x: wx, y: level.y + drawer.yc, z: wz,
    };
    props.interactables.push(target);
    drawer.targetEntry = target;
  }


  scene.add(group);
  cabinets.units.push(unit);
  cabinets.count++;
  return unit;
}

function merge(geos) {
  return geos.length === 1 ? geos[0] : mergeGeometries(geos);
}

export function updateCabinets(dt) {
  for (const u of cabinets.units) {
    for (const d of u.drawers) {
      const p = d.holder.position;
      if (Math.abs(p.z - d.target) < 1e-4) continue;
      p.z += (d.target - p.z) * Math.min(1, dt * 8);
      if (Math.abs(p.z - d.target) < 1e-3) p.z = d.target;
    }
  }
}

export function toggleDrawer(unit, drawer) {
  drawer.open = !drawer.open;
  drawer.target = drawer.open ? drawer.travel : 0;
  // The interaction point deliberately stays on the CLOSED front. Moving it
  // out with the drawer made the focus jump to a neighbouring drawer as soon
  // as this one opened; a person reaches for the opening, wherever the front
  // has slid to.
  void unit;
  return drawer.open;
}

// --- placement -------------------------------------------------------------
// A wall-backed spot with real clearance: inside the room's plaster line, out
// of every door's approach, and clear of every piece of furniture already
// placed on this floor. Searches along each wall in 10 cm steps and takes the
// candidate nearest the room's centre, so the piece lands where a person would
// put it rather than wherever the scan happened to start.
function overlaps(a, b, pad = 0.02) {
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad;
}

function spotFor(level, room, W, D, H) {
  const rect = {
    x0: room.x0 + wallFace(level, 'z', room.x0).half,
    x1: room.x1 - wallFace(level, 'z', room.x1).half,
    z0: room.z0 + wallFace(level, 'x', room.z0).half,
    z1: room.z1 - wallFace(level, 'x', room.z1).half,
  };
  const doors = [];
  for (const d of level.doors) {
    if (d.axis === 'x' && d.c >= room.z0 - 0.4 && d.c <= room.z1 + 0.4 && d.at > room.x0 - 0.4 && d.at < room.x1 + 0.4) {
      doors.push({ x0: d.at - d.w / 2 - 0.55, x1: d.at + d.w / 2 + 0.55, z0: d.c - 1.0, z1: d.c + 1.0 });
    }
    if (d.axis === 'z' && d.c >= room.x0 - 0.4 && d.c <= room.x1 + 0.4 && d.at > room.z0 - 0.4 && d.at < room.z1 + 0.4) {
      doors.push({ x0: d.c - 1.0, x1: d.c + 1.0, z0: d.at - d.w / 2 - 0.55, z1: d.at + d.w / 2 + 0.55 });
    }
  }
  const solids = props.colliders.filter((c) => c.y0 !== undefined && c.y0 < level.y + H && c.y1 > level.y + 0.05);
  const ok = (b) => {
    if (b.x0 < rect.x0 + 0.05 || b.x1 > rect.x1 - 0.05) return false;
    if (b.z0 < rect.z0 + 0.05 || b.z1 > rect.z1 - 0.05) return false;
    for (const z of doors) if (overlaps(b, z, 0)) return false;
    for (const c of solids) {
      if (overlaps(b, { x0: c.x1, x1: c.x2, z0: c.z1, z1: c.z2 }, 0.04)) return false;
    }
    return true;
  };

  const midX = (rect.x0 + rect.x1) / 2, midZ = (rect.z0 + rect.z1) / 2;
  const walls = ['S', 'N', 'W', 'E'];
  let best = null;
  for (const wall of walls) {
    const rot = wall === 'N' ? Math.PI : wall === 'S' ? 0 : wall === 'E' ? -Math.PI / 2 : Math.PI / 2;
    const gap = 0.05;
    let fixed, a0, a1;
    if (wall === 'N' || wall === 'S') {
      fixed = wall === 'N' ? rect.z1 - gap - D / 2 : rect.z0 + gap + D / 2;
      a0 = rect.x0 + W / 2 + 0.08; a1 = rect.x1 - W / 2 - 0.08;
    } else {
      fixed = wall === 'E' ? rect.x1 - gap - D / 2 : rect.x0 + gap + D / 2;
      a0 = rect.z0 + W / 2 + 0.08; a1 = rect.z1 - W / 2 - 0.08;
    }
    if (a1 < a0) continue;
    for (let a = a0; a <= a1 + 1e-6; a += 0.10) {
      const x = wall === 'N' || wall === 'S' ? a : fixed;
      const z = wall === 'N' || wall === 'S' ? fixed : a;
      const halfW = (wall === 'N' || wall === 'S') ? W / 2 : D / 2;
      const halfD = (wall === 'N' || wall === 'S') ? D / 2 : W / 2;
      const b = { x0: x - halfW, x1: x + halfW, z0: z - halfD, z1: z + halfD };
      if (!ok(b)) continue;
      const score = Math.hypot(x - midX, z - midZ);
      if (!best || score < best.score) best = { x, z, rot, score, box: b };
    }
  }
  return best;
}

// --- the authored containers ----------------------------------------------
// Only these rooms get functional containers. The rest of the house keeps the
// static furniture set, which is the intended distinction between furniture
// and a searchable cabinet.
const PROGRAM = [
  { level: 'F2', room: 'FF2-03', label: 'master_dresser', w: 1.10, h: 0.92, d: 0.50, drawers: 3,
    contents: { drawer: 0, id: 'letter', name: 'a folded letter',
      text: 'A letter in your mother\'s hand. "The east room key is in the desk by the window. Do not let your father run the generator after dark."' } },
  { level: 'F2', room: 'FF2-06', label: 'bedroom3_nightstand', w: 0.72, h: 0.62, d: 0.42, drawers: 2,
    contents: { drawer: 1, id: 'photograph', name: 'a water-stained photograph',
      text: 'Four people on the porch. One face has been scratched out with a fingernail, over and over.' } },
  { level: 'GF', room: 'GF-06', label: 'study_pedestal', w: 0.72, h: 0.76, d: 0.52, drawers: 3,
    contents: { drawer: 2, id: 'ledgerpage', name: 'a ledger page',
      text: 'A page torn from the estate ledger: "August — fuel, one drum. Fuse, one. Paid in cash. The house will not take the current."' } },
  { level: 'GF', room: 'GF-01', label: 'kitchen_drawers', w: 0.90, h: 0.86, d: 0.50, drawers: 3,
    contents: { drawer: 1, id: 'matches', name: 'a box of matches',
      text: 'A box of matches, damp at one corner. Enough to strike once.' } },
  // The foyer cabinet used to stand on the west wall, in the gap between the
  // wall and the stair tower: with the static console it sealed the approach
  // to the grand stair. It belongs in the sitting room, and the foyer keeps
  // its console on the east wall.
  { level: 'GF', room: 'GF-15', label: 'sitting_console', w: 1.05, h: 0.80, d: 0.40, drawers: 2, contents: null },
];

export function buildCabinets(scene, levels) {
  cabinets.units.length = 0;
  cabinets.errors.length = 0;
  cabinets.count = 0;
  for (const spec of PROGRAM) {
    const level = levels.find((l) => l.id === spec.level);
    const room = level?.rooms.find((r) => r.id === spec.room);
    if (!room) { cabinets.errors.push('no room ' + spec.level + '/' + spec.room); continue; }
    const spot = spotFor(level, room, spec.w, spec.d, spec.h);
    if (!spot) { cabinets.errors.push('no clear wall for ' + spec.label); continue; }
    makeUnit({
      scene, level, room, x: spot.x, z: spot.z, rot: spot.rot,
      width: spec.w, height: spec.h, depth: spec.d,
      drawers: spec.drawers, label: spec.label, contents: spec.contents,
    });
  }
  return cabinets;
}
