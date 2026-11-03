const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled = true;
    pl.footY = 0;
    const rows=[];
    for (const [x,z] of [[-16,6],[-17,6],[-17.5,6],[-18,6],[-19,6],[-20,6],[-20.2,4.5],[-20,6.5],[-20.5,6],[-22,6]]) {
      rows.push({x,z,blocked:pl.blocked(x,z),floor:s.floorAt(x,z,0)});
    }
    // what blocks -20,6 ?
    const bl = A.colliders.filter(c=>!c.disabled && (()=>{const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz;let t=l?(((-20)-c.x1)*dx+((6)-c.z1)*dz)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(-20-(c.x1+t*dx),6-(c.z1+t*dz))<pl.radius+0.05;})())
      .map(c=>({k:c.kind,y:[c.y0,c.y1],a:[c.x1,c.z1],b:[c.x2,c.z2]}));
    return {rows, bl};
  }),null,1));
  await b.close();
})();
