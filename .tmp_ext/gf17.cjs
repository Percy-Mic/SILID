const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.props.placed.filter((q) => q.room === 'GF-17')), null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
