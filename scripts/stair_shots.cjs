// The grand stair, photographed from the running game at the points that
// matter: the foot in the foyer, the first flight, the half landing, the
// arrivals on F2/F3/F4, and the well read from an upper corridor. Inspection
// light only; no game state is changed.
//
// Lane centres come from STAIR in src/world/plan.js: west lane x = -4.97..-3.85
// (centre -4.41), east lane x = -3.43..-2.31 (centre -2.87). Floors: GF 0,
// F2 4.2, F3 8.0, F4 11.6.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'reports/stair';
const LA = -4.41;
const LB = -2.87;
const shots = [
  { name: '01_foot', x: LA, z: 10.6, y: 0, yaw: 0, pitch: 0.17 },
  { name: '02_first_flight', x: LA, z: 8.9, y: 0.2, yaw: 0, pitch: 0.10 },
  { name: '03_half_landing', x: -4.30, z: 5.15, y: 2.1, yaw: -Math.PI / 2, pitch: -0.02 },
  { name: '04_f2_arrival', x: LB, z: 10.7, y: 4.2, yaw: 0, pitch: -0.13 },
  { name: '05_well_from_f2_hall', x: -1.9, z: 5.4, y: 4.2, yaw: Math.PI / 2, pitch: -0.22 },
  { name: '06_looking_up', x: -3.6, z: 9.1, y: 0, yaw: 0, pitch: 0.55 },
  { name: '07_f3_flight', x: LA, z: 10.0, y: 8.0, yaw: 0, pitch: 0.13 },
  { name: '08_f3_arrival', x: LB, z: 10.7, y: 8.0, yaw: 0, pitch: -0.13 },
  { name: '09_f4_arrival', x: LB, z: 10.8, y: 11.6, yaw: 0, pitch: -0.13 },
  { name: '10_f4_landing', x: -3.55, z: 9.6, y: 11.6, yaw: 0.55, pitch: -0.06 },
  { name: '11_descend_from_f3', x: LB, z: 9.9, y: 8.0, yaw: 0, pitch: -0.40 },
  { name: '12_string_wall_side', x: -1.5, z: 8.6, y: 0, yaw: Math.PI / 2, pitch: 0.26 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  // SILID_INSPECT=0 photographs the stair under the game's own night lighting
  // and the flashlight only, with no inspection rig added.
  if (process.env.SILID_INSPECT !== '0') await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    const hemi = new T.HemisphereLight(0xc8d4de, 0x3a3d34, 2.0);
    w.scene.add(hemi);
    const dir = new T.DirectionalLight(0xe8eef6, 1.2);
    dir.position.set(20, 40, 30);
    w.scene.add(dir);
    w.renderer.toneMappingExposure = 1.5;
  });
  // SILID_SHOTS=01,04 limits the run to those frames (a full pass is slow in
  // headless Chrome, and re-shooting one angle should not re-render twelve).
  const only = (process.env.SILID_SHOTS || '').split(',').filter(Boolean);
  const list = only.length ? shots.filter((s) => only.includes(s.name.slice(0, 2))) : shots;
  for (const s of list) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      if (w.player.flash) w.player.flash.visible = true;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
