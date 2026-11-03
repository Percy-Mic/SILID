// OPENING — the drive, the breakdown, and the walk into the forest.
//
// This is the sequence the game was always supposed to start with: Del is
// driving home when the SUV lets go on an empty provincial road. There is no
// cutscene and no second renderer — the same Player camera is simply carried
// by the car until the car stops, then handed back to the walker beside the
// open door.
//
// The failure is not random. It triggers on distance driven, the car steers
// itself onto the west shoulder as it loses power, and it stops where the
// physics say a coasting car stops: off the carriageway, roughly straight,
// on flat ground. Every phase is a state on this object, so the opening
// cannot fire twice and a probe can jump straight to the walk.
//
// Conventions:
//   car heading h: forward = (sin h, cos h); h=0 faces +z (north).
//   player yaw  θ: facing = (-sin θ, -cos θ); the player faces the car's
//   forward direction when θ = h + π.
// The driver sits on the car's LEFT (+x local, LHD as driven in the
// Philippines). The car pulls onto the WEST shoulder, so the driver's door
// faces the carriageway and the exit camera lands on flat asphalt.

import * as THREE from 'three';
import { heightAt, roadCenter } from './terrain.js';
import { architecture } from './architecture.js';

const START_Z = -78;          // where the drive begins, south of the estate
const START_LANE = 1.7;       // northbound (right) lane offset from centreline
const PULL_Z = -6;            // the shoulder the car ends up on
const PULL_OFF = -4.3;        // west shoulder offset from the centreline
const TRIGGER_DIST = 45;      // metres driven before the fault can fire
const TRIGGER_Z = -34;        // ...but only once level with this z
const MAX_SPEED = 15.5;       // m/s — a narrow provincial road, not a highway
const WALK_KEYS = 'WASD move · SHIFT run · C crouch · E open / take · P phone · F torch · R back to the door';
const DRIVE_KEYS = 'W accelerate · S brake / reverse · A / D steer · E get out (when stopped)';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Opening {
  constructor({ scene, car, player, camera, game, audio }) {
    this.scene = scene;
    this.car = car;
    this.player = player;
    this.camera = camera;
    this.game = game;
    this.audio = audio;

    this.phase = 'idle';       // idle → driving → failing → stopped → exiting → walk
    this.x = 0; this.z = 0; this.heading = 0;
    this.speed = 0; this.steer = 0; this.travelled = 0;
    this.throttleCut = false;
    this.failT = 0; this.deadT = 0; this.doorT = 0; this.hazT = 0;
    this.cueA = false; this.cueB = false; this.cueC = false;
    this.hazards = false;
    this.saidDead = false;
    this.flags = { hood: false, restart: false, boot: false };
    this.collidersAdded = false;
    this._v = new THREE.Vector3();
    this._lastDt = 0.016;
    this._acc = 0;
    this._keysDefault = document.getElementById('keys')?.textContent ?? WALK_KEYS;

    // the amber pulse that marks the wreck after dark
    this.hazLight = new THREE.PointLight(0xff9a2a, 0, 9, 2);
    this.hazLight.position.set(0, 1.15, -0.4);
    car.add(this.hazLight);

    car.setBonnet(false);
  }

  // ---- setup ---------------------------------------------------------------

  // Called once at boot: put the car on the road and the camera in the seat.
  prepare() {
    this.x = roadCenter(START_Z) + START_LANE;
    this.z = START_Z;
    this.heading = 0;
    this.speed = 0;
    this._syncCar();
    this._seatCamera();
    this.player.enabled = false;
    this.player.flash.visible = false;
    this.player.fill.intensity = 0;
  }

  begin() {
    if (this.phase !== 'idle') return;
    this.phase = 'driving';
    this.player.yaw = this.heading + Math.PI;   // look straight down the road
    this.player.pitch = -0.05;
    this._keys(DRIVE_KEYS);
    this.game?.objective('Drive. The road is empty.');
    this.audio.starter(false);                  // crank, catch, then idle
  }

  // Probe / restart path: the breakdown has already happened, the driver's
  // door is open, and the player stands beside the car on the road.
  skipToWalk(placePlayer = true) {
    this.phase = 'walk';
    this.x = roadCenter(PULL_Z) + PULL_OFF;
    this.z = PULL_Z;
    this.heading = 0;
    this.speed = 0;
    this.throttleCut = true;
    this.hazards = true;
    this.car.setBonnet(false);
    this.car.doorL.rotation.y = 1.05;
    this.car.dashLight.intensity = 0;
    this.car.headLMat.emissiveIntensity = 0;
    this.car.headRMat.emissiveIntensity = 0.15;
    this.car.spotL.intensity = 0;
    this.car.spotR.intensity = 6;
    this._syncCar();
    this.audio.hazardTick(true);
    this._addCarColliders();
    if (placePlayer) {
      const s = this._standPoint();
      this.player.teleport(s.x, s.z);
      this.player.yaw = s.yaw;
      this.player.pitch = -0.06;
      this.player.syncCamera();
      this.player.enabled = true;
    }
    this.game?.opening();
  }

  walkPhase() { return this.phase === 'walk'; }

  // ---- per-frame -----------------------------------------------------------

  update(dt) {
    if (this.phase === 'idle') return;
    this._lastDt = dt;
    if (this.phase === 'stopped' || this.phase === 'walk') this._hazardBlink(dt);
    if (this.phase === 'walk' && !this.collidersAdded) { this._addCarColliders(); }
    if (this.phase === 'exiting') { this._exit(dt); return; }
    if (this.phase === 'driving' || this.phase === 'failing') {
      // The car is integrated in fixed steps so the drive feels the same at
      // 60 fps and at 2 fps: a slow machine gets more sim per frame instead
      // of a car that crawls. The backlog is capped so a stall cannot launch
      // the car through a tree.
      this._acc = Math.min((this._acc || 0) + dt, 0.6);
      const H = 1 / 30;
      let n = 0;
      while (this._acc >= H && n < 18) {
        if (this.phase === 'driving') this._drive(H);
        else this._fail(H);
        this._acc -= H;
        n++;
      }
      // engine note once per frame, not once per substep — and never fed a
      // non-finite value, which would throw inside WebAudio and take the
      // whole frame loop with it
      if (Number.isFinite(this.speed)) {
        const driving = this.phase === 'driving';
        this.audio.engineSet(
          clamp(Math.abs(this.speed) / MAX_SPEED, 0.06, driving ? 1 : 0.8),
          driving ? (!(this.player.keys.KeyW || this.player.keys.KeyArrowUp) ? 0.35 : 1) : 0.1,
        );
      }
    } else if (this.phase === 'stopped') { this.deadT += dt; this._deadCues(); }
    this._syncCar();
    if (this.phase !== 'walk') this._driveCamera(dt);
  }

  _keys(text) {
    const el = document.getElementById('keys');
    if (el) el.textContent = text;
  }

  _seatCamera() {
    this.car.updateMatrixWorld();
    this._v.set(0.42, 1.30, -0.15);
    this.camera.position.copy(this._v.applyMatrix4(this.car.matrixWorld));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-0.06, this.heading + Math.PI, 0);
  }

  _driveCamera(dt) {
    this.car.updateMatrixWorld();
    this._v.set(0.42, 1.30, -0.15);
    this.camera.position.copy(this._v.applyMatrix4(this.car.matrixWorld));
    const look = wrap(this.player.yaw - (this.heading + Math.PI));
    const yaw = this.heading + Math.PI + clamp(look, -1.25, 1.25);
    const pitch = clamp(this.player.pitch, -0.55, 0.45);
    const shake = Math.abs(this.speed) * 0.0012;
    const t = performance.now() / 1000;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(
      pitch + Math.sin(t * 27) * shake,
      yaw,
      Math.sin(t * 19) * shake * 1.4,
    );
    // the cabin torch would light the dashboard from the driver's forehead
    this.player.flash.visible = false;
    this.player.fill.intensity = 0;
  }

  _syncCar() {
    const gy = heightAt(this.x, this.z);
    this.car.position.set(this.x, gy, this.z);
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const front = heightAt(this.x + s * 1.6, this.z + c * 1.6) - heightAt(this.x - s * 1.6, this.z - c * 1.6);
    const right = heightAt(this.x + c * 0.95, this.z - s * 0.95) - heightAt(this.x - c * 0.95, this.z + s * 0.95);
    this.car.rotation.order = 'YXZ';
    this.car.rotation.set(-Math.atan2(front, 3.2), this.heading, Math.atan2(right, 1.9));
    // roll the wheels and turn the knuckles
    const roll = (this.speed * this._lastDt) / 0.37;
    for (const w of this.car.wheels) w.rotation.x -= roll;
    for (const p of this.car.frontPivots) p.rotation.y = this.steer * 0.45;
  }

  // ---- driving -------------------------------------------------------------

  _drive(dt) {
    this._lastDt = dt;
    const k = this.player.keys;
    const throttle = !!(k.KeyW || k.ArrowUp) && !this.throttleCut;
    const brake = !!(k.KeyS || k.ArrowDown);
    let steerIn = 0;
    if (k.KeyA || k.ArrowLeft) steerIn += 1;
    if (k.KeyD || k.ArrowRight) steerIn -= 1;
    this.steer += (steerIn - this.steer) * Math.min(1, dt * 5);

    if (throttle) {
      const room = 1 - Math.max(0, this.speed) / MAX_SPEED;
      this.speed += 3.4 * room * dt;
    }
    if (brake) {
      if (this.speed > 0.2) this.speed -= 7.0 * dt;
      else this.speed = Math.max(-4.5, this.speed - 2.2 * dt);   // reverse
    }
    // rolling resistance and the road's own gradient
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const grade = (heightAt(this.x + s * 2, this.z + c * 2) - heightAt(this.x - s * 2, this.z - c * 2)) / 4;
    this.speed -= grade * 4.5 * dt;
    this.speed -= this.speed * 0.14 * dt;
    if (Math.abs(this.speed) < 0.03 && !throttle) this.speed = 0;

    this._integrate(dt, this.steer * 0.62);

    this.travelled += Math.abs(this.speed) * dt;

    if ((this.travelled > TRIGGER_DIST && this.z > TRIGGER_Z) ||
        this.travelled > 95 || this.z > PULL_Z + 8) this._beginFail();
  }

  _integrate(dt, yawRate) {
    const dir = this.speed >= 0 ? 1 : -1;
    const rate = yawRate * Math.min(1, Math.abs(this.speed) / 5) * dir;
    const heading = this.heading + rate * dt;
    const nx = this.x + Math.sin(heading) * this.speed * dt;
    const nz = this.z + Math.cos(heading) * this.speed * dt;
    const gy = heightAt(this.x, this.z);
    if (this._carBlocked(nx, nz, gy)) {
      // a tree, a bank, a fence: the car stops being a car
      this.speed *= -0.12;
      this.audio.thud();
      return;
    }
    this.x = nx; this.z = nz; this.heading = heading;
  }

  _carBlocked(nx, nz, gy) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const probe = (lx, lz) => [nx + lx * c + lz * s, nz - lx * s + lz * c];
    const pts = [
      probe(0.95, 2.3), probe(-0.95, 2.3),
      probe(0.95, -2.3), probe(-0.95, -2.3),
      probe(0, 2.7), probe(0, -2.7),
    ];
    for (const [px, pz] of pts) {
      // a bank too steep to climb stops the car the same way it stops a walker
      if (heightAt(px, pz) - gy > 0.5) return true;
      for (const col of architecture.colliders) {
        if (!col || col.disabled || col.kind === 'car') continue;
        if (col.y0 !== undefined && (col.y0 > gy + 1.9 || col.y1 < gy + 0.1)) continue;
        const dx = col.x2 - col.x1, dz = col.z2 - col.z1;
        const l = dx * dx + dz * dz;
        let t = l ? ((px - col.x1) * dx + (pz - col.z1) * dz) / l : 0;
        t = clamp(t, 0, 1);
        if (Math.hypot(px - (col.x1 + t * dx), pz - (col.z1 + t * dz)) < 0.42) return true;
      }
    }
    return false;
  }

  // ---- the failure ---------------------------------------------------------

  // The entry point. Named apart from _fail(dt) — the coast step — because two
  // methods with the same name silently kept only the second one, and the
  // drive then called the coast with no dt.
  _beginFail() {
    if (this.phase !== 'driving') return;
    this.phase = 'failing';
    this.failT = 0;
    this.throttleCut = true;
    this.audio.engineRough(true);
  }

  _failCues() {
    const t = this.failT;
    if (t > 0.5 && !this.cueA) {
      this.cueA = true;
      this.car.warnMat.emissiveIntensity = 2.2;
      this.game?.say('The engine misses. A red light comes on above the wheel.', 5200);
    }
    if (t > 2.0 && !this.cueB) {
      this.cueB = true;
      this.game?.say('You press the pedal. Nothing. The car is slowing itself.', 5200);
    }
    if (t > 4.5 && !this.cueC && Math.abs(this.speed) > 1.5) {
      this.cueC = true;
      this.game?.say('Get it off the road.', 3800);
    }
  }

  _fail(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this._lastDt = dt;
    this.failT += dt;
    this._failCues();

    // Aim at the west shoulder: a point ahead on the centreline, offset by
    // PULL_OFF. Once the car is near that line the aim damps back to straight
    // along the road, so it settles parallel instead of sawing at the wheel.
    const lateral = this.x - (roadCenter(this.z) + PULL_OFF);
    const ahead = clamp(this.speed, 7, 18);
    const tz = this.z + ahead;
    const tx = roadCenter(tz) + PULL_OFF;
    let err = wrap(Math.atan2(tx - this.x, tz - this.z) - this.heading);
    if (Math.abs(lateral) < 0.7) err *= 0.3;
    const guide = clamp(err * 3.0, -1, 1);
    this.steer += (guide - this.steer) * Math.min(1, dt * 6);

    // A dead engine coasts: no torque, only rolling resistance, drag and the
    // road's own gradient. Nothing here slams the brakes — the car runs out
    // of momentum on the shoulder.
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const grade = (heightAt(this.x + s * 2, this.z + c * 2) - heightAt(this.x - s * 2, this.z - c * 2)) / 4;
    this.speed -= grade * 4.5 * dt;
    this.speed -= 0.55 * dt;
    this.speed -= this.speed * 0.3 * dt;
    if (this.speed < 0) this.speed = 0;
    if (this.speed < 0.25) { this._stop(); return; }

    this._integrate(dt, this.steer * 0.75);
  }

  _stop() {
    this.phase = 'stopped';
    this.speed = 0;
    this.deadT = 0;
    this.audio.engineOff();
    this.audio.coolingTicks(true);
    // the left headlight dies first — the fault the player came out to find
    this.car.headLMat.emissiveIntensity = 0;
    this.car.spotL.intensity = 0;
    this._keys('E open the door');
    this.game?.objective('The engine has died. Get out and look.');
  }

  _deadCues() {
    const t = this.deadT;
    // the right lamp holds on the battery, then goes
    const right = t < 2.0 ? 1 : clamp(1 - (t - 2.0) / 1.2, 0, 1);
    this.car.headRMat.emissiveIntensity = 0.9 * right;
    this.car.spotR.intensity = 30 * right;
    this.car.dashLight.intensity = t < 1.6 ? 0.55 * clamp(1 - (t - 0.6) / 1.0, 0, 1) : 0;
    this.car.clusterMat.emissiveIntensity = 0.85 * clamp(1 - (t - 1.2) / 0.8, 0, 1);
    this.car.warnMat.emissiveIntensity = t < 3.5 ? 2.2 : 0;
    if (t > 1.4 && !this.hazards) {
      this.hazards = true;
      this.audio.hazardTick(true);
    }
    if (t > 2.2 && !this.saidDead) {
      this.saidDead = true;
      this.game?.say('The engine is dead. It will not catch again.', 5600);
    }
  }

  _hazardBlink(dt) {
    this.hazT += dt;
    const on = Math.floor(this.hazT * 1.6) % 2 === 0;
    this.car.amberMat.emissiveIntensity = on ? 2.6 : 0;
    this.car.tailMat.emissiveIntensity = on ? 1.5 : 0.3;
    this.hazLight.intensity = on ? 2.8 : 0;
  }

  // ---- getting out ---------------------------------------------------------

  _standPoint() {
    this.car.updateMatrixWorld();
    this._v.set(1.8, 0, -0.1);
    const p = this._v.applyMatrix4(this.car.matrixWorld);
    const dx = this.x - p.x, dz = this.z - p.z;
    return { x: p.x, z: p.z, yaw: Math.atan2(-dx, -dz) };
  }

  _exit(dt) {
    this.doorT = Math.min(1, this.doorT + dt / 0.7);
    this.car.doorL.rotation.y = this.doorT * 1.05;
    const t = smooth(clamp((this.doorT - 0.35) / 0.6, 0, 1));
    this.camera.position.lerpVectors(this.camFromPos, this.camToPos, t);
    this.camera.quaternion.slerpQuaternions(this.camFromQuat, this.camToQuat, t);
    if (this.doorT >= 1) this._finishExit();
  }

  _finishExit() {
    const s = this._standPoint();
    this.player.teleport(s.x, s.z);
    this.player.yaw = s.yaw;
    this.player.pitch = -0.06;
    this.player.enabled = true;
    this.player.flash.visible = this.player.flashlightOn;
    this.player.fill.intensity = 1.1;
    this.phase = 'walk';
    this._keys(this._keysDefault);
    this._addCarColliders();
    this.audio.coolingTicks(true);
    this.game?.opening();
  }

  _addCarColliders() {
    if (this.collidersAdded) return;
    this.collidersAdded = true;
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const gy = heightAt(this.x, this.z);
    const corner = (lx, lz) => [this.x + lx * c + lz * s, this.z - lx * s + lz * c];
    const hw = 1.0, hl = 2.3;
    const pts = [corner(-hw, -hl), corner(hw, -hl), corner(hw, hl), corner(-hw, hl)];
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      architecture.colliders.push({
        x1: a[0], z1: a[1], x2: b[0], z2: b[1], kind: 'car',
        y0: gy - 0.1, y1: gy + 1.95,
      });
    }
  }

  // ---- roadside interactions ----------------------------------------------

  nearest() {
    if (this.phase === 'stopped') {
      return {
        kind: 'car_exit', name: 'open the door',
        x: this.x, y: heightAt(this.x, this.z) + 1, z: this.z, dist: 0, dot: 1,
      };
    }
    if (this.phase !== 'walk') return null;
    this.car.updateMatrixWorld();
    const eye = this.player.pos;
    const fwd = this.player.forward();
    const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(this.car.matrixWorld);
    const pts = [
      { kind: 'car_hood', name: 'check the engine', p: at(0.3, 1.05, 2.6) },
      { kind: 'car_ignition', name: 'try the key', p: at(1.0, 1.0, -0.1) },
      { kind: 'car_boot', name: 'open the trunk', p: at(0, 1.0, -2.5) },
    ];
    let best = null, bestScore = 0;
    for (const t of pts) {
      const dx = t.p.x - eye.x, dy = t.p.y - eye.y, dz = t.p.z - eye.z;
      if (Math.abs(dy) > 2.0) continue;
      const d = Math.hypot(dx, dy, dz);
      if (d > 3.0) continue;
      const dh = Math.hypot(dx, dz) || 1;
      const dot = (dx * fwd.x + dz * fwd.z) / dh;
      if (dot < 0.35) continue;
      const score = dot * 2 - d * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = { kind: t.kind, name: t.name, x: t.p.x, y: t.p.y, z: t.p.z, dist: d, dot };
      }
    }
    return best;
  }

  // Returns true when the target belonged to the car and was handled.
  interact(target) {
    if (!target || !target.kind?.startsWith('car_')) return false;
    if (target.kind === 'car_exit') {
      if (this.phase !== 'stopped') return true;
      this.phase = 'exiting';
      this.doorT = 0;
      this.audio.creak();
      this.game?.say('You push the door open. The engine ticks as it cools.', 4600);
      this.camFromPos = this.camera.position.clone();
      this.camFromQuat = this.camera.quaternion.clone();
      const s = this._standPoint();
      this.camToPos = new THREE.Vector3(s.x, heightAt(s.x, s.z) + 1.55, s.z);
      this.camToQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-0.06, s.yaw, 0, 'YXZ'),
      );
      return true;
    }
    if (target.kind === 'car_hood') {
      if (!this.flags.hood) {
        this.flags.hood = true;
        this.car.setBonnet(true);
        this.audio.creak();
        this.game?.say('The auxiliary belt is shredded to wires, and the block is wet with oil. ' +
          'There is nothing in this car that can mend it.', 7000);
      } else {
        this.game?.say('Shredded belt. Oil. Nothing here you can use.', 4200);
      }
      return true;
    }
    if (target.kind === 'car_ignition') {
      if (!this.flags.restart) {
        this.flags.restart = true;
        this.audio.starter(true);
        this.game?.say('You reach in and turn the key. The starter clicks once — weak — and gives up.', 6500);
      } else {
        this.audio.starter(true);
        this.game?.say('One dry click. It is not coming back.', 4200);
      }
      return true;
    }
    if (target.kind === 'car_boot') {
      if (!this.flags.boot) {
        this.flags.boot = true;
        this.game?.say('A jacket. A half-case of water. A charger. Nothing here that can mend a belt.', 6500);
      } else {
        this.game?.say('Water, a jacket, a charger.', 3600);
      }
      return true;
    }
    return false;
  }

  // Test hook: fire the failure immediately from wherever the car is.
  forceBreakdown() {
    if (this.phase === 'driving') this._beginFail();
  }
}
