// Captures the phone interface as it actually appears on the model.
//
// Functional coverage lives in scripts/phone_ui_probe.cjs; this only takes the
// frames, through CDP because Playwright's own screenshot path stalls on this
// software GL context. Boot is slow, so the run is meant to be backgrounded.
//
// Usage: node scripts/phone_shots.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/phonescreen';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);

  const shot = async (name) => {
    const t0 = Date.now();
    await page.waitForTimeout(400);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(png.data, 'base64'));
    console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  console.log('loading');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 600000, polling: 500 });
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 120000, polling: 250 });
  console.log('ready');

  await page.evaluate(async () => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    w.spawnAt(spot.x, spot.z + 1.15, spot.surfaceY - 0.02, 0,
      Math.atan2(spot.y - (spot.surfaceY + 1.68), 1.15));
    w.game.update(0.05);
    w.game.interact();
    w.game.openPhone();
    await new Promise((r) => setTimeout(r, 800));
  });
  await shot('01_lock.png');

  await page.evaluate(async () => {
    const w = window.__silid;
    const s = w.game.phoneScreen;
    for (const k of ['6', '2', '9', '4']) s.pressKey(k);
    await new Promise((r) => setTimeout(r, 300));
  });
  await shot('02_home.png');

  await page.evaluate(async () => {
    const w = window.__silid;
    w.game.phoneScreen.openApp('messages');
    await new Promise((r) => setTimeout(r, 300));
  });
  await shot('03_messages.png');

  await page.evaluate(async () => {
    const w = window.__silid;
    w.game.phoneScreen.openApp('calendar');
    await new Promise((r) => setTimeout(r, 300));
  });
  await shot('04_calendar.png');

  await browser.close().catch(() => {});
  console.log('done');
})();
