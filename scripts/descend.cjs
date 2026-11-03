const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    const walk=(x,z,y,yaw,steps)=>{pl.teleport(x,z,y);pl.yaw=yaw;pl.syncCamera();pl.keys.KeyW=true;
      for(let i=0;i<steps;i++){pl.update(0.05,g);g.update(0.05);} pl.keys.KeyW=false;
      return {x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2),room:g.roomName(g.currentLevel())};};
    const out={};
    out.down1 = walk(-15.5,-5.3,0,0,120);
    out.landing = walk(out.down1.x,out.down1.z,out.down1.foot,0,40);
    return out;
  }),null,1));
  await b.close();
})();
