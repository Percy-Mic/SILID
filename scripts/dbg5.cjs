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
    const rows=[];
    for (let z=-7.8; z<=-6.2; z+=0.1) rows.push([+z.toFixed(1), pl.blocked(-16,z)]);
    const near=A.colliders.filter(c=>!c.disabled&&c.x1<=-15&&c.x2>=-17&&c.z1<=-6.4&&c.z2>=-7.6).map(c=>({k:c.kind,y:[c.y0,c.y1],a:[c.x1,c.z1],b:[c.x2,c.z2]}));
    return {rows,near};
  })));
  await b.close();
})();
