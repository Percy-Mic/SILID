const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log('before', JSON.stringify(await p.evaluate(() => ({
    lock: document.pointerLockElement?.tagName || null, enabled: window.__silid.player.enabled,
  }))));
  await p.mouse.click(450, 250);
  await p.waitForTimeout(300);
  console.log('after canvas click', JSON.stringify(await p.evaluate(() => ({
    lock: document.pointerLockElement?.tagName || null,
  }))));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
