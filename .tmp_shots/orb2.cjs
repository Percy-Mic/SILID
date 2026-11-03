const { chromium } = require('playwright');
const fs = require('fs');
const f = process.argv[2], tag = process.argv[3] || f.replace('.glb',''), n = +(process.argv[4] || 8);
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://127.0.0.1:5199/scripts/roomview.html?f=' + encodeURIComponent('/Blender/AssetLibrary/' + f), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__room?.ready || window.__room?.error, null, { timeout: 200000 });
  const bb = await p.evaluate(() => window.__room.bbox);
  if (!bb) { console.log('no bbox'); await b.close(); return; }
  const { min, size, center } = bb;
  fs.mkdirSync('reports/roomscan/orbit', { recursive: true });
  const eye = min[1] + size[1] * 0.42;
  const r = Math.min(size[0], size[2]) * 0.3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const from = [center[0] + Math.cos(a) * r, eye, center[2] + Math.sin(a) * r];
    const at = [center[0] - Math.cos(a) * r, eye, center[2] - Math.sin(a) * r];
    await p.evaluate(({ from, at }) => window.__room.setCam(from, at, 68), { from, at });
    await p.screenshot({ path: `reports/roomscan/orbit/${tag}_${i}.png`, timeout: 90000 });
    console.log('shot', i, `${Math.round(a * 180 / Math.PI)}deg`);
  }
  await b.close();
})();
