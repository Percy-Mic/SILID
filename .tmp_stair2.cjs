const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, pl = w.player, g = w.game;
    w.spawnAt(-4.29, 10.1, 0, 0, 0);
    pl.footY = 0; pl.enabled = true;
    pl.yaw = 0; // faces -z
    const rows = [];
    pl.keys.KeyW = true;
    for (let i = 0; i < 300; i++) {
      const bx = pl.pos.x, bz = pl.pos.z;
      pl.update(1/60, g); g.update(1/60);
      if (i % 12 === 0 || i > 150) {
        const ahead = w.floorAt(pl.pos.x, pl.pos.z - 0.08, pl.footY);
        rows.push([i, +pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2), +pl.footY.toFixed(2),
          ahead === null ? 'null' : +ahead.toFixed(2), +Math.hypot(pl.pos.x - bx, pl.pos.z - bz).toFixed(4)]);
      }
      if (pl.pos.z < 5.4) break;
    }
    return rows;
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
