// Close exterior views of the ladder head, landing and service doorway, at
// landing height, to check the doorway is not kerbed by the parapet and the
// rails leave the door clear.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/';
const OUT = 'reports/roof';

(async () => {
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

  await shot('close_01_landing', `
    w.camera.position.set(-12.6, 13.4, -16.4);
    w.camera.lookAt(-12.6, 12.3, -11);
    w.camera.updateProjectionMatrix();
  `);
  await shot('close_02_front', `
    w.camera.position.set(6, 24, 34);
    w.camera.lookAt(0, 14, 0);
    w.camera.updateProjectionMatrix();
  `);
  await browser.close();
})();
