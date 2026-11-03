const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    const climb = (x,z,steps) => {
      pl.teleport(x,z,null); pl.keys.KeyW=true;
      let blockedAt=null;
      for (let i=0;i<steps;i++){
        const here = s.floorAt(pl.pos.x, pl.pos.z, pl.footY) ?? s.terrainAt(pl.pos.x,pl.pos.z);
        let best=null, bestH=here-0.001;
        for (let a=0;a<24;a++){
          const th=(a/24)*Math.PI*2, px=pl.pos.x+Math.cos(th)*0.3, pz=pl.pos.z+Math.sin(th)*0.3;
          const h=s.floorAt(px,pz,pl.footY); if(h===null||h===undefined) continue;
          if (h>bestH && !pl.blocked(px,pz)) { bestH=h; best=th; }
        }
        if (best===null) { pl.yaw += 0.25; } else { pl.yaw = Math.atan2(-Math.cos(best), -Math.sin(best)); }
        const before = {x:pl.pos.x, z:pl.pos.z};
        pl.update(0.05,g); g.update(0.05);
        if (Math.hypot(pl.pos.x-before.x, pl.pos.z-before.z) < 1e-4 && best!==null) { blockedAt={x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2)}; }
      }
      pl.keys.KeyW=false;
      return {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2), level:g.currentLevel?.(), room:g.roomName(g.currentLevel?.()), stuck:blockedAt};
    };
    const out={};
    out.footing = climb(-1.5, 10.4, 900);
    out.down = (()=>{ const r=climb(-15.5,-5.3, 260); return r; })();
    return out;
  }),null,1));
  await b.close();
})();
