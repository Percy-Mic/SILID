// Name whatever is standing in the middle of the drawing-room wall.
// Point the camera exactly as the screenshot was and raycast the pixel the
// panel occupies, then again around it, printing the whole hit stack.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.spawnAt(17.0, 11.8, null, Math.PI, 0.02);
    w.player.flashlightOn = false;
    if (w.player.flash) w.player.flash.visible = false;
    w.game.update(0.05);
    const pos = [+w.camera.position.x.toFixed(2), +w.camera.position.y.toFixed(2), +w.camera.position.z.toFixed(2)];
    w.camera.updateMatrixWorld(true);
    w.scene.updateMatrixWorld(true);
    const rc = new T.Raycaster();
    const rows = [];
    for (const [nx, ny] of [[0.26, 0.11], [0.20, 0.10], [0.30, -0.05], [0.26, 0.30]]) {
      rc.setFromCamera(new T.Vector2(nx, ny), w.camera);
      const hits = rc.intersectObjects(w.scene.children, true).slice(0, 6);
      rows.push({
        ndc: [nx, ny],
        hits: hits.map((h) => ({
          name: h.object.name || '(unnamed)',
          mat: h.object.material?.name || h.object.material?.type,
          d: +h.distance.toFixed(2),
          p: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
        })),
      });
    }
    return { pos, rows };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
