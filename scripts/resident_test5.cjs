const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 560 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const log = (k, v) => console.log('RESULT ' + k + ' ' + JSON.stringify(v));
  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game, r = w.resident;
    const step = (s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) g.update(1 / 60); };
    const res = {};
    w.spawnAt(0, 0, 0, Math.PI, 0);
    step(0.2);

    // --- cap: scan for valid ground-floor points, place four --------------
    const pts = [];
    for (let x = -20; x <= 18 && pts.length < 8; x += 1.5) {
      for (let z = -8; z <= 8 && pts.length < 8; z += 1.5) {
        if (w.traps.valid(x, z, 0)) { pts.push([x, z]); break; }
      }
    }
    const before = w.traps.list.length;
    for (const [x, z] of pts) w.traps.place({ x, z, y: 0.002, yaw: 0, level: 'GF' });
    res.cap = { candidates: pts.length, placed: w.traps.list.length - before, max: 3 };

    // --- a real autonomous placement in patrol ---------------------------
    w.traps.clear();
    w.spawnAt(-20, 8, 0, Math.PI, 0);      // player far, on the ground floor
    r.armed = true; r.state = 'patrol'; r.pos.set(2.5, 0, 5.5); r.footY = 4.2; r.level = 'F2';
    r.trapCd = 0; r.wait = 0; r.forcePlan();
    let sawState = new Set();
    for (let i = 0; i < 60 * 40 && w.traps.list.length === 0; i++) { g.update(1 / 60); sawState.add(r.state); }
    res.autonomous_trap = { traps: w.traps.list.length, states: [...sawState].slice(0, 10), at: w.traps.list[0] ? [+w.traps.list[0].x.toFixed(1), +w.traps.list[0].z.toFixed(1), +w.traps.list[0].y.toFixed(1)] : null };

    // --- a closed door refuses the blade ---------------------------------
    const door = w.architecture.doors.find((d) => d.level === 'GF' && d.collider);
    const cx = door.axis === 'x' ? door.at : door.c;
    const cz = door.axis === 'x' ? door.c : door.at;
    const nx = door.axis === 'x' ? 0 : 1, nz = door.axis === 'x' ? 1 : 0;
    door.open = false; door.target = 0; door.mesh.rotation.y = 0; door.collider.disabled = false;
    r.pos.set(cx - nx * 0.8, 0, cz - nz * 0.8); r.footY = door.y; r.level = 'GF';
    w.spawnAt(cx + nx * 0.9, cz + nz * 0.9, door.y, 0, 0);
    r.yaw = Math.atan2(-(w.player.pos.x - r.pos.x), -(w.player.pos.z - r.pos.z));
    const t0 = w.trials();
    r.state = 'stalk'; r.attackCd = 0; r.attackPhase = 'idle';
    r.startAttack();
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    res.door_blocks_blade = { trialsBefore: t0, trialsAfter: w.trials(), phase: r.attackPhase };

    // --- a door shut in its face stuns it --------------------------------
    door.open = true; door.collider.disabled = true; door.target = door.axis === 'x' ? 1.35 : -1.35;
    r.state = 'patrol'; r.attackPhase = 'idle';
    r.pos.set(cx - nx * 1.0, 0, cz - nz * 1.0);
    w.spawnAt(cx + nx * 1.3, cz + nz * 1.3, door.y, 0, 0);
    g.player.yaw = Math.atan2(-(cx - w.player.pos.x), -(cz - w.player.pos.z));
    w.player.syncCamera();
    step(0.05);
    const target = g.nearestInteraction();
    g.interact();
    step(0.1);
    res.door_slam = { targetKind: target?.kind, state: r.state, stunT: +r.stunT.toFixed(1), message: document.getElementById('msg')?.textContent?.slice(0, 44) };
    return res;
  });
  for (const [k, v] of Object.entries(out)) log(k, v);
  console.log('ERRORS ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
