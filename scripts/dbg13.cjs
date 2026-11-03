const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    const dA=A.doors.find(d=>d.level==='GF'&&d.at===0&&d.c===11);
    if (dA) dA.collider.disabled = true;
    pl.footY=0;
    const rows=[];
    for(let z=12.8; z>=10.4; z-=0.2) rows.push([+z.toFixed(1), pl.blocked(0,z), s.floorAt(0,z,0)]);
    const seg=(c,x,z)=>{const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz;let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(x-(c.x1+t*dx),z-(c.z1+t*dz));};
    const near=[];
    for(const c of A.colliders){if(!c||c.disabled)continue; const d=seg(c,0,12.2); if(d<0.8) near.push({k:c.kind,d:+d.toFixed(2),y:[c.y0,c.y1],a:[c.x1,c.z1],b:[c.x2,c.z2]});}
    const boxes=(pl.boxes||[]).filter(b=>b.x1<1&&b.x2>-1&&b.z1<13&&b.z2>11).map(b=>({x:[b.x1,b.x2],z:[b.z1,b.z2],y:[b.y0,b.y1]}));
    return {rows, near, boxes, doorOpen:dA?.open};
  }),null,1));
  await b.close();
})();
