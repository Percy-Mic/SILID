// Head clearance on the grand stair, measured in the running game.
//
// For each storey the body is stood at the stair head, on the half landing and
// at the foot of the west flight, then a ray is cast straight up from eye
// height. The first surface hit is the ceiling that body would meet. A clear
// storey is 3.6-4.2 m; anything under ~0.2 m over the eye means the player's
// head is inside a slab or a beam.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  const out = await page.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    const LA = -4.41, LB = -2.87;
    const rows = [];
    const up = (x, z, foot) => {
      w.spawnAt(x, z, foot, 0, 0);
      const rc = new T.Raycaster(
        new T.Vector3(x, w.player.pos.y + 0.0, z), new T.Vector3(0, 1, 0), 0, 8);
      const hits = rc.intersectObjects(w.scene.children, true)
        .filter((h) => h.object.visible && h.object.isMesh && h.distance > 0.02);
      const h = hits[0];
      return {
        at: [x, z], foot: +w.player.footY.toFixed(2), eye: +w.player.pos.y.toFixed(2),
        hit: h ? h.object.name : null, gap: h ? +h.distance.toFixed(2) : null,
        hitY: h ? +h.point.y.toFixed(2) : null,
      };
    };
    for (const [id, y] of [['GF', 0], ['F2', 4.2], ['F3', 8.0]]) {
      rows.push({ where: id + ' stair head', ...up(LB, 9.55, y) });
      rows.push({ where: id + ' half landing', ...up(-4.30, 5.15, y + (id === 'GF' ? 2.1 : id === 'F2' ? 1.9 : 1.8)) });
      rows.push({ where: id + ' foot', ...up(LA, 9.0, y) });
    }
    // and the last tread of each flight, where the body steps off onto the floor
    for (const [id, y, rise] of [['GF', 0, 4.2], ['F2', 4.2, 3.8], ['F3', 8.0, 3.6]]) {
      rows.push({ where: id + ' top tread', ...up(LB, 9.35, y + rise - 0.01) });
    }
    return rows;
  });
  for (const r of out) console.log(JSON.stringify(r));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
