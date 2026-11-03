// THE EXTERIOR, as the walker actually sees it.
//
// The mansion is only ever viewed from the ground in play: through the trees on
// the drive, from the gravel, and from the road. These are those views. The
// scene is a night scene, so a temporary, flat inspection light is added for
// the shot and removed again — otherwise every frame is a black silhouette and
// no facade decision can be judged. Nothing here changes the game.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/exterior';
const DEBUG_LIGHT = process.env.SILID_LIT !== '0';

// The camera looks down its own -Z, so yaw = atan2(-dx, -dz) for a look from
// (cx, cz) to (tx, tz): yaw 0 faces north-of-the-camera... i.e. straight at the
// south face (z = +11) when standing south of it. Pitch is positive upwards.
const shots = [
  { name: 'south_elevation', x: 0, z: 58, yaw: 0, pitch: 0.20 },
  { name: 'south_threequarter', x: 34, z: 44, yaw: 0.735, pitch: 0.18 },
  { name: 'west_threequarter', x: -42, z: 40, yaw: -0.862, pitch: 0.18 },
  { name: 'entry_close', x: 0, z: 26, yaw: 0, pitch: 0.16 },
  { name: 'east_face', x: 52, z: 4, yaw: Math.PI / 2, pitch: 0.18 },
  { name: 'north_face', x: 0, z: -48, yaw: Math.PI, pitch: 0.18 },
  { name: 'from_drive', x: -27, z: 52, yaw: -0.497, pitch: 0.10 },
  { name: 'front_mid', x: 0, z: 42, yaw: 0, pitch: 0.30 },
  { name: 'tower_close', x: 34, z: 26, yaw: 0.95, pitch: 0.34 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1200);

  if (DEBUG_LIGHT) {
    await page.evaluate(() => {
      const w = window.__silid;
      const T = w.THREE;
      const hemi = new T.HemisphereLight(0xbdccdc, 0x3a3d34, 3.2);
      hemi.name = 'PROBE_Hemi';
      w.scene.add(hemi);
      const dir = new T.DirectionalLight(0xe8eef6, 2.2);
      dir.position.set(70, 110, 60);
      dir.name = 'PROBE_Dir';
      w.scene.add(dir);
      const fill = new T.DirectionalLight(0x9fb0c4, 0.7);
      fill.position.set(-60, 40, -80);
      fill.name = 'PROBE_Fill';
      w.scene.add(fill);
      if (w.renderer) w.renderer.toneMappingExposure = 1.6;
    });
  }

  const rows = [];
  for (const s of shots) {
    const info = await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
      return {
        y: +w.camera.position.y.toFixed(2),
        eye: [+w.camera.position.x.toFixed(1), +w.camera.position.z.toFixed(1)],
      };
    }, s);
    await page.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    rows.push({ shot: s.name, ...info });
    console.log('shot', s.name, JSON.stringify(info));
  }

  console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  console.log(JSON.stringify(rows));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
