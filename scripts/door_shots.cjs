// Door leaves, photographed where the player meets them.
//
// A flat inspection light is added for the shots and removed afterwards: the
// house is a night scene and every doorway would otherwise be a black slot.
// Nothing here changes the game — the leaves keep their styles, hinges and
// materials; the camera is simply stood in front of them at eye height.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/doors';

const key = (level, axis, at, c) => ({ level, axis, at, c });

// yaw = atan2(-dx, -dz) for a look from (x,z) toward the door centre
const shots = [
  // the portico stands between the piers at z 13.4 and the drive beyond, so the
  // entrance is photographed from inside that bay, not through a column
  { name: 'entrance_elevation', x: 8, z: 30, yaw: 0.12, pitch: 0.13 },
  { name: 'entrance_closed', x: 0, z: 14.7, yaw: 0, pitch: -0.03 },
  { name: 'entrance_hardware', x: 0.55, z: 12.6, yaw: 0, pitch: -0.20 },
  { name: 'entrance_open_center', x: 0, z: 14.2, yaw: 0, pitch: 0.0, door: key('GF', 'x', 0, 11), open: true },
  { name: 'entrance_open_from_foyer', x: 0.4, z: 8.6, yaw: Math.PI + 0.1, pitch: 0.0, door: key('GF', 'x', 0, 11), open: true },
  { name: 'entrance_open_from_porch', x: 2.4, z: 16.4, yaw: 0.30, pitch: 0.0, door: key('GF', 'x', 0, 11), open: true },
  { name: 'bedroom_closed', x: -15.4, z: 9.5, yaw: Math.PI / 2, pitch: -0.02, door: key('GF', 'z', 9.5, -17) },
  { name: 'bedroom_open', x: -15.3, z: 9.2, yaw: Math.PI / 2 - 0.22, pitch: -0.02, door: key('GF', 'z', 9.5, -17), open: true },
  { name: 'service_kitchen', x: -15.4, z: -4.8, yaw: Math.PI / 2, pitch: -0.02, door: key('GF', 'z', -4.8, -17) },
  { name: 'bath_dressing', x: 5, z: -4.5, yaw: 0, pitch: -0.02, door: key('F2', 'x', 5, -6) },
  { name: 'utility_basement', x: -18, z: -3.9, yaw: 0, pitch: -0.02, door: key('B1', 'x', -18, -5.4) },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    const hemi = new T.HemisphereLight(0x9fadb8, 0x33322c, 2.1);
    hemi.name = 'PROBE_Hemi';
    w.scene.add(hemi);
    const dir = new T.DirectionalLight(0xffe6c4, 1.5);
    dir.position.set(6, 12, 14);
    dir.name = 'PROBE_Dir';
    w.scene.add(dir);
    const fill = new T.DirectionalLight(0x8fa2b4, 0.5);
    fill.position.set(-8, 5, -12);
    fill.name = 'PROBE_Fill';
    w.scene.add(fill);
    w.renderer.toneMappingExposure = 1.35;
  });

  const rows = [];
  for (const s of shots) {
    const state = await page.evaluate((s) => {
      const w = window.__silid;
      const A = w.architecture;
      for (const d of A.doors) {
        const want = s.door && d.level === s.door.level && d.axis === s.door.axis
          && Math.abs(d.at - s.door.at) < 0.01 && Math.abs(d.c - s.door.c) < 0.01;
        const open = !!want && !!s.open;
        d.open = open;
        d.target = open ? (d.swingSign ?? (d.axis === 'x' ? 1 : -1)) * 1.35 : 0;
        if (d.mesh2) d.target2 = -d.target;
        d.mesh.rotation.y = d.target;
        if (d.mesh2) d.mesh2.rotation.y = d.target2;
        if (d.collider) d.collider.disabled = open;
      }
      const target = s.door && A.doors.find((d) => d.level === s.door.level && d.axis === s.door.axis
        && Math.abs(d.at - s.door.at) < 0.01 && Math.abs(d.c - s.door.c) < 0.01);
      w.spawnAt(s.x, s.z, target ? target.y + 0.02 : null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
      return { y: +w.camera.position.y.toFixed(2), eye: [+w.camera.position.x.toFixed(1), +w.camera.position.z.toFixed(1)] };
    }, s);
    await page.waitForTimeout(320);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    rows.push({ shot: s.name, ...state });
    console.log('shot', s.name, JSON.stringify(state));
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
