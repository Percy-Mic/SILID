// Evidence shots for the four-storey stair: the foot of the flight in the
// foyer, and the arrival on each upper floor, taken from the exact points the
// traversal test ended at.
const { chromium } = require('playwright');
const fs = require('fs');
const shots = [
  // standing at the foot of lane A in the foyer, looking up the flight
  { name: '1_foyer_foot', x: -2.87, z: 10.4, y: 0, yaw: 0, pitch: 0.34 },
  // at the head of lane B on each floor, looking north down the well
  { name: '2_arrive_f2', x: -2.87, z: 10.2, y: 4.2, yaw: 0, pitch: -0.30 },
  { name: '3_arrive_f3', x: -2.87, z: 10.2, y: 8.0, yaw: 0, pitch: -0.30 },
  { name: '4_arrive_f4', x: -2.87, z: 10.2, y: 11.6, yaw: 0, pitch: -0.30 },
];
(async () => {
  fs.mkdirSync('reports/stair_check', { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    if (w.game?.resident) w.game.resident.update = () => {};
    w.scene.add(new T.HemisphereLight(0xa8bcd4, 0x2b2b26, 1.5));
    const d = new T.DirectionalLight(0xdce6f2, 1.1);
    d.position.set(-20, 40, 22);
    w.scene.add(d);
  });
  for (const s of shots) {
    const info = await p.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.game.update(0.05);
      return { foot: +w.player.footY.toFixed(2), room: w.game.roomName(w.game.currentLevel()) };
    }, s);
    await p.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`reports/stair_check/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log(s.name, JSON.stringify(info));
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
