const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const L = window.__silid.levels;
    return L.find((l) => l.id === 'GF').rooms.map((r) => [r.id, r.x0, r.x1, r.z0, r.z1]);
  });
  for (const r of out) console.log(r.join(' '));
  await b.close();
})();
