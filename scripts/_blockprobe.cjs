const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident;
    const pts = [
      ['B1 gen door', 3, 2, -3.4],
      ['B1 gen front', 3, 0.5, -3.4],
      ['B1 gen center', 3, -3, -3.4],
      ['GF guest3 door', 8, -8, 0],
      ['GF guest3 in', 8.5, -8, 0],
      ['GF wine door', 14, -8, 0],
      ['GF guest4 door', 8, 6, 0],
      ['GF guest4 in', 8.5, 6, 0],
    ];
    const out = [];
    for (const [name,x,z,y] of pts) {
      const hitsA = [], hitsP = [];
      for (const c of s.architecture.colliders) {
        if (c.disabled) continue;
        const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz;
        let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0;t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(x-(c.x1+t*dx),z-(c.z1+t*dz));
        if(d<0.45&&(c.y0===undefined||(y+1.6>c.y0&&y+0.1<c.y1)))hitsA.push({kind:c.kind,d:+d.toFixed(2),seg:[+c.x1.toFixed(1),+c.z1.toFixed(1),+c.x2.toFixed(1),+c.z2.toFixed(1)],y:[c.y0,c.y1]});
      }
      for (const c of s.props.colliders) {
        if(x>c.x1-0.4&&x<c.x2+0.4&&z>c.z1-0.4&&z<c.z2+0.4&&y+1.6>c.y0&&y+0.1<c.y1)hitsP.push({k:c.kind,box:[+c.x1.toFixed(1),+c.z1.toFixed(1),+c.x2.toFixed(1),+c.z2.toFixed(1)],y:[c.y0,c.y1]});
      }
      out.push({name, blocked: r.blockedAt(x,z,y), floor: s.floorAt(x,z,y), arch:hitsA, props:hitsP});
    }
    return out;
  }), null, 1));
  await b.close();
})();
