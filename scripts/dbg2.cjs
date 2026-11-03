const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s=window.__silid, pl=s.player, A=s.architecture;
    pl.footY=0;
    const before = pl.blocked(-17,6);
    let n=0, undef=0;
    for (const d of A.doors) { if (d.collider) { d.collider.disabled = true; n++; } else undef++; }
    const after = pl.blocked(-17,6);
    const still = A.colliders.filter(c=>!c.disabled && c.x1<=-16.2 && c.x2>=-17.8 && c.z1<=6.7 && c.z2>=5.3).map(c=>c.kind);
    return {before, after, doorsDisabled:n, doorsWithoutCollider:undef, still};
  })));
  await b.close();
})();
