const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  console.log('goto');
  await p.goto('http://127.0.0.1:5199/scripts/roomview.html?f=' + encodeURIComponent('/Blender/AssetLibrary/the_great_drawing_room.glb'), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__room?.ready, null, { timeout: 120000 });
  console.log('ready');
  const bb = await p.evaluate(() => window.__room.bbox);
  const { min, max, size, center } = bb;
  console.log('bbox', JSON.stringify(size.map(v=>+v.toFixed(2))));
  const eye = min[1] + size[1] * 0.42;
  const r = Math.min(size[0], size[2]) * 0.3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const from = [center[0] + Math.cos(a) * r, eye, center[2] + Math.sin(a) * r];
    const at = [center[0] - Math.cos(a) * r, eye, center[2] - Math.sin(a) * r];
    await p.evaluate(({ from, at }) => window.__room.setCam(from, at, 68), { from, at });
    console.log('shot', i);
    await p.screenshot({ path: `reports/roomscan/orbit/t_${i}.png`, timeout: 60000 });
  }
  await b.close();
  console.log('done');
})();
