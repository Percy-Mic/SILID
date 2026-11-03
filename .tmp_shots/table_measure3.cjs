const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.goto('http://127.0.0.1:5199/scripts/roomview.html?f=/assets/rooms/the_billiards_room.glb');
  await page.waitForFunction(() => window.__room?.ready, null, { timeout: 120000 });
  const grid = await page.evaluate(() => window.__room.probeGrid(0.2));
  const key = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`;
  const map = new Map(grid.map((p) => [key(p[0], p[1]), p]));
  const raised = grid.filter((p) => p[2] > 0.55 && p[2] < 1.0);
  const seen = new Set();
  const clusters = [];
  for (const p of raised) {
    const k = key(p[0], p[1]);
    if (seen.has(k)) continue;
    const stack = [p]; seen.add(k);
    const pts = [];
    while (stack.length) {
      const q = stack.pop(); pts.push(q);
      for (const [dx, dz] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) {
        const nk = key(q[0] + dx, q[1] + dz);
        const n = map.get(nk);
        if (n && !seen.has(nk) && n[2] > 0.55 && n[2] < 1.0) { seen.add(nk); stack.push(n); }
      }
    }
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]), ys = pts.map((q) => q[2]);
    clusters.push({ n: pts.length, x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], y: [Math.min(...ys), Math.max(...ys)] });
  }
  clusters.sort((a, b) => b.n - a.n);
  console.log(JSON.stringify(clusters.slice(0, 6), null, 0));
  await browser.close();
})();
