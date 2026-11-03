const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    pl.teleport(0,4.4,0); pl.yaw=0; pl.syncCamera();
    const rows=[];
    pl.keys.KeyW=true;
    for(let i=0;i<80;i++){ const b4=pl.blocked(pl.pos.x,pl.pos.z-0.12); const f=s.floorAt(pl.pos.x,pl.pos.z-0.12,pl.footY); pl.update(0.05,g); g.update(0.05); rows.push([+pl.pos.z.toFixed(3), +pl.footY.toFixed(2), b4, f===null?'null':+f.toFixed(2)]); }
    pl.keys.KeyW=false;
    return rows.filter((r,i)=>i%6===0 || i>70);
  }),null,1));
  await b.close();
})();
