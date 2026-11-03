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
// The body is built here, not loaded: the old figure was the 'resident' node
// from furniture.glb, a housedress-shaped sculpt with no face and no arms that
// read as a pale sack under the torch. This one is a gaunt man in a soiled
// barong and dark trousers — shoulders, hands, hollow eye sockets, hair — with
// merged static geometry and four animated limbs, so the whole enemy is a
// handful of draw calls. It is deliberately not lit by a lamp of its own;
// your torch finds it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { architecture, floorHeightAt } from '../world/architecture.js';
import { props } from '../world/props.js';
import { hiding, openHidingDoor } from '../world/hiding.js';
import { LEVELS, STAIR } from '../world/plan.js';
import { TRAP } from './traps.js';

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
    // Dormant until the player is actually inside the house. The full state
    // list is written out above `update`; there is no single 'chase' state any
    // more, because stalking, ambushing and striking have different rules and
    // one state could not carry all three.
    this.state = 'dormant';
    this.armed = false;
    this.speed = 1.05;

    // --- weapon -----------------------------------------------------------
    // A machete carried low in the right hand. The model is one static mesh
    // with no skeleton, so there is no hand bone to parent to: the pivot is
    // the shoulder, which is where a swing actually comes from.
    this.arm = null;
    this.blade = null;
    this.attackPhase = 'idle';     // idle | windup | strike | recover
    this.attackT = 0;
    this.attackCd = 0;
    this.struck = false;

    // --- behaviour timers -------------------------------------------------
    this.observeT = 0;             // how long it has stood and watched
    this.ambushT = 0;              // waiting behind the last corner
    this.setTrapT = 0;             // crouched over a wire
    this.recoverT = 0;
    this.stunT = 0;
    this.trapCd = 14;              // the first trap is not immediate
    this.lostT = 0;                // seconds since it last had eyes on you
    this.noticeCd = 0;             // rate limit on the 'it noticed' cue
    this.stepDist = 0;

    // The route has to come downstairs. It used to be six waypoints, all on
    // F2, so a player who spent the night on the ground floor and in the
    // basement never met it; the three GF points are what put it in the same
    // corridors the fuse and the diesel are in.
    this.route = [
      'f_hall', 'f_south', 'f_master', 'f_hall',
      'g_foyer', 'g_dining', 'g_gallery', 'g_service', 'g_foyer',
      'f_hall', 'f_bed5', 'f_south',
    ];
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
    this.gait = 0;          // limb phase, driven by distance walked
    this.gaitAmp = 0;

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

  // ---- the figure ----------------------------------------------------------
  // Authored facing +Z at 1.74 m, the same frame the weapon was built in and
  // the same frame placeBody() turns with (yaw + PI). Everything that does not
  // move is merged per material; the legs and arms are groups so they can
  // swing. Nothing here is translucent, emissive or lit by its own lamp.
  buildMesh() {
    const M = this.mats = {
      skin: new THREE.MeshStandardMaterial({ name: 'Skin', color: 0x6b5643, roughness: 0.9, metalness: 0 }),
      shirt: new THREE.MeshStandardMaterial({ name: 'Barong', color: 0x5a5347, roughness: 1, metalness: 0 }),
      cloth: new THREE.MeshStandardMaterial({ name: 'Undershirt', color: 0x24211d, roughness: 1, metalness: 0 }),
      trouser: new THREE.MeshStandardMaterial({ name: 'Trousers', color: 0x1a1816, roughness: 1, metalness: 0 }),
      shoe: new THREE.MeshStandardMaterial({ name: 'Shoes', color: 0x0c0b0a, roughness: 0.9, metalness: 0.05 }),
      hair: new THREE.MeshStandardMaterial({ name: 'Hair', color: 0x0b0a09, roughness: 0.96, metalness: 0 }),
      dark: new THREE.MeshStandardMaterial({ name: 'Sockets', color: 0x050505, roughness: 0.55, metalness: 0 }),
      steel: new THREE.MeshStandardMaterial({ name: 'Blade', color: 0x8b8f8c, roughness: 0.42, metalness: 0.74 }),
      grip: new THREE.MeshStandardMaterial({ name: 'Grip', color: 0x2a1d14, roughness: 0.88, metalness: 0.05 }),
    };

    // Collect by material, then merge: one mesh per cloth rather than forty.
    const bucket = () => {
      const map = new Map();
      const put = (mat, geo, tr = {}) => {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(tr.rx || 0, tr.ry || 0, tr.rz || 0, 'YXZ'));
        geo.applyMatrix4(new THREE.Matrix4().compose(
          new THREE.Vector3(tr.x || 0, tr.y || 0, tr.z || 0),
          q,
          new THREE.Vector3(tr.sx ?? 1, tr.sy ?? 1, tr.sz ?? 1)));
        if (!map.has(mat)) map.set(mat, []);
        map.get(mat).push(geo);
        return geo;
      };
      const flush = (parent) => {
        for (const [mat, geos] of map) {
          const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
          if (!merged) continue;
          const mesh = new THREE.Mesh(merged, mat);
          mesh.name = 'Resident_' + (mat.name || 'part');
          parent.add(mesh);
        }
      };
      return { put, flush };
    };

    const body = new THREE.Group();
    body.name = 'ResidentBody';
    const b = bucket();

    // hips and the barong: a tapered barrel, not a dress
    b.put(M.cloth, new THREE.BoxGeometry(0.30, 0.20, 0.20), { y: 0.97 });
    b.put(M.shirt, new THREE.CylinderGeometry(0.185, 0.152, 0.50, 10), { y: 1.235, sz: 0.64 });
    // the shirt hangs open over a dark undershirt
    b.put(M.cloth, new THREE.BoxGeometry(0.135, 0.40, 0.03), { y: 1.235, z: 0.098 });
    b.put(M.shirt, new THREE.CylinderGeometry(0.070, 0.078, 0.075, 8), { y: 1.505 });
    b.put(M.shirt, new THREE.SphereGeometry(0.066, 8, 6), { x: 0.176, y: 1.435, sz: 0.92 });
    b.put(M.shirt, new THREE.SphereGeometry(0.066, 8, 6), { x: -0.176, y: 1.435, sz: 0.92 });

    // neck, skull, face. The eyes are holes, not eyes: two dark spheres set
    // into the socket so the torch does not give them a highlight.
    b.put(M.skin, new THREE.CylinderGeometry(0.048, 0.058, 0.11, 8), { y: 1.500 });
    b.put(M.skin, new THREE.SphereGeometry(0.104, 12, 10), { y: 1.615, sy: 1.10 });
    b.put(M.skin, new THREE.BoxGeometry(0.150, 0.020, 0.030), { y: 1.658, z: 0.086, rx: -0.22 });
    b.put(M.dark, new THREE.SphereGeometry(0.017, 8, 6), { x: 0.040, y: 1.621, z: 0.090, sz: 0.5 });
    b.put(M.dark, new THREE.SphereGeometry(0.017, 8, 6), { x: -0.040, y: 1.621, z: 0.090, sz: 0.5 });
    b.put(M.skin, new THREE.BoxGeometry(0.026, 0.064, 0.036), { y: 1.590, z: 0.106, rx: 0.10 });
    b.put(M.dark, new THREE.BoxGeometry(0.052, 0.008, 0.012), { y: 1.549, z: 0.100 });

    // hair: a low cap, a mass down the back of the neck, two strands, and one
    // lock across the face that does most of the work at close range
    b.put(M.hair, new THREE.SphereGeometry(0.108, 10, 8), { y: 1.650, z: -0.014, sy: 0.78, sz: 1.02 });
    b.put(M.hair, new THREE.BoxGeometry(0.185, 0.26, 0.055), { y: 1.545, z: -0.098 });
    b.put(M.hair, new THREE.BoxGeometry(0.036, 0.24, 0.060), { x: 0.102, y: 1.545, z: -0.020 });
    b.put(M.hair, new THREE.BoxGeometry(0.036, 0.24, 0.060), { x: -0.102, y: 1.545, z: -0.020 });
    b.put(M.hair, new THREE.BoxGeometry(0.030, 0.195, 0.026), { x: 0.050, y: 1.598, z: 0.098, rz: 0.10 });
    b.flush(body);
    this.body = body;
    this.group.add(body);

    // legs pivot at the hip so a walk is a walk and not a slide
    const leg = (side) => {
      const g = new THREE.Group();
      g.name = side < 0 ? 'ResidentLegR' : 'ResidentLegL';
      g.position.set(side * 0.098, 0.930, 0);
      const lb = bucket();
      lb.put(M.trouser, new THREE.CylinderGeometry(0.078, 0.064, 0.42, 8), { y: -0.21 });
      lb.put(M.trouser, new THREE.CylinderGeometry(0.056, 0.050, 0.40, 8), { y: -0.60 });
      lb.put(M.shoe, new THREE.BoxGeometry(0.098, 0.062, 0.250), { y: -0.900, z: 0.055 });
      lb.flush(g);
      this.group.add(g);
      return g;
    };
    this.legR = leg(-1);
    this.legL = leg(1);

    this.armL = this.buildArm(1, false);
    this.arm = this.buildArm(-1, true);
  }

  // One arm, from the shoulder down, with the machete in the right hand. The
  // whole group is what the swing rotates, so the sleeve and the hand travel
  // with the blade instead of a knife floating beside a body.
  buildArm(side, weapon) {
    const M = this.mats;
    const g = new THREE.Group();
    g.name = weapon ? 'ResidentArmWeapon' : 'ResidentArm';
    g.position.set(side * 0.178, 1.425, 0);
    const b = (() => {
      const map = new Map();
      const put = (mat, geo, tr = {}) => {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(tr.rx || 0, tr.ry || 0, tr.rz || 0, 'YXZ'));
        geo.applyMatrix4(new THREE.Matrix4().compose(
          new THREE.Vector3(tr.x || 0, tr.y || 0, tr.z || 0), q,
          new THREE.Vector3(tr.sx ?? 1, tr.sy ?? 1, tr.sz ?? 1)));
        if (!map.has(mat)) map.set(mat, []);
        map.get(mat).push(geo);
        return geo;
      };
      const flush = (parent) => {
        for (const [mat, geos] of map) {
          const merged = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)));
          if (!merged) continue;
          const mesh = new THREE.Mesh(merged, mat);
          mesh.name = 'Resident_' + (mat.name || 'arm');
          parent.add(mesh);
        }
      };
      return { put, flush };
    })();

    b.put(M.shirt, new THREE.CylinderGeometry(0.052, 0.045, 0.30, 8), { y: -0.150 });
    b.put(M.shirt, new THREE.SphereGeometry(0.046, 8, 6), { y: -0.305 });
    b.put(M.shirt, new THREE.CylinderGeometry(0.044, 0.038, 0.22, 8), { y: -0.420 });
    b.put(M.skin, new THREE.CylinderGeometry(0.036, 0.032, 0.10, 7), { y: -0.565 });
    b.put(M.skin, new THREE.BoxGeometry(0.055, 0.095, 0.042), { y: -0.655, z: 0.005 });

    if (weapon) {
      // grip in the hand, blade hanging past the shin
      b.put(M.grip, new THREE.CylinderGeometry(0.019, 0.022, 0.145, 7), { y: -0.705 });
      b.put(M.steel, new THREE.BoxGeometry(0.058, 0.016, 0.012), { y: -0.788, z: 0.008 });
      // The flat of the blade faces sideways, the way a machete hangs: from
      // the front you see the edge. It is 58 mm wide so it still reads as a
      // blade at two metres, and it tapers into the tip.
      b.put(M.steel, new THREE.BoxGeometry(0.058, 0.470, 0.011), { y: -1.035, z: 0.012, rx: 0.02 });
      b.put(M.steel, new THREE.BoxGeometry(0.034, 0.090, 0.011), { y: -1.305, z: 0.028, rx: -0.32 });
    }
    b.flush(g);
    this.group.add(g);
    return g;
  }

  // A restrained walk: legs and the free arm swing, the torso rolls a little.
  // The weapon arm is left to updateWeapon(), which owns its pose.
  updateLimbs(dt) {
    if (!this.legL) return;
    const moving = this.pathIdx < this.path.length && this.speed > 0.05 && this.attackPhase === 'idle';
    this.gaitAmp += ((moving ? 1 : 0) - this.gaitAmp) * Math.min(1, dt * 7);
    if (moving) this.gait += dt * (2.2 + this.speed * 2.6);
    const s = Math.sin(this.gait) * 0.42 * this.gaitAmp;
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    if (this.armL) this.armL.rotation.x = -s * 0.7;
    if (this.body) this.body.rotation.z = Math.sin(this.gait * 0.5) * 0.02 * this.gaitAmp;
  }

  // Three phases, and only the middle one can hurt anybody. Windup is the
  // tell — the blade goes up over the shoulder and the body squares to you —
  // strike is 0.17 s of sweep, recovery is nearly a second of standing still.
  // If the player moves during the windup, the strike misses: the damage test
  // is a range test at the instant of the sweep, not a latch.
  updateWeapon(dt) {
    if (!this.arm) return;
    if (this.attackPhase === 'idle') {
      this.arm.rotation.x = 0.06 + Math.sin(this.animT * 1.7) * 0.02;
      this.arm.rotation.z = -0.10;
      return;
    }
    this.attackT += dt;
    if (this.attackPhase === 'windup') {
      const k = Math.min(1, this.attackT / 0.42);
      const e = k * k;
      this.arm.rotation.x = 0.06 + e * 0.92;
      this.arm.rotation.z = -0.10 - e * 0.20;
    } else if (this.attackPhase === 'strike') {
      const k = Math.min(1, this.attackT / 0.17);
      const e = 1 - (1 - k) * (1 - k);
      this.arm.rotation.x = 0.98 - e * 2.45;
      this.arm.rotation.z = -0.30 + e * 0.34;
    } else if (this.attackPhase === 'recover') {
      const k = Math.min(1, this.attackT / 0.95);
      this.arm.rotation.x = -1.47 + k * 1.53;
      this.arm.rotation.z = -0.30 + k * 0.20;
    }
  }

  startAttack() {
    this.state = 'attack';
    this.attackPhase = 'windup';
    this.attackT = 0;
    this.struck = false;
    this.forcePlan();
  }

  // The strike resolves exactly once. Repeating the damage check on every
  // frame of the window is how a single swing takes three trials.
  stepAttack(game) {
    if (this.attackPhase === 'windup' && this.attackT >= 0.42) {
      this.attackPhase = 'strike';
      this.attackT = 0;
      this.struck = false;
      game?.audio?.blade?.();
    } else if (this.attackPhase === 'strike') {
      if (!this.struck && this.attackT >= 0.04) {
        this.struck = true;
        const p = this.player.pos;
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        const dy = Math.abs(p.y - (this.footY + 1.1));
        // a wall between the blade and the body refuses the hit, even at
        // arm's length: that is what stops it cutting through the door it is
        // standing behind
        const clear = !this.sightBlocked(this.pos.x, this.pos.z, p.x, p.z, this.footY + 1.3);
        if (d < 1.95 && dy < 1.6 && clear) game?.hitByResident?.('blade');
      }
      if (this.attackT >= 0.17) { this.attackPhase = 'recover'; this.attackT = 0; }
    } else if (this.attackPhase === 'recover' && this.attackT >= 0.95) {
      this.attackPhase = 'idle';
      this.attackT = 0;
      this.attackCd = 2.4;
      this.state = this.canSee ? 'stalk' : (this.lastKnown ? 'search' : 'return');
      this.searchT = 6;
    }
  }

  // A door shut in its face is the one thing the player can do to it. The
  // stun is short, it cancels any swing in progress, and it cannot be spammed
  // because the door stays shut afterwards.
  stun(seconds = 2.4) {
    if (this.state === 'stunned') return;
    this.state = 'stunned';
    this.stunT = seconds;
    this.attackPhase = 'idle';
    this.attackT = 0;
    this.attackCd = Math.max(this.attackCd, 1.6);
    this.forcePlan();
  }

  // One cue when it registers something, rate limited so a player who keeps
  // breaking and regaining line of sight is not rung like a bell.
  cue() {
    if (this.noticeCd > 0) return;
    this.noticeCd = 7;
    this.game?.audio?.notice?.();
  }

  faceToward(x, z, dt, rate = 3.0) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    if (Math.hypot(dx, dz) < 0.01) return;
    const want = Math.atan2(-dx, -dz);
    const diff = (want - this.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
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
  // Exact 2-D segment intersection. The sight test used to march the ray in
  // 0.42 m steps and call a wall blocking only if a sample landed within 6 cm
  // of it. A 2.2 m door crossed at an angle is missed by that: the first lamp
  // it produced stood in front of the front door and the blade went through it.
  // Two crossing segments either intersect or they do not, whatever the step.
  sightBlocked(ax, az, bx, bz, eyeY, ignore = null) {
    const crosses = (x1, z1, x2, z2) => {
      const rx = bx - ax, rz = bz - az;
      const sx = x2 - x1, sz = z2 - z1;
      const den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) return false;
      const t = ((x1 - ax) * sz - (z1 - az) * sx) / den;
      const u = ((x1 - ax) * rz - (z1 - az) * rx) / den;
      return t > 0.001 && t < 0.999 && u >= -0.001 && u <= 1.001;
    };
    const inside = (c) => ax > c.x1 && ax < c.x2 && az > c.z1 && az < c.z2
      || bx > c.x1 && bx < c.x2 && bz > c.z1 && bz < c.z2;

    const list = architecture.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c || c.disabled) continue;
      if (c.kind === 'rail') continue;
      // A closed door blocks sight; an open one has its collider disabled and
      // is skipped by that branch above.
      if (c.y0 !== undefined && (eyeY < c.y0 || eyeY > c.y1)) continue;
      if (this.isBox(c)) {
        if (inside(c)) return true;
        if (crosses(c.x1, c.z1, c.x2, c.z1) || crosses(c.x2, c.z1, c.x2, c.z2)
          || crosses(c.x2, c.z2, c.x1, c.z2) || crosses(c.x1, c.z2, c.x1, c.z1)) return true;
      } else if (crosses(c.x1, c.z1, c.x2, c.z2)) return true;
    }

    const boxes = props.colliders;
    for (let i = 0; i < boxes.length; i++) {
      const c = boxes[i];
      if (c.y0 === undefined || c.y1 - c.y0 < 1.0) continue;
      if (eyeY < c.y0 || eyeY > c.y1) continue;
      // The armoire a peeking player is inside is the one object that must not
      // block their view out of it. Every other piece still does.
      if (ignore && Math.abs(c.x1 - ignore.x0) < 0.06 && Math.abs(c.z1 - ignore.z0) < 0.06) continue;
      if (inside(c)) return true;
      if (crosses(c.x1, c.z1, c.x2, c.z1) || crosses(c.x2, c.z1, c.x2, c.z2)
        || crosses(c.x2, c.z2, c.x1, c.z2) || crosses(c.x1, c.z2, c.x1, c.z1)) return true;
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
    // A torch in your hand is a beacon. It throws fifteen metres of light and
    // it silhouettes whatever is behind it, so the body holding it is easier
    // to pick out — but only inside that beam's own reach, and only if the
    // beam is actually pointing this way. It never reveals you across the
    // house, and it is not a switch that turns the house against you.
    const torch = this.player.flashlightOn ? 1 : 0;
    const range = (this.state === 'stalk' || this.state === 'attack' ? 13 : SIGHT) + torch * 3.0;
    const cosLimit = SIGHT_COS - torch * 0.10;
    let sees = false;
    if (hidden && h.peek) {
      const spot = h.spot;
      const fx = Math.sin(spot.rot), fz = Math.cos(spot.rot);
      const vx = this.pos.x - spot.inside.x, vz = this.pos.z - spot.inside.z;
      const vl = Math.hypot(vx, vz) || 1;
      const fromFront = (vx * fx + vz * fz) / vl;
      if (dist < 6.5 && dot > cosLimit && fromFront > 0.15) {
        sees = !this.sightBlocked(this.pos.x, this.pos.z, px, pz, py, spot.aabb);
      }
    } else if (!concealed && dist < range && dy < 1.8 && dot > cosLimit) {
      sees = !this.sightBlocked(this.pos.x, this.pos.z, px, pz, this.footY + EYE);
    }
    this.canSee = sees;
    if (sees) {
      this.lastKnown = { x: px, y: py, z: pz, level: nearestLevel(py).id };
      this.memory = 7.0;
      this.lostT = 0;
      // Seeing you does not start a charge. At range it stops and looks, and
      // that pause is the moment the player can still break the line and get
      // out of the room. Up close there is nothing to look at.
      if (this.state === 'patrol' || this.state === 'investigate' || this.state === 'return') {
        this.checked.clear();
        this.forcePlan();
        this.cue();
        if (dist > 6.0) { this.state = 'observe'; this.observeT = 0; }
        else this.state = 'stalk';
      }
    } else if (this.state !== 'stunned') {
      this.lostT += dt;
    }
  }

  hear(x, y, z, radius) {
    if (!this.armed) return;
    if (this.state === 'stalk' || this.state === 'attack' || this.state === 'stunned') return;
    const d = Math.hypot(x - this.pos.x, y - (this.footY + 1), z - this.pos.z);
    if (d > radius) return;
    this.lastKnown = { x, y, z, level: nearestLevel(y).id };
    this.memory = 9.0;
    if (this.state !== 'investigate') {
      this.state = 'investigate';
      this.cue();
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
      door.target = (door.swingSign ?? (door.axis === 'x' ? 1 : -1)) * 1.35;
      // the entrance is a pair: both leaves have to swing when it forces one
      if (door.mesh2) door.target2 = -door.target;
      door.collider.disabled = true;
      this.game?.doorAnim?.push(door);
      this.game?.audio?.creak?.(!!door.entrance);
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
  // The states, and what moves each one:
  //
  //   dormant      no player in the house; nothing is simulated
  //   patrol       its route; also where it decides to leave a trap
  //   investigate  heard a noise; walks to the point, then looks around it
  //   observe      has seen you at range and stopped — the player's window
  //   stalk        closing on you, re-planning onto your position only while
  //                it can actually see you
  //   search       lost you; checks the last place it saw you and the hiding
  //                places in that room, then gives up
  //   setTrap      crouched over a wire it has just strung across a corridor
  //   ambush       holding behind the corner where it lost sight of you
  //   attack       windup / strike / recover — see stepAttack
  //   recover      a beat after a strike, before it hunts again
  //   stunned      a door shut in its face; it cannot act at all
  //   return       walking back to its route
  //
  // Every transition is driven by a real event: a sight test against the same
  // colliders the player's body uses, a noise radius, a timer one of those
  // started, or the end of a path. Nothing here switches state at random.
  update(dt, game) {
    if (game) this.game = game;
    // The blackout after a lost trial freezes it too: nothing is worse than
    // being killed by something that was already standing over the spot the
    // player wakes up on, and it is reset to its own route at the end of it.
    if (!game || game.state.ended || game.state.gameOver || game.caughtActive) return;
    // It does not exist outside the house, and it does not start walking
    // until the player is inside the building.
    if (!this.armed) {
      const x = this.player.pos.x, z = this.player.pos.z;
      const inside = x > -24.5 && x < 22.5 && z > -11.5 && z < 11.5 && this.player.footY > -0.6;
      if (!inside) { this.group.visible = false; return; }
      this.armed = true;
      this.state = 'patrol';
      // First move is toward the front of the house, so the player who has
      // just come in is not alone with an empty hall for the first minute.
      this.planToPoint(this.waypoints.g_foyer);
    }
    this.group.visible = true;
    this.animT += dt;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.trapCd = Math.max(0, this.trapCd - dt);
    this.noticeCd = Math.max(0, this.noticeCd - dt);

    // A stunned body does nothing at all: no sight update, no path, no swing.
    if (this.state === 'stunned') {
      this.stunT -= dt;
      this.attackPhase = 'idle';
      this.updateWeapon(dt);
      this.placeBody(dt, game);
      if (this.stunT <= 0) { this.state = 'recover'; this.recoverT = 0.8; }
      return;
    }

    // Mid-swing the body is committed. It cannot walk, see, or re-plan.
    if (this.attackPhase !== 'idle') {
      this.stepAttack(game);
      this.updateWeapon(dt);
      this.placeBody(dt, game);
      return;
    }

    if (this.state === 'recover') {
      this.recoverT -= dt;
      this.updateWeapon(dt);
      this.placeBody(dt, game);
      if (this.recoverT <= 0) {
        if (this.lastKnown) {
          this.state = 'search';
          this.searchT = 6.5;
          this.planToPoint(this.lastKnown);
        } else {
          this.state = 'return';
          this.planToPoint(this.waypoints.f_hall);
        }
      }
      return;
    }

    this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.14;
      this.sense(dt);
    }
    this.searchSpots(dt);
    this.doorsNear();

    const pd = Math.hypot(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z);
    const sameFloor = Math.abs(this.player.footY - this.footY) < 1.25;
    // The attack starts only from a state that could plausibly launch one, at
    // arm's length, on the same floor, with the player actually in sight.
    if (this.attackCd <= 0 && sameFloor && pd < 1.95 && this.canSee &&
        (this.state === 'stalk' || this.state === 'ambush' || this.state === 'observe')) {
      this.startAttack();
      this.stepAttack(game);
      this.updateWeapon(dt);
      this.placeBody(dt, game);
      return;
    }

    switch (this.state) {
      case 'observe': {
        // It stands and looks. This is the one beat where the player is being
        // watched rather than chased, and it lasts under a second.
        this.observeT += dt;
        this.speed = 0;
        this.faceToward(this.player.pos.x, this.player.pos.z, dt, 2.4);
        if (this.observeT > 0.9) this.state = 'stalk';
        break;
      }
      case 'stalk': {
        this.speed = 1.85;
        this.repathT -= dt;
        if (this.canSee && this.repathT <= 0) {
          this.repathT = 0.6;
          this.planToPoint({
            x: this.player.pos.x, z: this.player.pos.z,
            level: nearestLevel(this.player.footY).id,
          });
        }
        if (!this.canSee && this.lostT > 0.9 && pd < 7.5) {
          // It does not keep charging a corner it cannot see round. It holds
          // the last one, which is what makes doubling back work.
          this.state = 'ambush';
          this.ambushT = 2.2;
          this.forcePlan();
          break;
        }
        this.followPath(dt, 1.85);
        this.memory -= dt;
        if (!this.canSee && this.memory <= 0) {
          this.state = 'search';
          this.searchT = 7;
          this.checked.clear();
          if (this.lastKnown) this.planToPoint(this.lastKnown);
        }
        break;
      }
      case 'ambush': {
        this.speed = 0;
        this.ambushT -= dt;
        if (this.lastKnown) this.faceToward(this.lastKnown.x, this.lastKnown.z, dt, 2.0);
        if (this.canSee) { this.state = 'stalk'; this.memory = 7; break; }
        if (this.ambushT <= 0) {
          this.state = 'search';
          this.searchT = 6;
          this.checked.clear();
          if (this.lastKnown) this.planToPoint(this.lastKnown);
        }
        break;
      }
      case 'search': {
        this.speed = 1.15;
        this.searchT -= dt;
        if (this.pathIdx < this.path.length) this.followPath(dt, 1.15);
        else this.lookAround(dt);
        if (this.canSee) { this.state = 'stalk'; this.memory = 7; break; }
        if (this.searchT <= 0) {
          this.searchT = 0;
          this.state = 'return';
          this.planToPoint(this.waypoints.f_hall);
        }
        break;
      }
      case 'return': {
        this.speed = 0.95;
        this.followPath(dt, 0.95);
        if (this.pathIdx >= this.path.length) {
          this.state = 'patrol';
          this.routeIdx = 0;
          this.wait = 0;
        }
        break;
      }
      case 'setTrap': {
        // Crouched over the wire or peering at a board. If the player walks in
        // on this, they watch it happen and can still back out of the corridor.
        this.speed = 0;
        this.setTrapT -= dt;
        if (this.setTrapT <= 0) {
          // decide which kind to leave this time; the board is the quieter,
          // local tell and the wire is the louder one, so the Resident picks
          // between them rather than always leaving the same thing
          this.trapCd = TRAP.cooldown;
          this.state = 'patrol';
          const leaveBoard = Math.random() < 0.45;
          if (leaveBoard) {
            game.traps?.placeBoard({
              x: this.pos.x, z: this.pos.z, y: this.footY + 0.005,
              yaw: this.yaw, level: this.level,
            });
          } else {
            game.traps?.place({
              x: this.pos.x, z: this.pos.z, y: this.footY + 0.01,
              yaw: this.yaw, level: this.level,
            });
          }
          this.wait = 0.8;
        }
        break;
      }
      case 'investigate': {
        this.searchT -= dt;
        this.speed = 1.25;
        if (this.pathIdx < this.path.length) this.followPath(dt, 1.25);
        else this.lookAround(dt);
        if (this.canSee) { this.state = 'stalk'; this.memory = 7; break; }
        if (this.searchT <= 0) {
          this.searchT = 0;
          this.state = 'return';
          this.routeIdx = 0;
          this.wait = 0;
          this.planToPoint(this.waypoints.f_hall);
        }
        break;
      }
      case 'patrol':
      default: {
        this.speed = 0.95;
        // Leaving a trap is a patrol behaviour: only on the route, only with
        // the player out of the room, and only once every half minute. Either
        // kind counts against the same world budget.
        if (this.trapCd <= 0 && game.traps && game.traps.list.length < TRAP.max && pd > 9.0
            && this.pathIdx >= this.path.length
            && (game.traps.valid(this.pos.x, this.pos.z, this.footY)
                || game.traps.validBoard(this.pos.x, this.pos.z, this.footY))) {
          this.state = 'setTrap';
          this.setTrapT = 1.5;
          this.forcePlan();
          break;
        }
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
        break;
      }
    }

    this.placeBody(dt, game);
  }

  // Pose, footsteps and stuck recovery. Split out of update() so every state
  // ends the frame the same way — including the ones that return early.
  placeBody(dt, game) {
    if (!game) return;
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.y);
    this.stepDist += moved;
    // Weight on the boards, panned by which side of the player's head the
    // body is on, so a player in a wardrobe can hear it cross the room.
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
    // Stuck recovery: a body with a path that has not moved is caught on a
    // chair leg, a door frame or a landing edge. Re-plan instead of leaning
    // into it for the rest of the night.
    if (this.pathIdx < this.path.length && moved < 0.008) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastPos.set(this.pos.x, this.pos.z);
    if (this.stuckT > 1.4) {
      this.stuckT = 0;
      if (this.state === 'patrol' || this.state === 'return') {
        this.wait = 0.4;
        this.planToPoint(this.waypoints.f_hall);
      } else if (this.lastKnown) {
        this.planToPoint(this.lastKnown);
      }
    }

    // The model is authored facing +Z. Rotating +Z by (yaw + PI) gives the
    // movement direction (-sin yaw, -cos yaw), which is the way it walks.
    const crouch = this.state === 'setTrap' ? -0.34 : 0;
    this.group.position.set(this.pos.x, this.footY + crouch, this.pos.z);
    this.group.rotation.y = this.yaw + Math.PI;
    this.group.rotation.x = this.state === 'stalk' ? 0.07 : 0.02;
    this.group.position.y += Math.sin(this.animT * 1.7) * 0.006;
    this.updateLimbs(dt);
    this.level = nearestLevel(this.footY).id;
  }

  lookAround(dt) {
    this.yaw += dt * 0.9;
  }

  // A reset is what happens when the player loses a trial and comes to on the
  // foyer floor: the body goes back to its own route, the swing is cancelled,
  // and it does not get to keep a grudge. Nothing here is duplicated — the
  // same object, the same mesh, the same materials.
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
    this.lostT = 0;
    this.observeT = 0;
    this.ambushT = 0;
    this.setTrapT = 0;
    this.recoverT = 0;
    this.stunT = 0;
    this.attackPhase = 'idle';
    this.attackT = 0;
    this.attackCd = 0;
    this.struck = false;
    this.trapCd = 14;
    this.checked.clear();
    this.routeIdx = 0;
    this.wait = 0;
    this.group.rotation.x = 0.02;
    if (this.arm) { this.arm.rotation.set(0.06, 0, -0.10); }
    this.group.position.set(this.pos.x, this.footY, this.pos.z);
    this.gait = 0;
    this.gaitAmp = 0;
    // Back to the service wing, not the route: the player has just woken at
    // the front door and should get a few seconds before it is on them again.
    this.planToPoint(this.waypoints.g_service);
  }
}
