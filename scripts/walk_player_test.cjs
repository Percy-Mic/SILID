// PLAYER WALK TEST — the routes the player actually has to walk.
//
// The stair traversal test starts at the foot of the flight; this one starts
// in the foyer and walks to the foot with the real controller, because that
// approach was sealed by furniture until this pass. It also walks through the
// three new ground-floor doors and the basement generator door.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 200)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const pl = s.player;
    const g = s.game;
    pl.enabled = true;
    g.state.ended = false;
    g.caughtActive = true; // keep the Resident out of this walk
    g.resident.group.visible = false;

    const aim = (x, z) => { pl.yaw = Math.atan2(-(x - pl.pos.x), -(z - pl.pos.z)); };
    const walkTo = (x, z, { tol = 0.55, frames = 1400, y = null } = {}) => {
      let stuck = 0, side = 0, sideT = 0;
      for (let i = 0; i < frames; i++) {
        aim(x, z);
        pl.keys.KeyW = true;
        if (side) pl.keys[side > 0 ? 'KeyD' : 'KeyA'] = true;
        const bx = pl.pos.x, bz = pl.pos.z;
        pl.update(0.033, g);
        pl.keys.KeyD = false; pl.keys.KeyA = false;
        const d = Math.hypot(x - pl.pos.x, z - pl.pos.z);
        if (d < tol) { pl.keys.KeyW = false; return { ok: true, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2), frames: i }; }
        if (Math.hypot(pl.pos.x - bx, pl.pos.z - bz) < 0.004) stuck++;
        else stuck = 0;
        if (stuck > 22) {
          sideT++;
          side = sideT % 2 ? 1 : -1;
          stuck = 0;
          if (sideT > 12) break;
        } else if (sideT) { side = 0; }
      }
      pl.keys.KeyW = false;
      return { ok: false, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), foot: +pl.footY.toFixed(2), stuck, sideT };
    };

    const res = {};
    pl.teleport(0, 6.5, 0);
    // The approach the foyer actually offers: down the west side of the tower,
    // then in at the first tread. This was sealed by a console before.
    res.foyerToWest = walkTo(-4.25, 4.9);
    res.westToFoot = walkTo(-4.0, 7.32, { tol: 0.5, frames: 700 });
    // climb the helix, steering ahead like traverse_mansion.cjs
    const cx = -1.5, cz = 7.5;
    let climbed = false;
    for (let i = 0; i < 2400; i++) {
      const dx = pl.pos.x - cx, dz = pl.pos.z - cz;
      const a = Math.atan2(dz, dx), r = Math.hypot(dx, dz);
      const tr = Math.max(1.0, Math.min(1.95, r * 0.6 + 1.55 * 0.4));
      const px = cx + Math.cos(a + 0.22) * tr, pz = cz + Math.sin(a + 0.22) * tr;
      pl.yaw = Math.atan2(-(px - pl.pos.x), -(pz - pl.pos.z));
      pl.keys.KeyW = true;
      pl.update(0.033, g);
      if (pl.footY >= 4.18) { climbed = true; break; }
    }
    pl.keys.KeyW = false;
    res.climbFromFoyer = { climbed, foot: +pl.footY.toFixed(2), x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2) };
    // step off west onto the landing
    const off = walkTo(-4.9, 8.6, { tol: 0.7, frames: 500 });
    res.stepOff = { ok: off.ok, foot: off.foot, x: off.x, z: off.z };

    // the three new ground-floor doors, walked through in the real body. A
    // player opens a closed door with E first; these are opened here so the
    // test measures the doorway geometry, not the interaction key.
    const openLevel = (level) => {
      for (const d of s.architecture.doors) {
        if (d.level !== level || !d.collider || d.open) continue;
        d.open = true;
        d.target = d.axis === 'x' ? 1.35 : -1.35;
        d.collider.disabled = true;
      }
    };
    const doors = [
      ['family->guest3', 'GF', 6, -9, 10.5, -9],
      ['guest3->wine', 'GF', 12, -9, 16, -9],
      ['sitting->guest4', 'GF', 6, 8, 11, 8],
      ['passage->generator', 'B1', 3, 3.3, 3, -1.2],
    ];
    res.doors = {};
    for (const [name, level, x0, z0, x1, z1] of doors) {
      const ly = level === 'B1' ? -3.4 : 0;
      openLevel(level);
      pl.teleport(x0, z0, ly);
      pl.enabled = true;
      const r = walkTo(x1, z1, { tol: 0.55, frames: 900 });
      const room = g.roomName(g.currentLevel());
      res.doors[name] = { ...r, room, blocked: pl.blocked(pl.pos.x, pl.pos.z) };
    }
    return res;
  });

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
