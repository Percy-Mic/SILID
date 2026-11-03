// PROPS — furniture and story objects, placed against walls with validation.
//
// Every piece is proposed with a footprint and a supporting floor. `fits()`
// rejects it if it leaves its room, crosses a doorway clearance, overlaps an
// earlier piece, or hangs over a stair hole. That is deliberately conservative:
// a room with one fewer chair is better than a chair through a wall. The
// validator in validate.js re-checks the same boxes from outside.
//
// Furniture is merged into one mesh per material per level, so a fully dressed
// floor costs about a dozen draw calls instead of a thousand.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps } from './materials.js';

export const props = {
  colliders: [],
  interactables: [],
  lights: [],
  issues: [],
  count: 0,
};

const occupied = new Map(); // room id -> [{x0,z0,x1,z1}]

function roomKey(r) { return r.level + '/' + r.id; }

function doorZones(level, room) {
  const zones = [];
  for (const d of level.doors) {
    if (d.axis === 'x' && d.c >= room.z0 - 0.3 && d.c <= room.z1 + 0.3 && d.at > room.x0 - 0.3 && d.at < room.x1 + 0.3) {
      // 1.1 m deep, not 0.55: furniture that only just clears the threshold
      // still stands in the doorway's approach and blocks the player. A crate
      // 5 cm the wrong side of this line sealed the cellar stair landing.
      zones.push({ x0: d.at - d.w / 2 - 0.5, x1: d.at + d.w / 2 + 0.5, z0: d.c - 1.1, z1: d.c + 1.1 });
    }
    if (d.axis === 'z' && d.c >= room.x0 - 0.3 && d.c <= room.x1 + 0.3 && d.at > room.z0 - 0.3 && d.at < room.z1 + 0.3) {
      zones.push({ x0: d.c - 1.1, x1: d.c + 1.1, z0: d.at - d.w / 2 - 0.5, z1: d.at + d.w / 2 + 0.5 });
    }
  }
  return zones;
}

function overlaps(a, b, pad = 0.02) {
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad;
}

function fits(room, box, zones, list, margin = 0.18) {
  if (box.x0 < room.x0 + margin || box.x1 > room.x1 - margin ||
      box.z0 < room.z0 + margin || box.z1 > room.z1 - margin) return false;
  for (const z of zones) if (overlaps(box, z, 0)) return false;
  for (const o of list) if (overlaps(box, o, 0.03)) return false;
  return true;
}

function addCollider(box, y0, y1) {
  props.colliders.push({ x1: box.x0, z1: box.z0, x2: box.x1, z2: box.z1, kind: 'furniture', y0, y1 });
}

function uvBox(w, h, d, scale = 0.7) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] * scale, uv.getY(k) * dims[f][1] * scale);
    }
  }
  uv.needsUpdate = true;
  g.clearGroups();
  return g;
}

class Dressing {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.y = level.y;
    this.buckets = new Map();
    this.room = null;
    this.list = [];
    this.zones = [];
  }
  use(room) {
    this.room = room;
    this.list = occupied.get(roomKey(room)) || [];
    if (!occupied.has(roomKey(room))) occupied.set(roomKey(room), this.list);
    this.zones = doorZones(this.level, room);
  }
  geo(mat, g) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
  }
  box(mat, w, h, d, x, y, z, rot = 0) {
    const g = uvBox(w, h, d);
    if (rot) g.rotateY(rot);
    g.translate(x, y + h / 2, z);
    this.geo(mat, g);
    return g;
  }
  // axis-aligned placement helper: centre x/z, bottom y
  piece(room, mat, w, h, d, cx, cz, { rot = 0, collide = true } = {}) {
    const halfW = (rot % Math.PI === 0 ? w : d) / 2;
    const halfD = (rot % Math.PI === 0 ? d : w) / 2;
    const box = { x0: cx - halfW, x1: cx + halfW, z0: cz - halfD, z1: cz + halfD };
    if (!fits(room, box, this.zones, this.list)) return null;
    this.list.push(box);
    if (collide) addCollider(box, this.y, this.y + h);
    props.count++;
    const g = uvBox(w, h, d);
    if (rot) g.rotateY(rot);
    g.translate(cx, this.y + h / 2, cz);
    this.geo(mat, g);
    return { box, geo: g };
  }
  // place against a chosen wall of the room
  wall(room, wall, w, d, offset = 0.5) {
    const t = 0.08 + (wall === 'N' || wall === 'S' ? d : w) / 2;
    let x, z, rot = 0;
    if (wall === 'N') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z1 - t; rot = Math.PI; }
    if (wall === 'S') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z0 + t; rot = 0; }
    if (wall === 'E') { x = room.x1 - t; z = room.z0 + (room.z1 - room.z0) * offset; rot = -Math.PI / 2; }
    if (wall === 'W') { x = room.x0 + t; z = room.z0 + (room.z1 - room.z0) * offset; rot = Math.PI / 2; }
    return { x, z, rot };
  }
  finish() {
    for (const [matKey, geos] of this.buckets) {
      if (!geos.length) continue;
      const geo = mergeGeometries(geos);
      const mat = materials[matKey].clone();
      tileMaps(mat, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Props_' + this.level.id + '_' + matKey;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.buckets.clear();
  }
}

function lamp(d, room, x, z, warm = true) {
  d.box('woodDark', 0.28, 0.05, 0.28, x, d.y + 0.52, z);
  d.box('iron', 0.04, 0.52, 0.04, x, d.y, z);
  const shade = new THREE.CylinderGeometry(0.16, 0.22, 0.24, 8, 1, true);
  shade.translate(x, d.y + 0.7, z);
  d.geo('linen', shade);
  props.lights.push({ x, y: d.y + 0.7, z, color: warm ? 0xffc88a : 0xa8c4e0, intensity: 4.2, distance: 7, room: room.id });
}

function bed(d, room, wall = 'N') {
  const w = 1.55, len = 2.0;
  const p = d.wall(room, wall, w, len, 0.5);
  // headboard against the wall, bed projecting into the room
  const dir = wall === 'N' ? -1 : wall === 'S' ? 1 : 0;
  const side = wall === 'E' ? -1 : wall === 'W' ? 1 : 0;
  const cx = p.x + side * len / 2;
  const cz = p.z + dir * len / 2;
  const frame = d.piece(room, 'woodDark', w, 0.35, len, cx, cz, { rot: side ? Math.PI / 2 : 0 });
  if (!frame) return;
  d.box('wood', w, 0.12, len, cx, d.y + 0.35, cz, side ? Math.PI / 2 : 0);
  d.box('linen', w - 0.08, 0.22, len - 0.08, cx, d.y + 0.47, cz, side ? Math.PI / 2 : 0);
  d.box('velvet', w - 0.12, 0.06, len * 0.6, cx + (side ? -0.1 * side : 0), d.y + 0.68, cz + (dir ? -0.25 * dir : 0), side ? Math.PI / 2 : 0);
  // pillows
  const px = side ? cx - side * (len / 2 - 0.35) : cx;
  const pz = dir ? cz + dir * (len / 2 - 0.35) : cz;
  for (const off of [-0.32, 0.32]) {
    if (side) d.box('linen', 0.55, 0.14, 0.38, px, d.y + 0.7, pz + off, side ? Math.PI / 2 : 0);
    else d.box('linen', 0.55, 0.14, 0.38, px + off, d.y + 0.7, pz, 0);
  }
  // bedside table beside the head
  const tx = side ? cx - side * (len / 2 + 0.4) : cx + w / 2 + 0.35;
  const tz = dir ? cz + dir * (len / 2 - 0.3) : cz - w / 2 - 0.35;
  const t = d.piece(room, 'wood', 0.45, 0.55, 0.45, side ? cx + side * 0.9 : tx, side ? cz + 0.35 : tz);
  if (t) lamp(d, room, t.box.x0 + 0.22, t.box.z0 + 0.22);
}

function wardrobe(d, room, wall = 'W') {
  const p = d.wall(room, wall, 1.25, 0.6, 0.5);
  const r = d.piece(room, 'woodDark', 1.25, 2.05, 0.6, p.x, p.z, { rot: p.rot });
  if (!r) return;
  const cx = r.box.x0 + (r.box.x1 - r.box.x0) / 2;
  const cz = r.box.z0 + (r.box.z1 - r.box.z0) / 2;
  for (const off of [-0.3, 0.3]) {
    const g = uvBox(0.5, 1.75, 0.03);
    // Offset along the wardrobe's own width axis, then face it outward. The
    // old code offset along world z whatever the rotation, so a wardrobe on an
    // east or west wall had its two doors hanging off the side of the carcass.
    g.rotateY(p.rot);
    g.translate(cx + Math.cos(p.rot) * off, d.y + 1.0, cz - Math.sin(p.rot) * off);
    d.geo('wood', g);
  }
}

function rug(d, room, w = 3, h = 2.2) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  g.translate((room.x0 + room.x1) / 2, d.y + 0.012, (room.z0 + room.z1) / 2);
  d.geo('rug', g);
}

function sofa(d, room, wall = 'W', len = 2.2) {
  const p = d.wall(room, wall, len, 0.9, 0.5);
  const r = d.piece(room, 'velvet', len, 0.42, 0.9, p.x, p.z, { rot: p.rot });
  if (!r) return;
  const cx = (r.box.x0 + r.box.x1) / 2, cz = (r.box.z0 + r.box.z1) / 2;
  d.box('velvet', len, 0.5, 0.22, cx + (wall === 'E' ? 0.34 : wall === 'W' ? -0.34 : 0), d.y + 0.42, cz + (wall === 'N' ? 0.34 : wall === 'S' ? -0.34 : 0), p.rot);
  for (const s of [-1, 1]) {
    const ox = wall === 'N' || wall === 'S' ? s * (len / 2 - 0.08) : 0;
    const oz = wall === 'E' || wall === 'W' ? s * 0.36 : 0;
    d.box('velvet', 0.16, 0.62, 0.9, cx + ox, d.y + 0.42, cz + oz, p.rot);
  }
  for (const off of [-len / 4, len / 4]) {
    d.box('linen', len / 2.2, 0.12, 0.7, cx + (wall === 'N' || wall === 'S' ? off : 0), d.y + 0.42, cz + (wall === 'E' || wall === 'W' ? off : 0), p.rot);
  }
}

function table(d, room, w, dd, x, z) {
  return d.piece(room, 'wood', w, 0.78, dd, x, z);
}

function chair(d, room, x, z, rot = 0) {
  const r = d.piece(room, 'woodDark', 0.46, 0.46, 0.46, x, z, { rot });
  if (!r) return;
  d.box('wood', 0.46, 0.5, 0.06, x + Math.sin(rot) * 0.2, d.y + 0.46, z + Math.cos(rot) * 0.2, rot);
}

function bookshelf(d, room, wall = 'N', w = 1.6) {
  const p = d.wall(room, wall, w, 0.36, 0.5);
  const r = d.piece(room, 'woodDark', w, 2.25, 0.36, p.x, p.z, { rot: p.rot });
  if (!r) return;
  const alongX = wall === 'N' || wall === 'S';
  for (let i = 0; i < 4; i++) {
    const y = d.y + 0.35 + i * 0.48;
    if (alongX) d.box('wood', w - 0.08, 0.03, 0.34, p.x, y, p.z);
    else d.box('wood', 0.34, 0.03, w - 0.08, p.x, y, p.z);
    for (let b = 0; b < 7; b++) {
      const off = -w / 2 + 0.18 + b * (w - 0.3) / 7;
      const h = 0.26 + (b % 3) * 0.04;
      if (alongX) d.box(b % 3 ? 'leather' : 'velvet', 0.07, h, 0.22, p.x + off, y + 0.03, p.z);
      else d.box(b % 3 ? 'leather' : 'velvet', 0.22, h, 0.07, p.x, y + 0.03, p.z + off);
    }
  }
}

function portrait(d, room, wall, offset, w = 0.7, h = 0.95, y = 1.75) {
  // Interior walls are 0.22 thick, so their inner face is 0.11 from the room
  // boundary. A painting at 0.03 sat inside the plaster.
  const t = 0.12;
  let x, z, rot;
  if (wall === 'N') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z1 - t; rot = Math.PI; }
  else if (wall === 'S') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z0 + t; rot = 0; }
  else if (wall === 'E') { x = room.x1 - t; z = room.z0 + (room.z1 - room.z0) * offset; rot = -Math.PI / 2; }
  else { x = room.x0 + t; z = room.z0 + (room.z1 - room.z0) * offset; rot = Math.PI / 2; }
  const frame = uvBox(w + 0.1, h + 0.1, 0.05, 1);
  frame.rotateY(rot);
  frame.translate(x, d.y + y, z);
  d.geo('woodDark', frame);
  const canv = new THREE.PlaneGeometry(w, h);
  canv.rotateY(rot);
  canv.translate(x + Math.sin(rot) * -0.035, d.y + y, z + Math.cos(rot) * -0.035);
  d.geo('leather', canv);
}

// --- room dressers --------------------------------------------------------
function dressBedroom(d, room) {
  const long = room.x1 - room.x0 > room.z1 - room.z0;
  bed(d, room, long ? 'N' : 'W');
  wardrobe(d, room, long ? 'W' : 'S');
  rug(d, room, Math.min(2.8, (room.x1 - room.x0) - 1.2), Math.min(2.2, (room.z1 - room.z0) - 1.2));
  portrait(d, room, long ? 'N' : 'E', 0.3, 0.55, 0.7, 1.9);
  if ((room.x1 - room.x0) > 5.6) {
    const p = d.wall(room, 'E', 0.9, 0.45, 0.6);
    d.piece(room, 'wood', 0.9, 0.8, 0.45, p.x, p.z, { rot: p.rot });
  }
}

function dressLiving(d, room) {
  const long = room.x1 - room.x0 > room.z1 - room.z0;
  sofa(d, room, long ? 'W' : 'N', Math.min(2.4, (long ? room.z1 - room.z0 : room.x1 - room.x0) * 0.5));
  const cx = (room.x0 + room.x1) / 2 + (long ? 0.5 : 0);
  const cz = (room.z0 + room.z1) / 2 + (long ? 0 : 0.3);
  table(d, room, 1.0, 0.6, cx, cz);
  rug(d, room, Math.min(3.4, room.x1 - room.x0 - 1), Math.min(2.6, room.z1 - room.z0 - 1));
  chair(d, room, cx + 0.8, cz, 0);
  if (room.x1 - room.x0 > 5) {
    const p = d.wall(room, long ? 'E' : 'S', 1.2, 0.45, 0.5);
    d.piece(room, 'wood', 1.2, 0.9, 0.45, p.x, p.z, { rot: p.rot });
    portrait(d, room, long ? 'N' : 'E', 0.5, 0.8, 1.0, 1.9);
  }
}

function dressDining(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const tw = Math.min(3.0, (room.x1 - room.x0) - 2.0);
  table(d, room, tw, 1.05, cx, cz);
  const n = Math.max(4, Math.min(8, Math.floor((tw + 0.9) / 0.75)));
  for (let i = 0; i < n / 2; i++) {
    const x = cx - tw / 2 + 0.45 + i * ((tw - 0.9) / Math.max(1, n / 2 - 1));
    chair(d, room, x, cz - 0.85, 0);
    chair(d, room, x, cz + 0.85, Math.PI);
  }
  const p = d.wall(room, 'N', 1.6, 0.45, 0.5);
  d.piece(room, 'woodDark', 1.6, 0.9, 0.45, p.x, p.z, { rot: p.rot });
  rug(d, room, tw + 1, 2.6);
}

function dressStudy(d, room) {
  const p = d.wall(room, 'N', 1.5, 0.75, 0.55);
  const desk = d.piece(room, 'woodDark', 1.5, 0.76, 0.75, p.x, p.z, { rot: p.rot });
  if (desk) {
    const cx = p.x - Math.sin(p.rot) * 0.7, cz = p.z - Math.cos(p.rot) * 0.7;
    chair(d, room, cx, cz, p.rot + Math.PI);
    lamp(d, room, p.x + 0.45, p.z);
  }
  bookshelf(d, room, 'W', Math.min(1.8, (room.z1 - room.z0) - 1.5));
  bookshelf(d, room, 'E', Math.min(1.8, (room.z1 - room.z0) - 1.5));
  rug(d, room, 2.2, 1.6);
  portrait(d, room, 'S', 0.5, 0.7, 0.9, 1.8);
}

function dressKitchen(d, room) {
  const alongX = room.x1 - room.x0 > room.z1 - room.z0;
  const runW = alongX ? room.x1 - room.x0 - 0.8 : 0.62;
  const runD = alongX ? 0.62 : room.z1 - room.z0 - 0.8;
  const cx = alongX ? (room.x0 + room.x1) / 2 : room.x1 - 0.5;
  const cz = alongX ? room.z0 + 0.5 : (room.z0 + room.z1) / 2;
  const run = d.piece(room, 'wood', runW, 0.9, runD, cx, cz);
  if (!run) return;
  const n = Math.max(2, Math.round(runW / 1.2));
  for (let i = 0; i < n; i++) {
    const off = -runW / 2 + 0.4 + i * (runW - 0.8) / Math.max(1, n - 1);
    const x = alongX ? cx + off : cx;
    const z = alongX ? cz : cz + off;
    if (i === 0) {
      d.box('iron', 0.55, 0.03, 0.42, x, d.y + 0.9, z);
      d.box('iron', 0.05, 0.18, 0.05, x, d.y + 1.05, z + 0.25);
    } else {
      d.box('tileDirty', 0.5, 0.05, 0.45, x, d.y + 0.87, z);
    }
  }
  // upper cabinets
  if (alongX) d.box('wood', runW, 0.7, 0.35, cx, d.y + 1.65, cz - 0.15);
  else d.box('wood', 0.35, 0.7, runD, cx - 0.15, d.y + 1.65, cz);
  const fp = d.wall(room, alongX ? 'W' : 'S', 0.7, 0.7, 0.5);
  d.piece(room, 'iron', 0.7, 1.75, 0.7, fp.x, fp.z, { rot: fp.rot });
}

function dressBath(d, room) {
  const p = d.wall(room, 'N', 1.6, 0.8, 0.5);
  d.piece(room, 'linen', 1.6, 0.55, 0.8, p.x, p.z, { rot: p.rot });
  const t = d.wall(room, 'W', 0.6, 0.4, 0.7);
  d.piece(room, 'linen', 0.55, 0.42, 0.6, t.x, t.z, { rot: t.rot });
  const b = d.wall(room, 'E', 0.8, 0.5, 0.5);
  d.piece(room, 'linen', 0.8, 0.85, 0.5, b.x, b.z, { rot: b.rot });
  d.box('iron', 0.8, 1.0, 0.04, room.x1 - 0.06, d.y + 1.55, (room.z0 + room.z1) / 2);
}

function dressStorage(d, room) {
  const wall = room.z1 - room.z0 > room.x1 - room.x0 ? 'N' : 'E';
  const p = d.wall(room, wall, Math.min(2.4, (wall === 'N' ? room.x1 - room.x0 : room.z1 - room.z0) - 1.2), 0.5, 0.5);
  const base = d.piece(room, 'woodGrey', 2.2, 1.8, 0.5, p.x, p.z, { rot: p.rot });
  if (!base) return;
  for (let i = 0; i < 3; i++) {
    const y = d.y + 0.3 + i * 0.55;
    d.box('wood', 2.1, 0.04, 0.48, p.x, y, p.z, p.rot);
  }
  // stacked crates on the floor, each resting on the one below
  const cx = (room.x0 + room.x1) / 2 + 0.6, cz = (room.z0 + room.z1) / 2;
  for (let i = 0; i < 3; i++) {
    const w = 0.6 + (i % 2) * 0.1;
    const r = d.piece(room, 'woodDirt', w, 0.42, 0.5, cx, cz);
    if (!r) break;
    if (i < 2) d.box('woodDirt', w, 0.4, 0.5, cx, d.y + 0.42 + i * 0.42, cz);
  }
}

function dressChapel(d, room) {
  const p = d.wall(room, 'N', 1.4, 0.6, 0.5);
  const altar = d.piece(room, 'woodDark', 1.4, 0.92, 0.6, p.x, p.z, { rot: p.rot });
  if (altar) {
    d.box('linen', 1.3, 0.04, 0.55, p.x, d.y + 0.92, p.z, p.rot);
    d.box('woodDark', 0.12, 0.75, 0.08, p.x, d.y + 1.0, p.z + 0.2);
    d.box('woodDark', 0.5, 0.1, 0.08, p.x, d.y + 1.55, p.z + 0.2);
    for (const off of [-0.5, 0.5]) {
      d.box('linen', 0.05, 0.28, 0.05, p.x + off, d.y + 0.96, p.z - 0.1);
    }
  }
  d.piece(room, 'woodDark', 0.9, 0.42, 0.5, (room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2 - 0.2);
  rug(d, room, 1.8, 2.4);
}

function dressMusic(d, room) {
  const p = d.wall(room, 'N', 1.5, 2.0, 0.5);
  const body = d.piece(room, 'woodDark', 1.5, 0.95, 2.0, p.x, p.z, { rot: p.rot });
  if (body) {
    d.box('woodDark', 1.45, 0.08, 1.95, p.x, d.y + 0.95, p.z, p.rot);
    d.box('leather', 1.2, 0.06, 0.32, p.x, d.y + 0.68, p.z - 0.65, p.rot);
    chair(d, room, p.x, p.z - 1.1, p.rot);
  }
}

function dressGenerator(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  // concrete pad, then the set standing on it
  d.box('concreteFloor', 2.5, 0.09, 1.5, cx, d.y, cz - 0.4);
  const gen = d.piece(room, 'rust', 1.5, 1.05, 0.9, cx, cz - 0.4);
  if (gen) {
    const top = d.y + 1.05;
    // radiator face and its louvres
    d.box('iron', 1.3, 0.62, 0.06, cx, d.y + 0.22, cz - 0.87);
    for (let i = 0; i < 5; i++) d.box('iron', 1.24, 0.03, 0.03, cx, d.y + 0.3 + i * 0.11, cz - 0.9);
    // rocker cover and filler cap
    d.box('iron', 0.72, 0.14, 0.5, cx - 0.25, top, cz - 0.35);
    d.box('iron', 0.14, 0.08, 0.14, cx + 0.5, top, cz - 0.1);
    d.box('rust', 0.16, 1.1, 0.16, cx + 0.62, d.y + 0.09, cz + 0.5);
    // exhaust: rises from the set and turns into the wall sleeve
    const stack = new THREE.CylinderGeometry(0.055, 0.055, 1.35, 8);
    stack.translate(cx + 0.55, top + 0.675, cz - 0.72);
    d.geo('iron', stack);
    const elbow = new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8);
    elbow.rotateZ(Math.PI / 2);
    elbow.translate(cx + 0.55 + 0.25, top + 1.35, cz - 0.72);
    d.geo('iron', elbow);
    d.box('iron', 0.3, 0.3, 0.02, cx + 1.02, top + 1.2, cz - 0.72);
    // fuel line from the drum to the set
    const line = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6);
    line.rotateZ(Math.PI / 2);
    line.translate(cx - 0.55, d.y + 0.35, cz - 0.5);
    d.geo('rust', line);

    // distribution board on the east wall, wired to the set
    const px = room.x1 - 0.12, pz = cz + 0.9;
    d.box('iron', 0.16, 0.75, 0.6, px, d.y + 1.05, pz);
    d.box('woodGrey', 0.03, 0.62, 0.5, px - 0.09, d.y + 1.12, pz);
    for (let i = 0; i < 3; i++) {
      const dial = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8);
      dial.rotateZ(Math.PI / 2);
      dial.translate(px - 0.11, d.y + 1.3 + (i % 2) * 0.16, pz - 0.16 + Math.floor(i / 2) * 0.2);
      d.geo('iron', dial);
    }
    const conduit = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6);
    conduit.translate(px, d.y + 2.05, pz + 0.2);
    d.geo('iron', conduit);
    d.box('iron', 0.05, 0.05, Math.abs(pz - (cz + 0.5)) + 0.5, px, d.y + 1.5, (pz + cz + 0.5) / 2);

    props.interactables.push({
      id: 'generator', name: 'the generator', kind: 'generator',
      x: cx, y: d.y + 0.6, z: cz - 0.35, room: room.name,
    });
  }
  // fuel drum and tool bench
  const drum = d.piece(room, 'rust', 0.6, 0.9, 0.6, room.x0 + 1.1, room.z0 + 1.4);
  if (drum) props.interactables.push({
    id: 'fuel', name: 'a jerry can of diesel', kind: 'pickup',
    x: room.x0 + 1.1, y: d.y + 0.45, z: room.z0 + 1.4, room: room.name,
  });
  const p = d.wall(room, 'E', 1.4, 0.6, 0.5);
  d.piece(room, 'woodGrey', 1.4, 0.85, 0.6, p.x, p.z, { rot: p.rot });
  d.box('rust', 0.5, 0.6, 0.2, room.x1 - 0.25, d.y + 1.15, (room.z0 + room.z1) / 2);
  props.lights.push({ x: room.x1 - 0.35, y: d.y + 1.9, z: (room.z0 + room.z1) / 2, color: 0x9fb8d8, intensity: 2.5, distance: 7, room: room.id });
}

function dressWorkshop(d, room) {
  const p = d.wall(room, 'N', 1.8, 0.7, 0.5);
  const bench = d.piece(room, 'woodGrey', 1.8, 0.88, 0.7, p.x, p.z, { rot: p.rot });
  if (bench) {
    for (let i = 0; i < 6; i++) {
      d.box('iron', 0.12, 0.2, 0.12, p.x - 0.6 + i * 0.24, d.y + 0.88, p.z + 0.18);
    }
  }
  const s = d.wall(room, 'E', 0.9, 0.9, 0.6);
  d.piece(room, 'woodDirt', 0.9, 1.7, 0.6, s.x, s.z, { rot: s.rot });
  d.piece(room, 'woodDirt', 0.7, 0.5, 0.6, (room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2);
  props.interactables.push({
    id: 'fuse', name: 'a ceramic fuse', kind: 'pickup',
    x: p.x, y: d.y + 0.95, z: p.z, room: room.name,
  });
  // visible, reachable, on the bench rather than behind it
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 2.3, z: (room.z0 + room.z1) / 2, color: 0xd8bd8a, intensity: 3, distance: 6, room: room.id });
}

function dressObservatory(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const base = d.piece(room, 'iron', 0.8, 0.1, 0.8, cx, cz);
  if (base) {
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const leg = new THREE.CylinderGeometry(0.03, 0.03, 1.35, 5);
      leg.rotateZ(0.12);
      leg.translate(cx + Math.cos(a) * 0.25, d.y + 0.68, cz + Math.sin(a) * 0.25);
      d.geo('iron', leg);
    }
    const tube = new THREE.CylinderGeometry(0.11, 0.15, 1.4, 10);
    tube.rotateZ(1.05);
    tube.translate(cx, d.y + 1.45, cz);
    d.geo('iron', tube);
    d.box('iron', 0.2, 0.2, 0.4, cx - 0.35, d.y + 1.35, cz);
  }
}

function dressBell(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  for (const dx of [-0.9, 0.9]) d.box('woodDark', 0.16, 2.6, 0.16, cx + dx, d.y, cz);
  d.box('woodDark', 2.0, 0.2, 0.2, cx, d.y + 2.6, cz);
  const bell = new THREE.CylinderGeometry(0.25, 0.55, 0.7, 12, 1, true);
  bell.translate(cx, d.y + 2.1, cz);
  d.geo('iron', bell);
  d.box('iron', 0.4, 0.12, 0.12, cx, d.y + 1.78, cz);
}

function dressStorageRoom(d, room) {
  const p = d.wall(room, 'W', 1.8, 0.4, 0.5);
  d.piece(room, 'woodGrey', 1.8, 2.0, 0.4, p.x, p.z, { rot: p.rot });
  for (let i = 0; i < 4; i++) {
    const b = d.piece(room, 'linen', 0.5, 0.3, 0.4, room.x0 + 1.0 + (i % 2) * 0.6, room.z0 + 0.8 + Math.floor(i / 2) * 0.55);
    if (b && i % 2 === 1) d.box('linen', 0.5, 0.28, 0.4, room.x0 + 1.0 + (i % 2) * 0.6, d.y + 0.3, room.z0 + 0.8 + Math.floor(i / 2) * 0.55);
  }
}

function dressCorridor(d, room) {
  // nothing in the clear width; a console only in a corridor wide enough
  if (room.z1 - room.z0 < 3.4) return;
  const p = d.wall(room, 'W', 1.2, 0.4, 0.5);
  d.piece(room, 'woodDark', 1.2, 0.85, 0.4, p.x, p.z, { rot: p.rot });
  portrait(d, room, 'E', 0.5, 0.7, 0.9, 1.8);
}

function dressFoyer(d, room) {
  rug(d, room, 3.2, 2.4);
  portrait(d, room, 'W', 0.3, 0.8, 1.1, 2.1);
  portrait(d, room, 'E', 0.3, 0.8, 1.1, 2.1);
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 3.4, z: (room.z0 + room.z1) / 2, color: 0xffcf9a, intensity: 7, distance: 10, room: room.id });
}

function dressGallery(d, room) {
  portrait(d, room, 'W', 0.35, 0.9, 1.15, 2.0);
  portrait(d, room, 'W', 0.65, 0.7, 0.9, 1.95);
  portrait(d, room, 'E', 0.3, 0.85, 1.1, 2.0);
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 3.3, z: (room.z0 + room.z1) / 2, color: 0xe8c08c, intensity: 5, distance: 9, room: room.id });
}

function dressTerrace(d, room) {
  const p = d.wall(room, 'N', 0.9, 0.6, 0.5);
  d.piece(room, 'stone', 0.9, 0.45, 0.6, p.x, p.z, { rot: p.rot });
  for (let i = 0; i < 2; i++) {
    const q = d.piece(room, 'stone', 0.5, 0.55, 0.5, room.x0 + 1 + i * 1.1, room.z1 - 0.5);
    if (q) {
      const g = new THREE.CylinderGeometry(0.22, 0.18, 0.6, 7);
      g.translate(room.x0 + 1 + i * 1.1, d.y + 0.85, room.z1 - 0.5);
      d.geo('groundGrass', g);
    }
  }
}

const DRESS = {
  bedroom: dressBedroom,
  living: dressLiving,
  dining: dressDining,
  study: dressStudy,
  kitchen: dressKitchen,
  bath: dressBath,
  storage: dressStorageRoom,
  chapel: dressChapel,
  music: dressMusic,
  generator: dressGenerator,
  workshop: dressWorkshop,
  observatory: dressObservatory,
  bell: dressBell,
  corridor: dressCorridor,
  foyer: dressFoyer,
  gallery: dressGallery,
  terrace: dressTerrace,
};

export function furnish(scene, levels) {
  props.colliders.length = 0;
  props.interactables.length = 0;
  props.lights.length = 0;
  props.issues.length = 0;
  props.count = 0;
  occupied.clear();

  for (const level of levels) {
    const d = new Dressing(scene, level);
    for (const room of level.rooms) {
      if (room.kind === 'courtyard') continue;
      d.use(room);
      const fn = DRESS[room.kind];
      if (!fn) continue;
      fn(d, room);
    }
    // a lamp in every corridor is wrong; one every other room is right
    d.finish();
  }

  // a tire iron and a note: the two things the opening actually hands you
  // Story objects sit where a person would actually leave them: the notebook
  // on the library desk, the key dropped by the master bedroom door. They used
  // to hang in mid-air over the dining room, at coordinates from the old plan.
  props.interactables.push({
    id: 'note', name: 'a wet notebook', kind: 'read',
    x: -10.0, y: 0.82, z: -2.8, room: 'Library / Study',
    text: 'The generator has been dry since the burial. Fuel is in the generator room. The fuse is on the workshop bench. Do not run it after dark.',
  });
  props.interactables.push({
    id: 'key', name: 'a brass key', kind: 'pickup',
    x: -3.2, y: 4.26, z: -4.2, room: 'Master Bedroom', level: 'F2',
  });
  return props;
}
