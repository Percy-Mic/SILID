// ROOM VIEWER — screenshots each GLB from the project's own GLTFLoader.
//   node scripts/roomview.cjs interogation_room.glb
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.SILID_URL || 'http://127.0.0.1:5199';
const OUT = 'reports/roomscan';
const files = process.argv.slice(2);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}/scripts/roomview.html?f=${encodeURIComponent('/Blender/AssetLibrary/' + f)}`);
    await page.waitForFunction(() => window.__room?.ready || window.__room?.error, null, { timeout: 300000 });
    const info = await page.evaluate(() => ({ info: window.__room.info, bbox: window.__room.bbox, mats: window.__room.materials, err: window.__room.error }));
    console.log('=== ' + f, JSON.stringify(info.info, null, 1));
    if (info.mats) for (const m of info.mats) console.log('   mat', m.name, m.type, 'side', m.side, 'op', m.opacity, m.maps.join(' | '));
    const { min, max, size, center } = info.bbox;
    const views = [
      ['outside', [center[0] + size[0] * 1.1, center[1] + size[1] * 0.7, center[2] + size[2] * 1.1], center],
      ['top', [center[0] + 0.01, max[1] + Math.max(size[0], size[2]) * 1.2, center[2] + 0.01], center],
      ['inside_a', [center[0], min[1] + size[1] * 0.55, center[2]], [center[0] + 0.01, min[1] + size[1] * 0.55, center[2] + 0.01]],
      ['inside_b', [min[0] + size[0] * 0.2, min[1] + size[1] * 0.5, min[2] + size[2] * 0.2], [max[0] - size[0] * 0.2, min[1] + size[1] * 0.5, max[2] - size[2] * 0.2]],
      ['side', [max[0] + size[0], center[1], center[2]], center],
    ];
    for (const [name, from, at] of views) {
      await page.evaluate(({ from, at }) => window.__room.setCam(from, at, 62), { from, at });
      await page.waitForTimeout(220);
      await page.screenshot({ path: `${OUT}/${f.replace('.glb', '')}_${name}.png` });
    }
    if (errs.length) console.log('  page errors', errs);
    await page.close();
  }
  await browser.close();
})();
