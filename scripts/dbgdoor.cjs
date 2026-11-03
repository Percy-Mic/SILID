const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    pl.footY=0;
    const inBox=(c,x0,x1,z0,z1)=>c.x1<=x1+0.1&&c.x2>=x0-0.1&&c.z1<=z1+0.1&&c.z2>=z0-0.1;
    const cols=A.colliders.filter(c=>!c.disabled&&inBox(c,-17.8,-16.2,5.3,6.7))
      .map(c=>({k:c.kind,y:[c.y0,c.y1],a:[c.x1,c.z1],b:[c.x2,c.z2]}));
    const boxes=(pl.boxes||[]).filter(b=>b.x1<-16.2&&b.x2>-17.8&&b.z1<6.7&&b.z2>5.3)
      .map(b=>({x:[b.x1,b.x2],z:[b.z1,b.z2],y:[b.y0,b.y1],n:b.name||b.kind}));
    const doors=A.doors.filter(d=>d.level==='GF'&&d.axis==='z'&&Math.abs(d.c+17)<0.2).map(d=>({at:d.at,w:d.w,open:d.open}));
    return {cols,boxes,doors,blocked:pl.blocked(-17,6), blockedIn:pl.blocked(-18,6), blockedOut:pl.blocked(-16,6)};
  }),null,1));
  await b.close();
})();
