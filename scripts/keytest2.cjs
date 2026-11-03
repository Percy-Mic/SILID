const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.bringToFront();
  await p.evaluate(() => window.__silid.spawnAt(-53.4, 27.2, null, -Math.PI/2, 0));
  await p.keyboard.down('w'); await p.waitForTimeout(1500); await p.keyboard.up('w');
  console.log(await p.evaluate(() => ({x:window.__silid.player.pos.x, z:window.__silid.player.pos.z, fps:window.__silid.game._fps})));
  await b.close();
})();
