const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s = window.__silid, pl = s.player;
    pl.teleport(-53.4, 27.2);
    const x = -53.0, z = 27.2, rad = pl.radius;
    const hits = [];
    for (const c of pl.colliders) {
      if (!c || c.disabled) continue;
      const dx=c.x2-c.x1, dz=c.z2-c.z1, l=dx*dx+dz*dz;
      let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
      const px=c.x1+t*dx, pz=c.z1+t*dz;
      const d=Math.hypot(x-px,z-pz);
      if (d < rad) hits.push({kind:c.kind,a:[c.x1,c.z1],b:[c.x2,c.z2],d:+d.toFixed(3)});
    }
    const boxHits = pl.boxes.filter(b=>x>b.x1-rad&&x<b.x2+rad&&z>b.z1-rad&&z<b.z2+rad);
    return { blocked: pl.blocked(x,z), hits: hits.slice(0,20), boxHits, first: pl.colliders.slice(0,3) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
