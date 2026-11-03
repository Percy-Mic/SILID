// EXTENSIONS — the parts of the plan that leave the main rectangle.
//
// The house was a 46 x 22 m box: four storeys of straight wall under a single
// flat parapet. From the drive that reads as an institution, not as an
// ancestral mansion. A house of this period was never one box — it grew by
// addition. A drawing room pushed out towards the garden, a breakfast room off
// the dining room, a bay off the sitting room, each addition carrying its own
// roof, so the plan stepped in and out and the skyline broke into separate hips.
//
// Three projecting rooms are described in plan.js (BAYS). They are real rooms:
// they appear in the plan, they are furnished and lit by props.js, and they are
// reached through a cased opening cut in the main wall. What this module builds
// is the part architecture.js cannot: their shell. That is a 0.42 m wall with a
// stone face outside and plaster inside, windows cut right through both leaves,
// a floor, a plastered ceiling, the plinth that carries the stone, a gutter and
// downpipes, and a corrugated-iron hip whose eave dies into the house wall.
//
// Everything is merged: one mesh per material per bay, so three new rooms cost
// a handful of draw calls in total and no new shader.
//
// The windows are registered in architecture.windows rather than dressed here.
// That way the facade's own capiz sashes, persiana shutters and ventanillas are
// the same on a bay as on the elevation, and props.js knows not to stand a
// wardrobe in front of one.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileAtMetres, tileOf } from './materials.js';
import { LEVELS, BAYS } from './plan.js';
import { box } from './primitives.js';
import { buckets, emit, hipRoof } from './facade.js';

const WALL = 0.42;          // exterior wall, same section as the house
const SKIN = 0.20;          // the stone leaf; the rest is plaster
const FOOT = -0.35;         // walls run below the finished floor, into the base
const PL = { h: 1.15, t: 0.34, proud: 0.055 };   // the plinth, as on the house

// Which way each free side faces, and where its wall centre line runs.
function face(b, side) {
  if (side === 'S') return { axis: 'x', c: b.z1 + WALL / 2, out: 1, u0: b.x0, u1: b.x1 };
  if (side === 'N') return { axis: 'x', c: b.z0 - WALL / 2, out: -1, u0: b.x0, u1: b.x1 };
  if (side === 'W') return { axis: 'z', c: b.x0 - WALL / 2, out: -1, u0: b.z0, u1: b.z1 };
  return { axis: 'z', c: b.x1 + WALL / 2, out: 1, u0: b.z0, u1: b.z1 };
}

// A wall slab in the wall's own frame: from `s` to `e` along the wall, from
// `y0` to `y1` up it, at `depth` (a world coordinate on the wall's normal).
// UVs are true metres, so the stone course and the plaster share one scale.
function slab(axis, s, e, y0, y1, depth, thick) {
  const len = e - s, h = y1 - y0;
  if (len <= 0.004 || h <= 0.004) return null;
  // Box UVs at 0.4 units per metre, exactly as architecture.js builds its
  // exterior walls: the bay's stone has to be the SAME size course as the
  // house's, or a 40 cm block next to a 1 m block reads as a different wall.
  const g = axis === 'x' ? box(len, h, thick, 0.4) : box(thick, h, len, 0.4);
  if (axis === 'x') g.translate((s + e) / 2, y0 + h / 2, depth);
  else g.translate(depth, y0 + h / 2, (s + e) / 2);
  return g;
}

function mat(key, tile) {
  const m = materials[key].clone();
  m.name = 'ext' + key;
  if (tile > 0) tileAtMetres(m, tile);
  return m;
}

function merged(geos, meshMat, name, scene, shadows = true) {
  if (!geos.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), meshMat);
  mesh.name = name;
  mesh.receiveShadow = shadows;
  mesh.castShadow = shadows;
  scene.add(mesh);
  return mesh;
}

function seg(arch, axis, c, a, b, y0, y1) {
  if (b - a < 0.02) return;
  arch.colliders.push(axis === 'x'
    ? { x1: a, z1: c, x2: b, z2: c, kind: 'wall', y0, y1 }
    : { x1: c, z1: a, x2: c, z2: b, kind: 'wall', y0, y1 });
}

// --- one projecting room -----------------------------------------------------
function buildBay(scene, arch, b) {
  const level = LEVELS.find((l) => l.id === b.level);
  if (!level) return null;
  const y = level.y;
  const C = b.ceiling;
  const roofEave = C + 0.14;

  const stone = [];      // the outside of the wall and the plinth
  const plaster = [];    // the inside face of the wall
  const trim = [];       // skirting and cornice
  const iron = [];       // gutter and downpipes
  const B = buckets();   // the facade's own buckets: roof, rafters, caps

  // The house side is the face OPPOSITE the direction the bay projects: a bay
  // that projects south has the house on its north face, so that is the one
  // face with no wall of its own.
  const houseSide = b.attach === 'S' ? 'N' : 'S';
  const sides = ['S', 'N', 'W', 'E'].filter((s) => s !== houseSide);
  for (const s of sides) {
    const f = face(b, s);
    const win = b.windows.filter((w) => w.side === s).sort((p, q) => p.at - q.at);
    const holes = win.map((w) => ({ a: w.at - w.w / 2, b: w.at + w.w / 2 }));
    // the exterior stone leaf and the interior plaster leaf, cut with the same
    // apertures, so the reveal through the wall is half dressed stone, half
    // plaster — which is what a 0.42 m wall of this age actually looks like
    const dOut = f.c + f.out * (WALL / 2 - SKIN / 2);
    const dIn = f.c - f.out * (WALL / 2 - (WALL - SKIN) / 2);
    let cur = f.u0;
    const put = (s0, s1, y0, y1) => {
      const a = slab(f.axis, s0, s1, y0, y1, dOut, SKIN);
      if (a) stone.push(a);
      const c = slab(f.axis, s0, s1, y0, y1, dIn, WALL - SKIN);
      if (c) plaster.push(c);
    };
    for (const h of holes) {
      if (h.a > cur + 0.01) put(cur, h.a, FOOT, C);
      put(h.a, h.b, FOOT, b.sill);
      put(h.a, h.b, b.head, C);
      cur = h.b;
    }
    if (cur < f.u1 - 0.01) put(cur, f.u1, FOOT, C);

    // skirting and cornice on the room face of this wall
    const faceOut = f.c + f.out * WALL / 2;
    const sk = slab(f.axis, f.u0, f.u1, y, y + 0.13, faceOut - f.out * 0.012, 0.022);
    if (sk) trim.push(sk);
    const cn = slab(f.axis, f.u0, f.u1, y + C - 0.075, y + C, faceOut - f.out * 0.03, 0.055);
    if (cn) trim.push(cn);

    // plinth: the stone base course carried round the projection
    const pD = faceOut + f.out * (PL.proud + PL.t / 2);
    const p = slab(f.axis, f.u0 - PL.t / 2, f.u1 + PL.t / 2, -0.10, PL.h, pD, PL.t);
    if (p) stone.push(p);
    const capD = faceOut + f.out * (PL.proud + (PL.t + 0.10) / 2);
    const cap = slab(f.axis, f.u0 - PL.t / 2, f.u1 + PL.t / 2, PL.h, PL.h + 0.14, capD, PL.t + 0.10);
    if (cap) B.joinery.push(cap);

    // collider: the wall, full height. The player leans at the glass, he does
    // not walk through it, and a segmented collider per window is not worth the
    // cost on a wall this short.
    seg(arch, f.axis, f.c, f.u0, f.u1, y, y + C);
    // and the plinth's kerb, so the stone base is felt at the ankle outside
    seg(arch, f.axis, faceOut + f.out * PL.proud, f.u0, f.u1, y - 1.2, y + 0.28);

    // the windows themselves: recorded once, dressed by the facade pass so a
    // bay window is the same capiz sash as every other window on the house
    for (const w of win) {
      arch.windows.push({
        level: b.level, axis: f.axis, c: f.c, a: w.at - w.w / 2, b: w.at + w.w / 2,
        sill: b.sill, head: b.head, floorY: y,
        room: b.id, reveal: null,
        // this wall is not on the footprint, so both the dressing and the
        // interior sill are told which way the room lies
        out: f.out, inside: -f.out,
        // the run of wall this window sits in. A bay's face is short, and a
        // persiana leaf folded back needs to know when it would run off the end
        // of it into the air beside the projection.
        u0: f.u0, u1: f.u1,
      });
    }
  }

  // skirting and cornice against the house wall, inside the bay, stopping at
  // the opening. The main wall's own skirting is on the other side of it.
  const m0 = b.mouth.at - b.mouth.w / 2, m1 = b.mouth.at + b.mouth.w / 2;
  const houseFace = b.attach === 'S' ? b.z0 + 0.012 : b.z1 - 0.012;
  for (const [s0, s1] of [[b.x0, m0], [m1, b.x1]]) {
    const a = Math.max(s0, b.x0), z1 = Math.min(s1, b.x1);
    if (z1 - a < 0.12) continue;
    const g = box(z1 - a, 0.13, 0.022, 1);
    g.translate((a + z1) / 2, y + 0.065, houseFace);
    trim.push(g);
  }
  {
    const g = box(b.x1 - b.x0, 0.075, 0.055, 1);
    g.translate((b.x0 + b.x1) / 2, y + C - 0.037, houseFace + (b.attach === 'S' ? 0.028 : -0.028));
    trim.push(g);
  }

  // floor and ceiling. They stop dead on the footprint line: the house's own
  // slab already reaches z = 11, and overlapping it by even a centimetre would
  // z-fight the boards in the doorway.
  const fw = b.x1 - b.x0, fd = b.z1 - b.z0;
  const floorGeo = box(fw, 0.165, fd, 1);
  floorGeo.translate((b.x0 + b.x1) / 2, y - 0.0825, (b.z0 + b.z1) / 2);
  merged([floorGeo], mat(level.floor, tileOf(level.floor)), 'BayFloor_' + b.id, scene, false);

  const ceilGeo = box(fw, 0.10, fd, 1);
  ceilGeo.translate((b.x0 + b.x1) / 2, y + C + 0.05, (b.z0 + b.z1) / 2);
  merged([ceilGeo], mat('wallPlaster', tileOf('wallPlaster')), 'BayCeiling_' + b.id, scene);

  merged(stone, mat('facadeStone', tileOf('facadeStone') * 0.4), 'BayStone_' + b.id, scene);
  merged(plaster, mat(level.wall, tileOf(level.wall)), 'BayPlaster_' + b.id, scene);
  merged(trim, mat('paint', 1), 'BayTrim_' + b.id, scene);

  // --- roof --------------------------------------------------------------
  // A hip, not a lean-to: the projection is a room, and a room carrying a low
  // hipped roof is what makes an addition read as built rather than bolted on.
  // The eave on the house side dies into the house wall: the rectangle handed
  // to hipRoof is inset by the overhang on that side, so its eave lands on
  // z = 11 and not half a metre inside the building.
  const ov = 0.62;
  const xa = b.x0 - WALL, xb = b.x1 + WALL;
  const za = b.attach === 'S' ? b.z0 + ov : b.z0 - WALL;
  const zb = b.attach === 'S' ? b.z1 + WALL : b.z1 - ov;
  // 30 degrees, the pitch of the house's own hips. The ridge has to stay under
  // the first-floor sill (5.05 m): a bay roof that crosses the storey band
  // would cut the windows above it.
  const rise = Math.min(1.35, (b.z1 - b.z0 + WALL) * 0.30);
  B.roof.push(...hipRoof(xa, za, xb, zb, roofEave, rise, ov, B));

  // gutter along the exposed eave and a downpipe at each free corner
  const gutY = roofEave - 0.19;
  const gx0 = xa - ov, gx1 = xb + ov;
  const gz = b.attach === 'S' ? b.z1 + WALL + ov + 0.09 : b.z0 - WALL - ov - 0.09;
  const g1 = box(gx1 - gx0, 0.14, 0.16, 1);
  g1.translate((gx0 + gx1) / 2, gutY, gz);
  iron.push(g1);
  for (const x of [gx0 + 0.06, gx1 - 0.06]) {
    const pipe = new THREE.CylinderGeometry(0.062, 0.062, roofEave - y - 0.4, 8);
    pipe.translate(x, (roofEave + y) / 2 - 0.2, gz);
    iron.push(pipe);
    for (const yy of [1.2, 2.4]) {
      const br = box(0.07, 0.06, 0.26, 1);
      br.translate(x, y + yy, gz - (b.attach === 'S' ? 0.13 : -0.13));
      iron.push(br);
    }
  }

  emit(scene, B);
  merged(iron, mat('ironDark', 1.2), 'BayIron_' + b.id, scene);

  // --- walkability -------------------------------------------------------
  // The bay is a floor of its own outside the footprint: without this entry
  // floorHeightAt() finds no slab under it and the room is a hole in the world.
  arch.extraFloors.push({ kind: 'rect', x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y });
  return { id: b.id, windows: b.windows.length, ceiling: C };
}

export function buildExtensions(scene, arch) {
  const built = [];
  for (const b of BAYS) {
    try {
      const r = buildBay(scene, arch, b);
      if (r) built.push(r);
    } catch (err) {
      // a dressing pass must never take the house down with it
      console.warn('[extensions] ' + b.id + ' did not build:', err?.message || err);
    }
  }
  arch.extensions = built;
  return built;
}
