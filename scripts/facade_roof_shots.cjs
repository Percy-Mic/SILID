// Look at the new roofline from the azotea itself: the pavilion hips, their
// overhangs and the parapet the deck is now open behind.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'reports/rebuild_roof';
const shots = [
  { name: '01_archive_hip', x: 2, z: -7.5, y: 11.6, yaw: 0, pitch: 0.12 },
  { name: '02_caretaker_hip', x: -18, z: 6.5, y: 11.6, yaw: 0, pitch: 0.14 },
  { name: '03_parapet_out', x: 14, z: 8.5, y: 11.6, yaw: 0.1, pitch: 0.05 },
  { name: '04_from_north_eave', x: -13, z: -9.6, y: 11.6, yaw: Math.PI, pitch: 0.10 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto('http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    const hemi = new T.HemisphereLight(0xc3d0dc, 0x3a3d34, 2.2);
    w.scene.add(hemi);
    const dir = new T.DirectionalLight(0xe8eef6, 2.2);
    dir.position.set(50, 90, 40);
    w.scene.add(dir);
    w.renderer.toneMappingExposure = 1.25;
  });
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(420);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
