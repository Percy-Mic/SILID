// Close inspection shots for the rebuilt elevation: a window bay, the entrance,
// the top band, and the roofs from above. Same inspection light as the other
// shot scripts; nothing here changes the game.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = 'reports/rebuild_close';

const shots = [
  { name: '01_window_bay', x: -8.4, z: 19, yaw: 0, pitch: 0.22 },
  { name: '02_entrance', x: 0, z: 21, yaw: 0, pitch: 0.20 },
  { name: '03_top_band', x: -6, z: 30, yaw: 0, pitch: 0.42 },
  { name: '04_roof_threequarter', x: 40, z: 34, yaw: 0.86, pitch: 0.40 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    const hemi = new T.HemisphereLight(0xbdccdc, 0x3a3d34, 2.6);
    hemi.name = 'PROBE_Hemi'; w.scene.add(hemi);
    const dir = new T.DirectionalLight(0xe8eef6, 1.8);
    dir.position.set(70, 110, 60); dir.name = 'PROBE_Dir'; w.scene.add(dir);
    const fill = new T.DirectionalLight(0x9fb0c4, 0.6);
    fill.position.set(-60, 40, -80); fill.name = 'PROBE_Fill'; w.scene.add(fill);
    w.renderer.toneMappingExposure = 1.35;
  });
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
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
