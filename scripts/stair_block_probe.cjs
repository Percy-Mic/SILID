const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, pl = w.player, g = w.game;
    const near = w.architecture.colliders.filter((c) =>
      Math.max(c.x1, c.x2) > -5.1 && Math.min(c.x1, c.x2) < -3.0 &&
      Math.max(c.z1, c.z2) > 8.2 && Math.min(c.z1, c.z2) < 9.0);
    const floors = [];
    for (const z of [9.5, 9.19, 9.0, 8.75, 8.5, 8.0, 7.0, 6.2]) {
      floors.push({ z, floor0: w.floorAt(-4.29, z, 0), floor04: w.floorAt(-4.29, z, 0.4) });
    }
    // walk one step at a time from z 9.6 and log
    pl.teleport(-4.29, 9.6, null); pl.yaw = 0; pl.syncCamera(); g.update(0.05);
    const trace = [];
    for (let i = 0; i < 60; i++) {
      pl.keys.KeyW = true; pl.update(0.05, g); g.update(0.05); pl.keys.KeyW = false;
      if (i % 6 === 0) trace.push({ z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2), blockedNext: pl.blocked(pl.pos.x, pl.pos.z - 0.05) });
    }
    return { near: near.slice(0, 12), floors, trace };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
