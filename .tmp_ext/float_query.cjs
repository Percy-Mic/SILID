const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    const ids = ['GF-17', 'GF-18', 'GF-19'];
    const placed = w.props.placed.filter((p) => ids.includes(p.room));
    const bays = [
      { id: 'GF-17', x0: 13.55, x1: 20.45, z0: 11, z1: 14.45 },
      { id: 'GF-18', x0: 5.55, x1: 8.0, z0: 11, z1: 13.65 },
      { id: 'GF-19', x0: -5.6, x1: 1.6, z0: -14.7, z1: -11 },
    ];
    const meshes = [];
    w.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const b = new T.Box3().setFromObject(o);
      if (b.isEmpty()) return;
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      for (const bay of bays) {
        if (cx > bay.x0 - 1 && cx < bay.x1 + 1 && cz > bay.z0 - 1 && cz < bay.z1 + 1
          && b.min.y > 0.35 && b.max.y < 4.2) {
          meshes.push({
            bay: bay.id, name: o.name || o.parent?.name || '(unnamed)',
            box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(2)),
          });
          break;
        }
      }
    });
    return { placed, meshes: meshes.slice(0, 40) };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
