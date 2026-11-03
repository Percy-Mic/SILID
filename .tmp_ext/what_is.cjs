// What is that brown slab on the drawing-room wall?
//
// The bay's straight-on shot shows a floating panel over the wall between the
// two windows. Name the mesh: every scene child whose world bounding box
// overlaps the suspect volume is printed with its name and box.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    const box = new T.Box3(
      new T.Vector3(15.9, 0.9, 13.5),
      new T.Vector3(17.3, 2.6, 14.9),
    );
    const hits = [];
    w.scene.updateMatrixWorld(true);
    w.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (!b.intersectsBox(box)) return;
      hits.push({
        name: o.name || '(unnamed)',
        mat: o.material?.name || o.material?.type,
        min: [+b.min.x.toFixed(2), +b.min.y.toFixed(2), +b.min.z.toFixed(2)],
        max: [+b.max.x.toFixed(2), +b.max.y.toFixed(2), +b.max.z.toFixed(2)],
        tris: o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3,
      });
    });
    const placed = w.props.placed.filter((p) => p.room === 'GF-17' || p.room === 'GF-18');
    return { hits, placed };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
