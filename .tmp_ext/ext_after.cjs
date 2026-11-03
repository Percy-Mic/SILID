const { chromium } = require('playwright');
const fs = require('fs');
const shots = [
  { name: 'elevation', x: 0, z: 58, yaw: 0, pitch: 0.20 },
  { name: 'entry', x: 0, z: 26, yaw: 0, pitch: 0.16 },
  { name: 'bay_ext', x: 20, z: 26, yaw: 0.5, pitch: 0.14 },
];
(async () => {
  fs.mkdirSync('.tmp_ext/extafter', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xbdccdc, 0x3a3d34, 3.2));
    const d = new T.DirectionalLight(0xe8eef6, 2.2); d.position.set(70, 110, 60); w.scene.add(d);
    const f = new T.DirectionalLight(0x9fb0c4, 0.7); f.position.set(-60, 40, -80); w.scene.add(f);
    w.renderer.toneMappingExposure = 1.6;
  });
  for (const s of shots) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0; w.game.update(0.05);
    }, s);
    await p.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`.tmp_ext/extafter/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
