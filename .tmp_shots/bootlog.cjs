const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type().toUpperCase(), m.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:5199/?probe=1');
  try {
    await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
    console.log('READY');
    console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  } catch (e) {
    console.log('NOT READY', e.message);
    console.log(await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => 'n/a'));
  }
  await browser.close();
})();
