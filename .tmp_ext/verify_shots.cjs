const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '.tmp_ext/verify2';
const shots = [
  { name: 'elevation', x: 0, z: 58, yaw: 0, pitch: 0.20 },
  { name: 'entry', x: 0, z: 24, yaw: 0, pitch: 0.14 },
  { name: 'drawing_out', x: 17, z: 23, yaw: 0, pitch: 0.12 },
  { name: 'bay_straight', x: 17.0, z: 11.8, yaw: Math.PI, pitch: 0.02 },
  { name: 'bay_ceiling', x: 17, z: 12.4, yaw: Math.PI, pitch: 0.55 },
  { name: 'breakfast', x: -2.6, z: -12.6, yaw: 1.9, pitch: 0.05 },
  { name: 'rear', x: 0, z: -34, yaw: Math.PI, pitch: 0.16 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (/extensions|facade|Uncaught|TypeError|is not/.test(t)) console.log('CONSOLE', t.slice(0, 240));
  });
  const cdp = await page.context().newCDPSession(page);
  await page.goto('http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xc8d4de, 0x3a3d34, 2.2));
    const dir = new T.DirectionalLight(0xe8eef6, 1.5); dir.position.set(30, 60, 60); w.scene.add(dir);
    w.renderer.toneMappingExposure = 1.5;
  });
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      if (w.player.flash) w.player.flash.visible = true;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  const stat = await page.evaluate(() => window.__silid.metrics());
  console.log(JSON.stringify(stat));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
