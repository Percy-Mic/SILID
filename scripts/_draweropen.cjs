const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const s = window.__silid, g = s.game;
    const u = s.cabinets.units.find(x => x.label === 'master_dresser');
    const fx = Math.sin(u.rot), fz = Math.cos(u.rot);
    const dist = 1.0;
    s.spawnAt(u.x + fx*dist, u.z + fz*dist, u.y, Math.atan2(fx,fz), Math.atan2(u.drawers[0].yc - 1.5, dist - u.d/2));
    g.update(0.05);
    const t1 = g.nearestInteraction();
    g.interact();
    const after = u.drawers.map(d => d.open);
    g.update(0.05);
    const t2 = g.nearestInteraction();
    return { t1: t1?.id, after, t2: t2?.id, t2open: t2?.drawer?.open, label: document.getElementById('prompt')?.textContent };
  }), null, 1));
  await b.close();
})();
