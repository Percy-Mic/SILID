const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    pl.footY=-0.7;
    const segDist=(c,x,z)=>{const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz;let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(x-(c.x1+t*dx),z-(c.z1+t*dz));};
    const near=[];
    for (const c of A.colliders){ if(!c||c.disabled) continue; const d=segDist(c,-15.5,-6.8); if(d<1.2) near.push({k:c.kind,d:+d.toFixed(2),y:[c.y0,c.y1],a:[+c.x1.toFixed(1),+c.z1.toFixed(1)],b:[+c.x2.toFixed(1),+c.z2.toFixed(1)]}); }
    const boxes=(pl.boxes||[]).filter(b=>b.x1<-14&&b.x2>-17.5&&b.z1<-5.5&&b.z2>-8.5).map(b=>({x:[+b.x1.toFixed(1),+b.x2.toFixed(1)],z:[+b.z1.toFixed(1),+b.z2.toFixed(1)],y:[+b.y0.toFixed(1),+b.y1.toFixed(1)]}));
    return {near, boxes, blocked:pl.blocked(-15.5,-6.8)};
  }),null,1));
  await b.close();
})();
