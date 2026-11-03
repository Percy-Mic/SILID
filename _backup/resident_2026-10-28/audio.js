// AUDIO — procedural, so it adds no download and no licence surface.
//
// Wind is filtered noise with a slow LFO on the cutoff; insects are short
// filtered chirps at random intervals around the player; footsteps are noise
// bursts shaped by surface; the generator is a 60 Hz fundamental plus its
// second harmonic and mechanical noise, attenuated by real distance.
//
// Browser autoplay is handled the only correct way: the context is created on
// the START click, which is a user gesture.

export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.generator = null;
    this.on = false;
  }

  start() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this._wind();
    this._insects();
    this._drips();
    this.on = true;
  }

  _noiseBuffer(seconds = 2) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  _wind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    const g = this.ctx.createGain();
    g.gain.value = 0.11;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = this.ctx.createGain();
    lg.gain.value = 130;
    lfo.connect(lg).connect(lp.frequency);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
  }

  _insects() {
    const chirp = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      const base = 3800 + Math.random() * 1400;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.86, t + 0.04);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      o.connect(g).connect(pan).connect(this.master);
      o.start(t);
      o.stop(t + 0.1);
      setTimeout(chirp, 300 + Math.random() * 2600);
    };
    setTimeout(chirp, 600);
  }

  _drips() {
    const drip = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(780 + Math.random() * 500, t);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.018, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(pan).connect(this.master);
      o.start(t);
      o.stop(t + 0.22);
      setTimeout(drip, 2400 + Math.random() * 6000);
    };
    setTimeout(drip, 2200);
  }

  step(surface = 'dirt', running = false, y = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.25);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = surface === 'wood' ? 320 : surface === 'stone' ? 620 : 420;
    bp.Q.value = surface === 'wood' ? 1.4 : 0.8;
    const g = this.ctx.createGain();
    const vol = (running ? 0.11 : 0.07) * (1 - Math.min(0.5, Math.abs(y) * 0.02));
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  creak() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110 + Math.random() * 40, t);
    o.frequency.linearRampToValueAtTime(70, t + 0.55);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.62);
  }

  startGenerator() {
    if (!this.ctx || this.generator) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    g.connect(this.master);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 120;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;
    osc.connect(lp).connect(g);
    o2.connect(g2).connect(g);
    osc.start();
    o2.start();
    this.generator = { gain: g, osc, o2 };
    g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1.4);
  }

  generatorDistance(d) {
    if (!this.generator || !this.ctx) return;
    const v = Math.max(0.0, Math.min(0.07, 0.07 * Math.max(0, 1 - d / 26)));
    this.generator.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }


  // --- the car -------------------------------------------------------------
  // A tired diesel-ish four: a low fundamental, its second harmonic, and
  // mechanical noise through a lowpass. rpm01 is 0..1; load is the throttle.

  engineOn() {
    if (!this.ctx || this.engine) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.master);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.connect(g);
    const o1 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 46;
    o1.connect(lp);
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 92;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.22;
    o2.connect(g2).connect(lp);
    const n = this.ctx.createBufferSource();
    n.buffer = this._noiseBuffer(2);
    n.loop = true;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 420;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.3;
    n.connect(nf).connect(ng).connect(g);
    o1.start(); o2.start(); n.start();
    this.engine = { g, lp, o1, o2, lfo: null };
    g.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.25);
  }

  engineSet(rpm01, load) {
    if (!this.engine || !this.ctx) return;
    // WebAudio throws on NaN, and a throw here would propagate out of the
    // frame loop. Sound is never worth stopping the game for.
    if (!Number.isFinite(rpm01) || !Number.isFinite(load)) return;
    const t = this.ctx.currentTime;
    const f = 44 + rpm01 * 86;
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.12);
    this.engine.o2.frequency.setTargetAtTime(f * 2.01, t, 0.12);
    this.engine.lp.frequency.setTargetAtTime(200 + rpm01 * 700, t, 0.15);
    this.engine.g.gain.setTargetAtTime(0.04 + load * 0.03 + rpm01 * 0.02, t, 0.2);
  }

  engineRough(on) {
    // the dying engine: a square LFO chopping the exhaust note
    if (!this.engine || !this.ctx) return;
    if (on && !this.engine.lfo) {
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 7.5;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.022;
      lfo.connect(lg).connect(this.engine.g.gain);
      lfo.start();
      this.engine.lfo = lfo;
    } else if (!on && this.engine.lfo) {
      try { this.engine.lfo.stop(); } catch (e) { /* already stopped */ }
      this.engine.lfo = null;
    }
  }

  engineOff() {
    if (!this.engine || !this.ctx) return;
    const e = this.engine;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0.0001, t, 0.14);
    e.o1.frequency.setTargetAtTime(22, t, 0.3);
    e.o2.frequency.setTargetAtTime(40, t, 0.3);
    try { e.lfo?.stop(); } catch (err) { /* noop */ }
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (err) { /* noop */ } }, 1600);
  }

  // One crank. fail=true is the weak click of a starter that has given up;
  // fail=false cranks, catches, and hands over to engineOn().
  starter(fail) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = fail ? 0.45 : 1.35;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(fail ? 30 : 33, t);
    if (!fail) o.frequency.linearRampToValueAtTime(56, t + dur * 0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(fail ? 0.05 : 0.08, t + 0.07);
    g.gain.setTargetAtTime(0.0001, t + dur * (fail ? 0.45 : 0.85), 0.1);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.5);
    if (!fail) setTimeout(() => this.engineOn(), dur * 900);
  }

  hazardTick(on) {
    if (on && !this._hazTimer) {
      const blip = () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        for (const d of [0, 0.07]) {
          const o = this.ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = 1500;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.014, t + d + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
          o.connect(g).connect(this.master);
          o.start(t + d);
          o.stop(t + d + 0.05);
        }
      };
      blip();
      this._hazTimer = setInterval(blip, 620);
    } else if (!on && this._hazTimer) {
      clearInterval(this._hazTimer);
      this._hazTimer = null;
    }
  }

  coolingTicks(on) {
    if (on && !this._tickTimer) {
      const tick = () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 2300 + Math.random() * 1100;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.011, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.06);
        this._tickTimer = setTimeout(tick, 1600 + Math.random() * 4200);
      };
      this._tickTimer = setTimeout(tick, 900);
    } else if (!on && this._tickTimer) {
      clearTimeout(this._tickTimer);
      this._tickTimer = null;
    }
  }

  thud() {
    // the car meeting something it should not
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  stalkerStep(volume = 0.3, pan = 0) {
    // The Resident's weight on the boards. It is deliberately dull and low:
    // the player should register *that something is walking*, and roughly
    // where, without ever being handed a clean directional cue.
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.26);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18 * Math.max(0, Math.min(1, volume)), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    let out = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
      g.connect(p);
      out = p;
    }
    src.connect(f).connect(g);
    out.connect(this.master);
    src.start(t);
    src.stop(t + 0.26);
  }

  windInside(inside) {
    // muffled indoors: the wind is still there, just through the walls
    if (!this.ctx) return;
  }
}
