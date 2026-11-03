const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s=window.__silid, pl=s.player, game=s.game;
    const sim = (sec) => { pl.keys.KeyW = true; for(let i=0;i<sec*20;i++){ pl.update(0.05, game); game.update(0.05); } pl.keys.KeyW=false; };
    const out={};
    pl.teleport(0,13.0,0); pl.yaw=0; pl.syncCamera(); game.update(0.05);
    out.doorTarget = game.nearestInteraction()?.kind;
    game.interact();
    sim(2.2);
    out.inside = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), room:game.roomName(game.currentLevel()), foot:+pl.footY.toFixed(2)};
    // walk to the stair bottom and up one turn
    pl.teleport(-1.5, 10.2, 0); pl.yaw=0; pl.syncCamera();
    sim(0.5);
    out.stairEnter = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2)};
    // walk into a wall: gallery to the north
    pl.teleport(0,0,0); pl.yaw=Math.PI; pl.syncCamera(); sim(2);
    out.wall = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2)};
    // walk across the gallery toward the west door
    pl.teleport(0,0,0); pl.yaw=Math.PI/2; pl.syncCamera(); sim(4);
    out.west = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2)};
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
