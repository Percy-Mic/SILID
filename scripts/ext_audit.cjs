// Exterior audit: what the house actually looks like from outside, lit, and
// what the facade is made of. Temporary probe — not part of the game.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.env.SILID_OUT || 'reports/exterior/audit';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1200);

  const stats = await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    const out = { meshes: [], lights: 0 };
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!/^Facade|^Roof|^Turret|^Chimney/i.test(o.name)) return;
      const b = new T.Box3().setFromObject(o);
      const g = o.geometry;
      out.meshes.push({
        n: o.name,
        tris: (g.index ? g.index.count : g.attributes.position.count) / 3,
        y: [+b.min.y.toFixed(2), +b.max.y.toFixed(2)],
        x: [+b.min.x.toFixed(1), +b.max.x.toFixed(1)],
        z: [+b.min.z.toFixed(1), +b.max.z.toFixed(1)],
        color: o.material?.color?.getHexString?.() ?? null,
        map: !!o.material?.map,
        side: o.material?.side,
      });
    });
    return out;
  });
  console.log(JSON.stringify(stats, null, 1));

  // flat daylight, for judging form only
  await page.evaluate(() => {
    const w = window.__silid;
    const T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xc4d4e4, 0x40443c, 2.6));
    const sun = new T.DirectionalLight(0xf2f0e8, 2.6);
    sun.position.set(60, 120, 80);
    w.scene.add(sun);
    const fill = new T.DirectionalLight(0x9fb4c8, 1.0);
    fill.position.set(-70, 50, -60);
    w.scene.add(fill);
    w.renderer.toneMappingExposure = 1.5;
  });

  const shots = [
    { name: 'wide_lit', x: 0, z: 95, yaw: 0, pitch: 0.20 },
    { name: 'mid_lit', x: 0, z: 62, yaw: 0, pitch: 0.24 },
    { name: 'roof_lit', x: 22, z: 78, yaw: 0.32, pitch: 0.30 },
    { name: 'entry_lit', x: 0, z: 30, yaw: 0, pitch: 0.34 },
  ];
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = false;
      if (w.player.flash) w.player.flash.visible = false;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
