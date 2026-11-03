const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 660 } });
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(1000);
  const shots = [
    { name: 'f2_bedroom', x: 0, z: -5, y: 4.2, yaw: Math.PI, pitch: 0.0 },
    { name: 'f2_prayer', x: -20, z: -4, y: 4.2, yaw: -1.2, pitch: 0.0 },
    { name: 'gf_kitchen', x: -20, z: -8, y: 0, yaw: 2.2, pitch: 0.0 },
  ];
  fs.mkdirSync('reports/exterior/int', { recursive: true });
  for (const s of shots) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      if (w.player.flash) w.player.flash.visible = true;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await p.waitForTimeout(700);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/exterior/int/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  await b.close();
})();
