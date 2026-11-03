const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    for (const d of A.doors) if (d.collider) d.collider.disabled=true;
    pl.footY=-3.4;
    const rows=[[-18,-5.9],[-18,-5.5],[-18,-5.4],[-18,-5.0],[-18,-4.6],[-18,-4],[-16,-5.0],[-15.5,-8]];
    return {rows:rows.map(([x,z])=>({p:[x,z],b:pl.blocked(x,z)})), missing:A.missingDoors};
  }),null,1));
  await b.close();
})();
