const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  await p.goto('http://127.0.0.1:5199/?probe=1');
  await p.waitForFunction(()=>window.__silid?.ready,null,{timeout:300000});
  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game;
    w.spawnAt(10.5, 3.3, -3.4, Math.PI, 0);
    w.player.enabled = true;
    const snapshot = () => w.architecture.doors.map(d=>({c:d.c,at:d.at,ax:d.axis,open:d.open,hasCS:!!d.closedSeg}));
    const before = snapshot();
    const near = g.nearestInteraction();
    const target = near && near.door ? {c:near.door.c, at:near.door.at, ax:near.door.axis, open:near.door.open} : null;
    g.interact();
    const after = snapshot();
    const changed = after.map((d,i)=>({...d, was:before[i].open})).filter(d=>d.open!==d.was);
    return { target, changed, msg: (document.querySelector('#prompt')?.textContent)||null };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
