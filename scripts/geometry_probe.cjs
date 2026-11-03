// GEOMETRY PROBE — what is actually built where, with the material and texture
// each surface wears. Used by the visual audit to name a structure before
// changing it (porch soffit, stair drum, slab edges, facade skin).
//
// Usage: node scripts/geometry_probe.cjs
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });

  const out = await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    w.scene.updateMatrixWorld(true);

    const box = new T.Box3();
    const describe = (o) => {
      const g = o.geometry;
      if (g && !g.boundingBox) g.computeBoundingBox();
      box.makeEmpty();
      if (g) box.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld));
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const map = m && m.map;
      const tris = g && g.index ? g.index.count / 3 : g ? g.attributes.position.count / 3 : 0;
      return {
        name: o.name || '(unnamed ' + (o.geometry ? o.geometry.type : o.type) + ')',
        type: o.geometry ? o.geometry.type : o.type,
        mat: m ? (m.name || m.type) : 'none',
        map: map ? (map.name || 'texture') : null,
        color: m && m.color ? '#' + m.color.getHexString() : null,
        tris: Math.round(tris),
        box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map((v) => +v.toFixed(2)),
      };
    };

    const all = [];
    w.scene.traverse((o) => { if (o.isMesh || o.isGroup) all.push(o); });

    const inBox = (b, r) => b[0] < r[3] && b[3] > r[0] && b[1] < r[4] && b[4] > r[1] && b[2] < r[5] && b[5] > r[2];

    // porch: slab, piers, ceiling, door surround
    const porch = all.map(describe)
      .filter((d) => inBox(d.box, [-6.5, 2.2, 10.4, 6.5, 4.0, 16.0]))
      .sort((a, b) => b.tris - a.tris);

    // stair: everything within the stair cylinder
    const stair = all.map(describe)
      .filter((d) => {
        const cx = -1.5, cz = 7.5;
        const x0 = Math.max(d.box[0], cx - 3.2), x1 = Math.min(d.box[3], cx + 3.2);
        const z0 = Math.max(d.box[2], cz - 3.2), z1 = Math.min(d.box[5], cz + 3.2);
        return x1 > x0 && z1 > z0;
      })
      .sort((a, b) => b.tris - a.tris);

    // slabs: thickness and undersides per level
    const slabs = all.filter((o) => /^(Floor_|Soffit_)/.test(o.name)).map(describe)
      .sort((a, b) => a.name.localeCompare(b.name));

    // facade skins: what the exterior wears
    const facade = all.filter((o) => /^(Facade|Exterior_)/.test(o.name)).map(describe)
      .sort((a, b) => b.tris - a.tris);

    // any round thing that protrudes: cylinders/spheres outside the wall line
    const round = [];
    w.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      if (!/Cylinder|Sphere|Torus|Lathe|Circle/i.test(g.type)) return;
      if (!o.name) return;
      round.push(describe(o));
    });

    return { porch, stair, slabs, facade, round };
  });

    const show = (title, rows, limit = 24) => {
    console.log('\n=== ' + title + ' (' + rows.length + ')');
    for (const r of rows.slice(0, limit)) {
      console.log(`  ${r.name.padEnd(30)} ${String(r.type).padEnd(16)} tris=${String(r.tris).padEnd(7)} mat=${r.mat.padEnd(16)} color=${r.color || '-'}`);
      console.log(`     box ${JSON.stringify(r.box)}`);
    }
  };
  show('PORCH region', out.porch);
  show('STAIR region', out.stair);
  show('SLABS', out.slabs);
  show('FACADE skins', out.facade, 20);
  show('ROUND/CURVED', out.round, 30);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });