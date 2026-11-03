const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const out = await p.evaluate(() => {
    const s = window.__silid, pl = s.player;
    const at = (x,z,y) => {
      pl.teleport(x,z,y); pl.footY=y; pl.pos.y=y+pl.height;
      const near = { segs: [], boxes: [] };
      for (const c of pl.colliders) {
        if (!c || c.disabled) continue;
        if (c.y0 !== undefined && (y+1.65 < c.y0 || y > c.y1)) continue;
        const dx=c.x2-c.x1, dz=c.z2-c.z1, l=dx*dx+dz*dz;
        let t=l?((x-c.x1)*dx+(z-c.z1)*dz)/l:0; t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(x-(c.x1+t*dx), z-(c.z1+t*dz));
        if (d < 0.8) near.segs.push({k:c.kind,d:+d.toFixed(2),a:[+c.x1.toFixed(2),+c.z1.toFixed(2)],b:[+c.x2.toFixed(2),+c.z2.toFixed(2)],y0:c.y0,y1:c.y1});
      }
      for (const bx of pl.boxes) {
        if (bx.y0 !== undefined && (y+1.65 < bx.y0 || y > bx.y1)) continue;
        if (x>bx.x1-0.7 && x<bx.x2+0.7 && z>bx.z1-0.7 && z<bx.z2+0.7)
          near.boxes.push({b:[bx.x1,bx.z1,bx.x2,bx.z2],y0:bx.y0,y1:bx.y1});
      }
      return { blocked: pl.blocked(x,z), foot: pl.footY, floor: s.floorAt(x,z,y), near };
    };
    return {
      f2: at(-2.88, 7.36, 4.3),
      f3: at(-2.75, 7.5, 8.0),
      b1: at(-15.7, -5.0, 0),
      b1b: at(-15.7, -10.3, -3.4),
      // sample along the stair at the walking radius
      samples: [0.05,0.15,0.3,0.5,0.8,1.1,1.4].map(t=>{
        const a=Math.PI+t;
        const x=-1.5+Math.cos(a)*1.4, z=7.5+Math.sin(a)*1.4;
        return {t,x:+x.toFixed(2),z:+z.toFixed(2),blocked:pl.blocked(x,z),floor:s.floorAt(x,z,4.2)};
      }),
    };
  });
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
