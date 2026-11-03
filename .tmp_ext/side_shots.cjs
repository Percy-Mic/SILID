// Side elevations, aimed with a look-at target instead of a hand-typed yaw.
// yaw is atan2(-dx, -dz) because the camera looks down its own -Z.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || '.tmp_ext/sides';

const ALL = [
  { name: 'west_elevation', x: -58, z: 0, at: [-24, 0], pitch: 0.16 },
  { name: 'west_threequarter', x: -50, z: 34, at: [-24, 2], pitch: 0.15 },
  { name: 'east_elevation', x: 60, z: 0, at: [22, 0], pitch: 0.16 },
  { name: 'east_a', x: 62, z: 26, at: [22, 2], pitch: 0.14 },
  { name: 'east_b', x: 52, z: -28, at: [22, -2], pitch: 0.15 },
  { name: 'east_c', x: 78, z: 6, at: [22, 0], pitch: 0.13 },
  { name: 'west_bay_close', x: -31, z: 7.2, at: [-24.8, 2.0], pitch: 0.02 },
  { name: 'west_bay_wide', x: -34, z: -4, at: [-24.6, 2.0], pitch: 0.04 },
];

const pick = process.env.SILID_SET || 'all';
const shots = pick === 'east' ? ALL.filter((s) => s.name.startsWith('east'))
  : pick === 'west' ? ALL.filter((s) => s.name.startsWith('west'))
    : ALL;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xbdccdc, 0x3a3d34, 3.2));
    const d = new T.DirectionalLight(0xe8eef6, 2.2); d.position.set(70, 110, 60); w.scene.add(d);
    const f = new T.DirectionalLight(0x9fb0c4, 0.7); f.position.set(-60, 40, -80); w.scene.add(f);
    w.renderer.toneMappingExposure = 1.6;
  });
  for (const s of shots) {
    const info = await page.evaluate((s) => {
      const w = window.__silid;
      const yaw = Math.atan2(-(s.at[0] - s.x), -(s.at[1] - s.z));
      w.spawnAt(s.x, s.z, null, yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
      return { yaw: +yaw.toFixed(2), y: +w.camera.position.y.toFixed(2) };
    }, s);
    await page.waitForTimeout(600);
    let png = null;
    for (let attempt = 0; attempt < 3 && !png; attempt++) {
      try {
        png = await cdp.send('Page.captureScreenshot', { format: 'png' });
      } catch (e) {
        console.log('retry', s.name, e.message);
        await page.waitForTimeout(700);
      }
    }
    if (!png) { console.log('FAILED', s.name); continue; }
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name, JSON.stringify(info));
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 4)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
