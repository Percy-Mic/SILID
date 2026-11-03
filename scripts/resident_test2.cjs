// Drives the real Game.update in fixed steps (headless rAF is throttled to
// ~1 fps in the background, so a wall-clock test measures nothing).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const log = (k, v) => console.log('RESULT ' + k + ' ' + JSON.stringify(v));

  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game, r = w.resident;
    const step = (s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) g.update(1 / 60); };
    const res = {};

    // --- patrol -----------------------------------------------------------
    w.spawnAt(0, 9.2, 0, Math.PI, 0);
    step(0.3);
    res.armed = { state: r.state, armed: r.armed, vis: r.group.visible, pos: [+r.pos.x.toFixed(2), +r.pos.z.toFixed(2)] };
    step(6);
    res.patrol = {
      pos: [+r.pos.x.toFixed(2), +r.pos.z.toFixed(2)],
      moved: +Math.hypot(r.pos.x - 2.5, r.pos.z - 5.5).toFixed(2),
      state: r.state, path: r.path.length, idx: r.pathIdx, level: r.level,
    };

    // --- hearing: a noise on the other side of the hall -------------------
    r.state = 'patrol'; r.pos.set(2.5, 0, 5.5); r.footY = 4.2; r.level = 'F2';
    r.forcePlan();
    g.noise(-2, 4.5, -6, 9);
    step(0.2);
    res.heard = { state: r.state, lastKnown: r.lastKnown && [+r.lastKnown.x.toFixed(1), +r.lastKnown.z.toFixed(1)] };

    // --- sight is blocked by a wall ---------------------------------------
    // stand the player in the master bedroom with the wall between them
    r.state = 'patrol'; r.pos.set(-6.4, 0, 1.0); r.footY = 4.2; r.yaw = 0;
    w.spawnAt(-6.4, -3.2, 4.2, 0, 0);
    step(1.0);
    res.sight_through_wall = { canSee: r.canSee, trials: w.trials() };

    // --- one attack takes exactly one trial -------------------------------
    const t0 = w.trials();
    w.spawnAt(0.9, 5.5, 4.2, 0, 0);      // 1.6 m east of the body, same floor
    r.pos.set(0, 0, 5.5); r.footY = 4.2;
    r.yaw = Math.atan2(-(w.player.pos.x - r.pos.x), -(w.player.pos.z - r.pos.z));
    r.state = 'stalk'; r.attackCd = 0; r.forcePlan();
    const seq = [];
    let lost = null;
    for (let i = 0; i < 240; i++) {
      g.update(1 / 60);
      if (i % 6 === 0) seq.push(r.state + '/' + r.attackPhase);
      if (w.trials() < t0) { lost = i / 60; break; }
    }
    res.attack = {
      from: t0, to: w.trials(), secondsToHit: lost === null ? null : +lost.toFixed(2),
      phases: [...new Set(seq)].slice(0, 8),
      invuln: +g.invulnT.toFixed(2),
    };
    return res;
  });
  for (const [k, v] of Object.entries(out)) log(k, v);
  console.log('ERRORS ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
