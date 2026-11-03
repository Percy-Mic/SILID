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

  const out = await p.evaluate(async () => {
    const w = window.__silid, g = w.game, r = w.resident;
    const step = (s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) g.update(1 / 60); };
    const res = {};
    w.spawnAt(0, 9.2, 0, Math.PI, 0);
    step(0.3);

    // --- hearing at a plausible range ------------------------------------
    r.state = 'patrol'; r.pos.set(2.5, 0, 5.5); r.footY = 4.2; r.level = 'F2'; r.forcePlan();
    g.noise(2.5, 4.6, 1.5, 9);            // 4 m away in the same hall
    step(0.2);
    res.heard = { state: r.state, target: r.lastKnown && [+r.lastKnown.x.toFixed(1), +r.lastKnown.z.toFixed(1)] };

    // --- losing sight: stalk -> search -> return --------------------------
    r.state = 'stalk';
    r.lastKnown = { x: 2.5, y: 4.2, z: 1.5, level: 'F2' };
    r.memory = 0.3; r.canSee = false; r.lostT = 0;
    const trail = [];
    for (let i = 0; i < 60 * 16; i++) {
      g.update(1 / 60);
      if (i % 60 === 0) trail.push(r.state);
    }
    res.lose_trail = [...new Set(trail)];

    // --- a closed door blocks sight and the blade -------------------------
    const door = w.architecture.doors.find((d) => d.level === 'F2' && d.collider);
    if (door) {
      door.open = false; door.target = 0; door.mesh.rotation.y = 0; door.collider.disabled = false;
      const cx = door.axis === 'x' ? door.at : door.c;
      const cz = door.axis === 'x' ? door.c : door.at;
      const nx = door.axis === 'x' ? 0 : 1, nz = door.axis === 'x' ? 1 : 0;
      r.pos.set(cx - nx * 1.2, 0, cz - nz * 1.2); r.footY = door.y; r.level = 'F2';
      w.spawnAt(cx + nx * 1.2, cz + nz * 1.2, door.y, 0, 0);
      r.yaw = Math.atan2(-(w.player.pos.x - r.pos.x), -(w.player.pos.z - r.pos.z));
      r.state = 'stalk'; r.canSee = false;
      step(0.6);
      res.closed_door = { canSee: r.canSee, trials: w.trials() };
    }

    // --- the fifth trial ends the run -------------------------------------
    g.invulnT = 0; g.caughtActive = false; g.trialsLeft = 1; g.state.trials = 1; g.updateTrialsHud();
    w.hitPlayer();
    step(2.2);                                            // the blackout runs on the game clock
    res.fifth = {
      trials: w.trials(), gameOver: g.state.gameOver,
      overlay: !!document.getElementById('gameover'),
      playerEnabled: w.player.enabled,
      residentState: r.state,
      residentRuns: (() => { const before = [r.pos.x, r.pos.z]; step(2); return Math.hypot(r.pos.x - before[0], r.pos.z - before[1]) > 0.01; })(),
    };
    return res;
  });
  for (const [k, v] of Object.entries(out)) log(k, v);

  // --- restart through the real button ------------------------------------
  const btn = await p.evaluate(() => {
    const r = document.getElementById('go-restart').getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  });
  await p.mouse.click(btn[0], btn[1]);
  await p.waitForTimeout(500);
  const rs = await p.evaluate(() => {
    const w = window.__silid, g = w.game;
    let groups = 0, meshes = 0;
    w.scene.traverse((o) => { if (o.name === 'Resident') groups++; if (/^Resident_/.test(o.name)) meshes++; });
    return {
      trials: w.trials(), gameOver: g.state.gameOver,
      overlay: !!document.getElementById('gameover'),
      hudOn: document.querySelectorAll('#trials i.on').length,
      groups, meshes, traps: w.traps.list.length,
      residentState: w.resident.state,
      player: [+w.player.pos.x.toFixed(1), +w.player.footY.toFixed(2), +w.player.pos.z.toFixed(1)],
      enabled: w.player.enabled,
    };
  });
  log('restart', rs);
  console.log('ERRORS ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
