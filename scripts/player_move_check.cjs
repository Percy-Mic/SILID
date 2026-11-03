const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 560 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const w = window.__silid, g = w.game, pl = w.player;
    w.spawnAt(0, 8.0, 0, 0, 0);
    const from = [pl.pos.x, pl.pos.z];
    pl.keys.KeyW = true;
    for (let i = 0; i < 90; i++) { pl.update(1 / 60, g); g.update(1 / 60); }
    pl.keys.KeyW = false;
    const walked = Math.hypot(pl.pos.x - from[0], pl.pos.z - from[1]);
    w.spawnAt(0, 9.2, 0, Math.PI, 0);
    g.update(1 / 60);
    const near = g.nearestInteraction();
    return {
      walked: +walked.toFixed(2),
      footY: +pl.footY.toFixed(2),
      clipped: pl.pos.y < pl.footY,
      interaction: near ? near.kind : null,
      trials: w.trials(),
      resident: w.resident.state,
      traps: w.traps.list.length,
    };
  })));
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
