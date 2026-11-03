const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const grid = r.gridFor('B1');
    const out = { cells: [], path: 0 };
    for (let z=-1; z<=3; z+=0.55) {
      const row=[];
      for (let x=1.5; x<=4.5; x+=0.55) {
        const c=r.cellOf(x,z);
        row.push({x:+x.toFixed(2),z:+z.toFixed(2),walk:grid.walk[c.gx*38+c.gz],blocked:r.blockedAt(x,z,-3.4)});
      }
      out.cells.push(row);
    }
    r.pos.set(3,0,3); r.footY=-3.4; r.level='B1';
    out.path = r.planTo(3,-3,'B1').length;
    out.nearestDoor = r.nearestWalkable(grid, 3, 2);
    return out;
  }), null, 1));
  await b.close();
})();
