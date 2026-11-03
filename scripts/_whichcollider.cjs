const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true }); const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid;
    const target = { x1: -5.17, x2: -4.11, z1: 6.21, z2: 6.61 };
    const hits = [];
    for (const q of s.props.placed) {
      const t = s.furniture.templates.get(q.name); if (!t) continue;
      const min=t.box.min,max=t.box.max,c=Math.cos(q.rot),sn=Math.sin(q.rot);
      let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
      for(const px of [min.x,max.x])for(const pz of [min.z,max.z]){
        const wx=q.x+px*c+pz*sn, wz=q.z-px*sn+pz*c;
        x0=Math.min(x0,wx);x1=Math.max(x1,wx);z0=Math.min(z0,wz);z1=Math.max(z1,wz);
      }
      if (Math.abs(x0-target.x1)<0.05&&Math.abs(x1-target.x2)<0.05&&Math.abs(z0-target.z1)<0.05&&Math.abs(z1-target.z2)<0.05) hits.push(q);
    }
    return hits;
  }), null, 1));
  await b.close();
})();
