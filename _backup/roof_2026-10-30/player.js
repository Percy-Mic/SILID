// PLAYER — first person, 0.34 m radius, 1.68 m eye height.
//
// Collision is resolved against wall segments and furniture rectangles with a
// separate x and z pass, so a body slides along a wall instead of sticking to
// it. The floor comes from the architecture query first (levels, stair ramps)
// and from the terrain height field outside; because both are analytic, the
// player never steps onto a surface that was not authored.
//
// The flashlight is a real spotlight with distance falloff. It is bright enough
// to read a wall at eight metres and dark at twenty, which is the point.

import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { floorHeightAt } from '../world/architecture.js';

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(-54.6, 0, 29.4);
    this.vel = new THREE.Vector3();
    this.yaw = -2.3;
    this.pitch = -0.05;
    this.radius = 0.34;
    this.height = 1.68;
    this.crouch = 0;
    this.footY = 0;
    this.bob = 0;
    this.keys = Object.create(null);
    this.locked = false;
    this.enabled = true;
    this.onStep = null;
    this.colliders = [];
    this.boxes = [];
    this.flashlightOn = true;
    this.surface = 'dirt';
    // The canvas takes the pointer back on click. While the phone is held up
    // the game sets this false: a click there is a finger on the glass, and
    // re-locking would swallow the tap before the screen ever sees it.
    this.allowLock = true;
    // Ladder climbing state
    this.isClimbing = false;
    this.climbTarget = null;   // {x, z, yStart, yEnd, railSide}
    this.climbSpeed = 2.0;   // metres per second
    this.climbRung = 0;      // current rung index

    // Softer and a little dimmer than it was: at 17 candela with a 0.52
    // penumbra the hotspot clipped to white on any wall within a metre, which
    // erased exactly the surface detail the light is there to show.
    this.flash = new THREE.SpotLight(0xfff2d4, 12, 28, 0.58, 0.78, 1.3);
    this.flash.position.set(0.18, -0.12, 0.12);
    this.flash.target.position.set(0, -0.04, -1);
    this.flash.castShadow = false;
    camera.add(this.flash);
    camera.add(this.flash.target);
    // a very dim fill so a wall three metres away is not pure black when the
    // torch is off; physically this is the sky through the windows
    this.fill = new THREE.PointLight(0x9fb0c4, 1.1, 7, 2);
    this.fill.position.set(0, 0.2, 0);
    camera.add(this.fill);

    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.toggleFlash();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.dom.addEventListener('click', () => {
      if (this.enabled && !this.locked && this.allowLock !== false) this.dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    });
  }

  toggleFlash() {
    this.flashlightOn = !this.flashlightOn;
    this.flash.visible = this.flashlightOn;
  }

  teleport(x, z, y = null) {
    this.pos.x = x; this.pos.z = z;
    this.footY = y === null ? heightAt(x, z) : y;
    this.pos.y = this.footY + this.height - this.crouch * 0.55;
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }

  setWorld(colliders, boxes) {
    this.colliders = colliders;
    this.boxes = boxes;
  }

  blocked(x, z) {
    const r = this.radius;
    const body0 = this.footY + 0.05, body1 = this.footY + 1.65;
    for (const c of this.colliders) {
      if (!c || c.disabled) continue;
      // walls and doors belong to a floor. A wall on F2 must not exist for a
      // body standing in the foyer below it.
      if (c.y0 !== undefined && (body1 < c.y0 || body0 > c.y1)) continue;
      // A balustrade is a waist-high obstacle for someone standing on its
      // floor, not a wall across the stairwell for someone climbing past it.
      if (c.kind === 'rail' && Math.abs(this.footY - c.baseY) > 0.6) continue;
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
      const l = dx * dx + dz * dz;
      let t = l ? ((x - c.x1) * dx + (z - c.z1) * dz) / l : 0;
      t = Math.max(0, Math.min(1, t));
      const px = c.x1 + t * dx, pz = c.z1 + t * dz;
      if (Math.hypot(x - px, z - pz) < r) return true;
    }
    for (const b of this.boxes) {
      if (b.y0 !== undefined && (body1 < b.y0 || body0 > b.y1)) continue;
      if (x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r) return true;
    }
    return false;
  }

  update(dt, game) {
    if (!this.enabled) return;
    // Ladder climbing takes priority when active
    if (this.isClimbing && this.climbTarget) {
      const t = this.climbSpeed * dt;
      const { x, z, yStart, yEnd, railSide, levelY } = this.climbTarget;
      const rungS = 0.25;  // rung spacing
      // Determine direction and current rung
      let dir = 1; // 1 = up, -1 = down
      if (this.footY - yStart < 0) dir = -1; // starting from below
      const totalRungs = Math.round((yEnd - yStart) / rungS);
      const rungRange = Math.max(0, this.climbRung + dir);
      if (rungRange < 0) this.climbRung = 0;
      if (rungRange > totalRungs) this.climbRung = totalRungs;
      // Compute target foot y at current rung
      const targetY = yStart + this.climbRung * rungS;
      // Smoothly move foot y to target
      this.footY += (targetY - this.footY) * Math.min(1, dt * 8);
      // If we've reached the top or bottom, exit climbing mode
      if (Math.abs(this.footY - targetY) < 0.05) {
        if (dir > 0 && this.footY >= yEnd - 0.1) {
          // Reached top landing
          this.isClimbing = false;
          this.pos.x = x;
          this.pos.z = z;
          this.footY = levelY != null ? levelY : this.footY;
          this.climbTarget = null;
          this.climbRung = 0;
        } else if (dir < 0 && this.footY <= yStart + 0.1) {
          // Reached bottom landing
          this.isClimbing = false;
          this.pos.x = x;
          this.pos.z = z;
          this.climbTarget = null;
          this.climbRung = 0;
        }
      }
      // Keep player aligned with ladder rails
      this.pos.x = x;
      this.pos.z = z;
      // Update camera
      this.pos.y = this.footY + this.height;
      this.syncCamera();
      // Apply a small forward/backward input to control climb direction
      if (k.KeyW || k.ArrowUp) {
        if (this.climbRung < totalRungs) this.climbRung += 1;
      }
      if (k.KeyS || k.ArrowDown) {
        if (this.climbRung > 0) this.climbRung -= 1;
      }
      // Restore normal movement after a moment at the landing
      if (!((k.KeyW || k.ArrowUp || k.KeyS || k.ArrowDown))) {
        this.isClimbing = false;
        this.climbTarget = null;
        this.climbRung = 0;
      }
      return; // skip normal movement while climbing
    }
    const k = this.keys;
    const crouching = !!(k.KeyC || k.ControlLeft);
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    const eyeH = this.height - this.crouch * 0.55;

    let f = 0, s = 0;
    if (k.KeyW || k.ArrowUp) f += 1;
    if (k.KeyS || k.ArrowDown) f -= 1;
    if (k.KeyD || k.ArrowRight) s += 1;
    if (k.KeyA || k.ArrowLeft) s -= 1;
    const running = !!(k.ShiftLeft || k.ShiftRight) && !crouching;
    const speed = (running ? 4.3 : 2.4) * (crouching ? 0.5 : 1);
    const len = Math.hypot(f, s) || 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const vx = (-sin * f + cos * s) / len * speed;
    const vz = (-cos * f - sin * s) / len * speed;

    // accelerate a little rather than snapping
    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * 12);
    this.vel.z += (vz - this.vel.z) * Math.min(1, dt * 12);

    const stepX = this.vel.x * dt;
    const stepZ = this.vel.z * dt;
    if (!this.blocked(this.pos.x + stepX, this.pos.z)) this.pos.x += stepX;
    if (!this.blocked(this.pos.x, this.pos.z + stepZ)) this.pos.z += stepZ;

    // floor: architecture first, terrain only when no floor is underfoot
    const archFloor = floorHeightAt(this.pos.x, this.pos.z, this.footY);
    const ground = archFloor === null ? heightAt(this.pos.x, this.pos.z) : archFloor;
    if (archFloor === null) this.surface = 'dirt';
    else this.surface = ground > 1 ? 'wood' : 'stone';

    if (ground > this.footY + 0.55) {
      // a step too tall to climb: refuse the move rather than lift the player
      this.pos.x -= stepX;
      this.pos.z -= stepZ;
    } else {
      const down = this.footY - ground;
      const rate = down > 1.0 ? 7.5 : 9.5;
      this.footY += (ground - this.footY) * Math.min(1, dt * rate);
    }

    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.4) {
      this.bob += dt * (running ? 9.5 : 6.2);
      const stepPhase = Math.sin(this.bob);
      if (stepPhase < -0.92 && !this._stepped) {
        this._stepped = true;
        this.onStep?.(this.surface, running, this.footY);
      }
      if (stepPhase > 0) this._stepped = false;
    } else {
      this.bob += (0 - this.bob) * dt * 3;
    }

    this.pos.y = this.footY + eyeH + Math.sin(this.bob) * 0.018;
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // keep the flashlight pointing down the view axis
    this.flash.target.position.set(0, 0, -1);
    this.flash.intensity = this.flashlightOn ? 12 : 0;
  }

  forward() {
    const v = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    return v;
  }
}
