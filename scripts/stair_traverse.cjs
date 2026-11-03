// Four-storey stair traversal. The stair is straight flights, so the walk is
// scripted the way a player does it: face the flight, hold W, turn at the half
// landing, climb the second flight, arrive on the floor. Then the same again for
// the next two storeys, and all the way back down from the fourth floor.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 640 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(600);

  const res = await p.evaluate(() => {
    const w = window.__silid, S = w.architecture.STAIR || null;
    const pl = w.player, g = w.game;
    const T = w.THREE;
    const out = { stages: [], errs: [] };
    const axMid = (-4.85 + -3.73) / 2, bxMid = (-3.43 + -2.31) / 2;
    const zs = 9.20, zn = 6.10;

    const stepOnce = () => { pl.keys.KeyW = true; pl.update(0.05, g); g.update(0.05); pl.keys.KeyW = false; };

    // Walk toward a world point by steering the yaw at it each frame.
    const walkTo = (x, z, maxSteps = 400, tol = 0.22) => {
      for (let i = 0; i < maxSteps; i++) {
        const dx = x - pl.pos.x, dz = z - pl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < tol) return { ok: true, steps: i, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2) };
        // forward = (-sin yaw, -cos yaw)
        pl.yaw = Math.atan2(-dx, -dz);
        stepOnce();
      }
      return { ok: false, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2) };
    };

    const levelAt = () => g.roomName(g.currentLevel());
    const record = (name, expected, r) => out.stages.push({
      name, expectFoot: expected, gotFoot: r.foot, x: r.x, z: r.z,
      room: levelAt(), ok: r.ok && Math.abs(r.foot - expected) < 0.28,
    });

    pl.teleport(axMid, zs + 1.15, null);
    pl.syncCamera(); g.update(0.05);
    record('start GF', 0, { ok: true, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2) });

    let base = 0;
    for (let i = 0; i < 3; i++) {
      const rise = w.levels.find((l) => l.id === ['F2', 'F3', 'F4'][i]).y - base;
      const nA = 12, nB = 12;              // only used for the expected mid here
      // up lane A to the half landing
      record(`L${i + 1} flight A`, base + rise * 0.5, walkTo(axMid, zn - 0.55));
      // across the landing to lane B
      record(`L${i + 1} landing`, base + rise * 0.5, walkTo(bxMid, zn - 0.55));
      // down the well side of the landing, then up lane B to the floor
      record(`L${i + 1} flight B`, base + rise, walkTo(bxMid, zs + 0.85));
      base += rise;
    }

    // ...and back down
    for (let i = 2; i >= 0; i--) {
      const rise = w.levels.find((l) => l.id === ['F2', 'F3', 'F4'][i]).y - (i === 0 ? 0 : w.levels.find((l) => l.id === ['F2', 'F3'][i - 1]).y);
      const top = base;
      record(`D${i + 1} from floor`, top - rise * 0.5, walkTo(bxMid, zn + 0.35));
      record(`D${i + 1} landing`, top - rise * 0.5, walkTo(axMid, zn + 0.35));
      record(`D${i + 1} flight A down`, top - rise, walkTo(axMid, zs + 0.9));
      base -= rise;
    }

    out.final = { foot: +pl.footY.toFixed(2), x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), room: levelAt() };
    out.ramps = w.architecture.ramps.map((r) => ({ kind: r.kind, y0: r.y0, y1: r.y1, steps: r.steps }));
    out.extraFloors = w.architecture.extraFloors.map((f) => ({ y: f.y, z0: f.z0, z1: f.z1 }));
    out.holes = w.architecture.holes.filter((h) => h.kind === 'rect').map((h) => [h.x0, h.x1, h.z0, h.z1]);
    return out;
  });

  fs.mkdirSync('reports/stair', { recursive: true });
  fs.writeFileSync('reports/stair/traverse.json', JSON.stringify({ ...res, errs }, null, 2));
  console.log(JSON.stringify(res, null, 2));
  console.log('PAGE ERRORS', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
