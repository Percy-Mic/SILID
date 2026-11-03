const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true }); const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.props.placed.filter(q => q.room === 'GF-14')), null, 1));
  await b.close();
})();
