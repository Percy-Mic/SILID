// THE RESIDENT — the thing that is already in the house.
//
// It is not an omniscient detector. It knows three things: what it can see,
// what it heard, and where it last saw you. Everything else it has to walk to
// and look at, room by room.
//
// Senses
//   * sight: 10 m, 50 degrees either side of its facing, blocked by walls and
//     tall furniture by a line march against the same colliders the player
//     uses. A concealed player is invisible; a peeking player is visible
//     through the opening they are peeking through.
//   * hearing: a noise event carries a radius. Doors, drawers, running feet,
//     the generator and a wardrobe door all publish one. If the enemy is inside
//     that radius it walks to the position and searches; it is never handed the
//     player's coordinates by the hiding system.
//
// Movement
//   * rooms use a walkability grid built from the game's own floor query and
//     colliders (0.55 m cells, per floor, built lazily);
//   * floors are joined by the authored stair helices and the service stair, so
//     it follows the treads rather than teleporting between levels;
//   * closed doors are opened as it reaches them, with a creak that is itself a
//     noise the player can hear.
//
// The mesh is the Blender-built Resident from furniture.glb: a tall figure in a
// housedress with a real silhouette, 2.2 k triangles, no extra dynamic light.
// It is deliberately not lit by a lamp of its own; your torch finds it.

import * as THREE from 'three';
import { architecture, floorHeightAt } from '../world/architecture.js';
import { props } from '../world/props.js';
import { hiding, openHidingDoor } from '../world/hiding.js';
import { template } from '../world/furniture.js';
import { LEVELS, STAIR } from '../world/plan.js';

const CELL = 0.55;
const X0 = -23.4, X1 = 21.4, Z0 = -10.4, Z1 = 10.4;
const COLS = Math.ceil((X1 - X0) / CELL);
const ROWS = Math.ceil((Z1 - Z0) / CELL);

const SIGHT = 10.5;
const SIGHT_COS = Math.cos(50 * Math.PI / 180);
const EYE = 1.52;

function nearestLevel(y) {
  let best = LEVELS[0], bd = Infinity;
  for (const l of LEVELS) {
    const d = Math.abs(l.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

export class Resident {
  constructor({ scene, player, game }) {
    this.scene = scene;
    this.player = player;
    this.game = game;

    this.pos = new THREE.Vector3(2.5, 0, 5.5);
    this.footY = 4.2;
    this.yaw = Math.PI;
    this.level = 'F2';
    this.state = 'patrol';
    this.armed = false;
    this.speed = 1.05;

    this.route = ['f_hall', 'f_master', 'f_hall', 'f_south', 'f_bed5', 'f_south'];
    this.routeIdx = 0;
    this.wait = 0;

    this.path = [];
    this.pathIdx = 0;
    this.dest = null;
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = new THREE.Vector2(2.5, 5.5);

    this.lastKnown = null;
    this.memory = 0;
    this.searchT = 0;
    this.checked = new Set();
    this.canSee = false;
    this.senseT = 0;
    this.doorT = 0;
    this.catchCd = 0;
    this.animT = Math.random() * 10;

    this.grids = new Map();
    this.waypoints = this.buildWaypoints();
    this.spawn = { x: 2.5, z: 5.5, level: 'F2' };

    this.group = new THREE.Group();
    this.group.name = 'Resident';
    this.group.visible = false;
    this.buildMesh();
    scene.add(this.group);

    const lvl = LEVELS.find((l) => l.id === 'F2');
    if (lvl) { this.footY = lvl.y; this.pos.y = lvl.y; }
  }

  buildMesh() {
    const staticMats = {
      linen: new THREE.MeshStandardMaterial({ color: 0xb9b1a0, roughness: 0.96, metalness: 0, emissive: 0x141310 }),
      porcelain: new THREE.MeshStandardMaterial({ color: 0xc9c3b4, roughness: 0.66, metalness: 0, emissive: 0x0c0c0b }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.94, metalness: 0 }),
      ironDark: new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.7, metalness: 0.2 }),
      brass: new THREE.MeshStandardMaterial({ color: 0x6f5a2f, roughness: 0.5, metalness: 0.6 }),
    };
    const t = template('resident');
    if (t) {
      for (const g of t.geos) {
        const m = new THREE.Mesh(g.geo, staticMats[g.mat] || staticMats.linen);
        m.name = 'Resident_' + g.mat;
        this.group.add(m);
      }
    } else {
      // The asset is part of furniture.glb; if the file failed to load, the
      // night still has to work. A plain figure is better than no enemy.
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 4, 8), staticMats.linen);
      body.position.y = 0.85;
      this.group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), staticMats.porcelain);
      head.position.y = 1.58;
      this.group.add(head);
    }
  }

  // One node per patrol anchor, plus the stair links. Grid A* does the rooms;
  // the waypoints only name the places a patrol goes.
  buildWaypoints() {
    return {
      f_hall: { x: 2.5, z: 5.5, level: 'F2' },
      f_master: { x: -2, z: -6, level: 'F2' },
      f_south: { x: 6, z: 3, level: 'F2' },
      f_bed5: { x: 7.5, z: 7, level: 'F2' },
      g_foyer: { x: 0, z: 4, level: 'GF' },
      g_gallery: { x: -2, z: 0, level: 'GF' },
      g_dining: { x: -2, z: -4, level: 'GF' },
      g_service: { x: -15.5, z: 2, level: 'GF' },
    };
  }

  // --- walkability ---------------------------------------------------------
  isBox(c) {
    return c.kind === 'furniture' || c.kind === 'rail';
  }

  // 0.20 m, not the player's 0.34. A 1.0 m door leaves a 0.68/0.60 m clear
  // band, but the 0.55 m planning cells land 0.225 m from each jamb — enough
  // for a 0.20 m body and not for the player-sized 0.33 the first pass used.
  // That is what sealed the basement generator room and the F2 upper landing.
  blockedAt(x, z, y, radius = 0.20) {
    const b0 = y + 0.12, b1 = y + 1.62;
    const list = architecture.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c || c.disabled) continue;
      if (c.kind === 'door') continue;       // it opens them
      if (c.y0 !== undefined && (b1 < c.y0 || b0 > c.y1)) continue;
      if (this.isBox(c)) {
        if (x > c.x1 - radius && x < c.x2 + radius && z > c.z1 - radius && z < c.z2 + radius) return true;
      } else {
        const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
        const l = dx * dx + dz * dz;
        let t = l ? ((x - c.x1) * dx + (z - c.z1) * dz) / l : 0;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(x - (c.x1 + t * dx), z - (c.z1 + t * dz)) < radius) return true;
      }
    }
    const boxes = props.colliders;
    for (let i = 0; i < boxes.length; i++) {
      const c = boxes[i];
      if (c.y0 !== undefined && (b1 < c.y0 || b0 > c.y1)) continue;
      if (x > c.x1 - radius && x < c.x2 + radius && z > c.z1 - radius && z < c.z2 + radius) return true;
    }
    return false;
  }

  gridFor(levelId) {
    if (this.grids.has(levelId)) return this.grids.get(levelId);
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) return null;
    const walk = new Uint8Array(COLS * ROWS);
    for (let gx = 0; gx < COLS; gx++) {
      const x = X0 + (gx + 0.5) * CELL;
      for (let gz = 0; gz < ROWS; gz++) {
        const z = Z0 + (gz + 0.5) * CELL;
        const f = floorHeightAt(x, z, level.y);
        if (f === null || Math.abs(f - level.y) > 0.55) continue;
        // On the ground floor the helical stair is floor geometry, not a hole.
        // Left in the grid it is a shortcut straight across the flight at the
        // wrong angle, and the walker jams against the newel. The tower is
        // excluded; the route approaches it at the foot and the authored helix
        // waypoints take over from there.
        if (level.id === 'GF' && Math.hypot(x - STAIR.cx, z - STAIR.cz) < STAIR.holeR) continue;
        if (this.blockedAt(x, z, level.y)) continue;
        walk[gx * ROWS + gz] = 1;
      }
    }
    const grid = { level, walk };
    this.grids.set(levelId, grid);
    return grid;
  }

  cellOf(x, z) {
    const gx = Math.floor((x - X0) / CELL);
    const gz = Math.floor((z - Z0) / CELL);
    return { gx, gz };
  }

  nearestWalkable(grid, x, z, maxRing = 7) {
    const { gx, gz } = this.cellOf(x, z);
    const at = (a, b) => (a >= 0 && a < COLS && b >= 0 && b < ROWS && grid.walk[a * ROWS + b]);
    if (at(gx, gz)) return { gx, gz };
    for (let r = 1; r <= maxRing; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          if (at(gx + dx, gz + dz)) return { gx: gx + dx, gz: gz + dz };
        }
      }
    }
    return null;
  }

  // A* on the level grid. Small and bounded: one enemy, one path at a time.
  pathOnLevel(levelId, sx, sz, tx, tz) {
    const grid = this.gridFor(levelId);
    if (!grid) return [];
    const start = this.nearestWalkable(grid, sx, sz);
    const goal = this.nearestWalkable(grid, tx, tz);
    if (!start || !goal) return [];
    const N = COLS * ROWS;
    const startI = start.gx * ROWS + start.gz;
    const goalI = goal.gx * ROWS + goal.gz;
    if (startI === goalI) return [{ x: tx, z: tz }];

    // Every step costs one cell, so breadth-first is both exact and cheaper
    // than an A* with a sorting open set. The previous A* returned no route on
    // a grid where a flood fill proved the two cells connected; BFS cannot
    // disagree with the connectivity it is built from.
    const came = new Int32Array(N).fill(-1);
    const seen = new Uint8Array(N);
    const queue = [startI];
    seen[startI] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === goalI) break;
      const cx = Math.floor(cur / ROWS), cz = cur % ROWS;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || nx >= COLS || nz < 0 || nz >= ROWS) continue;
        const ni = nx * ROWS + nz;
        if (!grid.walk[ni] || seen[ni]) continue;
        seen[ni] = 1;
        came[ni] = cur;
        queue.push(ni);
      }
    }
    if (!seen[goalI]) return [];
    const out = [];
    let i = goalI;
    let guard = 0;
    while (i !== startI && i !== -1 && guard++ < 4000) {
      const gx = Math.floor(i / ROWS), gz = i % ROWS;
      out.push({ x: X0 + (gx + 0.5) * CELL, z: Z0 + (gz + 0.5) * CELL });
      i = came[i];
    }
    out.reverse();
    // Replace the last cell with the actual target so the enemy does not stop
    // one cell short of the thing it is walking to.
    if (out.length) out[out.length - 1] = { x: tx, z: tz };
    return out;
  }

  stairUp(lowerId, upperId) {
    const lower = LEVELS.find((l) => l.id === lowerId);
    const upper = LEVELS.find((l) => l.id === upperId);
    if (!lower || !upper) return [];
    const pts = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const a = STAIR.a0 + t * Math.PI * 2;
      const r = 1.55;
      pts.push({
        x: STAIR.cx + Math.cos(a) * r,
        z: STAIR.cz + Math.sin(a) * r,
        y: lower.y + t * (upper.y - lower.y),
      });
    }
    return pts;
  }

  basementUp() { return [{ x: -15.7, z: -6.4, y: 0 }, { x: -15.7, z: -10.3, y: -3.4 }]; }

  levelIndex(id) { return LEVELS.findIndex((l) => l.id === id); }

  // Build a route to a point, across floors if needed.
  // The landing fan is the pad outside the stairwell hole. On the ground
  // floor the foot of the helix is itself floor; on the upper floors the hole
  // is real, so the walkable landing starts here.
  stairEntry(levelId) {
    if (levelId === 'B1') return { x: STAIR.cx - 2.72, z: STAIR.cz };
    if (levelId === 'GF') return { x: -4.3, z: 4.8 };
    // North-west of the well, on the solid hall floor. The old point south of
    // the fan made the grid route cross the open well and the walker fell a
    // storey. From here the route hugs the west side before turning east.
    return { x: -4.5, z: 9.8 };
  }

  planTo(x, z, levelId) {
    const here = this.level;
    const idxA = this.levelIndex(here), idxB = this.levelIndex(levelId);
    if (idxA === idxB) return this.pathOnLevel(here, this.pos.x, this.pos.z, x, z);

    const up = idxB > idxA;

    // Basement: a straight flight in the service hall, not the helix.
    if ((here === 'GF' && levelId === 'B1') || (here === 'B1' && levelId === 'GF')) {
      const head = { x: -15.7, z: -6.4 };
      const foot = { x: -15.7, z: -10.3 };
      if (here === 'GF') {
        const pts = this.pathOnLevel('GF', this.pos.x, this.pos.z, head.x, head.z);
        pts.push(...this.basementUp());
        return pts.concat(this.pathOnLevel('B1', foot.x, foot.z, x, z));
      }
      const pts = this.pathOnLevel('B1', this.pos.x, this.pos.z, foot.x, foot.z);
      pts.push(...this.basementUp().reverse());
      return pts.concat(this.pathOnLevel('GF', head.x, head.z, x, z));
    }

    // Walk to the stair on this floor, climb/drop one level at a time, then
    // walk the target floor. The helix entry is the same x,z on both floors.
    //
    // On the ground floor the foot of the spiral sits behind a narrow pocket
    // between the foyer console and the newel; a straight grid route to the
    // west side is cut off. The approach is therefore authored: the foyer, the
    // first tread, then the helix. This is the same line the player walks.
    // The foyer approach runs down the WEST side of the tower, where the
    // corridor is clear, then turns in at the first tread. A straight line
    // from the middle of the foyer crosses the winder at half height and the
    // walker is correctly refused the step.
    const FOYER = { x: -4.3, z: 4.8 };
    // MOUTH and FAN carry a `y`: they are stair-portal points. followPath
    // treats those as part of the flight, moving on the authored line and
    // setting the body's height directly. Without that the walker catches the
    // handrail collider at the top tread and cannot step off the winder.
    const MOUTH = { x: -3.15, z: 6.9, y: 0 };
    const fan = (levelId) => ({ x: STAIR.cx - 2.8, z: STAIR.cz, y: LEVELS[this.levelIndex(levelId)].y });
    let pts;
    if (up) {
      if (here === 'GF') {
        pts = this.pathOnLevel('GF', this.pos.x, this.pos.z, FOYER.x, FOYER.z);
        pts.push(MOUTH);
      } else {
        const entry = this.stairEntry(here);
        pts = this.pathOnLevel(here, this.pos.x, this.pos.z, entry.x, entry.z);
        pts.push({ x: entry.x, z: entry.z }, fan(here));
      }
      for (let i = idxA; i < idxB; i++) {
        pts = pts.concat(this.stairUp(LEVELS[i].id, LEVELS[i + 1].id));
      }
      const land = this.stairEntry(levelId);
      pts.push(fan(levelId), { x: land.x, z: land.z });
      pts = pts.concat(this.pathOnLevel(levelId, land.x, land.z, x, z));
    } else {
      const entry = this.stairEntry(here);
      pts = this.pathOnLevel(here, this.pos.x, this.pos.z, entry.x, entry.z);
      if (here !== 'GF') pts.push({ x: entry.x, z: entry.z }, fan(here));
      for (let i = idxA; i > idxB; i--) {
        pts = pts.concat(this.stairUp(LEVELS[i - 1].id, LEVELS[i].id).reverse());
      }
      if (levelId === 'GF') {
        pts.push(MOUTH, FOYER);
        pts = pts.concat(this.pathOnLevel('GF', FOYER.x, FOYER.z, x, z));
      } else {
        const land = this.stairEntry(levelId);
        pts.push(fan(levelId), { x: land.x, z: land.z });
        pts = pts.concat(this.pathOnLevel(levelId, land.x, land.z, x, z));
      }
    }
    return pts;
  }

  // --- senses --------------------------------------------------------------
  sightBlocked(ax, az, bx, bz, eyeY, ignore = null) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(2, Math.ceil(d / 0.42));
    const list = architecture.colliders;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || c.disabled) continue;
        if (c.kind === 'rail') continue;
        // A closed door blocks sight; an open one has its collider disabled
        // above and is skipped by that branch. The old line skipped every
        // door, so the Resident could see through a shut bedroom door.
        if (c.y0 !== undefined && (eyeY < c.y0 || eyeY > c.y1)) continue;
        if (this.isBox(c)) {
          if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
        } else {
          const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
          const l = dx * dx + dz * dz;
          let u = l ? ((x - c.x1) * dx + (z - c.z1) * dz) / l : 0;
          u = Math.max(0, Math.min(1, u));
          if (Math.hypot(x - (c.x1 + u * dx), z - (c.z1 + u * dz)) < 0.06) return true;
        }
      }
      const boxes = props.colliders;
      for (let i = 0; i < boxes.length; i++) {
        const c = boxes[i];
        if (c.y0 === undefined) continue;
        if (c.y1 - c.y0 < 1.0) continue;
        if (eyeY < c.y0 || eyeY > c.y1) continue;
        // The armoire a peeking player is inside is the one object that must
        // not block their view out of it. Every other piece still does.
        if (ignore && Math.abs(c.x1 - ignore.x0) < 0.06 && Math.abs(c.z1 - ignore.z0) < 0.06) continue;
        if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
      }
    }
    return false;
  }

  sense(dt) {
    const game = this.game;
    if (!game) return;
    const h = game.hiding;
    const hidden = h && h.mode !== 'out' && h.spot;
    // Concealed with the doors shut is invisible. Concealed with a hand's
    // width open is visible only from the front of the opening, and only if
    // nothing else is in the way.
    const concealed = hidden && !h.peek;
    const eye = this.player.pos;
    const px = eye.x, py = eye.y, pz = eye.z;
    const dist = Math.hypot(px - this.pos.x, pz - this.pos.z);
    const dy = Math.abs(py - (this.footY + EYE));
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const dot = dist > 0.01 ? ((px - this.pos.x) * fwdX + (pz - this.pos.z) * fwdZ) / dist : 1;
    const range = this.state === 'chase' ? 13 : SIGHT;
    let sees = false;
    if (hidden && h.peek) {
      const spot = h.spot;
      const fx = Math.sin(spot.rot), fz = Math.cos(spot.rot);
      const vx = this.pos.x - spot.inside.x, vz = this.pos.z - spot.inside.z;
      const vl = Math.hypot(vx, vz) || 1;
      const fromFront = (vx * fx + vz * fz) / vl;
      if (dist < 6.5 && dot > SIGHT_COS && fromFront > 0.15) {
        sees = !this.sightBlocked(this.pos.x, this.pos.z, px, pz, py, spot.aabb);
      }
    } else if (!concealed && dist < range && dy < 1.8 && dot > SIGHT_COS) {
      sees = !this.sightBlocked(this.pos.x, this.pos.z, px, pz, this.footY + EYE);
    }
    this.canSee = sees;
    if (sees) {
      this.lastKnown = { x: px, y: py, z: pz, level: nearestLevel(py).id };
      this.memory = 7.0;
      if (this.state === 'patrol' || this.state === 'investigate') {
        this.state = 'chase';
        this.checked.clear();
        this.forcePlan();
      }
    }
  }

  hear(x, y, z, radius) {
    if (!this.armed) return;
    if (this.state === 'chase') return;
    const d = Math.hypot(x - this.pos.x, y - (this.footY + 1), z - this.pos.z);
    if (d > radius) return;
    this.lastKnown = { x, y, z, level: nearestLevel(y).id };
    this.memory = 9.0;
    if (this.state !== 'investigate') {
      this.state = 'investigate';
      this.searchT = 8.0;
      this.checked.clear();
      this.forcePlan();
      this.planToPoint({ x, y, z, level: nearestLevel(y).id });
    }
  }

  forcePlan() {
    this.path = [];
    this.pathIdx = 0;
    this.repathT = 0;
    this.dest = null;
  }

  // --- movement ------------------------------------------------------------
  // Open any closed door the body is about to walk through. Locked doors stay
  // locked: the historical study is the one place it will not follow you.
  doorsNear() {
    const t = performance.now() / 1000;
    if (t - this.doorT < 0.35) return;
    this.doorT = t;
    for (const door of architecture.doors) {
      if (!door.collider || door.open) continue;
      if (door.level !== this.level) continue;
      const cx = door.axis === 'x' ? door.at : door.c;
      const cz = door.axis === 'x' ? door.c : door.at;
      if (Math.hypot(cx - this.pos.x, cz - this.pos.z) > 1.15) continue;
      if (this.game?.isDoorLocked?.(door)) continue;
      door.open = true;
      door.target = door.axis === 'x' ? 1.35 : -1.35;
      door.collider.disabled = true;
      this.game?.doorAnim?.push(door);
      this.game?.audio?.creak?.();
      this.game?.noise?.(cx, this.footY + 1.2, cz, 6.5);
    }
  }

  moveToward(tx, tz, speed, dt) {
    let dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) return true;
    dx /= d; dz /= d;
    this.yaw += (Math.atan2(-dx, -dz) - this.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    // The eye wording above produces a shortest-arc turn, not a spin.
    const step = Math.min(speed * dt, d);
    // A hole is not a step down. The stair well is open on purpose, and the
    // floor query inside it answers with the storey below; without this guard
    // the walker follows that answer down through the building. A real step is
    // one riser (0.16 m); anything deeper than 0.65 m is refused.
    const standable = (x, z) => {
      const g = floorHeightAt(x, z, this.footY);
      if (g === null) return false;
      if (g < this.footY - 0.65 || g > this.footY + 0.55) return false;
      return true;
    };
    const nx = this.pos.x + dx * step;
    if (!this.blockedAt(nx, this.pos.z, this.footY) && standable(nx, this.pos.z)) this.pos.x = nx;
    const nz = this.pos.z + dz * step;
    if (!this.blockedAt(this.pos.x, nz, this.footY) && standable(this.pos.x, nz)) this.pos.z = nz;
    const ground = floorHeightAt(this.pos.x, this.pos.z, this.footY);
    if (ground !== null && ground <= this.footY + 0.55) {
      this.footY += (ground - this.footY) * Math.min(1, dt * 10);
    }
    this.level = nearestLevel(this.footY).id;
    // `reached`, not `moved`: a successful step is not an arrival. Treating it
    // as one burned through the whole path in a fraction of a second and made
    // the body skip from waypoint to waypoint.
    return d <= step + 0.02;
  }

  followPath(dt, speed) {
    if (!this.path || this.pathIdx >= this.path.length) return true;
    const p = this.path[this.pathIdx];
    // Stair waypoints carry their own height. The walker rides that height
    // instead of asking the floor query, which cannot answer reliably on a
    // winder: between two treads it returns the storey below, and the body
    // falls through the well. The horizontal move stays on the authored
    // helix, so it cannot cut across the newel.
    if (p.y !== undefined) {
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(speed * dt, d);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.footY += (p.y - this.footY) * Math.min(1, dt * 9);
      this.yaw += (Math.atan2(-dx / d, -dz / d) - this.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      this.level = nearestLevel(this.footY).id;
      if (d < 0.24) {
        this.footY = p.y;
        this.pathIdx++;
      }
    } else {
      const reached = this.moveToward(p.x, p.z, speed, dt);
      if (reached || Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.42) this.pathIdx++;
    }
    return this.pathIdx >= this.path.length;
  }

  planToPoint(pt) {
    const levelId = pt.level || nearestLevel(pt.y ?? this.footY).id;
    const path = this.planTo(pt.x, pt.z, levelId);
    this.path = path;
    this.pathIdx = 0;
    this.repathT = 2.0;
    this.dest = { x: pt.x, z: pt.z, level: levelId };
    return path.length > 0;
  }

  // --- search --------------------------------------------------------------
  searchSpots(dt) {
    if (this.searchT <= 0) return;
    for (const spot of hiding.spots) {
      if (this.checked.has(spot.id)) continue;
      if (spot.level !== this.level) continue;
      const cx = (spot.aabb.x0 + spot.aabb.x1) / 2;
      const cz = (spot.aabb.z0 + spot.aabb.z1) / 2;
      if (Math.hypot(cx - this.pos.x, cz - this.pos.z) > 1.7) continue;
      this.checked.add(spot.id);
      const game = this.game;
      const inside = game?.hiding?.spot === spot;
      if (inside) {
        const exposed = (game.hiding.peekedAt && performance.now() / 1000 - game.hiding.peekedAt < 9)
          || game.hiding.noise > 0;
        if (exposed || Math.random() < 0.35) {
          openHidingDoor(spot, true);
          game.audio?.creak?.();
          game.discovered(spot);
          return;
        }
        game.say('The door opens a hand\'s width. It stands there, breathing. Then it closes it again.', 6500);
        game.hiding.noise = 0;
        return;
      }
      // An empty wardrobe may still be pulled open while it searches. It is
      // not allowed to open every one it passes, or the house would be strewn
      // with open doors after ten minutes.
      if (Math.random() < 0.22) {
        openHidingDoor(spot, true);
        game?.audio?.creak?.();
        game?.noise?.(cx, this.footY + 1.2, cz, 5);
      }
    }
  }

  // --- main loop -----------------------------------------------------------
  update(dt, game) {
    if (game) this.game = game;
    if (!game || game.state.ended || game.caughtActive) return;
    // It does not exist outside the house, and it does not start walking
    // until the player is inside the building.
    if (!this.armed) {
      const x = this.player.pos.x, z = this.player.pos.z;
      const inside = x > -24.5 && x < 22.5 && z > -11.5 && z < 11.5 && this.player.footY > -0.6;
      if (!inside) { this.group.visible = false; return; }
      this.armed = true;
      this.state = 'patrol';
      this.planToPoint(this.waypoints.f_hall);
    }
    this.group.visible = true;
    this.catchCd = Math.max(0, this.catchCd - dt);
    this.animT += dt;

    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.14;
      this.sense(dt);
    }
    this.searchSpots(dt);

    if (this.canSee && this.state === 'chase') {
      const d = Math.hypot(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z);
      if (d < 1.25 && this.catchCd <= 0) {
        this.catchCd = 12;
        game.caught();
        return;
      }
    }

    this.doorsNear();

    if (this.state === 'chase') {
      this.repathT -= dt;
      if (this.repathT <= 0 && this.lastKnown) {
        this.planToPoint({ ...this.lastKnown, level: nearestLevel(this.lastKnown.y).id });
      }
      this.followPath(dt, 1.85);
      if (!this.canSee) {
        this.memory -= dt;
        if (this.memory <= 0) {
          this.state = 'investigate';
          this.searchT = 7;
          this.checked.clear();
          if (this.lastKnown) this.planToPoint({ ...this.lastKnown, level: nearestLevel(this.lastKnown.y).id });
        }
      }
      this.speed = 1.85;
    } else if (this.state === 'investigate') {
      this.searchT -= dt;
      this.speed = 1.25;
      const arrived = this.pathIdx >= this.path.length;
      if (!arrived) {
        this.followPath(dt, 1.25);
      } else {
        // Stand at the place the noise came from and sweep the torchless dark
        // with its head. This is the beat where a hidden player holds still.
        this.lookAround(dt);
      }
      if (this.searchT <= 0) {
        this.searchT = 0;
        this.state = 'patrol';
        this.path = [];
        this.pathIdx = 0;
        this.routeIdx = 0;
        this.wait = 0;
        this.planToPoint(this.waypoints.f_hall);
      }
    } else if (this.state === 'patrol') {
      this.wait -= dt;
      if (this.wait <= 0 && this.pathIdx >= this.path.length) {
        const id = this.route[this.routeIdx % this.route.length];
        const wp = this.waypoints[id];
        if (wp) {
          this.routeIdx++;
          this.wait = 1.6 + Math.random() * 2.4;
          this.planToPoint(wp);
        }
      }
      this.followPath(dt, 0.95);
      this.speed = 0.95;
    }

    // Stuck recovery: a body that has a path but has not moved for over a
    // second is caught on something (a chair leg, a door frame, a landing
    // edge). Re-plan from where it actually stands instead of leaning into it
    // for the rest of the night.
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.y);
    // Weight on the boards. Emitted per stride rather than per frame, panned by
    // which side of the player's head the body is on, so a player in a wardrobe
    // can hear it cross the room — or stop at the door.
    this.stepDist = (this.stepDist || 0) + moved;
    if (this.stepDist > 0.82) {
      this.stepDist = 0;
      const dx = this.pos.x - this.player.pos.x, dz = this.pos.z - this.player.pos.z;
      const dist = Math.hypot(dx, dz, this.footY - this.player.footY);
      if (dist < 20) {
        const inv = 1 / (Math.hypot(dx, dz) || 1);
        const ry = this.player.yaw;
        const rightX = Math.cos(ry), rightZ = -Math.sin(ry);
        const pan = (dx * inv) * rightX + (dz * inv) * rightZ;
        game.audio?.stalkerStep?.(Math.max(0.12, 1 - dist / 20), pan);
      }
    }
    if (this.pathIdx < this.path.length && moved < 0.008) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastPos.set(this.pos.x, this.pos.z);
    if (this.stuckT > 1.4) {
      this.stuckT = 0;
      this.path = [];
      this.pathIdx = 0;
      this.repathT = 0;
      if ((this.state === 'investigate' || this.state === 'chase') && this.lastKnown) {
        this.planToPoint({ ...this.lastKnown, level: nearestLevel(this.lastKnown.y).id });
      } else {
        this.wait = 0.4;
        this.pathIdx = 0;
        this.planToPoint(this.waypoints.f_hall);
      }
    }

    // The model is authored facing +Z. Rotating +Z by (yaw + PI) gives the
    // movement direction (-sin yaw, -cos yaw), which is the way it walks.
    this.group.position.set(this.pos.x, this.footY, this.pos.z);
    this.group.rotation.y = this.yaw + Math.PI;
    // a slow, small sway so a motionless figure is not a statue
    this.group.position.y += Math.sin(this.animT * 1.7) * 0.006;
  }

  lookAround(dt) {
    this.yaw += dt * 0.9;
  }

  reset() {
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.footY = 4.2;
    this.level = this.spawn.level;
    this.state = 'patrol';
    this.path = [];
    this.pathIdx = 0;
    this.lastKnown = null;
    this.memory = 0;
    this.canSee = false;
    this.checked.clear();
    this.routeIdx = 0;
    this.group.position.set(this.pos.x, this.footY, this.pos.z);
    this.planToPoint(this.waypoints.f_hall);
  }
}
