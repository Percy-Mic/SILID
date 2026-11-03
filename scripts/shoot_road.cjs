// Live-game screenshots of the road and the car, taken from the real renderer
// through ?probe=1. Pass an output prefix:
//   node scripts/shoot_road.cjs reports/road/before
// Each view teleports the real player (which also settles the opening sequence
// into the post-breakdown world) and captures the rendered frame.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/road/shots';

// The carriageway centreline is authored in src/world/terrain.js. These are
// measured against it rather than guessed: +x east, +z north.
const road = (z) => -62 + 3.2 * Math.sin((z - 10) * 0.012) + 1.4 * Math.sin(z * 0.031);

const views = [
  // standing on the tarmac, looking down at the surface the player stands on
  { name: '01_surface_closeup', x: road(-2) - 1.4, z: -2, yaw: Math.PI, pitch: -0.62 },
  // looking south down the road from the middle of the carriageway
  { name: '02_road_ahead', x: road(-20) - 1.8, z: -20, yaw: Math.PI, pitch: -0.05 },
  // the road behind the breakdown: the shoulder the car pulled onto
  { name: '03_shoulder_verge', x: road(-6) + 3.6, z: -6, yaw: -1.35, pitch: -0.35 },
  // back of the car, tail lamps lit
  { name: '04_car_rear', x: road(-6) - 4.3, z: -2.6, yaw: Math.PI, pitch: -0.02 },
  // in front of the car: bonnet up, headlight beams on the tarmac
  { name: '05_car_front', x: road(-6) - 4.3, z: -13.5, yaw: 0, pitch: -0.05 },
  // three-quarter view to judge the body materials against the road
  { name: '06_car_threequarter', x: road(-6) - 1.2, z: -11.0, yaw: 2.15, pitch: -0.06 },
  // the road as the driver first sees it: far view along the carriageway
  { name: '07_road_far', x: road(6) - 2.0, z: 6, yaw: Math.PI, pitch: 0.0 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, { timeout: 60000 });
  await page.waitForTimeout(1200);

  const shots = [];
  for (const v of views) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y ?? null, s.yaw, s.pitch);
      // let the frame settle: teleporting mid-frame leaves the camera one
      // update behind the pose it was handed
      for (let i = 0; i < 3; i++) w.player.update(1 / 60, w.game);
      w.game._fps = 60;
    }, v);
    await page.waitForTimeout(500);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${v.name}.png`, Buffer.from(png.data, 'base64'));
    const metrics = await page.evaluate(() => window.__silid.metrics());
    shots.push({ ...v, metrics: { calls: metrics.calls, triangles: metrics.triangles, textures: metrics.textures, fps: metrics.fps } });
  }
  console.log(JSON.stringify({ out: OUT, shots, errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
