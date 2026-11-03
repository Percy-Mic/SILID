const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const grid = r.gridFor('GF');
    const start = r.nearestWalkable(grid, 0, 4);
    const entry = r.stairEntry('GF');
    const goal = r.nearestWalkable(grid, entry.x, entry.z);
    const cell = (c) => c ? {gx:c.gx,gz:c.gz,x:+(-23.4+(c.gx+.5)*.55).toFixed(2),z:+(-10.4+(c.gz+.5)*.55).toFixed(2),walk:!!grid.walk[c.gx*38+c.gz]} : null;
    r.pos.set(0,0,4); r.footY=0; r.level='GF';
    const pth = r.pathOnLevel('GF', 0,4, entry.x, entry.z);
    return { start: cell(start), goal: cell(goal), entry,
      entryCells: [[-4.2,7.5],[-4.2,6.95],[-4.2,8.05],[-4.75,7.5],[-3.65,7.5]].map(([x,z])=>{const c=r.cellOf(x,z);return {x,z,walk:grid.walk[c.gx*38+c.gz],blocked:r.blockedAt(x,z,0)};}),
      pathLen: pth.length, first: pth.slice(0,6).map(q=>({x:+q.x.toFixed(2),z:+q.z.toFixed(2)})), last: pth.slice(-4).map(q=>({x:+q.x.toFixed(2),z:+q.z.toFixed(2)})),
    };
  }), null, 1));
  await b.close();
})();
