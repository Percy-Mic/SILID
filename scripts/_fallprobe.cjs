const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, r = s.resident, pl = s.player;
    pl.enabled=false; pl.pos.set(60,1,60); r.armed=true;
    r.pos.set(0,0,4); r.footY=0; r.level='GF'; r.state='patrol';
    r.planToPoint({x:-2,z:-6,y:4.2,level:'F2'});
    const log=[];
    for(let i=0;i<900;i++){
      s.game.update(0.033);
      const f = s.floorAt(r.pos.x, r.pos.z, r.footY);
      if (i>540 && i<700) log.push({i, x:+r.pos.x.toFixed(2), z:+r.pos.z.toFixed(2), foot:+r.footY.toFixed(2), f: f===null?null:+f.toFixed(2), lvl:r.level, idx:r.pathIdx,
        wp:r.path[r.pathIdx]?{x:+r.path[r.pathIdx].x.toFixed(2),z:+r.path[r.pathIdx].z.toFixed(2),y:r.path[r.pathIdx].y===undefined?null:+r.path[r.pathIdx].y.toFixed(2)}:null});
    }
    return {log, pathLen:r.path.length};
  }), null, 1));
  await b.close();
})();
