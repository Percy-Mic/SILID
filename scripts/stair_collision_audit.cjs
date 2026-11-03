// Does the body stand ON the tread, or inside it?
//
// For every linear flight, sample along the run and compare two numbers at the
// same (x, z):
//   * what the collision query says the floor is (floorHeightAt), and
//   * where the StairTreads mesh actually is (a downward raycast).
// A capsule that is a riser below the board it is walking over does not fall
// through — the query holds it up — but the eye sits low and the legs are
// inside the step, which is what a stair that "feels wrong" feels like.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    w.scene.updateMatrixWorld(true);
    const treads = [];
    w.scene.traverse((o) => {
      if (o.isMesh && (o.name === 'StairTreads' || o.name === 'StairLandings' || o.name === 'Stair_Basement')) treads.push(o);
    });
    const rc = new T.Raycaster();
    const down = new T.Vector3(0, -1, 0);

    const surfaceAt = (x, z, from) => {
      rc.set(new T.Vector3(x, from, z), down);
      const hit = rc.intersectObjects(treads, false)[0];
      return hit ? hit.point.y : null;
    };

    const ramps = w.architecture.ramps.filter((r) => r.kind === 'linear');
    const stairs = [];
    for (const r of ramps) {
      // walk the flight bottom-to-top
      const xc = (r.x0 + r.x1) / 2;
      const yLo = Math.min(r.y0, r.y1), yHi = Math.max(r.y0, r.y1);
      let worst = 0, worstZ = null, samples = 0, misses = 0;
      const rows = [];
      const N = 48;
      for (let i = 0; i <= N; i++) {
        // Offset off the tread boundary: a sample placed exactly on the line
        // between two boards is a floating-point tie (the ray hits the lower
        // board, the index lands on the upper one) and reports a phantom full
        // riser. 0.37 of a step keeps every sample inside a board.
        const z = r.z0 + ((r.z1 - r.z0) * (i + 0.37)) / N;
        // cast from just above the highest point of this flight so the ray
        // always starts in air
        const top = surfaceAt(xc, z, yHi + 1.0);
        if (top === null) { misses++; continue; }
        // ask the query from a body standing on that board
        const q = w.floorAt(xc, z, top + 0.01);
        const d = q === null ? 999 : q - top;
        samples++;
        // How close this sample sits to a tread boundary. On the line itself the
        // ray hits the lower board while the index rounds to the upper one, so a
        // full riser shows up as a phantom. Anything within 1 cm of a boundary
        // is that tie, not a collision error.
        const local = ((z - r.z0) / (r.z1 - r.z0)) * (r.steps || 1);
        const edge = Math.abs(local - Math.round(local)) * Math.abs((r.z1 - r.z0) / (r.steps || 1));
        const tie = Math.max(0.012, (r.nose || 0) + 0.006);
        if (edge > tie && Math.abs(d) > Math.abs(worst)) { worst = d; worstZ = +z.toFixed(3); }
        if (i % 8 === 0) rows.push({ z: +z.toFixed(2), tread: +top.toFixed(3), query: q === null ? null : +q.toFixed(3), d: q === null ? null : +d.toFixed(3) });
      }
      stairs.push({
        flight: r.index, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
        y0: r.y0, y1: r.y1, steps: r.steps,
        riser: +((r.y1 - r.y0) / r.steps).toFixed(3),
        samples, misses,
        worstDelta: +worst.toFixed(3), worstZ,
        rows,
      });
    }
    // --- half landings: the platform each pair of flights turns on ----------
    const landings = [];
    for (const f of w.architecture.extraFloors) {
      if (f.kind === 'sector') continue;
      const rows = [];
      let worst = 0, worstAt = null;
      for (const fx of [0.12, 0.5, 0.88]) {
        for (const fz of [0.12, 0.5, 0.88]) {
          const x = f.x0 + (f.x1 - f.x0) * fx;
          const z = f.z0 + (f.z1 - f.z0) * fz;
          const top = surfaceAt(x, z, f.y + 0.8);
          if (top === null) { rows.push({ x: +x.toFixed(2), z: +z.toFixed(2), tread: null, query: f.y }); continue; }
          const q = w.floorAt(x, z, top + 0.01);
          const d = q === null ? 999 : +(q - top).toFixed(3);
          if (Math.abs(d) > Math.abs(worst)) { worst = d; worstAt = [+x.toFixed(2), +z.toFixed(2)]; }
          rows.push({ x: +x.toFixed(2), z: +z.toFixed(2), board: +top.toFixed(3), query: q === null ? null : +q.toFixed(3), d });
        }
      }
      landings.push({ y: f.y, x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, worst, worstAt, rows });
    }
    return { levels: w.levels.map((l) => ({ id: l.id, y: l.y })), stairs, landings };
  });

  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('reports/stair_check/collision_audit.json', JSON.stringify(out, null, 1));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
