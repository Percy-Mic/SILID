// Stair audit. Measures what the staircase actually is and what the player can
// actually do on it: every ramp's riser/going, the headroom above each tread,
// and a real climb driven through player.update() along the flight's tangent.
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

  const report = await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.updateMatrixWorld(true);
    const pl = w.player, g = w.game;
    const out = { ramps: [], levels: [], climb: [], holes: w.architecture.holes };

    out.levels = w.levels.map((l) => ({ id: l.id, y: l.y, h: l.h, top: +(l.y + l.h).toFixed(2) }));

    for (const r of w.architecture.ramps) {
      if (r.kind === 'linear') {
        const n = r.steps || 1;
        out.ramps.push({
          kind: 'linear', x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
          y0: r.y0, y1: r.y1, steps: n,
          riser: +((r.y1 - r.y0) / n).toFixed(4),
          going: +((r.z1 - r.z0) / n).toFixed(4),
          width: +(r.x1 - r.x0).toFixed(2),
        });
      } else {
        const n = r.steps || 1;
        const span = r.a1 - r.a0;
        const rmid = (r.r0 + r.r1) / 2;
        out.ramps.push({
          kind: 'helix', cx: r.cx, cz: r.cz, r0: r.r0, r1: r.r1,
          turns: +(span / (Math.PI * 2)).toFixed(3),
          y0: r.y0, y1: r.y1, steps: n,
          riser: +((r.y1 - r.y0) / n).toFixed(4),
          going: +((span / n) * rmid).toFixed(4),
          width: +(r.r1 - r.r0).toFixed(2),
        });
      }
    }

    // --- climb: walk each flight the way a player would ---------------------
    const step = (n, yawFn) => {
      for (let i = 0; i < n; i++) {
        pl.keys.KeyW = true;
        if (yawFn) pl.yaw = yawFn();
        pl.update(0.05, g);
        g.update(0.05);
        pl.keys.KeyW = false;
      }
    };

    for (const r of w.architecture.ramps) {
      if (r.kind !== 'linear') continue;      // the spiral is measured below
      // stand at the foot, one step outside, and walk up the run
      pl.teleport((r.x0 + r.x1) / 2, r.z0 - 0.45, null);
      pl.yaw = Math.PI;                        // forward = +z
      pl.syncCamera(); g.update(0.05);
      const startFoot = +pl.footY.toFixed(2);
      step(120, null);
      out.climb.push({
        run: 'linear', z0: r.z0, z1: r.z1, y1: r.y1,
        startFoot, endFoot: +pl.footY.toFixed(2), endZ: +pl.pos.z.toFixed(2),
        ok: Math.abs(pl.footY - r.y1) < 0.3,
      });
    }

    const h = w.architecture.ramps.find((r) => r.kind !== 'linear');
    if (h) {
      // start on the first tread, mid width, and follow the helix tangent
      const a0 = h.a0 + 0.06;
      const rm = (h.r0 + h.r1) / 2;
      pl.teleport(h.cx + Math.cos(a0) * rm, h.cz + Math.sin(a0) * rm, null);
      pl.syncCamera(); g.update(0.05);
      const trace = [];
      const yawFn = () => {
        const a = Math.atan2(pl.pos.z - h.cz, pl.pos.x - h.cx);
        return Math.PI - (a + 0.12);           // aim slightly ahead on the arc
      };
      for (let i = 0; i < 8; i++) {
        const before = +pl.footY.toFixed(2);
        step(20, yawFn);
        trace.push({ from: before, to: +pl.footY.toFixed(2), z: +pl.pos.z.toFixed(2) });
      }
      out.climb.push({ run: 'helix', startFoot: trace[0]?.from, trace });
    }

    // --- headroom: cast down from above each tread to the first slab --------
    const ray = new T.Raycaster(new T.Vector3(0, 0, 0), new T.Vector3(0, -1, 0));
    const slabs = [];
    w.scene.traverse((o) => {
      if (/^(Floor_|Soffit_|Ceiling_)/.test(o.name) && o.isMesh) slabs.push(o);
    });
    const head = [];
    if (h) {
      for (const k of [0.2, 0.5, 0.8]) {
        const a = h.a0 + (h.a1 - h.a0) * k;
        const rm = (h.r0 + h.r1) / 2;
        const x = h.cx + Math.cos(a) * rm, z = h.cz + Math.sin(a) * rm;
        const yTop = h.y0 + (h.y1 - h.y0) * k;
        ray.set(new T.Vector3(x, yTop + 4.5, z), new T.Vector3(0, -1, 0));
        ray.far = 6;
        const hit = ray.intersectObjects(slabs, false)[0];
        head.push({
          at: k, treadY: +yTop.toFixed(2),
          slabY: hit ? +(yTop + 4.5 - hit.distance).toFixed(2) : null,
          clear: hit ? +((yTop + 4.5 - hit.distance) - yTop).toFixed(2) : null,
        });
      }
    }
    out.headroom = head;
    return out;
  });

  fs.mkdirSync('reports/stair', { recursive: true });
  fs.writeFileSync('reports/stair/audit.json', JSON.stringify({ ...report, errs }, null, 2));
  console.log(JSON.stringify({
    levels: report.levels,
    ramps: report.ramps,
    climb: report.climb,
    headroom: report.headroom,
    errs,
  }, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
