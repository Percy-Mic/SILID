const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident, pl = s.player;
    pl.enabled = false; pl.pos.set(60,1,60); r.armed = true;
    r.pos.set(0,0,4); r.footY=0; r.level='GF'; r.state='patrol';
    r.planToPoint({x:-2,z:-6,y:4.2,level:'F2'});
    const path = r.path.slice(0,18).map(q=>({x:+q.x.toFixed(2),z:+q.z.toFixed(2),y:q.y===undefined?null:+q.y.toFixed(2)}));
    // simulate 6s and log every second
    const log = [];
    for (let sec=0; sec<45; sec++) {
      for (let i=0;i<30;i++) s.game.update(0.033);
      log.push({t:sec, x:+r.pos.x.toFixed(2), z:+r.pos.z.toFixed(2), foot:+r.footY.toFixed(2), idx:r.pathIdx, wp:r.path[r.pathIdx] ? {x:+r.path[r.pathIdx].x.toFixed(2),z:+r.path[r.pathIdx].z.toFixed(2)} : null, state:r.state});
    }
    return { path, log, blockedAt: {
      now: r.blockedAt(r.pos.x, r.pos.z, r.footY),
    }};
  }), null, 1));
  await b.close();
})();
