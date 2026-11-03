const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror',(e)=>{ if(!/Pointer Lock/.test(e.message)) console.log('PAGEERR',e.message); });
  await p.goto('http://127.0.0.1:5199/?probe=1');
  await p.waitForFunction(()=>window.__silid?.ready,null,{timeout:300000});
  const out = await p.evaluate(() => {
    const w = window.__silid;
    w.spawnAt(10.5, 3.3, -3.4, Math.PI, 0);
    w.player.enabled = true;
    const g = w.game;
    const near = g.nearestInteraction();
    const door = w.architecture.doors.find(d=>{const cs=d.closedSeg; if(!cs) return false; const mz=(cs.z1+cs.z2)/2, mx=(cs.x1+cs.x2)/2; return Math.abs(mz-2)<0.2 && Math.abs(mx-10.5)<1;});
    const before = door ? door.open : null;
    g.interact();
    return {
      near: near ? { kind: near.kind, name: near.name, d: near.dist } : null,
      hiding: g.hiding?.mode,
      before, after: door ? door.open : null,
      say: g.message?.text || g.lastSay || null,
      hasKey: g.state?.hasKey,
      locked: door ? g.isDoorLocked(door) : null,
    };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
