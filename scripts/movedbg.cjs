const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.evaluate(() => window.__silid.spawnAt(-53.4, 27.2, null, -Math.PI/2, 0));
  await p.keyboard.down('w');
  const samples = [];
  for (let i=0;i<8;i++) {
    await p.waitForTimeout(200);
    samples.push(await p.evaluate(() => { const pl=window.__silid.player; return {x:+pl.pos.x.toFixed(3), z:+pl.pos.z.toFixed(3), vx:+pl.vel.x.toFixed(3), vz:+pl.vel.z.toFixed(3), fY:+pl.footY.toFixed(3), k:pl.keys.KeyW, block:pl.blocked(pl.pos.x+0.2, pl.pos.z)}; }));
  }
  await p.keyboard.up('w');
  console.log(JSON.stringify(samples,null,1));
  await b.close();
})();
