const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const r = await p.evaluate(() => {
    const w = window.__silid, pl = w.player;
    const run = (x0, z0, yaw, steps) => {
      w.spawnAt(x0, z0, null, yaw, 0);
      pl.enabled = true;
      pl.keys.KeyW = true;
      for (let i = 0; i < steps; i++) pl.update(0.02, w.game);
      pl.keys.KeyW = false;
      return [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)];
    };
    return {
      // walking west into the east tower from open ground (yaw = +pi/2 faces -x)
      eastTower: run(31, 8.3, Math.PI / 2, 400),
      // walking east into the west tower (yaw = -pi/2 faces +x)
      westTower: run(-31, 9.6, -Math.PI / 2, 400),
      // the west service door must still be usable: walk west through it
      westDoor: run(-22.6, 6, Math.PI / 2, 400),
    };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
