const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const s = window.__silid;
    return {
      count: s.cabinets.count,
      errors: s.cabinets.errors,
      units: s.cabinets.units.map(u => ({ label: u.label, x:+u.x.toFixed(2), z:+u.z.toFixed(2), rot:+u.rot.toFixed(2), drawers:u.drawers.length, room:u.room })),
    };
  });
  console.log(JSON.stringify({out, errs}, null, 1));
  await b.close();
})();
