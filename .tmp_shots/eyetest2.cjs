const { chromium } = require('playwright');
const [f, s, r, tag] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 860, height: 560 } });
  await p.goto(`http://127.0.0.1:5199/scripts/roomview.html?f=${encodeURIComponent('/Blender/AssetLibrary/' + f)}&s=${s}&r=${r}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__room?.ready, null, { timeout: 200000 });
  const bb = await p.evaluate(() => window.__room.bbox);
  console.log('bbox', JSON.stringify(bb.size.map(v => +v.toFixed(2))), 'min', JSON.stringify(bb.min.map(v => +v.toFixed(2))));
  const { min, size, center } = bb;
  // stand near each corner looking across the room, all at human eye height
  const k = 0.34;
  const views = [
    ['sw', [center[0] - size[0]*k, min[1]+1.7, center[2] - size[2]*k], [center[0] + size[0]*k, min[1]+1.5, center[2] + size[2]*k]],
    ['ne', [center[0] + size[0]*k, min[1]+1.7, center[2] + size[2]*k], [center[0] - size[0]*k, min[1]+1.5, center[2] - size[2]*k]],
    ['nw', [center[0] - size[0]*k, min[1]+1.7, center[2] + size[2]*k], [center[0] + size[0]*k, min[1]+1.5, center[2] - size[2]*k]],
    ['se', [center[0] + size[0]*k, min[1]+1.7, center[2] - size[2]*k], [center[0] - size[0]*k, min[1]+1.5, center[2] + size[2]*k]],
  ];
  for (const [n, from, at] of views) {
    await p.evaluate(({ from, at }) => window.__room.setCam(from, at, 70), { from, at });
    await p.screenshot({ path: `reports/roomscan/fit_${tag}_${n}.png`, timeout: 90000 });
  }
  await b.close();
})();
