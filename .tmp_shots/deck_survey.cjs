const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:5199/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  await page.evaluate(() => { window.__silid.player.enabled = false; });
  const shots = [
    ['deck_gallery', [-2, 13.35, 9.5], [6, 13.9, 2]],
    ['deck_rear', [-9, 13.35, -9.5], [2, 13.6, -7]],
    ['deck_oblique', [-16, 18, -18], [-6, 12.5, -6]],
    ['deck_edge', [-9, 13.0, -11.6], [-9, 13.2, -6]],
  ];
  for (const [name, pos, at] of shots) {
    await page.evaluate(({ pos, at }) => {
      const w = window.__silid;
      w.camera.position.set(...pos);
      w.camera.lookAt(at[0], at[1], at[2]);
      w.renderer.render(w.scene, w.camera);
    }, { pos, at });
    await page.screenshot({ path: `reports/roof/${name}.jpg`, type: 'jpeg', quality: 82, timeout: 300000 });
    console.log('shot', name);
  }
  console.log('errors', errs.slice(0, 4));
  await browser.close();
})();
