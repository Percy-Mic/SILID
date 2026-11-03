const { chromium } = require('playwright');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const cdp = await p.context().newCDPSession(p);
  const shot = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    require('fs').writeFileSync('reports/opening/' + name, Buffer.from(data, 'base64'));
  };
  await p.goto('http://127.0.0.1:5333/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await sleep(1200);
  await shot('00_title.png');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__silid.opener.phase === 'driving', null, { timeout: 20000 });
  await sleep(1800);
  await shot('01_inside.png');
  // look at the wheel / dash a little
  await p.evaluate(() => { const s = window.__silid; s.player.pitch = -0.22; s.player.yaw = s.opener.heading + Math.PI + 0.25; });
  await sleep(600);
  await shot('02_dash.png');
  await p.evaluate(() => { const s = window.__silid; s.player.pitch = -0.05; s.player.yaw = s.opener.heading + Math.PI; });
  // drive
  await p.keyboard.down('w');
  await p.waitForFunction(() => window.__silid.opener.phase === 'failing', null, { timeout: 120000, polling: 300 });
  await sleep(1400);
  await shot('03_failing.png');
  await p.keyboard.up('w');
  await p.waitForFunction(() => window.__silid.opener.phase === 'stopped', null, { timeout: 60000, polling: 300 });
  await sleep(1200);
  await shot('04_stopped_inside.png');
  await p.keyboard.press('e');
  await sleep(1600);
  // look at the car from beside the open door
  await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    s.player.yaw = Math.atan2(-(o.x - s.player.pos.x), -(o.z - s.player.pos.z));
    s.player.pitch = -0.05; s.player.syncCamera();
  });
  await sleep(600);
  await shot('05_beside_car.png');
  // step back and view the whole car in its surroundings
  await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    s.player.teleport(o.x + 1.2, o.z - 7.5);
    s.player.yaw = Math.atan2(-(o.x - s.player.pos.x), -(o.z - s.player.pos.z));
    s.player.pitch = -0.03; s.player.syncCamera();
  });
  await sleep(900);
  await shot('06_car_on_shoulder.png');
  // the walk north, toward the estate
  await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    s.player.teleport(s.roadCentreAt(o.z) + 1.4, o.z + 2);
    s.player.yaw = 0; s.player.pitch = 0; s.player.syncCamera();
  });
  await sleep(900);
  await shot('07_road_north.png');
  console.log('shots ok, errors', errs.slice(0, 3), 'fps', await p.evaluate(() => +(window.__silid.game?._fps || 0).toFixed(1)));
  await b.close();
})();
