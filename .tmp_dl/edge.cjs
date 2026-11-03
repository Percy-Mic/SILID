const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const levels = window.__silid.levels;
    const rows = [];
    for (const lv of levels) {
      const fp = lv.footprint;
      for (const [axis, line, dir] of [['x', fp.z1, 'S'], ['x', fp.z0, 'N'], ['z', fp.x0, 'W'], ['z', fp.x1, 'E']]) {
        const a = axis === 'x' ? fp.x0 : fp.z0;
        const b = axis === 'x' ? fp.x1 : fp.z1;
        const iv = [];
        for (const r of lv.rooms) {
          const at = axis === 'x' ? (r.z0 === line ? r.z0 : (r.z1 === line ? r.z1 : null)) : (r.x0 === line ? r.x0 : (r.x1 === line ? r.x1 : null));
          if (at === null) continue;
          iv.push([Math.min(axis === 'x' ? r.x0 : r.z0, axis === 'x' ? r.x1 : r.z1), Math.max(axis === 'x' ? r.x0 : r.x1, axis === 'x' ? r.z0 : r.z1)]);
        }
        iv.sort((p, q) => p[0] - q[0]);
        const merged = [];
        for (const s of iv) {
          const prev = merged[merged.length - 1];
          if (prev && s[0] <= prev[1] + 0.02) prev[1] = Math.max(prev[1], s[1]);
          else merged.push([...s]);
        }
        const cov = merged.reduce((n, s) => n + (s[1] - s[0]), 0);
        const gaps = [];
        let cur = a;
        for (const s of merged) {
          if (s[0] > cur + 0.05) gaps.push([+cur.toFixed(1), +s[0].toFixed(1)]);
          cur = Math.max(cur, s[1]);
        }
        if (cur < b - 0.05) gaps.push([+cur.toFixed(1), +b.toFixed(1)]);
        rows.push({ level: lv.id, edge: dir, line, span: [a, b], coverage: +cov.toFixed(1), of: +(b - a).toFixed(1), gaps });
      }
    }
    return rows;
  });
  for (const r of out) {
    console.log(r.level, r.edge, 'line', r.line, 'covered', r.coverage + '/' + r.of, 'gaps', JSON.stringify(r.gaps));
  }
  const w = await p.evaluate(() => window.__silid.architecture.windows.reduce((m, x) => { m[x.level] = (m[x.level] || 0) + 1; return m; }, {}));
  console.log('windows per level', JSON.stringify(w));
  await b.close();
})();
