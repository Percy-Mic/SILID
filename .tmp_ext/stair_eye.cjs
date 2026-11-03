// Eye height on the boards after the collision fix.
const { chromium } = require('playwright');
const fs = require('fs');
const shots = [
  // y is the tread / landing top the collision query returns at that spot
  { name: 'mid_flight', x: -4.41, z: 7.6, y: 1.225, look: 0, pitch: 0.16 },
  { name: 'half_landing', x: -3.6, z: 5.2, y: 2.1, look: Math.PI, pitch: -0.18 },
];
(async () => {
  fs.mkdirSync('reports/stair_check', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    if (w.game?.resident) w.game.resident.update = () => {};
    w.scene.add(new T.HemisphereLight(0xa8bcd4, 0x2b2b26, 1.4));
    const d = new T.DirectionalLight(0xdce6f2, 1.0); d.position.set(-20, 40, 22); w.scene.add(d);
  });
  for (const s of shots) {
    const info = await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.look, s.pitch);
      w.player.flashlightOn = true;
      w.game.update(0.05);
      return { foot: +w.player.footY.toFixed(3), camY: +w.camera.position.y.toFixed(3) };
    }, s);
    await p.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/stair_check/eye_${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log(s.name, JSON.stringify(info));
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
