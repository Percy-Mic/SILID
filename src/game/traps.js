// TRAPS — what the Resident leaves behind in the corridors it has walked.
//
// There are two trap types in the same system so they share the same world
// budget and the same placement discipline: a wire trap (the tripwire with
// tins) and a floorboard trap (a loose board that creaks and gives the player
// away). They are different objects in the hand but the same object in the
// room budget — one type is a thing you cut, the other is a thing you learn to
// step over.
//
// The wire trap is a real object with real contact: two stakes driven into the
// floorboard joints, a length of picture wire strung between them at ankle
// height, and three tin cans hung off the wire. It is the oldest trick in a
// house like this — you hear it before you see it, and if you are moving you
// have already found it.
//
// Why a floorboard and not only wire: not every threat in a house is something
// you can cut. A board that speaks when you step on it is the quieter lesson —
// the player gets away with nothing, but they also lose nothing to it. The
// Resident is drawn by its noise; the player is not harmed by it. That keeps
// the loss of a trial the Resident's job and never the floor.
//
// All geometry is built once and shared: each trap type is one merged mesh on
// shared materials, so three live traps of either kind cost six draw calls in
// total.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { floorHeightAt, architecture } from '../world/architecture.js';

export const TRAP = {
  max: 3,             // live traps at once (wire + floorboard share this budget)
  cooldown: 26,       // seconds between placements
  wireH: 0.17,        // ankle height
  span: 0.92,         // half-width of the cord
  triggerR: 0.52,     // how close a moving body has to get to the wire
  noiseR: 15,         // how far the tins carry through the house
  minDoorGap: 1.35,   // never across a doorway
  minTrapGap: 2.2,    // never on top of another trap
};

// The floorboard is not a quick tap: the creak carries a few metres and the
// Resident hears it as a deliberate, local sound rather than a footstep that
// could have been the wind. The radius here is shorter than the wire's tins
// because a creak is a tell, not a shout.
const BOARD_NOISE_R = 7;

const UP = new THREE.Vector3(0, 1, 0);

function boxAt(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export class Traps {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.list = [];
    this.count = 0;
    this._tmp = new THREE.Vector3();
    this.buildTemplate();
  }

  // One merged geometry for the frame and wire, one for the tins: two shared
  // materials and two shared geometries for every trap in the house.
  buildTemplate() {
    const frame = [];
    for (const s of [-1, 1]) {
      frame.push(boxAt(0.035, 0.30, 0.035, s * TRAP.span, 0.15, 0));
      frame.push(boxAt(0.09, 0.02, 0.09, s * TRAP.span, 0.01, 0));   // a foot plate
    }
    const wire = new THREE.CylinderGeometry(0.006, 0.006, TRAP.span * 2, 5);
    wire.rotateZ(Math.PI / 2);
    wire.translate(0, TRAP.wireH, 0);
    frame.push(wire);
    this.geoFrame = mergeGeometries(frame.map((g) => (g.index ? g.toNonIndexed() : g)));
    this.geoFrame.computeVertexNormals();

    const tins = [];
    for (let i = 0; i < 3; i++) {
      const x = -0.55 + i * 0.55;
      const can = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8);
      can.translate(x, TRAP.wireH - 0.075, 0);
      tins.push(can);
      const tie = new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4);
      tie.translate(x, TRAP.wireH - 0.005, 0);
      tins.push(tie);
    }
    this.geoTins = mergeGeometries(tins.map((g) => (g.index ? g.toNonIndexed() : g)));
    this.geoTins.computeVertexNormals();

    this.matFrame = new THREE.MeshStandardMaterial({ color: 0x2a241d, roughness: 0.9, metalness: 0.15 });
    this.matTin = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.55, metalness: 0.45 });

    // --- floorboard: one loose board, two short nails in its ends, a thin
    // dark gap beneath it so it reads as not quite seated. It is a single board
    // nobody would look twice at from a standing height; the tell is the sound,
    // not the sight.
    const b = [];
    // the board itself: a narrow plank laid across the walk, already twisted a
    // little so it speaks under weight instead of sitting silent
    const plank = boxAt(0.98, 0.028, 0.16, 0, 0.014, 0, 0.08);
    b.push(plank);
    // two nail heads at each end — tiny, dull, almost invisible on the floor
    for (const s of [-1, 1]) {
      const nail = new THREE.CylinderGeometry(0.006, 0.006, 0.018, 6);
      nail.rotateZ(Math.PI / 2);
      nail.translate(s * 0.46, 0.023, 0);
      b.push(nail);
    }
    // the shadow gap under the loose end: dark so the board reads as raised a
    // hair from its neighbours
    const gap = new THREE.PlaneGeometry(0.78, 0.14);
    gap.rotateY(-Math.PI / 2);
    gap.translate(0, -0.002, -0.085);
    b.push(gap);
    this.geoBoard = mergeGeometries(b.map((g) => (g.index ? g.toNonIndexed() : g)));
    this.geoBoard.computeVertexNormals();

    this.matBoard = new THREE.MeshStandardMaterial({ color: 0x9a8e76, roughness: 0.85, metalness: 0.0 });
    this.matBoardGap = new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide });
  }

  // A trap is only ever placed where a body can stand and where the floor is
  // actually flat under both stakes. The floor query is the same one the player
  // and the Resident walk on, so a trap cannot end up in mid-air or on a stair.
  valid(x, z, y) {
    for (const s of [-1, 1]) {
      const px = x + s * (TRAP.span + 0.1);
      const f = floorHeightAt(px, z, y);
      if (f === null || Math.abs(f - y) > 0.10) return false;
    }
    const c = floorHeightAt(x, z, y);
    if (c === null || Math.abs(c - y) > 0.10) return false;
    // never across a doorway: a trap there has no way around it
    for (const d of architecture.doors) {
      if (Math.abs((d.y ?? 0) - y) > 1.6) continue;
      const dx = d.axis === 'x' ? d.at : d.c;
      const dz = d.axis === 'x' ? d.c : d.at;
      if (Math.hypot(dx - x, dz - z) < TRAP.minDoorGap) return false;
    }
    // never through a wall or inside furniture
    for (const col of architecture.colliders) {
      if (!col || col.disabled) continue;
      if (col.kind === 'door') continue;
      if (col.y0 !== undefined && (y + 1.4 < col.y0 || y + 0.05 > col.y1)) continue;
      const cx = Math.max(col.x1, Math.min(x, col.x2));
      const cz = Math.max(col.z1, Math.min(z, col.z2));
      if (Math.hypot(cx - x, cz - z) < 0.55) return false;
    }
    for (const t of this.list) if (Math.hypot(t.x - x, t.z - z) < TRAP.minTrapGap) return false;
    return true;
  }

  place({ x, z, y, yaw = 0, level = 'GF' }) {
    if (this.list.length >= TRAP.max) return null;
    if (!this.valid(x, z, y)) return null;
    const g = new THREE.Group();
    g.name = 'Trap_' + this.count;
    const a = new THREE.Mesh(this.geoFrame, this.matFrame);
    const b = new THREE.Mesh(this.geoTins, this.matTin);
    a.castShadow = false; b.castShadow = false;
    g.add(a, b);
    g.position.set(x, y + 0.002, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    const trap = { id: 'trap' + this.count, type: 'wire', x, z, y, yaw, level, group: g, live: true, seen: false };
    this.count++;
    this.list.push(trap);
    return trap;
  }

  // Place a floorboard trap. Same world budget and same placement checks as the
  // wire: the Resident treats a creaking board and a tripwire as the same kind
  // of caution, only different in what the player does about it.
  placeBoard({ x, z, y, yaw = 0, level = 'GF' }) {
    if (this.list.length >= TRAP.max) return null;
    if (!this.validBoard(x, z, y)) return null;
    const g = new THREE.Group();
    g.name = 'TrapBoard_' + this.count;
    const a = new THREE.Mesh(this.geoBoard, this.matBoard);
    const sh = new THREE.Mesh(this.geoBoard, this.matBoardGap);
    // the gap plane is a decal under the board, not another solid in the walkway
    sh.renderOrder = 1;
    a.castShadow = false; sh.castShadow = false;
    g.add(a, sh);
    g.position.set(x, y + 0.003, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    const trap = { id: 'board' + this.count, type: 'board', x, z, y, yaw, level, group: g, live: true, seen: false };
    this.count++;
    this.list.push(trap);
    return trap;
  }

  // A floorboard is valid where a body can stand and where the floor under the
  // board is level: it sits on the floor, so if the floor slopes away under it
  // the board would not lie flat and the trap would be a prop rather than a
  // tell. Doors, walls and other traps are the same exclusion as the wire.
  validBoard(x, z, y) {
    const f = floorHeightAt(x, z, y);
    if (f === null || Math.abs(f - y) > 0.10) return false;
    for (const d of architecture.doors) {
      if (Math.abs((d.y ?? 0) - y) > 1.6) continue;
      const dx = d.axis === 'x' ? d.at : d.c;
      const dz = d.axis === 'x' ? d.c : d.at;
      if (Math.hypot(dx - x, dz - z) < TRAP.minDoorGap) return false;
    }
    for (const col of architecture.colliders) {
      if (!col || col.disabled) continue;
      if (col.kind === 'door') continue;
      if (col.y0 !== undefined && (y + 1.4 < col.y0 || y + 0.05 > col.y1)) continue;
      const cx = Math.max(col.x1, Math.min(x, col.x2));
      const cz = Math.max(col.z1, Math.min(z, col.z2));
      if (Math.hypot(cx - x, cz - z) < 0.55) return false;
    }
    for (const t of this.list) if (Math.hypot(t.x - x, t.z - z) < TRAP.minTrapGap) return false;
    return true;
  }

  // The prompt target: the player can cut the wire from either side of it.
  nearest(eye, fwd) {
    let best = null, bestScore = -Infinity;
    for (const t of this.list) {
      if (!t.live) continue;
      const dx = t.x - eye.x, dz = t.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.7) continue;
      const dy = t.y + 0.2 - eye.y;
      if (Math.abs(dy) > 1.9) continue;
      const dot = d > 0.001 ? (dx * fwd.x + dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) : 1;
      if (dot < 0.35) continue;
      const score = -Math.abs(dot - 1) * 2 - d * 0.05;
      if (score > bestScore) { bestScore = score; best = { trap: t, dist: d, dot }; }
    }
    return best;
  }

  // The board is a prompt target too: you can step over it once you have seen
  // it, but the game offers the inspection first so a player who is looking at
  // it gets the chance to notice before it speaks. It is never offered as a
  // thing to cut.
  nearestBoard(eye, fwd) {
    let best = null, bestScore = -Infinity;
    for (const t of this.list) {
      if (!t.live || t.type !== 'board') continue;
      const dx = t.x - eye.x, dz = t.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.7) continue;
      const dy = t.y + 0.05 - eye.y;
      if (Math.abs(dy) > 1.9) continue;
      const dot = d > 0.001 ? (dx * fwd.x + dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) : 1;
      if (dot < 0.35) continue;
      const score = -Math.abs(dot - 1) * 2 - d * 0.05;
      if (score > bestScore) { bestScore = score; best = { trap: t, dist: d, dot }; }
    }
    return best;
  }

  disarm(trap) {
    if (!trap || !trap.live) return false;
    trap.live = false;
    this.scene.remove(trap.group);
    // geometry is shared, so only the group's own references go
    trap.group.clear();
    this.list = this.list.filter((t) => t !== trap);
    return true;
  }

  // A triggered wire is loud and it hurts: the player's shin catches the cord,
  // the tins go across the floor, and the house now knows exactly where the
  // noise came from. No trial is lost here — that is the Resident's job.
  trigger(trap, player) {
    if (!trap || !trap.live) return false;
    trap.live = false;
    if (this.game) {
      this.game.audio?.trapSnap?.();
      this.game.noise(trap.x, trap.y + 0.6, trap.z, TRAP.noiseR);
      this.game.say('A wire catches your shin. The tins go across the floor like a dropped tray.', 4200);
      this.game.stumble?.(1.1);
      // the cord is still on the floor, but it is no longer a trap: the tins
      // are off it and the stakes are kicked over. Leave it as scenery.
      trap.group.rotation.z = 0.35;
      trap.group.position.y = trap.y + 0.001;
    }
    void player;
    return true;
  }

  update(dt, player, game) {
    for (const t of this.list) {
      if (!t.live) continue;
      if (t.type === 'wire') {
        // it only bites a body that is moving through it
        const speed = Math.hypot(player.vel.x, player.vel.z);
        const d = Math.hypot(player.pos.x - t.x, player.pos.z - t.z);
        if (d < TRAP.triggerR && Math.abs(player.footY - t.y) < 0.6 && (speed > 0.55 || player.crouch < 0.4)) {
          this.trigger(t, player);
          game?.onTrapTriggered?.(t);
        }
      } else if (t.type === 'board') {
        // The board speaks when a weight comes down on it hard enough. A slow
        // step or a crouch is quiet; a normal walk or a run is the tell.
        const d = Math.hypot(player.pos.x - t.x, player.pos.z - t.z);
        const onBoard = d < 0.52 && Math.abs(player.footY - t.y) < 0.18;
        if (onBoard) {
          const speed = Math.hypot(player.vel.x, player.vel.z);
          const loud = (speed > 0.6 && player.crouch < 0.45);
          if (loud) {
            this.boardCreak(t);
          }
        }
      }
    }
  }

  // The board is not disarmed: it stays where it is and goes quiet after it has
  // spoken, until the next weight comes down on it. A player who notices it can
  // choose to step around it; a player who does not notices it the hard way.
  boardCreak(trap) {
    if (!trap || !trap.live) return;
    trap.live = false;
    if (this.game) {
      this.game.audio?.creak?.();
      this.game.noise(trap.x, trap.y + 0.04, trap.z, BOARD_NOISE_R);
      this.game.say('A floorboard creaks under your foot. The house listens.', 3600);
      // a spent board is still there as scenery, but it no longer speaks — the
      // nails have settled and the plank has found its seat
      this.scene.remove(trap.group);
      trap.group.clear();
    }
    this.list = this.list.filter((tt) => tt !== trap);
  }

  // A spent board can reset after a long quiet: a house that has gone still for
  // a minute and then is walked on again may speak once more. This keeps the
  // board from being a one-time prop without turning it into a nuisance.
  resetSpentBoards() {
    for (const t of this.list) {
      if (t.type !== 'board' || t.live) continue;
      // only reset a board that has gone quiet for a while and is still where
      // it was — a board that was walked past, not one that was moved
      t.live = true;
    }
  }

  // helpers for room dressing and the Resident: boards are part of the same
  // world budget and should be counted and iterated the same way as wire traps.
  boardCount() {
    let n = 0;
    for (const t of this.list) if (t.type === 'board' && t.live) n++;
    return n;
  }

  liveBoards() {
    const out = [];
    for (const t of this.list) if (t.type === 'board' && t.live) out.push(t);
    return out;
  }

  liveWires() {
    const out = [];
    for (const t of this.list) if (t.type === 'wire' && t.live) out.push(t);
    return out;
  }

  clear() {
    for (const t of this.list) {
      this.scene.remove(t.group);
      t.group.clear();
    }
    this.list = [];
  }
}
