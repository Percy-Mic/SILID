// The drawing-room bay, before and after the shutter change: straight on at the
// two south windows, and a three-quarter from inside so the leaves can be seen
// against the wall they are now hung on.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = '.tmp_ext/bayfix';

const shots = [
  { name: 'straight', x: 17.0, z: 11.8, yaw: Math.PI, pitch: 0.02 },
  { name: 'angle', x: 19.4, z: 12.2, yaw: 2.35, pitch: 0.05 },
  { name: 'outside', x: 17.0, z: 17.6, yaw: Math.PI, pitch: 0.10 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xbdccdc, 0x3a3d34, 2.6));
    const d = new T.DirectionalLight(0xe8eef6, 2.0);
    d.position.set(60, 90, 70);
    w.scene.add(d);
    w.renderer.toneMappingExposure = 1.5;
  });
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
