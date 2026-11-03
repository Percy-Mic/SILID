// What is that? Lists every mesh whose world position is inside a box, with
// its name and material colour, to identify an unexplained surface in a shot.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

const [x0, x1, y0, y1, z0, z1] = (process.argv[2] || '-6,4,3.5,6.5,6,11').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate(([x0, x1, y0, y1, z0, z1]) => {
    const s = window.__silid;
    const hits = [];
    s.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const p = new s.THREE.Vector3();
      o.getWorldPosition(p);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      hits.push({
        name: o.name || o.parent?.name || '?',
        pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        color: m?.color ? '#' + m.color.getHexString() : '?',
        type: o.geometry?.type,
        tris: o.geometry?.index ? o.geometry.index.count / 3 : o.geometry?.attributes?.position?.count / 3,
      });
    });
    return hits;
  }, [x0, x1, y0, y1, z0, z1]);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
