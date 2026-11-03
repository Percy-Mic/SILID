// Look at the roof and the rear service wall before changing them: what is
// actually built, and where a ladder can land.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('reports/roof', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:5199/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  const info = await page.evaluate(() => {
    const w = window.__silid;
    const f4 = w.levels.find((l) => l.id === 'F4');
    const ladder = w.architecture.colliders.find((c) => c.kind === 'ladder');
    return {
      terrainAtLadder: +w.terrainAt(-9.25, -11.36).toFixed(2),
      terrainAtOld: +w.terrainAt(-17, -11.36).toFixed(2),
      ladder,
      f4y: f4.y,
      windowsF4: w.architecture.windows.filter((x) => x.level === 'F4').map((x) => [x.axis, x.c, +x.a.toFixed(1), +x.b.toFixed(1), x.room]),
      props: w.props.count,
    };
  });
  console.log(JSON.stringify(info));

  const shots = [
    ['roof_rear', [-6, 26, -34], [-4, 13, -10]],
    ['roof_rear_close', [-6, 16.5, -22], [-8, 12.5, -10]],
    ['roof_top', [2, 42, -2], [0, 11.6, -2]],
    ['ladder_old', [-17, 6, -22], [-17, 6, -11.4]],
  ];
  await page.evaluate(() => { window.__silid.player.enabled = false; });
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
  if (errs.length) console.log('errors', errs.slice(0, 4));
  await browser.close();
})();
