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
    this.buildStoryProps();
    this.buildGate();
    this.buildLights();
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
    // practical lights from the furniture. The cap matters: forward rendering
    // pays for every light on every fragment.
    const all = props.lights.slice();
    all.sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
    for (const l of all.slice(0, 14)) {
      const light = new THREE.PointLight(l.color, Math.min(2.2, l.intensity * 0.35), l.distance, 2);
      light.position.set(l.x, l.y, l.z);
      light.userData.base = l.intensity;
      this.scene.add(light);
      this.lights.push(light);
    }
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
        this.say('No signal. 03:12. The battery is at 4%.');
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

  update(dt) {
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
    bag.innerHTML = items.length ? items.map((i) => '+ ' + i).join('<br>') : '';
  }

  // The handoff out of the opening: the car is dead, the road is walked on
  // foot, and the house beyond the trees is the only light for kilometres.
  opening() {
    this.objective('THE ROAD — WALK. FIND HELP.');
    this.say('The engine is dead. Through the trees, one lit window — someone is home.', 6500);
  }
}
