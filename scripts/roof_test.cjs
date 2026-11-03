// Look at the house from outside after the facade pass: front, rear, three
// quarter and top, plus any runtime error the pass threw.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('reports/roof', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.goto('http://127.0.0.1:5199/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  const m = await page.evaluate(() => window.__silid.metrics());
  console.log('metrics', JSON.stringify(m));
  await page.evaluate(() => { window.__silid.player.enabled = false; });
  const shots = [
    ['front', [0, 13, 52], [0, 11, 11]],
    ['rear', [-4, 18, -44], [-4, 13, -11]],
    ['threequarter', [44, 20, 44], [0, 10, 0]],
    ['top', [0, 62, -2], [0, 10, -2]],
  ];
  for (const [name, pos, at] of shots) {
    await page.evaluate(({ pos, at }) => {
      const w = window.__silid;
      w.camera.position.set(...pos);
      w.camera.lookAt(at[0], at[1], at[2]);
      w.renderer.render(w.scene, w.camera);
    }, { pos, at });
    await page.screenshot({ path: `reports/roof/facade_${name}.jpg`, type: 'jpeg', quality: 82, timeout: 300000 });
    console.log('shot', name);
  }
  console.log('errors', JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})();
