// Live-game screenshots for the mansion QA report. Reads the running Vite
// build through ?probe=1, spawns the real player at authored coordinates and
// captures the frame. No mock geometry: these are the rendered scene.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = 'reports/mansion';
const shots = [
  { name: '01_foyer_stair', x: -4.3, z: 9.7, y: 0, yaw: -0.72, pitch: 0.05 },
  { name: '02_stair_midflight', x: -4.7, z: 7.5, y: 4.2, yaw: -1.25, pitch: -0.42 },
  { name: '03_f2_landing', x: -5.15, z: 7.5, y: 4.2, yaw: -Math.PI / 2, pitch: 0.0 },
  { name: '04_f2_hall', x: -4.9, z: 9.4, y: 4.2, yaw: 0.1, pitch: 0.02 },
  { name: '05_f3_landing', x: -5.0, z: 7.9, y: 8.0, yaw: -1.15, pitch: 0.0 },
  { name: '06_f4_landing', x: -4.9, z: 7.9, y: 11.6, yaw: -1.15, pitch: 0.02 },
  { name: '07_basement_stair', x: -15.7, z: -10.0, y: -3.4, yaw: Math.PI, pitch: 0.22 },
  { name: '08_basement_landing', x: -15.7, z: -10.1, y: -3.4, yaw: Math.PI * 0.75, pitch: 0.0 },
  { name: '11_courtyard_rail', x: 15, z: 3.2, y: 11.6, yaw: 0.25, pitch: -0.30 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  // Chromium's Page.captureScreenshot does not wait on document.fonts; the
  // Playwright screenshot helper blocks forever on this page's font set.
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  for (const s of shots) {
    await page.evaluate((s) => {
      const w = window.__silid;
      w.spawnAt(s.x, s.z, s.y, s.yaw, s.pitch);
      w.player.flashlightOn = true;
      w.player.flash.visible = true;
      w.game._lightTimer = 0;
      w.game.update(0.05);
    }, s);
    await page.waitForTimeout(450);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', s.name);
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__silid.metrics())));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
