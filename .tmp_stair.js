function buildStairs(scene) {
  const S = STAIR;
  const ax0 = S.ax, ax1 = S.ax + S.aw;
  const bx0 = S.bx, bx1 = S.bx + S.bw;
  const zn = S.zn, zs = S.zs;

  // Dark, waxed hardwood treads on near-black strings. The stone winder that
  // was here read as concrete; a mansion of this age and pretension climbed
  // narra-coloured boards.
  const treadMat = materials.woodFloorOld.clone();
  treadMat.name = 'stair_tread';
  treadMat.color.setHex(0x6b4a32);
  treadMat.roughness = 0.58;
  tileAtMetres(treadMat, 0.8);

  const stringMat = materials.woodDark.clone();
  stringMat.name = 'stair_string';
  stringMat.color.setHex(0x1b1611);
  stringMat.roughness = 0.52;
  tileAtMetres(stringMat, 0.9);

  const railMat = materials.woodDark.clone();
  railMat.name = 'stair_handrail';
  railMat.color.setHex(0x2a1d14);
  railMat.roughness = 0.36;
  tileAtMetres(railMat, 0.7);

  const ironMat = materials.ironDark.clone();
  ironMat.name = 'stair_iron';
  ironMat.color.setHex(0x151414);
  ironMat.roughness = 0.5;
  ironMat.metalness = 0.62;

  const baluster = balusterGeometry();
  const newel = newelGeometry();

  const T = 0.055;        // tread thickness
  const RISER_T = 0.022;  // riser board
  const SW = 0.075;       // stringer width
  const SD = 0.36;        // stringer depth
  const RAIL = 0.95;      // handrail height over the pitch line
  const NOSING = 0.014;

  const treadGeos = [];
  const riserGeos = [];
  const stringGeos = [];
  const ironGeos = [];
  const railGeos = [];
  const newelGeos = [];
  const landingGeos = [];
  const skirtGeos = [];

  // One flight: `n` treads between two z stations, rising by yHigh - yLow.
  // Returns the pitch function the balustrade needs.
  const flight = (lane, zLow, zHigh, yLow, yHigh, n) => {
    const dir = Math.sign(zHigh - zLow);
    const going = Math.abs(zHigh - zLow) / n;
    const riser = (yHigh - yLow) / n;
    const pitch = (z) => yLow + ((z - zLow) / (zHigh - zLow)) * (yHigh - yLow);

    for (let k = 0; k < n; k++) {
      const yTop = yLow + (k + 1) * riser;
      const zNear = zLow + dir * k * going;
      const zFar = zLow + dir * (k + 1) * going;
      // the tread board, with a real nosing over the riser below it
      const tg = box(lane.x1 - lane.x0, T, going + NOSING, 1);
      tg.translate((lane.x0 + lane.x1) / 2, yTop - T / 2, (zNear + zFar) / 2 - dir * NOSING / 2);
      treadGeos.push(tg);
      // the riser board, set back under the nosing
      const rg = box(lane.x1 - lane.x0 - 0.006, riser - T, RISER_T, 1);
      rg.translate((lane.x0 + lane.x1) / 2,
        yTop - T - (riser - T) / 2, zFar - dir * (RISER_T / 2 + NOSING));
      riserGeos.push(rg);
    }

    // Closed strings on both edges: a sloped beam from the foot to the head,
    // its top just under the tread boards, which is what carries the flight.
    const len = Math.hypot(Math.abs(zHigh - zLow), yHigh - yLow);
    const ang = Math.atan2(yHigh - yLow, dir * (zHigh - zLow));
    for (const x of [lane.x0 + SW / 2, lane.x1 - SW / 2]) {
      const sg = box(SW, SD, len + 0.1, 1);
      sg.rotateX(-ang);
      sg.translate(x, (yLow + yHigh) / 2 - T - SD / 2 + 0.06, (zLow + zHigh) / 2);
      stringGeos.push(sg);
    }
    return pitch;
  };

  // A straight balustrade: newel at both ends, turned iron posts on the pitch,
  // and one continuous tube rail on top.
  const balustrade = (x, z0, z1, y0, y1, { foot = true, head = true } = {}) => {
    const n = Math.max(2, Math.round(Math.abs(z1 - z0) / 0.135));
    const yAt = (z) => y0 + ((z - z0) / (z1 - z0)) * (y1 - y0);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      const y = yAt(z);
      pts.push(new THREE.Vector3(x, y + RAIL, z));
      const g = baluster.clone();
      const h = RAIL - 0.02;
      g.scale(1, h / 1.02, 1);
      g.translate(x, y - 0.03, z);
      ironGeos.push(g);
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    railGeos.push(new THREE.TubeGeometry(curve, Math.max(6, n * 2), 0.035, 8, false));
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const cap = new THREE.SphereGeometry(0.035, 8, 6);
      cap.translate(p.x, p.y, p.z);
      ironGeos.push(cap);
    }
    // newels at the open ends only: a newel where the rail runs into a flight
    // above reads as a post growing out of a tread
    for (const [on, z] of [[foot, z0], [head, z1]]) {
      if (!on) continue;
      const y = yAt(z);
      const ng = newel.clone();
      ng.translate(x, y - 0.02, z);
      newelGeos.push(ng);
      const plinth = box(0.15, 0.09, 0.15, 1);
      plinth.translate(x, y + 0.045, z);
      newelGeos.push(plinth);
      const fin = new THREE.SphereGeometry(0.042, 10, 8);
      fin.translate(x, y - 0.02 + 1.06 + 0.05, z);
      newelGeos.push(fin);
      architecture.colliders.push({
        x1: x - 0.075, z1: z - 0.075, x2: x + 0.075, z2: z + 0.075,
        kind: 'newelPost', y0: y - 0.02, y1: y + 1.08,
      });
    }
    // the balustrade is a barrier: a chain of short colliders along it
    const steps = Math.max(2, Math.round(Math.abs(z1 - z0) / 0.5));
    for (let i = 0; i < steps; i++) {
      const za = z0 + ((z1 - z0) * i) / steps;
      const zb = z0 + ((z1 - z0) * (i + 1)) / steps;
      architecture.colliders.push({
        x1: x - 0.04, z1: za, x2: x + 0.04, z2: zb, kind: 'rail',
        y0: Math.min(yAt(za), yAt(zb)), y1: Math.max(yAt(za), yAt(zb)) + 1.05,
        baseY: yAt(za),
      });
    }
  };

  let base = 0;
  for (let i = 0; i < S.rise.length; i++) {
    const rise = S.rise[i];
    const [nA, nB] = S.risers[i];
    const mid = base + (rise * nA) / (nA + nB);   // the half landing

    // --- flight A: north and up, against the west wall --------------------
    const pitchA = flight({ x0: ax0, x1: ax1 }, zs, zn, base, mid, nA);
    // handrail on the well side only; the wall side gets a timber wall rail
    balustrade(ax1 - 0.07, zs, zn, base, mid, { foot: false, head: true });

    // --- half landing ------------------------------------------------------
    const lg = box(bx1 - ax0, 0.14, zn - S.landZ, 1);
    lg.translate((ax0 + bx1) / 2, mid - 0.07, (S.landZ + zn) / 2);
    landingGeos.push(lg);
    // nosing along the landing edge the flights run off
    const lno = box(bx1 - ax0, 0.05, 0.09, 1);
    lno.translate((ax0 + bx1) / 2, mid - 0.155, zn - 0.015);
    landingGeos.push(lno);
    architecture.extraFloors.push({ x0: ax0, x1: bx1, z0: S.landZ, z1: zn, y: mid });

    // --- flight B: back south and up to the next floor ---------------------
    const pitchB = flight({ x0: bx0, x1: bx1 }, zn, zs, mid, base + rise, nB);
    // exposed on both sides here: the hall on the east, the well on the west
    balustrade(bx1 - 0.07, zn, zs, mid, base + rise, { foot: true, head: true });
    balustrade(bx0 + 0.07, zn, zs, mid, base + rise, { foot: false, head: false });

    // the half landing's open east edge, guarded across to flight B's rail
    balustrade(bx1 - 0.07, S.landZ, zn, mid, mid, { foot: true, head: false });

    // --- the understair, on the ground floor only -------------------------
    // Below the second flight the foyer is open plan, and a player walking into
    // it would put their head through the soffit. A house of this age closes it
    // as a cupboard: panelled to the stringer, with the stair above it.
    if (i === 0) {
      const segs = 7;
      for (let k = 0; k < segs; k++) {
        const zA = zn + ((zs - zn) * k) / segs;
        const zB = zn + ((zs - zn) * (k + 1)) / segs;
        const yTop = pitchB((zA + zB) / 2) - T - 0.30;
        if (yTop < 0.15) continue;
        const sg = box(bx1 - bx0, yTop, zB - zA + 0.01, 1);
        sg.translate((bx0 + bx1) / 2, yTop / 2, (zA + zB) / 2);
        skirtGeos.push(sg);
        architecture.colliders.push({
          x1: bx0, z1: zA, x2: bx1, z2: zB, kind: 'wall', y0: -0.2, y1: yTop,
        });
      }
      // and below the first flight, the same, in lane A
      for (let k = 0; k < segs; k++) {
        const zA = zn + ((zs - zn) * k) / segs;
        const zB = zn + ((zs - zn) * (k + 1)) / segs;
        const yTop = pitchA((zA + zB) / 2) - T - 0.30;
        if (yTop < 0.15) continue;
        const sg = box(ax1 - ax0, yTop, zB - zA + 0.01, 1);
        sg.translate((ax0 + ax1) / 2, yTop / 2, (zA + zB) / 2);
        skirtGeos.push(sg);
        architecture.colliders.push({
          x1: ax0, z1: zA, x2: ax1, z2: zB, kind: 'wall', y0: -0.2, y1: yTop,
        });
      }
    }

    architecture.ramps.push({
      kind: 'linear', x0: ax0, x1: ax1, z0: zs, z1: zn,
      y0: base, y1: mid, steps: nA, index: i * 2,
    });
    architecture.ramps.push({
      kind: 'linear', x0: bx0, x1: bx1, z0: zn, z1: zs,
      y0: mid, y1: base + rise, steps: nB, index: i * 2 + 1,
    });

    base += rise;
  }

  // --- balustrades round the stairwell on the floors above -----------------
  // Only the east edge is open to a room: the west edge is the wall the stair
  // is built against, and the north edge is 0.25 m off the hall wall. The south
  // edge is where the flights arrive, so it gets a short guard across the well
  // between the two lanes and nothing else.
  const hx1 = S.hole.x1 + 0.06;
  for (const level of LEVELS) {
    if (level.id === 'B1' || level.id === 'GF') continue;
    const y = level.y;
    balustrade(hx1, S.hole.z0 + 0.06, S.hole.z1 - 0.06, y, y, { foot: true, head: true });
    // the well gap at the arrival edge
    balustrade((ax1 + bx0) / 2, S.hole.z1 - 0.10, S.hole.z1 - 0.10, y, y, { foot: false, head: false });
  }

  // --- merge and add ---------------------------------------------------------
  const add = (geos, mat, name) => {
    if (!geos.length) return;
    const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const mesh = new THREE.Mesh(mergeGeometries(flat), mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  add(treadGeos, treadMat, 'StairTreads');
  add(riserGeos, stringMat, 'StairRisers');
  add(stringGeos, stringMat, 'StairStrings');
  add(landingGeos, treadMat, 'StairLandings');
  add(skirtGeos, materials.wallPlaster, 'StairSkirts');
  add(ironGeos, ironMat, 'StairBalusters');
  add(railGeos, railMat, 'StairHandrails');
  add(newelGeos, railMat, 'StairNewels');
}
