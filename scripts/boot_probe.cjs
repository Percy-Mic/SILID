const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForTimeout(9000);
  console.log('READY:', await p.evaluate(() => !!(window.__silid && window.__silid.ready)));
  console.log('BOOT:', await p.evaluate(() => (document.getElementById('boot')?.textContent || '').slice(0, 500)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
