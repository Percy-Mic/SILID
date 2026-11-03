// Render the prepared room GLBs from inside, at eye height, and from above.
//
// The point is not decoration: it is to see whether the frame the prep script
// promises is the frame the box actually has -- floor at 0, doorway at z=0 on
// the centre line, interior towards -z -- and whether the doorway cut leaves a
// clean opening rather than a hole in a wall of furniture.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.SILID_URL || 'http://127.0.0.1:5199';
const OUT = 'reports/rooms';
const ROOMS = (process.env.ROOMS || 'interrogation_room,the_great_drawing_room,the_billiards_room').split(',');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));

  for (const name of ROOMS) {
    try {
      await page.goto(`${BASE}/scripts/roomview.html?f=/assets/rooms/${name}.glb`);
    } catch (e) {
      console.log(name, 'goto failed', e.message);
      continue;
    }
    try {
      await page.waitForFunction(() => window.__room && window.__room.ready, null, { timeout: 240000 });
    } catch (e) {
      console.log(name, 'did not become ready');
      continue;
    }
    const info = await page.evaluate(() => window.__room.info);
    const bb = await page.evaluate(() => window.__room.bbox);
    console.log(name, JSON.stringify({ tris: info.tris, mats: info.materials, size: info.size, min: bb.min.map((v) => +v.toFixed(2)), max: bb.max.map((v) => +v.toFixed(2)) }));

    const cx = (bb.min[0] + bb.max[0]) / 2;
    const cz = (bb.min[2] + bb.max[2]) / 2;
    const eye = bb.min[1] + 1.65;
    // standing just inside the doorway looking in, and back at the doorway
    // The doorway is the z = 0 plane at the centre of x, so "inside" is -z.
    // Standing at the doorway looking in is the view that proves the frame.
    const depth = bb.max[2] - bb.min[2];
    const views = {
      door_in: [[cx, eye, -0.35], [cx, eye - 0.25, -depth]],
      from_mid: [[cx, eye, -depth * 0.55], [cx, eye - 0.2, 0]],
      corner: [[cx - (bb.max[0] - bb.min[0]) * 0.42, eye, -depth * 0.8], [cx, eye - 0.25, -depth * 0.2]],
      top: [[cx, eye + Math.max(4, depth * 1.1), 0.2], [cx, 0.4, -depth * 0.5]],
    };
    for (const [tag, [from, at]] of Object.entries(views)) {
      await page.evaluate(({ from, at, tag }) => {
        window.__room.setCam(from, at, tag === 'top' ? 70 : 66);
      }, { from, at, tag });
      await page.screenshot({ path: path.join(OUT, `${name}_${tag}.png`) });
    }
  }
  if (errs.length) console.log('errors:', errs.slice(0, 5));
  await browser.close();
})();
