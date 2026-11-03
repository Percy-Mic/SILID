// One frame of the house as the game actually lights it (no probe lights), so
// a material decision can be judged against what the player sees at night.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.SILID_OUT || 'reports/exterior/finalgame';
const shots = [
  { n: 'drive_night', x: -27, z: 52, yaw: -0.497, pitch: 0.10 },
  { n: 'south_night', x: 0, z: 58, yaw: 0, pitch: 0.20 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(1500);
  for (const s of shots) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await p.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.n}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.n);
  }
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.metrics())));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
