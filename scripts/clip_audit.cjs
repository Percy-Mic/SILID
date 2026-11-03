// MANSION CLIP AUDIT — props, plants and boulders against floors and walls.
//
// Loads the real game (?probe=1) and measures, in world space, nothing mocked:
//
//   1. placed props      base vs the floor query, footprint vs every wall line
//                        at the real half-thickness (0.21 m exterior, 0.11 m
//                        interior), and footprint vs the stairwell holes;
//   2. merged prop meshes triangle by triangle, because the range, the counters
//                        and the generator are drawn directly and never appear
//                        in props.placed;
//   3. cabinets, armoires and the fuse panel by their world bounding boxes;
//   4. instanced plants, rocks, logs and tree trunks, plus the ruin and cave
//                        rocks, within the mansion region, per instance.
//
// Every hit is then CONFIRMED against the built geometry, not just against the
// plan data: a wall finding only counts if the level's own Walls_/Exterior_
// mesh actually has masonry in that cell, and a floor finding only counts if
// the level's Floor_ slab actually has a slab there. A stale collider over an
// open terrace, or a floor query that answers for a stairwell opening, is
// reported as such instead of as a clip.
//
// "Touching a wall" is not a finding — furniture is backed to a 4.5 cm gap by
// design. A finding needs depth: 3 cm below the floor, 3 cm floating, 2 cm
// inside masonry.
//
// Usage: node scripts/clip_audit.cjs [outJson]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/clip_audit.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000, polling: 500 });

  const audit = await page.evaluate(() => {
    const s = window.__silid;
    const THREE = s.THREE;
    const A = s.architecture;
    const LEVELS = s.levels;
    const floorAt = s.floorAt;
    const terrainAt = s.terrainAt;
    const scene = s.scene;
    scene.updateMatrixWorld(true);

    const F_EPS = 0.03;   // m of floor penetration that counts as clipping
    const W_EPS = 0.02;   // m inside masonry that counts as clipping
    const CELL = 0.5;     // audit grid, metres

    const out = {
      floor: [], floating: [], wall: [], overVoid: [], landscape: [], noFloor: [],
      stats: {},
    };

    const r2 = (v) => +v.toFixed(2);
    const r3 = (v) => +v.toFixed(3);
    const rec = (arr, o) => { if (arr.length < 400) arr.push(o); };
    // floor rest, tracked across every piece even below the finding threshold:
    // "0 findings" is only meaningful if the probe actually measured things
    const probe = { tested: 0, nullFloor: 0, deepestSink: 0, highestRise: 0, sinkAt: null, riseAt: null };
    const cell = (x, z) => Math.floor(x / CELL) + '|' + Math.floor(z / CELL);

    // =====================================================================
    // Built-geometry grids: what the walls and slabs actually are
    // =====================================================================
    const v3 = new THREE.Vector3();
    const buildGrids = (match) => {
      const grids = new Map();
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry || !match(o.name || '')) return;
        const g = o.geometry;
        const pos = g.attributes.position;
        if (!pos) return;
        const arr = pos.array;
        const ic = g.index ? g.index.array : null;
        const n = ic ? ic.length : pos.count;
        const set = new Set();
        const mw = o.matrixWorld;
        for (let t = 0; t + 2 < n; t += 3) {
          const a = ic ? ic[t] : t, b = ic ? ic[t + 1] : t + 1, c = ic ? ic[t + 2] : t + 2;
          v3.set((arr[a * 3] + arr[b * 3] + arr[c * 3]) / 3, 0,
            (arr[a * 3 + 2] + arr[b * 3 + 2] + arr[c * 3 + 2]) / 3);
          if (!mw.identity()) v3.applyMatrix4(mw);
          set.add(cell(v3.x, v3.z));
        }
        const prev = grids.get(o.name);
        if (prev) for (const k of set) prev.add(k);
        else grids.set(o.name, set);
      });
      return grids;
    };
    const wallGrids = buildGrids((n) => n.startsWith('Walls_') || n.startsWith('Exterior_'));
    const floorGrids = buildGrids((n) => n.startsWith('Floor_'));
    out.stats.wallMeshes = [...wallGrids.keys()];
    out.stats.floorMeshes = [...floorGrids.keys()];

    const levelIdAt = (y) => {
      let best = null, bd = Infinity;
      for (const l of LEVELS) { const d = Math.abs(l.y - y); if (d < bd) { bd = d; best = l; } }
      return bd < 0.35 ? best : null;
    };
    const levelIdForFloorY = (y) => {
      const l = LEVELS.find((x) => Math.abs(x.y - y) < 0.02);
      return l ? l.id : null;
    };

    // ANY solid geometry in the region: walls, facade, stair drums, casings.
    // The rebuilt facade lives in FacadeStone/FacadeShell/…, not in Walls_*,
    // so confirming only against Walls_* would call a real clip "no geometry".
    // A collider with nothing under it is an invisible wall — a different bug
    // — and must not be reported as a clip either, so both answers come back.
    const solidGrid = new Map();   // cellXY -> Map(mesh name -> [yMin, yMax])
    const skipSolid = /^(Props_|Floor_|Soffit_|FacadeIvy|Terrain|Road|Pond|Stream|SKY|Sky|Stars|MilkyWay|Moon|Understory|Tree|FallenLogs|Rocks|Cabinet_|Armoire_|FusePanel|phone_|Car)/;
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
      if (skipSolid.test(o.name || '')) return;
      const g = o.geometry;
      const pos = g.attributes.position;
      if (!pos) return;
      const arr = pos.array;
      const ic = g.index ? g.index.array : null;
      const n = ic ? ic.length : pos.count;
      const mw = o.matrixWorld;
      for (let t = 0; t + 2 < n; t += 3) {
        const a = ic ? ic[t] : t, b = ic ? ic[t + 1] : t + 1, c = ic ? ic[t + 2] : t + 2;
        v3.set((arr[a * 3] + arr[b * 3] + arr[c * 3]) / 3,
          (arr[a * 3 + 1] + arr[b * 3 + 1] + arr[c * 3 + 1]) / 3,
          (arr[a * 3 + 2] + arr[b * 3 + 2] + arr[c * 3 + 2]) / 3);
        if (!mw.identity()) v3.applyMatrix4(mw);
        const k = cell(v3.x, v3.z);
        let m = solidGrid.get(k);
        if (!m) { m = new Map(); solidGrid.set(k, m); }
        const nm = o.name || '(unnamed)';
        const r = m.get(nm);
        if (!r) m.set(nm, [v3.y, v3.y]);
        else { if (v3.y < r[0]) r[0] = v3.y; if (v3.y > r[1]) r[1] = v3.y; }
      }
    });
    out.stats.solidCells = solidGrid.size;

    // Which meshes actually overlap the band AT THE PROP'S OWN HEIGHT? Naming
    // them separates a wall clip from a collider that has no wall on this
    // storey at all (an invisible wall — a different bug) and from a wall on
    // the floor below whose top edge merely shares a coarse height bucket.
    const WALLY = /^(Walls_|Exterior_)/;
    const solidReal = (x0, x1, z0, z1, y0, y1) => {
      if (!isFinite(x0)) return 'unknown';
      const names = new Map();   // name -> height overlap in metres
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
        for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
          const m = solidGrid.get(i + '|' + j);
          if (!m) continue;
          for (const [nm, r] of m) {
            const ov = Math.min(r[1], y1) - Math.max(r[0], y0);
            if (ov <= 0.05) continue;
            const prev = names.get(nm) || 0;
            if (ov > prev) names.set(nm, ov);
          }
        }
      }
      const all = [...names.entries()].sort((p, q) => q[1] - p[1]);
      const w = all.filter(([nm]) => WALLY.test(nm));
      const fmt = (list) => list.map(([nm, ov]) => nm + ' +' + ov.toFixed(2) + 'm').join(', ');
      if (w.length) return 'wall: ' + fmt(w) + (all.length > w.length ? ' | also ' + fmt(all.filter(([nm]) => !WALLY.test(nm))) : '');
      if (all.length) return 'other: ' + fmt(all.slice(0, 5));
      return 'nothing there';
    };
    const slabReal = (levelId, x, z) => {
      if (!levelId) return 'unknown';
      const set = floorGrids.get('Floor_' + levelId);
      const near = (s) => {
        if (!s) return false;
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) if (s.has(cell(x + i * CELL, z + j * CELL))) return true;
        }
        return false;
      };
      if (near(set)) return 'confirmed';
      // which level, if any, does have a slab at this column?
      for (const [name, s] of floorGrids) if (near(s)) return 'no slab on ' + levelId + ' (slab on ' + name.replace('Floor_', '') + ')';
      return 'no slab there';
    };

    // =====================================================================
    // Wall lines with real thickness
    // =====================================================================
    const fps = LEVELS.map((l) => l.footprint).filter(Boolean);
    out.stats.footprints = fps.length;
    const halfAt = (axis, line) => {
      for (const fp of fps) {
        const perim = axis === 'x'
          ? (Math.abs(line - fp.z0) < 0.03 || Math.abs(line - fp.z1) < 0.03)
          : (Math.abs(line - fp.x0) < 0.03 || Math.abs(line - fp.x1) < 0.03);
        if (perim) return 0.21;
      }
      return 0.11;
    };

    const walls = [];
    for (const c of A.colliders) {
      if (!c || c.kind !== 'wall' || c.disabled) continue;
      const dx = Math.abs(c.x2 - c.x1), dz = Math.abs(c.z2 - c.z1);
      if (dx < 0.02 && dz < 0.02) continue;
      if (dx >= dz) {
        const line = c.z1;
        walls.push({ axis: 'x', a: Math.min(c.x1, c.x2), b: Math.max(c.x1, c.x2),
          line, half: halfAt('x', line), y0: c.y0 ?? -20, y1: c.y1 ?? 40 });
      } else {
        const line = c.x1;
        walls.push({ axis: 'z', a: Math.min(c.z1, c.z2), b: Math.max(c.z1, c.z2),
          line, half: halfAt('z', line), y0: c.y0 ?? -20, y1: c.y1 ?? 40 });
      }
    }
    out.stats.wallSegments = walls.length;
    out.stats.exteriorWallLines = walls.filter((w) => w.half > 0.15).length;

    const grid = new Map();
    const key = (i, j) => i + '|' + j;
    walls.forEach((w, wi) => {
      const i0 = Math.floor(w.axis === 'x' ? w.a : w.line - w.half);
      const i1 = Math.floor(w.axis === 'x' ? w.b : w.line + w.half);
      const j0 = Math.floor(w.axis === 'x' ? w.line - w.half : w.a);
      const j1 = Math.floor(w.axis === 'x' ? w.line + w.half : w.b);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = key(i, j);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(wi);
        }
      }
    });

    // deepest overlap between a box and any wall band; also the band itself
    const bite = (x0, x1, z0, z1, y0, y1) => {
      let best = 0, hit = null;
      const seen = new Set();
      for (let i = Math.floor(x0); i <= Math.floor(x1); i++) {
        for (let j = Math.floor(z0); j <= Math.floor(z1); j++) {
          const arr = grid.get(key(i, j));
          if (!arr) continue;
          for (const wi of arr) {
            if (seen.has(wi)) continue;
            seen.add(wi);
            const w = walls[wi];
            // a real vertical overlap: a piece standing on the floor ABOVE a
            // wall that stops at that floor overlaps it by a millimetre, and
            // that is contact with the slab, not a clip through the wall
            const vo = Math.min(y1, w.y1) - Math.max(y0, w.y0);
            if (vo < 0.15) continue;
            let o = 0;
            if (w.axis === 'x') {
              if (x1 <= w.a || x0 >= w.b) continue;
              o = Math.min(z1, w.line + w.half) - Math.max(z0, w.line - w.half);
            } else {
              if (z1 <= w.a || z0 >= w.b) continue;
              o = Math.min(x1, w.line + w.half) - Math.max(x0, w.line - w.half);
            }
            if (o > best) { best = o; hit = w; }
          }
        }
      }
      return { depth: best, w: hit };
    };
    const nearWall = (x0, x1, z0, z1, y0, y1) => bite(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, y0, y1).depth > 0;

    // =====================================================================
    // Floor helpers
    // =====================================================================
    const insideHouse = (x, z) => floorAt(x, z, 6.0) !== null;
    const stairAt = (() => {
      let cx = null, cz = null;
      for (const c of A.colliders) {
        if (c && (c.kind === 'newel' || c.kind === 'newelPost')) {
          cx = (c.x1 + c.x2) / 2; cz = (c.z1 + c.z2) / 2; break;
        }
      }
      return cx === null ? null : (x, z) => Math.hypot(x - cx, z - cz) < 3.0;
    })();

    const holes = (A.holes || []).map((h) => (h.kind === 'circle'
      ? { level: h.level, circle: true, x: h.x, z: h.z, r: h.r }
      : { level: h.level, circle: false, x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1 }));
    const overHole = (level, x0, x1, z0, z1) => {
      for (const h of holes) {
        if (h.level !== undefined && level !== undefined && h.level !== level) continue;
        if (h.circle) {
          const cx = Math.max(x0, Math.min(h.x, x1));
          const cz = Math.max(z0, Math.min(h.z, z1));
          if (Math.hypot(cx - h.x, cz - h.z) < h.r - 0.05) return h;
        } else if (x1 > h.x0 + 0.05 && x0 < h.x1 - 0.05 && z1 > h.z0 + 0.05 && z0 < h.z1 - 0.05) return h;
      }
      return null;
    };

    // =====================================================================
    // 1+3. placed props and named furniture units
    // =====================================================================
    const levelY = {};
    LEVELS.forEach((l) => { levelY[l.id] = l.y; });

    const boxes = [];
    let noTemplate = 0;
    for (const p of s.props.placed) {
      const tpl = s.furniture.templates.get(p.name);
      if (!tpl) { noTemplate++; continue; }
      const ly = levelY[p.level];
      const y = typeof p.y === 'number' ? p.y : ly;
      const rot = p.rot || 0;
      const c = Math.cos(rot), si = Math.sin(rot);
      const b = tpl.box;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const px of [b.min.x, b.max.x]) {
        for (const pz of [b.min.z, b.max.z]) {
          const wx = p.x + px * c + pz * si;
          const wz = p.z - px * si + pz * c;
          if (wx < x0) x0 = wx;
          if (wx > x1) x1 = wx;
          if (wz < z0) z0 = wz;
          if (wz > z1) z1 = wz;
        }
      }
      boxes.push({ kind: 'prop', name: p.name, level: p.level, room: p.room,
        x0, x1, z0, z1, base: y + b.min.y, top: y + b.max.y,
        solid: p.solid !== false, elevated: ly !== undefined && y > ly + 0.05 });
    }
    out.stats.placedProps = boxes.length;
    out.stats.placedWithoutTemplate = noTemplate;

    const testBox = (bx) => {
      const cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2;
      const lvl = bx.level || (levelIdAt(bx.base) ? levelIdAt(bx.base).id : null);
      const at = { name: bx.name, level: lvl, room: bx.room || null, x: r2(cx), z: r2(cz),
        base: r3(bx.base), size: [r2(bx.x1 - bx.x0), r2(bx.z1 - bx.z0)] };

      // The supporting floor is the highest floor at or below the base. The
      // query allows a floor up to 0.5 m above the given foot, so a window of
      // +0.02 catches a piece sunk half a metre while a tall window would start
      // measuring basement geometry against the ground floor over it.
      const f = floorAt(cx, cz, bx.base + 0.02);
      if (f === null) {
        probe.nullFloor++;
        const g = terrainAt ? terrainAt(cx, cz) : null;
        const h = overHole(bx.level, bx.x0, bx.x1, bx.z0, bx.z1);
        rec(out.overVoid, { ...at, why: h ? 'over a floor opening' : 'outside every footprint',
          ground: g === null ? null : r3(g) });
        return;
      }
      const sink = f - bx.base;
      const rise = bx.base - f;
      probe.tested++;
      if (sink > probe.deepestSink) { probe.deepestSink = sink; probe.sinkAt = at.name + '@' + at.x + ',' + at.z; }
      if (rise > probe.highestRise) { probe.highestRise = rise; probe.riseAt = at.name + '@' + at.x + ',' + at.z; }
      const slab = slabReal(levelIdForFloorY(f), cx, cz);
      const elevated = rise > 0.05;

      if (!bx.solid) {
        if (sink > F_EPS) rec(out.floor, { ...at, why: 'hung piece below the floor',
          depth: r3(sink), slab });
      } else if (elevated) {
        if (nearWall(bx.x0, bx.x1, bx.z0, bx.z1, bx.base, bx.top)) {
          // on the wall by design — a fuse box, a clock, a picture: not a floater
          if (sink > F_EPS) rec(out.floor, { ...at, why: 'wall-mounted piece below the floor',
            depth: r3(sink), slab });
        } else {
          const sup = boxes.some((o) => o !== bx
            && o.top <= bx.base + 0.10 && o.top >= bx.base - 0.10
            && cx >= o.x0 - 0.06 && cx <= o.x1 + 0.06
            && cz >= o.z0 - 0.06 && cz <= o.z1 + 0.06);
          if (!sup && rise > F_EPS) rec(out.floating, { ...at, why: 'elevated with nothing under it',
            depth: r3(rise), slab });
        }
      } else if (sink > F_EPS) {
        rec(out.floor, { ...at, why: 'base below the floor', depth: r3(sink), slab });
      } else if (rise > F_EPS) {
        rec(out.floating, { ...at, why: 'base above the floor', depth: r3(rise), slab });
      }

      const h = overHole(bx.level, bx.x0, bx.x1, bx.z0, bx.z1);
      if (h) rec(out.overVoid, { ...at, why: 'stands over a floor opening' });

      const b = bite(bx.x0, bx.x1, bx.z0, bx.z1, bx.base, bx.top);
      if (b.depth > W_EPS && b.w) {
        const w = b.w;
        // confirm against the level's own wall mesh, over the band ∩ the box
        const region = w.axis === 'x'
          ? { x0: bx.x0, x1: bx.x1, z0: Math.max(bx.z0, w.line - w.half), z1: Math.min(bx.z1, w.line + w.half) }
          : { x0: Math.max(bx.x0, w.line - w.half), x1: Math.min(bx.x1, w.line + w.half), z0: bx.z0, z1: bx.z1 };
        // does THIS storey's own wall mesh occupy the band? if not, the
        // collider belongs to a floor below and the furniture on this floor is
        // only touching an invisible wall
        const cellHit = (sets, x0, x1, z0, z1) => {
          if (!sets.length) return null;
          for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
            for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
              const k = i + '|' + j;
              if (sets.some((s) => s.has(k))) return true;
            }
          }
          return false;
        };
        const ownSets = lvl
          ? ['Walls_' + lvl, 'Exterior_' + lvl].map((n) => wallGrids.get(n)).filter(Boolean)
          : [];
        const ownStorey = cellHit(ownSets, region.x0, region.x1, region.z0, region.z1);
        // and along the WHOLE wall, not just where the piece touches it: a wall
        // that exists elsewhere on this line but not here means the piece is at
        // an opening (a door or a window reveal), not inside plaster
        let spanFrac = null;
        if (ownSets.length) {
          const si0 = w.axis === 'x' ? Math.floor(w.a / CELL) : Math.floor((w.line - w.half) / CELL);
          const si1 = w.axis === 'x' ? Math.floor(w.b / CELL) : Math.floor((w.line + w.half) / CELL);
          const sj0 = w.axis === 'x' ? Math.floor((w.line - w.half) / CELL) : Math.floor(w.a / CELL);
          const sj1 = w.axis === 'x' ? Math.floor((w.line + w.half) / CELL) : Math.floor(w.b / CELL);
          let hit = 0, tot = 0;
          for (let i = si0; i <= si1; i++) {
            for (let j = sj0; j <= sj1; j++) {
              tot++;
              if (ownSets.some((s) => s.has(i + '|' + j))) hit++;
            }
          }
          spanFrac = tot ? +(hit / tot).toFixed(2) : null;
        }
        rec(out.wall, { ...at, why: 'footprint inside masonry', depth: r3(b.depth),
          wall: { axis: w.axis, line: r2(w.line), half: w.half,
            span: [r2(w.a), r2(w.b)], exterior: w.half > 0.15,
            colliderY: [r2(w.y0), r2(w.y1)] },
          wallOnOwnStorey: ownStorey,
          spanWallFrac: spanFrac,
          presentAt: solidReal(region.x0, region.x1, region.z0, region.z1, bx.base, bx.top) });
      }
    };
    boxes.forEach(testBox);

    const named = [];
    scene.traverse((o) => {
      if ((o.isMesh || o.isGroup) && /^(Cabinet_|Armoire_|FusePanel|Hiding|phone_pickup)/.test(o.name || '')) named.push(o);
    });
    out.stats.namedUnits = named.length;
    const boxOf = (obj) => {
      const bb = new THREE.Box3();
      obj.updateWorldMatrix(true, true);
      obj.traverse((n) => {
        if (!n.isMesh || !n.geometry) return;
        if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
        bb.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld));
      });
      return bb;
    };
    for (const n of named) {
      const bb = boxOf(n);
      if (!isFinite(bb.min.x)) continue;
      testBox({ kind: 'group', name: n.name, level: null, room: null,
        x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z,
        base: bb.min.y, top: bb.max.y, solid: true, elevated: bb.min.y > 0.05 });
    }

    // =====================================================================
    // 2. merged prop meshes, triangle by triangle (floor side only)
    // =====================================================================
    const propMeshes = [];
    scene.traverse((o) => { if (o.isMesh && /^Props_/.test(o.name || '')) propMeshes.push(o); });
    out.stats.propMeshes = propMeshes.length;

    const floorBuckets = new Map();
    let triScanned = 0;
    for (const m of propMeshes) {
      const g = m.geometry;
      const pos = g.attributes.position;
      if (!pos) continue;
      const arr = pos.array;
      const ic = g.index ? g.index.array : null;
      const n = ic ? ic.length : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        const a = ic ? ic[t] : t, b = ic ? ic[t + 1] : t + 1, c = ic ? ic[t + 2] : t + 2;
        const cx = (arr[a * 3] + arr[b * 3] + arr[c * 3]) / 3;
        const cy = (arr[a * 3 + 1] + arr[b * 3 + 1] + arr[c * 3 + 1]) / 3;
        const cz = (arr[a * 3 + 2] + arr[b * 3 + 2] + arr[c * 3 + 2]) / 3;
        triScanned++;
        const f = floorAt(cx, cz, cy + 0.02);
        if (f === null) continue;
        const d = f - cy;
        if (d <= F_EPS) continue;
        const k = cell(cx, cz);
        let e = floorBuckets.get(k);
        if (!e) {
          e = { x: r2(cx), z: r2(cz), mesh: m.name, max: 0, tris: 0,
            nearStair: stairAt ? stairAt(cx, cz) : false,
            overHole: !!overHole(undefined, cx - 0.3, cx + 0.3, cz - 0.3, cz + 0.3) };
          floorBuckets.set(k, e);
        }
        e.tris++;
        if (d > e.max) { e.max = r3(d); e.y = r3(cy); e.floor = r3(f); e.level = levelIdForFloorY(f); }
      }
    }
    out.stats.trianglesScanned = triScanned;
    // Two very different things hide behind "below the floor": geometry driven
    // THROUGH a slab that is really there, and geometry hanging in an opening
    // where the level's floor query answers for a slab that is not drawn. The
    // slab grid tells them apart, so only the first is called a clip.
    const deep = [...floorBuckets.values()].filter((e) => e.max > F_EPS)
      .map((e) => {
        const slab = slabReal(e.level, e.x, e.z);
        return { ...e, slab, clip: slab === 'confirmed' && !e.overHole };
      })
      .sort((a, b) => b.max - a.max);
    out.floorThroughGeometry = deep.slice(0, 150);
    out.stats.floorCellsFlagged = deep.length;
    out.stats.floorCellsClip = deep.filter((e) => e.clip).length;

    // =====================================================================
    // 4. plants, rocks, logs, tree trunks, ruin + cave rock — region only
    // =====================================================================
    let rx0 = Infinity, rx1 = -Infinity, rz0 = Infinity, rz1 = -Infinity;
    for (const fp of fps) {
      rx0 = Math.min(rx0, fp.x0); rx1 = Math.max(rx1, fp.x1);
      rz0 = Math.min(rz0, fp.z0); rz1 = Math.max(rz1, fp.z1);
    }
    // …union with the bounds of the BUILT house, because bays, turrets and the
    // porch stand outside the drawn footprint and the forest's keep-out is
    // measured from the drawn one: the difference is exactly where a fern
    // could reach the masonry. Only structural meshes count — the road and the
    // ruins are not the house.
    const HOUSE = /^(Walls_|Exterior_|Facade|Trim|Stair|StringCourse|Courtyard|Roof|WellFraming|Newel)/;
    for (const [k, m] of solidGrid) {
      if (![...m.keys()].some((nm) => HOUSE.test(nm))) continue;
      const [i, j] = k.split('|').map(Number);
      rx0 = Math.min(rx0, i * CELL); rx1 = Math.max(rx1, i * CELL + CELL);
      rz0 = Math.min(rz0, j * CELL); rz1 = Math.max(rz1, j * CELL + CELL);
    }
    const PAD = 4;
    const region = { x0: rx0 - PAD, x1: rx1 + PAD, z0: rz0 - PAD, z1: rz1 + PAD };
    out.stats.region = { x0: r2(region.x0), x1: r2(region.x1), z0: r2(region.z0), z1: r2(region.z1) };

    const landscapeBox = (at, bb) => {
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      const inside = floorAt(cx, cz, 6.0) !== null;
      const b = bite(bb.min.x, bb.max.x, bb.min.z, bb.max.z, bb.min.y, bb.max.y);
      if (inside) {
        const f = floorAt(cx, cz, bb.min.y + 0.02);
        rec(out.landscape, { ...at, why: 'inside the house footprint', depth: f === null ? null : r3(f - bb.min.y) });
      }
      if (b.depth > W_EPS && b.w) {
        rec(out.landscape, { ...at, why: 'intersecting a wall band', depth: r3(b.depth),
          wall: { axis: b.w.axis, line: r2(b.w.line), half: b.w.half, exterior: b.w.half > 0.15 } });
      }
    };

    const instMeshes = [];
    scene.traverse((o) => {
      if (o.isInstancedMesh && /^(Understory|Rocks|FallenLogs|TreeBark)/.test(o.name || '')) instMeshes.push(o);
    });
    out.stats.instanceMeshes = instMeshes.map((m) => m.name + ':' + m.count);

    const m4 = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let nearTested = 0;
    for (const im of instMeshes) {
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
      const gb = im.geometry.boundingBox;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4);
        m4.premultiply(im.matrixWorld);
        const bb = new THREE.Box3();
        for (const px of [gb.min.x, gb.max.x]) {
          for (const py of [gb.min.y, gb.max.y]) {
            for (const pz of [gb.min.z, gb.max.z]) {
              v.set(px, py, pz).applyMatrix4(m4);
              bb.expandByPoint(v);
            }
          }
        }
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        if (cx < region.x0 || cx > region.x1 || cz < region.z0 || cz > region.z1) continue;
        nearTested++;
        landscapeBox({ name: im.name, instance: i, x: r2(cx), z: r2(cz), base: r3(bb.min.y),
          size: [r2(bb.max.x - bb.min.x), r2(bb.max.y - bb.min.y), r2(bb.max.z - bb.min.z)] }, bb);
      }
    }
    out.stats.instancesNearHouse = nearTested;

    // named rock/landscape meshes (ruins, cave) — same two tests only
    const landscapeNamed = [];
    scene.traverse((o) => {
      // InstancedMesh IS a Mesh: taking a box of every Rocks instance at once
      // produces one continent-sized boulder in the middle of the house.
      if (o.isMesh && !o.isInstancedMesh && /^(Ruin_|Cave|Rocks|Boulder)/.test(o.name || '')) landscapeNamed.push(o);
    });
    out.stats.landscapeNamed = landscapeNamed.map((m) => m.name);
    for (const n of landscapeNamed) {
      const bb = boxOf(n);
      if (!isFinite(bb.min.x)) continue;
      landscapeBox({ name: n.name, x: r2((bb.min.x + bb.max.x) / 2), z: r2((bb.min.z + bb.max.z) / 2),
        base: r3(bb.min.y), size: [r2(bb.max.x - bb.min.x), r2(bb.max.y - bb.min.y), r2(bb.max.z - bb.min.z)] }, bb);
    }

    out.counts = {
      floor: out.floor.length,
      floating: out.floating.length,
      wall: out.wall.length,
      overVoid: out.overVoid.length,
      landscape: out.landscape.length,
      floorProbe: { tested: probe.tested, noFloor: probe.nullFloor,
        deepestSink: r3(probe.deepestSink), sinkAt: probe.sinkAt,
        highestRise: r3(probe.highestRise), riseAt: probe.riseAt },
      floorThroughGeometry: deep.length,
      floorThroughGeometryConfirmed: deep.filter((e) => e.clip).length,
      wallConfirmed: out.wall.filter((e) => String(e.presentAt || '').startsWith('wall:')).length,
      wallGhostCollider: out.wall.filter((e) => e.presentAt === 'nothing there').length,
      wallOtherStorey: out.wall.filter((e) => String(e.presentAt || '').startsWith('other:')).length,
    };
    return out;
  });

  // Classify each wall hit: buried in plaster, poking into an opening, or a
  // collider that has no wall on this storey at all (invisible wall, not a clip).
  audit.wall = (audit.wall || []).map((e) => {
    const p = String(e.presentAt || '');
    let verdict;
    if (p.startsWith('wall:')) verdict = 'CLIP — inside plaster on this storey';
    else if (e.spanWallFrac > 0.1 && p.startsWith('other:')) verdict = 'CLIP — pokes into a door/window opening (only casing is there)';
    else if (e.spanWallFrac > 0.1) verdict = 'CLIP — at an opening, no mesh at the contact point';
    else if (e.wallOnOwnStorey === false) verdict = 'NOT A CLIP — collider with no wall on this storey (invisible wall)';
    else verdict = 'unclassified — inspect manually';
    return { ...e, verdict };
  });
  audit.counts.wallClip = audit.wall.filter((e) => e.verdict.startsWith('CLIP')).length;
  audit.counts.wallGhost = audit.wall.filter((e) => e.verdict.startsWith('NOT A CLIP')).length;

  audit.errors = errors;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(audit, null, 1));

  const c = audit.counts;
  console.log('MANSION CLIP AUDIT');
  console.log('  level footprints     :', audit.stats.footprints, '| region', JSON.stringify(audit.stats.region));
  console.log('  wall segments        :', audit.stats.wallSegments, `(${audit.stats.exteriorWallLines} exterior lines)`);
  console.log('  wall/slab meshes     :', audit.stats.wallMeshes.join(' '), '/', audit.stats.floorMeshes.join(' '));
  console.log('  solid geometry cells :', audit.stats.solidCells);
  console.log('  placed props         :', audit.stats.placedProps, '(no template:', audit.stats.placedWithoutTemplate + ')');
  console.log('  merged prop meshes   :', audit.stats.propMeshes, '/', audit.stats.trianglesScanned, 'triangles');
  console.log('  named units          :', audit.stats.namedUnits, '| landscape', (audit.stats.landscapeNamed || []).join(' '));
  console.log('  instances near house :', audit.stats.instancesNearHouse, 'of', (audit.stats.instanceMeshes || []).join(' '));
  console.log('  ---');
  console.log('  sunk into floor      :', c.floor, '| floating:', c.floating);
  console.log('  floor rest probe     :', JSON.stringify(c.floorProbe));
  console.log('  inside masonry       :', c.wall, `(${c.wallClip} real clips, ${c.wallGhost} ghost colliders)`);
  for (const e of audit.wall) console.log('   *', e.name, e.level, '@', e.x + ',' + e.z, '|', e.verdict, '|', e.presentAt, '| spanWall', e.spanWallFrac);
  console.log('  over openings/voids  :', c.overVoid);
  console.log('  landscape (plants/rocks):', c.landscape);
  console.log('  geometry below floor :', c.floorThroughGeometry, `cells (${c.floorThroughGeometryConfirmed} driven through a real slab)`);
  for (const k of ['floor', 'floating', 'wall', 'overVoid', 'landscape']) {
    if (audit[k].length) console.log(`  >> ${k}: ` + JSON.stringify(audit[k].slice(0, 8), null, 1).replace(/\n\s*/g, ' '));
  }
  if (audit.floorThroughGeometry.length) {
    console.log('  >> geometry below floor detail:');
    for (const e of audit.floorThroughGeometry.slice(0, 12)) console.log('     ', JSON.stringify(e));
  }
  if (errors.length) console.log('  page errors          :', errors.slice(0, 3));
  console.log('written:', OUT);

  await browser.close();
})();