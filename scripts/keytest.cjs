const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.evaluate(() => window.__silid.spawnAt(-53.4, 27.2, null, -Math.PI/2, 0));
  await p.keyboard.down('w');
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => ({keys:{...window.__silid.player.keys}, x:window.__silid.player.pos.x, en:window.__silid.player.enabled}));
  await p.waitForTimeout(1200);
  await p.keyboard.up('w');
  const c = await p.evaluate(() => ({x:window.__silid.player.pos.x, z:window.__silid.player.pos.z, foot:window.__silid.player.footY}));
  console.log(JSON.stringify({a,c}));
  await b.close();
})();
