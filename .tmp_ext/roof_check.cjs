// Above the treeline, looking down at each side roof: is the cross-gable there,
// on the right flank, and clear of the pavilion roof?
const { chromium } = require('playwright');
const fs = require('fs');
const shots = [
  { name: 'east_roof', x: 44, z: 18, y: 12, at: [16, 7] },
  { name: 'east_roof2', x: 40, z: -18, y: 12, at: [16, 5] },
];
(async () => {
  fs.mkdirSync('.tmp_ext/roofcheck', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 576 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xbdccdc, 0x3a3d34, 3.0));
    const d = new T.DirectionalLight(0xe8eef6, 2.0); d.position.set(60, 120, 40); w.scene.add(d);
    w.renderer.toneMappingExposure = 1.6;
  });
  for (const s of shots) {
    const yaw = Math.atan2(-(s.at[0] - s.x), -(s.at[1] - s.z));
    await p.evaluate(({ s, yaw }) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, yaw, 0.08);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game.update(0.05);
    }, { s, yaw });
    await p.waitForTimeout(600);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`.tmp_ext/roofcheck/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
