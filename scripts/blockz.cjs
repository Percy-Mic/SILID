const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s=window.__silid, pl=s.player; pl.teleport(0,13.4,0);
    const rows=[];
    for (let z=13.4; z>=10.8; z-=0.1) rows.push({z:+z.toFixed(1), b:pl.blocked(0,z)});
    const hits=[];
    for (const c of pl.colliders) {
      if (!c || c.disabled) continue;
      if (c.y0!==undefined && (pl.footY+1.65 < c.y0 || pl.footY > c.y1)) continue;
      // distance from (0,12.2)
      const dx=c.x2-c.x1, dz=c.z2-c.z1, l=dx*dx+dz*dz;
      let t=l?((0-c.x1)*dx+(12.2-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(0-(c.x1+t*dx),12.2-(c.z1+t*dz));
      if(d<2) hits.push({kind:c.kind,d:+d.toFixed(2),a:[c.x1,c.z1],b:[c.x2,c.z2],y0:c.y0,y1:c.y1});
    }
    const boxes=pl.boxes.filter(b=>b.x1<2&&b.x2>-2&&b.z1<14&&b.z2>10);
    return {rows, hits, boxes, foot:pl.footY};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
