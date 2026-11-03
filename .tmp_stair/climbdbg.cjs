const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const log = await page.evaluate(() => {
    const w = window.__silid;
    const pl = w.player, g = w.game;
    if (g.resident) g.resident.update = () => {};
    if (g.caughtActive) { g.caughtActive = false; pl.enabled = true; }
    pl.enabled = true;
    const LA = -4.41;
    w.spawnAt(LA, 10.1, 0, 0, 0);
    pl.footY = 0;
    const rows = [];
    let prev = { x: pl.pos.x, z: pl.pos.z, y: pl.pos.y };
    for (let i = 0; i < 400; i++) {
      const dx = LA - pl.pos.x, dz = 6.2 - pl.pos.z;
      const d = Math.hypot(dx, dz);
      if (i % 20 === 0) rows.push({
        i, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2),
        y: +pl.pos.y.toFixed(2), foot: +pl.footY.toFixed(2),
        q: w.floorAt ? (() => { const v = w.floorAt(pl.pos.x, pl.pos.z, pl.footY); return v === null ? null : +v.toFixed(2); })() : 'n/a',
        moved: +Math.hypot(pl.pos.x - prev.x, pl.pos.z - prev.z).toFixed(3),
        d: +d.toFixed(2), enabled: pl.enabled, keys: Object.keys(pl.keys).filter((k) => pl.keys[k]).join(''),
      });
      prev = { x: pl.pos.x, z: pl.pos.z, y: pl.pos.y };
      pl.yaw = Math.atan2(-dx, -dz);
      pl.keys.KeyW = true;
      pl.update(0.033, g);
      g.update(0.033);
    }
    pl.keys.KeyW = false;
    return rows;
  });
  for (const r of log) console.log(JSON.stringify(r));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
