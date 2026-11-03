// The Resident, exercised through its own public surface in the real game.
const { chromium } = require('playwright');
const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await wait(p, 600);
  const log = (k, v) => console.log('RESULT ' + k + ' ' + JSON.stringify(v));

  // --- 1. in the house, it arms and patrols -------------------------------
  await p.evaluate(() => window.__silid.spawnAt(0, 9.2, 0, Math.PI, 0));
  await wait(p, 900);
  const a = await p.evaluate(() => {
    const w = window.__silid, r = w.resident;
    return { state: r.state, armed: r.armed, vis: r.group.visible, pos: [r.pos.x, r.pos.z], footY: r.footY };
  });
  log('armed', a);
  await wait(p, 2600);
  const p2 = await p.evaluate(() => {
    const r = window.__silid.resident;
    return { pos: [r.pos.x, r.pos.z], state: r.state, path: r.path.length, idx: r.pathIdx };
  });
  const moved = Math.hypot(p2.pos[0] - a.pos[0], p2.pos[1] - a.pos[1]);
  log('patrol_moved_m', +moved.toFixed(2));
  log('patrol_state', p2);

  // --- 2. sight is blocked by walls ---------------------------------------
  // resident on F2 interior, player in the foyer below: different floor, so
  // it must neither see nor reach
  await p.evaluate(() => {
    const w = window.__silid, r = w.resident;
    w.spawnAt(r.pos.x + 0.8, r.pos.z, r.footY, 0, 0);
    r.yaw = 0;
  });
  await wait(p, 900);
  const before = await p.evaluate(() => ({ trials: window.__silid.trials(), canSee: window.__silid.resident.canSee }));
  log('see_at_range', before);

  // --- 3. one attack, one trial -------------------------------------------
  const hit = await p.evaluate(async () => {
    const w = window.__silid, r = w.resident;
    const start = w.trials();
    let seen = new Set();
    for (let i = 0; i < 90; i++) {
      seen.add(r.state + '/' + r.attackPhase);
      if (w.trials() < start) break;
      await new Promise((res) => setTimeout(res, 80));
    }
    return { start, end: w.trials(), states: [...seen] };
  });
  log('attack', hit);

  // --- 4. burn the rest, expect a game over overlay ------------------------
  const over = await p.evaluate(async () => {
    const w = window.__silid, g = w.game;
    for (let n = 0; n < 6 && w.trials() > 0; n++) {
      g.invulnT = 0;
      g.caughtActive = false;
      w.hitPlayer();
      await new Promise((res) => setTimeout(res, 2300));
    }
    return {
      trials: w.trials(),
      gameOver: g.state.gameOver,
      overlay: !!document.getElementById('gameover'),
      playerEnabled: w.player.enabled,
    };
  });
  log('game_over', over);

  // --- 5. restart in place, no duplicate enemy ----------------------------
  await p.click('#go-restart');
  await wait(p, 700);
  const rs = await p.evaluate(() => {
    const w = window.__silid;
    let groups = 0, meshes = 0;
    w.scene.traverse((o) => { if (o.name === 'Resident') groups++; if (/^Resident_/.test(o.name)) meshes++; });
    return {
      trials: w.trials(), gameOver: w.game.state.gameOver,
      overlay: !!document.getElementById('gameover'),
      hudOn: document.querySelectorAll('#trials i.on').length,
      groups, meshes, traps: w.traps.list.length,
      player: [w.player.pos.x.toFixed(2), w.player.footY.toFixed(2), w.player.pos.z.toFixed(2)],
      enabled: w.player.enabled,
    };
  });
  log('restart', rs);

  // --- 6. it sets a trap, the trap is real, and it can be cut --------------
  const trap = await p.evaluate(async () => {
    const w = window.__silid, r = w.resident;
    // stand the player well away and force the patrol decision
    w.spawnAt(0, 9.2, 0, Math.PI, 0);
    r.trapCd = 0;
    r.state = 'patrol';
    r.stepDist = 0;
    await new Promise((res) => setTimeout(res, 400));
    r.state = 'setTrap';
    r.setTrapT = 0.05;
    await new Promise((res) => setTimeout(res, 500));
    const t = w.traps.list[0] || null;
    if (!t) return { placed: false, state: r.state };
    return {
      placed: true, x: +t.x.toFixed(2), z: +t.z.toFixed(2), y: +t.y.toFixed(2),
      mesh: t.group.children.length, inScene: !!t.group.parent,
      state: r.state,
    };
  });
  log('trap_placed', trap);

  const trig = await p.evaluate(async () => {
    const w = window.__silid;
    const t = w.traps.list[0];
    if (!t) return { skipped: true };
    const trials0 = w.trials();
    w.spawnAt(t.x, t.z, t.y, 0, 0);
    w.player.vel.set(1.2, 0, 0.4);
    await new Promise((res) => setTimeout(res, 500));
    return {
      trialsBefore: trials0, trialsAfter: w.trials(),
      stumble: +w.game.stumbleT.toFixed(2),
      residentState: w.resident.state,
      liveTraps: w.traps.list.filter((q) => q.live).length,
    };
  });
  log('trap_triggered', trig);

  // --- 7. a fresh trap can be cut with E ----------------------------------
  const cut = await p.evaluate(async () => {
    const w = window.__silid, r = w.resident;
    r.state = 'patrol'; r.footY = 4.2; r.pos.set(2.5, 0, 5.5); r.trapCd = 0;
    r.state = 'setTrap'; r.setTrapT = 0.05;
    await new Promise((res) => setTimeout(res, 500));
    const t = w.traps.list[0];
    if (!t) return { skipped: true };
    // stand 1.1 m south of it, looking at it
    w.spawnAt(t.x, t.z + 1.1, t.y, Math.PI, -0.45);
    await new Promise((res) => setTimeout(res, 250));
    const before = w.traps.list.length;
    const target = w.game.nearestInteraction();
    w.game.interact();
    await new Promise((res) => setTimeout(res, 150));
    return { before, after: w.traps.list.length, kind: target?.kind, labelKind: target?.kind };
  });
  log('trap_disarm', cut);

  console.log('ERRORS ' + JSON.stringify(errs));
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.metrics())));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
