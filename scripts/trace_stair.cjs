const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:5333/?probe=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const out = await p.evaluate(() => {
    const s = window.__silid, pl = s.player, g = s.game;
    pl.enabled = true;
    const cx=-1.5, cz=7.5;
    const traceClimb = (x,z,y,label) => {
      s.spawnAt(x,z,y,0,0);
      const rows=[];
      for (let i=0;i<14;i++) {
        const dx=pl.pos.x-cx, dz=pl.pos.z-cz;
        const a=Math.atan2(dz,dx), r=Math.hypot(dx,dz);
        const px=cx+Math.cos(a+0.22)*Math.max(1.0,Math.min(1.95,r*0.6+1.6*0.4));
        const pz=cz+Math.sin(a+0.22)*Math.max(1.0,Math.min(1.95,r*0.6+1.6*0.4));
        let vx=px-pl.pos.x, vz=pz-pl.pos.z; const l=Math.hypot(vx,vz)||1;
        pl.yaw = Math.atan2(-vx/l, -vz/l);
        const bx=pl.pos.x, bz=pl.pos.z, bf=pl.footY;
        pl.keys.KeyW=true; pl.update(0.033,g); g.update(0.033);
        const tx=pl.pos.x+vx/l*0.033*2.4, tz=pl.pos.z+vz/l*0.033*2.4;
        rows.push({i,a:+a.toFixed(2),r:+r.toFixed(2),x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),
          foot:+pl.footY.toFixed(2), moved:+Math.hypot(pl.pos.x-bx,pl.pos.z-bz).toFixed(4),
          targetBlocked:pl.blocked(tx,tz), targetFloor:s.floorAt(tx,tz,pl.footY)});
      }
      pl.keys.KeyW=false;
      return {label,rows};
    };
    const traceWalk = (x,z,y,yaw,label) => {
      s.spawnAt(x,z,y,yaw,0);
      const rows=[];
      for(let i=0;i<10;i++){
        const bx=pl.pos.x,bz=pl.pos.z,bf=pl.footY;
        pl.keys.KeyW=true; pl.update(0.033,g); g.update(0.033);
        rows.push({i,x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2),
          moved:+Math.hypot(pl.pos.x-bx,pl.pos.z-bz).toFixed(4),blocked:pl.blocked(pl.pos.x,pl.pos.z)});
      }
      pl.keys.KeyW=false;
      return {label,rows};
    };
    return [
      traceClimb(-2.75,7.5,0,'GF'),
      traceClimb(-2.75,7.5,4.2,'F2'),
      traceWalk(-15.7,-5.0,0,0,'B-stair-down'),
      traceWalk(-15.7,-10.3,-3.4,Math.PI,'B-stair-up'),
    ];
  });
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
