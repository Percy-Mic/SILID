const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled = true;
    pl.footY=-3.4;
    const pts=[[3,2],[3,1.8],[3,2.2],[3,1],[3,0],[10.5,2],[10.5,1],[10,4],[10.5,4],[10.5,3],[-4,2],[-4,1],[-4,3],[0,2.2],[6,2]];
    const rows=pts.map(([x,z])=>({p:[x,z],b:pl.blocked(x,z)}));
    const boxes=(pl.boxes||[]).filter(b=>b.x1<12&&b.x2>-5&&b.z1<8&&b.z2>-2).map(b=>({x:[+b.x1.toFixed(1),+b.x2.toFixed(1)],z:[+b.z1.toFixed(1),+b.z2.toFixed(1)],y:[+b.y0.toFixed(1),+b.y1.toFixed(1)]}));
    return {rows, boxes};
  }),null,1));
  await b.close();
})();
