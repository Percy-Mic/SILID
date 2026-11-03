// Walk in through the front door, then across the foyer and the gallery, using
// the same update loop the game runs. Input by keyboard is unreliable in a
// headless browser (rAF is throttled), so the walk is stepped deterministically.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    const step=(n)=>{for(let i=0;i<n;i++){pl.update(0.05,g);g.update(0.05);}};
    pl.teleport(0,12.6,0); pl.yaw=0; pl.syncCamera();
    const door = s.architecture.doors.find(d=>d.level==='GF'&&d.at===0&&d.c===11);
    g.interact();
    const opened = door?.open;
    step(6);
    pl.keys.KeyW=true; step(150); pl.keys.KeyW=false;
    const inside={x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),foot:+pl.footY.toFixed(2),room:g.roomName(g.currentLevel())};
    // carry on north into the gallery
    pl.keys.KeyW=true; step(120); pl.keys.KeyW=false;
    const gallery={x:+pl.pos.x.toFixed(2),z:+pl.pos.z.toFixed(2),room:g.roomName(g.currentLevel())};
    return {opened, inside, gallery};
  }),null,1));
  await b.close();
})();
