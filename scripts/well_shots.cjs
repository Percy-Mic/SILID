// Before/after shots of the stair well and the floor slabs, from the same
// camera poses on both builds.
//
//   SILID_URL=http://127.0.0.1:5344/?probe=1 node scripts/well_shots.cjs reports/slabphone/before
//   SILID_URL=http://127.0.0.1:5333/?probe=1 node scripts/well_shots.cjs reports/slabphone/after
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/slabphone/after';

const SHOTS = [
  { name: 'a_foyer_below_well', x: -1.5, z: 4.2, y: 0, yaw: Math.PI, pitch: 0.62 },
  { name: 'b_f2_landing_into_well', x: -1.5, z: 10.5, y: 4.2, yaw: 0, pitch: -0.44 },
  { name: 'c_f2_rim_close', x: -1.5, z: 10.15, y: 4.2, yaw: 0, pitch: -0.92 },
  { name: 'd_foyer_ceiling', x: -1.5, z: 3.0, y: 0, yaw: Math.PI, pitch: 0.95 },
  { name: 'e_f1_floor_edge', x: -4.3, z: 6.0, y: 0, yaw: Math.PI * 0.78, pitch: 0.42 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });
  await page.waitForTimeout(1000);
  const cdp = await page.context().newCDPSession(page);

  for (const s of SHOTS) {
    const info = await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      w.game._lightTimer = 0;
      for (let i = 0; i < 6; i++) w.game.update(0.033);
      return { x: +w.player.pos.x.toFixed(2), z: +w.player.pos.z.toFixed(2), foot: +w.player.footY.toFixed(2) };
    }, s);
    await page.waitForTimeout(500);
    let saved = false;
    for (let i = 0; i < 3 && !saved; i++) {
      try {
        const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT, s.name + '.png'), Buffer.from(png.data, 'base64'));
        saved = true;
      } catch (err) {
        console.log('retry', s.name, err.message);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    console.log('shot', s.name, JSON.stringify(info), saved ? '' : 'FAILED');
  }
  await browser.close().catch(() => {});
})();
