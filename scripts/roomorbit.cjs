// Interior orbit shots for the three GLB rooms.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.SILID_URL || 'http://127.0.0.1:5199';
const OUT = 'reports/roomscan/orbit';
const files = process.argv.slice(2);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    await page.goto(`${BASE}/scripts/roomview.html?f=${encodeURIComponent('/Blender/AssetLibrary/' + f)}`);
    await page.waitForFunction(() => window.__room?.ready, null, { timeout: 300000 });
    const { min, max, size, center } = await page.evaluate(() => window.__room.bbox);
    const eye = min[1] + size[1] * 0.42;
    const r = Math.min(size[0], size[2]) * 0.30;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const from = [center[0] + Math.cos(a) * r, eye, center[2] + Math.sin(a) * r];
      const at = [center[0] - Math.cos(a) * r, eye, center[2] - Math.sin(a) * r];
      await page.evaluate(({ from, at }) => window.__room.setCam(from, at, 68), { from, at });
      await page.waitForTimeout(160);
      await page.screenshot({ path: `${OUT}/${f.replace('.glb', '')}_o${i}_${Math.round(a * 180 / Math.PI)}deg.png` });
    }
    await page.close();
  }
  await browser.close();
})();
