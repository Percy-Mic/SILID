// Measure the furniture footprint of the billiards room from above, so the
// collision box is the table that is there rather than a guess in world space.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.goto('http://127.0.0.1:5199/scripts/roomview.html?f=/assets/rooms/the_billiards_room.glb');
  await page.waitForFunction(() => window.__room?.ready, null, { timeout: 120000 });
  const grid = await page.evaluate(() => window.__room.probeGrid(0.25));
  // a billiards table's top is about 0.77 m; anything over 0.45 is furniture
  const hi = grid.filter((p) => p[2] > 0.45);
  const floor = grid.filter((p) => p[2] <= 0.1);
  const xs = hi.map((p) => p[0]), zs = hi.map((p) => p[1]);
  console.log('points', grid.length, 'raised', hi.length, 'floor', floor.length);
  console.log('raised x', Math.min(...xs), Math.max(...xs), 'z', Math.min(...zs), Math.max(...zs));
  // the table is the largest raised cluster near the middle; print a coarse map
  const step = 0.25;
  const nx = Math.round((Math.max(...grid.map((p) => p[0])) - Math.min(...grid.map((p) => p[0]))) / step) + 1;
  for (let z = Math.max(...grid.map((p) => p[1])); z >= Math.min(...grid.map((p) => p[1])); z -= step) {
    let row = '';
    for (let x = Math.min(...grid.map((p) => p[0])) + 0; x <= Math.max(...grid.map((p) => p[0])); x += step) {
      const p = grid.find((q) => Math.abs(q[0] - x) < 0.01 && Math.abs(q[1] - z) < 0.01);
      row += !p ? ' ' : p[2] > 0.7 ? '#' : p[2] > 0.45 ? '+' : p[2] > 0.2 ? '.' : '_';
    }
    console.log(row);
  }
  await browser.close();
})();
