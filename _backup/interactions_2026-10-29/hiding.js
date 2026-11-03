// HIDING — places you can actually get inside.
//
// The hiding spots are not triggers painted on scenery. Each one is a piece of
// joinery with a real cavity, a real opening and a real door swing:
//
//   * the armoire is three Blender nodes (carcass, left leaf, right leaf) so
//     the leaves turn on their hinges instead of being a single fused mesh;
//   * its interior is 1.26 m wide, 0.55 m deep and 2.0 m high, with the shelf
//     above head height so the camera never clips it;
//   * the iron bed stands 0.49 m off the floor, which is the clearance a person
//     needs to crawl under. The joinery beds in this house sit 0.17 m off the
//     floor, so they are deliberately NOT hiding places.
//
// This module owns geometry and placement only. The state machine (entering,
// concealed, peeking, leaving) lives in game.js, and the Resident's search of
// a spot lives in resident.js; both read the same `spot` records.
//
// A spot is registered as an interaction target just like a drawer, so the
// existing proximity/view-cone focus code finds it with no special case. The
// interaction carries the whole spot, not a coordinate in a wall.

import * as THREE from 'three';
import { materials, tileMaps } from './materials.js';
import { template } from './furniture.js';
import { props } from './props.js';
import { wallFace } from './architecture.js';

export const hiding = { spots: [], errors: [], count: 0 };

const ARMOIRE_W = 1.47;   // crown width, the widest part
const ARMOIRE_D = 0.74;
const EYE_IN = 1.52;      // camera height inside the armoire

function mat(key, name) {
  const m = materials[key].clone();
  m.name = name;
  tileMaps(m, 1, 1);
  return m;
}

function overlaps(a, b, pad = 0.02) {
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad;
}

// A clear run of wall for a piece W wide and D deep. This is the same rule the
// cabinets use — inside the plaster, out of every door approach, clear of every
// piece already on the floor — plus a swing test: the leaves need 0.85 m of
// clear floor in front, because they open before the player steps in.
function clearWallSpot(level, room, W, D, H, swing = 0) {
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
  const ok = (b, rot) => {
    if (b.x0 < rect.x0 + 0.05 || b.x1 > rect.x1 - 0.05) return false;
    if (b.z0 < rect.z0 + 0.05 || b.z1 > rect.z1 - 0.05) return false;
    for (const z of doors) if (overlaps(b, z, 0)) return false;
    // the leaves sweep in front of the piece; a wardrobe whose doors cannot
    // open is not a hiding place
    if (swing > 0) {
      const fx = Math.sin(rot), fz = Math.cos(rot);
      const cx = (b.x0 + b.x1) / 2 + fx * (D / 2 + swing / 2);
      const cz = (b.z0 + b.z1) / 2 + fz * (D / 2 + swing / 2);
      // Front is +/-Z for the N/S walls and +/-X for the E/W walls, so the
      // swept rectangle turns with the piece: W across the opening, swing deep.
      const s = Math.abs(fz) > 0.5
        ? { x0: cx - W / 2, x1: cx + W / 2, z0: cz - swing / 2, z1: cz + swing / 2 }
        : { x0: cx - swing / 2, x1: cx + swing / 2, z0: cz - W / 2, z1: cz + W / 2 };
      if (s.x0 < rect.x0 || s.x1 > rect.x1 || s.z0 < rect.z0 || s.z1 > rect.z1) return false;
      for (const c of solids) if (overlaps(s, { x0: c.x1, x1: c.x2, z0: c.z1, z1: c.z2 }, 0.02)) return false;
      for (const z of doors) if (overlaps(s, z, 0)) return false;
    }
    for (const c of solids) {
      if (overlaps(b, { x0: c.x1, x1: c.x2, z0: c.z1, z1: c.z2 }, 0.04)) return false;
    }
    return true;
  };

  const midX = (rect.x0 + rect.x1) / 2, midZ = (rect.z0 + rect.z1) / 2;
  let best = null;
  for (const wall of ['S', 'N', 'W', 'E']) {
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
      if (!ok(b, rot)) continue;
      const score = Math.hypot(x - midX, z - midZ);
      if (!best || score < best.score) best = { x, z, rot, score };
    }
  }
  return best;
}

// Instantiate a template's per-material geometries into a group at the origin.
// The template keeps its own UVs and material slots; only the transform is new.
function piece(name, group) {
  const t = template(name);
  if (!t) return false;
  for (const g of t.geos) {
    const m = new THREE.Mesh(g.geo, mat(g.mat, `${name}_${g.mat}`));
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = name;
    group.add(m);
  }
  return true;
}

// One armoire. Local space: origin on the floor at the centre of the carcass,
// front facing +Z, matching the furniture convention.
function makeArmoire({ scene, level, room, x, z, rot, id }) {
  const group = new THREE.Group();
  group.name = 'Armoire_' + id;
  group.position.set(x, level.y, z);
  group.rotation.y = rot;

  if (!piece('armoire_body', group)) {
    hiding.errors.push('armoire_body missing from furniture.glb');
    return null;
  }

  const doors = [];
  for (const [side, node] of [[-1, 'armoire_door_left'], [1, 'armoire_door_right']]) {
    const hinge = new THREE.Group();
    hinge.name = node;
    hinge.position.set(side * 0.66, 0, 0);
    if (!piece(node, hinge)) {
      hiding.errors.push(node + ' missing from furniture.glb');
      return null;
    }
    group.add(hinge);
    doors.push({ side, hinge, target: 0, open: false, openAngle: side * 1.35 });
  }

  scene.add(group);

  // The carcass is solid. The door leaves do not add colliders: they are thin,
  // they swing into floor the placement scan already proved clear, and a
  // collider that followed them was how a player got trapped in a doorway.
  props.colliders.push({
    x1: x - ARMOIRE_W / 2, x2: x + ARMOIRE_W / 2,
    z1: z - ARMOIRE_D / 2, z2: z + ARMOIRE_D / 2,
    kind: 'furniture', y0: level.y, y1: level.y + 2.25,
  });

  const cos = Math.cos(rot), sin = Math.sin(rot);
  const world = (lx, lz) => ({ x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos });

  // Camera inside, just behind the leaves. The eye is at 1.52 m: below the
  // shelf, and low enough that the crown is overhead rather than in the lens.
  const inside = world(0, -0.02);
  // Where the body stands when it steps out: 0.82 m in front of the carcass.
  // That is clear of the player capsule against the carcass itself (0.37 m
  // half-depth + 0.34 m radius + a hand's width) and inside the 0.85 m swing
  // area the placement scan already proved empty.
  const out = world(0, ARMOIRE_D / 2 + 0.82);
  // Reaching distance: the front face, at chest height, so the prompt appears
  // on the armoire the player is actually facing.
  const front = world(0, ARMOIRE_D / 2 + 0.16);

  const spot = {
    id: 'hide:' + id,
    kind: 'hide',
    type: 'armoire',
    name: 'the aparador',
    room: room.name,
    level: level.id,
    levelY: level.y,
    x, z, rot,
    group, doors, inside, out,
    insideYaw: rot + Math.PI,
    outYaw: rot + Math.PI,
    eyeY: level.y + EYE_IN,
    outEyeY: level.y + 1.68,
    peekShift: { x: 0, z: 0.10 },
    peekYaw: 0.62,
    pitchLimit: 0.55,
    // The enemy checks this volume when it searches the room. It is the
    // carcass itself, not a sphere reaching through the wall.
    aabb: { x0: x - ARMOIRE_W / 2, x1: x + ARMOIRE_W / 2, z0: z - ARMOIRE_D / 2, z1: z + ARMOIRE_D / 2 },
  };
  spot.doors.forEach((d) => { d.spot = spot; });
  hiding.spots.push(spot);

  props.interactables.push({
    id: spot.id, kind: 'hide', name: spot.name, spot,
    x: front.x, y: level.y + 1.2, z: front.z, room: room.id,
  });
  return spot;
}

// The iron bed in Private Bedroom 3 was placed by the ordinary furnishing pass;
// hiding only needs to wrap the bed it actually put down. We read the
// placement log rather than typing coordinates that could disagree with it.
function underBedSpots(levels) {
  const found = [];
  for (const p of props.placed) {
    if (p.name !== 'iron_bed') continue;
    const t = template('iron_bed');
    if (!t) continue;
    const lvl = levels.find((l) => l.id === p.level);
    if (!lvl) continue;
    const level = lvl.y;
    const { min, max } = t.box;
    const L = max.z - min.z;
    const rot = p.rot;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const world = (lx, lz) => ({ x: p.x + lx * cos + lz * sin, z: p.z - lx * sin + lz * cos });
    const inside = world(0, 0.0);
    const out = world(0, L / 2 + 0.95);
    // The reach point is at the foot rail, not the middle of the mattress: a
    // prompt 1.1 m above the eye line failed the view-cone test every time.
    const front = world(0, L / 2 + 0.24);
    const spot = {
      id: 'hide:underbed:' + p.room,
      kind: 'hide', type: 'underbed', name: 'under the iron bed',
      room: p.room, level: p.level,
      levelY: level,
      x: p.x, z: p.z, rot,
      group: null, doors: [],
      inside, out,
      insideYaw: rot + Math.PI, outYaw: rot + Math.PI,
      eyeY: level + 0.42,
      outEyeY: level + 1.68,
      peekShift: { x: 0, z: Math.max(0.3, L / 2 - 0.28) },
      peekYaw: 0.72,
      pitchLimit: 0.38,
      aabb: { x0: Math.min(p.x - 0.1, p.x - 0.1), x1: p.x + 0.1, z0: p.z - 0.1, z1: p.z + 0.1 },
    };
    // The bed's footprint from its measured template, turned by rot.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const px of [min.x, max.x]) {
      for (const pz of [min.z, max.z]) {
        const w = world(px, pz);
        x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x);
        z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z);
      }
    }
    spot.aabb = { x0, x1, z0, z1 };
    hiding.spots.push(spot);
    props.interactables.push({
      id: spot.id, kind: 'hide', name: spot.name, spot,
      x: front.x, y: level + 0.52, z: front.z, room: p.room,
    });
    found.push(spot);
  }
  return found;
}

// --- placement -------------------------------------------------------------
// Three armoires, in rooms a family would actually have kept one. The list is
// short on purpose: not every wardrobe is a hiding place, and the ones that are
// are the ones whose doors open and whose interiors are modelled.
const PROGRAM = [
  { level: 'F2', room: 'FF2-03', id: 'master' },
  { level: 'F2', room: 'FF2-06', id: 'bedroom3' },
  { level: 'F3', room: 'FF3-06', id: 'suite' },
];

export function buildHiding(scene, levels) {
  hiding.spots.length = 0;
  hiding.errors.length = 0;
  hiding.count = 0;
  // Rebuild-safe: drop old hide targets if the world is rebuilt.
  for (let i = props.interactables.length - 1; i >= 0; i--) {
    if (props.interactables[i].kind === 'hide') props.interactables.splice(i, 1);
  }
  for (const spec of PROGRAM) {
    const level = levels.find((l) => l.id === spec.level);
    const room = level?.rooms.find((r) => r.id === spec.room);
    if (!room) { hiding.errors.push('no room ' + spec.level + '/' + spec.room); continue; }
    const spot = clearWallSpot(level, room, ARMOIRE_W, ARMOIRE_D, 2.25, 0.85);
    if (!spot) { hiding.errors.push('no clear wall for armoire ' + spec.id); continue; }
    makeArmoire({ scene, level, room, x: spot.x, z: spot.z, rot: spot.rot, id: spec.id });
    hiding.count++;
  }
  underBedSpots(levels);
  return hiding;
}

// Door swing and the camera's move into and out of a spot are driven here.
export function updateHiding(dt) {
  for (const spot of hiding.spots) {
    for (const d of spot.doors) {
      const target = d.open ? (d.angle ?? d.openAngle) : 0;
      if (Math.abs(d.hinge.rotation.y - target) < 1e-4) continue;
      d.hinge.rotation.y += (target - d.hinge.rotation.y) * Math.min(1, dt * 5.2);
    }
  }
}

export function openHidingDoor(spot, open) {
  for (const d of spot.doors) { d.open = open; d.angle = null; }
}

// A hand's width of door, not a body's width. The leaves separate at the
// centre, so the gap is real geometry the camera looks through, and the rest
// of the panel still blocks the view.
export function setHidingPeek(spot, on) {
  for (const d of spot.doors) {
    d.open = on;
    d.angle = on ? d.side * 0.20 : null;
  }
}

// The eye inside the spot: base position, plus the cautious lean toward the
// opening when peeking. Returned in world space so game.js can drive the
// camera directly without another transform.
export function hidingEye(spot, peek) {
  const lean = peek ? spot.peekShift : { x: 0, z: 0 };
  const cos = Math.cos(spot.rot), sin = Math.sin(spot.rot);
  return {
    x: spot.inside.x + lean.x * cos + lean.z * sin,
    z: spot.inside.z - lean.x * sin + lean.z * cos,
    y: spot.eyeY,
  };
}
