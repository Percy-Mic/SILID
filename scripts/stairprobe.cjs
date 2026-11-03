const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const s=window.__silid, pl=s.player, g=s.game;
    const step = (n, follow) => {
      pl.keys.KeyW = true;
      for (let i=0;i<n;i++) {
        if (follow) {
          const a = Math.atan2(pl.pos.z - 7.5, pl.pos.x + 1.5);
          pl.yaw = Math.PI - a;
        }
        pl.update(0.05, g); g.update(0.05);
      }
      pl.keys.KeyW = false;
    };
    const out = {};
    pl.teleport(-1.5, 10.55, 0); pl.yaw = Math.PI/2; pl.syncCamera();
    step(260, true);
    out.afterHelix = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2), room:g.roomName(g.currentLevel())};
    // continue on the second helix from this landing
    step(300, true);
    out.afterSecond = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2), room:g.roomName(g.currentLevel())};
    step(300, true);
    out.afterThird = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2), room:g.roomName(g.currentLevel())};
    // basement stair from the service hall
    pl.teleport(-15.5, -5.3, 0); pl.yaw = 0; pl.syncCamera(); step(80, false);
    out.basementStair = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2), room:g.roomName(g.currentLevel())};
    // tunnel door and beyond
    pl.teleport(14.2, 6, -3.4); pl.yaw = -Math.PI/2; pl.syncCamera(); g.update(0.05); g.interact();
    step(180, false);
    out.tunnel = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2)};
    step(220, false);
    out.cave = {x:+pl.pos.x.toFixed(2), z:+pl.pos.z.toFixed(2), foot:+pl.footY.toFixed(2)};
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
