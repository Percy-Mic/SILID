// PHONE SCREEN — the display of the phone the player is actually holding.
//
// This is not a HUD card. Everything here is drawn into a 512 x 1024 canvas
// whose texture is assigned to the PhoneGlass material of the supplied
// smart_phone.glb, so the lock screen, the app grid and every app appear ON the
// model, in perspective, lit by nothing but their own emission. The old DOM
// overlay that floated a second phone over the scene is gone.
//
// The canvas is the interface: taps are mapped through the glass mesh by the
// game (a raycast against the real geometry, which yields the hit UV), so the
// same code that draws a keypad also knows where that keypad is.
//
// Battery, clock and the passcode are the same fiction the app text always
// used: 03:12, 78 %, 6294. The passcode now has a clue on screen after two
// failed attempts, because it never had one in the world.
import * as THREE from 'three';

export const PHONE_PASSCODE = '6294';
export const SCREEN_W = 512;
export const SCREEN_H = 1024;

const PAD = 34;
const C = {
  bg: '#080b10',
  ink: '#e6edf5',
  dim: '#8b9bad',
  faint: '#4b5767',
  line: '#1c2531',
  tile: '#131b26',
  tileHot: '#1d2938',
  accent: '#66a9dc',
  red: '#c65543',
  green: '#54a06a',
};

// The same six apps the old overlay had. The order is the grid order.
const APPS = [
  { id: 'messages', label: 'Messages', color: '#2f6f9e' },
  { id: 'calendar', label: 'Calendar', color: '#6a55a8' },
  { id: 'gallery', label: 'Gallery', color: '#3d7a55' },
  { id: 'camera', label: 'Camera', color: '#7d3b3b' },
  { id: 'settings', label: 'Settings', color: '#4d5259' },
  { id: 'pong', label: 'Pong', color: '#2f5c8a' },
];

const CALENDAR = [
  ['Mar 12', 'Engine dies on Tuluyan road'],
  ['Mar 12', 'Walk begins — find help'],
  ['Mar 13', 'Del: "my phone died hours ago"'],
  ['Mar 14', 'Pico called'],
  ['Mar 14', 'Pick up the phone on the porch'],
  ['Mar 15', 'Head to the estate'],
  ['Mar 15', 'Find the fuse in the workshop'],
  ['Mar 16', 'The road is waiting'],
  ['Mar 16', 'Get out through the gate'],
];

function font(weight, px) {
  return `${weight} ${px}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;
}

export class PhoneScreen {
  constructor({ say = () => {} } = {}) {
    this.say = say;

    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.ctx = this.canvas.getContext('2d');

    // The screen UVs on this asset run bottom-up (v = 0 at the chin), which is
    // the opposite of what the glTF loader assumes by default. Uploading the
    // canvas flipped is what puts the clock at the top of the phone; the tap
    // mapping below mirrors the same decision.
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = true;
    this.texture.anisotropy = 4;
    this.texture.needsUpdate = true;

    this.open = false;
    this.view = 'lock';
    this.unlocked = false;
    this.pass = '';
    this.attempts = 0;
    this.wrongT = 0;
    this.minutes = 3 * 60 + 12;   // 03:12, the hour the game keeps
    this.clockAccum = 0;
    this.battery = 78;
    this.t = 0;
    this.dirty = true;
    this.hits = [];
    this.hoverId = null;
    this.drawAccum = 0;

    // Pong lives on the screen, so it is played by tapping the court.
    this.pong = {
      court: { x: PAD, y: 186, w: SCREEN_W - PAD * 2, h: 640 },
      px: 0, py: 0, ax: 0, ay: 0,
      ball: { x: 0, y: 0, vx: 0, vy: 0 },
      you: 0, ai: 0,
      target: null,
      step: 1 / 60,
      acc: 0,
      live: false,
    };

    this.draw();
  }

  // ---- lifecycle -----------------------------------------------------------

  raise() {
    this.open = true;
    this.view = this.unlocked ? 'home' : 'lock';
    this.pass = '';
    this.dirty = true;
    this.draw();
  }

  lower() {
    this.open = false;
    this.hoverId = null;
    if (this.view === 'pong') this.pong.live = false;
    this.dirty = true;
    this.draw();
  }

  get isOpen() { return this.open; }

  // ---- clock and simulation ------------------------------------------------

  update(dt) {
    this.t += dt;
    // one story minute every twenty seconds, so the phone never jumps time
    this.clockAccum += dt;
    while (this.clockAccum >= 20) {
      this.clockAccum -= 20;
      this.minutes = (this.minutes + 1) % 1440;
      this.dirty = true;
    }
    if (this.wrongT > 0) {
      this.wrongT = Math.max(0, this.wrongT - dt);
      this.dirty = true;
    }

    const p = this.pong;
    if (this.open && this.view === 'pong' && p.live) {
      p.acc = Math.min(p.acc + dt, 0.25);
      while (p.acc >= p.step) { this.stepPong(p.step); p.acc -= p.step; }
      this.drawAccum += dt;
      // 30 Hz is enough for a paddle game and keeps texture uploads cheap on
      // the integrated GPU this has to run on.
      if (this.drawAccum >= 1 / 30) { this.drawAccum = 0; this.draw(); }
    } else if (this.dirty) {
      this.draw();
    }
  }

  stepPong(dt) {
    const p = this.pong;
    const c = p.court;
    const PH = 74, PW = 10, R = 7;
    if (p.target !== null) {
      const want = Math.max(c.y, Math.min(c.y + c.h - PH, p.target - PH / 2));
      p.py += Math.max(-620 * dt, Math.min(620 * dt, want - p.py));
    }
    // the house AI is a little slower than the tap, and it mistimes
    const centre = p.ay + PH / 2;
    const lead = p.ball.y + p.ball.vy * 0.12;
    if (centre < lead - 12) p.ay = Math.min(c.y + c.h - PH, p.ay + 330 * dt);
    else if (centre > lead + 12) p.ay = Math.max(c.y, p.ay - 330 * dt);

    p.ball.x += p.ball.vx * dt;
    p.ball.y += p.ball.vy * dt;

    if (p.ball.y - R < c.y) { p.ball.y = c.y + R; p.ball.vy = Math.abs(p.ball.vy); }
    if (p.ball.y + R > c.y + c.h) { p.ball.y = c.y + c.h - R; p.ball.vy = -Math.abs(p.ball.vy); }

    const px = c.x + 18;
    if (p.ball.x - R < px + PW && p.ball.x > px - R && p.ball.y > p.py && p.ball.y < p.py + PH) {
      p.ball.x = px + PW + R;
      p.ball.vx = Math.abs(p.ball.vx) * 1.04;
      p.ball.vy += (p.ball.y - (p.py + PH / 2)) * 6;
    }
    const ax = c.x + c.w - 18 - PW;
    if (p.ball.x + R > ax && p.ball.x < ax + PW + R && p.ball.y > p.ay && p.ball.y < p.ay + PH) {
      p.ball.x = ax - R;
      p.ball.vx = -Math.abs(p.ball.vx) * 1.04;
      p.ball.vy += (p.ball.y - (p.ay + PH / 2)) * 6;
    }

    if (p.ball.x < c.x - R) { p.ai += 1; this.servePong(-1); }
    else if (p.ball.x > c.x + c.w + R) { p.you += 1; this.servePong(1); }
  }

  servePong(dir) {
    const p = this.pong;
    const c = p.court;
    p.ball.x = c.x + c.w / 2;
    p.ball.y = c.y + c.h / 2;
    p.ball.vx = dir * 300;
    p.ball.vy = (Math.random() - 0.5) * 220;
  }

  startPong() {
    const p = this.pong;
    const c = p.court;
    p.px = c.x + 18;
    p.py = c.y + (c.h - 74) / 2;
    p.ax = c.x + c.w - 28;
    p.ay = p.py;
    p.you = 0;
    p.ai = 0;
    p.target = null;
    p.live = true;
    this.servePong(Math.random() > 0.5 ? 1 : -1);
  }

  // ---- input ---------------------------------------------------------------

  // Canvas pixel from a UV on the glass. Kept here, next to flipY, because the
  // two have to agree or the player taps a key they cannot see.
  static pixelFromUV(u, v) {
    return { x: u * SCREEN_W, y: (1 - v) * SCREEN_H };
  }

  hot(id) { return this.hoverId === id; }

  hover(x, y) {
    if (!this.open) return;
    let found = null;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { found = h.id; break; }
    }
    if (found !== this.hoverId) { this.hoverId = found; this.dirty = true; }
  }

  tap(x, y) {
    if (!this.open) return false;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        if (h.at) this.tapPong(y); else h.fn();
        this.dirty = true;
        this.draw();
        return true;
      }
    }
    return false;
  }

  hit(id, x, y, w, h, fn, at = false) {
    this.hits.push({ id, x, y, w, h, fn, at });
  }

  // ---- drawing -------------------------------------------------------------

  draw() {
    this.dirty = false;
    const ctx = this.ctx;
    this.hits.length = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // A very faint sheen so the panel is not a flat black rectangle in the
    // dark; it reads as glass rather than paint.
    const g = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
    g.addColorStop(0, 'rgba(90,130,170,0.055)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(40,60,90,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (this.view === 'lock') this.drawLock();
    else if (this.view === 'home') this.drawHome();
    else if (this.view === 'messages') this.drawMessages();
    else if (this.view === 'calendar') this.drawCalendar();
    else if (this.view === 'gallery') this.drawGallery();
    else if (this.view === 'camera') this.drawCamera();
    else if (this.view === 'settings') this.drawSettings();
    else if (this.view === 'pong') this.drawPong();
    else this.drawHome();

    if (!this.open) {
      // The phone is down at the player's side: the display is still lit, but
      // nobody is looking straight at it.
      ctx.fillStyle = 'rgba(2,4,7,0.60)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      this.hits.length = 0;
    } else if (this.hoverId) {
      const h = this.hits.find((k) => k.id === this.hoverId);
      if (h) {
        ctx.strokeStyle = 'rgba(120,180,230,0.55)';
        ctx.lineWidth = 2;
        this.roundRect(h.x + 2, h.y + 2, h.w - 4, h.h - 4, 14);
        ctx.stroke();
      }
    }

    this.texture.needsUpdate = true;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  text(s, x, y, { size = 24, weight = 400, color = C.ink, align = 'left', baseline = 'alphabetic' } = {}) {
    const ctx = this.ctx;
    ctx.font = font(weight, size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  clockText() {
    const h = Math.floor(this.minutes / 60) % 24;
    const m = this.minutes % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  statusBar() {
    const ctx = this.ctx;
    this.text(this.clockText(), PAD, 54, { size: 22, weight: 600, color: C.dim });
    const pct = Math.max(0, Math.min(100, this.battery));
    const bx = SCREEN_W - PAD - 54, by = 34, bw = 54, bh = 24;
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 2;
    this.roundRect(bx, by, bw, bh, 6);
    ctx.stroke();
    ctx.fillStyle = pct > 20 ? '#6f93b3' : C.red;
    ctx.fillRect(bx + 4, by + 4, (bw - 8) * (pct / 100), bh - 8);
    ctx.fillStyle = C.faint;
    ctx.fillRect(bx + bw + 3, by + 7, 3, bh - 14);
    this.text(pct + '%', bx - 10, 54, { size: 20, weight: 600, color: C.dim, align: 'right' });
    // signal: this phone has none, and says so wherever it is awake
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const hh = 6 + i * 5;
      ctx.beginPath();
      ctx.moveTo(bx - 130 + i * 9, 54);
      ctx.lineTo(bx - 130 + i * 9, 54 - hh);
      ctx.stroke();
    }
  }

  // ---- lock ----------------------------------------------------------------

  drawLock() {
    const ctx = this.ctx;
    this.statusBar();

    this.text(this.clockText(), SCREEN_W / 2, 300, {
      size: 132, weight: 300, color: C.ink, align: 'center',
    });
    this.text('Monday, March 14', SCREEN_W / 2, 356, {
      size: 26, color: C.dim, align: 'center', weight: 400,
    });

    // padlock: a body and a shackle, drawn rather than typed
    const lx = SCREEN_W / 2, ly = 410;
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lx, ly - 12, 9, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = C.faint;
    this.roundRect(lx - 13, ly - 12, 26, 20, 4);
    ctx.fill();

    this.text('Enter passcode', SCREEN_W / 2, 476, {
      size: 25, color: this.attempts ? C.red : C.dim, align: 'center',
    });

    // four dots; they shake while the code is wrong
    const wrong = this.wrongT > 0;
    const shake = wrong ? Math.sin(this.t * 60) * 7 * (this.wrongT / 1.2) : 0;
    for (let i = 0; i < 4; i++) {
      const on = i < this.pass.length;
      ctx.beginPath();
      ctx.arc(SCREEN_W / 2 + (i - 1.5) * 40 + shake, 528, 9, 0, Math.PI * 2);
      ctx.fillStyle = on ? C.ink : 'rgba(0,0,0,0)';
      ctx.fill();
      if (!on) {
        ctx.strokeStyle = C.faint;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (wrong) {
      this.text('Wrong passcode', SCREEN_W / 2, 585, { size: 21, color: C.red, align: 'center' });
    } else if (this.attempts >= 2) {
      // It never had a clue in the world. Six, two, ninety-four is what the
      // calendar is for, and it is only offered after the player has tried.
      this.text('hint — 6 · 2 · 94', SCREEN_W / 2, 585, { size: 20, color: C.faint, align: 'center' });
    }

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    for (let i = 0; i < keys.length; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = SCREEN_W / 2 + (col - 1) * 142;
      const cy = 650 + row * 104;
      const label = keys[i];
      if (!label) continue;
      const id = 'key-' + label;
      const isDel = label === 'del';
      ctx.beginPath();
      ctx.arc(cx, cy, 54, 0, Math.PI * 2);
      ctx.fillStyle = this.hot(id) ? C.tileHot : 'rgba(24,32,44,0.92)';
      ctx.fill();
      if (isDel) {
        this.text('del', cx, cy + 9, { size: 21, weight: 600, color: C.dim, align: 'center' });
      } else {
        this.text(label, cx, cy + 13, { size: 36, weight: 400, color: C.ink, align: 'center' });
      }
      this.hit(id, cx - 54, cy - 54, 108, 108, () => this.pressKey(label));
    }
  }

  pressKey(label) {
    // Every state change has to mark the canvas dirty; update() is what pushes
    // it to the texture, and a redraw that only happens on a mouse event would
    // leave the screen a frame behind the phone.
    this.dirty = true;
    if (label === 'del') {
      this.pass = this.pass.slice(0, -1);
      return;
    }
    if (this.pass.length >= 4) return;
    this.pass += label;
    if (this.pass.length < 4) return;
    if (this.pass === PHONE_PASSCODE) {
      this.unlocked = true;
      this.pass = '';
      this.attempts = 0;
      this.view = 'home';
      this.say('Unlocked.', 1600);
    } else {
      this.pass = '';
      this.attempts += 1;
      this.wrongT = 1.2;
      this.say('Wrong passcode. Try again.', 2000);
    }
  }

  // ---- home ----------------------------------------------------------------

  drawHome() {
    const ctx = this.ctx;
    this.statusBar();
    this.text('Monday, March 14', SCREEN_W / 2, 150, { size: 24, color: C.dim, align: 'center' });
    this.text(this.clockText(), SCREEN_W / 2, 236, { size: 76, weight: 300, color: C.ink, align: 'center' });
    this.text('no service — WiFi off', SCREEN_W / 2, 280, { size: 20, color: C.faint, align: 'center' });

    const cols = 3, tw = 92, th = 92, gapX = (SCREEN_W - PAD * 2 - cols * tw) / (cols - 1);
    for (let i = 0; i < APPS.length; i++) {
      const app = APPS[i];
      const col = i % cols, row = Math.floor(i / cols);
      const x = PAD + col * (tw + gapX);
      const y = 380 + row * 210;
      const id = 'app-' + app.id;
      ctx.fillStyle = this.hot(id) ? this.lighten(app.color, 22) : app.color;
      this.roundRect(x, y, tw, th, 26);
      ctx.fill();
      this.appGlyph(app.id, x + tw / 2, y + th / 2, this.hot(id));
      this.text(app.label, x + tw / 2, y + th + 34, { size: 20, color: C.dim, align: 'center' });
      this.hit(id, x - 10, y - 10, tw + 20, th + 46, () => this.openApp(app.id));
    }

    // the dock: phone, back, and the honest battery line
    const dy = 860;
    ctx.fillStyle = 'rgba(19,27,38,0.72)';
    this.roundRect(PAD, dy, SCREEN_W - PAD * 2, 96, 30);
    ctx.fill();
    this.text('P', PAD + 40, dy + 60, { size: 30, weight: 600, color: C.accent, align: 'center' });
    this.text('put the phone away', PAD + 78, dy + 60, { size: 22, color: C.dim });
    this.text(this.battery + '%', SCREEN_W - PAD - 34, dy + 60, {
      size: 22, weight: 600, color: this.battery > 20 ? C.dim : C.red, align: 'right',
    });
  }

  lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + amt);
    const g = Math.min(255, ((n >> 8) & 255) + amt);
    const b = Math.min(255, (n & 255) + amt);
    return `rgb(${r},${g},${b})`;
  }

  appGlyph(id, cx, cy, hot) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(240,246,252,0.94)';
    ctx.fillStyle = 'rgba(240,246,252,0.94)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    if (id === 'messages') {
      this.roundRect(cx - 22, cy - 16, 44, 30, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 14);
      ctx.lineTo(cx - 12, cy + 24);
      ctx.lineTo(cx + 2, cy + 14);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'calendar') {
      this.roundRect(cx - 21, cy - 19, 42, 38, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 21, cy - 6);
      ctx.lineTo(cx + 21, cy - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 24); ctx.lineTo(cx - 10, cy - 14);
      ctx.moveTo(cx + 10, cy - 24); ctx.lineTo(cx + 10, cy - 14);
      ctx.stroke();
    } else if (id === 'gallery') {
      this.roundRect(cx - 21, cy - 17, 42, 34, 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy + 10);
      ctx.lineTo(cx - 4, cy - 4);
      ctx.lineTo(cx + 5, cy + 6);
      ctx.lineTo(cx + 12, cy - 1);
      ctx.lineTo(cx + 18, cy + 10);
      ctx.stroke();
    } else if (id === 'camera') {
      this.roundRect(cx - 21, cy - 13, 42, 28, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 13); ctx.lineTo(cx - 4, cy - 20);
      ctx.lineTo(cx + 4, cy - 20); ctx.lineTo(cx + 8, cy - 13);
      ctx.stroke();
    } else if (id === 'settings') {
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
        ctx.lineTo(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21);
        ctx.stroke();
      }
    } else if (id === 'pong') {
      ctx.fillRect(cx - 18, cy - 14, 5, 28);
      ctx.fillRect(cx + 13, cy - 14, 5, 28);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  openApp(id) {
    this.view = id;
    this.dirty = true;
    this.say(id === 'pong' ? 'Pong. Tap the court to move.' : '', 1600);
    if (id === 'pong') this.startPong();
  }

  goHome() {
    this.view = 'home';
    this.dirty = true;
    if (this.pong.live) this.pong.live = false;
  }

  header(title) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(12,17,24,0.9)';
    ctx.fillRect(0, 72, SCREEN_W, 78);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 150); ctx.lineTo(SCREEN_W, 150);
    ctx.stroke();

    if (this.hot('back')) {
      ctx.fillStyle = 'rgba(80,120,160,0.18)';
      this.roundRect(20, 82, 64, 58, 14);
      ctx.fill();
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(58, 96); ctx.lineTo(40, 111); ctx.lineTo(58, 126);
    ctx.stroke();
    this.hit('back', 20, 82, 64, 58, () => this.goHome());

    this.text(title, SCREEN_W / 2, 121, { size: 27, weight: 600, align: 'center' });
  }

  // ---- apps ----------------------------------------------------------------

  drawMessages() {
    const ctx = this.ctx;
    this.statusBar();
    this.header('Pico');

    const bx = PAD, bw = SCREEN_W - PAD * 2;
    ctx.fillStyle = 'rgba(28,40,54,0.95)';
    this.roundRect(bx, 200, bw, 210, 22);
    ctx.fill();
    this.text('Pico', bx + 26, 240, { size: 21, weight: 600, color: C.accent });
    this.text('Yesterday 23:41', SCREEN_W - PAD - 26, 240, { size: 18, color: C.faint, align: 'right' });
    this.wrap(
      'Hey you. My phone died hours ago. If you can read this, my battery somehow held. ' +
      'Find help. Walk the road. — Pico',
      bx + 26, 278, bw - 52, 34, { size: 22, color: C.ink },
    );

    this.text('Not delivered — no service', SCREEN_W / 2, 452, {
      size: 19, color: C.faint, align: 'center',
    });

    // the reply bar is shown, and honest about why it will not send
    const ry = 900;
    ctx.fillStyle = 'rgba(19,27,38,0.85)';
    this.roundRect(PAD, ry, SCREEN_W - PAD * 2, 72, 22);
    ctx.fill();
    this.text('Message', PAD + 26, ry + 44, { size: 21, color: C.faint });
    this.text('no signal', SCREEN_W - PAD - 26, ry + 44, { size: 20, color: C.red, align: 'right' });
  }

  drawCalendar() {
    const ctx = this.ctx;
    this.statusBar();
    this.header('Calendar');
    this.text('March 2026', SCREEN_W / 2, 204, { size: 24, weight: 600, color: C.ink, align: 'center' });
    this.text('Pico — shared', SCREEN_W / 2, 236, { size: 19, color: C.faint, align: 'center' });

    let y = 292;
    for (const [date, event] of CALENDAR) {
      ctx.fillStyle = y % 2 ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.018)';
      ctx.fillRect(PAD, y - 30, SCREEN_W - PAD * 2, 68);
      this.text(date, PAD + 6, y, { size: 20, weight: 600, color: C.accent });
      this.text(event, PAD + 96, y, { size: 21, color: C.ink });
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 38); ctx.lineTo(SCREEN_W - PAD, y + 38);
      ctx.stroke();
      y += 68;
    }
  }

  drawGallery() {
    const ctx = this.ctx;
    this.statusBar();
    this.header('Gallery');
    const tw = (SCREEN_W - PAD * 2 - 20) / 3;
    for (let i = 0; i < 6; i++) {
      const x = PAD + (i % 3) * (tw + 10);
      const y = 190 + Math.floor(i / 3) * (tw + 10);
      ctx.fillStyle = '#0f151d';
      this.roundRect(x, y, tw, tw, 10);
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,110,130,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 14, y + tw - 16);
      ctx.lineTo(x + tw * 0.42, y + tw * 0.52);
      ctx.lineTo(x + tw - 14, y + tw - 16);
      ctx.stroke();
    }
    this.text('No photos yet', SCREEN_W / 2, 560, { size: 26, color: C.dim, align: 'center' });
    this.text('The camera roll is empty.', SCREEN_W / 2, 596, { size: 20, color: C.faint, align: 'center' });
  }

  drawCamera() {
    const ctx = this.ctx;
    this.statusBar();
    this.header('Camera');
    const vx = PAD + 18, vy = 200, vw = SCREEN_W - (PAD + 18) * 2, vh = 560;
    ctx.fillStyle = '#0c1118';
    this.roundRect(vx, vy, vw, vh, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,180,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // corner marks of a viewfinder with nothing behind it
    ctx.strokeStyle = 'rgba(160,190,220,0.5)';
    ctx.lineWidth = 3;
    const m = 26;
    for (const [x, y, dx, dy] of [[vx, vy, 1, 1], [vx + vw, vy, -1, 1], [vx, vy + vh, 1, -1], [vx + vw, vy + vh, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * m, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * m);
      ctx.stroke();
    }
    this.text('Camera unavailable', SCREEN_W / 2, vy + vh / 2 - 6, { size: 26, color: C.dim, align: 'center' });
    this.text('the lens is cracked', SCREEN_W / 2, vy + vh / 2 + 32, { size: 20, color: C.faint, align: 'center' });
  }

  drawSettings() {
    const ctx = this.ctx;
    this.statusBar();
    this.header('Settings');
    const rows = [
      ['Battery', this.battery + '%'],
      ['Signal', 'none'],
      ['WiFi', 'off'],
      ['Location', 'unknown'],
      ['Torch', 'hold F'],
      ['Device', 'unknown model'],
      ['Build', 'silid 0.9.1'],
    ];
    let y = 220;
    for (const [k, v] of rows) {
      this.text(k, PAD + 6, y, { size: 23, color: C.dim });
      this.text(v, SCREEN_W - PAD - 6, y, { size: 23, color: C.ink, align: 'right' });
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 30); ctx.lineTo(SCREEN_W - PAD, y + 30);
      ctx.stroke();
      y += 76;
    }
    this.text('The battery has been draining for hours.', PAD + 6, y + 20, {
      size: 19, color: C.faint,
    });
  }

  drawPong() {
    const ctx = this.ctx;
    const p = this.pong;
    const c = p.court;
    this.statusBar();
    this.header('Pong');

    ctx.fillStyle = '#060a0f';
    this.roundRect(c.x, c.y, c.w, c.h, 10);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    // centre line
    ctx.strokeStyle = 'rgba(90,120,150,0.18)';
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(c.x + c.w / 2, c.y + 12);
    ctx.lineTo(c.x + c.w / 2, c.y + c.h - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = C.ink;
    ctx.fillRect(c.x + 18, p.py, 10, 74);
    ctx.fillStyle = C.dim;
    ctx.fillRect(c.x + c.w - 28, p.ay, 10, 74);
    ctx.beginPath();
    ctx.arc(p.ball.x, p.ball.y, 7, 0, Math.PI * 2);
    ctx.fill();

    this.text(String(p.you), c.x + c.w / 2 - 46, c.y + 52, {
      size: 34, weight: 600, color: C.dim, align: 'center',
    });
    this.text(String(p.ai), c.x + c.w / 2 + 46, c.y + 52, {
      size: 34, weight: 600, color: C.dim, align: 'center',
    });
    this.text('tap the court to move', SCREEN_W / 2, c.y + c.h + 52, {
      size: 20, color: C.faint, align: 'center',
    });

    // A "at" hit is positional: the tap point matters (the paddle follows it),
    // so tap() hands the y coordinate to tapPong instead of calling fn().
    this.hit('pong-court', c.x, c.y, c.w, c.h, null, true);
  }

  // Taps in the Pong court move the paddle instead of pressing a control.
  tapPong(y) {
    this.pong.target = y;
    this.dirty = true;
  }

  wrap(str, x, y, maxW, lineH, opts) {
    const ctx = this.ctx;
    ctx.font = font(opts.weight || 400, opts.size || 22);
    const words = str.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillStyle = opts.color || C.ink;
        ctx.fillText(line, x, yy);
        line = w;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillStyle = opts.color || C.ink;
      ctx.fillText(line, x, yy);
    }
  }
}

export { APPS };
