// Which placed pieces are not standing on the floor they claim to stand on?
//
// props.placed records, for every piece, the level, the room, the y it was
// placed at and whether it is solid. A solid piece is floor furniture: it must
// sit at its level's floor. A non-solid piece is wall-mounted by design, but it
// still has to be TOUCHING a wall, otherwise it is a cabinet hanging in the
// middle of the room — which is exactly what the kitchen screenshots show.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(800);

  const out = await page.evaluate(() => {
    const w = window.__silid;
    const placed = w.props.placed;
    const levels = {};
    for (const p of placed) if (!(p.level in levels)) levels[p.level] = p.y;
    const offFloor = placed.filter((p) => p.solid && Math.abs(p.y - levels[p.level]) > 0.02);
    // wall pieces: distance from the nearest wall face of their room
    const rooms = w.architecture.rooms || [];
    const byRoom = new Map(rooms.map((r) => [r.id, r]));
    const wallPieces = placed.filter((p) => !p.solid);
    const loose = [];
    for (const p of wallPieces) {
      const r = byRoom.get(p.room);
      if (!r) continue;
      const dx = Math.min(Math.abs(p.x - r.x0), Math.abs(p.x - r.x1));
      const dz = Math.min(Math.abs(p.z - r.z0), Math.abs(p.z - r.z1));
      if (Math.min(dx, dz) > 0.55) loose.push({ ...p, dx: +dx.toFixed(2), dz: +dz.toFixed(2) });
    }
    const perRoom = {};
    for (const p of placed) {
      const k = p.level + '/' + (p.room || '?');
      perRoom[k] = (perRoom[k] || 0) + 1;
    }
    return {
      total: placed.length,
      offFloor,
      looseMounts: loose,
      perRoom,
      rejected: w.props.rejected.slice(0, 80),
      missing: w.props.missing,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
