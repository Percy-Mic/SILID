// Realism tour: first-person shots of representative rooms in the live game.
// Every frame is the actual renderer, spawned through the game's own player
// path, flashlight on — the same conditions a player inspects a room under.
//
// Usage: node scripts/realism_tour.cjs [outDir]
// Requires the Vite dev server (default :5333).
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/realism/tour';

// rect = [x0, z0, x1, z1] from the plan of record; y is the level's floor.
// `at` is the eye corner (fraction of the room) and `aim` the point looked at.
const ROOMS = [
  { name: 'foyer', y: 0, rect: [-5, 2, 4, 11], at: [0.18, 0.85], aim: [0.55, 0.15], pitch: 0.02 },
  { name: 'kitchen', y: 0, rect: [-24, -11, -17, -4], at: [0.85, 0.85], aim: [0.15, 0.25], pitch: -0.05 },
  { name: 'dining', y: 0, rect: [-6, -11, 2, -2], at: [0.15, 0.15], aim: [0.75, 0.70], pitch: -0.04 },
  { name: 'living', y: 0, rect: [-14, 2, -5, 11], at: [0.15, 0.15], aim: [0.75, 0.65], pitch: -0.03 },
  { name: 'study', y: 0, rect: [-14, -11, -6, -2], at: [0.2, 0.2], aim: [0.8, 0.75], pitch: -0.04 },
  { name: 'laundry', y: 0, rect: [-24, 0, -17, 4], at: [0.15, 0.2], aim: [0.8, 0.8], pitch: -0.04 },
  { name: 'bedroom', y: 4.2, rect: [-6, -11, 2, -2], at: [0.2, 0.85], aim: [0.7, 0.2], pitch: -0.02 },
  { name: 'bath', y: 4.2, rect: [5, -11, 8, -6], at: [0.15, 0.2], aim: [0.85, 0.8], pitch: -0.06 },
  { name: 'music', y: 8.0, rect: [-14, -11, -7, -2], at: [0.2, 0.2], aim: [0.8, 0.75], pitch: -0.02 },
  { name: 'cellar', y: -3.4, rect: [-19, -5.4, -8, 2], at: [0.15, 0.15], aim: [0.8, 0.8], pitch: -0.08 },
];

function pose(room) {
  const [x0, z0, x1, z1] = room.rect;
  const x = x0 + (x1 - x0) * room.at[0];
  const z = z0 + (z1 - z0) * room.at[1];
  const tx = x0 + (x1 - x0) * room.aim[0];
  const tz = z0 + (z1 - z0) * room.aim[1];
  const yaw = Math.atan2(-(tx - x), -(tz - z));
  return { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) errors.push(e.message); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const only = (process.env.SILID_ROOMS || '').split(',').filter(Boolean);
  const rooms = only.length ? ROOMS.filter((r) => only.includes(r.name)) : ROOMS;
  for (const room of rooms) {
    const p = pose(room);
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, { ...p, y: room.y, pitch: room.pitch });
    await page.waitForTimeout(420);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${room.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', room.name, JSON.stringify(p));
  }
  const metrics = await page.evaluate(() => window.__silid.metrics());
  console.log('metrics', JSON.stringify(metrics));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
