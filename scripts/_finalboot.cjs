// Final cold-boot check: real page, real renderer, console watched.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  const m = await p.evaluate(() => window.__silid.metrics());
  console.log(JSON.stringify({ errs, calls: m.calls, triangles: m.triangles, textures: m.textures, doors: m.doors, missingDoors: m.missingDoors }));
  await b.close();
})();
