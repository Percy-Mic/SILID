// Floor openings + head clearance on the grand stair, measured in the running
// game.
//
// Two independent measurements:
//
//  1. THE OPENING. A grid of downward rays over the stairwell is cast at each
//     of F2, F3 and F4. A ray that first hits that storey's own Floor_<id>
//     mesh within 0.25 m of the level is solid floor; anything else is void.
//     The void rectangle is then measured edge by edge and compared with the
//     plan's STAIR.hole (x -5.00..-2.10, z 4.25..9.20). This checks the mesh,
//     not the query, so a slab that silently still covers the stair shows up.
//
//  2. HEAD CLEARANCE. The real Player is walked up the U (west lane -> half
//     landing -> east lane -> off onto the floor) and an upward ray is cast
//     from eye height every few frames for the whole climb. The minimum gap
//     over the eye, and where it happens, is the number that matters; four
//     sample points cannot catch a beam that crosses one tread.
//
// Nothing in the game is modified. Exit code 0 = both checks passed.
const { chromium } = require('playwright');

const LA = -4.41, LB = -2.87;
const LEVELS = [['F2', 4.2], ['F3', 8.0], ['F4', 11.6]];
const HOLE = { x0: -5.0, x1: -2.1, z0: 4.25, z1: 9.2 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });

  // The opening test only needs the one floor mesh per level, so each ray is
  // tested against that mesh alone. Raycasting a 1.3 M-triangle scene ~6 000
  // times in one evaluate killed the headless target.
  const openings = await page.evaluate(({ LEVELS, HOLE }) => {
    const w = window.__silid, T = w.THREE;
    const rc = new T.Raycaster();
    const res = [];
    const STEP = 0.05;
    for (const [id, y] of LEVELS) {
      const mesh = w.scene.getObjectByName('Floor_' + id);
      if (!mesh) { res.push({ level: id, missing: true, ok: false }); continue; }
      const solid = (x, z) => {
        rc.set(new T.Vector3(x, y + 0.06, z), new T.Vector3(0, -1, 0));
        rc.far = 1.2;
        return rc.intersectObject(mesh, false).some((k) => Math.abs(k.point.y - y) < 0.3);
      };
      let vx0 = 9, vx1 = -9, vz0 = 99, vz1 = -99;
      let solidInside = 0, voidOutside = 0;
      for (let x = -5.35; x <= -1.75; x += STEP) {
        for (let z = 3.95; z <= 9.55; z += STEP) {
          const s = solid(x, z);
          // classify with a 30 mm margin: a sample sitting exactly on the hole
          // edge is ambiguous (a ray on the boundary may miss the cap), and a
          // ray that clips the edge is not a slab across the stair.
          const inHole = x > HOLE.x0 + 0.03 && x < HOLE.x1 - 0.03
            && z > HOLE.z0 + 0.03 && z < HOLE.z1 - 0.03;
          const outsideHole = x < HOLE.x0 - 0.03 || x > HOLE.x1 + 0.03
            || z < HOLE.z0 - 0.03 || z > HOLE.z1 + 0.03;
          if (inHole && s) solidInside++;
          if (outsideHole && !s) voidOutside++;
          if (!s) {
            vx0 = Math.min(vx0, x); vx1 = Math.max(vx1, x);
            vz0 = Math.min(vz0, z); vz1 = Math.max(vz1, z);
          }
        }
      }
      const edgeErr = [
        Math.abs(vx0 - HOLE.x0), Math.abs(vx1 - HOLE.x1),
        Math.abs(vz0 - HOLE.z0), Math.abs(vz1 - HOLE.z1),
      ];
      res.push({
        level: id, y, missing: false,
        voidRect: [+vx0.toFixed(2), +vx1.toFixed(2), +vz0.toFixed(2), +vz1.toFixed(2)],
        planRect: [HOLE.x0, HOLE.x1, HOLE.z0, HOLE.z1],
        edgeErrMax: +Math.max(...edgeErr).toFixed(3),
        slabsAcrossStair: solidInside,
        strayHoles: voidOutside,
        ok: Math.max(...edgeErr) <= 0.06 && solidInside === 0 && voidOutside === 0,
      });
    }
    return res;
  }, { LEVELS, HOLE });

  // Head clearance along the full climb, and the step-off onto each floor.
  const motion = await page.evaluate(({ LEVELS, LA, LB }) => {
    const w = window.__silid, T = w.THREE;
    const rc = new T.Raycaster();
    const pl = w.player, g = w.game;
    if (g.resident) g.resident.update = () => {};
    if (g.caughtActive) { g.caughtActive = false; pl.enabled = true; }
    pl.enabled = true;

    const upGap = () => {
      rc.set(pl.pos.clone().add(new T.Vector3(0, 0.02, 0)), new T.Vector3(0, 1, 0));
      rc.far = 6;
      const hits = rc.intersectObjects(w.scene.children, true)
        .filter((k) => k.object.visible && k.object.isMesh && k.distance > 0.05);
      return hits.length ? +hits[0].distance.toFixed(2) : null;
    };

    const aim = (dx, dz) => { pl.yaw = Math.atan2(-dx, -dz); };
    const climb = (y, pts) => {
      w.spawnAt(LA, 10.1, y, 0, 0);
      pl.footY = y;
      let min = { gap: 99 };
      let frames = 0;
      for (const [wx, wz] of pts) {
        let guard = 0;
        while (guard++ < 900) {
          const dx = wx - pl.pos.x, dz = wz - pl.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.18) break;
          aim(dx / d, dz / d);
          pl.keys.KeyW = true;
          pl.update(0.033, g); g.update(0.033);
          frames++;
          if (frames % 6 === 0) {
            const gap = upGap();
            if (gap !== null && gap < min.gap) {
              min = {
                gap, x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2),
                foot: +pl.footY.toFixed(2), eye: +pl.pos.y.toFixed(2),
              };
            }
          }
        }
      }
      pl.keys.KeyW = false;
      return { ...min, reachedFoot: +pl.footY.toFixed(2), frames };
    };

    const headroom = [];
    for (const [id, y, rise] of [['GF', 0, 4.2], ['F2', 4.2, 3.8], ['F3', 8.0, 3.6]]) {
      headroom.push({
        storey: id,
        // The half landing runs z 4.25..6.10, so the turn is taken at z 5.5.
        // Steering at the landing's edge (z 6.2) leaves the body on the top
        // tread with no floor to its east, which is a probe error, not a stair.
        climb: climb(y, [[LA, 9.6], [LA, 5.5], [LB, 5.5], [LB, 9.6], [LB, 10.4]]),
        want: +(y + rise).toFixed(2),
      });
    }
    // and the step-off itself: stand 1.2 m onto the floor at each arrival
    const stepOff = [];
    for (const [id, y] of [['F2', 4.2], ['F3', 8.0], ['F4', 11.6]]) {
      w.spawnAt(LB, 10.4, y, 0, 0);
      const gap = upGap();
      stepOff.push({ level: id, foot: +pl.footY.toFixed(2), gap, insideSlab: pl.footY > y + 0.2 });
    }

    return { headroom, stepOff };
  }, { LEVELS, LA, LB });

  const out = { openings, ...motion };

  // --- report -------------------------------------------------------------
  console.log('FLOOR OPENINGS');
  for (const o of out.openings) {
    console.log(
      `  ${o.level}: void x ${o.voidRect[0]}..${o.voidRect[1]}  z ${o.voidRect[2]}..${o.voidRect[3]}` +
      `  (plan x ${o.planRect[0]}..${o.planRect[1]}  z ${o.planRect[2]}..${o.planRect[3]})` +
      `  edgeErr ${o.edgeErrMax}  slabsAcrossStair ${o.slabsAcrossStair}` +
      `  strayHoles ${o.strayHoles}  ${o.ok ? 'OK' : 'FAIL'}`);
  }
  console.log('HEAD CLEARANCE (upward ray from eye height, whole climb)');
  for (const h of out.headroom) {
    const c = h.climb;
    console.log(
      `  ${h.storey}: min ${c.gap} m over eye at x ${c.x} z ${c.z}` +
      ` foot ${c.foot} (climbed to ${c.reachedFoot}, want ${h.want})` +
      `  ${c.gap >= 0.35 && Math.abs(c.reachedFoot - h.want) < 0.06 ? 'OK' : 'FAIL'}`);
  }
  console.log('STEP-OFF');
  for (const s of out.stepOff) {
    console.log(`  ${s.level}: foot ${s.foot}, gap ${s.gap} m, insideSlab ${s.insideSlab}` +
      `  ${!s.insideSlab && s.gap >= 0.35 ? 'OK' : 'FAIL'}`);
  }
  const ok = out.openings.every((o) => o.ok)
    && out.headroom.every((h) => h.climb.gap >= 0.35 && Math.abs(h.climb.reachedFoot - h.want) < 0.06)
    && out.stepOff.every((s) => !s.insideSlab && s.gap >= 0.35);
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
