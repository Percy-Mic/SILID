// PROPS — furniture and story objects, placed against walls with validation.
//
// Every piece is a modelled asset from scripts/build_furniture.py, loaded by
// furniture.js. `fits()` still rejects a piece that leaves its room, crosses a
// doorway clearance, overlaps an earlier piece, or hangs over a stair hole:
// validation is unchanged, only the furniture got real. That is deliberate — a
// room with one fewer chair is better than a chair through a wall.
//
// Merged into one mesh per material per level, so a fully dressed floor costs
// about a dozen draw calls instead of a thousand, whatever the geometry costs.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps, tileAtMetres, tileOf } from './materials.js';
import { box } from './primitives.js';
import { template, footprint } from './furniture.js';
import { wallFace, floorHeightAt } from './architecture.js';
import { STAIR } from './plan.js';
import { loadPhone, modelUrl, phoneBox } from './phone.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const props = {
  colliders: [],
  interactables: [],
  lights: [],
  issues: [],
  missing: [],
  count: 0,
  tiles: 0,
  placed: [],
  rejected: [],
};

const occupied = new Map(); // room id -> [{x0,z0,x1,z1}]

function roomKey(r) { return r.level + '/' + r.id; }

// The clear interior of a room. Walls are built CENTRED on the room's boundary
// lines, so the plaster stands 0.11 m (0.21 m on an exterior wall) inside the
// rectangle the plan draws. Every clearance rule and every backed placement
// works against this rect, not against the drawn one — otherwise a wardrobe is
// built with its back 21 cm inside the masonry.
function clearRect(level, room) {
  const hx0 = wallFace(level, 'z', room.x0).half;
  const hx1 = wallFace(level, 'z', room.x1).half;
  const hz0 = wallFace(level, 'x', room.z0).half;
  const hz1 = wallFace(level, 'x', room.z1).half;
  return { x0: room.x0 + hx0, x1: room.x1 - hx1, z0: room.z0 + hz0, z1: room.z1 - hz1 };
}

function doorZones(level, room) {
  const zones = [];
  for (const d of level.doors) {
    if (d.axis === 'x' && d.c >= room.z0 - 0.3 && d.c <= room.z1 + 0.3 && d.at > room.x0 - 0.3 && d.at < room.x1 + 0.3) {
      // 1.1 m deep, not 0.55: furniture that only just clears the threshold
      // still stands in the doorway's approach and blocks the player.
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

// The same rules, with which one failed — a furnishing pass that silently
// drops a bed is impossible to debug from the screenshot alone.
function fitsReason(rect, b, zones, list, margin = 0.06) {
  if (b.x0 < rect.x0 + margin || b.x1 > rect.x1 - margin ||
      b.z0 < rect.z0 + margin || b.z1 > rect.z1 - margin) return 'outside room bounds';
  for (const z of zones) if (overlaps(b, z, 0)) return 'door approach';
  for (const o of list) if (overlaps(b, o, 0.03)) return 'overlaps a placed piece';
  return null;
}

function addCollider(b, y0, y1, kind = 'furniture') {
  props.colliders.push({ x1: b.x0, z1: b.z0, x2: b.x1, z2: b.z1, kind, y0, y1 });
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
    this.rect = clearRect(this.level, room);
    this.list = occupied.get(roomKey(room)) || [];
    if (!occupied.has(roomKey(room))) occupied.set(roomKey(room), this.list);
    this.zones = doorZones(this.level, room);
  }
  geo(mat, g) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
  }
  box(mat, w, h, d, x, y, z, rot = 0) {
    const g = box(w, h, d, 1);
    if (rot) g.rotateY(rot);
    g.translate(x, y + h / 2, z);
    this.geo(mat, g);
    return g;
  }
  // A modelled piece. `x/z` is the model's own origin, `rot` turns it about
  // that origin, and the footprint comes from the measured bounding box — never
  // from a hand-typed size that could disagree with the mesh.
  place(name, x, z, rot = 0, { y = this.y, solid = true, margin = 0.06, fitsRoom = true, quiet = false } = {}) {
    const t = template(name);
    if (!t) { props.missing.push(name); return null; }
    const fp = footprint(name, x, z, rot);
    if (fitsRoom) {
      // A non-solid piece is wall-mounted: it may hang over whatever is beneath
      // it, so only its room bounds and its doorway clearance are checked.
      const bad = fitsReason(this.rect, fp, this.zones, solid ? this.list : [], margin);
      if (bad) {
        // `quiet` is for a placer that is going to try the next spot along the
        // wall: only the caller that gives up reports, or one bad guess would
        // fill the rejection log with attempts that later succeeded.
        if (!quiet) {
          props.rejected.push({ name, room: this.room?.id, level: this.level.id,
            x: +x.toFixed(2), z: +z.toFixed(2), why: bad });
        }
        return null;
      }
    }
    if (solid) addCollider(fp, y, y + fp.height);
    // A mounted piece occupies wall, not floor: it must not stop the worktop
    // beneath it from being placed.
    if (fitsRoom) this.list.push(fp);
    // Placement log for the validation pass: which piece, which room, where.
    // `y` and `solid` are audit data, not behaviour: a piece placed on a table
    // or hung on a wall is off the floor BY DESIGN, and the clipping audit has
    // to know that before it can call anything a floater.
    if (fitsRoom) props.placed.push({ name, room: this.room?.id, level: this.level.id, x: +x.toFixed(2), z: +z.toFixed(2), rot, y: +y.toFixed(3), solid });
    // A piece the player can actually examine gets an interaction point on its
    // front face, at reading height. This is the one place every placement goes
    // through, so an inspectable is never placed without its furniture, and the
    // point is always on the side that faces the room.
    const info = INSPECT[name];
    if (fitsRoom && info && this.room) {
      const front = fp.depth / 2 + 0.04;
      props.interactables.push({
        id: `inspect:${this.level.id}:${this.room.id}:${props.count}:${name}`,
        kind: 'inspect', name: info.name, text: info.text,
        x: +(x + Math.sin(rot) * front).toFixed(2),
        y: +(y + Math.min(1.55, fp.height * 0.62)).toFixed(2),
        z: +(z + Math.cos(rot) * front).toFixed(2),
        room: this.room.id,
      });
    }
    for (const g of t.geos) {
      const clone = g.geo.clone();
      if (rot) clone.rotateY(rot);
      clone.translate(x, y, z);
      this.geo(g.mat, clone);
    }
    props.count++;
    return { box: fp, t, rot };
  }
  // A piece backed against a wall: the model's back (measured min.z) ends up
  // `gap` from the wall's inner face, whatever the model's origin happens to
  // be. `frac` slides it along the wall.
  // The free spans of one wall: the room's clear run along it, minus every
  // door's approach. Placing furniture "somewhere on this wall" is then a span
  // search instead of a guess that slides in fixed steps and misses.
  wallSpans(room, wall) {
    const alongX = wall === 'N' || wall === 'S';
    const rect = this.rect;
    const lo = alongX ? rect.x0 : rect.z0;
    const hi = alongX ? rect.x1 : rect.z1;
    const line = alongX ? (wall === 'N' ? room.z1 : room.z0) : (wall === 'W' ? room.x0 : room.x1);
    const cuts = [];
    for (const z of this.zones) {
      const touches = alongX
        ? (Math.abs(z.z0 - line) < 1.2 || Math.abs(z.z1 - line) < 1.2)
        : (Math.abs(z.x0 - line) < 1.2 || Math.abs(z.x1 - line) < 1.2);
      if (!touches) continue;
      const a = alongX ? z.x0 : z.z0, b = alongX ? z.x1 : z.z1;
      if (b > lo && a < hi) cuts.push([Math.max(a, lo), Math.min(b, hi)]);
    }
    cuts.sort((p, q) => p[0] - q[0]);
    const spans = [];
    let cursor = lo;
    for (const [a, b] of cuts) {
      if (a > cursor) spans.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < hi) spans.push([cursor, hi]);
    return spans;
  }

  against(room, wall, name, frac = 0.5, { gap = 0.045, y = this.y, solid = true, margin = null, quiet = false } = {}) {
    // A piece that is deliberately flush with a wall must not then be rejected
    // for touching it: the clearance rule exists to keep free-standing
    // furniture out of walls, so a backed piece is allowed exactly its gap.
    const wallMargin = margin ?? Math.max(0, gap - 0.005);
    const t = template(name);
    if (!t) { props.missing.push(name); return null; }
    const { min } = t.box;
    const alongX = wall === 'N' || wall === 'S';
    const axis = alongX ? 'x' : 'z';
    const line = alongX
      ? (wall === 'N' ? room.z1 : room.z0)
      : (wall === 'W' ? room.x0 : room.x1);
    const { half } = wallFace(this.level, axis, line);
    const rot = wall === 'N' ? Math.PI : wall === 'S' ? 0
      : wall === 'E' ? -Math.PI / 2 : Math.PI / 2;
    // `min.z` is the model's back face; each wall branch solves for the centre
    // that puts that back exactly `gap` in front of the PLASTER, not in front
    // of the drawn room line.
    const back = wall === 'N' ? room.z1 - half - gap + min.z
      : wall === 'S' ? room.z0 + half + gap - min.z
        : wall === 'E' ? room.x1 - half - gap + min.z
          : room.x0 + half + gap - min.z;
    // how much wall the piece needs, measured from its own bounding box
    const turned = footprint(name, 0, 0, rot);
    const need = alongX ? (turned.x1 - turned.x0) : (turned.z1 - turned.z0);

    const lo = alongX ? this.rect.x0 : this.rect.z0;
    const hi = alongX ? this.rect.x1 : this.rect.z1;
    const desired = lo + (hi - lo) * frac;
    const spans = this.wallSpans(room, wall).map(([a, b]) => [a + wallMargin, b - wallMargin])
      .filter(([a, b]) => b - a >= need);
    spans.sort((p, q) => {
      const dp = Math.abs((p[0] + p[1]) / 2 - desired);
      const dq = Math.abs((q[0] + q[1]) / 2 - desired);
      return dp - dq;
    });
    for (const [a, b] of spans) {
      // The span is searched, not sampled once: the wanted spot first, then
      // outward in 12 cm steps — a dresser whose first choice is already taken
      // by the wardrobe slides along the wall instead of being reported lost.
      const lo = a + need / 2, hi = b - need / 2;
      if (hi < lo - 1e-6) continue;
      const start = Math.min(Math.max(desired, lo), hi);
      const step = 0.12;
      const cands = [start];
      const reach = hi - lo;
      for (let off = step; off <= reach + 1e-6; off += step) {
        if (start + off <= hi + 1e-6) cands.push(start + off);
        if (start - off >= lo - 1e-6) cands.push(start - off);
      }
      for (const centre of cands) {
        const x = alongX ? centre : back;
        const z = alongX ? back : centre;
        const placed = this.place(name, x, z, rot, { y, solid, margin: wallMargin, quiet: true });
        if (placed) return placed;
      }
    }
    if (!quiet) {
      props.rejected.push({ name, room: this.room?.id, level: this.level.id,
        x: null, z: null, why: 'no clear spot on this wall' });
    }
    return null;
  }
  // Try each wall in turn: a sofa that cannot sit on the north wall because a
  // door and its approach eat 2.6 m of it belongs on the west wall, not
  // nowhere. `frac` is where on the wall it is wanted first. The walls are
  // tried quietly: one piece that no wall takes is one line in the log, not
  // one line per wall it failed on.
  againstAny(room, walls, name, frac = 0.5, opts = {}) {
    for (const wall of walls) {
      const r = this.against(room, wall, name, frac, { ...opts, quiet: true });
      if (r) return r;
    }
    props.rejected.push({ name, room: room.id, level: this.level.id, x: null, z: null, why: 'no wall can take it' });
    return null;
  }
  // Wall-mounted, no collider, placed at a height: wall cabinets, hoods, mirrors.
  mount(name, room, wall, frac, height, { gap = 0.02, rot = null } = {}) {
    const t = template(name);
    if (!t) { props.missing.push(name); return null; }
    const { min } = t.box;
    const alongX = wall === 'N' || wall === 'S';
    const axis = alongX ? 'x' : 'z';
    const line = alongX ? (wall === 'N' ? room.z1 : room.z0) : (wall === 'W' ? room.x0 : room.x1);
    const { half } = wallFace(this.level, axis, line);
    const r0 = this.rect;
    let x, z, r = 0;
    if (wall === 'N') { x = r0.x0 + (r0.x1 - r0.x0) * frac; z = room.z1 - half - gap + min.z; r = Math.PI; }
    if (wall === 'S') { x = r0.x0 + (r0.x1 - r0.x0) * frac; z = room.z0 + half + gap - min.z; r = 0; }
    if (wall === 'E') { z = r0.z0 + (r0.z1 - r0.z0) * frac; x = room.x1 - half - gap + min.z; r = -Math.PI / 2; }
    if (wall === 'W') { z = r0.z0 + (r0.z1 - r0.z0) * frac; x = room.x0 + half + gap - min.z; r = Math.PI / 2; }
    const p = this.place(name, x, z, rot ?? r, { y: this.y + height, solid: false, fitsRoom: false });
    return p ? { ...p, x, z, rot: rot ?? r } : null;
  }
  // A thin surface fixed to a wall face: splashback tiles, tiled wainscot,
  // shower lining. Offset from the plaster so it cannot z-fight with it, and
  // UVs are set in metres (the material tiles one repeat per metre) so a 2.3 m
  // splashback is 2.3 m of tiles, not one enormous stretched one.
  panel(mat, x0, z0, x1, z1, y0, y1, facing) {
    const w = Math.hypot(x1 - x0, z1 - z0);
    const h = y1 - y0;
    const g = new THREE.PlaneGeometry(w, h);
    const rot = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[facing] ?? 0;
    g.rotateY(rot);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.geo(mat, g);
    props.tiles++;
    return g;
  }
  // A surface hung on the actual face of a wall: splashbacks, tiled linings,
  // wainscot. The wall's inner face is 0.11 m inside a room boundary (0.21 m
  // on an exterior wall), which is exactly how far into the masonry a panel
  // built "at the wall line" would sit — invisible.
  wallPanel(room, wall, mat, y0, y1, { pad = 0.014, inset = 0.035, from = null, to = null } = {}) {
    const axis = (wall === 'N' || wall === 'S') ? 'x' : 'z';
    const line = wall === 'N' ? room.z1 : wall === 'S' ? room.z0
      : wall === 'W' ? room.x0 : room.x1;
    const dir = (wall === 'N' || wall === 'E') ? -1 : 1;
    const { half } = wallFace(this.level, axis, line);
    const face = line + dir * half + dir * pad;
    const facing = axis === 'x' ? (dir > 0 ? '+z' : '-z') : (dir > 0 ? '+x' : '-x');
    const a = from ?? (axis === 'x' ? this.rect.x0 + inset : this.rect.z0 + inset);
    const b = to ?? (axis === 'x' ? this.rect.x1 - inset : this.rect.z1 - inset);
    if (axis === 'x') return this.panel(mat, a, face, b, face, y0, y1, facing);
    return this.panel(mat, face, a, face, b, y0, y1, facing);
  }
  // A tiled floor laid over the level's boards: 2 triangles, and the room
  // stops reading as a painted box.
  floorPatch(mat, room, y = this.y + 0.008) {
    const r = this.rect;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    g.translate((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
    this.geo(mat, g);
    props.tiles++;
  }
  finish() {
    for (const [matKey, geos] of this.buckets) {
      if (!geos.length) continue;
      const geo = mergeGeometries(geos);
      const base = materials[matKey];
      if (!base) { console.warn('[props] unknown material', matKey); continue; }
      const mat = base.clone();
      // UVs on props are metres (box() and panel() both write them that way),
      // so the surface gets the photograph's real size: tiles at 1.8 m, linen at
      // 1.2 m, timber at 2.4 m. At one repeat per metre every tiled lining read
      // as half-size tiles and every cloth as a coarse weave.
      tileAtMetres(mat, matKey === 'tile' || matKey === 'tileDirty' ? 0.35 : tileOf(matKey));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Props_' + this.level.id + '_' + matKey;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.buckets.clear();
  }
}

// --- small dressing helpers -------------------------------------------------
function lamp(d, x, z, { h = 0.52, warm = true, scale = 1, on = 0.7 } = {}) {
  const r = 0.16 * scale;
  d.box('woodDark', r * 2, 0.03, r * 2, x, d.y + h, z);
  d.box('iron',
 0.035 * scale, h, 0.035 * scale, x, d.y, z);
  const shade = new THREE.CylinderGeometry(r * 1.05, r * 1.5, 0.24 * scale, 12, 1, true);
  shade.translate(x, d.y + h + 0.19 * scale, z);
  d.geo('linen', shade);
  props.lights.push({ x, y: d.y + h + 0.16 * scale, z, color: warm ? 0xffc88a : 0xa8c4e0, intensity: 4.2, distance: 7, room: d.room?.id });
  return on;
}

// The player's interactable smart phone.
//
// The phone is authored by the dressing system the same way story objects are,
// but it is not part of the puzzle chain: it is just present in the world as a
// prop and a pickup, so the player can find and hold the phone.
//
// The phone's 3D mesh is loaded on demand by Game._loadPhoneAsync() and held
// in the player's hand by Game.takePhone() / holdPhone() from the low-poly
// iPhone GLB. The dressing system here only registers the pickup so the player
// can find and take the phone.
// Only the SPOT is decided here. The phone on the table is the real modelled
// asset, placed by Game._placeWorldPhone() once the GLB has loaded, so this
// records where it lies and what it lies on — a phone at floor level is a phone
// nobody sees, and the 78 cm box that used to stand in for it was worse than
// nothing.
// A loose floorboard in the walkway. It is not a pickup and not furniture: it is
// a world object that the player learns by stepping on (or by looking at), and
// the Resident can leave more of them the same way. The dress pass uses this to
// put one in the foyer so the rule shows up in the first minute. The physical
// mesh is placed later by the game once traps exist (see game.buildStoryBoards),
// so the dress pass only registers the prompt and the location.
function placeBoard(d, x, y, z) {
  const ry = Math.round(Math.random() * 2 - 1) * 0.15;
  // the board is a prop for the eye, not for the feet: it is not added to
  // colliders, so the player walks through it and only the sound tells
  props.interactables.push({
    id: 'board_' + x.toFixed(2) + '_' + z.toFixed(2),
    name: 'a loose floorboard',
    kind: 'trap',
    type: 'board',
    x, y, z, ry,
    seen: false,
  });
}

function placePhone(d, room, cx, cz, rot = 0, surfaceY = null) {
  props.interactables.push({
    id: 'phone',
    name: 'a smart phone',
    kind: 'pickup',
    x: cx,
    y: (surfaceY ?? d.y) + 0.03,
    z: cz,
    ry: rot,
    surfaceY: surfaceY ?? d.y + 0.012,
    room: room.name,
    text: 'A brushed aluminium phone, no sim, no lock screen. It powers on.',
  });
}

// What the player can learn by looking closely at the furniture. Every entry
// here becomes a real interaction point on the front face of every piece of
// that template (see place()), so a room's furniture is not mute scenery: the
// bed, the aparador, the stove and the desk all answer when the player looks at
// them. The text is deliberately household-scale — this is a family's house
// before it is a haunted one.
const INSPECT = {
  bed: { name: 'the bed', text: 'A hardwood frame with a woven rattan mat. The sheets are clean but have not been slept in for a long time. One pillow still holds the shape of a head.' },
  nightstand: { name: 'the bedside table', text: 'A small narra table. A ring of dried water, a rosary with one bead missing, and a glass that smells faintly of lambswool.' },
  wardrobe: { name: 'the aparador', text: 'A tall narra aparador with two panelled doors. Inside: a bar of hangers, three empty, one with a barong still in its plastic. The wood smells of mothballs and old rain.' },
  dresser: { name: 'the dresser', text: 'A dressing table with a tilting mirror. The silvering has gone at the edges. Photographs are wedged into the frame — the same four faces, years apart.' },
  bookshelf: { name: 'the shelves', text: 'Novels, prayer books, a bound set of encyclopaedias with one volume missing, and a tin of buttons. Someone has run a finger along the shelf recently: the dust is parted in a line.' },
  console: { name: 'the console table', text: 'A narrow table against the wall. A shallow drawer, a doily, a brass tray for keys. The tray is empty.' },
  side_table: { name: 'the side table', text: 'A low table with a cup ring and a folded newspaper. The date on it is three weeks old.' },
  coffee_table: { name: 'the centre table', text: 'A low narra table. A glass ashtray, a remote control with its battery cover gone, and a coaster that says MANILA.' },
  dining_table: { name: 'the dining table', text: 'A long table for twelve, polished to a shine in the middle and dull at the ends where no one sits. Six chairs are pushed in; one is pulled out.' },
  dining_chair: { name: 'the chair', text: 'A carved dining chair. The seat is worn pale at the front edge where generations of knees have pushed back from the table.' },
  desk: { name: 'the desk', text: 'A heavy writing desk with a green leather top. An inkwell, a blotter, and a fountain pen that is still wet.' },
  armchair: { name: 'the armchair', text: 'A deep armchair in worn velvet. One arm is darker than the other from a hand resting on it, night after night.' },
  sofa: { name: 'the sofa', text: 'A long sofa, good hardwood under cracked upholstery. Something small is wedged between the cushions: a hair clip, and the stub of a pencil.' },
  bench: { name: 'the bench', text: 'A hardwood bench. The finish has been rubbed away along the seat by people waiting.' },
  cabinet_base: { name: 'the cabinet', text: 'A base cabinet with a flat door and a brass catch. The door does not quite close: something inside holds it a finger-width open.' },
  wall_cabinet: { name: 'the wall cupboard', text: 'An upper cupboard, hinges rusted. It holds mismatched glasses and a jar of something dark with no label.' },
  counter_top: { name: 'the counter', text: 'A thick wooden counter, scrubbed pale in the middle. A chopping board, a knife, and a scattering of rice grains left to dry.' },
  sink_unit: { name: 'the sink', text: 'A deep enamel sink on cast legs. The tap turns a quarter and stops. The drain smells of old food and rust.' },
  cooker: { name: 'the stove', text: 'A four-burner gas range, one burner missing its cap. The oven door hangs a little. Someone has cleaned it recently, badly.' },
  fridge: { name: 'the refrigerator', text: 'An old refrigerator, still cold. Inside: a jar of pickles, half a bottle of milk that has not turned, and a covered plate with a name written on the tape.' },
  washer: { name: 'the washing machine', text: 'A twin-tub washer. The lid is up and the tub is dry. A shirt is folded on top of it, pressed.' },
  bath_tub: { name: 'the bath', text: 'A claw-footed bath. A ring of old water marks the enamel. The tap drips at a slow, even interval.' },
  basin: { name: 'the wash basin', text: 'A pedestal basin with a cracked soap dish. The mirror above it has been wiped clear in one streak, as if someone checked it was still them.' },
  wc: { name: 'the toilet', text: 'A high-tank toilet with a pull chain. The cistern refills with a sound like someone breathing in the next room.' },
  shower: { name: 'the shower', text: 'A tiled shower with a rusted rose. The tiles are darker at the bottom, and the drain is half blocked with hair.' },
};

function rug(d, room, w = 3, h = 2.2) {
  // A rug is a plane: over the stairwell it would hang in the air across the
  // drop (it did, on every floor of the stair hall). Keep the centre clear of
  // the stair hole by choosing the quadrant of the room with the most room.
  const fits = (cx, cz, ww, hh) => Math.min(cx - room.x0 - ww / 2, room.x1 - cx - ww / 2,
    cz - room.z0 - hh / 2, room.z1 - cz - hh / 2) >= 0.3;
  let bx = (room.x0 + room.x1) / 2, bz = (room.z0 + room.z1) / 2;
  if (Math.hypot(bx - STAIR.cx, bz - STAIR.cz) < STAIR.holeR + Math.hypot(w, h) / 2 + 0.35) {
    let placed = false;
    for (const scale of [1, 0.62]) {
      const ww = w * scale, hh = h * scale;
      const clear = STAIR.holeR + Math.hypot(ww, hh) / 2 + 0.3;
      let best = -1, bcx = 0, bcz = 0;
      for (const fx of [0.3, 0.7, 0.5, 0.2, 0.8]) {
        for (const fz of [0.3, 0.7, 0.5, 0.2, 0.8]) {
          const cx = room.x0 + (room.x1 - room.x0) * fx;
          const cz = room.z0 + (room.z1 - room.z0) * fz;
          if (!fits(cx, cz, ww, hh)) continue;
          const score = Math.hypot(cx - STAIR.cx, cz - STAIR.cz);
          if (score > best) { best = score; bcx = cx; bcz = cz; }
        }
      }
      if (best >= clear) { bx = bcx; bz = bcz; w = ww; h = hh; placed = true; break; }
    }
    if (!placed) return;   // no clear floor here: no rug at all
  }
  const g = new THREE.PlaneGeometry(w, h, 1, 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  g.translate(bx, d.y + 0.012, bz);
  d.geo('rug', g);
}

function portrait(d, room, wall, offset, w = 0.7, h = 0.95, y = 1.75) {
  // The frame stands 12 mm proud of the plaster, wherever the plaster actually
  // is: an exterior wall's face is 0.21 m inside the drawn room line.
  const alongX = wall === 'N' || wall === 'S';
  const axis = alongX ? 'x' : 'z';
  const line = alongX ? (wall === 'N' ? room.z1 : room.z0) : (wall === 'W' ? room.x0 : room.x1);
  const dir = (wall === 'N' || wall === 'E') ? -1 : 1;
  const level = d.level;
  const t = wallFace(level, axis, line).half + 0.012;
  let x, z, rot;
  if (wall === 'N') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z1 - t; rot = Math.PI; }
  else if (wall === 'S') { x = room.x0 + (room.x1 - room.x0) * offset; z = room.z0 + t; rot = 0; }
  else if (wall === 'E') { x = room.x1 - t; z = room.z0 + (room.z1 - room.z0) * offset; rot = -Math.PI / 2; }
  else { x = room.x0 + t; z = room.z0 + (room.z1 - room.z0) * offset; rot = Math.PI / 2; }
  void dir;
  const frame = box(w + 0.09, h + 0.09, 0.045, 1);
  frame.rotateY(rot);
  frame.translate(x, d.y + y, z);
  d.geo('woodDark', frame);
  const inner = box(w, h, 0.02, 1);
  inner.rotateY(rot);
  inner.translate(x, d.y + y, z);
  d.geo('marble', inner);
}

// A jar, bottle or tin standing on a surface. Small, but a worktop with
// nothing on it is the difference between a kitchen and a shop display.
function jar(d, x, y, z, r, h, mat = 'glass', lid = 'brass') {
  const g = new THREE.CylinderGeometry(r, r * 0.96, h, 10);
  g.translate(x, y + h / 2, z);
  d.geo(mat, g);
  if (lid) {
    const l = new THREE.CylinderGeometry(r * 0.92, r * 0.98, h * 0.12, 10);
    l.translate(x, y + h + h * 0.06, z);
    d.geo(lid, l);
  }
}

function bottle(d, x, y, z, r = 0.035, h = 0.24, mat = 'glass') {
  const body = new THREE.CylinderGeometry(r, r, h * 0.7, 9);
  body.translate(x, y + h * 0.35, z);
  d.geo(mat, body);
  const neck = new THREE.CylinderGeometry(r * 0.35, r * 0.6, h * 0.3, 8);
  neck.translate(x, y + h * 0.85, z);
  d.geo(mat, neck);
}

function plateStack(d, x, y, z, r = 0.11, n = 5) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(r, r * 0.94, 0.012, 12);
    g.translate(x, y + 0.008 + i * 0.017, z);
    d.geo('porcelain', g);
  }
}

function towel(d, x, y, z, len = 0.5, w = 0.28, mat = 'linen', rot = 0) {
  const g = box(w, len, 0.035, 1);
  g.rotateY(rot);
  g.translate(x, y, z);
  d.geo(mat, g);
}

// A pipe: a cylinder between two points, with a flange at each end.
function pipe(d, a, b, r = 0.017, mat = 'brass') {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  if (len < 1e-4) return;
  const g = new THREE.CylinderGeometry(r, r, len, 8);
  const dir = B.clone().sub(A).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  const mid = A.clone().add(B).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  d.geo(mat, g);
  for (const p of [A, B]) {
    const f = new THREE.CylinderGeometry(r * 2.1, r * 2.1, 0.02, 8);
    f.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    f.translate(p.x, p.y, p.z);
    d.geo(mat, f);
  }
}

// --- room dressers ---------------------------------------------------------
function dressBedroom(d, room) {
  const long = room.x1 - room.x0 > room.z1 - room.z0;
  const wall = long ? 'N' : 'W';
  // Private Bedroom 3 keeps an old iron bed instead of the joinery one. Its
  // frame stands 0.49 m off the floor, which is the clearance under-bed hiding
  // needs; the joinery beds sit 0.17 m off the floor and are not hiding
  // places (see src/world/hiding.js). Everything else about the room is the
  // same bedroom programme.
  const bedName = room.id === 'FF3-09' ? 'iron_bed' : 'bed';
  const bed = d.againstAny(room, long ? ['N', 'S', 'W', 'E'] : ['W', 'E', 'N', 'S'], bedName, 0.5, { gap: 0.03 });
  if (bed) {
    const bx = bed.box;
    const bw = bx.x1 - bx.x0, bd = bx.z1 - bx.z0;
    const bxm = (bx.x0 + bx.x1) / 2, bzm = (bx.z0 + bx.z1) / 2;
    // Which wall is the head against — the bed ends up wherever there is room,
    // so this is read back from the box that was actually placed, not from the
    // wall that was asked for first.
    const headWall = bd > bw
      ? ((room.z1 - bx.z1) <= (bx.z0 - room.z0) ? 'N' : 'S')
      : ((room.x1 - bx.x1) <= (bx.x0 - room.x0) ? 'E' : 'W');
    // One nightstand each side of the head, tight to the head wall. The stand
    // is measured from the clear rect — the plaster — not the drawn line:
    // built on the line it stands 11 cm inside the masonry and is rejected for
    // "outside room bounds", which is how fifteen bedrooms ended up with none.
    const ns = (x, z, rot) => {
      // A stand that lands in a doorway or over the plaster does not stay
      // there: it walks along the head wall in 30 cm steps until it is clear,
      // which keeps it beside the bed instead of dropping it from the room.
      const dx = headWall === 'N' || headWall === 'S';
      const tries = [{ x, z }];
      for (const s of [0.3, 0.6, 0.9, 1.2]) {
        tries.push(dx ? { x: x + s, z } : { x, z: z + s });
        tries.push(dx ? { x: x - s, z } : { x, z: z - s });
      }
      for (const t of tries) {
        if (d.place('nightstand', t.x, t.z, rot, { margin: 0.005, quiet: true })) {
          lamp(d, t.x, t.z);
          return;
        }
      }
    };
    const Rx0 = d.rect.x0, Rx1 = d.rect.x1, Rz0 = d.rect.z0, Rz1 = d.rect.z1;
    if (headWall === 'N') {
      ns(bx.x0 - 0.31, Rz1 - 0.24, Math.PI);
      ns(bx.x1 + 0.31, Rz1 - 0.24, Math.PI);
    } else if (headWall === 'S') {
      ns(bx.x0 - 0.31, Rz0 + 0.24, 0);
      ns(bx.x1 + 0.31, Rz0 + 0.24, 0);
    } else if (headWall === 'W') {
      ns(Rx0 + 0.24, bx.z0 - 0.31, Math.PI / 2);
      ns(Rx0 + 0.24, bx.z1 + 0.31, Math.PI / 2);
    } else {
      ns(Rx1 - 0.24, bx.z0 - 0.31, -Math.PI / 2);
      ns(Rx1 - 0.24, bx.z1 + 0.31, -Math.PI / 2);
    }
    void bxm; void bzm;
    rug(d, room, Math.min(2.6, room.x1 - room.x0 - 1.2), Math.min(2.4, room.z1 - room.z0 - 1.2));
    const wardrobeWall = long ? (room.x1 - room.x0 > 5.4 ? 'E' : 'W') : 'S';
    d.againstAny(room, [wardrobeWall, long ? 'W' : 'N', long ? 'S' : 'E'], 'wardrobe', 0.62, { gap: 0.03 });
    portrait(d, room, long ? 'S' : 'E', 0.28, 0.55, 0.7, 1.9);
    if (room.x1 - room.x0 > 5.6) d.againstAny(room, [long ? 'S' : 'E', long ? 'N' : 'W'], 'dresser', 0.28, { gap: 0.04 });
  } else {
    rug(d, room, 2.4, 2.0);
  }
}

function dressLiving(d, room) {
  const long = room.x1 - room.x0 > room.z1 - room.z0;
  const first = long ? ['W', 'E', 'N', 'S'] : ['N', 'S', 'W', 'E'];
  const sofa = d.againstAny(room, first, 'sofa', 0.5, { gap: 0.05 });
  const cx = (room.x0 + room.x1) / 2 + (long ? 0.4 : 0);
  const cz = (room.z0 + room.z1) / 2 + (long ? 0 : 0.4);
  d.place('coffee_table', cx, cz, 0);
  rug(d, room, Math.min(3.2, room.x1 - room.x0 - 1.0), Math.min(2.6, room.z1 - room.z0 - 1.0));
  // The armchair faces the sofa from whichever wall is still free, and a
  // side table lands wherever the two of them leave a corner.
  const armchair = d.againstAny(room, first.slice().reverse(), 'armchair', 0.5, { gap: 0.06 });
  const table = d.againstAny(room, ['W', 'E', 'N', 'S'].filter((w) => w !== first[0]), 'side_table', 0.72, { gap: 0.05 });
  if (table) {
    lamp(d, (table.box.x0 + table.box.x1) / 2, (table.box.z0 + table.box.z1) / 2, { h: 0.62 });
  } else if (armchair) {
    lamp(d, (armchair.box.x0 + armchair.box.x1) / 2 + 0.5, (armchair.box.z0 + armchair.box.z1) / 2, { h: 0.9 });
  }
  if (room.x1 - room.x0 > 5) {
    d.againstAny(room, [long ? 'E' : 'S', long ? 'N' : 'W'], 'console', 0.62, { gap: 0.05 });
    portrait(d, room, long ? 'E' : 'S', 0.62, 0.8, 1.0, 1.95);
  }
  portrait(d, room, long ? 'N' : 'E', 0.4, 0.7, 0.9, 1.9);
  void sofa;
}

function dressDining(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const table = d.place('dining_table', cx, cz, 0);
  if (table) {
    rug(d, room, 3.4, 2.6);
    const halfW = 1.10, halfD = 0.53;
    for (const sx of [-0.75, 0, 0.75]) {
      // north side chairs face south, south side chairs face north
      d.place('dining_chair', cx + sx, cz + halfD + 0.30, Math.PI);
      d.place('dining_chair', cx + sx, cz - halfD - 0.30, 0);
    }
    d.place('dining_chair', cx - halfW - 0.30, cz, -Math.PI / 2);
    d.place('dining_chair', cx + halfW + 0.30, cz, Math.PI / 2);
    // The narra aparador on the long wall, laid for the service the room was
    // abandoned in. The plates and bottles are placed off the piece's own
    // footprint: they used to be dropped at the room's centre line, so on any
    // wall but the north they hovered over the floor beside it.
    const sb = d.againstAny(room, ['N', 'S', 'E', 'W'], 'aparador', 0.5, { gap: 0.05 });
    if (sb) {
      const top = d.y + sb.t.box.max.y;
      const sx = (sb.box.x0 + sb.box.x1) / 2;
      const sz = (sb.box.z0 + sb.box.z1) / 2;
      plateStack(d, sx, top, sz, 0.13, 4);
      bottle(d, sx + 0.42, top, sz + 0.02, 0.04, 0.30, 'woodDark');
      bottle(d, sx + 0.52, top, sz - 0.04, 0.035, 0.26, 'glass');
    }
  }
  // candelabra over the table
  for (const sx of [-0.7, 0.7]) {
    d.box('brass', 0.02, 0.30, 0.02, cx + sx, d.y + 0.76, cz);
    const cup = new THREE.CylinderGeometry(0.05, 0.03, 0.05, 8);
    cup.translate(cx + sx, d.y + 1.08, cz);
    d.geo('brass', cup);
    const candle = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6);
    candle.translate(cx + sx, d.y + 1.22, cz);
    d.geo('linen', candle);
  }
}

function dressStudy(d, room) {
  const desk = d.againstAny(room, ['N', 'S', 'W', 'E'], 'desk', 0.55, { gap: 0.05 });
  if (desk) {
    const t = desk.t.box;
    const cx = (desk.box.x0 + desk.box.x1) / 2;
    const cz = room.z1 - (t.max.z - t.min.z) - 0.55;
    d.place('dining_chair', cx, cz, 0);
    lamp(d, cx + 0.5, room.z1 - 0.24, { h: 0.62 });
  }
  d.againstAny(room, ['W', 'E', 'S', 'N'], 'bookshelf', 0.42, { gap: 0.03 });
  if (room.z1 - room.z0 > 5.2) d.againstAny(room, ['W', 'E', 'S', 'N'], 'bookshelf', 0.78, { gap: 0.03 });
  d.againstAny(room, ['E', 'W', 'S', 'N'], 'bookshelf', 0.36, { gap: 0.03 });
  d.place('armchair', room.x1 - 1.0, (room.z0 + room.z1) / 2 + 0.4, -Math.PI / 2);
  rug(d, room, 2.2, 1.6);
  portrait(d, room, 'S', 0.5, 0.7, 0.9, 1.8);
}

// KITCHEN — the service wing's working room: a run of cabinets on the west
// wall with the sink under the window, the range on the north wall under its
// chimney hood, the fridge at the end of that run, tiled splashbacks, exposed
// plumbing and the clutter a working kitchen accumulates.
//
// Everything that meets a wall is measured from the wall's PLASTER face. On an
// exterior wall that is 0.21 m inside the line the plan draws, so a run built
// on the line instead stands half a cabinet inside the masonry. Windows are
// skipped: a splashback over a window is a wall, not a tile.
function dressKitchen(d, room) {
  const y = d.y;
  const R = d.rect;
  const westFace = room.x0 + wallFace(d.level, 'z', room.x0).half;
  const northFace = room.z1 - wallFace(d.level, 'x', room.z1).half;
  const eastFace = room.x1 - wallFace(d.level, 'z', room.x1).half;
  const xSpan = R.x1 - R.x0, zSpan = R.z1 - R.z0;
  const az = (z) => (z - R.z0) / zSpan;
  const ax = (x) => (x - R.x0) / xSpan;
  d.floorPatch('tileDirty', room, y + 0.008);

  // --- west run: two units, the sink under the window, one more unit -------
  // Window openings on this wall are at z -9.6..-8.6 and -5.4..-4.4; the sink
  // is deliberately the one under the first.
  const westRun = [
    ['cabinet_base', -10.45, 0.015],
    ['cabinet_base', -9.85, 0.015],
    ['sink_unit', -9.10, 0.012],
    ['cabinet_base', -8.10, 0.015],
  ];
  for (const [name, z, gap] of westRun) d.against(room, 'W', name, az(z), { gap });
  // two continuous slabs over the plain units; the sink carries its own top
  d.against(room, 'W', 'counter_top', az(-10.165), { gap: 0.006, y: y + 0.88, solid: false });
  d.against(room, 'W', 'counter_top', az(-8.10), { gap: 0.006, y: y + 0.88, solid: false });
  // splashback either side of the window over the sink
  d.wallPanel(room, 'W', 'tile', y + 0.918, y + 1.52, { from: R.z0 + 0.10, to: -9.65 });
  d.wallPanel(room, 'W', 'tile', y + 0.918, y + 1.52, { from: -8.55, to: -7.45 });
  d.against(room, 'W', 'wall_cabinet', az(-7.0), { gap: 0.02, y: y + 1.55, solid: false });

  // --- north run: the range under its hood, two cabinets, the fridge -------
  const cook = d.against(room, 'N', 'cooker', ax(R.x0 + 0.95), { gap: 0.005 });
  // read the range's real position back: the hood, the kettle and the pots all
  // hang off where it actually landed, not where it was asked for
  const cookerX = cook ? (cook.box.x0 + cook.box.x1) / 2 : R.x0 + 0.95;
  const hood = d.mount('hood', room, 'N', ax(cookerX), 1.58, { gap: 0.02 });
  d.wallPanel(room, 'N', 'tile', y + 0.918, y + 1.58, { inset: 0.26 });
  for (const dx of [1.68, 2.28]) d.against(room, 'N', 'cabinet_base', ax(R.x0 + dx), { gap: 0.005 });
  d.against(room, 'N', 'counter_top', ax(R.x0 + 1.98), { gap: 0.006, y: y + 0.88, solid: false });
  d.against(room, 'N', 'fridge', ax(R.x0 + 2.94), { gap: 0.01 });
  d.against(room, 'N', 'wall_cabinet', ax(R.x0 + 1.98), { gap: 0.02, y: y + 1.55, solid: false });
  // the hood's duct climbs to the ceiling; a chimney that stops in mid-air is
  // worse than no hood at all
  const ceilingY = d.level.y + d.level.h;
  if (hood) d.box('iron', 0.30, Math.max(0.3, ceilingY - (y + 2.30)), 0.28, hood.x, y + 2.30, hood.z);

  // --- plumbing: a wall-mounted heater with supply pipes and a flue --------
  const hx = westFace + 0.17, hz = -6.0;
  const heater = new THREE.CylinderGeometry(0.17, 0.17, 0.56, 14);
  heater.translate(hx, y + 1.55, hz);
  d.geo('enamel', heater);
  for (const hy of [1.42, 1.68]) d.box('iron', 0.07, 0.05, 0.34, westFace + 0.05, y + hy, hz);
  pipe(d, [hx, y + 1.27, hz], [hx, y + 0.94, hz], 0.016, 'brass');
  pipe(d, [hx, y + 1.83, hz], [hx, y + 1.98, hz], 0.014, 'brass');
  pipe(d, [hx, y + 1.98, hz], [westFace, y + 1.98, hz], 0.014, 'brass');
  pipe(d, [hx - 0.10, y + 1.45, hz], [westFace, y + 1.45, hz], 0.013, 'brass');
  // stopcock and a pressure gauge on the cold feed
  const gauge = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12);
  gauge.rotateZ(Math.PI / 2);
  gauge.translate(westFace + 0.06, y + 1.32, hz + 0.14);
  d.geo('brass', gauge);
  d.box('iron',
 0.05, 0.05, 0.05, hx, y + 1.06, hz + 0.10);

  // --- clutter: what a kitchen actually has on it --------------------------
  const surface = y + 0.918;
  jar(d, westFace + 0.26, surface, -10.45, 0.075, 0.20, 'glass');
  jar(d, westFace + 0.42, surface, -10.42, 0.062, 0.16, 'glass');
  jar(d, westFace + 0.33, surface, -10.10, 0.070, 0.26, 'rust', 'iron');
  bottle(d, westFace + 0.24, surface, -9.95, 0.038, 0.28, 'woodDark');
  bottle(d, westFace + 0.33, surface, -9.92, 0.033, 0.24, 'glass');
  // chopping board and a bowl on the second slab
  d.box('wood', 0.30, 0.025, 0.42, westFace + 0.34, surface, -7.95);
  const bowl = new THREE.CylinderGeometry(0.14, 0.10, 0.10, 12, 1, true);
  bowl.translate(westFace + 0.33, surface + 0.05, -8.45);
  d.geo('porcelain', bowl);
  // plates draining beside the sink, on the sink's own slab
  plateStack(d, westFace + 0.34, surface, -9.42, 0.10, 4);

  // kettle and pot on the range
  const kx = cookerX - 0.16, kz = northFace - 0.42;
  const kettle = new THREE.CylinderGeometry(0.10, 0.115, 0.16, 12);
  kettle.translate(kx, y + 0.98, kz);
  d.geo('iron', kettle);
  const spout = new THREE.CylinderGeometry(0.014, 0.02, 0.14, 8);
  spout.rotateZ(0.9);
  spout.translate(kx - 0.14, y + 1.01, kz);
  d.geo('iron', spout);
  d.box('iron',
 0.02, 0.06, 0.16, kx + 0.10, y + 1.04, kz);
  const pot = new THREE.CylinderGeometry(0.13, 0.12, 0.14, 14);
  pot.translate(cookerX + 0.17, y + 0.97, kz);
  d.geo('enamel', pot);
  const lid = new THREE.CylinderGeometry(0.135, 0.135, 0.02, 14);
  lid.translate(cookerX + 0.17, y + 1.05, kz);
  d.geo('enamel', lid);
  d.box('brass', 0.05, 0.02, 0.05, cookerX + 0.17, y + 1.06, kz);

  // broom and bucket in the south-east corner, well clear of the east door
  const bucket = new THREE.CylinderGeometry(0.15, 0.12, 0.30, 12, 1, true);
  bucket.translate(eastFace - 0.42, y + 0.15, R.z0 + 0.42);
  d.geo('rust', bucket);
  const mop = new THREE.CylinderGeometry(0.016, 0.016, 1.25, 8);
  mop.rotateZ(0.12);
  mop.translate(eastFace - 0.52, y + 0.62, R.z0 + 0.34);
  d.geo('wood', mop);

  // hanging herbs and a tea towel on the east wall
  d.box('wood', 0.03, 0.03, 0.55, eastFace - 0.04, y + 1.62, R.z0 + 1.30);
  for (let i = 0; i < 3; i++) {
    const bunch = new THREE.CylinderGeometry(0.03, 0.05, 0.22, 6);
    bunch.translate(eastFace - 0.10, y + 1.52, R.z0 + 1.12 + i * 0.18);
    d.geo('groundGrass', bunch);
  }
  towel(d, eastFace - 0.08, y + 1.30, R.z0 + 0.90, 0.34, 0.24, 'linen', Math.PI / 2);

  props.lights.push({ x: westFace + 0.4, y: y + 1.5, z: R.z0 + 0.9, color: 0xffd2a0, intensity: 3.4, distance: 5.5, room: room.id });
  props.lights.push({ x: cookerX, y: y + 1.6, z: northFace - 0.5, color: 0xffc88a, intensity: 2.6, distance: 5, room: room.id });
}

// BATH — a lined room: pan, pedestal basin, cast-iron tub, shower, tiled to
// 2.6 m, with the supply and waste pipework left visible where a real house
// leaves it visible.
//
// Two doors eat the middle of this room — the dressing room on the west wall
// (z -9..-7) and the linen room on the north (x 4..6) — and the south wall has
// a window at x 6.8..7.8, which the lining has to stop around.
function dressBath(d, room) {
  const y = d.y;
  const R = d.rect;
  const xSpan = R.x1 - R.x0;
  const ax = (x) => (x - R.x0) / xSpan;
  d.floorPatch('tileSmall', room, y + 0.008);
  // all four walls lined to 2.6 m, above the skirting so both read
  for (const w of ['W', 'N', 'E', 'S']) d.wallPanel(room, w, 'tile', y + 0.14, y + 2.6, { inset: 0.02 });

  // east strip = the tub, north-east = the pan and the basin, south-west = the
  // shower, and a stool beside the tub.
  const tub = d.against(room, 'E', 'bath_tub', 0.51, { gap: 0.02 });
  const basin = d.against(room, 'N', 'basin', ax(R.x0 + 1.90), { gap: 0.02 });
  const wc = d.against(room, 'N', 'wc', ax(R.x0 + 2.50), { gap: 0.015 });
  const shower = d.place('shower', R.x0 + 0.60, R.z0 + 0.60, Math.PI / 2, { margin: 0.01 });
  d.place('side_table', R.x1 - 1.15, R.z0 + 0.90, 0, { margin: 0.01 });
  void tub; void wc; void shower;

  if (basin) {
    const bx = (basin.box.x0 + basin.box.x1) / 2;
    const bz = room.z1 - wallFace(d.level, 'x', room.z1).half - 0.02;
    // supply riser up the wall, a cross, and the feed down to the taps
    pipe(d, [bx - 0.17, y + 0.30, bz - 0.03], [bx - 0.17, y + 1.62, bz - 0.03], 0.015, 'brass');
    pipe(d, [bx - 0.17, y + 1.62, bz - 0.03], [bx + 0.17, y + 1.62, bz - 0.03], 0.015, 'brass');
    pipe(d, [bx + 0.17, y + 1.62, bz - 0.03], [bx + 0.17, y + 0.90, bz - 0.03], 0.013, 'brass');
    // bottle trap under the bowl, into the wall
    pipe(d, [bx, y + 0.66, bz - 0.16], [bx, y + 0.42, bz - 0.16], 0.028, 'brass');
    pipe(d, [bx, y + 0.42, bz - 0.16], [bx, y + 0.42, bz - 0.01], 0.024, 'brass');
    // mirror over the basin, with a shelf and two bottles on it
    d.box('marble', 0.52, 0.70, 0.03, bx, y + 1.66, bz);
    d.box('woodDark', 0.56, 0.03, 0.16, bx, y + 1.24, bz - 0.10);
    bottle(d, bx - 0.14, y + 1.27, bz - 0.10, 0.030, 0.16, 'glass');
    bottle(d, bx + 0.06, y + 1.27, bz - 0.10, 0.026, 0.13, 'porcelain');
  }
  // cistern supply and the soil stack climbing the corner
  pipe(d, [room.x1 - 0.14, y + 0.62, room.z1 - 0.36], [room.x1 - 0.14, y + 1.30, room.z1 - 0.36], 0.012, 'brass');
  pipe(d, [room.x1 - 0.22, y + 0.25, room.z1 - 0.14], [room.x1 - 0.22, y + 2.55, room.z1 - 0.14], 0.055, 'iron');
  d.box('iron',
 0.14, 0.14, 0.14, room.x1 - 0.22, y + 2.48, room.z1 - 0.14);

  // towel rail on the east wall, clear of the tub and the shower
  const eastFace = room.x1 - wallFace(d.level, 'z', room.x1).half;
  pipe(d, [eastFace - 0.075, y + 1.22, R.z0 + 0.75], [eastFace - 0.075, y + 1.22, R.z0 + 1.45], 0.018, 'brass');
  towel(d, eastFace - 0.11, y + 1.05, R.z0 + 0.95, 0.42, 0.30, 'linen', Math.PI / 2);
  towel(d, eastFace - 0.11, y + 1.05, R.z0 + 1.30, 0.36, 0.26, 'velvet', Math.PI / 2);

  // bath mat, and a basket of linen in the south-east corner
  const mat = new THREE.PlaneGeometry(0.72, 0.46);
  mat.rotateX(-Math.PI / 2);
  mat.translate(R.x1 - 1.35, y + 0.012, R.z0 + 1.9);
  d.geo('linen', mat);
  const basket = new THREE.CylinderGeometry(0.19, 0.16, 0.34, 12, 1, true);
  basket.translate(R.x1 - 0.34, y + 0.17, R.z0 + 0.45);
  d.geo('woodDirt', basket);
  props.lights.push({ x: (R.x0 + R.x1) / 2, y: y + 2.2, z: (R.z0 + R.z1) / 2, color: 0xffe0bc, intensity: 3.2, distance: 5, room: room.id });
}

// LAUNDRY — a scullery-sized room. The window in its west wall sits at
// z 3.0..4.0 (sill 1.0), so the tiled splashback stops short of it and every
// pipe stays south of the reveal where a real plumber would have run it.
function dressLaundry(d, room) {
  const y = d.y;
  const westFace = room.x0 + wallFace(d.level, 'z', room.x0).half;
  d.floorPatch('tileDirty', room, y + 0.008);
  d.againstAny(room, ['W', 'E', 'S', 'N'], 'washer', 0.3, { gap: 0.03 });
  d.againstAny(room, ['W', 'E', 'S', 'N'], 'sink_unit', 0.68, { gap: 0.02 });
  d.wallPanel(room, 'W', 'tile', y + 0.935, y + 1.56, { from: room.z0 + 0.10, to: 2.85 });
  // plumbing: supply riser, waste, and a stopcock above the washer
  pipe(d, [westFace, y + 0.90, 2.55], [westFace, y + 1.95, 2.55], 0.016, 'brass');
  pipe(d, [westFace, y + 1.95, 2.55], [westFace + 0.34, y + 1.95, 2.55], 0.016, 'brass');
  pipe(d, [westFace + 0.34, y + 1.95, 2.55], [westFace + 0.34, y + 0.62, 2.55], 0.014, 'brass');
  pipe(d, [westFace + 0.12, y + 0.30, 2.30], [westFace + 0.12, y + 2.4, 2.30], 0.03, 'iron');
  d.box('iron',
 0.10, 0.10, 0.10, westFace + 0.34, y + 0.55, 2.55);
  // drying rack: two posts and four lines
  for (const sx of [0.55, 1.55]) d.box('wood', 0.05, 1.75, 0.05, room.x0 + sx, y, room.z0 + 1.55);
  for (let i = 0; i < 4; i++) {
    pipe(d, [room.x0 + 0.55, y + 1.20 + i * 0.12, room.z0 + 1.55],
      [room.x0 + 1.55, y + 1.20 + i * 0.12, room.z0 + 1.55], 0.006, 'linen');
  }
  towel(d, room.x0 + 0.85, y + 1.42, room.z0 + 1.55, 0.42, 0.30, 'linen');
  towel(d, room.x0 + 1.25, y + 1.30, room.z0 + 1.55, 0.36, 0.24, 'linen');
  // detergent boxes, a basket and a pile of sheets
  for (let i = 0; i < 3; i++) {
    d.box('linen', 0.16, 0.22, 0.10, room.x1 - 0.30, y + i * 0.23, room.z1 - 0.35 + (i % 2) * 0.02);
  }
  d.box('woodDirt', 0.42, 0.30, 0.32, room.x1 - 0.42, y + 0.30, room.z0 + 0.55);
  for (let i = 0; i < 3; i++) {
    const g = box(0.40, 0.06, 0.30, 1);
    g.rotateY(i * 0.10);
    g.translate(room.x1 - 0.52, y + 0.04 + i * 0.06, room.z0 + 0.62);
    d.geo('linen', g);
  }
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: y + 2.15, z: (room.z0 + room.z1) / 2, color: 0xffe2c2, intensity: 2.8, distance: 5.5, room: room.id });
}

// HER DRESSING ROOM — 3 x 5 m with a door on each of the west and north
// walls, so the walls are assigned rather than guessed at: wardrobes face each
// other on the long walls, the dresser takes the north run the door leaves
// free, and the bench sits under the south window where no one walks.
function dressDressingRoom(d, room) {
  // wardrobes face each other on the long walls, clear of both doors
  d.against(room, 'W', 'wardrobe', 0.4, { gap: 0.02 });
  d.against(room, 'E', 'wardrobe', 0.4, { gap: 0.02 });
  // the north run is only 0.85 m free (the west door's approach reaches it)
  // and the south wall is cut by a doorway, so no wall will take a 1.3 m bench:
  // it goes in the middle of the room instead, long side to the wardrobes,
  // where a dressing bench actually belongs
  d.place('bench', (d.rect.x0 + d.rect.x1) / 2, (d.rect.z0 + d.rect.z1) / 2 - 0.4, Math.PI / 2, { margin: 0.06 });
  d.againstAny(room, ['S', 'N', 'E'], 'dresser', 0.3, { gap: 0.03 });
  portrait(d, room, 'N', 0.3, 0.5, 0.65, 1.85);
}

function dressStorage(d, room) {
  const wall = room.z1 - room.z0 > room.x1 - room.x0 ? 'N' : 'E';
  d.againstAny(room, [wall, wall === 'N' ? 'E' : 'N', 'S', 'W'], 'bookshelf', 0.3, { gap: 0.03 });
  d.againstAny(room, [wall, wall === 'N' ? 'E' : 'N', 'S', 'W'], 'bookshelf', 0.72, { gap: 0.03 });
  // crates stacked on the floor, each resting on the one below
  const cx = (room.x0 + room.x1) / 2 + 0.6, cz = (room.z0 + room.z1) / 2;
  for (let i = 0; i < 3; i++) {
    const w = 0.6 + (i % 2) * 0.1;
    d.box('woodDirt', w, 0.40, 0.5, cx, d.y + i * 0.40, cz);
  }
  // jars on the shelf line
  for (let i = 0; i < 5; i++) jar(d, cx - 0.5 + i * 0.22, d.y + 0.95, cz + 0.36, 0.06, 0.18, 'glass');
}

function dressPantry(d, room) {
  d.againstAny(room, ['W', 'E', 'N', 'S'], 'bookshelf', 0.30, { gap: 0.03 });
  d.againstAny(room, ['W', 'E', 'N', 'S'], 'bookshelf', 0.72, { gap: 0.03 });
  d.againstAny(room, ['N', 'S', 'E', 'W'], 'dresser', 0.5, { gap: 0.04 });
  const shelfY = d.y + 0.28;
  for (let i = 0; i < 7; i++) {
    jar(d, room.x0 + 0.30, shelfY + (i % 3) * 0.52, room.z0 + 0.55 + (i % 4) * 0.42, 0.07, 0.20, i % 2 ? 'glass' : 'rust');
  }
  // sacks of flour and rice on the floor, a crate of root vegetables
  for (let i = 0; i < 3; i++) {
    const sack = new THREE.CylinderGeometry(0.14, 0.17, 0.52, 9);
    sack.translate(room.x1 - 0.45 - (i % 2) * 0.30, d.y + 0.26, room.z0 + 0.42 + i * 0.30);
    d.geo('linen', sack);
  }
  d.box('woodDirt', 0.44, 0.24, 0.34, room.x1 - 0.55, d.y, (room.z0 + room.z1) / 2 + 0.4);
}

function dressChapel(d, room) {
  const altar = d.againstAny(room, ['N', 'S', 'W', 'E'], 'console', 0.5, { gap: 0.05 });
  if (altar) {
    d.box('linen', 1.24, 0.012, 0.40, (altar.box.x0 + altar.box.x1) / 2, d.y + 0.83, room.z1 - 0.24);
    d.box('woodDark', 0.10, 0.72, 0.06, (altar.box.x0 + altar.box.x1) / 2, d.y + 0.84, room.z1 - 0.10);
    d.box('woodDark', 0.44, 0.09, 0.06, (altar.box.x0 + altar.box.x1) / 2, d.y + 1.52, room.z1 - 0.10);
    for (const off of [-0.44, 0.44]) {
      const c = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6);
      c.translate((altar.box.x0 + altar.box.x1) / 2 + off, d.y + 0.96, room.z1 - 0.24);
      d.geo('linen', c);
    }
  }
  d.place('bench', (room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2 - 0.4, 0);
  rug(d, room, 1.8, 2.4);
}

function dressMusic(d, room) {
  d.againstAny(room, ['N', 'S', 'W', 'E'], 'console', 0.5, { gap: 0.05 });
  d.place('armchair', (room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2 + 0.2, Math.PI);
  d.place('side_table', room.x0 + 0.65, room.z0 + 0.8, 0);
  rug(d, room, 2.4, 2.0);
  portrait(d, room, 'W', 0.8, 0.6, 0.8, 1.9);
}

function dressGenerator(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const gx = cx, gz = cz - 0.4;

  // A concrete plinth, then the set standing on anti-vibration mounts.
  d.box('concreteFloor', 2.6, 0.09, 1.6, gx, d.y, gz);
  const pad = { x0: gx - 1.3, x1: gx + 1.3, z0: gz - 0.8, z1: gz + 0.8 };
  addCollider(pad, d.y, d.y + 1.35);
  const Y = d.y + 0.09;          // top of the pad = bottom of the skid

  // Small local helpers: everything is positioned by its CENTRE, unlike
  // d.box() which takes the bottom. The generator is a machine, not a stack of
  // shelves: a 15 mm error in a pipe run reads immediately.
  const bx = (mat, w, h, dp, x, y, z, ry = 0) => {
    const g = box(w, h, dp, 1);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    d.geo(mat, g);
  };
  const cylX = (mat, r, len, x, y, z, seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2);
    g.translate(x, y, z);
    d.geo(mat, g);
  };
  const cylY = (mat, r, len, x, y, z, seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.translate(x, y, z);
    d.geo(mat, g);
  };
  const cylZ = (mat, r, len, x, y, z, seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    d.geo(mat, g);
  };
  const tube = (mat, a, b, r = 0.02, seg = 8) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    d.geo(mat, g);
  };

  // --- skid: two channels, cross members, lifting eyes ----------------------
  for (const sz of [-1, 1]) {
    bx('rustDark', 2.15, 0.16, 0.10, gx, Y + 0.08, gz + sz * 0.38);
    // channel flanges, so the base is a rolled section and not a bar
    bx('rust', 2.15, 0.025, 0.16, gx, Y + 0.025, gz + sz * 0.38);
    for (const sx of [-1, 1]) {
      const eye = new THREE.TorusGeometry(0.035, 0.012, 6, 10);
      eye.rotateY(Math.PI / 2);
      eye.translate(gx + sx * 1.01, Y + 0.17, gz + sz * 0.38);
      d.geo('rust', eye);
    }
  }
  for (const x of [-0.95, -0.35, 0.35, 0.95]) {
    bx('rustDark', 0.08, 0.12, 0.78, gx + x, Y + 0.06, gz);
  }
  // four rubber mounts between skid and engine rails
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cylY('ironDark', 0.045, 0.07, gx + sx * 0.72, Y + 0.20, gz + sz * 0.30, 10);
    }
  }
  // base fuel tank inside the skid, with filler and a sight glass
  bx('rust', 1.55, 0.15, 0.62, gx - 0.05, Y + 0.14, gz);
  bx('ironDark', 0.10, 0.03, 0.62, gx - 0.78, Y + 0.23, gz);
  tube('ironDark', [gx - 0.78, Y + 0.20, gz + 0.22], [gx - 0.78, Y + 0.34, gz + 0.22], 0.028);
  cylY('brass', 0.040, 0.035, gx - 0.78, Y + 0.36, gz + 0.22, 10);
  cylX('glass', 0.012, 0.16, gx + 0.68, Y + 0.13, gz + 0.33, 8);

  // --- engine: block, cylinder head, rocker cover --------------------------
  // The block is the mass the eye reads first, so it gets real proportions:
  // 1.05 m long, 0.50 m tall, 0.56 m across, with ribs and a sump below.
  bx('ironDark', 1.05, 0.46, 0.56, gx - 0.34, Y + 0.50, gz);
  bx('ironDark', 0.90, 0.15, 0.60, gx - 0.34, Y + 0.28, gz);   // sump
  for (let i = 0; i < 5; i++) {
    bx('iron', 0.012, 0.42, 0.585, gx - 0.82 + i * 0.21, Y + 0.50, gz);
  }
  bx('iron', 0.98, 0.13, 0.52, gx - 0.34, Y + 0.79, gz);        // cylinder head
  bx('engineEnamel', 0.86, 0.13, 0.42, gx - 0.34, Y + 0.92, gz); // rocker cover
  bx('engineEnamel', 0.82, 0.03, 0.38, gx - 0.34, Y + 0.99, gz);
  cylY('brass', 0.035, 0.04, gx - 0.66, Y + 1.01, gz + 0.10, 10); // oil filler
  // injector lines: four hard lines from the pump to the head
  for (let i = 0; i < 4; i++) {
    const x = gx - 0.72 + i * 0.20;
    tube('brass', [x, Y + 0.84, gz + 0.27], [x + 0.03, Y + 0.78, gz + 0.20], 0.006, 6);
  }
  // starter motor on the flywheel side
  cylX('iron', 0.075, 0.22, gx + 0.05, Y + 0.40, gz + 0.30, 10);

  // --- flywheel housing and alternator ------------------------------------
  cylX('iron', 0.34, 0.20, gx + 0.34, Y + 0.62, gz, 20);
  // bolt ring on the bell housing
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cylX('iron', 0.014, 0.025, gx + 0.445, Y + 0.62 + Math.cos(a) * 0.30,
      gz + Math.sin(a) * 0.30, 6);
  }
  // alternator barrel, with cooling bands and a terminal box
  cylX('iron', 0.30, 0.52, gx + 0.68, Y + 0.62, gz, 20);
  for (let i = 0; i < 5; i++) {
    cylX('ironDark', 0.305, 0.018, gx + 0.50 + i * 0.09, Y + 0.62, gz, 20);
  }
  bx('ironDark', 0.18, 0.14, 0.18, gx + 0.74, Y + 0.94, gz + 0.10);
  bx('brass', 0.10, 0.02, 0.10, gx + 0.74, Y + 1.02, gz + 0.10);
  cylX('ironDark', 0.16, 0.06, gx + 0.96, Y + 0.62, gz, 14);

  // --- radiator, shroud and fan -------------------------------------------
  const rx = gx - 1.02;
  bx('iron', 0.10, 0.70, 0.76, rx, Y + 0.62, gz);                // top/bottom tanks
  bx('iron', 0.10, 0.12, 0.80, rx, Y + 1.02, gz);
  bx('iron', 0.10, 0.12, 0.80, rx, Y + 0.24, gz);
  bx('ironDark', 0.07, 0.60, 0.70, rx, Y + 0.63, gz);            // core
  for (let i = 0; i < 11; i++) {
    bx('ironDark', 0.014, 0.58, 0.018, rx - 0.045, Y + 0.62, gz - 0.33 + i * 0.066);
  }
  // shroud ring and a six-blade fan behind the core
  const shroud = new THREE.CylinderGeometry(0.33, 0.33, 0.10, 20, 1, true);
  shroud.rotateZ(Math.PI / 2);
  shroud.translate(rx + 0.12, Y + 0.62, gz);
  d.geo('ironDark', shroud);
  const fanC = [rx + 0.10, Y + 0.62, gz];
  cylX('ironDark', 0.055, 0.06, fanC[0], fanC[1], fanC[2], 10);
  for (let i = 0; i < 6; i++) {
    const g = box(0.016, 0.26, 0.075, 1);
    g.translate(0, 0.14, 0);
    g.rotateX((i / 6) * Math.PI * 2);
    g.translate(fanC[0], fanC[1], fanC[2]);
    d.geo('iron', g);
  }
  cylY('brass', 0.038, 0.04, rx, Y + 1.08, gz + 0.18, 10);       // radiator cap
  // top and bottom hoses, with a slight sag rather than a straight stick
  tube('ironDark', [rx + 0.06, Y + 0.94, gz - 0.16], [gx - 0.72, Y + 0.92, gz - 0.16], 0.042, 10);
  tube('ironDark', [rx + 0.06, Y + 0.34, gz + 0.18], [gx - 0.75, Y + 0.40, gz + 0.20], 0.038, 10);
  cylX('brass', 0.052, 0.05, rx + 0.06, Y + 0.94, gz - 0.16, 10);

  // --- intake and filtration ----------------------------------------------
  cylX('ironDark', 0.115, 0.38, gx - 0.20, Y + 1.02, gz + 0.38, 14); // air cleaner
  cylX('iron', 0.122, 0.03, gx - 0.38, Y + 1.02, gz + 0.38, 14);
  cylX('iron', 0.122, 0.03, gx - 0.02, Y + 1.02, gz + 0.38, 14);
  tube('ironDark', [gx - 0.20, Y + 1.02, gz + 0.30], [gx - 0.34, Y + 0.86, gz + 0.24], 0.035, 8);
  // fuel filter and water separator on a bracket
  bx('iron', 0.20, 0.05, 0.16, gx - 0.55, Y + 0.46, gz + 0.36);
  cylY('iron', 0.055, 0.22, gx - 0.55, Y + 0.58, gz + 0.36, 12);
  cylY('glass', 0.045, 0.07, gx - 0.55, Y + 0.44, gz + 0.36, 12);
  cylY('brass', 0.03, 0.03, gx - 0.55, Y + 0.70, gz + 0.36, 8);

  // --- exhaust: manifold, flexible section, muffler, stack ----------------
  // The manifold runs along the back of the head and collects into one pipe.
  cylX('rust', 0.038, 0.86, gx - 0.34, Y + 0.80, gz - 0.31, 10);
  for (let i = 0; i < 4; i++) {
    const x = gx - 0.72 + i * 0.21;
    tube('rust', [x, Y + 0.88, gz - 0.28], [x, Y + 0.80, gz - 0.31], 0.028, 8);
    cylX('rust', 0.045, 0.035, x, Y + 0.79, gz - 0.31, 8);
  }
  tube('rust', [gx - 0.76, Y + 0.80, gz - 0.31], [gx - 0.98, Y + 0.96, gz - 0.55], 0.042, 8);
  // flexible bellows: five rings, not a smooth cylinder
  for (let i = 0; i < 5; i++) {
    cylY('rust', 0.050, 0.018, gx - 0.90, Y + 0.90 + i * 0.018, gz - 0.46, 10);
  }
  cylY('rustDark', 0.083, 0.50, gx - 1.02, Y + 1.16, gz - 0.55, 16);
  cylY('ironDark', 0.088, 0.04, gx - 1.02, Y + 1.41, gz - 0.55, 16);
  tube('rustDark', [gx - 1.02, Y + 1.40, gz - 0.55], [gx - 1.02, Y + 1.98, gz - 0.55], 0.040, 10);
  // rain cap: a cone, open at the bottom
  const cap = new THREE.ConeGeometry(0.10, 0.10, 12);
  cap.translate(gx - 1.02, Y + 2.05, gz - 0.55);
  d.geo('rustDark', cap);
  cylY('rustDark', 0.043, 0.08, gx - 1.02, Y + 1.97, gz - 0.55, 10);

  // --- battery, cables -----------------------------------------------------
  bx('woodGrey', 0.36, 0.05, 0.26, gx + 0.92, Y + 0.20, gz + 0.26);
  bx('ironDark', 0.34, 0.22, 0.22, gx + 0.92, Y + 0.32, gz + 0.26);
  cylY('brass', 0.018, 0.03, gx + 0.80, Y + 0.45, gz + 0.30, 8);
  cylY('brass', 0.018, 0.03, gx + 1.04, Y + 0.45, gz + 0.30, 8);
  tube('ironDark', [gx + 0.80, Y + 0.44, gz + 0.30], [gx + 0.26, Y + 0.40, gz + 0.18], 0.016, 6);

  // --- control panel -------------------------------------------------------
  // On the south face, where a person walks up to start and stop the set.
  // The box is bolted to the alternator end and stands on two short legs, so it
  // is part of the machine rather than a panel hovering in front of it.
  const px = gx + 0.12, py = Y + 0.68, pz = gz + 0.38;
  bx('panelSteel', 0.52, 0.44, 0.14, px, py, pz);
  bx('iron', 0.46, 0.37, 0.018, px, py + 0.01, pz + 0.078);
  for (const sx of [-1, 1]) {
    bx('ironDark', 0.040, 0.34, 0.040, px + sx * 0.18, Y + 0.30, pz - 0.01);
    bx('ironDark', 0.07, 0.025, 0.10, px + sx * 0.18, Y + 0.13, pz - 0.01);
  }
  // hinges and a latch
  for (const sx of [-1, 1]) {
    cylY('brass', 0.012, 0.09, px + sx * 0.22, py + 0.10, pz + 0.09, 8);
  }
  bx('brass', 0.05, 0.02, 0.02, px + 0.17, py - 0.15, pz + 0.095);
  // three gauges with brass bezels and pale faces
  for (let i = 0; i < 3; i++) {
    const gxp = px - 0.16 + i * 0.16;
    cylZ('brass', 0.050, 0.022, gxp, py + 0.10, pz + 0.090, 14);
    cylZ('porcelain', 0.042, 0.010, gxp, py + 0.10, pz + 0.098, 14);
    // needle, one per gauge so they do not read as empty circles
    bx('ironDark', 0.003, 0.030, 0.004, gxp + 0.008, py + 0.105, pz + 0.104);
  }
  // breaker handle, start key and stop button
  bx('ironDark', 0.06, 0.10, 0.035, px - 0.16, py - 0.14, pz + 0.098);
  cylZ('brass', 0.018, 0.025, px, py - 0.13, pz + 0.098, 10);
  cylZ('ironDark', 0.034, 0.03, px + 0.16, py - 0.13, pz + 0.105, 12);
  cylZ('brass', 0.040, 0.008, px + 0.16, py - 0.13, pz + 0.120, 12);
  // a small enamel maker's plate and a warning label
  bx('paint', 0.16, 0.045, 0.004, px, py + 0.175, pz + 0.098);
  bx('paint', 0.10, 0.07, 0.003, px + 0.24, py - 0.02, pz + 0.045);
  // conduit from the panel to the wall board
  // Conduit leaves the bottom of the panel, runs down to the plinth, crosses
  // the floor to the east wall and climbs to the board. It does not cut a
  // diagonal through the room at chest height.
  tube('ironDark', [px + 0.22, py - 0.21, pz - 0.02], [px + 0.22, Y + 0.10, pz - 0.02], 0.020, 8);
  tube('ironDark', [px + 0.22, Y + 0.10, pz - 0.02], [room.x1 - 0.25, Y + 0.10, cz + 0.9], 0.020, 8);
  tube('ironDark', [room.x1 - 0.25, Y + 0.10, cz + 0.9], [room.x1 - 0.25, Y + 1.30, cz + 0.9], 0.020, 8);

  // --- distribution board on the east wall, wired to the set ---------------
  const dbx = room.x1 - 0.12, dbz = cz + 0.9;
  bx('iron', 0.16, 0.75, 0.60, dbx, d.y + 1.05, dbz);
  bx('woodGrey', 0.030, 0.62, 0.50, dbx - 0.09, d.y + 1.12, dbz);
  for (let i = 0; i < 3; i++) {
    const dial = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8);
    dial.rotateZ(Math.PI / 2);
    dial.translate(dbx - 0.11, d.y + 1.30 + (i % 2) * 0.16, dbz - 0.16 + Math.floor(i / 2) * 0.20);
    d.geo('iron', dial);
  }
  tube('iron', [dbx, d.y + 1.42, dbz + 0.20], [dbx, d.y + 2.05, dbz + 0.20], 0.030, 8);
  tube('iron', [dbx, d.y + 1.42, dbz + 0.20], [dbx, d.y + 1.42, gz + 0.50], 0.030, 8);

  // A caged work lamp over the set. A generator room has one, and it is what
  // makes the engine, the gauges and the oil staining readable without turning
  // the basement into a showroom.
  const lampX = gx, lampZ = gz - 0.10, lampY = d.y + 2.25;
  cylY('ironDark', 0.006, 1.10, lampX, d.y + 2.80, lampZ, 6);
  const shade = new THREE.CylinderGeometry(0.055, 0.185, 0.14, 12, 1, true);
  shade.translate(lampX, lampY + 0.07, lampZ);
  d.geo('ironDark', shade);
  const bulb = new THREE.SphereGeometry(0.045, 10, 8);
  bulb.translate(lampX, lampY - 0.035, lampZ);
  d.geo('glass', bulb);
  props.lights.push({
    x: lampX, y: lampY, z: lampZ, color: 0xcfd8cc,
    intensity: 5, distance: 6.5, room: room.id,
  });

  // The prompt sits on the control face, not inside the engine block.
  props.interactables.push({
    id: 'generator', name: 'the generator', kind: 'generator',
    x: gx, y: d.y + 1.05, z: gz + 0.96, room: room.name,
  });

  // fuel drum and tool bench (unchanged gameplay; the drum is the fuel source)
  const drumGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.88, 14);
  drumGeo.translate(room.x0 + 1.1, d.y + 0.44, room.z0 + 1.4);
  d.geo('rust', drumGeo);
  // drum ribs and a bung, so it is a drum and not a pillar
  for (const yy of [0.24, 0.64]) {
    const rib = new THREE.TorusGeometry(0.305, 0.012, 5, 18);
    rib.rotateX(Math.PI / 2);
    rib.translate(room.x0 + 1.1, d.y + yy, room.z0 + 1.4);
    d.geo('rustDark', rib);
  }
  cylY('brass', 0.045, 0.04, room.x0 + 1.2, d.y + 0.90, room.z0 + 1.4, 10);
  addCollider({ x0: room.x0 + 0.8, x1: room.x0 + 1.4, z0: room.z0 + 1.1, z1: room.z0 + 1.7 }, d.y, d.y + 0.88);
  props.interactables.push({
    id: 'fuel', name: 'a jerry can of diesel', kind: 'pickup',
    x: room.x0 + 1.1, y: d.y + 0.45, z: room.z0 + 1.4, room: room.name,
  });
  d.againstAny(room, ['E', 'W', 'S'], 'console', 0.25, { gap: 0.04 });
  d.box('rust', 0.5, 0.6, 0.2, room.x1 - 0.25, d.y + 0.9, (room.z0 + room.z1) / 2);
  props.lights.push({ x: room.x1 - 0.35, y: d.y + 1.9, z: (room.z0 + room.z1) / 2, color: 0x9fb8d8, intensity: 2.5, distance: 7, room: room.id });
}

function dressWorkshop(d, room) {
  const bench = d.againstAny(room, ['N', 'S', 'E', 'W'], 'dining_table', 0.5, { gap: 0.04 });
  if (bench) {
    const cx = (bench.box.x0 + bench.box.x1) / 2;
    for (let i = 0; i < 6; i++) {
      d.box('iron',
 0.10, 0.18, 0.10, cx - 0.6 + i * 0.24, d.y + 0.76, room.z1 - 0.28);
    }
    // vice on the bench end
    d.box('iron',
 0.16, 0.14, 0.16, cx + 0.86, d.y + 0.76, room.z1 - 0.30);
    d.box('iron',
 0.05, 0.10, 0.30, cx + 0.90, d.y + 0.80, room.z1 - 0.38);
  }
  d.againstAny(room, ['E', 'W', 'S', 'N'], 'bookshelf', 0.6, { gap: 0.03 });
  d.place('bench', (room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2 + 0.5, 0);
  // sawdust, a toolbox and a coil of cable on the floor
  for (let i = 0; i < 4; i++) {
    const g = box(0.28, 0.12, 0.20, 1);
    g.rotateY(i * 0.7);
    g.translate(room.x0 + 1.1 + i * 0.35, d.y + 0.06, room.z0 + 1.0 + (i % 2) * 0.3);
    d.geo('woodDirt', g);
  }
  const coil = new THREE.TorusGeometry(0.22, 0.035, 6, 14);
  coil.rotateX(Math.PI / 2);
  coil.translate(room.x1 - 0.9, d.y + 0.04, room.z0 + 0.9);
  d.geo('iron', coil);
  // a ceramic fuse on the bench near the end where the vise sits; instructable
  // wire runs from the fuse along the bench toward the distribution board
  const fuseX = (room.x0 + room.x1) / 2, fuseZ = room.z1 - 0.55;
  const fuseY = d.y + 0.95;
  // A short wire nub under each end so the fuse does not read as a cylinder
  // balancing on air when the player is close.
  const fuseBaseGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.006, 12);
  fuseBaseGeo.translate(fuseX, fuseY + 0.003, fuseZ);
  d.geo('woodDirt', fuseBaseGeo);
  // ceramic body: a short cylinder with a slight taper
  const fuseBody = new THREE.CylinderGeometry(0.028, 0.024, 0.042, 14);
  fuseBody.translate(fuseX, fuseY + 0.024, fuseZ);
  d.geo('ceramic', fuseBody);
  // Paper / foil wrap around the body: sits just outside the ceramic, a real
  // cartridge fuse reads as paper and foil in the middle, not bare white clay.
  const fuseWrap = new THREE.CylinderGeometry(0.031, 0.027, 0.030, 14);
  fuseWrap.translate(fuseX, fuseY + 0.024, fuseZ);
  d.geo('paper', fuseWrap);
  // Metal end caps / ferrules
  const cap = new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10);
  cap.translate(fuseX, fuseY + 0.042, fuseZ);
  d.geo('brass', cap);
  const cap2 = new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10);
  cap2.translate(fuseX, fuseY + 0.006, fuseZ);
  d.geo('brass', cap2);
  // wire to the distribution board, along the bench surface
  pipe(d, [fuseX, fuseY + 0.045, fuseZ], [fuseX + 0.30, fuseY + 0.045, fuseZ + 0.15], 0.010, 'brass');
  props.interactables.push({
    id: 'fuse', name: 'a ceramic fuse', kind: 'pickup',
    x: fuseX, y: fuseY, z: fuseZ, room: room.name,
  });
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 2.3, z: (room.z0 + room.z1) / 2, color: 0xd8bd8a, intensity: 3, distance: 6, room: room.id });
}

function dressObservatory(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  d.place('side_table', cx, cz, 0);
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
  d.box('iron',
 0.20, 0.20, 0.40, cx - 0.35, d.y + 1.35, cz);
}

function dressBell(d, room) {
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  for (const dx of [-0.9, 0.9]) d.box('woodDark', 0.16, 2.6, 0.16, cx + dx, d.y, cz);
  d.box('woodDark', 2.0, 0.2, 0.2, cx, d.y + 2.6, cz);
  const bell = new THREE.CylinderGeometry(0.25, 0.55, 0.7, 12, 1, true);
  bell.translate(cx, d.y + 2.1, cz);
  d.geo('iron', bell);
  d.box('iron',
 0.4, 0.12, 0.12, cx, d.y + 1.78, cz);
}

function dressCorridor(d, room) {
  // nothing in the clear width; a console only in a corridor wide enough
  if (room.z1 - room.z0 < 3.4) return;
  d.againstAny(room, ['W', 'E', 'S', 'N'], 'console', 0.5, { gap: 0.05 });
  portrait(d, room, 'E', 0.5, 0.7, 0.9, 1.8);
}

function dressFoyer(d, room) {
  rug(d, room, 3.2, 2.4);
  portrait(d, room, 'W', 0.3, 0.8, 1.1, 2.1);
  portrait(d, room, 'E', 0.3, 0.8, 1.1, 2.1);
  // NOT the west wall. The grand stair's foot is on the west side of the
  // foyer, behind a 1 m gap between the wall and the tower; a console and the
  // searchable cabinet on that wall sealed the only approach, and the stair
  // was unreachable on foot even though it was built correctly. The east and
  // south walls leave the approach clear.
  const sideboard = d.againstAny(room, ['E', 'S', 'N'], 'console', 0.55, { gap: 0.05 });
  // A single loose board across the foyer's clear centre so the first walk into
  // the house can already teach the rule: some boards speak. The board is placed
  // only in the opening dress, not by the Resident, and only where it can sit
  // flat on the floor and not on top of anything else; the sound is the trap,
  // not the sight of it.
  if (typeof placeBoard === 'function') {
    const bx = sideboard?.box;
    const boardX = +((room.x0 + room.x1) / 2).toFixed(2);
    const boardZ = +((room.z0 + room.z1) / 2).toFixed(2);
    // Ask the floor query with this room's own elevation as the foot, or it
    // answers with the highest storey that shares the footprint and the board
    // registers in mid-air over the foyer.
    const boardY = floorHeightAt(boardX, boardZ, d.y);
    if (boardY !== null) placeBoard(d, boardX, boardY, boardZ);
  }
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 3.4, z: (room.z0 + room.z1) / 2, color: 0xffcf9a, intensity: 7, distance: 10, room: room.id });
  // A cold lamp high in the stair tower: it rakes down the plaster drum and
  // catches the tread noses from above, the single-source falloff the stair
  // reference is built on. Placed at 8.4 m so it is within reach of every
  // floor's practical-light slots, not only the attic.
  props.lights.push({ x: STAIR.cx, y: d.y + 4.6, z: STAIR.cz, color: 0xb6ccdc, intensity: 9, distance: 12, room: room.id });

  // Put the player's phone on that console — a phone left on a hall table is
  // how a phone is actually found, and it puts the pickup at hand height
  // instead of on the floor. If no console fitted the foyer, it lies on the
  // floor across the room's clear centre, which is still in the player's path.
  if (d.rect) {
    const bx = sideboard?.box;
    const cx = bx ? (bx.x0 + bx.x1) / 2 : d.rect.x0 + (d.rect.x1 - d.rect.x0) * 0.5;
    const cz = bx ? (bx.z0 + bx.z1) / 2 : d.rect.z0 + (d.rect.z1 - d.rect.z0) * 0.5;
    const top = bx ? d.y + bx.height + (bx.minY || 0) : null;
    placePhone(d, room, +cx.toFixed(2), +cz.toFixed(2), 0.4, top);
  }
}

function dressGallery(d, room) {
  portrait(d, room, 'W', 0.35, 0.9, 1.15, 2.0);
  portrait(d, room, 'W', 0.65, 0.7, 0.9, 1.95);
  portrait(d, room, 'E', 0.3, 0.85, 1.1, 2.0);
  // The east wall is almost entirely the courtyard archway, so furniture tries
  // the west and the ends first.
  d.againstAny(room, ['W', 'N', 'S', 'E'], 'console', 0.32, { gap: 0.05 });
  d.againstAny(room, ['W', 'N', 'S', 'E'], 'armchair', 0.72, { gap: 0.05 });
  props.lights.push({ x: (room.x0 + room.x1) / 2, y: d.y + 3.3, z: (room.z0 + room.z1) / 2, color: 0xe8c08c, intensity: 5, distance: 9, room: room.id });
}

function dressTerrace(d, room) {
  const p = d.againstAny(room, ['N', 'S', 'W', 'E'], 'bench', 0.5, { gap: 0.2 });
  void p;
  for (let i = 0; i < 2; i++) {
    const x = room.x0 + 1 + i * 1.1, z = room.z1 - 0.5;
    d.box('stone', 0.5, 0.55, 0.5, x, d.y, z);
    const g = new THREE.CylinderGeometry(0.22, 0.18, 0.6, 7);
    g.translate(x, d.y + 0.85, z);
    d.geo('groundGrass', g);
  }
}

const DRESS = {
  bedroom: dressBedroom,
  living: dressLiving,
  dining: dressDining,
  study: dressStudy,
  kitchen: dressKitchen,
  bath: dressBath,
  utility: dressLaundry,
  storage: dressStorage,
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
  dressing: dressDressingRoom,
};

export function furnish(scene, levels) {
  props.colliders.length = 0;
  props.interactables.length = 0;
  props.lights.length = 0;
  props.issues.length = 0;
  props.missing.length = 0;
  props.count = 0;
  props.tiles = 0;
  props.placed.length = 0;
  props.rejected.length = 0;
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
    // No occupied room is left lit only by the player's torch. The dressers
    // put a practical in the rooms they know how to light; the rest had none,
    // which is how a fully furnished dining room still read as an empty box.
    // The lamp is a real fixture — canopy, shade and bulb merged with the
    // room's props — and the light hangs just under its shade, so the pool on
    // the ceiling is the lamp's own and not a source floating in mid-air.
    for (const room of level.rooms) {
      if (room.kind === 'courtyard') continue;
      if (props.lights.some((l) => l.room === room.id)) continue;
      const r = clearRect(level, room);
      const lx = (r.x0 + r.x1) / 2, lz = (r.z0 + r.z1) / 2;
      const ly = level.y + Math.min(2.72, Math.max(2.2, level.h - 0.24));
      d.use(room);
      const canopy = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10);
      canopy.translate(lx, ly + 0.02, lz);
      d.geo('brass', canopy);
      const shade = new THREE.CylinderGeometry(0.12, 0.19, 0.24, 14, 1, true);
      shade.translate(lx, ly - 0.13, lz);
      d.geo('linen', shade);
      const bulb = new THREE.SphereGeometry(0.045, 8, 6);
      bulb.translate(lx, ly - 0.25, lz);
      d.geo('glass', bulb);
      props.lights.push({
        x: lx, y: ly - 0.26, z: lz, color: 0xffd2a4,
        intensity: 6.2, distance: 9, room: room.id,
      });
    }
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
