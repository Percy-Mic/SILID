const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid;
    const holes = s.architecture.holes.filter(h => h.kind === 'circle');
    const over = [];
    for (const pl of s.props.placed) {
      const h = holes.find(x => x.level === pl.level);
      if (!h) continue;
      if (Math.hypot(pl.x - h.x, pl.z - h.z) < h.r + 0.4) over.push(pl);
    }
    // doors whose opening is fouled by a furniture collider
    const fouled = [];
    for (const d of s.architecture.doors) {
      if (d.arch) continue;
      const cx = d.axis === 'x' ? d.at : d.c;
      const cz = d.axis === 'x' ? d.c : d.at;
      const box = { x0: cx - 0.55, x1: cx + 0.55, z0: cz - 0.55, z1: cz + 0.55 };
      for (const c of s.props.colliders) {
        if (c.y0 !== undefined && (c.y0 > d.y + 2.0 || c.y1 < d.y + 0.1)) continue;
        if (box.x0 < c.x2 && box.x1 > c.x1 && box.z0 < c.z2 && box.z1 > c.z1) fouled.push({ door: d.level + ' ' + d.at + ',' + d.c, at: [c.x1,c.z1,c.x2,c.z2] });
      }
    }
    return { overStairHole: over, doorsFouled: fouled, cabinets: s.cabinets.units.length, fuseBox: !!s.apparatus.fuseBox };
  }), null, 1));
  await b.close();
})();
