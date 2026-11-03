// temporary probe: what furniture exists, how big are the beds and wardrobes,
// and where is there clear wall space for a hideable wardrobe.
const { chromium } = require('playwright');
const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await page.evaluate(() => {
    const s = window.__silid;
    const f = s.furniture;
    const tpl = [];
    for (const t of f.templates.values()) {
      tpl.push({
        name: t.name, tris: t.tris,
        box: { min: t.box.min.toArray().map(v => +v.toFixed(2)), max: t.box.max.toArray().map(v => +v.toFixed(2)) },
      });
    }
    // colliders near each bedroom, to find wall runs
    const rooms = ['FF2-03', 'FF2-06', 'FF2-11', 'FF3-06', 'GF-04', 'FF4-07'];
    const info = [];
    for (const id of rooms) {
      const lvl = s.levels.find(l => l.rooms.some(r => r.id === id));
      const r = lvl.rooms.find(x => x.id === id);
      const near = s.props.colliders.filter(c =>
        c.x1 > r.x0 - 1 && c.x2 < r.x1 + 1 && c.z1 > r.z0 - 1 && c.z2 < r.z1 + 1);
      info.push({ id, level: lvl.id, rect: r, colliders: near.map(c => ({
        x: +((c.x1 + c.x2) / 2).toFixed(2), z: +((c.z1 + c.z2) / 2).toFixed(2),
        w: +(c.x2 - c.x1).toFixed(2), d: +(c.z2 - c.z1).toFixed(2), y0: c.y0, y1: c.y1,
      })) });
    }
    return { tpl, info, errors: f.errors, count: f.count };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
