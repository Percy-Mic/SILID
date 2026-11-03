const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.goto('http://127.0.0.1:5199/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });
  const r = await page.evaluate(() => {
    const w = window.__silid;
    const rear = w.architecture.windows.filter((x) => x.axis === 'x' && Math.abs(x.c + 11) < 0.05)
      .map((x) => ({ lvl: x.level, a: +x.a.toFixed(2), b: +x.b.toFixed(2), floor: x.floorY, sill: x.sill, head: x.head }))
      .sort((p, q) => p.a - q.a);
    const d = w.architecture.doors.filter((x) => Math.abs((x.closedSeg?.z1 ?? 0) + 11) < 0.2)
      .map((x) => ({ at: x.at, w: x.w, y: x.y, axis: x.axis }));
    return { rear, d, floors: w.levels.map((l) => [l.id, l.y, l.h]) };
  });
  console.log(JSON.stringify(r, null, 0));
  await browser.close();
})();
