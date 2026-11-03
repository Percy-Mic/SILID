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
import { architecture } from '../world/architecture.js';
import { props } from '../world/props.js';
import { LEVELS } from '../world/plan.js';
import { loadPhone, phonePickupMark, holdPhone } from '../world/phone.js';

const $ = (id) => document.getElementById(id);

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
      hasKey: false,
      powered: false,
      gateOpen: false,
      ended: false,
    };
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
    this.buildStoryProps();
    this.buildGate();
    this.buildLights();
    this.buildPhones();
    this._loadPhoneAsync();
    this.bind();
    this.updateHud();
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
    const mark = phonePickupMark();
    mark.position.set(phone.x, phone.y - 0.02, phone.z);
    this.scene.add(mark);
    this.pickupMeshes.set('phone', mark);
  }

  async _loadPhoneAsync() {
    try {
      this._phoneInfo = await loadPhone(() => {});
    } catch (err) {
      console.warn('[game] phone did not load:', err?.message || err);
      this._phoneInfo = null;
      return;
    }
    if (this.inventory.has('phone') && !this.heldPhone && this._phoneInfo) {
      this.takePhone();
    }
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
      if (this.state.ended) return;
      if (e.code === 'KeyE') this.interact();
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
    });
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
    let bestScore = 0;
    const consider = (o, dist, dot, bonus = 0) => {
      if (dist > 3.0 || dot < 0.4) return;
      const score = dot * 2 - dist * 0.2 + bonus;
      if (score > bestScore) { bestScore = score; best = o; }
    };
    for (const it of props.interactables) {
      if (it.kind === 'pickup' && this.inventory.has(it.id)) continue;
      if (it.kind === 'read' && this.inventory.has('note')) continue;
      const dx = it.x - eye.x, dy = it.y - eye.y, dz = it.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      // aim horizontally: a tin of diesel at knee height is still "in front of
      // you" when you are looking at the generator six feet away
      const dh = Math.hypot(dx, dz);
      if (Math.abs(dy) > 2.0) continue;
      const dot = dh > 0.001 ? (dx * fwd.x + dz * fwd.z) / (dh * Math.hypot(fwd.x, fwd.z) || 1) : 1;
      const bonus = it.kind === 'pickup' ? 0.9 : it.kind === 'read' ? 0.4 : 0;
      consider(it, d, dot, bonus);
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
    if (this.opener) {
      const t = this.opener.nearest();
      if (t) consider(t, t.dist, t.dot, 0.6);
    }
    return best;
  }

  currentLevel() {
    let best = null;
    for (const l of LEVELS) {
      if (Math.abs(l.y - this.player.footY) < 1.5) {
        if (!best || Math.abs(l.y - this.player.footY) < Math.abs(best.y - this.player.footY)) best = l;
      }
    }
    return best;
  }

  interact() {
    const target = this.nearestInteraction();
    // the broken car has its own interactions: door, hood, ignition, trunk
    if (target && this.opener && this.opener.interact(target)) return;
    if (!target) {
      // at the wheel E is the door, and the door only opens once stopped
      if (this.opener && !this.opener.walkPhase()) return;
      this.say('Nothing within reach.');
      return;
    }
    if (target.kind === 'door') {
      const door = target.door;
      const locked = this.isDoorLocked(door);
      if (locked && !this.state.hasKey) {
        this.say('Locked. The key is not on this floor.');
        return;
      }
      door.open = !door.open;
      door.target = door.open ? (door.axis === 'x' ? 1.35 : -1.35) : 0;
      door.collider.disabled = door.open;
      this.doorAnim.push(door);
      this.audio.creak();
      this.say(door.open ? 'The door gives.' : 'You close the door.');
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
    if (target.kind === 'generator') {
      if (this.state.powered) {
        this.say('It is running. The lights are on.');
        return;
      }
      if (!this.state.hasFuel) {
        this.say('The tank is dry. There is a jerry can against the wall in here.');
        return;
      }
      if (!this.state.hasFuse) {
        this.say('The fuse holder is empty. A ceramic fuse is on the workshop bench next door.');
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
  }

  isDoorLocked(door) {
    return door.level === 'F3' && door.axis === 'z' && Math.abs(door.c - 10) < 0.1 && Math.abs(door.at - 6) < 0.1;
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
    // doors swing; their colliders follow the open state
    for (const door of architecture.doors) {
      if (!door.collider) continue;
      if (!door.open && Math.abs(door.mesh.rotation.y - 0) < 0.01) continue;
      door.mesh.rotation.y += (door.target - door.mesh.rotation.y) * Math.min(1, dt * 6);
      door.collider.disabled = Math.abs(door.mesh.rotation.y) > 0.25;
    }

    const lvl = this.currentLevel();
    const room = lvl ? this.roomName(lvl) : null;
    const roomText = room || (this.player.footY > 0.6 ? '' : 'Tuluyan Road');
    if (roomText !== this.lastRoom) {
      this.lastRoom = roomText;
      const r = $('room'); if (r) r.textContent = roomText;
      const l = $('level'); if (l) l.textContent = room ? lvl.name.toUpperCase() : 'PROVINCIAL ROAD';
    }

    // If the phone is in hand, keep it glued to the camera so it tracks the
    // player's view; if the model has not loaded yet, try again now that it
    // might have.
    if (this.inventory.has('phone') && this.heldPhoneGroup) {
      this.heldPhoneGroup.position.set(0.18, -0.02, -0.55);
      this.heldPhoneGroup.rotation.set(0, 0, 0);
    } else if (this.inventory.has('phone') && !this.heldPhoneGroup) {
      this.tryTakePhoneDeferred();
    }

    const t = this.nearestInteraction();
    this.promptTarget = t;
    const prompt = $('prompt');
    if (prompt) {
      if (t) {
        let label = 'look';
        if (t.kind === 'door') label = t.door.open ? 'close' : (this.isDoorLocked(t.door) ? 'try the lock' : 'open');
        else if (t.kind === 'pickup') label = 'take';
        else if (t.kind === 'read') label = 'read';
        else if (t.kind === 'generator') label = 'repair';
        else if (t.kind === 'gate') label = 'open';
        prompt.innerHTML = '<b>E</b>' + (t.name ?? label);
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
  takePhone() {
    console.log('[game] takePhone() called, heldPhone:', !!this.heldPhone, '_phoneInfo:', !!this._phoneInfo);
    if (this.heldPhone) return;
    if (!this._phoneInfo) {
      console.log('[game] takePhone() - no _phoneInfo, deferring');
      this.tryTakePhoneDeferred();
      return;
    }
    const { phone, mark } = holdPhone(this._phoneInfo, { onProgress: () => {} });
    console.log('[game] takePhone() - holdPhone returned:', !!phone, 'mark:', !!mark);
    if (!phone) return;
    this.heldPhone = this._phoneInfo;
    this.heldPhoneGroup = phone;
    // Hide the floor marker we built in buildPhones().
    const floorMark = this.pickupMeshes.get('phone');
    if (floorMark) floorMark.visible = false;
    if (mark) mark.visible = false;
    // Hold the phone slightly forward and up from the camera, screen facing
    // the player's view direction.
    phone.position.set(0.18, -0.02, -0.55);
    phone.rotation.set(0, 0, 0);
    this.player.camera.add(phone);
    console.log('[game] takePhone() - phone added to camera, phone children:', phone.children.length);
    console.log('[game] phone scale:', phone.scale.x.toFixed(3), phone.scale.y.toFixed(3), phone.scale.z.toFixed(3));
    console.log('[game] phone world pos:', phone.getWorldPosition(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(', '));
    this.say('You pick up the phone. No sim. Screen is on.', 3200);
  }

  // If the loader has not yet resolved, the pickup still works; this is the
  // deferred path that builds the held model once the GLB is available.
  tryTakePhoneDeferred() {
    if (this.inventory.has('phone') && !this.heldPhone && this._phoneInfo) {
      this.takePhone();
    }
  }

  // ---- phone UI wiring -------------------------------------------------------

  openPhone() {
    if (!this._phoneOverlay) {
      this._phoneOverlay = buildPhoneOverlay();
      document.body.appendChild(this._phoneOverlay);
      this._phoneClock = startClock();
    }
    const overlay = this._phoneOverlay;
    if (!overlay) return;

    // If the phone is locked, show the lock screen.
    if (!appState.unlocked) {
      showLockScreen();
      overlay.style.display = 'block';
      overlay.style.opacity = '1';
      return;
    }

    // Phone is unlocked: show the home screen.
    appState.activeApp = null;
    showHome();
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
  }

  closePhone() {
    if (!this._phoneOverlay) return;
    this._phoneOverlay.style.opacity = '0';
    setTimeout(() => {
      if (this._phoneOverlay) this._phoneOverlay.style.display = 'none';
    }, 180);
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
  game.say('The screen is on. Battery at 3%. Tap P to open.', 3200);
}

// ---- inline phone app (ASCII screen overlay + functional phone app for the held phone) --

const PHONE_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const PHONE_PAD = 14;
const PHONE_BORDER = 3;
const PHONE_BG = 'rgba(8,10,14,0.92)';
const LOCK_BG = 'rgba(6,8,12,0.96)';
const KEY_BG = 'rgba(40,46,58,0.95)';
const KEY_PRESS = 'rgba(72,90,120,0.98)';
const TINT_HEX = 0x0a0c10;
const SAY_HEX = 0x0a0c10;
const BATTERY_MAX = 100;
const CLOCK_MS_PER_TICK = 3200;

function $phone(sel, root) {
  return (root && root.querySelector(sel)) || document.querySelector(sel);
}

function phoneEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.style.fontFamily = PHONE_FONT;
  el.style.color = '#cfe0ee';
  el.style.boxSizing = 'border-box';
  return el;
}

// The overlay is a single persistent DOM tree. The app layer swaps in and out
// so the same pointer grid can drive the lock screen, the home screen, and
// each app without rebuilding the widgets every transition.
function buildPhoneOverlay() {
  const root = document.createElement('div');
  root.id = 'phoneOverlay';
  root.style.position = 'fixed';
  root.style.bottom = '3vh';
  root.style.left = '3vw';
  root.style.right = '3vw';
  root.style.maxWidth = 'min(460px, 70vw)';
  root.style.maxHeight = 'min(780px, 88vh)';
  root.style.background = PHONE_BG;
  root.style.border = `${PHONE_BORDER}px solid #2a313c`;
  root.style.borderRadius = '34px';
  root.style.boxShadow = '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset';
  root.style.backdropFilter = 'blur(4px)';
  root.style.color = '#cfe0ee';
  root.style.fontFamily = PHONE_FONT;
  root.style.overflow = 'hidden';
  root.style.userSelect = 'none';
  root.style.display = 'none';
  root.style.transition = 'opacity 0.18s ease';
  root.style.zIndex = '1000';
  root.style.pointerEvents = 'auto';
  root.style.touchAction = 'auto';
  root.style.webkitBackdropFilter = 'blur(4px)';

  const bar = phoneEl('div', 'phoneBar');
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  bar.style.justifyContent = 'space-between';
  bar.style.padding = `${PHONE_PAD}px ${PHONE_PAD + 2}px`;
  bar.style.borderBottom = '1px solid #222a35';
  bar.style.background = 'linear-gradient(180deg, rgba(18,22,30,0.85) 0%, rgba(8,10,14,0.6) 100%)';
  bar.style.minHeight = '44px';

  const lockLabel = phoneEl('div', 'phoneLockLabel');
  lockLabel.style.fontSize = '11px';
  lockLabel.style.letterSpacing = '0.18em';
  lockLabel.style.color = '#7a93ad';
  lockLabel.style.fontWeight = '600';
  lockLabel.style.textTransform = 'uppercase';
  lockLabel.textContent = 'Locked';

  const timeEl = phoneEl('div', 'phoneTime');
  timeEl.style.fontSize = '15px';
  timeEl.style.fontWeight = '600';
  timeEl.style.color = '#9bb0c6';
  timeEl.textContent = '03:12';

  bar.append(lockLabel, timeEl);

  const body = document.createElement('div');
  body.id = 'phoneBody';
  body.style.padding = `${PHONE_PAD}px ${PHONE_PAD + 2}px ${PHONE_PAD + 6}px`;
  body.style.overflowY = 'auto';
  body.style.overflowX = 'hidden';
  body.style.height = 'calc(100% - 44px)';
  body.style.scrollbarWidth = 'thin';
  body.style.scrollbarColor = '#2a313c transparent';
  body.style.background = 'transparent';
  body.style.scrollBehavior = 'smooth';

  const appLayer = document.createElement('div');
  appLayer.id = 'phoneAppLayer';
  appLayer.style.minHeight = '200px';

  const nav = document.createElement('div');
  nav.id = 'phoneNav';
  nav.style.display = 'none';
  nav.style.flexDirection = 'column';
  nav.style.gap = '6px';
  nav.style.padding = `${PHONE_PAD - 2}px ${PHONE_PAD}px`;
  nav.style.background = 'rgba(8,10,14,0.55)';
  nav.style.borderTop = '1px solid #222a35';
  nav.style.borderBottom = '1px solid #222a35';
  nav.style.minHeight = '84px';
  nav.style.borderRadius = '0 0 17px 17px';
  nav.style.borderRadius = '0 0 17px 17px';

  const dock = document.createElement('div');
  dock.id = 'phoneDock';
  dock.style.display = 'flex';
  dock.style.alignItems = 'center';
  dock.style.justifyContent = 'center';
  dock.style.gap = '10px';
  dock.style.padding = `${PHONE_PAD}px ${PHONE_PAD + 2}px ${PHONE_PAD + 4}px`;
  dock.style.background = 'rgba(8,10,14,0.55)';
  dock.style.borderTop = '1px solid #222a35';
  dock.style.minHeight = '80px';
  dock.style.borderRadius = '17px 17px 0 0';
  dock.style.borderRadius = '17px 17px 0 0';

  root.append(bar, body, nav, dock);
  body.append(appLayer);
  return root;
}

// A single rendered cell inside the keyboard grid. We keep a small pool so
// focus and press states can be updated without reconstructing the DOM every
// key tap.
function phoneKey(label, cls = '') {
  const k = phoneEl('button', 'phoneKey ' + cls);
  k.style.display = 'flex';
  k.style.alignItems = 'center';
  k.style.justifyContent = 'center';
  k.style.width = '100%';
  k.style.height = '42px';
  k.style.background = KEY_BG;
  k.style.border = '1px solid #1b222b';
  k.style.borderRadius = '8px';
  k.style.color = '#cfe0ee';
  k.style.fontSize = '15px';
  k.style.fontWeight = '500';
  k.style.fontFamily = PHONE_FONT;
  k.style.cursor = 'pointer';
  k.style.outline = 'none';
  k.style.transition = 'background 0.06s ease, transform 0.06s ease, box-shadow 0.06s ease';
  k.style.padding = '0 2px';
  k.textContent = label;
  k.dataset.key = label.toLowerCase();
  return k;
}

function phoneKeyRow(labels) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '6px';
  row.style.width = '100%';
  row.style.flexWrap = 'wrap';
  for (const label of labels) {
    const span = document.createElement('span');
    span.style.flex = '1 1 0';
    span.style.minWidth = '0';
    span.style.textAlign = 'center';
    span.style.fontSize = '13px';
    span.style.color = '#9bb0c6';
    span.style.fontWeight = '500';
    span.style.padding = '4px 2px';
    span.style.background = KEY_BG;
    span.style.borderRadius = '7px';
    span.style.border = '1px solid #1b222b';
    span.textContent = label;
    span.dataset.key = label.toLowerCase();
    row.append(span);
  }
  return row;
}

function phoneLabelLine(label, value, muted = false) {
  const row = phoneEl('div', 'phoneLine');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.alignItems = 'baseline';
  row.style.gap = '12px';
  row.style.padding = '5px 0';
  row.style.borderBottom = '1px solid #1a212b';
  const l = phoneEl('span', 'phoneLineLabel');
  l.textContent = label;
  l.style.fontSize = '13px';
  l.style.color = muted ? '#6f849d' : '#8aa0b6';
  l.style.fontWeight = '500';
  const v = phoneEl('span', 'phoneLineValue');
  v.textContent = value;
  v.style.fontSize = '14px';
  v.style.color = muted ? '#8296ad' : '#e4eaf2';
  v.style.fontWeight = '600';
  row.append(l, v);
  return row;
}

function phoneSection(title) {
  const h = phoneEl('div', 'phoneSection');
  h.style.padding = '10px 0 6px';
  h.style.borderBottom = '1px solid #222a35';
  h.style.marginBottom = '6px';
  h.style.fontSize = '11px';
  h.style.letterSpacing = '0.16em';
  h.style.color = '#72859d';
  h.style.fontWeight = '700';
  h.textContent = title;
  return h;
}

function phoneAppCard(title, subtitle, open) {
  const card = phoneEl('div', 'phoneAppCard');
  card.style.background = key_bg();
  card.style.border = '1px solid #202833';
  card.style.borderRadius = '10px';
  card.style.padding = '10px 12px';
  card.style.cursor = 'pointer';
  card.style.transition = 'background 0.1s ease, transform 0.08s ease';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '2px';
  card.style.minWidth = '0';
  card.style.overflow = 'hidden';
  const t = phoneEl('div', 'phoneAppCardTitle');
  t.textContent = title;
  t.style.fontSize = '14px';
  t.style.fontWeight = '600';
  t.style.color = '#e4eaf2';
  const s = phoneEl('div', 'phoneAppCardSub');
  s.textContent = subtitle;
  s.style.fontSize = '11px';
  s.style.color = '#7c8fa3';
  s.style.letterSpacing = '0.02em';
  card.append(t, s);
  card.addEventListener('click', () => { if (open) open(card) });
  card.addEventListener('mousedown', (e) => e.preventDefault());
  return card;
}

function phoneAppGrid(cards, cls = '') {
  const grid = document.createElement('div');
  grid.className = cls;
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(128px, 1fr))';
  grid.style.gap = '10px';
  grid.style.padding = '2px 0';
  for (const c of cards) grid.append(c);
  return grid;
}

function phoneAppList(items, cls = '') {
  const list = document.createElement('div');
  list.className = cls;
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  list.style.padding = '2px 0';
  for (const item of items) list.append(item);
  return list;
}

function phoneAppListItem(title, subtitle, action) {
  const item = phoneEl('div', 'phoneAppListItem');
  item.style.background = key_bg();
  item.style.border = '1px solid #202833';
  item.style.borderRadius = '10px';
  item.style.padding = '10px 12px';
  item.style.cursor = 'pointer';
  item.style.display = 'flex';
  item.style.flexDirection = 'column';
  item.style.gap = '2px';
  item.style.transition = 'background 0.1s ease';
  const t = phoneEl('div', 'phoneAppListItemTitle');
  t.textContent = title;
  t.style.fontSize = '14px';
  t.style.fontWeight = '600';
  t.style.color = '#e4eaf2';
  const s = phoneEl('div', 'phoneAppListItemSub');
  s.textContent = subtitle;
  s.style.fontSize = '11px';
  s.style.color = '#7c8fa3';
  item.append(t, s);
  item.addEventListener('click', () => action(item));
  item.addEventListener('mousedown', (e) => e.preventDefault());
  return item;
}

function phoneMsg(text, cls = '') {
  const m = phoneEl('div', cls);
  m.textContent = text;
  m.style.fontSize = '13px';
  m.style.color = '#b7c6d6';
  m.style.lineHeight = '1.5';
  m.style.padding = '4px 0';
  m.style.wordBreak = 'break-word';
  return m;
}

function phoneSectionBlock(section, body) {
  const block = document.createElement('div');
  block.style.borderBottom = '1px solid #222a35';
  block.style.paddingBottom = '8px';
  block.style.marginBottom = '6px';
  block.append(section, body);
  return block;
}

function phoneNow() {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

function key_bg() {
  return KEY_BG;
}

function startClock() {
  const el = $phone('#phoneTime');
  if (!el) return;
  // The world story time is 03:12 when the phone opens. Advance the phone
  // clock reliably from there rather than from the real wall clock, so the
  // lock screen, home, and app copy all agree on the same hour.
  let t = 3 * 60 + 12;
  const up = () => {
    t += 1;
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  up();
  return setInterval(up, CLOCK_MS_PER_TICK);
}

// ---- phone app state -------------------------------------------------------

const appState = {
  unlocked: false,
  passcode: '6294',
  attempts: 0,
  battery: 78,
  screenOn: true,
  homeVisible: true,
  activeApp: null,
  apps: new Map(),
  navOpen: false,
  tileRows: 0,
  touched: new Set(),
  functional: false,
};// ---- phone apps: lock screen, home, messenger, calendar, settings, game --


// ---- lock screen -----------------------------------------------------------

function showLockScreen() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';

  // Lock screen background
  const bg = phoneEl('div', 'lockScreenBg');
  bg.style.width = '100%';
  bg.style.minHeight = '200px';
  bg.style.background = LOCK_BG;
  bg.style.borderRadius = '12px';
  bg.style.display = 'flex';
  bg.style.flexDirection = 'column';
  bg.style.alignItems = 'center';
  bg.style.justifyContent = 'center';
  bg.style.padding = '20px';
  bg.style.marginBottom = '12px';

  // Phone icon
  const icon = phoneEl('div', 'lockScreenIcon');
  icon.textContent = '📱';
  icon.style.fontSize = '48px';
  icon.style.marginBottom = '16px';
  icon.style.opacity = '0.8';

  // Time display (already updated by startClock)
  const timeEl = $phone('#phoneTime');
  const timeDisplay = phoneEl('div', 'lockScreenTime');
  timeDisplay.textContent = timeEl ? timeEl.textContent : '03:12';
  timeDisplay.style.fontSize = '42px';
  timeDisplay.style.fontWeight = '300';
  timeDisplay.style.color = '#e4eaf2';
  timeDisplay.style.marginBottom = '8px';
  timeDisplay.style.letterSpacing = '0.02em';

  // Date display
  const dateDisplay = phoneEl('div', 'lockScreenDate');
  dateDisplay.textContent = 'Monday, March 14';
  dateDisplay.style.fontSize = '13px';
  dateDisplay.style.color = '#7c8fa3';
  dateDisplay.style.marginBottom = '24px';
  dateDisplay.style.letterSpacing = '0.05em';

  // Battery indicator
  const batteryRow = phoneEl('div', 'lockScreenBattery');
  batteryRow.style.display = 'flex';
  batteryRow.style.alignItems = 'center';
  batteryRow.style.gap = '6px';
  batteryRow.style.color = appState.battery > 20 ? '#9bb0c6' : '#d94a4a';
  batteryRow.style.fontSize = '12px';
  
  const batteryIcon = phoneEl('div', 'lockScreenBatteryIcon');
  batteryIcon.style.width = '20px';
  batteryIcon.style.height = '10px';
  batteryIcon.style.border = '1px solid #5a6a7a';
  batteryIcon.style.borderRadius = '2px';
  batteryIcon.style.position = 'relative';
  
  const batteryCharge = phoneEl('div', 'lockScreenBatteryCharge');
  batteryCharge.style.height = '100%';
  batteryCharge.style.width = `${appState.battery}%`;
  batteryCharge.style.background = appState.battery > 20 ? '#4a90d9' : '#d94a4a';
  batteryCharge.style.borderRadius = '1px';
  batteryCharge.style.transition = 'width 0.3s ease, background 0.3s ease';
  
  const batteryText = phoneEl('span', 'lockScreenBatteryText');
  batteryText.textContent = `${appState.battery}%`;
  
  batteryIcon.append(batteryCharge);
  batteryRow.append(batteryIcon, batteryText);

  bg.append(icon, timeDisplay, dateDisplay, batteryRow);
  layer.append(bg);

  // Passcode input
  const inputArea = phoneEl('div', 'lockScreenInputArea');
  inputArea.style.display = 'flex';
  inputArea.style.flexDirection = 'column';
  inputArea.style.alignItems = 'center';
  inputArea.style.gap = '12px';
  inputArea.style.padding = '16px 0';
  
  const prompt = phoneEl('div', 'lockScreenPrompt');
  prompt.textContent = 'Enter passcode to unlock';
  prompt.style.fontSize = '13px';
  prompt.style.color = '#9bb0c6';
  prompt.style.marginBottom = '8px';
  prompt.style.letterSpacing = '0.05em';
  
  const dots = phoneEl('div', 'lockScreenDots');
  dots.style.display = 'flex';
  dots.style.gap = '12px';
  dots.style.marginBottom = '16px';
  
  for (let i = 0; i < 4; i++) {
    const dot = phoneEl('div', 'lockScreenDot');
    dot.style.width = '12px';
    dot.style.height = '12px';
    dot.style.borderRadius = '50%';
    dot.style.border = '2px solid #5a6a7a';
    dot.style.background = 'transparent';
    dot.style.transition = 'background 0.15s ease, border-color 0.15s ease';
    dot.dataset.index = i;
    dots.append(dot);
  }
  
  const numpad = phoneEl('div', 'lockScreenNumpad');
  numpad.style.display = 'grid';
  numpad.style.gridTemplateColumns = 'repeat(3, 1fr)';
  numpad.style.gap = '10px';
  numpad.style.width = '200px';
  
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  
  for (const key of keys) {
    if (!key) {
      const empty = phoneEl('div', 'lockScreenEmpty');
      empty.style.background = 'transparent';
      numpad.append(empty);
      continue;
    }
    
    const btn = phoneEl('button', 'lockScreenKey');
    btn.textContent = key;
    btn.style.width = '100%';
    btn.style.height = '48px';
    btn.style.background = key_bg();
    btn.style.border = '1px solid #202833';
    btn.style.borderRadius = '10px';
    btn.style.color = '#e4eaf2';
    btn.style.fontSize = '18px';
    btn.style.fontWeight = '500';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.transition = 'background 0.1s ease, transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease';
    
    if (key === '⌫') {
      btn.style.fontSize = '16px';
      btn.addEventListener('click', () => deleteDigit());
    } else {
      btn.addEventListener('click', () => enterDigit(key));
    }
    
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      btn.style.background = KEY_PRESS;
      btn.style.transform = 'scale(0.94)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    });
    
    btn.addEventListener('mouseup', () => {
      btn.style.background = key_bg();
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.background = key_bg();
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
    
    numpad.append(btn);
  }
  
  inputArea.append(prompt, dots, numpad);
  layer.append(inputArea);
  
  // State for passcode input
  let currentInput = '';
  
  function updateDots() {
    const dotEls = dots.querySelectorAll('.lockScreenDot');
    dotEls.forEach((dot, i) => {
      if (i < currentInput.length) {
        dot.style.background = '#4a90d9';
        dot.style.borderColor = '#4a90d9';
      } else {
        dot.style.background = 'transparent';
        dot.style.borderColor = '#5a6a7a';
      }
    });
  }
  
  function enterDigit(digit) {
    if (currentInput.length >= 4) return;
    currentInput += digit;
    updateDots();
    
    if (currentInput.length === 4) {
      // Check passcode
      if (currentInput === appState.passcode) {
        // Correct passcode
        appState.unlocked = true;
        appState.attempts = 0;
        
        // Visual feedback: green flash
        dots.querySelectorAll('.lockScreenDot').forEach(dot => {
          dot.style.background = '#4ad94a';
          dot.style.borderColor = '#4ad94a';
        });
        
        setTimeout(() => {
          appState.screenOn = true;
          showHome();
          game.say('Phone unlocked. Battery at 3%.', 3000);
        }, 300);
      } else {
        // Wrong passcode
        appState.attempts++;
        
        // Visual feedback: red flash
        dots.querySelectorAll('.lockScreenDot').forEach(dot => {
          dot.style.background = '#d94a4a';
          dot.style.borderColor = '#d94a4a';
        });
        
        setTimeout(() => {
          currentInput = '';
          updateDots();
          
          if (appState.attempts >= 2) {
            game.say('Too many failed attempts. Phone resetting...', 3000);
            setTimeout(() => {
              if (appState.screenOn) {
                showLockScreen();
              }
            }, 1000);
          } else {
            game.say('Wrong passcode. Try again.', 2000);
          }
        }, 500);
      }
    }
  }
  
  function deleteDigit() {
    currentInput = currentInput.slice(0, -1);
    updateDots();
  }
}

function showHome() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
  grid.style.gap = '12px';
  grid.style.padding = '12px';
  
  const apps = [
    { id: 'messenger', label: 'Messenger', color: '#4a90d9', icon: 'M' },
    { id: 'camera', label: 'Camera', color: '#d94a4a', icon: 'C' },
    { id: 'gallery', label: 'Gallery', color: '#4ad94a', icon: 'G' },
    { id: 'calendar', label: 'Calendar', color: '#9b6bff', icon: '📅' },
    { id: 'settings', label: 'Settings', color: '#d9d94a', icon: '⚙' },
    { id: 'game', label: 'Pong', color: '#4a90d9', icon: '🏓' },
  ];
  
  for (const app of apps) {
    const card = phoneEl('div', 'phoneAppCard');
    card.style.background = key_bg();
    card.style.border = '1px solid #202833';
    card.style.borderRadius = '12px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'center';
    card.style.padding = '16px 8px';
    card.style.cursor = 'pointer';
    
    const icon = phoneEl('div', 'phoneAppIcon');
    icon.style.width = '48px';
    icon.style.height = '48px';
    icon.style.borderRadius = '50%';
    icon.style.background = app.color;
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontSize = '20px';
    icon.style.fontWeight = '600';
    icon.style.color = '#fff';
    icon.textContent = app.icon;
    
    const label = phoneEl('div', 'phoneAppLabel');
    label.textContent = app.label;
    label.style.fontSize = '11px';
    label.style.color = '#9bb0c6';
    label.style.marginTop = '8px';
    label.style.textAlign = 'center';
    
    card.append(icon, label);
    card.addEventListener('click', () => openApp(app.id));
    grid.append(card);
  }
  
  layer.append(grid);
}

function openApp(id) {
  appState.activeApp = id;
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  if (id === 'messenger') {
    showMessenger();
  } else if (id === 'camera') {
    showCamera();
  } else if (id === 'gallery') {
    showGallery();
  } else if (id === 'calendar') {
    showCalendar();
  } else if (id === 'settings') {
    showSettings();
  } else if (id === 'game') {
    showGame();
  } else {
    showHome();
  }
}

function showMessenger() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  // Mark phone as functional when Pico's message is opened
  appState.functional = true;
  
  // Header
  const header = phoneEl('div', 'phoneHeader');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '8px 0';
  header.style.borderBottom = '1px solid #222a35';
  
  const title = phoneEl('div', 'phoneTitle');
  title.textContent = 'Messenger';
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';
  title.style.color = '#e4eaf2';
  
  const backBtn = phoneEl('button', 'phoneBack');
  backBtn.textContent = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#9bb0c6';
  backBtn.style.fontSize = '13px';
  backBtn.style.cursor = 'pointer';
  backBtn.addEventListener('click', showHome);
  header.append(title, backBtn);
  
  // Messages
  const messages = phoneEl('div', 'phoneMessages');
  messages.style.padding = '12px 0';
  messages.style.maxHeight = '320px';
  messages.style.overflowY = 'auto';
  
  const picoMsg = phoneEl('div', 'phoneMessage');
  picoMsg.style.background = '#2a313c';
  picoMsg.style.borderRadius = '12px';
  picoMsg.style.padding = '10px 14px';
  picoMsg.style.maxWidth = '85%';
  picoMsg.style.margin = '0 0 12px 5%';
  picoMsg.style.color = '#e4eaf2';
  picoMsg.style.fontSize = '13px';
  picoMsg.style.lineHeight = '1.5';
  
  const picoName = phoneEl('div', 'phoneMessageName');
  picoName.textContent = 'Pico';
  picoName.style.fontSize = '10px';
  picoName.style.color = '#7c8fa3';
  picoName.style.marginBottom = '4px';
  
  const picoText = phoneEl('div', 'phoneMessageText');
  picoText.textContent = 'Hey you. My phone died hours ago. If you can read this, my battery somehow held. Find help. Walk the road. — Pico';
  
  picoMsg.append(picoName, picoText);
  messages.append(picoMsg);
  
  // Reply input
  const inputArea = phoneEl('div', 'phoneInputArea');
  inputArea.style.display = 'flex';
  inputArea.style.gap = '8px';
  inputArea.style.padding = '10px 0';
  inputArea.style.borderTop = '1px solid #222a35';
  
  const inputField = phoneEl('input', 'phoneInputField');
  inputField.type = 'text';
  inputField.placeholder = 'Type a reply...';
  inputField.style.flex = '1';
  inputField.style.padding = '10px 14px';    inputField.style.background = key_bg();
    inputField.style.border = '1px solid #202833';
    inputField.style.borderRadius = '20px';
    inputField.style.color = '#e4eaf2';
    inputField.style.fontSize = '13px';
    inputField.style.outline = 'none';
    inputField.style.transition = 'border-color 0.2s ease, box-shadow 0.2s ease';
    inputField.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.3)';
    inputField.style.transition = 'border-color 0.2s ease, box-shadow 0.2s ease';
    inputField.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.3)';
  
  const sendBtn = phoneEl('button', 'phoneSend');
  sendBtn.textContent = 'Send';
  sendBtn.style.padding = '10px 18px';
  sendBtn.style.background = '#4a90d9';
  sendBtn.style.border = 'none';
  sendBtn.style.borderRadius = '20px';
  sendBtn.style.color = '#fff';
  sendBtn.style.fontSize = '13px';
  sendBtn.style.cursor = 'pointer';
  sendBtn.addEventListener('click', () => {
    const text = inputField.value.trim();
    if (!text) return;
    
    const myMsg = phoneEl('div', 'phoneMessage');
    myMsg.style.background = '#3a4658';
    myMsg.style.borderRadius = '12px';
    myMsg.style.padding = '10px 14px';
    myMsg.style.maxWidth = '85%';
    myMsg.style.margin = '0 5% 12px 0';
    myMsg.style.color = '#e4eaf2';
    myMsg.style.fontSize = '13px';
    myMsg.style.lineHeight = '1.5';
    
    const myText = phoneEl('div', 'phoneMessageText');
    myText.textContent = text;
    myMsg.append(myText);
    messages.append(myMsg);
    
    inputField.value = '';
    messages.scrollTop = messages.scrollHeight;
  });
  
  inputArea.append(inputField, sendBtn);
  
  layer.append(header, messages, inputArea);
}

function showCamera() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  const preview = phoneEl('div', 'phoneCameraPreview');
  preview.style.width = '100%';
  preview.style.height = '240px';
  preview.style.background = '#1a1a2e';
  preview.style.display = 'flex';
  preview.style.alignItems = 'center';
  preview.style.justifyContent = 'center';
  preview.style.color = '#9bb0c6';
  preview.style.fontSize = '14px';
  preview.textContent = '📷 Camera';
  
  layer.append(preview);
}









function showSettings() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  const section = phoneSection('Device');
  const batteryLine = phoneLabelLine('Battery', `${appState.battery}%`);
  const signalLine = phoneLabelLine('Signal', 'No signal');
  const timeLine = phoneLabelLine('Time', '03:12');
  
  layer.append(section, batteryLine, signalLine, timeLine);
}

// ---- calendar app -----------------------------------------------------------

function showCalendar() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  // Mark phone as functional when calendar is opened
  appState.functional = true;
  
  const header = phoneEl('div', 'phoneHeader');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '8px 0';
  header.style.borderBottom = '1px solid #222a35';
  
  const title = phoneEl('div', 'phoneTitle');
  title.textContent = 'Calendar';
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';
  title.style.color = '#e4eaf2';
  
  const backBtn = phoneEl('button', 'phoneBack');
  backBtn.textContent = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#9bb0c6';
  backBtn.style.fontSize = '13px';
  backBtn.style.cursor = 'pointer';
  backBtn.addEventListener('click', showHome);
  header.append(title, backBtn);
  
  const monthLabel = phoneEl('div', 'calendarMonth');
  monthLabel.textContent = 'March 2026';
  monthLabel.style.fontSize = '14px';
  monthLabel.style.fontWeight = '600';
  monthLabel.style.color = '#e4eaf2';
  monthLabel.style.margin = '12px 0 8px';
  monthLabel.style.textAlign = 'center';
  monthLabel.style.letterSpacing = '0.05em';
  
  const events = [
    { date: 'Mar 12', event: 'Engine dies on Tuluyan road' },
    { date: 'Mar 12', event: 'Walk begins — find help' },
    { date: 'Mar 13', event: 'Del: "my phone died hours ago"' },
    { date: 'Mar 14', event: 'Pico called' },
    { date: 'Mar 14', event: 'Pick up the phone on the porch' },
    { date: 'Mar 15', event: 'Head to the estate' },
    { date: 'Mar 15', event: 'Find the fuse in the workshop' },
    { date: 'Mar 16', event: 'The road is waiting' },
    { date: 'Mar 16', event: 'Get out through the gate' },
  ];
  
  for (const evt of events) {
    const evtEl = phoneEl('div', 'calendarEvent');
    evtEl.style.display = 'flex';
    evtEl.style.alignItems = 'center';
    evtEl.style.gap = '10px';
    evtEl.style.padding = '8px 0';
    evtEl.style.borderBottom = '1px solid #222a35';
    
    const dateEl = phoneEl('div', 'calendarDate');
    dateEl.textContent = evt.date;
    dateEl.style.fontSize = '12px';
    dateEl.style.fontWeight = '600';
    dateEl.style.color = '#9bb0c6';
    dateEl.style.minWidth = '60px';
    
    const textEl = phoneEl('div', 'calendarText');
    textEl.textContent = evt.event;
    textEl.style.fontSize = '13px';
    textEl.style.color = '#e4eaf2';
    
    evtEl.append(dateEl, textEl);
    layer.append(evtEl);
  }
  
  layer.append(header, monthLabel);
}

// ---- gallery app ------------------------------------------------------------

function showGallery() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  // Mark phone as functional when gallery is opened
  appState.functional = true;
  
  const header = phoneEl('div', 'phoneHeader');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '8px 0';
  header.style.borderBottom = '1px solid #222a35';
  
  const title = phoneEl('div', 'phoneTitle');
  title.textContent = 'Gallery';
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';
  title.style.color = '#e4eaf2';
  
  const backBtn = phoneEl('button', 'phoneBack');
  backBtn.textContent = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#9bb0c6';
  backBtn.style.fontSize = '13px';
  backBtn.style.cursor = 'pointer';
  backBtn.addEventListener('click', showHome);
  header.append(title, backBtn);
  
  const emptyState = phoneEl('div', 'phoneGalleryEmpty');
  emptyState.style.width = '100%';
  emptyState.style.padding = '40px 0';
  emptyState.style.textAlign = 'center';
  emptyState.style.color = '#7c8fa3';
  emptyState.style.fontSize = '13px';
  emptyState.textContent = 'No photos yet';
  
  layer.append(header, emptyState);
}

// ---- game app (Pong) --------------------------------------------------------

function showGame() {
  const layer = $phone('#phoneAppLayer');
  if (!layer) return;
  layer.innerHTML = '';
  
  // Mark phone as functional when the game is opened
  appState.functional = true;
  
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 480;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.background = '#0a0c10';
  canvas.style.border = '2px solid #2a313c';
  canvas.style.borderRadius = '8px';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  
  const ctx = canvas.getContext('2d');
  
  // Paddle positions
  const paddleW = 8;
  const paddleH = 50;
  let playerY = 195;
  let aiY = 195;
  const paddleSpeed = 4;
  
  // Ball state
  let ballX = 160;
  let ballY = 240;
  let ballVX = 3;
  let ballVY = 2;
  const ballSize = 6;
  
  // Score
  let playerScore = 0;
  let aiScore = 0;
  
  // Input state
  const keys = {};
  
  // AI difficulty: tracks ball Y with some lag
  const aiSpeed = 2.5;
  
  function resetBall() {
    ballX = 160;
    ballY = 240;
    ballVX = (Math.random() > 0.5 ? 1 : -1) * 3;
    ballVY = (Math.random() - 0.5) * 4;
  }
  
  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  
  function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  function drawText(text, x, y, color, size = 16) {
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }
  
  function update() {
    // Player paddle: up/down arrow keys or W/S
    if (keys['ArrowUp'] || keys['w']) playerY -= paddleSpeed;
    if (keys['ArrowDown'] || keys['s']) playerY += paddleSpeed;
    playerY = Math.max(0, Math.min(canvas.height - paddleH, playerY));
    
    // AI paddle: tracks the ball with some lag and imperfection
    const aiCenter = aiY + paddleH / 2;
    const targetY = ballY - paddleH / 2;
    if (aiCenter < targetY - 10) {
      aiY += aiSpeed;
    } else if (aiCenter > targetY + 10) {
      aiY -= aiSpeed;
    }
    aiY = Math.max(0, Math.min(canvas.height - paddleH, aiY));
    
    // Move ball
    ballX += ballVX;
    ballY += ballVY;
    
    // Ball collision with top/bottom walls
    if (ballY - ballSize < 0 || ballY + ballSize > canvas.height) {
      ballVY *= -1;
    }
    
    // Ball collision with paddles
    // Player paddle (left side)
    if (ballX - ballSize < paddleW && ballY > playerY && ballY < playerY + paddleH) {
      ballVX = Math.abs(ballVX) * 1.05;
      ballVY += (ballY - (playerY + paddleH / 2)) * 0.1;
    }
    
    // AI paddle (right side)
    if (ballX + ballSize > canvas.width - paddleW && ballY > aiY && ballY < aiY + paddleH) {
      ballVX = -Math.abs(ballVX) * 1.05;
      ballVY += (ballY - (aiY + paddleH / 2)) * 0.1;
    }
    
    // Keep ball speed in reasonable range
    const speed = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
    if (speed > 8) {
      ballVX = (ballVX / speed) * 8;
      ballVY = (ballVY / speed) * 8;
    }
    
    // Scoring
    if (ballX < 0) {
      aiScore++;
      resetBall();
    }
    if (ballX > canvas.width) {
      playerScore++;
      resetBall();
    }
  }
  
  function draw() {
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Center line
    ctx.strokeStyle = '#2a313c';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Paddles
    drawRect(0, playerY, paddleW, paddleH, '#4a90d9');
    drawRect(canvas.width - paddleW, aiY, paddleW, paddleH, '#d94a4a');
    
    // Ball
    drawCircle(ballX, ballY, ballSize, '#e4eaf2');
    
    // Score
    drawText(playerScore.toString(), canvas.width / 4, 30, '#4a90d9', 20);
    drawText(aiScore.toString(), canvas.width * 3 / 4, 30, '#d94a4a', 20);
  }
  
  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }
  
  // Input handling
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // Prevent page scroll for arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });
  
  // Back button to return to home screen
  const backBtn = phoneEl('button', 'phoneBack');
  backBtn.textContent = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#9bb0c6';
  backBtn.style.fontSize = '13px';
  backBtn.style.cursor = 'pointer';
  backBtn.style.margin = '10px auto';
  backBtn.style.display = 'block';
  backBtn.addEventListener('click', () => {
    window.removeEventListener('keydown', () => {});
    window.removeEventListener('keyup', () => {});
    showHome();
  });
  
  layer.append(backBtn, canvas);
  gameLoop();
}

