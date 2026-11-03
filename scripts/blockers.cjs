const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s = window.__silid; const segs = s.architecture.colliders; const boxes = s.props.colliders;
    const near = (x,z,r=3) => {
      const out = [];
      for (const c of segs) {
        const dx=c.x2-c.x1, dz=c.z2-c.z1, l=dx*dx+dz*dz;
        let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
        const px=c.x1+t*dx, pz=c.z1+t*dz; const d=Math.hypot(x-px,z-pz);
        if(d<r) out.push({kind:c.kind,d:+d.toFixed(2),a:[c.x1,c.z1],b:[c.x2,c.z2],dis:c.disabled});
      }
      const bx = boxes.filter(b=>x>b.x1-r&&x<b.x2+r&&z>b.z1-r&&z<b.z2+r).map(b=>({k:b.kind,b:[b.x1,b.z1,b.x2,b.z2]}));
      return {segs:out.slice(0,12), boxes:bx};
    };
    return {
      start: near(-53.4,27.2,2),
      doorPath: near(0,12.4,2.5),
      basement: near(9.5,-5,3),
      counts: {segs:segs.length, boxes:boxes.length},
    };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
