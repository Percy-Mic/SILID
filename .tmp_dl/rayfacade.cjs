const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    w.spawnAt(0, 42, null, 0, 0.30);
    w.game.update(0.05);
    w.camera.updateMatrixWorld(true);
    const ray = new T.Raycaster();
    const rows = [];
    // a grid over the facade
    for (let iy = 0; iy < 9; iy++) {
      for (let ix = 0; ix < 9; ix++) {
        const nx = -0.55 + (1.10 * ix) / 8;
        const ny = -0.35 + (0.95 * iy) / 8;
        ray.setFromCamera(new T.Vector2(nx, ny), w.camera);
        const hits = ray.intersectObjects(w.scene.children, true).filter((h) => h.object.visible);
        const h = hits[0];
        rows.push([
          nx.toFixed(2), ny.toFixed(2),
          h ? h.object.name || h.object.type : 'none',
          h ? (h.object.material?.type || '') : '',
          h ? '#' + (h.object.material?.color?.getHexString?.() || '') : '',
          h ? h.point.y.toFixed(1) : '',
        ]);
      }
    }
    return rows;
  });
  const seen = new Map();
  for (const r of out) {
    const k = r[2] + ' ' + r[4];
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  console.log('--- grid hits (name colour count) ---');
  for (const [k, n] of [...seen.entries()].sort((a, b) => b[1] - a[1])) console.log(n, k);
  console.log('--- rows ---');
  for (const r of out) console.log(r.join(' '));
  await b.close();
})();
