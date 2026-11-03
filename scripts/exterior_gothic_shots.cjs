// Exterior evidence shots for the Gothic-Victorian correction: front, both
// sides, a three-quarter view and a close view of the entrance and gable, all
// in the game's own lighting.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.SILID_OUT || 'reports/exterior_gothic';
const shots = [
  { n: 'front', x: 0, z: 62, yaw: 0, pitch: 0.22 },
  { n: 'threequarter', x: 40, z: 58, yaw: 0.62, pitch: 0.16 },
  { n: 'east', x: 52, z: 6, yaw: 1.57, pitch: 0.14 },
  { n: 'west', x: -52, z: 6, yaw: -1.57, pitch: 0.14 },
  { n: 'close', x: -2, z: 26, yaw: 0.02, pitch: 0.30 },
  { n: 'gable', x: 8, z: 34, yaw: 0.20, pitch: 0.42 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(1200);
  for (const s of shots) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await p.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.n}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.n);
  }
  console.log(JSON.stringify(await p.evaluate(() => window.__silid.metrics())));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
