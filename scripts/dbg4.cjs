const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled = true;
    const probe=(y,pts)=>{pl.footY=y;return pts.map(([x,z])=>({p:[x,z],b:pl.blocked(x,z),f:+s.floorAt(x,z,y)?.toFixed?.(2)}));};
    return {
      missing: A.missingDoors,
      b1: probe(-3.4, [[-16.5,-9],[-16.5,-8],[-16,-6.5],[-16,-5],[-16,-2],[-16,1],[-16,3],[-10,-3]]),
      f3: probe(8.0, [[0,4.5],[1,4.5],[2.5,4.5],[2.5,6],[1.5,9]]),
      f4: probe(11.6, [[-2.5,-8.5],[-2.5,-5.5],[-2.5,-3],[0,-8.5],[0,-6.5],[-6,-4]]),
      b1doors: A.doors.filter(d=>d.level==='B1').map(d=>`${d.axis}${d.c}@${d.at}`),
    };
  }), null, 1));
  await b.close();
})();
