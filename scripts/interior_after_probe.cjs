// The exterior key was raised a long way; interiors share the hemisphere light,
// so this takes the foyer and a corridor in the game's own lighting to check
// they did not become a white box.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('reports/exterior_gothic', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(800);
  for (const s of [
    { n: 'in_foyer', x: 0, z: 8.4, y: 1.7, yaw: 0, pitch: 0.05, flash: true },
    { n: 'in_hall', x: -6, z: 4.0, y: 1.7, yaw: 1.4, pitch: 0.0, flash: true },
    { n: 'porch', x: 1.4, z: 20.5, y: 1.7, yaw: 0, pitch: 0.10, flash: false },
  ]) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = s.flash;
      if (w.player.flash) w.player.flash.visible = s.flash;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await p.waitForTimeout(400);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/exterior_gothic/${s.n}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.n);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
