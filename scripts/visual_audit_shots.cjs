// VISUAL AUDIT — the frames the follow-up audit is judged on, plus a raycast
// that NAMES whatever sits in the middle and upper-middle of each frame, so a
// "round stone thing" in a screenshot can be identified as a specific mesh
// instead of guessed at.
//
// Two passes over the same camera positions: as the player sees it (night,
// torch off, no added light) and lit for geometry judgement. The inspection
// lights exist only in this probe's page. A third pass clears them so the next
// shot is not contaminated.
//
// Usage: node scripts/visual_audit_shots.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/visual_audit/live';

const shots = [
  // --- circular stair: above, below, landings, openings --------------------
  { name: 'stair_from_above', x: -4.9, z: 7.5, yaw: -Math.PI / 2, pitch: -0.38, y: 4.35 },
  { name: 'stair_from_below', x: -1.5, z: 4.0, yaw: Math.PI, pitch: 0.45, y: 0.1 },
  { name: 'stair_landing_f2', x: -4.6, z: 4.4, yaw: -2.35, pitch: -0.10, y: 4.35 },
  { name: 'stair_well_edge_f3', x: -4.9, z: 7.6, yaw: -Math.PI / 2, pitch: -0.30, y: 8.1 },
  { name: 'stair_soffit', x: -1.5, z: 7.5, yaw: Math.PI, pitch: 1.05, y: 0.1 },

  // --- slab edges, thickness, undersides -----------------------------------
  { name: 'slab_edge_gallery', x: 8.5, z: 0.0, yaw: -Math.PI / 2, pitch: -0.42, y: 4.35 },
  { name: 'soffit_basement', x: 6.0, z: -3.0, yaw: 0.6, pitch: 0.75, y: -3.4 },
  { name: 'slab_cut_f2', x: 6.0, z: 1.5, yaw: 0, pitch: -0.55, y: 4.35 },

  // --- facade: entrance, porch underside, bay, roof edge -------------------
  { name: 'entry_pillars', x: 0, z: 17.5, yaw: 0, pitch: 0.24, y: null },
  { name: 'porch_underside', x: 0, z: 13.8, yaw: 0, pitch: 0.95, y: null },
  { name: 'facade_bay_close', x: -13, z: 22, yaw: -0.42, pitch: 0.42, y: null },
  { name: 'roofline', x: 10, z: 34, yaw: 0.16, pitch: 0.52, y: null },
  { name: 'west_face_night', x: -42, z: 26, yaw: -0.72, pitch: 0.24, y: null },

  // --- the raised structure from underneath, on the ground -----------------
  { name: 'raised_from_south', x: 0, z: 15.5, yaw: Math.PI, pitch: -0.25, y: null },
  { name: 'raised_from_south_out', x: 1, z: 19.0, yaw: Math.PI, pitch: -0.20, y: null },
  { name: 'raised_from_west', x: -27, z: 6, yaw: -Math.PI / 2, pitch: -0.15, y: null },
  { name: 'plinth_north', x: -6, z: -16, yaw: Math.PI, pitch: -0.35, y: null },

  // --- traps: the wire and the loose board ----------------------------------
  // the foyer board is dressed by props.js and its mesh is added by
  // game.buildStoryBoards; the camera sits above it so both its top and its
  // shadow gap read in the lit pass.
  { name: 'board_foyer', x: 0.0, z: 8.5, yaw: 0, pitch: -0.25, y: 1.1 },
];

const aimRay = (page) => page.evaluate(() => {
  const w = window.__silid;
  if (!w || !w.THREE || !w.camera) return null;
  const T = w.THREE;
  const rc = new T.Raycaster();
  rc.far = 120;
  const cast = (nx, ny) => {
    rc.setFromCamera(new T.Vector2(nx, ny), w.camera);
    const hits = rc.intersectObjects(w.scene.children, true)
      .filter((h) => h.object && h.object.name && h.object.visible);
    return hits.slice(0, 3).map((h) => `${h.object.name}@${h.distance.toFixed(1)}m`);
  };
  return { centre: cast(0, 0), upper: cast(0, 0.45), lower: cast(0, -0.5) };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });
  await page.waitForTimeout(800);

  const rows = [];
  // settle the world near the foyer board so the dressed trap mesh is in the
  // scene for the trap shot, and any Resident-placed traps near the route have
  // had a moment to exist; the probe is still otherwise identical.
  await page.evaluate(() => {
    const w = window.__silid;
    if (w.spawnAt) {
      w.spawnAt(0.0, 8.5, 1.1, 0, -0.25);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game?.update?.(0.1);
    }
  });
  await page.waitForTimeout(300);

  for (const s of shots) {
    const info = await page.evaluate((s) => {
      const w = window.__silid;
      if (w.spawnAt) {
        w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      }
      if (w.player) {
        w.player.flashlightOn = false;
        if (w.player.flash) w.player.flash.visible = false;
      }
      w.game?.update?.(0.05);
      return { eye: [+w.camera.position.x.toFixed(1), +w.camera.position.y.toFixed(2), +w.camera.position.z.toFixed(1)] };
    }, s);

    // pass A: as played (night, no added light)
    await page.waitForTimeout(350);
    let png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, s.name + '_night.png'), Buffer.from(png.data, 'base64'));
    const aim1 = await aimRay(page);

    // pass B: lit, so geometry can be judged
    await page.evaluate(() => {
      const w = window.__silid;
      const T = w.THREE;
      if (!w.scene.getObjectByName('AUDIT_Hemi')) {
        const hemi = new T.HemisphereLight(0xbdccdc, 0x3a3d34, 3.0);
        hemi.name = 'AUDIT_Hemi';
        w.scene.add(hemi);
        const dir = new T.DirectionalLight(0xe8eef6, 2.0);
        dir.position.set(70, 110, 60);
        dir.name = 'AUDIT_Dir';
        w.scene.add(dir);
      }
      w.renderer.toneMappingExposure = 1.5;
    });
    await page.waitForTimeout(120);
    png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, s.name + '_lit.png'), Buffer.from(png.data, 'base64'));

    const aim2 = await aimRay(page);

    // pass C: darken back down, so the next shot does not start lit
    await page.evaluate(() => {
      const w = window.__silid;
      const T = w.THREE;
      w.scene.getObjectByName('AUDIT_Hemi')?.removeFromParent();
      w.scene.getObjectByName('AUDIT_Dir')?.removeFromParent();
      w.renderer.toneMappingExposure = 1.0;
    });

    rows.push({ shot: s.name, eye: info.eye, night: aim1, lit: aim2 });
    console.log(s.name, JSON.stringify(rows[rows.length - 1]));
  }

  fs.writeFileSync(path.join(OUT, '_rays.json'), JSON.stringify(rows, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
