// Car material evidence: torch on, standing where a player inspects the car,
// plus the ground/contact numbers from the running scene.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 60000 });
  await p.waitForTimeout(1000);
  const views = [
    { name: 'car_torch_side', x: -64.4, z: -8.4, y: 0, yaw: 2.35, pitch: -0.08 },
    { name: 'car_torch_rear', x: -66.6, z: -1.4, y: 0, yaw: 3.05, pitch: -0.12 },
  ];
  for (const v of views) {
    await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      for (let i = 0; i < 3; i++) w.player.update(1 / 60, w.game);
      w.game.update(0.05);
    }, v);
    await p.waitForTimeout(400);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/road/after/${v.name}.png`, Buffer.from(png.data, 'base64'));
  }
  const info = await p.evaluate(() => {
    const w = window.__silid;
    const car = w.scene.getObjectByName('Car');
    return {
      carGroundY: +w.carGroundY().toFixed(3),
      carBodyY: +w.carBodyY().toFixed(3),
      // the road mesh directly under the car
      roadY: (() => {
        const road = w.scene.getObjectByName('SM_Road');
        return road ? +road.geometry.attributes.position.array[1].toFixed(3) : null;
      })(),
      wheelPositions: car?.wheels?.map((x) => +x.position.y.toFixed(3)),
      carRot: car ? +car.rotation.y.toFixed(2) : null,
    };
  });
  console.log(JSON.stringify({ info, errs }, null, 1));
  await b.close();
})();
