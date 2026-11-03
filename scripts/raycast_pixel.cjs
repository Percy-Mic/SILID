// Raycast from the camera through a pixel of the last screenshot pose and say
// what object was hit. Used to name artifacts that merged geometry hides from
// a bounding-box search.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

// x, z, y, yaw, pitch, then screen pixels in the 1280x720 render
const a = (process.argv[2] || '-4.7,7.5,4.2,-1.25,-0.42,940,470').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate(([x, z, y, yaw, pitch, px, py]) => {
    const s = window.__silid;
    s.spawnAt(x, z, y, yaw, pitch);
    s.game.update(0.05);
    s.camera.updateMatrixWorld();
    const rc = new s.THREE.Raycaster();
    rc.setFromCamera(new s.THREE.Vector2((px / 1280) * 2 - 1, -(py / 720) * 2 + 1), s.camera);
    const hits = rc.intersectObjects(s.scene.children, true).slice(0, 6).map((h) => {
      const p = h.object.getWorldPosition(new s.THREE.Vector3());
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      return {
        name: h.object.name || h.object.parent?.name || '?',
        dist: +h.distance.toFixed(2),
        point: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
        origin: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
        color: m?.color ? '#' + m.color.getHexString() : '?',
        faceNormal: h.face ? [+h.face.normal.x.toFixed(2), +h.face.normal.y.toFixed(2), +h.face.normal.z.toFixed(2)] : null,
        side: m?.side,
      };
    });
    return { hits };
  }, a);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
