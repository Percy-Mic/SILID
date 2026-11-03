const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s=window.__silid, pl=s.player;
    const near=(x,z,y)=>{ pl.footY=y; const out=[];
      for(const c of pl.colliders){ if(!c||c.disabled) continue; if(c.y0!==undefined&&(y+1.65<c.y0||y>c.y1)) continue;
        const dx=c.x2-c.x1,dz=c.z2-c.z1,l=dx*dx+dz*dz; let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(x-(c.x1+t*dx),z-(c.z1+t*dz)); if(d<1) out.push({k:c.kind,d:+d.toFixed(2),a:[c.x1,c.z1],b:[c.x2,c.z2],y0:c.y0,y1:c.y1}); }
      return out; };
    return { stair: near(0.25,4.53,2.43), baseStair: near(-15.93,7.6,-1.34), tunnel: near(14.49,5.92,-3.4) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
