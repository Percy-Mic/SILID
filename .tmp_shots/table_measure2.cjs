const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.goto('http://127.0.0.1:5199/scripts/roomview.html?f=/assets/rooms/the_billiards_room.glb');
  await page.waitForFunction(() => window.__room?.ready, null, { timeout: 120000 });
  const grid = await page.evaluate(() => window.__room.probeGrid(0.2));
  // the tabletop: a raised surface between 0.6 and 0.95 m, near the middle
  const top = grid.filter((p) => p[2] > 0.6 && p[2] < 0.95);
  const xs = top.map((p) => p[0]), zs = top.map((p) => p[1]);
  console.log('tabletop pts', top.length);
  console.log('x', Math.min(...xs).toFixed(2), Math.max(...xs).toFixed(2), 'z', Math.min(...zs).toFixed(2), Math.max(...zs).toFixed(2));
  // body of the table (its rails and frame, 0.5-1.1 m) in the middle third
  const body = grid.filter((p) => p[2] > 0.45 && p[0] > -2 && p[0] < 2 && p[1] > -6.5 && p[1] < -1.5);
  console.log('near-centre raised', body.length);
  await browser.close();
})();
