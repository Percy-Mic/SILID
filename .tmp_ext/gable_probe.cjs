// Is the east cross-gable actually there, and where? Cast rays from outside the
// east flank at several heights and report what is hit and how far out it is.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.updateMatrixWorld(true);
    const rc = new T.Raycaster();
    const rows = [];
    // east flank: fire west (-x) from x = 30 at the wing's centre line and at
    // heights through the gable (eave 14.84, ridge 18.59)
    for (const y of [15.2, 16.0, 16.8, 17.6, 18.2]) {
      rc.set(new T.Vector3(30, y, 7.0), new T.Vector3(-1, 0, 0));
      const hits = rc.intersectObjects(w.scene.children, true)
        .filter((h) => h.object.name && /Facade|Roof|Pavilion/i.test(h.object.name))
        .slice(0, 3)
        .map((h) => ({ name: h.object.name, x: +h.point.x.toFixed(2) }));
      rows.push({ y, hits });
    }
    // west flank, same idea
    for (const y of [15.2, 16.0, 16.8, 17.6, 18.2]) {
      rc.set(new T.Vector3(-34, y, -5.4), new T.Vector3(1, 0, 0));
      const hits = rc.intersectObjects(w.scene.children, true)
        .filter((h) => h.object.name && /Facade|Roof|Pavilion/i.test(h.object.name))
        .slice(0, 3)
        .map((h) => ({ name: h.object.name, x: +h.point.x.toFixed(2) }));
      rows.push({ y, side: 'west', hits });
    }
    return rows;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
