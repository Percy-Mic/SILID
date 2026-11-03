const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5333/?probe=1&x=-53&z=24.3&yaw=2.2&pitch=-0.08');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  const info = await p.evaluate(() => {
    const s = window.__silid;
    const car = s.scene.getObjectByName('BrokenDownCar');
    const mats = new Set(); car.traverse(o => { if (o.isMesh) mats.add(o.material); });
    const arr = [...mats].map(m => ({c:'#'+m.color.getHexString(), r:m.roughness, m:m.metalness, e:'#'+m.emissive?.getHexString(), ei:m.emissiveIntensity}));
    window.__silid.player.toggleFlash(); // off
    s.renderer.render(s.scene, s.camera);
    return { mats: arr, flash: s.player.flash.intensity, light: s.player.flash.intensity };
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'reports/rebuild/car_noflash.png' });
  console.log(JSON.stringify(info));
  await b.close();
})();
