const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, pl = w.player;
    pl.footY = 1.57;
    const r = pl.radius, body0 = 1.62, body1 = 3.22;
    const hits = [];
    for (const z of [6.75, 6.68, 6.6, 6.5, 6.4]) {
      const cand = [];
      for (const c of pl.colliders) {
        if (!c || c.disabled) continue;
        if (c.y0 !== undefined && (body1 < c.y0 || body0 > c.y1)) continue;
        if (c.kind === 'rail' && Math.abs(1.57 - c.baseY) > 0.6) continue;
        const dx = c.x2 - c.x1, dz = c.z2 - c.z1, l = dx*dx+dz*dz;
        let t = l ? ((-4.29 - c.x1)*dx + (z - c.z1)*dz)/l : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(-4.29 - (c.x1+t*dx), z - (c.z1+t*dz));
        if (d < r) cand.push({ kind: c.kind, d: +d.toFixed(2), x1: +c.x1.toFixed(2), z1: +c.z1.toFixed(2), x2: +c.x2.toFixed(2), z2: +c.z2.toFixed(2), y0: +c.y0?.toFixed(2), y1: +c.y1?.toFixed(2) });
      }
      const boxes = [];
      for (const bx of pl.boxes) {
        if (bx.y0 !== undefined && (body1 < bx.y0 || body0 > bx.y1)) continue;
        if (-4.29 > bx.x1 - r && -4.29 < bx.x2 + r && z > bx.z1 - r && z < bx.z2 + r) boxes.push(bx);
      }
      hits.push({ z, blocked: pl.blocked(-4.29, z), cand, boxes: boxes.length });
    }
    return { nCol: pl.colliders.length, nBox: pl.boxes.length, hits };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
