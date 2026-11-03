const { chromium } = require('playwright');
const [f, s, r, tag, hy] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 860, height: 560 } });
  await p.goto(`http://127.0.0.1:5199/scripts/roomview.html?f=${encodeURIComponent('/Blender/AssetLibrary/' + f)}&s=${s}&r=${r}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__room?.ready, null, { timeout: 200000 });
  const bb = await p.evaluate(() => window.__room.bbox);
  console.log('bbox', JSON.stringify(bb.size.map(v => +v.toFixed(2))));
  const c = bb.center, y = bb.min[1] + parseFloat(hy || '1.7');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    await p.evaluate(({ c, y, a }) => window.__room.setCam([c[0], y, c[2]], [c[0] + Math.cos(a) * 10, y - 0.2, c[2] + Math.sin(a) * 10], 72), { c, y, a });
    await p.screenshot({ path: `reports/roomscan/cen_${tag}_${i}.png`, timeout: 90000 });
  }
  await b.close();
})();
