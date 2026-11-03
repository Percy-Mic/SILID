// Look up and look at the entry wall inside each prepared room, outside the
// game, so the asset's own ceiling and doorway cut can be judged on their own.
const { chromium } = require('playwright');

const FILES = ['interrogation_room', 'the_great_drawing_room', 'the_billiards_room'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
  for (const f of FILES) {
    await page.goto(`http://127.0.0.1:5199/scripts/roomview.html?f=/assets/rooms/${f}.glb`);
    await page.waitForFunction(() => window.__room?.ready || window.__room?.error, null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ info: window.__room.info, bbox: window.__room.bbox, err: window.__room.error }));
    console.log(f, JSON.stringify(info));
    const box = info.bbox;
    const cx = (box.min[0] + box.max[0]) / 2;
    const cz = (box.min[2] + box.max[2]) / 2;
    // eye height in the middle of the room, looking up at the ceiling
    await page.evaluate(({ cx, cz, y, top }) => {
      window.__room.setCam([cx, y, cz], [cx + 0.01, top, cz + 0.01], 75);
    }, { cx, cz, y: box.min[1] + 1.6, top: box.max[1] });
    await page.screenshot({ path: `reports/rooms/${f}_ceiling.jpg`, type: 'jpeg', quality: 80 });
    // facing the entry wall (z = 0 side) from 2 m inside
    await page.evaluate(({ cx, z, y }) => {
      window.__room.setCam([cx, y, z], [cx, y, 0], 70);
    }, { cx, z: box.min[2] + 1.2, y: box.min[1] + 1.6 });
    await page.screenshot({ path: `reports/rooms/${f}_entry.jpg`, type: 'jpeg', quality: 80 });
  }
  await browser.close();
})();
