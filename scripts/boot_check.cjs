const { chromium } = require('playwright');
(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('console', (m) => console.log(((Date.now()-t0)/1000).toFixed(1)+'s', m.type(), m.text().slice(0,200)));
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('dom', ((Date.now()-t0)/1000).toFixed(1));
  try {
    await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 270000, polling: 1000 });
    console.log('READY', ((Date.now()-t0)/1000).toFixed(1));
    console.log(JSON.stringify(await p.evaluate(() => window.__silid.metrics())));
  } catch (e) { console.log('NOTREADY', e.message); }
  await b.close();
})();
