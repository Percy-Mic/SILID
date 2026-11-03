// Chase/debug probe: why a stalk can fail to close, and where a wire can be cut.
// One boot, several scenarios, numbers only.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });

  const out = await page.evaluate(() => {
    const w = window.__silid, g = w.game, r = w.resident;
    const step = (s) => { const n = Math.max(1, Math.round(s * 60)); for (let i = 0; i < n; i++) g.update(1 / 60); };
    const res = { cases: [] };

    const caseAt = (label, px, pz, py, yaw, rx, rz, ry, level) => {
      w.spawnAt(px, pz, py, yaw, 0);
      r.armed = true;
      r.pos.set(rx, 0, rz); r.footY = ry; r.level = level;
      r.state = 'stalk'; r.attackCd = 0; r.attackPhase = 'idle';
      r.canSee = false; r.memory = 7; r.lostT = 0; r.repathT = 0;
      r.lastKnown = { x: px, y: py + 1.6, z: pz, level };
      r.yaw = Math.atan2(-(px - rx), -(pz - rz));
      const plan = r.planTo(px, pz, level);
      const before = { x: r.pos.x, z: r.pos.z };
      const states = new Set();
      const phases = new Set();
      let canSeeTicks = 0, minD = 99, hitAt = null;
      const t0 = g.trialsLeft;
      for (let i = 0; i < 60 * 10; i++) {
        g.update(1 / 60);
        states.add(r.state);
        if (r.attackPhase !== 'idle') phases.add(r.attackPhase);
        if (r.canSee) canSeeTicks++;
        minD = Math.min(minD, Math.hypot(w.player.pos.x - r.pos.x, w.player.pos.z - r.pos.z));
        if (g.trialsLeft !== t0 && hitAt === null) hitAt = +(i / 60).toFixed(2);
      }
      res.cases.push({
        label,
        plan: plan.length,
        moved: +Math.hypot(r.pos.x - before.x, r.pos.z - before.z).toFixed(2),
        minD: +minD.toFixed(2),
        canSeeTicks,
        states: [...states],
        phases: [...phases],
        hitAt,
        trials: [t0, g.trialsLeft],
      });
    };

    // foyer, clear line
    caseAt('foyer', 0, 9.2, 0, 0, 0, 5.8, 0, 'GF');
    // foyer, enemy off-axis
    caseAt('foyer-side', 0, 9.2, 0, 0, -2.4, 6.4, 0, 'GF');
    // F2 hall, where the trap tests ran
    caseAt('f2-hall', 2.5, 1.5, 4.2, Math.PI, 2.5, 5.5, 4.2, 'F2');
    // dining room / gallery, ground floor
    caseAt('gf-west', -8, 4, 0, 0, -8, 7.5, 0, 'GF');

    // ---- a wire within arm's reach, cut ------------------------------------
    g.traps.clear();
    let trap = null, at = null;
    for (const [x, z] of [[1.2, 6.2], [0, 6.2], [-1.2, 6.2], [0, 5.6]]) {
      if (g.traps.valid(x, z, 0)) { trap = g.traps.place({ x, z, y: 0, level: 'GF' }); at = { x, z }; break; }
    }
    if (trap) {
      w.spawnAt(at.x, at.z + 1.0, 0, 0, -0.5);
      g.update(0.05);
      const target = g.nearestInteraction();
      const before = g.traps.list.length;
      g.interact();
      res.disarm = {
        at,
        targetKind: target?.kind ?? null,
        targetName: target?.name ?? null,
        before,
        after: g.traps.list.length,
      };
    }

    // ---- does patrol ever reach the ground floor? --------------------------
    g.traps.clear();
    w.spawnAt(0, 9.2, 0, 0, 0);
    r.reset();
    step(0.2);
    const seen = new Set();
    let groundTicks = 0;
    for (let i = 0; i < 60 * 90; i++) {
      g.update(1 / 60);
      seen.add(r.state + '@' + r.level);
      if (r.level === 'GF' && r.state !== 'dormant') groundTicks++;
    }
    res.patrol90 = { states: [...seen], groundSeconds: +(groundTicks / 60).toFixed(1), pos: [+r.pos.x.toFixed(1), +r.pos.z.toFixed(1)] };
    return res;
  });

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close().catch(() => {});
})();
