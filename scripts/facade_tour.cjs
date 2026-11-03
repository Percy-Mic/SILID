// Exterior tour: the mansion from the drive, both flanks and the rear, lit for
// inspection (the game's night is preserved for the last shot). Foliage is
// hidden in the lit frames only so the building can be judged.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/exterior/tour';

const SHOTS = [
  { name: 'south_front', x: 0, z: 74, yaw: 0, pitch: 0.16, day: true },
  { name: 'south_threequarter', x: 44, z: 62, yaw: 0.62, pitch: 0.14, day: true },
  { name: 'entrance_close', x: 10, z: 34, yaw: 0.30, pitch: 0.30, day: true },
  { name: 'east_flank', x: 58, z: 6, yaw: 1.48, pitch: 0.16, day: true },
  { name: 'rear_west', x: -46, z: -44, yaw: -2.42, pitch: 0.12, day: true },
  { name: 'night_from_drive', x: 0, z: 80, yaw: 0, pitch: 0.10, day: false },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) errors.push(e.message); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    window.__facadeHidden = 0;
    w.scene.traverse((o) => {
      if (o.isMesh && /tree|canop|foliage|leaf|bush|shrub|trunk|branch|fern|grass/i.test(o.name)) {
        o.visible = false; window.__facadeHidden++;
      }
    });
    const hemi = new T.HemisphereLight(0xc9d7e6, 0x3d4036, 3.0);
    hemi.name = 'ProbeHemi';
    w.scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff3e0, 3.2);
    sun.position.set(60, 95, 70);
    sun.name = 'ProbeSun';
    w.scene.add(sun);
    const fill = new T.DirectionalLight(0x9fb4c8, 1.2);
    fill.position.set(-70, 40, -55);
    fill.name = 'ProbeFill';
    w.scene.add(fill);
  });

  for (const s of SHOTS) {
    await page.evaluate((shot) => {
      const w = window.__silid;
      for (const n of ['ProbeHemi', 'ProbeSun', 'ProbeFill']) {
        const o = w.scene.getObjectByName(n);
        if (o) o.visible = shot.day;
      }
      w.renderer.toneMappingExposure = shot.day ? 1.7 : 1.25;
      w.spawnAt(shot.x, shot.z, null, shot.yaw, shot.pitch);
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
  console.log('hidden', await page.evaluate(() => window.__facadeHidden));
  console.log('metrics', JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
