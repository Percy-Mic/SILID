const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(process.env.SILID_URL || 'http://127.0.0.1:5199/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game;
    const spots = [
      ['basement', 11.0, 6.0, -3.4],
      ['tunnel', 25.0, 6.0, -3.4],
      ['cave', 40.0, 6.0, -3.4],
      ['vault', 52.0, 6.0, -2.4],
      ['court', 58.0, 6.0, -1.44],
      ['exit flight', 64.5, 7.9, 0.0],
      ['forest', 70.5, 7.9, 0.85],
    ];
    const res = {};
    for (const [name, x, z, y] of spots) {
      w.spawnAt(x, z, y, -Math.PI / 2, 0);
      w.player.enabled = true; w.player.footY = y;
      g.updateHud?.(); g.update(0.016);
      res[name] = { room: document.getElementById('room')?.textContent, level: document.getElementById('level')?.textContent };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
