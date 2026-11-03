// GAME — the part that makes the building a playable night.
//
// The loop is small and solvable: reach the house, find the fuse in the
// workshop and the diesel in the generator room, start the generator, and the
// estate gate releases. Nothing required is behind a door that needs itself.
// Every pickup is reachable from the floor the player is on.
//
// All interactions are proximity + view-cone tests against world positions, so
// a prompt only appears for something the player is actually facing and close
// enough to touch.

import * as THREE from 'three';
import { materials } from '../world/materials.js';
import { architecture, floorHeightAt } from '../world/architecture.js';
import { props } from '../world/props.js';
import { LEVELS } from '../world/plan.js';
import { loadPhone, phonePickupMark, holdPhone, buildPhone } from '../world/phone.js';
import { updateCabinets, toggleDrawer } from '../world/cabinets.js';
import { apparatus, updateApparatus } from '../world/apparatus.js';
import { hiding, hidingEye, openHidingDoor, setHidingPeek, updateHiding } from '../world/hiding.js';
import { Resident } from './resident.js';
import { Traps } from './traps.js';
import { PhoneScreen, SCREEN_W, SCREEN_H } from '../ui/PhoneUI.js';

const $ = (id) => document.getElementById(id);

// Where the phone sits in the hand: down and to the right, turned in toward the
// player so the screen is read at an angle rather than straight on, and close
// enough to fill a corner of the view without covering the room. The held copy
// draws with the depth test off (see phone.js), so standing against a wall does
// not push the phone through the plaster.
const HELD_PHONE_POSE = {
  // The bottom of the body must stay inside the frame: at 0.33 m with the 66°
  // lens the screen is worth about 26° of the view, so a centimetre of drop is
  // the difference between the last row of icons and a cut-off phone. The
  // right edge is deliberately well inside the frame; the phone turns in
  // toward the eye rather than sitting parallel to the glass.
  pos: [0.168, -0.124, -0.33],
  rot: [-0.12, -0.42, 0.12],
  order: 'YXZ',
};

// Opening the phone is a physical move, not an overlay: the hand lifts it to
// the middle of the view and squares it to the eye, so the screen that is being
// touched is the screen on the model. At 0.16 m the 14.7 cm body fills about
// three quarters of the frame height — the distance you actually hold a phone
// at to read it — and still clears both edges.
const RAISED_PHONE_POSE = {
  pos: [0.0, -0.004, -0.16],
  rot: [-0.04, -0.015, 0.012],
  order: 'YXZ',
};

function poseHeldPhone(group, raise = 0) {
  if (!group) return;
  const e = raise * raise * (3 - 2 * raise);   // smoothstep, so it settles
  const a = HELD_PHONE_POSE, b = RAISED_PHONE_POSE;
  group.rotation.order = HELD_PHONE_POSE.order;
  group.position.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * e,
    a.pos[1] + (b.pos[1] - a.pos[1]) * e,
    a.pos[2] + (b.pos[2] - a.pos[2]) * e,
  );
  group.rotation.set(
    a.rot[0] + (b.rot[0] - a.rot[0]) * e,
    a.rot[1] + (b.rot[1] - a.rot[1]) * e,
    a.rot[2] + (b.rot[2] - a.rot[2]) * e,
  );
}

export class Game {
  constructor({ scene, player, camera, renderer, audio }) {
    this.scene = scene;
    this.player = player;
    this.camera = camera;
    this.renderer = renderer;
    this.audio = audio;
    this.opener = null;   // the opening sequence; consulted for car interactions
    this.state = {
      phase: 'road',
      hasFuel: false,
      hasFuse: false,
      fuseInstalled: false,
      fuseboxOpen: false,
      hasKey: false,
      powered: false,
      gateOpen: false,
      ended: false,
      // The five trials. A trial is a life: the Resident's blade takes one,
      // and the fifth takes the night. `gameOver` is separate from `ended`
      // because `ended` means the story is finished, and a game over has to be
      // recoverable.
      trials: 5,
      trialsLost: 0,
      gameOver: false,
    };
    this.trialsLeft = 5;
    this.invulnT = 0;        // brief grace after a trial is lost
    this.stumbleT = 0;       // after a trap, the body is slow for a moment
    this.inventory = new Set();
    this.lights = [];
    this.pickupMeshes = new Map();
    this.messages = [];
    this.promptTarget = null;
    this.doorAnim = [];
    this.lastRoom = '';
    this.heldPhone = null;
    this.heldPhoneGroup = null;
    this._phoneInfo = null;
    this._phoneHoldPose = null;
    // The phone can live in the pocket instead of being held in front of the
    // camera. When it is pocketed the in-hand group is hidden and a small
    // anchor is drawn at the player's hip so the phone's absence has a
    // physical reason rather than just vanishing from the world.
    this.pocketed = false;
    this.pocketAnchor = null;
    // The phone's display. One canvas, one texture, shared by the copy lying on
    // the console and the copy in the hand, so the phone the player picks up is
    // already showing a screen and the interface never exists off the model.
    this.phoneScreen = new PhoneScreen({ say: (t, ms) => this.say(t, ms) });
    this._phoneRaise = 0;    // 0 = at the side, 1 = squared to the eye
    this.seenBoardHint = false;   // the first-time teaching line about speaking boards
    this._phoneRaiseTo = 0;
    this._phoneRay = new THREE.Raycaster();
    this._phoneNdc = new THREE.Vector2();
    // Hiding is a state machine owned by the game, not by the furniture:
    //   out -> entering -> hidden <-> peek -> leaving -> out
    // `from` is the camera pose the move started from, so entering and leaving
    // are interpolated transitions rather than teleports.
    this.hiding = {
      mode: 'out', spot: null, t: 0, from: null,
      fromYaw: 0, fromPitch: 0, baseYaw: 0,
      peek: false, peekedAt: 0, noise: 0,
    };
    this.caughtActive = false;
    this.noiseT = 0;
    this.buildStoryProps();
    this.buildGate();
    this.buildLights();
    this.buildPhones();
    this.buildStoryBoards();
    this._loadPhoneAsync();
    // The Resident is built after the world, so it sees the same colliders,
    // doors and hideable armoires the player does. It does not start moving
    // until the player is inside the house.
    // The traps are a world object the Resident writes to and the player reads
    // from, so they are built before the Resident and never rebuilt.
    this.traps = new Traps(scene, this);
    this.resident = new Resident({ scene, player, game: this });
    this.bind();
    this.updateHud();
    this.updateTrialsHud();
  }

  // The board dressed in the foyer by props.js gets its physical trap mesh here,
  // after traps exist and after the world phone is placed. Only one dressed board
  // is allowed, and only if the floor under it is flat; otherwise it stays a
  // prompt-only prop (which still tells the player to look, but never speaks).
  buildStoryBoards() {
    for (const p of props.interactables) {
      if (p.kind !== 'trap' || p.type !== 'board' || p.placed) continue;
      const y = floorHeightAt(p.x, p.z, this.player?.footY);
      if (y === null || Math.abs(y - (p.y - 0.04)) > 0.12) continue;
      this.traps?.placeBoard({ x: p.x, z: p.z, y: p.y - 0.04, yaw: p.ry ?? 0, level: p.room ?? 'GF' });
      p.placed = true;
    }
  }

  buildStoryProps() {
    const mark = (id, color, size, yOff) => {
      const p = props.interactables.find((i) => i.id === id);
      if (!p) return;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: id === 'key' ? 0.7 : 0.2 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
      mesh.position.set(p.x, p.y - yOff, p.z);
      mesh.name = 'Pickup_' + id;
      this.scene.add(mesh);
      this.pickupMeshes.set(id, mesh);
    };
    mark('fuel', 0x6d4a2a, [0.34, 0.46, 0.2], 0.2);
    mark('fuse', 0xb9ac8c, [0.1, 0.2, 0.1], 0.1);
    mark('key', 0xb08a3a, [0.04, 0.02, 0.18], 0.02);

    const note = props.interactables.find((i) => i.id === 'note');
    if (note) {
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xc9bfa6, roughness: 1, side: THREE.DoubleSide }));
      paper.rotation.x = -Math.PI / 2;
      paper.position.set(note.x, note.y - 0.02, note.z);
      this.scene.add(paper);
    }
  }

  // The phone is authored by the dressing system, but the pickup marker and the
  // held-object group are built by the game so the player can actually pick it
  // up and carry it.
  buildPhones() {
    const phone = props.interactables.find((i) => i.id === 'phone');
    if (!phone) return;
    this._phoneSpot = phone;
    const mark = phonePickupMark();
    mark.position.set(phone.x, phone.y - 0.02, phone.z);
    this.scene.add(mark);
    this.pickupMeshes.set('phone', mark);
    // The phone itself arrives with the GLB, which is a fetch; until it lands
    // this marker is all there is, which is why it is built here and not in
    // _loadPhoneAsync.
    this._placeWorldPhone();
  }

  // The supplied model, lying on the console where the dressing system left it.
  // Same asset as the one that ends up in the player's hand.
  _placeWorldPhone() {
    const spot = this._phoneSpot;
    if (!spot || !this._phoneInfo || this.worldPhone) return;
    const g = buildPhone(this._phoneInfo);
    if (!g) return;
    this.attachPhoneScreen(g);
    g.position.set(spot.x, (spot.surfaceY ?? spot.y - 0.03) + 0.006, spot.z);
    // YXZ so the yaw is a heading on the table, not a roll of the body: X
    // lays the phone on its back, Y then turns it where it lies.
    g.rotation.order = 'YXZ';
    g.rotation.set(-Math.PI / 2, spot.ry ?? 0.4, 0);
    this.scene.add(g);
    this.worldPhone = g;
    const mark = this.pickupMeshes.get('phone');
    if (mark) mark.visible = false;   // the model is the marker now
  }

  async _loadPhoneAsync() {
    try {
      this._phoneInfo = await loadPhone(() => {});
    } catch (err) {
      console.warn('[game] phone did not load:', err?.message || err);
      this._phoneInfo = null;
      return;
    }
    this._placeWorldPhone();
    // The phone is on a surface in the world. Do not auto-swallow it into the
    // hand on load: the phone is now a physical object that lives on the
    // console until the player takes it, pockets it, and takes it out again.
    //
    // The exception is a phone taken before the model finished loading. The
    // pickup is deliberately not blocked on the loader, and takePhone() had no
    // asset to build, so it left the item in the inventory and nothing in the
    // hand — the player would walk on with an empty fist until they pressed P.
    // Now that the asset is here, finish the deferred pickup.
    if (this.inventory.has('phone') && !this.heldPhone && !this.pocketed) this.takePhone();
  }

  buildGate() {
    const g = new THREE.Group();
    g.name = 'EstateGate';
    const postGeo = new THREE.BoxGeometry(0.26, 2.4, 0.26);
    for (const x of [-1.9, 1.9]) {
      const p = new THREE.Mesh(postGeo, materials.stoneDark);
      p.position.set(-13.4 + x, 1.2, 18.3);
      g.add(p);
    }
    const barMat = materials.iron;
    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 0.05), barMat);
        bar.position.set(side * (0.2 + i * 0.24), 1.0, 0);
        leaf.add(bar);
      }
      for (const y of [0.35, 1.55]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.06), barMat);
        rail.position.set(side * 0.95, y, 0);
        leaf.add(rail);
      }
      leaf.position.set(-13.4, 0, 18.3);
      leaf.rotation.y = 0;
      g.add(leaf);
      if (side === -1) this.gateLeft = leaf; else this.gateRight = leaf;
    }
    this.gate = g;
    this.gateCollider = { x1: -15.6, z1: 18.3, x2: -11.2, z2: 18.3, kind: 'gate', y0: -1, y1: 2.8 };
    architecture.colliders.push(this.gateCollider);
    this.scene.add(g);
    this.gateInteract = { id: 'gate', name: 'the estate gate', kind: 'gate', x: -13.4, y: 1.0, z: 18.0 };
    this.gateGlow = new THREE.PointLight(0xffc07a, 0, 7, 2);
    this.gateGlow.position.set(-13.4, 2.0, 17.4);
    this.scene.add(this.gateGlow);
  }

  buildLights() {
    // Practical lights from the furniture. Forward rendering pays for every
    // light on every fragment, so the rig is a fixed number of SLOTS — eight —
    // and each frame the eight practicals nearest the player are assigned to
    // them. Every room is therefore lit when you are in it, and the shader
    // still compiles for exactly eight point lights.
    //
    // The old version kept the first fourteen lights sorted by height, which
    // meant the ground floor was lit and the upper floors were black whatever
    // lamps the rooms carried.
    this.lightSlots = [];
    for (let i = 0; i < 8; i++) {
      const light = new THREE.PointLight(0xffc88a, 0, 10, 2);
      light.name = 'Practical' + i;
      this.scene.add(light);
      this.lightSlots.push(light);
      this.lights.push(light);
    }
    this._lightTimer = 0;
    // The porch lamp is the one light visible from the road: a sign of life.
    const porch = new THREE.PointLight(0xffb063, 9, 16, 2);
    porch.position.set(0, 3.2, 12.6);
    this.scene.add(porch);
    this.porch = porch;
  }

  bind() {
    addEventListener('keydown', (e) => {
      if (this.state.ended || this.state.gameOver) return;
      // While the phone is up the pointer is a finger, and the only keys that
      // mean anything are the two that put it back down. Everything else would
      // be interacting with the room through the phone.
      if (this.phoneScreen?.isOpen) {
        if (e.code === 'KeyP' || e.code === 'Escape') this.closePhone();
        return;
      }
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ' && this.hiding.mode !== 'out') { this.leaveHiding(); return; }
      if (e.code === 'KeyR' && this.hiding.mode !== 'out') { this.leaveHiding(); return; }
      if (e.code === 'KeyR' && this.opener && !this.opener.walkPhase()) return;
      if (e.code === 'KeyR' && this.inventory.size >= 0) {
        // a way out of getting stuck, not a cheat: back to the front door
        this.player.teleport(0, 12.4);
        this.say('You walk back to the door.');
      }
      if (e.code === 'KeyP') {
        if (this.inventory.has('phone')) {
          this.openPhone();
        } else {
          this.say('No signal. 03:12. You are still here.', 3200);
        }
      }
      if (e.code === 'KeyO') {
        if (!this.inventory.has('phone')) {
          this.say('No signal. 03:12. You are still here.', 3200);
          return;
        }
        if (this.pocketed) {
          this.takeOutPhone();
        } else if (this.heldPhone && !this.phoneScreen?.isOpen) {
          this.pocketPhone();
        } else if (this.heldPhone && this.phoneScreen?.isOpen) {
          this.closePhone();
          this.say('Pocket it with O when it is down.', 2200);
        } else {
          this.takePhone();
        }
      }
      // A board that is in front of the player and close enough to step on can
      // be stepped over on the player's own cue, instead of only at walking
      // speed. The cue is explicit and reversible: tap to step over, tap again
      // to step back onto it, so the player can rehearse the line rather than
      // learn it from a creak. It is disabled while the phone is up because K is
      // the screen-pointer shortcut there.
      if (e.code === 'KeyK' && this.traps && !this.phoneScreen?.isOpen) {
        const t = this.traps.nearestBoard(this.player.pos, this.player.forward());
        if (t && t.dist < 1.8) {
          if (t.trap.live) {
            this.stepBoard(t.trap);
          } else {
            this.say('That board is already spent. Step around it.', 2600);
          }
        }
      }
    });
    addEventListener('pointermove', (e) => this.onPhoneMove(e));
    addEventListener('pointerdown', (e) => this.onPhoneDown(e));
  }

  say(text, ms = 3400) {
    const el = $('msg');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.classList.remove('on'), ms);
  }

  objective(text) {
    const el = $('hint');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
  }

  nearestInteraction() {
    const eye = this.player.pos;
    const fwd = this.player.forward();
    let best = null;
    let bestScore = -Infinity;
    // Focus is the object nearest the VIEW RAY, not the nearest object. The
    // old dot-minus-distance score let the closest item win even when the
    // player was looking at something else in the same cabinet, which is how a
    // column of drawers all fought for one prompt.
    const consider = (o, dist, dot, bonus = 0) => {
      if (dist > 3.0 || dot < 0.35) return;
      const miss = dist * Math.sqrt(Math.max(0, 1 - dot * dot));
      const score = bonus - miss * 2 - dist * 0.02;
      if (score > bestScore) { bestScore = score; best = o; }
      // mark a trap as seen the moment it becomes a prompt candidate so later
      // room dressing can stop placing new ones in a corridor the player has
      // already noticed; the wire and the board share this flag
      if (o && o.kind === 'trap' && o.trap) o.trap.seen = true;
    };
    for (const it of props.interactables) {
      if (it.kind === 'pickup' && this.inventory.has(it.id)) continue;
      if (it.kind === 'read' && this.inventory.has('note')) continue;
      // a drawer's contents are only offered once the drawer is open
      if (it.when && !it.when()) continue;
      const dx = it.x - eye.x, dy = it.y - eye.y, dz = it.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      // aim horizontally: a tin of diesel at knee height is still "in front of
      // you" when you are looking at the generator six feet away
      const dh = Math.hypot(dx, dz);
      if (Math.abs(dy) > 2.0) continue;
      // Horizontal facing decides whether the object is in front of you at all;
      // the full 3-D dot decides WHICH of a column of drawers you are looking
      // at, so the top and bottom drawer do not fight for the same prompt.
      const dotH = dh > 0.001 ? (dx * fwd.x + dz * fwd.z) / (dh * Math.hypot(fwd.x, fwd.z) || 1) : 1;
      if (dotH < 0.35) continue;
      const dot3 = d > 0.001 ? (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d : 1;
      const bonus = it.kind === 'pickup' ? 0.16 : it.kind === 'read' ? 0.08 : 0;
      consider(it, d, dot3, bonus);
    }
    for (const door of architecture.doors) {
      if (!door.collider) continue;  // a cased arch: nothing to open
      const cx = door.axis === 'x' ? door.at : door.c;
      const cz = door.axis === 'x' ? door.c : door.at;
      const dx = cx - eye.x, dz = cz - eye.z;
      const d = Math.hypot(dx, dz);
      const dy = door.y + 1.0 - eye.y;
      const dot = d > 0.001 ? (dx * fwd.x + dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) : 1;
      if (Math.abs(dy) < 2.2 && (door.level === this.currentLevel()?.id || Math.abs(door.y - this.player.footY) < 1.6)) {
        consider({ kind: 'door', door, name: door.open ? 'the door' : 'a door', x: cx, y: door.y + 1.0, z: cz }, Math.hypot(d, dy), dot, -0.3);
      }
    }
    {
      const it = this.gateInteract;
      const dx = it.x - eye.x, dz = it.z - eye.z;
      const d = Math.hypot(dx, dz);
      const dot = (dx * fwd.x + dz * fwd.z) / (d || 1);
      consider(it, d, dot);
    }
    // A wire is only offered when the player is looking at it, which is what
    // makes it an object in the room rather than an invisible trigger.
    if (this.traps) {
      const t = this.traps.nearest(eye, fwd);
      if (t) {
        consider({
          kind: 'trap', trap: t.trap, name: t.trap.type === 'board' ? 'the loose board' : 'the wire',
          x: t.trap.x, y: t.trap.y + (t.trap.type === 'board' ? 0.06 : 0.2), z: t.trap.z,
        }, t.dist, t.dot, 0.2);
      }
      // the board is short enough that a look also promotes it to a prompt,
      // the same way the wire is — but only the live one invites a step-over
      const b = this.traps.nearestBoard(eye, fwd);
      if (b && !t) {
        consider({
          kind: 'trap', trap: b.trap, name: 'the loose board',
          x: b.trap.x, y: b.trap.y + 0.06, z: b.trap.z,
        }, b.dist, b.dot, 0.2);
      }
    }
    if (this.opener) {
      const t = this.opener.nearest();
      if (t) consider(t, t.dist, t.dot, 0.6);
    }
    return best;
  }

  // The floor the player is on, or the one they just left while they are
  // between floors. The old +/-1.5 m window returned null at mid-flight, so the
  // HUD read "Provincial Road" while climbing the stair.
  currentLevel() {
    let best = null;
    let bestDy = Infinity;
    for (const l of LEVELS) {
      const dy = this.player.footY - l.y;
      if (dy < -0.9 || dy > 4.4) continue;
      if (dy < bestDy) { bestDy = dy; best = l; }
    }
    return best;
  }

  // Publish a sound the Resident can hear. Radius is in metres and describes
  // the kind of noise: a drawer carries about 5 m, the generator through the
  // whole basement wing, a door about 6. The player is never told whether it
  // was heard; the uncertainty is the mechanic.
  noise(x, y, z, radius) {
    this.resident?.hear(x, y, z, radius);
  }

  enterHiding(spot) {
    if (!spot || this.hiding.mode !== 'out') return;
    const h = this.hiding;
    h.spot = spot;
    h.mode = 'entering';
    h.t = 0;
    h.peek = false;
    h.noise = 0;
    h.from = { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z };
    h.fromYaw = this.player.yaw;
    h.fromPitch = this.player.pitch;
    h.baseYaw = spot.insideYaw;
    this.player.enabled = false;
    this.player.vel.set(0, 0, 0);
    this.player.keys = Object.create(null);
    openHidingDoor(spot, true);
    this.audio.creak();
    this.noise(spot.inside.x, spot.eyeY, spot.inside.z, 5.5);
    this.say(spot.type === 'underbed' ? 'You get down and pull yourself under the bed.' : 'You step into the aparador and pull the door to.', 4200);
  }

  leaveHiding() {
    const h = this.hiding;
    if (!h.spot || h.mode === 'leaving' || h.mode === 'out') return;
    h.mode = 'leaving';
    h.t = 0;
    h.peek = false;
    h.from = { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z };
    h.fromYaw = this.player.yaw;
    h.fromPitch = this.player.pitch;
    openHidingDoor(h.spot, true);
    this.audio.creak();
    this.noise(h.spot.inside.x, h.spot.eyeY, h.spot.inside.z, 5.0);
  }

  togglePeek() {
    const h = this.hiding;
    if (h.mode !== 'hidden' && h.mode !== 'peek') return;
    h.peek = !h.peek;
    setHidingPeek(h.spot, h.peek);
    if (h.peek) {
      h.peekedAt = performance.now() / 1000;
      this.audio.creak();
      this.noise(h.spot.inside.x, h.spot.eyeY, h.spot.inside.z, 3.0);
      this.say('You ease the door open a hand\'s width.', 3000);
    } else {
      this.say('You let the door close again.', 2600);
    }
  }

  // Discovered in a hiding place: not a game over, and not a free pass. The
  // house takes the night back to the foyer; progress and inventory stay, so a
  // bad hide costs time and nerve rather than the run.
  discovered(spot) {
    if (this.hiding.mode === 'out') return;
    this.say('The door opens. It is looking straight at you.', 2600);
    this.caught(true);
    void spot;
  }

  // The Resident's blade landed. Exactly one trial goes, and the guards below
  // are what make that true: `caughtActive` covers the whole blackout, and
  // `invulnT` covers the seconds after the player is back on their feet, so a
  // second swing, a repeated collision frame or two overlapping hitboxes in
  // the same strike can never take two.
  hitByResident(kind = 'blade') {
    if (kind !== 'blade') return;
    this.caught(false);
  }

  caught(byDiscovery = false) {
    if (this.caughtActive || this.state.ended || this.state.gameOver) return;
    if (this.invulnT > 0) return;
    this.caughtActive = true;
    this.trialsLeft = Math.max(0, this.trialsLeft - 1);
    this.state.trials = this.trialsLeft;
    this.state.trialsLost += 1;
    this.updateTrialsHud();
    this.player.enabled = false;
    this.player.vel.set(0, 0, 0);
    // Whatever was in the hand goes down: the blackout owns the screen, and a
    // phone left raised would still be lit behind it when the player wakes.
    this.closePhone();
    if (this.hiding.spot) openHidingDoor(this.hiding.spot, true);
    this.audio.trialLost?.();
    const last = this.trialsLeft <= 0;
    this.say(byDiscovery ? 'It found you.' : 'It was faster than you.', 2200);
    const el = document.createElement('div');
    el.id = 'caught';
    el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:60;display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity .55s ease;pointer-events:none;';
    el.innerHTML = '<div style="font:400 13px/2 ui-monospace,monospace;letter-spacing:.34em;color:#8b8378;text-transform:uppercase">' +
      (byDiscovery ? 'it opens the door' : 'it reaches you') + '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    // The blackout is counted by the game loop, not by setTimeout. A timer is
    // throttled in a background tab, and the one thing that must never happen
    // is a player whose run is stuck face-down because they alt-tabbed during
    // a blackout.
    this.deathT = 1.9;
    this.deathLast = last;
    this._deathEl = el;
  }

  // Called from update() when the blackout runs out. One path for a lost
  // trial, one for the last one.
  resolveCaught() {
    const el = this._deathEl || document.getElementById('caught');
    this._deathEl = null;
    this.deathT = 0;
    if (this.deathLast) { this.gameOver(el); return; }
    // Back to the foyer, not to the road: the night continues, one trial
    // lighter, with everything already found still in hand.
    this.hiding.mode = 'out';
    this.hiding.spot = null;
    this.hiding.peek = false;
    for (const s of hiding.spots) openHidingDoor(s, false);
    this.player.enabled = true;
    this.player.teleport(0, 9.2, 0);
    this.player.yaw = Math.PI;
    this.player.pitch = 0;
    this.player.syncCamera();
    this.resident?.reset();
    this.caughtActive = false;
    // four seconds of grace: enough to get out of the foyer, and long enough
    // that a swing already in the air cannot take a second trial
    this.invulnT = 4.0;
    if (el) {
      el.style.opacity = '0';
      const gone = el;
      // removal may itself be delayed in a throttled tab; visibility is what
      // matters, and a hidden black sheet over the view is a bug
      gone.style.display = 'none';
      setTimeout(() => gone.remove(), 700);
    }
    this.say('You come to on the foyer floor, ' + this.trialsLeft + ' trial' +
      (this.trialsLeft === 1 ? '' : 's') + ' left. The clock has not moved.', 6500);
    this.objective('Get out. It is awake now.');
  }

  // Five trials gone. This is not the story's ending: it is a run that failed,
  // and it has to be restartable without rebuilding the world.
  gameOver(el) {
    if (this.state.gameOver) return;
    this.state.gameOver = true;
    this.state.trials = 0;
    this.player.enabled = false;
    this.player.vel.set(0, 0, 0);
    // The canvas owns the pointer for the whole night. If it keeps it, every
    // mouse event is delivered to the canvas at (0,0) and the two buttons on
    // this screen can never be pressed. Release it before the overlay exists.
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.caughtActive = false;
    el?.remove();
    this.audio.gameOver?.();
    const over = document.createElement('div');
    over.id = 'gameover';
    over.style.cssText = 'position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:1.2rem;text-align:center;' +
      'background:radial-gradient(ellipse at center, rgba(14,12,10,0.96) 0%, #000 78%);' +
      'opacity:0;transition:opacity .8s ease;';
    over.innerHTML = '<div style="font:400 clamp(1.6rem,4.4vw,2.6rem)/1.3 Georgia,serif;' +
      'letter-spacing:.30em;text-indent:.30em;color:#b9b0a0">THE HOUSE KEEPS YOU</div>' +
      '<div style="font:400 .78rem/2 ui-monospace,monospace;letter-spacing:.30em;' +
      'text-transform:uppercase;color:#6f6759">five trials spent · silid</div>' +
      '<div id="go-btns" style="display:flex;gap:1.1rem;margin-top:1.4rem">' +
      '<button id="go-restart" style="font:400 .8rem/1 Georgia,serif;letter-spacing:.24em;' +
      'text-indent:.24em;padding:.85rem 1.9rem;background:transparent;color:#d8d2c4;' +
      'border:1px solid #3a362d;cursor:pointer">WATCH AGAIN</button>' +
      '<button id="go-title" style="font:400 .8rem/1 Georgia,serif;letter-spacing:.24em;' +
      'text-indent:.24em;padding:.85rem 1.9rem;background:transparent;color:#8d8778;' +
      'border:1px solid #2a2620;cursor:pointer">BACK TO THE START</button></div>';
    document.body.appendChild(over);
    requestAnimationFrame(() => { over.style.opacity = '1'; });
    over.querySelector('#go-restart').onclick = () => this.restartRun();
    // The boot screen is the only title this build has, so going back to it is
    // a reload rather than a second code path that rebuilds the whole world.
    over.querySelector('#go-title').onclick = () => window.location.reload();
    this._gameOverEl = over;
  }

  // Restart in place. The same enemy, the same traps module, the same world:
  // nothing is rebuilt and nothing is duplicated. Trials go back to five, the
  // body returns to the front door, and the night's puzzle state is kept, so a
  // failed run costs the run rather than the progress already made.
  restartRun() {
    this._gameOverEl?.remove();
    this._gameOverEl = null;
    this.state.gameOver = false;
    this.state.trials = 5;
    this.state.trialsLost = 0;
    this.trialsLeft = 5;
    this.caughtActive = false;
    this.invulnT = 3.0;
    this.stumbleT = 0;
    this.traps?.clear();
    this.resident?.reset();
    this.hiding.mode = 'out';
    this.hiding.spot = null;
    this.hiding.peek = false;
    for (const s of hiding.spots) openHidingDoor(s, false);
    this.player.enabled = true;
    this.player.teleport(0, 11.6, 0);
    this.player.yaw = Math.PI;
    this.player.pitch = 0;
    this.player.syncCamera();
    // the pointer was released for the game-over screen; a click on the canvas
    // takes it back (the player's own click handler), so tell them once.
    this.say('Click the view to look around again.', 3000);
    this.updateTrialsHud();
    this.say('You wake at the front door. Five trials, and it is still awake.', 6000);
  }

  // Five marks, not a bar: the player has to be able to count what is left at
  // a glance while backing away from something.
  updateTrialsHud() {
    const el = $('trials');
    if (!el) return;
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += '<i class="' + (i < this.trialsLeft ? 'on' : '') + '"></i>';
    }
    el.innerHTML = html;
    el.setAttribute('aria-label', this.trialsLeft + ' of 5 trials left');
  }

  // A trap is allowed to hurt the player's pace and give them away. It is not
  // allowed to take a trial: losing one is the Resident's job, and a floorboard
  // that kills would make the corridor a lottery rather than a lesson.
  stumble(seconds = 1.0) {
    this.stumbleT = Math.max(this.stumbleT, seconds);
    this.player.pitch = Math.max(-1.3, this.player.pitch - 0.16);
  }

  onTrapTriggered(trap) {
    this.resident?.hear(trap.x, trap.y + 0.5, trap.z, 22);
  }

  // The camera move in, the concealed sway, the peek, the move out. The body
  // position follows the camera so the enemy's distance checks, the room HUD
  // and the level lookup all agree with what the player sees.
  updateHidingState(dt) {
    const h = this.hiding;
    if (h.mode === 'out' || !h.spot) return;
    const spot = h.spot;
    const ease = (t) => t * t * (3 - 2 * t);
    if (h.mode === 'entering' || h.mode === 'leaving') {
      h.t = Math.min(1, h.t + dt / (h.mode === 'entering' ? 0.72 : 0.62));
      const k = ease(h.t);
      const to = h.mode === 'entering'
        ? hidingEye(spot, false)
        : { x: spot.out.x, y: spot.outEyeY ?? spot.eyeY, z: spot.out.z };
      const toYaw = h.mode === 'entering' ? spot.insideYaw : spot.outYaw;
      this.player.pos.set(
        h.from.x + (to.x - h.from.x) * k,
        h.from.y + (to.y - h.from.y) * k,
        h.from.z + (to.z - h.from.z) * k,
      );
      this.player.yaw = h.fromYaw + (toYaw - h.fromYaw) * k;
      this.player.pitch = h.fromPitch * (1 - k);
      this.player.syncCamera();
      if (h.t >= 1) {
        if (h.mode === 'entering') {
          h.mode = 'hidden';
          this.player.footY = spot.levelY ?? this.player.footY;
          // The transition opens the door fully to admit the body; once inside
          // it closes to a real panel, not ajar.
          openHidingDoor(spot, false);
          this.player.pos.y = spot.eyeY;
          this.player.syncCamera();
        } else {
          h.mode = 'out';
          h.spot = null;
          this.player.enabled = true;
          this.player.teleport(spot.out.x, spot.out.z, spot.levelY ?? null);
          this.player.yaw = spot.outYaw;
          this.player.pitch = 0;
          this.player.syncCamera();
          openHidingDoor(spot, false);
        }
      }
      return;
    }

    // concealed: the body is fixed, the head can turn only so far
    const spotYaw = spot.insideYaw;
    const limit = h.peek ? spot.peekYaw : 0.22;
    const dy = ((this.player.yaw - spotYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.player.yaw = spotYaw + Math.max(-limit, Math.min(limit, dy));
    this.player.pitch = Math.max(-spot.pitchLimit, Math.min(spot.pitchLimit, this.player.pitch));
    const eye = hidingEye(spot, h.peek);
    this.player.pos.set(eye.x, spot.eyeY, eye.z);
    this.player.syncCamera();
    h.mode = h.peek ? 'peek' : 'hidden';
  }

  interact() {
    if (this.hiding.mode !== 'out') { this.togglePeek(); return; }
    // The climb owns the keyboard while it runs; a second E must not restart it.
    if (this.player.isClimbing) return;
    const target = this.nearestInteraction();
    // the broken car has its own interactions: door, hood, ignition, trunk
    if (target && this.opener && this.opener.interact(target)) return;
    if (!target) {
      // at the wheel E is the door, and the door only opens once stopped
      if (this.opener && !this.opener.walkPhase()) return;
      this.say('Nothing within reach.');
      return;
    }
    if (target.kind === 'inspect') {
      this.say(target.text || 'Dust and old wear soften the edges. It has not been moved in a long time.', 5200);
      return;
    }
    if (target.kind === 'door') {
      const door = target.door;
      if (this.isDoorLocked(door)) {
        if (!this.state.hasKey) {
          this.say('Locked. The brass key is upstairs, in the master bedroom.');
          return;
        }
        door.unlocked = true;
        this.audio.latch?.();
        this.say('The brass key turns. The lock gives.', 4500);
      }
      // A leaf shut while the player is standing in the opening leaves them
      // inside a collider with no way out: blocked() only tests the next step.
      // Ask them to step clear rather than trapping them in the frame.
      if (door.open) {
        const dcx = door.axis === 'x' ? door.at : door.c;
        const dcz = door.axis === 'x' ? door.c : door.at;
        const along = door.axis === 'x' ? Math.abs(this.player.pos.x - dcx) : Math.abs(this.player.pos.z - dcz);
        const across = door.axis === 'x' ? Math.abs(this.player.pos.z - dcz) : Math.abs(this.player.pos.x - dcx);
        if (along < door.w / 2 + 0.12 && across < 0.72
          && Math.abs(this.player.footY - door.y) < 1.4) {
          this.say('Step clear of the doorway first.');
          return;
        }
      }
      door.open = !door.open;
      door.target = door.open ? (door.swingSign ?? (door.axis === 'x' ? 1 : -1)) * 1.35 : 0;
      if (door.mesh2) door.target2 = -door.target;   // right leaf swings the other way
      door.collider.disabled = door.open;
      this.doorAnim.push(door);
      // handle and latch first, then the leaf; the entrance pair is heavier
      this.audio.latch?.();
      this.audio.creak(!!door.entrance);
      // the creak is audible as far as the Resident's ear carries; this is the
      // same perception channel footsteps use, and it ignores nothing magic
      this.noise?.(
        door.axis === 'x' ? door.at : door.c,
        door.y + 1.1,
        door.axis === 'x' ? door.c : door.at,
        door.entrance ? 5.5 : 3.2,
      );
      if (!door.open) {
        // the latch only bites when the leaf has finished travelling, so the
        // click is scheduled rather than played over the movement
        setTimeout(() => { if (!door.open) this.audio.latch?.(); }, 420);
        // A door shut in its face is the one deliberate thing the player can do
        // to the Resident. Short stun, no damage, and the door stays shut: it
        // buys a window to run, it is not a weapon.
        const r = this.resident;
        if (r && r.armed && r.state !== 'stunned') {
          const ddx = (door.axis === 'x' ? door.at : door.c) - r.pos.x;
          const ddz = (door.axis === 'x' ? door.c : door.at) - r.pos.z;
          if (Math.hypot(ddx, ddz) < 1.6 && Math.abs((door.y ?? 0) - r.footY) < 1.8) {
            r.stun(2.8);
            this.audio.thud?.();
            this.say('The door slams into it. It reels back into the dark.', 3200);
            return;
          }
        }
      }
            this.say(door.open ? 'The door gives.' : 'You close the door.');
      return;
    }
    // The exterior service ladder is a real interactable at its foot and at
    // its head (see main.js), so the prompt only appears when Del is actually
    // within reach of it. It was an invisible proximity test before: no
    // prompt, and pressing E near the wall started a climb.
    if (target.kind === 'ladder') {
      const pl = this.player;
      if (pl.isClimbing) return;
      pl.beginClimb({
        x: target.x, z: target.z,
        yStart: target.yStart, yEnd: target.yEnd,
        fromTop: target.dir === 'down',
        faceYaw: target.faceYaw,
        // x as well as z: without topX the dismount fell back to the ladder's
        // own centre line, directly in front of the service door, and the
        // player had to turn away from the door to find its prompt.
        topX: target.topX, topZ: target.topZ, topYaw: target.topYaw,
        bottomZ: target.bottomZ, bottomYaw: target.bottomYaw,
      });
      this.audio.creak?.();
      this.say(target.dir === 'down'
        ? 'You find the rungs with your feet and start down.'
        : 'The ladder is cold and steady. You start up.', 3200);
      return;
    }
    // A prop board registered by the dress pass carries its own type but no
    // trap object; only the trap system's wire/board can be disarmed. Without
    // this guard a look at the foyer board threw on `.trap`, which stopped the
    // whole update loop mid-frame and froze the game.
    if (target.kind === 'trap' && target.trap) {
      if (this.traps?.disarm(target.trap)) {
        this.audio.snip?.();
        this.say('You cut the wire. The tins come down in your hand.', 3800);
      }
      return;
    }
    // The armoire is a real cupboard before it is a hiding place: its leaves
    // open on their hinges, and only once they are open does the interior
    // offer somewhere to stand. One action, two visible stages.
    if (target.kind === 'hidedoor') {
      const spot = target.spot;
      const open = !spot.doors.every((d) => d.open);
      openHidingDoor(spot, open);
      this.audio.latch?.();
      this.audio.creak();
      this.noise?.(target.x, target.y, target.z, 3.0);
      this.say(open
        ? 'The aparador doors swing out. The rail inside is empty but for wire hangers.'
        : 'You fold the aparador doors shut. The latch catches.', 4200);
      return;
    }
    if (target.kind === 'cupboard') {
      const u = target.unit;
      const open = !u.doors.every((d) => d.open);
      for (const d of u.doors) {
        d.open = open;
        d.target = open ? d.openAngle : 0;
      }
      this.audio.latch?.();
      this.audio.creak();
      this.noise?.(target.x, target.y, target.z, 3.0);
      this.say(open
        ? (u.contents && !u.contents.taken
          ? 'The cupboard doors swing open. Something is still on the shelf.'
          : 'The cupboard doors swing open. Shelves, dust, and the smell of old paper.')
        : 'You close the cupboard.', 4200);
      return;
    }
    if (target.kind === 'hide') {
      this.enterHiding(target.spot);
      return;
    }
    if (target.kind === 'read') {
      this.inventory.add('note');
      this.say(target.text ?? 'The ink has run. Only the last line is legible: "do not run it after dark."', 6500);
      return;
    }
    if (target.kind === 'pickup') {
      this.inventory.add(target.id);
      if (target.id === 'fuel') this.state.hasFuel = true;
      if (target.id === 'fuse') this.state.hasFuse = true;
      if (target.id === 'key') this.state.hasKey = true;
      const mesh = this.pickupMeshes.get(target.id);
      if (mesh) mesh.visible = false;
      if (target.id === 'phone') this.takePhone();
      this.say('Taken: ' + target.name + '.');
      this.updateHud();
      return;
    }
    if (target.kind === 'drawer') {
      const drawer = target.drawer;
      if (!drawer.open) {
        toggleDrawer(target.unit, drawer);
        this.audio.creak();
        this.say('The drawer slides out on its runners.');
        return;
      }
      // an open drawer is searched before it is closed: one action per press,
      // in the order a person would actually do it
      const c = drawer.contents;
      if (c && !c.taken) {
        c.taken = true;
        c.mesh.visible = false;
        this.inventory.add(c.id);
        this.say('In the drawer: ' + c.name + '. ' + (c.text || ''), 7500);
        this.updateHud();
        return;
      }
      toggleDrawer(target.unit, drawer);
      this.say('You push the drawer shut.');
      return;
    }
    if (target.kind === 'fusebox') {
      const p = target.panel;
      if (!p) return;
      if (!p.open) {
        p.open = true;
        p.coverTarget = -1.45;
        this.state.fuseboxOpen = true;
        this.say('You lift the catch. The panel door swings open: six breakers, and an empty carrier for a cartridge fuse.', 6500);
        return;
      }
      if (!p.fuseInstalled && this.inventory.has('fuse')) {
        p.setFuse(true);
        this.state.fuseInstalled = true;
        this.say('You seat the ceramic fuse in the carrier. The clip takes it with a click.', 6000);
        return;
      }
      p.open = false;
      p.coverTarget = 0;
      this.state.fuseboxOpen = false;
      this.say('You close the panel.');
      return;
    }
    if (target.kind === 'cabinetItem') {
      const c = target.take();
      if (!c) return;
      this.inventory.add(c.id);
      this.say('Taken: ' + c.name + '. ' + (c.text || ''), 7000);
      this.updateHud();
      return;
    }
    if (target.kind === 'generator') {
      if (this.state.powered) {
        this.say('It is running. The lights are on.');
        return;
      }
      if (!this.state.hasFuel) {
        this.say('The tank is dry. There is a jerry can against the wall in here.');
        return;
      }
      if (!this.state.hasFuse && !this.state.fuseInstalled) {
        this.say('The fuse holder is empty. A ceramic fuse is on the workshop bench next door, and there is a panel on the east wall.');
        return;
      }
      this.powerOn();
      return;
    }
    if (target.kind === 'gate') {
      if (!this.state.powered) {
        this.say('The gate is on the house circuit. Nothing moves without power.');
        return;
      }
      this.openGate();
    }
    // The cistern yard's service door: the one thing between the tunnel and the
    // open forest. Opening it moves the leaf on its hinges AND takes the
    // collider out of the wall, so the way through is a fact of the world and
    // not a prompt that says it happened.
    if (target.kind === 'tunnelDoor') {
      const d = target.door;
      if (!d) return;
      d.open = !d.open;
      if (d.collider) d.collider.disabled = d.open;
      d.swing.rotation.y = d.open ? d.openAngle : 0;
      this.audio.creak();
      this.say(d.open
        ? 'The service door swings out into the yard on three strap hinges.'
        : 'You pull the door shut. The latch drops with a wet click.');
      return;
    }
  }

  // The locked room is the historical study on the third floor (FF3-10). Its
  // door is the one on the south walkway wall at x = 13; the key is the pickup
  // in the master bedroom. The old predicate named a door that does not exist
  // (F3 z=10, at=6), so every door in the house was in fact openable.
  isDoorLocked(door) {
    if (door.unlocked) return false;
    return door.level === 'F3' && door.axis === 'x'
      && Math.abs(door.at - 13) < 0.35 && Math.abs(door.c - 4) < 0.35;
  }

  powerOn() {
    this.state.powered = true;
    this.state.phase = 'escape';
    this.audio.startGenerator();
    this.audio.creak();
    for (const l of this.lights) l.intensity = 5.5;
    this.porch.intensity = 18;
    this.gateGlow.intensity = 10;
    this.say('The generator catches. Somewhere above, a relay closes.', 5200);
    this.objective('The gate has power. Get out.');
    this.updateHud();
  }

  openGate() {
    this.state.gateOpen = true;
    this.gateCollider.disabled = true;
    const t = { a: 0, b: 0 };
    const anim = () => {
      t.a += 0.02;
      if (this.gateLeft) this.gateLeft.rotation.y = -1.2 * Math.min(1, t.a);
      if (this.gateRight) this.gateRight.rotation.y = 1.2 * Math.min(1, t.a);
      if (t.a < 1) requestAnimationFrame(anim);
    };
    anim();
    this.audio.creak();
    this.say('The gate swings open. The road is still out there.', 6000);
    this.objective('You can leave.');
    setTimeout(() => this.end('You walk out through the gate. The house does not follow.\n\nSILID — end of the first night.'), 4200);
  }

  end(text) {
    this.state.ended = true;
    this.player.enabled = false;
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.remove('hidden');
    boot.innerHTML = '<div class="sub" style="max-width:34rem;white-space:pre-line;line-height:1.9">' + text + '</div>';
  }

  updateLights(dt) {
    this._lightTimer -= dt;
    if (this._lightTimer > 0) return;
    this._lightTimer = 0.22;
    const p = this.player.pos;
    const RANGE = 17;
    const near = [];
    for (const l of props.lights) {
      // a lamp above the ceiling does not light the room below it
      if (Math.abs(l.y - p.y) > 9) continue;
      const d = Math.hypot(l.x - p.x, l.y - p.y, l.z - p.z);
      if (d < RANGE) near.push({ l, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lightSlots.length; i++) {
      const slot = this.lightSlots[i];
      const c = near[i];
      if (!c) { slot.intensity = 0; continue; }
      slot.position.set(c.l.x, c.l.y, c.l.z);
      slot.color.setHex(c.l.color);
      slot.distance = Math.max(7, c.l.distance || 8);
      // fade at the edge of the range so a room does not pop into light
      const fade = Math.min(1, (RANGE - c.d) / 6);
      slot.intensity = Math.min(3.4, (c.l.intensity || 3) * 0.6) * fade;
    }
  }

  update(dt) {
    this.updateLights(dt);
    updateCabinets(dt);
    updateApparatus(dt);
    // doors swing; their colliders follow the open state
    for (const door of architecture.doors) {
      if (!door.collider) continue;
      const rest2 = door.mesh2 ? Math.abs(door.mesh2.rotation.y) : 0;
      if (!door.open && Math.abs(door.mesh.rotation.y) < 0.01 && rest2 < 0.01) continue;
      door.mesh.rotation.y += (door.target - door.mesh.rotation.y) * Math.min(1, dt * 6);
      if (door.mesh2) door.mesh2.rotation.y += (door.target2 - door.mesh2.rotation.y) * Math.min(1, dt * 6);
      door.collider.disabled = Math.abs(door.mesh.rotation.y) > 0.25;
    }

    const lvl = this.currentLevel();
    const room = lvl ? this.roomName(lvl) : null;
    // Below the plan the basement has rooms of its own, but the tunnel, cave,
    // vault, court and exit flight are not in architecture.rooms — they are a
    // second world under the first. Without this the HUD calls a rock passage
    // "Tuluyan Road", which is a lie the player can stand in and disprove.
    const under = room ? null : this.undergroundPlace();
    const roomText = room
      || (under ? under.room : (this.player.footY > 0.6 ? '' : 'Tuluyan Road'));
    if (roomText !== this.lastRoom) {
      this.lastRoom = roomText;
      const r = $('room'); if (r) r.textContent = roomText;
      const l = $('level');
      if (l) l.textContent = room ? lvl.name.toUpperCase() : (under ? under.level : 'PROVINCIAL ROAD');
    }

    // If the phone is in hand, keep it glued to the camera so it tracks the
    // player's view; if the model has not loaded yet, try again now that it
    // might have.
    this.phoneScreen?.update(dt);
    // The first time the player is standing in the foyer with a live board close
    // by, say the rule out loud. The board itself teaches it the hard way, but
    // this gives a player who is being careful a fair chance to learn the lesson
    // before they pay for it.
    if (!this.seenBoardHint && !this.pocketed && this.inventory.has('phone')) {
      const lvl = this.currentLevel();
      if (lvl && lvl.id === 'GF') {
        const near = this.traps?.liveBoards?.().some((b) =>
          Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z) < 3.0
        ) ?? false;
        if (near) {
          this.seenBoardHint = true;
          this.say('Some boards speak. Listen before you step.', 3600);
        }
      }
    }
    // The raise is an eased move of the actual model, so opening the phone is
    // the hand lifting it rather than a layer switching on.
    this._phoneRaise += (this._phoneRaiseTo - this._phoneRaise) * Math.min(1, dt * 9);
    if (this.inventory.has('phone')) {
      if (this.heldPhoneGroup) {
        poseHeldPhone(this.heldPhoneGroup, this._phoneRaise);
      } else if (!this.pocketed) {
        // The phone is in the inventory but not yet in hand (the GLB may still
        // be loading). Try again now that it might have landed.
        this.tryTakePhoneDeferred();
      }
      // while pocketed the held group is hidden on purpose; the pocket anchor
      // already follows the player because it is parented to the camera.
    }

    updateHiding(dt);
    this.updateHidingState(dt);
    // a lost trial runs its blackout on the game clock
    if (this.caughtActive && this.deathT > 0) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.resolveCaught();
    }
    this.resident?.update(dt, this);
    this.traps?.update(dt, this.player, this);
    this.invulnT = Math.max(0, this.invulnT - dt);
    if (this.stumbleT > 0) {
      // A body that has just gone down over a wire does not accelerate: the
      // velocity is clipped every frame for the length of the stumble.
      this.stumbleT = Math.max(0, this.stumbleT - dt);
      this.player.vel.multiplyScalar(0.22);
    }

    // Footsteps publish a noise radius. Crouching is silent, walking carries a
    // few metres, running across boards carries much further. The player is
    // never shown a meter for this.
    this.noiseT -= dt;
    const movingFast = Math.hypot(this.player.vel.x, this.player.vel.z);
    if (this.hiding.mode === 'out' && this.noiseT <= 0 && this.player.crouch < 0.5 && movingFast > 0.5) {
      const running = movingFast > 3.0;
      this.noise(this.player.pos.x, this.player.pos.y, this.player.pos.z, running ? 9.5 : 4.8);
      this.noiseT = running ? 0.46 : 1.15;
    }

    const t = this.phoneScreen?.isOpen ? null
      : (this.hiding.mode === 'out' ? this.nearestInteraction() : null);
    this.promptTarget = t;
    const prompt = $('prompt');
    if (prompt && this.phoneScreen?.isOpen) {
      prompt.classList.remove('on');
    } else if (prompt && this.hiding.mode !== 'out') {
      const peeked = this.hiding.mode === 'peek';
      prompt.innerHTML = '<b>E</b> ' + (peeked ? 'close the gap' : 'peek out') + ' &nbsp; <b>Q</b> leave';
      prompt.classList.add('on');
    } else if (prompt) {
      if (t) {
        let label = 'use';
        if (t.kind === 'door') label = t.door.open ? 'close the door' : (this.isDoorLocked(t.door) ? 'try the lock' : 'open the door');
        else if (t.kind === 'inspect') label = 'inspect ' + t.name;
        else if (t.kind === 'pickup') label = 'take ' + t.name;
        else if (t.kind === 'read') label = 'read ' + t.name;
        else if (t.kind === 'hidedoor') label = t.spot.doors.every((d) => d.open) ? 'close the aparador' : 'open the aparador';
        else if (t.kind === 'cupboard') label = t.unit.doors.every((d) => d.open) ? 'close the cupboard' : 'open the cupboard';
        else if (t.kind === 'generator') label = 'repair';
        else if (t.kind === 'drawer') {
          label = !t.drawer.open ? 'open drawer'
            : (t.drawer.contents && !t.drawer.contents.taken ? 'search' : 'close');
        }
        else if (t.kind === 'cabinetItem') label = 'take';
        else if (t.kind === 'fusebox') {
          const p = t.panel;
          label = !p?.open ? 'open the fuse panel'
            : (!p.fuseInstalled && this.inventory.has('fuse') ? 'fit the fuse' : 'close the panel');
        }
        else if (t.kind === 'gate') label = 'open';
        else if (t.kind === 'ladder') label = t.dir === 'down' ? 'climb down' : 'climb the ladder';
        else if (t.kind === 'tunnelDoor') label = t.door.open ? 'close the service door' : 'open the service door';
        else if (t.kind === 'trap') {
          // the dressing board is a trap-kind prop with no trap object behind it
          const kind = t.trap ? t.trap.type : t.type;
          if (kind === 'board') {
            label = t.trap && !t.trap.live ? 'step around it' : 'step over the board';
          } else if (kind === 'wire') label = 'cut the wire';
          else label = 'look at it';
        }
        else if (t.kind === 'hide') label = t.spot.type === 'underbed' ? 'get under' : 'hide inside';
        prompt.innerHTML = '<b>E</b> ' + label;
        prompt.classList.add('on');
      } else prompt.classList.remove('on');
    }

    this.audio.generatorDistance(this.player.pos.distanceTo(new THREE.Vector3(3, -2.3, -4.5)));

    // stats
    const stats = $('stats');
    if (stats && this._fps) {
      stats.textContent = `${Math.round(this._fps)} fps · ${this.renderer.info.render.calls} draws\n${(this.renderer.info.render.triangles / 1000).toFixed(0)}k tris`;
    }
  }

  // The underground route, named by the section the body is standing in. The
  // x bands follow underground.js's own build sections: A the brick tunnel
  // (16..33), B the cave (33..49), C the transition chamber, D the rising
  // vault (49..56.4), E the cistern court (56..62.2), F the exit flight
  // (61.8..67). It only answers below the ground floor, so nothing outdoors
  // or upstairs is ever relabelled by it.
  undergroundPlace() {
    const { x, z } = this.player.pos;
    const y = this.player.footY;
    if (y > 0.55) return null;
    if (x >= 61.4) return { room: 'Cistern Yard', level: 'EXIT FLIGHT' };
    if (x >= 55.9 && z > 2.0 && z < 10.0) return { room: 'Cistern Court', level: 'CISTERN YARD' };
    if (x >= 48.0) return { room: 'Vaulted Passage', level: 'UNDERGROUND' };
    if (x >= 33.0) return { room: 'Rock Passage', level: 'UNDERGROUND' };
    if (x >= 16.0) return { room: 'Service Tunnel', level: 'BASEMENT' };
    return null;
  }

  roomName(level) {
    if (!level) return null;
    const y = level.y;
    if (Math.abs(this.player.footY - y) > 1.2) return null;
    for (const r of architecture.rooms) {
      if (r.level !== level.id) continue;
      if (this.player.pos.x >= r.x0 && this.player.pos.x <= r.x1 &&
          this.player.pos.z >= r.z0 && this.player.pos.z <= r.z1) return r.name;
    }
    return null;
  }

  updateHud() {
    const bag = $('bag');
    if (!bag) return;
    const items = [];
    if (this.state.hasFuel) items.push('diesel');
    if (this.state.hasFuse) items.push('fuse');
    if (this.state.hasKey) items.push('brass key');
    if (this.inventory.has('note')) items.push('wet notebook');
    if (this.inventory.has('phone')) items.push('smart phone');
    bag.innerHTML = items.length ? items.map((i) => '+ ' + i).join('<br>') : '';
  }

  // The handoff out of the opening: the car is dead, the road is walked on
  // foot, and the house beyond the trees is the only light for kilometres.
  opening() {
    this.objective('THE ROAD — WALK. FIND HELP.');
    this.say('The engine is dead. Through the trees, one lit window — someone is home.', 6500);
  }

  // Phone pickup: materialise the loaded phone group in front of the player's
  // hand and hide the pickup marker that was standing in on the floor.
  // The phone can be taken either from the console or from the pocket; in both
  // cases the phone leaves where it was and reappears in the hand. The console
  // copy only exists while the phone has never been taken (see buildPhones).
  takePhone() {
    if (this.heldPhone && !this.pocketed) return;
    if (this.pocketed) {
      // Taking the phone out of the pocket: the phone is already in inventory;
      // we just materialise the held model again and hide the pocket anchor.
      if (!this._phoneInfo) {
        this.tryTakePhoneDeferred();
        return;
      }
      const { phone } = holdPhone(this._phoneInfo, { viewmodel: true });
      if (!phone) return;
      this.heldPhone = this._phoneInfo;
      this.heldPhoneGroup = phone;
      this.attachPhoneScreen(phone);
      poseHeldPhone(phone);
      this.player.camera.add(phone);
      this.pocketed = false;
      this._hidePocketAnchor();
      this.say('You take the phone out of your pocket. No sim. Screen is on.', 3200);
      return;
    }
    if (!this._phoneInfo) {
      this.tryTakePhoneDeferred();
      return;
    }
    const { phone, mark } = holdPhone(this._phoneInfo, { viewmodel: true });
    if (!phone) return;
    this.heldPhone = this._phoneInfo;
    this.heldPhoneGroup = phone;
    // The in-hand copy is a separate build of the same parts, so it needs the
    // display put on its glass too.
    this.attachPhoneScreen(phone);
    // The model leaves the console when the player picks it up: the world copy
    // and the pickup marker both go.
    if (this.worldPhone) this.worldPhone.visible = false;
    const floorMark = this.pickupMeshes.get('phone');
    if (floorMark) floorMark.visible = false;
    if (mark) mark.visible = false;
    poseHeldPhone(phone);
    this.player.camera.add(phone);
    this.say('You pick up the phone. No sim. Screen is on.', 3200);
  }

  // Put the live display on the glass. The asset ships with a photographic
  // home screen baked into PhoneGlass; this replaces it with the canvas the UI
  // draws into, so what the player reads is coming off the model's own surface.
  // Both copies get the same texture, so the one lying on the console and the
  // one in the hand agree.
  attachPhoneScreen(group) {
    if (!group || !this.phoneScreen) return;
    for (const m of group.userData?.materials || []) {
      if (!m?.name || m.name.indexOf('PhoneGlass') < 0) continue;
      m.map = this.phoneScreen.texture;
      m.emissiveMap = this.phoneScreen.texture;
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveIntensity = 1.0;
      m.color = new THREE.Color(0xffffff);
      m.roughness = 0.07;
      m.metalness = 0.0;
      m.needsUpdate = true;
    }
  }

  // If the loader has not yet resolved, the pickup still works; this is the
  // deferred path that builds the held model once the GLB is available.
  tryTakePhoneDeferred() {
    if (this.inventory.has('phone') && !this.heldPhone && this._phoneInfo) {
      this.takePhone();
    }
  }

  // ---- phone: the display that is actually on the model -----------------------

  // Pressing P is a physical act: the hand lifts the phone into the middle of
  // the view and the pointer is released so a cursor can touch the glass. There
  // is no HTML sitting over the scene; what the player presses is the screen of
  // the supplied GLB, and the tap is resolved against that mesh's UVs.
  openPhone() {
    const scr = this.phoneScreen;
    if (!scr) return;
    if (scr.isOpen) { this.closePhone(); return; }
    // If the phone is tucked away, one P takes it out and lifts it.
    if (this.pocketed) {
      this.takeOutPhone();
      // Now lift the freshly-held phone to the screen.
      scr.raise();
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.player.allowLock = false;
      this._phoneRaiseTo = 1;
      $('prompt')?.classList.remove('on');
      $('hud')?.classList.add('holding');
      this.say('P puts the phone away.', 2600);
      return;
    }
    if (!this.heldPhone && this.inventory.has('phone')) {
      this.takePhone();
      return;
    }
    scr.raise();
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.player.allowLock = false;
    this._phoneRaiseTo = 1;
    $('prompt')?.classList.remove('on');
    // the room's labels would otherwise be painted across the screen
    $('hud')?.classList.add('holding');
    this.say('P puts the phone away.', 2600);
  }

  closePhone() {
    const scr = this.phoneScreen;
    if (!scr) return;
    scr.lower();
    this.player.allowLock = true;
    this._phoneRaiseTo = 0;
    $('hud')?.classList.remove('holding');
  }

  // Put the phone away in the pocket. Only meaningful while the phone is held
  // lowered (screen not up): pocketing the raised phone would still leave the
  // lit screen floating in the dark, which is exactly what we are avoiding.
  pocketPhone() {
    if (!this.heldPhone || this.pocketed) return;
    if (this.phoneScreen?.isOpen) { this.closePhone(); }
    if (this.heldPhoneGroup) {
      this.heldPhoneGroup.visible = false;
      this.player.camera.remove(this.heldPhoneGroup);
      this.heldPhoneGroup = null;
    }
    this.heldPhone = null;
    this.pocketed = true;
    this._showPocketAnchor();
    this.say('You slip the phone into your pocket.', 2400);
  }

  // Raise the phone back out of the pocket. This is the same move as takePhone
  // when it is already pocketed (see takePhone), but is offered as its own key
  // so the phone can be tucked and retaken without going back to the console.
  takeOutPhone() {
    if (!this.pocketed) return;
    this.takePhone();
  }

  // Step over a floorboard the player has spotted. This is not a disarm — the
  // board stays where it is — but it lets the player rehearse the line before
  // committing to it, and it makes the board a decision rather than a surprise.
  // The step is a flat lateral hop of half a board width: small enough that it
  // is obviously a sidestep, not a jog, and short enough that it cannot be used
  // to cross the whole room.
  stepBoard(trap) {
    if (!trap || !trap.live || trap.type !== 'board') return;
    const d = Math.hypot(this.player.pos.x - trap.x, this.player.pos.z - trap.z);
    if (d > 1.8) return;
    // decide which side of the board to step to by the player's facing
    const fwd = this.player.forward();
    const cross = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
    const target = new THREE.Vector3().copy(this.player.pos).add(cross.clone().multiplyScalar(0.65));
    if (this.player.blocked(target.x, target.z)) {
      this.say('No room there. Step the other way.', 2600);
      return;
    }
    this.player.pos.x = target.x;
    this.player.pos.z = target.z;
    this.player.footY = floorHeightAt(target.x, target.z, this.player.footY) ?? this.player.footY;
    this.syncCamera();
    this.say('You step over the board.', 1800);
  }

  // A small anchor drawn at the player's hip when the phone is tucked away.
  _showPocketAnchor() {
    if (this.pocketAnchor) return;
    const a = pocketAnchor();
    a.position.set(0.11, -0.52, 0);
    a.rotation.order = 'YXZ';
    a.rotation.set(-0.18, 0, 0.06);
    this.player.camera.add(a);
    this.pocketAnchor = a;
  }

  _hidePocketAnchor() {
    if (!this.pocketAnchor) return;
    this.player.camera.remove(this.pocketAnchor);
    this.pocketAnchor = null;
  }

  // A pointer position in screen-canvas pixels, obtained from the real glass
  // geometry: the ray hits the mesh, and the hit UV is the pixel. Points that
  // miss the phone return null, so the player can never press a key they are
  // not pointing at.
  phonePointFromEvent(e) {
    const group = this.heldPhoneGroup;
    if (!group || !this.phoneScreen?.isOpen) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this._phoneNdc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this._phoneRay.setFromCamera(this._phoneNdc, this.player.camera);
    for (const child of group.children) {
      if (!child.isMesh || !child.geometry) continue;
      if (!(child.material?.name || '').includes('PhoneGlass')) continue;
      const hit = this._phoneRay.intersectObject(child, false)[0];
      if (!hit) return null;
      if (hit.uv) return PhoneScreen.pixelFromUV(hit.uv.x, hit.uv.y);
      // Fallback for a mesh without UVs: project the hit into the glass box.
      child.geometry.computeBoundingBox();
      const bb = child.geometry.boundingBox;
      const local = hit.point.clone();
      group.worldToLocal(local);
      const u = (local.x - bb.min.x) / Math.max(1e-6, bb.max.x - bb.min.x);
      const v = (local.y - bb.min.y) / Math.max(1e-6, bb.max.y - bb.min.y);
      return PhoneScreen.pixelFromUV(u, v);
    }
    return null;
  }

  onPhoneMove(e) {
    if (!this.phoneScreen?.isOpen) return;
    const p = this.phonePointFromEvent(e);
    if (p) this.phoneScreen.hover(p.x, p.y);
    else this.phoneScreen.hover(-1, -1);
  }

  onPhoneDown(e) {
    if (!this.phoneScreen?.isOpen) return;
    const p = this.phonePointFromEvent(e);
    if (p) this.phoneScreen.tap(p.x, p.y);
  }
}

export function inspectPhone(game) {
  if (!game.heldPhoneGroup) {
    if (game.inventory.has('phone')) {
      game.tryTakePhoneDeferred();
      game.say('No signal. Battery nearly dead. Tap P to open.', 3200);
      return;
    }
    game.say('No signal. Battery nearly dead. Tap P to open.', 3200);
    return;
  }
  game.say('The screen is on. Battery at 78%. Tap P to hold it up.', 3200);
}
