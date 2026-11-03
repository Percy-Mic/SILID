// Wide views of the finished roof and two posed climb illustrations, rendered
// from the live scene with a free camera, plus the draw/triangle cost of the
// roof as the renderer reports it.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/';
const OUT = 'reports/roof';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(URL + '?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });

  const shot = async (name, code) => {
    const data = await page.evaluate((src) => {
      const w = window.__silid;
      // eslint-disable-next-line no-new-func
      new Function('w', src)(w);
      w.renderer.render(w.scene, w.camera);
      return w.renderer.domElement.toDataURL('image/png');
    }, code);
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(name);
  };

  await shot('wide_01_rear', `
    w.camera.position.set(-6, 22, -44);
    w.camera.lookAt(-2, 14, -8);
    w.camera.updateProjectionMatrix();
  `);
  await shot('wide_02_threequarter', `
    w.camera.position.set(34, 30, -34);
    w.camera.lookAt(0, 13, 0);
    w.camera.updateProjectionMatrix();
  `);
  await shot('wide_03_deck', `
    w.camera.position.set(-2, 26, -24);
    w.camera.lookAt(-10, 12, -9);
    w.camera.updateProjectionMatrix();
  `);
  await shot('wide_04_ladder_elevation', `
    w.camera.position.set(-13.3, 7.0, -20);
    w.camera.lookAt(-13.1, 8.6, -11);
    w.camera.updateProjectionMatrix();
  `);

  // posed climb illustrations, from the controller's own eye
  await shot('08_climb_rail', `
    const p = w.player;
    p.footY = 6.4; p.pos.set(-13.3, p.footY + p.height, -11.42);
    p.yaw = 0.55; p.pitch = -0.28; p.syncCamera();
  `);
  await shot('09_landing_rails', `
    const p = w.player;
    p.footY = 11.6; p.pos.set(-12.9, p.footY + p.height, -11.9);
    p.yaw = 0.25; p.pitch = -0.22; p.syncCamera();
  `);

  const cost = await page.evaluate(() => {
    const w = window.__silid;
    w.renderer.render(w.scene, w.camera);
    return {
      calls: w.renderer.info.render.calls,
      tris: w.renderer.info.render.triangles,
      fps: Math.round(w.game._fps || 0),
      programs: w.renderer.info.programs.length,
    };
  });
  console.log('cost', JSON.stringify(cost));
  fs.writeFileSync(`${OUT}/cost.json`, JSON.stringify(cost, null, 2));
  await browser.close();
})();
