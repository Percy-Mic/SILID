// Ad-hoc look: capture a few authored viewpoints from the running game.
// usage: node scripts/_look.cjs "[name]x,z,y,yaw,pitch" ...
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = 'reports/look';
const shots = process.argv.slice(2).map((a) => {
  const [name, rest] = a.split('=');
  const [x, z, y, yaw, pitch] = rest.split(',').map(Number);
  return { name, x, z, y, yaw, pitch };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(400);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name, JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
