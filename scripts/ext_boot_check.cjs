// What did the facade build report, and what is in the scene?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => logs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 300)));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 }).catch(() => logs.push('NEVER READY'));
  const info = await page.evaluate(() => {
    const w = window.__silid;
    const out = { facade: w.facade ?? w.architecture?.facade ?? null, meshes: {} };
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!/^Facade/i.test(o.name)) return;
      const p = o.geometry?.attributes?.position;
      out.meshes[o.name] = p ? p.count / 3 : 'no-geometry';
    });
    out.slateCount = w.scene.children.filter((o) => o.name === 'FacadeSlate').length;
    return out;
  });
  console.log(JSON.stringify({ info, logs: logs.slice(-12) }, null, 1));
  await browser.close();
})();
