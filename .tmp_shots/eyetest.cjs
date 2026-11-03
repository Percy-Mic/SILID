const { chromium } = require('playwright');
const [f, s, tag] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto(`http://127.0.0.1:5199/scripts/roomview.html?f=${encodeURIComponent('/Blender/AssetLibrary/' + f)}&s=${s}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__room?.ready, null, { timeout: 200000 });
  const bb = await p.evaluate(() => window.__room.bbox);
  console.log('scaled bbox', JSON.stringify(bb.size.map(v => +v.toFixed(2))), 'floorY', bb.min[1].toFixed(2));
  const { min, size, center } = bb;
  const views = [
    ['a', [center[0] + size[0]*0.26, min[1] + 1.7, center[2] + size[2]*0.26], [center[0] - size[0]*0.2, min[1] + 1.2, center[2] - size[2]*0.2]],
    ['b', [center[0] - size[0]*0.3, min[1] + 1.7, center[2] - size[2]*0.3], [center[0] + size[0]*0.3, min[1] + 1.3, center[2] + size[2]*0.3]],
    ['c', [center[0] + size[0]*0.35, min[1] + 1.7, center[2] - size[2]*0.36], [center[0] - size[0]*0.2, min[1] + 1.2, center[2] + size[2]*0.3]],
  ];
  for (const [n, from, at] of views) {
    await p.evaluate(({ from, at }) => window.__room.setCam(from, at, 68), { from, at });
    await p.screenshot({ path: `reports/roomscan/eye_${tag}_${n}.png`, timeout: 90000 });
  }
  await b.close();
})();
