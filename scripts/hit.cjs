const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player; pl.footY=-1.29;
    const x=-16,z=7.56,rad=pl.radius; const out={segs:[],boxes:[]};
    for(const c of pl.colliders){ if(!c||c.disabled) continue; if(c.y0!==undefined&&(pl.footY+1.65<c.y0||pl.footY>c.y1)) continue;
      const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz; let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(x-(c.x1+t*dx),z-(c.z1+t*dz)); if(d<rad+0.1) out.segs.push({k:c.kind,d:+d.toFixed(2),a:[c.x1,c.z1],b:[c.x2,c.z2],y0:c.y0,y1:c.y1}); }
    for(const b of pl.boxes){ if(x>b.x1-rad&&x<b.x2+rad&&z>b.z1-rad&&z<b.z2+rad) out.boxes.push({k:b.kind,b:[b.x1,b.z1,b.x2,b.z2],y0:b.y0,y1:b.y1}); }
    return out;
  }),null,1));
  await b.close();
})();
