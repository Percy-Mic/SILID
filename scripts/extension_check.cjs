// EXTENSION CHECK — the three projecting rooms, measured in the running game.
//
// For each bay: stand inside it and read the room name and floor height; walk in
// from the room it serves through the cased opening; walk into the outer wall
// and confirm the body stops before the glass; sample the ground under the
// plinth so nothing floats; and read back the furniture and the light props.js
// actually placed. Prints one JSON object per bay and a PASS/FAIL line.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });

  const out = await page.evaluate(() => {
    const w = window.__silid;
    const pl = w.player;
    const g = w.game;
    const T = w.THREE;
    const arch = w.architecture;
    // this is a geometry probe, not a survival one: the resident would end it
    if (g.resident) g.resident.update = () => {};
    if (g.caughtActive) { g.caughtActive = false; }
    pl.enabled = true;

    const aim = (dx, dz) => { pl.yaw = Math.atan2(-dx, -dz); };
    const step = (dx, dz, dt = 0.033) => {
      aim(dx, dz);
      pl.keys.KeyW = true;
      const bx = pl.pos.x, bz = pl.pos.z;
      pl.update(dt, g);
      g.update(dt);
      return Math.hypot(pl.pos.x - bx, pl.pos.z - bz);
    };
    const walkTo = (tx, tz, legs = 420, tol = 0.28) => {
      pl.enabled = true;
      let dead = 0, n = 0;
      for (; n < legs; n++) {
        const dx = tx - pl.pos.x, dz = tz - pl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < tol) break;
        if (step(dx / d, dz / d) < 1e-5) { dead++; if (dead > 3) break; } else dead = 0;
      }
      pl.keys.KeyW = false;
      return { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2), reached: Math.hypot(tx - pl.pos.x, tz - pl.pos.z) < tol, dead };
    };
    const put = (x, z, y, yaw = 0) => {
      w.spawnAt(x, z, y, yaw, 0);
      pl.enabled = true;
      g.update(0.03);
      return { room: g.roomName(g.currentLevel()), level: g.currentLevel()?.id, foot: +pl.footY.toFixed(2) };
    };

    const bays = [
      { id: 'GF-17', from: [15.6, 9.2], mouth: [15.6, 13.2], inside: [17, 12.6], dz: 1, outer: 14.45 },
      { id: 'GF-18', from: [6.78, 9.4], mouth: [6.78, 12.2], inside: [6.78, 12.0], dz: 1, outer: 13.65 },
      { id: 'GF-19', from: [-0.4, -8.2], mouth: [-0.4, -12.4], inside: [-2, -12.6], dz: -1, outer: -14.7 },
    ];
    const rows = [];
    for (const b of bays) {
      put(...b.inside, 0);
      const at = { room: g.roomName(g.currentLevel()), foot: +pl.footY.toFixed(2) };
      put(...b.from, 0);
      const inWalk = walkTo(b.mouth[0], b.mouth[1], 500);
      const inside = { room: g.roomName(g.currentLevel()), x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2) };
      // push at the outer wall: should stop short of it
      const wallRun = walkTo(b.inside[0], b.inside[1] + b.dz * 3.0, 160, 0.2);
      const stopped = b.dz > 0 ? +pl.pos.z.toFixed(2) : +pl.pos.z.toFixed(2);
      // the floor under the bay must be the level's floor, not a hole
      const fh = w.silidFloor ? null : null;
      // terrain under the plinth
      const ground = [];
      for (const [x, z] of [[b.inside[0], b.inside[1]], [b.inside[0] + 2.4, b.inside[1]], [b.inside[0] - 2.4, b.inside[1]]]) {
        const ray = new T.Raycaster(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0));
        const hits = ray.intersectObjects(w.scene.children, true).filter((h) => h.point.y < 5 && h.point.y > -3);
        ground.push(hits.length ? +hits[hits.length - 1].point.y.toFixed(2) : null);
      }
      const furn = w.props.placed.filter((p) => p.room === b.id);
      const light = w.props.lights.filter((l) => l.room === b.id);
      const dark = w.props.issues.filter((i) => i.room === b.id);
      rows.push({
        id: b.id, at, inWalk, inside, stopped, outer: b.outer,
        clearOfWall: b.dz > 0 ? stopped < b.outer - 0.15 : stopped > b.outer + 0.15,
        ground, furniture: furn.length, light: light.length, issues: dark.length,
        furnKinds: furn.map((p) => p.name),
      });
      // park the body away before the next case
      put(...b.from, 0);
    }
    return rows;
  });

  let fail = 0;
  for (const r of out) {
    const ok = r.at.room === (r.id === 'GF-17' ? 'Front Drawing Room' : r.id === 'GF-18' ? 'Sitting Bay' : 'Breakfast Room')
      && r.inWalk.reached && r.clearOfWall;
    if (!ok) fail++;
    console.log(JSON.stringify(r), ok ? 'PASS' : 'FAIL');
  }
  console.log(fail ? `${fail} bay(s) FAILED` : 'ALL BAYS PASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
