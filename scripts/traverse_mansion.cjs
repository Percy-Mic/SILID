// Real-controller traversal test for the U-shaped grand stair.
//
// This drives the actual Player class and the actual architecture queries in
// the running Vite game. It does not teleport between floors: it puts the
// player on the floor at the foot of a flight and walks, steering at waypoints
// the way a person would — up the first lane, across the half landing, back
// down the second lane, and off onto the floor above. If a flight is covered by
// a slab, walled off or too steep, this reports the exact point where the body
// stopped and the height it stood at.
//
// The stair is a U, not a helix: lane A runs north (z = 9.2 -> 6.1) against the
// west side of the well, lane B runs back south (6.1 -> 9.2) on the east side,
// with the half landing across the north end between them. The previous version
// of this test steered around a circle at (-1.5, 7.5) from the old spiral stair
// and reported "stuck" against geometry that had already been replaced.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const result = await page.evaluate(() => {
    const s = window.__silid;
    const pl = s.player;
    const g = s.game;
    // This is a stair-navigation probe. The resident can catch the player
    // between flights, which disables the controller for 2.2 s and teleports
    // the body to the foyer; that is correct game behaviour and a useless
    // measurement of whether a staircase is walkable. Stub the AI for the probe
    // only — no game code is changed by this test.
    if (g.resident) g.resident.update = () => {};
    if (g.caughtActive) { g.caughtActive = false; pl.enabled = true; }
    pl.enabled = true;

    // Centres of the two flights, read from the plan: west lane starts on the
    // foyer wall at x = -4.97 (1.12 m wide), east lane at -3.43.
    const LANE_A = -4.41;      // centre of the west lane
    const LANE_B = -2.87;      // centre of the east lane
    const FOOT_Z = 9.2;        // bottom of both flights
    const TOP_Z = 6.1;         // top of both flights, at the half landing

    const aim = (dx, dz) => { pl.yaw = Math.atan2(-dx, -dz); };

    const stepOnce = (dx, dz, dt = 0.033) => {
      aim(dx, dz);
      pl.keys.KeyW = true;
      const bx = pl.pos.x, bz = pl.pos.z;
      pl.update(dt, g);
      g.update(dt);
      return Math.hypot(pl.pos.x - bx, pl.pos.z - bz);
    };

    // Walk through a list of waypoints. A waypoint is reached when the body is
    // within `tol` of it; three dead frames in a row is a genuine stall.
    const walkPath = (pts, { tol = 0.34, perLeg = 900, startFoot = 0 } = {}) => {
      let stuck = null, dead = 0, steps = 0;
      for (const [wx, wz] of pts) {
        let guard = 0;
        while (guard++ < perLeg) {
          const dx = wx - pl.pos.x, dz = wz - pl.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < tol) break;
          const moved = stepOnce(dx / d, dz / d);
          steps++;
          if (moved < 1e-5) { dead++; if (dead > 2) break; } else dead = 0;
        }
        if (dead > 2) {
          stuck = { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2) };
          break;
        }
      }
      pl.keys.KeyW = false;
      return { stuck, steps };
    };

    const report = (extra = {}) => ({
      x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2),
      level: g.currentLevel()?.id || null, room: g.roomName(g.currentLevel()),
      ...extra,
    });

    // up: foot of lane A -> landing -> lane B -> off onto the floor above
    const up = ({ y, target }) => {
      s.spawnAt(LANE_A, 10.1, y, 0, 0);
      pl.footY = y;
      const r = walkPath([[LANE_A, FOOT_Z + 0.4], [LANE_A, TOP_Z - 0.5],
        [LANE_B, TOP_Z - 0.5], [LANE_B, FOOT_Z + 0.3], [LANE_B, 10.4]]);
      return report({ reached: pl.footY >= target - 0.06, stuck: r.stuck, steps: r.steps });
    };

    // down: floor above -> lane B -> landing -> lane A -> foyer floor
    const down = ({ y, target }) => {
      s.spawnAt(LANE_B, 10.1, y, 0, 0);
      pl.footY = y;
      const r = walkPath([[LANE_B, FOOT_Z + 0.3], [LANE_B, TOP_Z - 0.5],
        [LANE_A, TOP_Z - 0.5], [LANE_A, FOOT_Z + 0.3], [LANE_A, 10.4]]);
      return report({ reached: pl.footY <= target + 0.06, stuck: r.stuck, steps: r.steps });
    };

    // straight walk from a start point along a heading (for the basement flight)
    const walk = ({ x, z, y, dx, dz, steps = 600, dt = 0.033 }) => {
      s.spawnAt(x, z, y, 0, 0);
      pl.footY = y;
      let stuckAt = null;
      for (let i = 0; i < steps; i++) {
        if (stepOnce(dx, dz, dt) < 1e-5) {
          stuckAt = { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2) };
          break;
        }
      }
      pl.keys.KeyW = false;
      return report({ stuckAt });
    };

    const out = {};
    out.gfToF2 = up({ y: 0, target: 4.2 });
    out.f2ToF3 = up({ y: 4.2, target: 8.0 });
    out.f3ToF4 = up({ y: 8.0, target: 11.6 });
    out.f4ToF3 = down({ y: 11.6, target: 8.0 });
    out.f3ToF2 = down({ y: 8.0, target: 4.2 });
    out.f2ToGF = down({ y: 4.2, target: 0 });

    // basement service flight, straight and separate from the grand stair
    out.gfToB1 = walk({ x: -15.7, z: -4.6, y: 0, dx: 0, dz: -1 });
    out.b1ToGF = walk({ x: -15.7, z: -10.4, y: -3.4, dx: 0, dz: 1 });

    // Crossing the half landing: it is a turning platform, not a corridor, so
    // the test is that its surface carries a body from one flight to the other
    // at a constant height � the two flights land on it 3.2 m apart.
    s.spawnAt(LANE_A, 5.2, 6.1, 0, 0);
    pl.footY = 6.1;
    // tol is tighter than the generic waypoint tolerance: at 0.34 the walk
    // "reached" the east lane while still 0.32 m short of its centre, which
    // reported a failure for a landing that had been crossed correctly.
    const land = walkPath([[LANE_B, 5.2]], { tol: 0.10 });
    out.landingF2 = report({
      stuck: land.stuck, steps: land.steps,
      reached: pl.footY > 5.9 && pl.pos.x > LANE_B - 0.3,
    });
    return out;
  });

  console.log(JSON.stringify(result, null, 1));
  const ok = ['gfToF2', 'f2ToF3', 'f3ToF4', 'f4ToF3', 'f3ToF2', 'f2ToGF'].every((k) => result[k].reached);
  const b1ok = result.gfToB1.foot < -3.3 && result.b1ToGF.foot > -0.1;
  console.log('ALL FLOORS REACHED:', ok, ' BASEMENT BOTH WAYS:', b1ok);
  await browser.close();
  if (!ok || !b1ok) process.exitCode = 2;
})().catch((e) => { console.error(e); process.exit(1); });
