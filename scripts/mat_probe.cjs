const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid;
    const rows = [];
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!/^Exterior_|^Facade|^Walls_/.test(o.name)) return;
      const m = o.material;
      rows.push({
        n: o.name,
        color: m.color?.getHexString?.(),
        mapKind: m.map?.constructor?.name,
        mapImg: m.map?.image?.constructor?.name,
        mapWH: m.map?.image ? [m.map.image.width, m.map.image.height] : null,
        rep: m.map ? [+m.map.repeat.x.toFixed(3), +m.map.repeat.y.toFixed(3)] : null,
        bump: !!m.bumpMap,
        tris: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
      });
    });
    return rows;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
