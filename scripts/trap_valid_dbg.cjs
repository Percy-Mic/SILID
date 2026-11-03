const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 500 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid;
    const T = w.traps;
    const pts = [[0, 2], [0, 6], [4, 2], [-4, 2], [2.5, 5.5], [0, 0]];
    const rows = pts.map(([x, z]) => {
      const f0 = w.floorAt(x, z, 0);
      const fL = w.floorAt(x - 1.02, z, 0);
      const fR = w.floorAt(x + 1.02, z, 0);
      const doors = w.architecture.doors.map((d) => {
        const dx = d.axis === 'x' ? d.at : d.c;
        const dz = d.axis === 'x' ? d.c : d.at;
        return { dy: Math.abs((d.y ?? 0) - 0), dist: Math.hypot(dx - x, dz - z) };
      }).filter((q) => q.dy < 1.6).sort((a, b) => a.dist - b.dist)[0];
      // nearest architecture collider to the point
      let near = 1e9, nk = null;
      for (const c of w.architecture.colliders) {
        if (!c || c.disabled || c.kind === 'door') continue;
        if (c.y0 !== undefined && (0 + 1.4 < c.y0 || 0 + 0.05 > c.y1)) continue;
        const cx = Math.max(c.x1, Math.min(x, c.x2));
        const cz = Math.max(c.z1, Math.min(z, c.z2));
        const d2 = Math.hypot(cx - x, cz - z);
        if (d2 < near) { near = d2; nk = c.kind || 'seg'; }
      }
      return { at: [x, z], floor: [f0, fL, fR], nearestDoor: doors ? +doors.dist.toFixed(2) : null, nearCol: [+near.toFixed(2), nk], valid: T.valid(x, z, 0) };
    });
    return rows;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
