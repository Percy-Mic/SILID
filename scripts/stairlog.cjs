const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const rows = await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    pl.teleport(-16,9.4,0); pl.yaw=0; pl.syncCamera();
    const out=[];
    pl.keys.KeyW=true;
    for(let i=0;i<40;i++){
      pl.update(0.05,g); g.update(0.05);
      if(i%4===0) out.push({i,z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2),vz:+pl.vel.z.toFixed(2),blk:pl.blocked(pl.pos.x,pl.pos.z-0.12),floor:s.floorAt(pl.pos.x,pl.pos.z-0.12,pl.footY),dis:pl.keys.KeyW});
    }
    pl.keys.KeyW=false;
    return out;
  });
  console.log(JSON.stringify(rows,null,1));
  await b.close();
})();
