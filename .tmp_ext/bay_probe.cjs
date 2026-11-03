// Inspect the three projecting rooms from outside and list what was built.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '.tmp_ext/bays';
const shots = [
  { name: 'drawing_front', x: 17, z: 26, yaw: 0, pitch: 0.10 },
  { name: 'drawing_corner', x: 29, z: 24, yaw: 0.62, pitch: 0.14 },
  { name: 'sitting_front', x: 6.8, z: 24, yaw: 0, pitch: 0.10 },
  { name: 'breakfast_rear', x: -2, z: -28, yaw: Math.PI, pitch: 0.10 },
];
const LIST = process.env.LIST === '1';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto('http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.add(new T.HemisphereLight(0xc8d4de, 0x3a3d34, 2.6));
    const dir = new T.DirectionalLight(0xe8eef6, 1.8); dir.position.set(30, 40, 45); w.scene.add(dir);
    w.renderer.toneMappingExposure = 1.5;
  });
  const info = LIST ? await page.evaluate(() => {
    const w = window.__silid;
    const out = [];
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!/^Bay|^Facade_/.test(o.name)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const bb = new w.THREE.Box3().setFromObject(o);
      out.push({
        name: o.name,
        counts: o.geometry.attributes.position.count,
        mats: mats.map((m) => m?.name + ':' + (m?.color ? m.color.getHexString() : '?') + ':' + (m?.map ? 'map' : 'nomap')),
        box: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => +v.toFixed(2)),
      });
    });
    return { builds: window.__silid.architecture.extensions, meshes: out, windows: w.architecture.windows.filter((x) => x.room && /^GF-1[789]$/.test(x.room)).length };
  }) : null;
  if (info) console.log(JSON.stringify(info, null, 1));
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, null, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      if (w.player.flash) w.player.flash.visible = true;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
