const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  for (const f of ['interrogation_room', 'the_great_drawing_room', 'the_billiards_room']) {
    await page.goto(`http://127.0.0.1:5199/scripts/roomview.html?f=/assets/rooms/${f}.glb`);
    await page.waitForFunction(() => window.__room?.ready, null, { timeout: 120000 });
    const r = await page.evaluate(() => {
      const b = window.__room.bbox;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      return {
        centre: window.__room.rayUp(cx, cz, 1.6),
        quarter: [window.__room.rayUp(cx + 1, cz, 1.6), window.__room.rayUp(cx - 1, cz + 1, 1.6), window.__room.rayUp(cx, cz + 1.5, 1.6)],
        top: b.max[1],
      };
    });
    console.log(f, JSON.stringify(r));
  }
  await browser.close();
})();
