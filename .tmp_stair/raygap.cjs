// What are the bright bands between the stair treads? Raycast from the exact
// camera used for f3_down through the band pixels and report the first hit.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.spawnAt(-3.9, 10.4, 8.0, 0, -0.45);
    w.player.flashlightOn = true;
    w.game.update(0.05);
    const cam = w.renderer.camera ? w.renderer.camera : w.camera;
    cam.updateMatrixWorld(true);
    const rc = new T.Raycaster();
    const res = [];
    const px = [
      [513, 493], [520, 520], [500, 540], [540, 560], [470, 500],
      [430, 300], [640, 300], [700, 420],
    ];
    for (const [X, Y] of px) {
      const ndc = new T.Vector2((X / 1280) * 2 - 1, -(Y / 720) * 2 + 1);
      rc.setFromCamera(ndc, cam);
      const hits = rc.intersectObjects(w.scene.children, true).filter((h) => h.object.visible);
      const h = hits[0];
      res.push({
        px: [X, Y],
        hit: h ? h.object.name : null,
        mat: h ? (Array.isArray(h.object.material) ? h.object.material.map((m) => m.name) : h.object.material?.name) : null,
        pt: h ? [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)] : null,
        d: h ? +h.distance.toFixed(2) : null,
        n: h && h.face ? [+h.face.normal.x.toFixed(2), +h.face.normal.y.toFixed(2), +h.face.normal.z.toFixed(2)] : null,
      });
    }
    // the riser mesh itself: does it exist, where is it, how many triangles?
    const info = {};
    for (const n of ['StairTreads', 'StairRisers', 'StairStrings', 'StairSkirts', 'StairLandings']) {
      const m = w.scene.getObjectByName(n);
      if (!m) { info[n] = null; continue; }
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      info[n] = {
        tris: m.geometry.attributes.position.count / 3,
        min: [+b.min.x.toFixed(2), +b.min.y.toFixed(2), +b.min.z.toFixed(2)],
        max: [+b.max.x.toFixed(2), +b.max.y.toFixed(2), +b.max.z.toFixed(2)],
      };
    }
    return { res, info, cam: cam.position.toArray().map((v) => +v.toFixed(2)) };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
