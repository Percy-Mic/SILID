// Side elevation of the stair: from the hall east of the well, looking west at
// the flights, and up the flight, so the stringer/plaster join can be judged.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '.tmp_stair';
const shots = [
  { name: 'side_west', x: -1.6, z: 7.4, y: 0, yaw: Math.PI / 2, pitch: 0.22 },
  { name: 'side_west_low', x: -1.2, z: 9.6, y: 0, yaw: Math.PI / 2, pitch: 0.10 },
  { name: 'f2_down', x: -3.9, z: 10.4, y: 4.2, yaw: 0, pitch: -0.42 },
  { name: 'f3_down', x: -3.9, z: 10.4, y: 8.0, yaw: 0, pitch: -0.45 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xc8d4de, 0x3a3d34, 2.2));
    const dir = new T.DirectionalLight(0xe8eef6, 1.4); dir.position.set(20, 40, 30); w.scene.add(dir);
    w.renderer.toneMappingExposure = 1.5;
  });
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      if (w.player.flash) w.player.flash.visible = true;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
