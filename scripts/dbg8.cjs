const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled = true;
    pl.footY=-3.4;
    const lv=s.levels.find(l=>l.id==='B1'), f=lv.footprint, step=0.25;
    const g=(x,z)=>[Math.round((x-f.x0)/step),Math.round((z-f.z0)/step)];
    const out={};
    for (const [x,z] of [[3,2],[3,2.25],[3,1.75],[2.75,2],[3.25,2],[3,1.5],[3,2.5],[2.5,2]]) {
      out[x+','+z]={b:pl.blocked(x,z), ij:g(x,z)};
    }
    return out;
  }),null,1));
  await b.close();
})();
