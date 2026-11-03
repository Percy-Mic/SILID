const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 500 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, r = w.resident;
    w.spawnAt(0, 9.2, 0, Math.PI, 0);
    const grid = r.gridFor('F2');
    let n = 0; for (const v of grid.walk) n += v;
    const at = (x, z) => { const c = r.cellOf(x, z); return grid.walk[c.gx * (Math.ceil((10.4 + 10.4) / 0.55)) + c.gz] ?? 'oob'; };
    const ROWS = Math.ceil((10.4 + 10.4) / 0.55);
    const at2 = (x, z) => { const c = r.cellOf(x, z); return grid.walk[c.gx * ROWS + c.gz] ?? 'oob'; };
    return {
      rows: ROWS,
      walkable: n,
      f2y: w.levels.find ? null : null,
      levelFooy: w.levels.map((l) => [l.id, l.y]),
      at_hall: at2(2.5, 5.5),
      at_master: at2(-2, -6),
      at_south: at2(6, 3),
      pathToMaster: r.pathOnLevel('F2', 2.5, 5.5, -2, -6).length,
      pathToSouth: r.pathOnLevel('F2', 2.5, 5.5, 6, 3).length,
      planToMaster: r.planTo(-2, -6, 'F2').length,
      level: r.level,
      state: r.state,
      wait: +r.wait.toFixed(2),
      routeIdx: r.routeIdx,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  // watch it for six seconds, sampling
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(500);
    samples.push(await p.evaluate(() => {
      const r = window.__silid.resident;
      return [r.state, +r.pos.x.toFixed(2), +r.pos.z.toFixed(2), r.path.length, r.pathIdx, +r.wait.toFixed(1), r.routeIdx, r.stuckT.toFixed(1)];
    }));
  }
  console.log(samples.map((s) => s.join(' ')).join('\n'));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
