const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const r = await p.evaluate(() => {
    const w = window.__silid, pl = w.player;
    // open every door on the west wall (x = -24) and walk out through it
    for (const d of w.architecture.doors) {
      if (d.axis === 'z' && Math.abs(d.c + 24) < 0.02) {
        d.open = true; d.target = 1;
        if (d.collider) d.collider.disabled = true;
      }
    }
    w.spawnAt(-22.8, 6, null, Math.PI / 2, 0);
    pl.enabled = true;
    pl.keys.KeyW = true;
    for (let i = 0; i < 400; i++) pl.update(0.02, w.game);
    pl.keys.KeyW = false;
    return { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2) };
  });
  console.log('west door walk-out:', JSON.stringify(r));
  await b.close();
})();
