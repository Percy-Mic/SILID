// FACADE — the outside of the house.
//
// The mansion is planned and walled by architecture.js, and that file's job
// stops at the plaster: a rectangular 46 x 22 m block with four floors of
// punched windows, a flat roof terrace and a low iron cap over the pavilions.
// Indoors that is right. From the road it read as a box, because a building's
// silhouette is decided by three things and the block had none of them: a
// pitched roof, a vertical division of the wall into bays, and a scaled window.
//
// This module builds only what stands OUTSIDE the plaster line — roofs, gables,
// turrets, chimneys, dressings around the openings, a plinth, quoins and a
// corbelled cornice. Nothing here moves a wall, a door, a stair or a collider
// of an interior: every piece is either above the F4 pavilion ceilings
// (y = 14.72), attached to the outer face of a perimeter wall, or embedded in
// the thickness of that wall. That is why the exterior could be rebuilt from
// the reference elevation without touching the plan.
//
// Geometry is merged into one mesh per material, as everywhere else: roofs are
// one draw call, stone dressings one, iron one. The whole elevation costs about
// thirty thousand triangles and eight draw calls.
//
// Reference for the massing: a decayed high-Victorian manor — steep slate
// pitches, gables at every range end, a round tower with a conical cap at the
// corner, a chimney row, and windows taller than they are wide, each under a
// segmental stone arch.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileAtMetres, ivyMaterial, ivyLeafTints as ivyTints } from './materials.js';
import { LEVELS } from './plan.js';
import { box } from './primitives.js';

const TE = 0.42;        // exterior wall thickness, same as architecture.js
const TILE = 2.6;       // metres of facade per texture repeat
const EAVE = 14.72;     // the F4 pavilion ceilings: every roof starts here
const PARA = 11.6;      // parapet base
const RISEPM = 0.95;    // roof rise per metre of half-span: a 43 degree slate
const IVY_TILE = 1.35;  // metres of wall per ivy tile (see materials.ivyTexture)
const OPEN_PAVILIONS = ['FF4-01', 'FF4-03'];  // terrace and observatory stay open

// UVs in metres, so a 2.6 m material tile lands at 2.6 m on the wall. Every
// bucket is merged once, which is what keeps the elevation at a handful of
// draw calls on an integrated GPU.
const g3 = (w, h, d) => box(w, h, d, 1);

// Curved surfaces do not get this for free: a cylinder's UVs run 0..1 round the
// circumference whatever its radius, so a 3 m tower wears one stretched copy of
// the stone map and comes out orange. This rewrites them in metres — u as arc
// length, v as height — so the tower is tiled exactly like the wall beside it.
function uvMetres(g, uMetres, vMetres) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uMetres, uv.getY(i) * vMetres);
  uv.needsUpdate = true;
  return g;
}

// --- buckets ---------------------------------------------------------------
function buckets() {
  return { stone: [], shell: [], damp: [], trim: [], slate: [], iron: [], timber: [], brick: [], dark: [], ivy: [], capiz: [] };
}

function emit(scene, B) {
  const keys = {
    stone: ['facadeStone', 'FacadeStone'],
    // Open cylinders: a turret's shell and its rings are seen from inside the
    // room whose window they cover, so they are drawn from both sides.
    shell: ['facade', 'FacadeShell', true],
    damp: ['facadeDamp', 'FacadeDamp'],
    trim: ['facadeTrim', 'FacadeTrim'],
    // The mansard's slate is hung on the outside of the attic wall and is seen
    // from above, from the roof deck and from the ground around a tower, so it
    // is drawn from both sides.
    slate: ['roofSlate', 'FacadeSlate', true],
    // Brick tiles at its own scale: a stack is 0.9 m square, and a course of
    // bricks laid at the wall's 2.6 m repeat would come out as stones the size
    // of a forearm.
    brick: ['chimneyBrick', 'FacadeBrick', false, 1.15],
    iron: ['ironDark', 'FacadeIron'],
    timber: ['woodDark', 'FacadeTimber'],
    dark: ['glassReady', 'FacadeGlass'],
    // Capiz: translucent shell, warm even when the room behind it is dark. It
    // is its own material rather than the window glass because shell is not
    // glass — it scatters, so it is rough, slightly emissive, and drawn from
    // both faces.
    capiz: ['capizShell', 'FacadeCapiz', true],
    ivy: ['ivyLeaf', 'FacadeIvy', true],
  };
  const made = [];
  for (const [k, geos] of Object.entries(B)) {
    if (!geos.length) continue;
    const [key, name, twoSided, tile] = keys[k];
    const mat = key === 'glassReady'
      ? new THREE.MeshStandardMaterial({
          color: 0x11181a, roughness: 0.18, metalness: 0.2,
          emissive: 0x120b04, emissiveIntensity: 0.35, side: THREE.DoubleSide,
        })
      : key === 'capizShell'
      ? new THREE.MeshStandardMaterial({
          color: 0xd9c8a4, roughness: 0.52, metalness: 0.0,
          emissive: 0x2c1e0c, emissiveIntensity: 0.30,
          transparent: true, opacity: 0.92, side: THREE.DoubleSide,
        })
      // The ivy wears the wind program, which lives on the original material:
      // a clone would drop onBeforeCompile and the whole house's foliage would
      // stand still. It is used by this mesh alone, so its map may be tiled
      // in place.
      : key === 'ivyLeaf'
        ? tileAtMetres(ivyMaterial(), IVY_TILE)
        : tileAtMetres(materials[key].clone(), tile || TILE);
    if (twoSided) mat.side = THREE.DoubleSide;
    // Extrusions, cylinders and boxes do not agree on indexing, and a merge
    // across mixed geometries fails outright: normalise to non-indexed first.
    const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const mesh = new THREE.Mesh(mergeGeometries(flat), mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
    made.push(name + ':' + geos.length);
  }
  return made;
}

// A wall runs along `axis` at line `c`; `out` is the sign of the outward
// normal. Local space is (u along the wall, v up, w out of the wall), with the
// plaster face at w = 0. Rotation, never mirroring, so windings stay valid.
function placeOnWall(g, axis, c, out) {
  if (axis === 'x') {
    if (out < 0) g.rotateY(Math.PI);
    g.translate(0, 0, c + out * (TE / 2));
  } else {
    g.rotateY(out > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(c + out * (TE / 2), 0, 0);
  }
  return g;
}

// ...and then along the wall to its station. placeOnWall only puts a piece on
// the wall line; `u` is the world coordinate measured along that wall (x on an
// x-wall, z on a z-wall). Window surrounds were built without this and the
// whole elevation's worth stacked into one ring at the wall centre — which is
// how a pair of stone jambs and a sill came to stand in the middle of the
// entrance doors.
function slideOnWall(g, axis, u) {
  if (axis === 'x') g.translate(u, 0, 0); else g.translate(0, 0, u);
  return g;
}

// Which way is out? A window is recorded on a footprint edge, so the outward
// normal is whichever of the four edges the window's line lies on.
function outward(level, axis, c) {
  const fp = level.footprint;
  if (axis === 'x') return c <= (fp.z0 + fp.z1) / 2 ? -1 : 1;
  return c <= (fp.x0 + fp.x1) / 2 ? -1 : 1;
}

// --- 1. plinth --------------------------------------------------------------
// A stone base course. Without it the plaster meets the ground in a straight
// line, which is the single strongest tell of a wall that was extruded rather
// than built: every real building of this period sits on a wider, darker base.
// The base course is cut at every door that opens to the outside. It is a
// 10 cm step, which is right under a wall and wrong under a threshold: with a
// continuous collider across the front door the house could not be entered at
// all, and the same on the west service door. Each opening gets a threshold
// slab instead.
function spansBetween(a, b, holes) {
  const out = [];
  let cur = a;
  for (const [h0, h1] of holes.slice().sort((p, q) => p[0] - q[0])) {
    if (h1 <= cur) continue;
    if (h0 > cur) out.push([cur, Math.min(h0, b)]);
    cur = Math.max(cur, h1);
    if (cur >= b) break;
  }
  if (cur < b) out.push([cur, b]);
  return out.filter(([s, e]) => e - s > 0.05);
}

function plinth(B, gf) {
  const fp = gf.footprint;
  const w = fp.x1 - fp.x0, d = fp.z1 - fp.z0;
  const t = 0.34, top = 0.10, h = 1.15;
  const y = top - h / 2;
  const faces = [
    ['x', fp.z1, w + 0.7, fp.x0 - 0.35, fp.x1 + 0.35],
    ['x', fp.z0, w + 0.7, fp.x0 - 0.35, fp.x1 + 0.35],
    ['z', fp.x1, d + 0.7, fp.z0 - 0.35, fp.z1 + 0.35],
    ['z', fp.x0, d + 0.7, fp.z0 - 0.35, fp.z1 + 0.35],
  ];
  const colliders = [];
  for (const [axis, line, , a, b] of faces) {
    const out = outward(gf, axis, line);
    // every door on this wall is a hole in the base course
    const holes = gf.doors
      .filter((dr) => dr.axis === axis && Math.abs(dr.c - line) < 0.02)
      .map((dr) => [dr.at - dr.w / 2 - 0.45, dr.at + dr.w / 2 + 0.45]);
    for (const [s, e] of spansBetween(a, b, holes)) {
      const len = e - s, mid = (s + e) / 2;
      const dep = t, off = TE / 2 + dep / 2 - 0.02;
      const g = axis === 'x' ? g3(len, h, dep) : g3(dep, h, len);
      if (axis === 'x') g.translate(mid, y, line + out * off);
      else g.translate(line + out * off, y, mid);
      B.damp.push(g);
      // a chamfer course on top of the base, the shadow line of the plinth
      const cdep = dep + 0.10, coff = TE / 2 + cdep / 2 - 0.02;
      const c = axis === 'x' ? g3(len, 0.16, cdep) : g3(cdep, 0.16, len);
      if (axis === 'x') c.translate(mid, top - 0.02, line + out * coff);
      else c.translate(line + out * coff, top - 0.02, mid);
      B.trim.push(c);
      colliders.push(axis === 'x'
        ? { x1: s, z1: line + out * (TE / 2 + 0.02), x2: e, z2: line + out * (TE / 2 + 0.02), y0: -1.2, y1: 0.28 }
        : { x1: line + out * (TE / 2 + 0.02), z1: s, x2: line + out * (TE / 2 + 0.02), z2: e, y0: -1.2, y1: 0.28 });
    }
    // thresholds: a flat slab across each opening, level with the floor
    for (const [h0, h1] of holes) {
      const w0 = Math.max(h0, a), w1 = Math.min(h1, b);
      if (w1 - w0 < 0.1) continue;
      const len = w1 - w0, mid = (w0 + w1) / 2;
      const g = axis === 'x' ? g3(len, 0.14, 0.70) : g3(0.70, 0.14, len);
      if (axis === 'x') g.translate(mid, -0.03, line + out * 0.20);
      else g.translate(line + out * 0.20, -0.03, mid);
      B.trim.push(g);
    }
  }
  return colliders;
}

// --- 2. quoins --------------------------------------------------------------
// Dress the four corners with alternate stones. A corner is where the eye
// checks whether a wall has depth, and a bare plaster arris always reads flat.
function quoins(B) {
  const fp = LEVELS.find((l) => l.id === 'GF').footprint;
  for (const [x, z] of [[fp.x0, fp.z0], [fp.x0, fp.z1], [fp.x1, fp.z0], [fp.x1, fp.z1]]) {
    const sx = x === fp.x0 ? -1 : 1, sz = z === fp.z0 ? -1 : 1;
    for (let i = 0; i < 19; i++) {
      const y = -0.10 + i * 0.62;
      if (y > PARA) break;
      const g = g3(0.74, 0.44, 0.74);
      g.translate(x + sx * 0.13, y, z + sz * 0.13);
      B.stone.push(g);
    }
  }
}

// --- 3. corbelled cornice under the parapet --------------------------------
// The strong horizontal the reference has at the top of the wall: a moulding
// carried on brackets. It is also what makes the parapet read as a parapet
// rather than as the top edge of a slab.
function corbels(B) {
  const fp = LEVELS.find((l) => l.id === 'GF').footprint;
  const w = fp.x1 - fp.x0, d = fp.z1 - fp.z0;
  // continuous moulding
  for (const [axis, line, mid, len] of [
    ['x', fp.z1, (fp.x0 + fp.x1) / 2, w + 0.6],
    ['x', fp.z0, (fp.x0 + fp.x1) / 2, w + 0.6],
    ['z', fp.x1, (fp.z0 + fp.z1) / 2, d + 0.6],
    ['z', fp.x0, (fp.z0 + fp.z1) / 2, d + 0.6],
  ]) {
    const out = outward({ footprint: fp }, axis, line);
    const dep = 0.62;
    const g = axis === 'x' ? g3(len, 0.22, dep) : g3(dep, 0.22, len);
    const off = TE / 2 + dep / 2 - 0.06;
    if (axis === 'x') g.translate(mid, 11.50, line + out * off);
    else g.translate(line + out * off, 11.50, mid);
    B.trim.push(g);
    // the brackets under it
    const n = Math.max(2, Math.round(len / 0.92));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len * i) / n;
      const bd = 0.46;
      const b = axis === 'x' ? g3(0.28, 0.40, bd) : g3(bd, 0.40, 0.28);
      const boff = TE / 2 + bd / 2 - 0.10;
      if (axis === 'x') b.translate(mid + t, 11.19, line + out * boff);
      else b.translate(line + out * boff, 11.19, mid + t);
      B.trim.push(b);
    }
  }
}

// --- 4. the openings --------------------------------------------------------
// Windows and doors, dressed from the outside: jambs, a moulded sill, a
// filled spandrel over the head and a segmental hood mould on top of it. The
// cut in the wall stays rectangular — it is the frame around it that is arched,
// exactly as it was done in rubble masonry: the arch carries the wall above the
// opening's lintel.
function archProfile(width, rise) {
  // circle through (+-width/2, 0) with crown at (0, rise)
  const R = (width * width / 4 + rise * rise) / (2 * rise);
  const cy = rise - R;
  const half = Math.asin(Math.min(1, (width / 2) / R));
  return { R, cy, half };
}

function archTympanum(width, rise) {
  const { R, cy, half } = archProfile(width, rise);
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const a = -half + (2 * half * i) / N;   // measured from the vertical
    s.lineTo(R * Math.sin(a), cy + R * Math.cos(a));
  }
  s.lineTo(width / 2, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 3 });
}

function archHood(width, rise, depth = 0.22, band = 0.19) {
  const { R, cy, half } = archProfile(width, rise);
  const s = new THREE.Shape();
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = -half + (2 * half * i) / N;
    s.lineTo((R + band) * Math.sin(a), cy + (R + band) * Math.cos(a));
  }
  for (let i = N; i >= 0; i--) {
    const a = -half + (2 * half * i) / N;
    s.lineTo(R * Math.sin(a), cy + R * Math.cos(a));
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 3 });
  return g;
}

function dressing(win, level, B) {
  const width = win.b - win.a;
  const h = win.head - win.sill;
  const y0 = win.floorY;  const axis = win.axis;
  const c = win.c;
  const u = (win.a + win.b) / 2;
  const out = outward(level, axis, c);

  // jambs: a dressed stone on each side, standing proud of the plaster
  for (const s of [-1, 1]) {
    const g = g3(0.22, h + 0.14, 0.24);
    g.translate(s * (width / 2 + 0.08), y0 + win.sill + h / 2, 0.06);
    placeOnWall(g, axis, c, out);
    slideOnWall(g, axis, u);
    B.trim.push(g);
  }
  // sill: a slab with a drip under it
  const sill = g3(width + 0.56, 0.12, 0.40);
  sill.translate(0, y0 + win.sill - 0.05, 0.14);
  placeOnWall(sill, axis, c, out);
  slideOnWall(sill, axis, u);
  B.trim.push(sill);
  const drip = g3(width + 0.34, 0.06, 0.20);
  drip.translate(0, y0 + win.sill - 0.15, 0.12);
  placeOnWall(drip, axis, c, out);
  slideOnWall(drip, axis, u);
  B.trim.push(drip);

  // the arch: a filled spandrel under a projecting hood
  const rise = Math.min(0.28, h * 0.16);
  const tym = archTympanum(width + 0.10, rise);
  tym.translate(0, y0 + win.head, -0.06);
  placeOnWall(tym, axis, c, out);
  slideOnWall(tym, axis, u);
  B.stone.push(tym);


  const hood = archHood(width + 0.10, rise);
  hood.translate(0, y0 + win.head, -0.02);
  placeOnWall(hood, axis, c, out);
  slideOnWall(hood, axis, u);
  B.trim.push(hood);

  const key = g3(0.26, 0.34, 0.30);
  key.translate(0, y0 + win.head + rise - 0.02, 0.15);
  placeOnWall(key, axis, c, out);
  slideOnWall(key, axis, u);
  B.trim.push(key);
}

function entrancePortal(arch, B) {
  const level = LEVELS.find((l) => l.id === 'GF');
  const fp = level.footprint;
  const out = 1;                          // the entrance is on the south face
  const c = fp.z1;
  const W = 2.2, H = 2.15;
  for (const s of [-1, 1]) {
    const g = g3(0.48, H + 0.9, 0.40);
    g.translate(s * (W / 2 + 0.24), (H + 0.9) / 2, 0.14);
    placeOnWall(g, 'x', c, out);
    B.trim.push(g);
    const base = g3(0.62, 0.22, 0.52);
    base.translate(s * (W / 2 + 0.24), 0.11, 0.20);
    placeOnWall(base, 'x', c, out);
    B.trim.push(base);
  }
  const lintel = g3(W + 1.5, 0.42, 0.36);
  lintel.translate(0, H + 0.21, 0.12);
  placeOnWall(lintel, 'x', c, out);
  B.trim.push(lintel);
  const hood = archHood(W + 1.5, 0.52, 0.26, 0.22);
  hood.translate(0, H + 0.42, -0.02);
  placeOnWall(hood, 'x', c, out);
  B.trim.push(hood);
  const key = g3(0.44, 0.60, 0.34);
  key.translate(0, H + 0.92, 0.16);
  placeOnWall(key, 'x', c, out);
  B.trim.push(key);
  return out;
}

// --- 5. the porch -----------------------------------------------------------
// architecture.js raises four 0.28 m posts and a flat iron slab. Thin timber
// posts under a big house read as scaffolding, so each post is encased in a
// stone pier with a base and a moulded cap, and the slab gets a cornice edge.
function porch(B) {
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    const pier = g3(0.48, 3.20, 0.48);
    pier.translate(x, 1.60, 13.4);
    B.trim.push(pier);
    const base = g3(0.62, 0.22, 0.62);
    base.translate(x, 0.11, 13.4);
    B.trim.push(base);
    const cap = g3(0.64, 0.16, 0.64);
    cap.translate(x, 3.12, 13.4);
    B.trim.push(cap);
  }
  // cornice framing the porch slab (10.4 x 4.4 at y 3.25)
  const edges = [
    [10.9, 0.22, 0.34, 0, 15.40], [10.9, 0.22, 0.34, 0, 11.00],
    [0.34, 0.22, 4.9, -5.35, 13.2], [0.34, 0.22, 4.9, 5.35, 13.2],
  ];
  for (const [w, h, d, x, z] of edges) {
    const g = g3(w, h, d);
    g.translate(x, 3.13, z);
    B.trim.push(g);
  }
}

// --- 6. pitched roofs over the pavilions -----------------------------------
// The form the house never had. Each roofed pavilion gets a gabled slate roof
// at a real pitch, with its gable ends built as masonry triangles, rake boards
// along the rakes and a finial at each ridge end. The terrace and the
// observatory keep their open sky.

function rangeRoof(room, B) {
  const x0 = room.x0, x1 = room.x1, z0 = room.z0, z1 = room.z1;
  const w = x1 - x0, d = z1 - z0;
  const alongX = w >= d;
  const half = (alongX ? d : w) / 2;
  // A 46 m range with a 22 m span gives half = 11, and 11 x 0.95 was a 10.4 m
  // rise: the pavilion roofs stood 5.6 m above the mansard as pale masonry
  // pyramids, which is what read as unfinished slabs hanging over the roofline.
  // Real attic roofs over a range are an attic storey tall, not a spire, so the
  // rise is capped and the pitch follows the cap.
  const rise = Math.min(4.2, Math.max(1.35, half * RISEPM));
  const gx = 0.55, gz = 0.62;            // eave overhangs
  const yEave = EAVE;
  const cy = yEave + rise;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const pitch = Math.atan2(rise, half);
  const slopeLen = Math.hypot(half + gz, rise);

  const pos = [], uv = [];
  const v = (x, y, z, u, s) => { pos.push(x, y, z); uv.push(u / TILE, s / TILE); return pos.length / 3 - 1; };
  const tri = (a, b, c) => pos.push(a, b, c);

  if (alongX) {
    const xa = x0 - gx, xb = x1 + gx, za = z0 - gz, zb = z1 + gz;
    const A = [xa, yEave, za], Bv = [xb, yEave, za], C = [xb, yEave, zb], D = [xa, yEave, zb];
    const R0 = [xa, cy, cz], R1 = [xb, cy, cz];
    // south slope
    const a = v(...D, 0, 0), b = v(...C, w + 2 * gx, 0), c = v(...R1, w + 2 * gx, slopeLen), e = v(...R0, 0, slopeLen);
    tri(a, b, c); tri(a, c, e);
    // north slope
    const f = v(...Bv, 0, 0), g2 = v(...A, w + 2 * gx, 0), hh = v(...R0, w + 2 * gx, slopeLen), i = v(...R1, 0, slopeLen);
    tri(f, g2, hh); tri(f, hh, i);
    // gable end walls: a masonry triangle at each end of the range, standing
    // inside the room's own limits so the roof overhangs it on every side
    for (const [xx, xw] of [[x0, x0 + 0.34], [x1 - 0.34, x1]]) {
      const s = new THREE.Shape();
      s.moveTo(za, yEave); s.lineTo(zb, yEave); s.lineTo(cz, cy); s.closePath();
      const ge = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false });
      ge.rotateY(-Math.PI / 2);          // shape (z, y) -> world (x, y, z)
      ge.translate(xw, 0, 0);
      B.stone.push(ge);
      // rake boards, one to a side, leaning along the pitch of the slope above
      for (const [zf, dz] of [[z0, 1], [z1, -1]]) {
        const rb = g3(0.14, 0.30, Math.hypot(half + gz, rise) + 0.16);
        rb.rotateX(dz > 0 ? -pitch : pitch);
        rb.translate((xx + xw) / 2, (yEave + cy) / 2, (zf + cz) / 2);
        B.trim.push(rb);
      }
      // finial at the ridge end
      const stem = new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6);
      stem.translate((xx + xw) / 2, cy + 0.55, cz);
      B.iron.push(stem);
      const ball = new THREE.SphereGeometry(0.11, 8, 6);
      ball.translate((xx + xw) / 2, cy + 1.12, cz);
      B.iron.push(ball);
    }
  } else {
    const za = z0 - gx, zb = z1 + gx, xa = x0 - gz, xb = x1 + gz;
    const A = [xa, yEave, za], Bv = [xb, yEave, za], C = [xb, yEave, zb], D = [xa, yEave, zb];
    const R0 = [cx, cy, za], R1 = [cx, cy, zb];
    const a = v(...A, 0, 0), b = v(...D, d + 2 * gx, 0), c = v(...R1, d + 2 * gx, slopeLen), e = v(...R0, 0, slopeLen);
    tri(a, b, c); tri(a, c, e);
    const f = v(...C, 0, 0), g2 = v(...Bv, d + 2 * gx, 0), hh = v(...R0, d + 2 * gx, slopeLen), i = v(...R1, 0, slopeLen);
    tri(f, g2, hh); tri(f, hh, i);
    for (const [zf, zw] of [[z0, z0 + 0.34], [z1 - 0.34, z1]]) {
      const s = new THREE.Shape();
      s.moveTo(xa, yEave); s.lineTo(xb, yEave); s.lineTo(cx, cy); s.closePath();
      const ge = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false });
      ge.translate(0, 0, zw);
      B.stone.push(ge);
      for (const [xf, dx] of [[x0, -1], [x1, 1]]) {
        const rb = g3(0.13, 0.30, Math.hypot(half + gz, rise) + 0.16);
        rb.rotateY(Math.PI / 2);
        // the rake rises from the eave foot to the apex, so the bar leans the
        // other way on the far side
        rb.rotateZ(dx < 0 ? pitch : Math.PI - pitch);
        rb.translate((xf + cx) / 2, (yEave + cy) / 2, (zf + zw) / 2);
        B.trim.push(rb);
      }
      const stem = new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6);
      stem.translate(cx, cy + 0.55, (zf + zw) / 2);
      B.iron.push(stem);
      const ball = new THREE.SphereGeometry(0.11, 8, 6);
      ball.translate(cx, cy + 1.12, (zf + zw) / 2);
      B.iron.push(ball);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  // every roof triangle must face up: a slope lit from underneath is the one
  // sign error that turns a roof into a black hole
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const wx = pos[i + 6] - pos[i], wy = pos[i + 7] - pos[i + 1], wz = pos[i + 8] - pos[i + 2];
    const ny = uz * wx - ux * wz;      // y component of u x w
    if (ny < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
      }
    }
  }
  geo.computeVertexNormals();

  // ridge cap in iron, the way a slate ridge is finished
  const capLen = (alongX ? w : d) + 1.1;
  const cap = alongX ? g3(capLen, 0.12, 0.30) : g3(0.30, 0.12, capLen);
  if (alongX) cap.translate(cx, cy + 0.04, cz);
  else cap.translate(cx, cy + 0.04, cz);
  B.iron.push(cap);

  return { geometry: geo, ridgeY: cy, pitch, alongX, half, cx, cz };
}

// --- 6b. pilasters ---------------------------------------------------------
// The vertical half of the elevation. A facade with a good window rhythm still
// reads as a wall with holes punched in it until something divides it into
// bays: these are the strips of wall between the openings, carried the full
// height from the plinth to the cornice and standing a hand's width proud. They
// land midway between the windows, and never in front of a door.
function pilasters(B, arch, gf) {
  const edge = (l) => [
    ['x', l.footprint.z1], ['x', l.footprint.z0],
    ['z', l.footprint.x0], ['z', l.footprint.x1],
  ];
  for (const [axis, line] of edge(gf)) {
    const out = outward(gf, axis, line);
    const a = axis === 'x' ? gf.footprint.x0 : gf.footprint.z0;
    const b = axis === 'x' ? gf.footprint.x1 : gf.footprint.z1;
    const ws = arch.windows
      .filter((w) => w.level === 'GF' && w.axis === axis && Math.abs(w.c - line) < 0.02)
      .map((w) => (w.a + w.b) / 2)
      .sort((p, q) => p - q);
    if (ws.length < 2) continue;
    const doors = gf.doors
      .filter((d) => d.axis === axis && Math.abs(d.c - line) < 0.02)
      .map((d) => [d.at - d.w / 2 - 1.0, d.at + d.w / 2 + 1.0]);
    // ONE PIER AT EACH END, not one between every pair of windows. Eleven
    // full-height shafts per facade, all built in the lighter stone, is what
    // turned the elevation into a vertical stripe pattern from the road — the
    // mirror image of the horizontal bands this pass was meant to remove. The
    // reference's wall is plain between its windows; its vertical rhythm is the
    // stacks of openings themselves. The end piers stay because they are corner
    // boards, which is what stops a masonry wall ending in a raw arris.
    const spots = [a + 0.44, b - 0.44];
    for (const at of spots) {
      if (at < a + 0.8 || at > b - 0.8) continue;
      if (doors.some(([d0, d1]) => at > d0 && at < d1)) continue;
      const H = 11.55;
      // `at` is measured along the wall, and placeOnWall only turns the piece
      // onto the wall line. Every pilaster was therefore built at u = 0: the
      // whole elevation's worth stacked into one shaft, and on the south face
      // that shaft stood directly over the entrance doors. The pitch of the
      // bays only appears once the piece is slid to its own station.
      const shaft = g3(0.46, H, 0.16);
      shaft.translate(0, H / 2, TE / 2 + 0.08);
      placeOnWall(shaft, axis, line, out);
      if (axis === 'x') shaft.translate(at, 0, 0); else shaft.translate(0, 0, at);
      B.stone.push(shaft);
      const base = g3(0.72, 0.46, 0.42);
      base.translate(0, 0.20, TE / 2 + 0.21);
      placeOnWall(base, axis, line, out);
      if (axis === 'x') base.translate(at, 0, 0); else base.translate(0, 0, at);
      B.trim.push(base);
      const cap = g3(0.72, 0.24, 0.40);
      cap.translate(0, H - 0.10, TE / 2 + 0.20);
      placeOnWall(cap, axis, line, out);
      if (axis === 'x') cap.translate(at, 0, 0); else cap.translate(0, 0, at);
      B.trim.push(cap);
    }
  }
}

// --- 7. the front gable ----------------------------------------------------
// The façade's focal point: a wide gable carried on the parapet above the
// entrance bay, with a blind arch in its face. It stands clear of the first
// floor balcony (its rail tops out at 8.96) and of the terrace behind it.
function frontGable(B, arch) {
  const fp = LEVELS.find((l) => l.id === 'GF').footprint;
  const zLine = fp.z1;
  // The front gable spans the full F4 south-window band at the top of the
  // triangle; the previous 9.4 m width pinched across the east jambs of the
  // centre-right upper windows. 10.6 m clears those openings while keeping
  // the same apex, so every opening cut below remains wholly within masonry.
  // A roof dormer, not a cathedral front. The old triangle rose 9 m above the
  // parapet to y = 20.6 and was the single largest shape on the building. The
  // reference's central attic feature is a wide, low gable that sits IN the
  // slate, roughly a storey tall above the eave.
  // SHOULDERED, NOT A BARE TRIANGLE. A pure triangle is widest at its base,
  // which here is below the F4 sills, and narrows to nothing at the apex — so
  // every F4 window under it was either fully contained (wide enough at the
  // head) or not cut at all, and the masonry then sat as a second wall 14 cm in
  // front of the glass. Solving the width for one window only widened the
  // triangle into its neighbour. The face is therefore given vertical cheeks up
  // to the window heads and the rake above them, which is how a Victorian attic
  // gable is actually built: a rectangular dormer front under a gable roof. Both
  // flanking attic windows are then wholly inside the face and get a real hole.
  const apex = 16.6, base = 11.5, shoulder = 14.5, W = 8.3;
  const frontWins = arch.windows.filter((v) =>
    v.level === 'F4' && v.axis === 'x' && Math.abs(v.c - zLine) <= 0.03);
  const s = new THREE.Shape();
  s.moveTo(-W / 2, base);
  s.lineTo(W / 2, base);
  s.lineTo(W / 2, shoulder);
  s.lineTo(0, apex);
  s.lineTo(-W / 2, shoulder);
  s.closePath();
  const pierced = [];
  for (const win of frontWins) {
    const y0 = win.floorY + win.sill, y1 = win.floorY + win.head;
    if (y0 < base + 0.05 || y1 > shoulder - 0.05) continue;
    if (Math.max(Math.abs(win.a), Math.abs(win.b)) > W / 2 - 0.12) continue;
    const hole = new THREE.Path();
    hole.moveTo(win.a, y0);
    hole.lineTo(win.b, y0);
    hole.lineTo(win.b, y1);
    hole.lineTo(win.a, y1);
    hole.closePath();
    s.holes.push(hole);
    pierced.push({ win, y0, y1 });
  }
  // Shape holes make actual through-apertures across the gable's full masonry
  // depth; the perimeter wall supplies the same opening-aware collision.
  const g = new THREE.ExtrudeGeometry(s, { depth: TE, bevelEnabled: false });
  g.translate(0, 0, zLine - TE / 2);
  B.stone.push(g);

  // The pierced openings get their own stone casing, because the attic windows
  // in the gable band are deliberately skipped by the per-window dressing (they
  // would otherwise be a surround inside a dormer reveal). Face is at
  // zLine + TE/2; casing stands 0.10 proud of it.
  const face = zLine + TE / 2;
  for (const { win, y0, y1 } of pierced) {
    for (const s2 of [-1, 1]) {
      const jamb = g3(0.16, y1 - y0 + 0.30, 0.20);
      jamb.translate(s2 > 0 ? win.b + 0.10 : win.a - 0.10, (y0 + y1) / 2, face + 0.02);
      B.trim.push(jamb);
    }
    const head = g3(win.b - win.a + 0.55, 0.24, 0.30);
    head.translate((win.a + win.b) / 2, y1 + 0.14, face + 0.05);
    B.trim.push(head);
    const hood = archHood(win.b - win.a + 0.70, 0.26, 0.22, 0.17);
    hood.translate((win.a + win.b) / 2, y1 + 0.26, face + 0.02);
    B.trim.push(hood);
    const sill = g3(win.b - win.a + 0.62, 0.14, 0.42);
    sill.translate((win.a + win.b) / 2, y0 - 0.09, face + 0.06);
    B.trim.push(sill);
  }

  // coping along the two rakes, and a finial at the apex
  const rake = Math.hypot(W / 2, apex - shoulder);
  const ang = Math.atan2(apex - shoulder, W / 2);
  for (const s2 of [-1, 1]) {
    const b = g3(rake + 0.1, 0.26, 0.56);
    b.rotateZ(s2 * -ang);
    b.translate(s2 * (W / 4 + 0.04), (shoulder + apex) / 2 + 0.10, zLine);
    B.trim.push(b);
  }
  // level coping along the shoulders, which is what the vertical cheeks of a
  // dormer front carry before the rake starts
  for (const s2 of [-1, 1]) {
    const cap = g3(0.9, 0.16, 0.42);
    cap.translate(s2 * (W / 2 + 0.30), shoulder + 0.06, zLine);
    B.trim.push(cap);
  }
  const stem = new THREE.CylinderGeometry(0.042, 0.042, 1.05, 8);
  stem.translate(0, apex + 0.48, zLine);
  B.iron.push(stem);
  const ball = new THREE.SphereGeometry(0.10, 8, 6);
  ball.translate(0, apex + 1.00, zLine);
  B.iron.push(ball);

  // corbel course under the gable, tying it into the parapet
  for (let i = -4; i <= 4; i++) {
    const b = g3(0.42, 0.34, 0.36);
    b.translate(i * 0.88, 11.26, zLine + 0.26);
    B.trim.push(b);
  }
  // shoulders: the small raking pieces at the gable's feet, which is what
  // stops a gable looking like a triangle laid on a wall
  for (const s2 of [-1, 1]) {
    const sh = g3(1.5, 0.42, 0.62);
    sh.rotateZ(s2 * -0.42);
    sh.translate(s2 * (W / 2 + 0.6), 11.9, zLine + 0.02);
    B.trim.push(sh);
  }
}

// --- 8. turrets -------------------------------------------------------------
// A round tower on a conical cap. The half-cylinder is hung on the outer face
// of a perimeter wall, so no part of it enters a room; the collider is a
// polyline of short segments around the bulge, because the player has to be
// able to walk around it without passing through it.
function turret(B, opts) {
  const { line, axis, at, out, r, y0, y1, coneH, baseCourse } = opts;
  const theta = axis === 'x'
    ? (out > 0 ? -Math.PI / 2 : Math.PI / 2)
    : (out > 0 ? 0 : Math.PI);
  const wallFace = line + out * (TE / 2);
  const shell = new THREE.CylinderGeometry(r, r, y1 - y0, 22, 1, true, theta, Math.PI);
  uvMetres(shell, Math.PI * r, y1 - y0);
  // CylinderGeometry is centred on y: move to the wall face and up
  const cx = axis === 'x' ? at : wallFace;
  const cz = axis === 'x' ? wallFace : at;
  shell.translate(cx, (y0 + y1) / 2, cz);
  B.shell.push(shell);
  // A single stone base course under the bulb, only on the tower that shows its
  // footing from the drive, so the meeting-with-ground reads like built masonry
  // instead of a cylinder sitting on dirt.
  if (baseCourse) {
    const skir = new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.9, 22, 1, true, theta, Math.PI);
    uvMetres(skir, Math.PI * (r + 0.05), 0.9);
    skir.translate(cx, -0.45, cz);
    B.shell.push(skir);
    const base = new THREE.CylinderGeometry(r + 0.10, r + 0.10, 0.22, 22);
    uvMetres(base, Math.PI * (r + 0.10), 0.22);
    base.translate(cx, -0.86, cz);
    B.trim.push(base);
  }
  // base batter
  const skirt = new THREE.CylinderGeometry(r + 0.22, r + 0.34, 1.3, 22, 1, true, theta, Math.PI);
  uvMetres(skirt, Math.PI * r, 1.3);
  skirt.translate(cx, y0 + 0.65, cz);
  B.shell.push(skirt);
  // string band and a corbel ring carrying the cap
  for (const [yy, rr, h] of [[y1 - 0.42, r + 0.30, 0.34], [y1 - 1.1, r + 0.16, 0.18]]) {
    const ring = new THREE.CylinderGeometry(rr, rr, h, 22, 1, true, theta, Math.PI);
    uvMetres(ring, Math.PI * rr, 0.5);
    ring.translate(cx, yy, cz);
    B.shell.push(ring);
  }
  const n = 13;
  for (let i = 0; i <= n; i++) {
    const a = theta + (Math.PI * i) / n;
    const bx = cx + Math.sin(a) * (r + 0.18);
    const bz = cz + Math.cos(a) * (r + 0.18);
    const b = g3(0.26, 0.34, 0.26);
    b.translate(bx, y1 - 0.62, bz);
    B.trim.push(b);
  }
  // conical cap + finial
  const cone = new THREE.ConeGeometry(r + 0.34, coneH, 22);
  uvMetres(cone, 2 * Math.PI * (r + 0.34), Math.hypot(r + 0.34, coneH));
  cone.translate(cx, y1 + coneH / 2, cz);
  B.slate.push(cone);
  const stem = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8);
  stem.translate(cx, y1 + coneH + 0.7, cz);
  B.iron.push(stem);
  const ball = new THREE.SphereGeometry(0.14, 8, 6);
  ball.translate(cx, y1 + coneH + 1.45, cz);
  B.iron.push(ball);

  // The tower is a residential corner bay, not a keep: three narrow sashed
  // windows with timber surrounds instead of the arrow slits that made the
  // whole elevation read as a fortress. They sit on the outward face only, so
  // nothing is punched into a room behind the tower.
  const oa = axis === 'x' ? (out > 0 ? 0 : Math.PI) : (out > 0 ? Math.PI / 2 : -Math.PI / 2);
  const faceOut = (u, y, w, h) => {
    const g = g3(w, h, 0.10);
    g.rotateY(oa);
    g.translate(cx + Math.sin(oa) * (r - 0.04), y, cz + Math.cos(oa) * (r - 0.04));
    return g;
  };
  for (const yy of [2.6, 6.4, 10.2]) {
    if (yy > y1 - 2.0) break;
    B.dark.push(faceOut(0, yy + 0.85, 0.62, 1.55));
    for (const s of [-1, 1]) {
      const jamb = faceOut(s * 0.38, yy + 0.85, 0.14, 1.85);
      jamb.translate(0, 0, 0);
      B.timber.push(jamb);
    }
    const head = faceOut(0, yy + 1.76, 0.92, 0.12);
    B.timber.push(head);
    const sill = faceOut(0, yy + 0.02, 0.92, 0.10);
    B.timber.push(sill);
  }

  // colliders around the bulge
  const segs = [];
  const steps = 7;
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const a = theta + (Math.PI * i) / steps;
    const px = cx + Math.sin(a) * (r + 0.3);
    const pz = cz + Math.cos(a) * (r + 0.3);
    if (prev) {
      segs.push({ x1: prev[0], z1: prev[1], x2: px, z2: pz, kind: 'wall', y0: -1.2, y1: 2.2 });
    }
    prev = [px, pz];
  }
  return segs;
}

// --- 9. chimneys ------------------------------------------------------------
// The row of stacks that finishes the silhouette. Each one is corbelled out of
// the parapet, which is where chimneys on a house of this period actually rise,
// and it stays inside the wall's own thickness so no room is touched.
function chimney(B, { axis, line, at, out }) {
  // Stack height and girth, cut down to a residential flue. At y = 22.3 and
  // 0.92 m square these read as industrial piers marching along the roof; the
  // reference has a handful of brick stacks that clear the ridge by a metre or
  // two and belong to the fireplaces below them.
  const y0 = 11.30, yTop = 19.9;
  const shaftW = 0.74, shaftD = 0.60;
  const off = TE / 2 + shaftD / 2 - 0.30;
  const put = (g) => {
    if (axis === 'x') g.translate(at, 0, line + out * off);
    else g.translate(line + out * off, 0, at);
    return g;
  };
  const shaft = axis === 'x' ? g3(shaftW, yTop - y0, shaftD) : g3(shaftD, yTop - y0, shaftW);
  shaft.translate(0, (y0 + yTop) / 2, 0);
  B.brick.push(put(shaft));
  // a stone band course halfway up, which is what stops a tall brick stack
  // reading as a concrete post
  const band = axis === 'x' ? g3(shaftW + 0.16, 0.22, shaftD + 0.16) : g3(shaftD + 0.16, 0.22, shaftW + 0.16);
  band.translate(0, y0 + (yTop - y0) * 0.46, 0);
  B.trim.push(put(band));
  // corbel at the base: two stepped courses wider than the shaft
  for (const [yy, ex] of [[y0 + 0.22, 0.26], [y0 - 0.08, 0.14]]) {
    const c = axis === 'x' ? g3(shaftW + ex * 2, 0.30, shaftD + ex) : g3(shaftD + ex, 0.30, shaftW + ex * 2);
    c.translate(0, yy, 0);
    B.trim.push(put(c));
  }
  // cap band and three clay pots
  const cap = axis === 'x' ? g3(shaftW + 0.30, 0.26, shaftD + 0.26) : g3(shaftD + 0.26, 0.26, shaftW + 0.30);
  cap.translate(0, yTop - 0.13, 0);
  B.trim.push(put(cap));
  const potX = [-0.28, 0, 0.28];
  for (const dx of potX) {
    const pot = new THREE.CylinderGeometry(0.15, 0.18, 0.62, 10);
    if (axis === 'x') pot.translate(at + dx, yTop + 0.31, line + out * off);
    else pot.translate(line + out * off, yTop + 0.31, at + dx);
    B.iron.push(pot);
  }
}

// Pick positions for the chimneys that do not land in front of a window: the
// window rhythm is generated per level, so guessing an x would sooner or later
// put a stack across a sill.
function pickBays(arch, axis, line, wanted, span) {
  const wins = arch.windows
    .filter((w) => w.level === 'GF' && w.axis === axis && Math.abs(w.c - line) < 0.02)
    .map((w) => [(w.a + w.b) / 2 - span / 2 - 0.4, (w.a + w.b) / 2 + span / 2 + 0.4])
    .sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const want of wanted) {
    let best = want;
    for (const [a, b] of wins) {
      if (want > a - 0.01 && want < b + 0.01) {
        // inside a blocked interval: slide to whichever edge is nearer
        best = Math.abs(want - a) < Math.abs(b - want) ? a - 0.05 : b + 0.05;
      }
    }
    out.push(best);
  }
  return out;
}

// --- 10. ivy ----------------------------------------------------------------
// The one thing in the reference elevation no moulding can imitate: a house
// the garden has started to take back. Ivy hangs off the cornice in curtains,
// climbs out of the base course in runners, and wraps each tower to waist
// height.
//
// Every piece is visual only — no collider, no interaction, no raycast target.
// Cards stand 14 cm proud of the plaster, which clears the window sills (34 cm
// proud), the quoins (29 cm) and the plinth (32 cm), so leaves pass behind the
// dressings instead of through them. The tops of the curtains are placed at
// y = 11.50 — inside the corbelled moulding band, which spans 11.39..11.61 and
// stands half a metre proud — so the cut edge is behind the cornice from every
// angle a player can stand at. What is left is one alpha-tested mesh: a single
// draw call for the whole house, which is what an integrated GPU wants.

function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// A ragged, gently undulating sheet in a wall's local (u, v, w) frame: u along
// the wall, v up, w out. The boundary vertices are torn by up to 34 cm so the
// silhouette ends in leaves rather than along a guillotine line, and the whole
// sheet breathes a few centimetres off the plaster so light catches it.
function ivySheet({ axis, line, out, u0, u1, y0, y1, seed = 7, w = 0.14, tints = ivyTints }) {
  // 0.5 m cells, not 0.85: the torn edge is quantised to the cell size, so a
  // coarse grid ends the sheet in visible metre-wide steps — a staircase of
  // green rectangles, which is what the first lit shot showed. At half a metre
  // the tear resolves at roughly the scale of a leaf cluster.
  const nu = Math.max(4, Math.round((u1 - u0) / 0.5));
  const nv = Math.max(4, Math.round((y1 - y0) / 0.5));
  const g = new THREE.PlaneGeometry(u1 - u0, y1 - y0, nu, nv);
  const rnd = prng(seed);
  const ju = [], jv = [];
  for (let i = 0; i <= nu; i++) ju.push((rnd() - 0.5) * 1.0);
  for (let j = 0; j <= nv; j++) jv.push((rnd() - 0.5) * 1.0);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i;
      let u = u0 + (i / nu) * (u1 - u0);
      let y = y0 + (j / nv) * (y1 - y0);
      if (i === 0 || i === nu) u += ju[i];
      if (j === 0 || j === nv) y += jv[j];
      const wob = Math.sin(u * 2.7 + seed) * 0.06 + Math.cos(y * 1.7 + seed * 0.6) * 0.06;
      pos.setXYZ(k, u, y, w + wob);
      uv.setXY(k, u, y);        // metres: the ivy material tiles at 1.1 m
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  g.computeVertexNormals();
  // Tear the outline. A grid with all of its cells kept is a green rectangle
  // glued to the wall — which is exactly what the first pass looked like — so
  // cells are dropped with a probability that rises toward the border. The top
  // row keeps half of that probability because it is the row hiding behind the
  // cornice, and a gap there would show the cut.
  const idx = [];
  const keep = (i, j) => {
    const edge = Math.max(Math.abs(i / nu - 0.5), Math.abs(j / nv - 0.5)) * 2;
    const torn = Math.max(0, (edge - 0.5) / 0.5);
    return rnd() > torn * (j === nv ? 0.5 : 1) * 0.96;
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (!(keep(i, j) && keep(i + 1, j) && keep(i, j + 1) && keep(i + 1, j + 1))) continue;
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (idx.length) g.setIndex(idx);
  return placeOnWall(g, axis, line, out);
}

// The same idea wrapped on a tower: a partial cylinder around the turret's own
// centre, with torn top and side edges. Built by hand because a cylinder's
// vertex order hides which row is which, and the torn edge needs both.
function ivyArc({ cx, cz, r, a0, a1, y0, y1, seed = 11, tints = ivyTints }) {
  const span = a1 - a0;
  const nu = Math.max(5, Math.round(Math.abs(span) * r / 0.45));
  const nv = Math.max(4, Math.round((y1 - y0) / 0.45));
  const rnd = prng(seed);
  const ju = [], jv = [];
  for (let i = 0; i <= nu; i++) ju.push((rnd() - 0.5) * 0.9);
  for (let j = 0; j <= nv; j++) jv.push((rnd() - 0.5) * 1.0);
  const pos = [], uvs = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const a = a0 + (i / nu) * span + ju[i] * 0.07;
      let y = y0 + (j / nv) * (y1 - y0);
      if (j === 0 || j === nv) y += jv[j];
      pos.push(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r);
      uvs.push((a - a0) * r, y);
    }
  }
  // same torn-outline rule as the sheet, so the tower wrap does not read as a
  // green label wrapped round a chimney either
  const keep = (i, j) => {
    const edge = Math.max(Math.abs(i / nu - 0.5), Math.abs(j / nv - 0.5)) * 2;
    const torn = Math.max(0, (edge - 0.5) / 0.5);
    return rnd() > torn * (j === nv ? 0.5 : 1) * 0.96;
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (!(keep(i, j) && keep(i + 1, j) && keep(i, j + 1) && keep(i + 1, j + 1))) continue;
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);   // wound so the normals face away from the tower
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Where the growth goes. The south front is the elevation the drive looks at,
// so it carries the curtains; the west face carries the runners it sees from
// the three-quarter approach. Nothing is placed over the entrance portal or
// the west service door: the doorway stays clear at every width.
function ivy(B, gf, tints) {
  if (!tints) tints = [
    0x556b3a, 0x455429, 0x596238, 0x322a24, 0x8b9c78,
    0x6f7a52, 0x4a5638, 0x727047, 0x5f6440, 0x6a7546,
  ];
  const fp = gf.footprint;
  const TOP = 11.50;   // inside the corbelled moulding band

  const south = (u0, u1, y0, y1, seed) =>      B.ivy.push(ivySheet({
        axis: 'x', line: fp.z1, out: 1, u0, u1, y0, y1, seed, tints}));
  const west = (u0, u1, y0, y1, seed) =>      B.ivy.push(ivySheet({
        axis: 'z', line: fp.x0, out: -1, u0, u1, y0, y1, seed, tints}));

  // curtains hanging off the cornice — every top is at TOP, every bottom is
  // staggered so the row of sheets never reads as a colonnade of green.
  // Each curtain is a cluster of 5 strips dressed together so a single
  // wall area reads as a mass, not as a row of identical cards.
  const cluster = (u0, u1, y0, y1, seed) => {
    // The dy values are the whole trick: every sheet hangs from the same
    // cornice, so with one dy the growth ends in a ruler-straight line across
    // forty metres of wall. The tail of the list drops sheets a metre and a
    // half below the band, which breaks that line into the uneven curtain the
    // reference has.
    const waves = [
      [0.0, 0.0],
      [0.55, 0.0],
      [1.10, 0.0],
      [0.28, 0.42],
      [0.83, 0.42],
      [1.38, 0.42],
      [0.55, 0.84],
      [1.10, 0.84],
      [0.0, -0.42],
      [0.55, -0.42],
      [0.30, -1.05],
      [0.95, -1.60],
      [1.25, -0.95],
    ];
    const span = u1 - u0;
    for (const [off, dy] of waves) {
      const seg0 = u0 + off * span;
      const seg1 = seg0 + span * 0.92;
      // - off * 0.55 lowers each strip a little further than the one before:
      // the tops end somewhere between 11.5 and 10.3 m across a cluster, which
      // is what turns the cornice line back into growth.
      B.ivy.push(ivySheet({
        axis: 'x', line: fp.z1, out: 1, u0: seg0, u1: seg1,
        y0: y0 + dy, y1: y1 + dy - off * 0.55,
        seed: seed + Math.round((off + dy) * 90), tints,
      }));
    }
  };

  // SIX CLUSTERS IN A ROW is what made the facade a green wall: thirteen
  // overlapping sheets each, hung from 11.5 m to the plinth, covered more than
  // half of forty metres of masonry in flat leaf cards. The reference has
  // growth in two or three shaded places and staining everywhere else, so only
  // the two shaded ends keep their curtains, and they no longer reach the
  // cornice — ivy that survives on a wall this wet climbs to about a storey.
  cluster(-23.4, -18.6, 0.25, TOP - 4.6, 3);
  cluster(16.4, 21.0, 0.25, TOP - 5.4, 21);

  // runners climbing out of the base course — shorter, denser clusters
  const shortCluster = (u0, u1, y0, y1, seed) => {
    for (const off of [0, 0.6]) {
      B.ivy.push(ivySheet({
        axis: 'x', line: fp.z1, out: 1,
        u0: u0 + off * (u1 - u0), u1: u0 + (1 + off) * (u1 - u0) * 0.5,
        y0, y1, seed: seed + Math.round(off * 50), tints,
      }));
    }
  };
  shortCluster(-19.0, -16.4, 0.25, 3.4, 25);
  shortCluster(9.4, 11.6, 0.25, 2.6, 29);

  // runners on the west face
  const clusterW = (u0, u1, y0, y1, seed) => {
    const span = u1 - u0;
    for (const off of [0, 0.5]) {
      B.ivy.push(ivySheet({
        axis: 'z', line: fp.x0, out: -1, u0: u0 + off * span, u1: u1 - (1 - off) * span * 0.4,
        y0: y0 - off * 0.6, y1: y1 + off * 0.9, seed: seed + Math.round(off * 70), tints,
      }));
    }
  };
  clusterW(-9.4, -6.6, 0.25, 4.6, 41);

  // the two towers, wrapped from the top of the batter skirt to waist height.
  // Centre, radius and angle range mirror the turret() calls in buildFacade —
  // the tower's flat side sits on the wall face and it bulges outward.
  for (const t of [
    { line: fp.x1, at: 8.3, out: 1, r: 2.45, y1: 6.2, seed: 51 },
    { line: fp.x0, at: 9.6, out: -1, r: 2.15, y1: 5.2, seed: 55 },
  ]) {
    const theta = t.out > 0 ? 0 : Math.PI;
    B.ivy.push(ivyArc({
      cx: t.line + t.out * (TE / 2), cz: t.at, r: t.r + 0.14,
      a0: theta + 0.3, a1: theta + Math.PI - 0.3,
      y0: 0.45, y1: t.y1, seed: t.seed, tints,
    }));
  }
}

// --- 10b. the mansard -------------------------------------------------------
// The reference elevation is dominated by its roof, and the reason is
// geometric. A slate slope that rises AWAY from a viewer on the ground is
// almost invisible: you see its eave and nothing else. That is exactly why the
// pavilion roofs above this wall were never legible from the drive — correct
// geometry, wrong read. A mansard is the one roof that solves this, and it is
// also the roof this house already has the shape for: the F4 storey is a 3 m
// attic behind a perimeter wall. So the slate is hung on the OUTSIDE of that
// wall, battering from 0.88 m proud at the cornice to 0.10 m at the wall top,
// and every F4 window becomes a dormer cut through it.
//
// Nothing inside the house moves. The sheet is never more than 0.88 m from the
// plaster line, so it cannot enter a room, a collider, a stair, or the roof
// deck; the F4 windows keep their glass and their frames and simply look out
// through a stone dormer reveal instead of across a bare parapet.

const MANSARD = { y0: 11.72, y1: 15.05, p0: 0.88, p1: 0.10 };
// The front gable rises through the roof, so the slate stops at its shoulders.
const MANSARD_GABLE = [-4.3, 4.3];

function mansardW(y) {
  const t = (y - MANSARD.y0) / (MANSARD.y1 - MANSARD.y0);
  return MANSARD.p0 + (MANSARD.p1 - MANSARD.p0) * t;
}

// A point on a wall: u runs along it, y up, w out of its plaster face.
function wallPoint(axis, line, out, u, y, w) {
  const ww = line + out * (TE / 2 + w);
  return axis === 'x' ? [u, y, ww] : [ww, y, u];
}

// One slate quad, wound so its normal faces `n`. The mansard panels are hand
// listed corners, not boxes, so the winding has to be checked rather than
// assumed: a slope lit from behind is a black hole in the roof.
function slatePanel(B, quad, uvQuad, n) {
  let [a, b, c, d] = quad;
  let [ua, ub, uc, ud] = uvQuad;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * n[0] + ny * n[1] + nz * n[2] < 0) {
    [b, d] = [d, b];
    [ub, ud] = [ud, ub];
  }
  const pos = [...a, ...b, ...c, ...a, ...c, ...d];
  const uv = [...ua, ...ub, ...uc, ...ua, ...uc, ...ud];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  B.slate.push(g);
}

// The stone frame around one attic window. The reveal is a real thickness: the
// jambs, sill and head stand 0.7 m deep, rooted behind the slate and proud of
// it, so they cover the cut edges of the opening instead of leaving four raw
// slivers of sheet metal geometry.
function dormer(B, axis, line, out, win, floorY, h0, h1) {
  const ua = win.a - 0.09, ub = win.b + 0.09;
  const um = (ua + ub) / 2;
  const wMid = mansardW((h0 + h1) / 2) + 0.03;
  const put = (g, u, y, w) => { g.translate(u, y, w); placeOnWall(g, axis, line, out); return g; };
  for (const s of [-1, 1]) {
    B.trim.push(put(g3(0.26, h1 - h0 + 0.16, 0.74), s > 0 ? ub + 0.13 : ua - 0.13, (h0 + h1) / 2, wMid));
  }
  const sw = (ub - ua) + 0.52;
  B.trim.push(put(g3(sw, 0.18, 0.82), um, h0 + 0.05, wMid + 0.02));
  B.trim.push(put(g3(sw, 0.24, 0.70), um, h1 + 0.09, wMid + 0.01));
  const hood = archHood(ub - ua + 0.28, 0.26, 0.22, 0.16);
  hood.translate(um, h1 + 0.21, wMid);
  placeOnWall(hood, axis, line, out);
  B.trim.push(hood);

  // A dormer without a roof is a hole with a frame round it. In the reference
  // every attic window sits in its own little gable, ridge running back into
  // the slope, and that repeated rhythm is most of what gives the mansard its
  // texture from the drive. One stone prism for the gable body and a slate
  // board on each rake — the prism alone reads as a stone box.
  const gW = (ub - ua) + 0.54;
  const yE = h1 + 0.28, yR = h1 + 0.86;
  const s = new THREE.Shape();
  s.moveTo(-gW / 2, yE); s.lineTo(gW / 2, yE); s.lineTo(0, yR); s.closePath();
  const prism = new THREE.ExtrudeGeometry(s, { depth: 0.56, bevelEnabled: false, curveSegments: 2 });
  prism.translate(um, 0, wMid - 0.46);
  placeOnWall(prism, axis, line, out);
  B.stone.push(prism);
  const ang = Math.atan2(yR - yE, gW / 2);
  const rake = Math.hypot(gW / 2, yR - yE) + 0.16;
  for (const sgn of [-1, 1]) {
    const cap = g3(rake, 0.10, 0.68);
    cap.rotateZ(sgn > 0 ? -ang : ang);
    cap.translate(um + sgn * gW / 4, (yE + yR) / 2 + 0.06, wMid - 0.18);
    placeOnWall(cap, axis, line, out);
    B.slate.push(cap);
  }
}

// One face of the mansard: slate panels between its windows, with the gable and
// the towers left open. Returns the runs that still have slate on top, so the
// iron cresting can follow the roof rather than the wall.
function mansardFace(B, axis, line, out, ua, ub, wins, floorY, skips) {
  const n = axis === 'x' ? [0, 0, out] : [out, 0, 0];
  const y0 = MANSARD.y0, y1 = MANSARD.y1;
  const point = (u, y) => wallPoint(axis, line, out, u, y, mansardW(y));
  const panel = (u0, u1, ya, yb) => {
    if (u1 - u0 < 0.02 || yb - ya < 0.02) return;
    slatePanel(B,
      [point(u0, ya), point(u1, ya), point(u1, yb), point(u0, yb)],
      [[u0 / TILE, ya / TILE], [u1 / TILE, ya / TILE], [u1 / TILE, yb / TILE], [u0 / TILE, yb / TILE]],
      n);
  };

  const cuts = skips.map(([s, e]) => ({ s, e, win: null }));
  for (const w of wins) {
    if (skips.some(([s, e]) => w.a > s - 0.6 && w.b < e + 0.6)) continue;
    cuts.push({ s: w.a - 0.09, e: w.b + 0.09, win: w });
  }
  cuts.sort((p, q) => p.s - q.s);

  const runs = [];
  let cur = ua;
  for (const c of cuts) {
    if (c.s >= ub) break;
    const s = Math.max(c.s, ua), e = Math.min(c.e, ub);
    if (s > cur) { panel(cur, s, y0, y1); runs.push([cur, s]); }
    if (c.win) {
      const h0 = Math.max(y0, floorY + c.win.sill - 0.14);
      const h1 = Math.min(y1, floorY + c.win.head + 0.24);
      panel(s, e, y0, h0);
      panel(s, e, h1, y1);
      dormer(B, axis, line, out, c.win, floorY, h0, h1);
    }
    cur = Math.max(cur, e);
    if (cur >= ub) break;
  }
  if (cur < ub) { panel(cur, ub, y0, y1); runs.push([cur, ub]); }
  return runs;
}

// The mitre at each corner: the two faces are built on the wall lines, so the
// quarter between them is a small gusset. Without it the roof has four slots
// at the corners you can see the sky through.
function mansardCorner(B, x, z, sx, sz) {
  const { y0, y1, p0, p1 } = MANSARD;
  const n = [sx * 0.7071, 0, sz * 0.7071];
  const a = [x, y0, z + sz * p0];
  const b = [x + sx * p0, y0, z];
  const c = [x + sx * p1, y1, z];
  const d = [x, y1, z + sz * p1];
  slatePanel(B, [a, b, c, d],
    [[0, 0], [p0 * 1.414, 0], [p1 * 1.414, y1 - y0], [0, y1 - y0]], n);
}

function mansard(B, arch, gf) {
  const fp = gf.footprint;
  const f4 = LEVELS.find((l) => l.id === 'F4');
  const winsOn = (axis, line) => arch.windows.filter((w) =>
    w.level === 'F4' && w.axis === axis && Math.abs(w.c - line) < 0.02);

  const faces = [
    { axis: 'x', line: fp.z1, out: 1, ua: fp.x0, ub: fp.x1, skips: [MANSARD_GABLE], wins: winsOn('x', fp.z1) },
    { axis: 'x', line: fp.z0, out: -1, ua: fp.x0, ub: fp.x1, skips: [], wins: winsOn('x', fp.z0) },
    // the two towers pass through the roof; their bays stay open
    { axis: 'z', line: fp.x1, out: 1, ua: fp.z0, ub: fp.z1, skips: [[5.3, 11.3]], wins: winsOn('z', fp.x1) },
    { axis: 'z', line: fp.x0, out: -1, ua: fp.z0, ub: fp.z1, skips: [[6.9, 12.3]], wins: winsOn('z', fp.x0) },
  ];

  for (const f of faces) {
    mansardFace(B, f.axis, f.line, f.out, f.ua, f.ub, f.wins, f4.y, f.skips);
    // coping along the top of the slate
    const cop = g3(f.ub - f.ua + 0.24, 0.18, 0.34);
    cop.translate((f.ua + f.ub) / 2, MANSARD.y1 + 0.03, MANSARD.p1 + 0.10);
    placeOnWall(cop, f.axis, f.line, f.out);
    B.trim.push(cop);
    // Mansard iron ridge cresting — the iron line the reference elevation
    // draws along the top of the roof. A thin flat rail on short standards,
    // carried the length of each face at the slate's outer lip and interrupted
    // only where the roof is opened: the front gable and the two tower bays. It
    // is deliberately continuous across the dormers — those sit well down the
    // slope, and a cresting that stopped at every window would read as a series
    // of short handrails instead of one ridge. A row of turned finials rides the
    // rail, evenly spaced and held half a bay clear of each end, so the two
    // faces meeting at a corner do not stack their finials on one another.
    const crestY = MANSARD.y1 + 0.62;    // rail centre, clear of the coping
    const crestOff = MANSARD.p1 + 0.04;  // just proud of the slate's outer lip
    const spans = [];
    let spanFrom = f.ua;
    for (const [s, e] of [...f.skips].sort((p, q) => p[0] - q[0])) {
      if (s > spanFrom) spans.push([spanFrom, Math.min(s, f.ub)]);
      spanFrom = Math.max(spanFrom, e);
      if (spanFrom >= f.ub) break;
    }
    if (spanFrom < f.ub) spans.push([spanFrom, f.ub]);

    for (const [s0, s1] of spans) {
      const len = s1 - s0;
      if (len < 0.5) continue;
      const rail = g3(len, 0.06, 0.06);
      rail.translate((s0 + s1) / 2, crestY, crestOff);
      placeOnWall(rail, f.axis, f.line, f.out);
      B.iron.push(rail);
      // standards, one every 0.55 m, standing on the coping
      for (let u = s0 + 0.28; u < s1 - 0.22; u += 0.55) {
        const bar = g3(0.045, 0.50, 0.045);
        bar.translate(u, crestY - 0.28, crestOff);
        placeOnWall(bar, f.axis, f.line, f.out);
        B.iron.push(bar);
      }
      // the finial row: a stem and a ball on the rail, one per 2.4 m bay
      const bays = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i < bays; i++) {
        const u = s0 + (i + 0.5) * (len / bays);
        const stem = new THREE.CylinderGeometry(0.026, 0.026, 0.30, 6);
        stem.translate(u, crestY + 0.18, crestOff);
        placeOnWall(stem, f.axis, f.line, f.out);
        B.iron.push(stem);
        const ball = new THREE.SphereGeometry(0.075, 7, 5);
        ball.translate(u, crestY + 0.405, crestOff);
        placeOnWall(ball, f.axis, f.line, f.out);
        B.iron.push(ball);
      }
    }
  }

  for (const [x, z, sx, sz] of [
    [fp.x1, fp.z1, 1, 1], [fp.x0, fp.z1, -1, 1],
    [fp.x1, fp.z0, 1, -1], [fp.x0, fp.z0, -1, -1],
  ]) mansardCorner(B, x, z, sx, sz);
}

// --- 10c. string courses ----------------------------------------------------
// The horizontal half of the elevation. Between two rows of windows a real wall
// of this period changes plane — a band, a drip, a course of dressed stone —
// and without it four storeys of openings read as a grid of holes. Two bands,
// at the F2 and F3 floor lines, carry the eye across and give the windows
// something to sit under.
function stringCourses(B, gf) {
  const fp = gf.footprint;
  const w = fp.x1 - fp.x0, d = fp.z1 - fp.z0;
  // Two stone bands on every F2/F3-facing elevation. A real here is built with
  // its courses running in from the stone: a 26 cm deep haunched band proud of
  // the plaster, and a smaller drip stone inboard of it. The two faces that face
  // the road (south and east) repeat that detail but carry the taller lower course
  // that ties into the entrance porch.
  const bands = [
    { axis: 'x', line: fp.z1, out: 1, len: w + 0.5, mid: (fp.x0 + fp.x1) / 2, face: 'road' },
    { axis: 'x', line: fp.z0, out: -1, len: w + 0.5, mid: (fp.x0 + fp.x1) / 2, face: 'back' },
    { axis: 'z', line: fp.x1, out: 1, len: d + 0.5, mid: (fp.z0 + fp.z1) / 2, face: 'road' },
    { axis: 'z', line: fp.x0, out: -1, len: d + 0.5, mid: (fp.z0 + fp.z1) / 2, face: 'back' },
  ];
  for (const { axis, line, out, len, mid, face } of bands) {
    const dep = 0.26;
    for (const y of [4.20, 8.00]) {
      const course = axis === 'x' ? g3(len, 0.30, dep) : g3(dep, 0.30, len);
      const off = TE / 2 + dep / 2 - 0.04;
      if (axis === 'x') course.translate(mid, y, line + out * off);
      else course.translate(line + out * off, y, mid);
      B.trim.push(course);
      const drip = axis === 'x' ? g3(len - 0.20, 0.10, 0.12) : g3(0.12, 0.10, len - 0.20);
      const dripOff = TE / 2 + 0.12 / 2;
      if (axis === 'x') drip.translate(mid, y - 0.34, line + out * dripOff);
      else drip.translate(line + out * dripOff, y - 0.34, mid);
      B.trim.push(drip);
      if (face === 'road') {
        const base = axis === 'x' ? g3(len - 0.50, 0.14, 0.30) : g3(0.30, 0.14, len - 0.50);
        const baseOff = TE / 2 + 0.30 / 2 - 0.02;
        if (axis === 'x') base.translate(mid, y - 0.06, line + out * baseOff);
        else base.translate(line + out * baseOff, y - 0.06, mid);
        B.trim.push(base);
      }
    }
  }
}

// --- 10d. a single slate hood on the porch pier tops ----------------------
// The porch roof is a flat iron slab; cutting a pitched roof here would move
// the under-mesh the game already builds on top of the slab, so the only exterior
// dressing we add is a shallow stone hood over the pier caps, the way a small
// front porch in a house of this period was finished.
function porchHoods(B, gf) {
  const fp = gf.footprint;
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    const out = 1; // south face
    const hood = archHood(0.48, 0.20, 0.20, 0.14);
    hood.translate(x, 3.12 + 0.20, fp.z1 + TE / 2 + 0.06);
    B.trim.push(hood);
  }
}

// --- 10e. capiz screens ------------------------------------------------------
// A bahay-na-bato window is not a sheet of glass: it is a timber lattice with
// translucent capiz shell behind it, so the window glows warm from inside and
// reads as a grid of pale squares from the drive. The stone surround and the
// glass are already built by dressing(); this lays the shell and its lattice a
// few centimetres inside the outer face, so it sits in the reveal rather than
// on it, and the lattice is the same narra-dark timber as the door casings.
function capizPanel(win, level, B) {
  const w = win.b - win.a, h = win.head - win.sill;
  if (w < 0.8 || h < 1.0) return;
  const u = (win.a + win.b) / 2;
  const ay = win.floorY + (win.sill + win.head) / 2;
  const out = outward(level, win.axis, win.c);
  const face = win.c + out * (TE / 2 - 0.06);
  const pw = w - 0.16, ph = h - 0.16;
  const panel = new THREE.PlaneGeometry(pw, ph);
  if (win.axis === 'x') {
    if (out < 0) panel.rotateY(Math.PI);
    panel.translate(u, ay, face);
  } else {
    panel.rotateY(out > 0 ? Math.PI / 2 : -Math.PI / 2);
    panel.translate(face, ay, u);
  }
  B.capiz.push(panel);

  // lattice: uprights every 0.30 m, two rails, all in dark timber
  const nx = Math.max(2, Math.round(pw / 0.30));
  const barZ = face + out * 0.025;
  for (let i = 1; i < nx; i++) {
    const du = -pw / 2 + i * (pw / nx);
    const bar = g3(0.034, ph, 0.034);
    if (win.axis === 'x') bar.translate(u + du, ay, barZ);
    else bar.translate(barZ, ay, u + du);
    B.timber.push(bar);
  }
  for (const fy of [-0.22, 0.22]) {
    const rail = win.axis === 'x' ? g3(pw, 0.040, 0.030) : g3(0.030, 0.040, pw);
    const yy = ay + ph * fy;
    if (win.axis === 'x') rail.translate(u, yy, barZ);
    else rail.translate(barZ, yy, u);
    B.timber.push(rail);
  }
}

// --- 10f. rain goods --------------------------------------------------------
// The mansard throws its water 0.88 m clear of the wall, so an elevation this
// exposed needs a gutter, a hopper and a stack at the bays — without one the
// plaster below the eave is a rain stain and the plinth takes the roof. The
// trough hangs just under the slate's lower edge, on brackets; the leader runs
// back under the eave to the stack, which is bracketed to the face of the wall
// and ends in a shoe above the plinth. Deliberately simple profiles: cast iron
// goods of this period are half-round and thin, not moulded timber.
function rainGoods(B, arch, gf) {
  const fp = gf.footprint;
  const yEave = MANSARD.y0 - 0.13;
  const off = MANSARD.p0 + 0.10;          // outside the projecting slate edge
  const wallOff = TE / 2 + 0.10;          // stack sits proud of the plaster
  const faces = [
    { axis: 'x', line: fp.z1, out: 1, a: fp.x0, b: fp.x1 },
    { axis: 'x', line: fp.z0, out: -1, a: fp.x0, b: fp.x1 },
    { axis: 'z', line: fp.x1, out: 1, a: fp.z0, b: fp.z1 },
    { axis: 'z', line: fp.x0, out: -1, a: fp.z0, b: fp.z1 },
  ];
  for (const f of faces) {
    const len = f.b - f.a;
    const mid = (f.a + f.b) / 2;
    // half-round trough and its outer lip
    const trough = f.axis === 'x' ? g3(len + 0.30, 0.16, 0.30) : g3(0.30, 0.16, len + 0.30);
    if (f.axis === 'x') trough.translate(mid, yEave, f.line + f.out * off);
    else trough.translate(f.line + f.out * off, yEave, mid);
    B.iron.push(trough);
    const lip = f.axis === 'x' ? g3(len + 0.36, 0.07, 0.05) : g3(0.05, 0.07, len + 0.36);
    if (f.axis === 'x') lip.translate(mid, yEave + 0.09, f.line + f.out * (off + 0.15));
    else lip.translate(f.line + f.out * (off + 0.15), yEave + 0.09, mid);
    B.iron.push(lip);
    for (let u = f.a + 0.45; u < f.b - 0.2; u += 0.92) {
      const bracket = f.axis === 'x' ? g3(0.05, 0.10, 0.34) : g3(0.34, 0.10, 0.05);
      if (f.axis === 'x') bracket.translate(u, yEave - 0.08, f.line + f.out * (off - 0.02));
      else bracket.translate(f.line + f.out * (off - 0.02), yEave - 0.08, u);
      B.iron.push(bracket);
    }

    // stacks at bays that are not windows, dropped to the plinth
    const stations = f.axis === 'x'
      ? (f.out > 0 ? [-19.0, -12.4, 12.4, 19.0] : [-15.0, 0.0, 15.0])
      : [-8.6, 0.2];
    for (const u of stations) {
      const inWindow = arch.windows.some((w) => w.axis === f.axis
        && Math.abs(w.c - f.line) < 0.02 && u > w.a - 0.9 && u < w.b + 0.9);
      if (inWindow) continue;
      const yTop = yEave - 0.20, yBot = 0.66;
      // leader from the trough back under the eave to the stack
      const lead = f.axis === 'x' ? g3(0.10, 0.12, off - TE / 2) : g3(off - TE / 2, 0.12, 0.10);
      if (f.axis === 'x') lead.translate(u, yEave - 0.04, f.line + f.out * (off / 2 + TE / 4));
      else lead.translate(f.line + f.out * (off / 2 + TE / 4), yEave - 0.04, u);
      B.iron.push(lead);
      // hopper head where the leader leaves the trough
      const hopper = f.axis === 'x' ? g3(0.28, 0.32, 0.26) : g3(0.26, 0.32, 0.28);
      if (f.axis === 'x') hopper.translate(u, yEave - 0.20, f.line + f.out * off);
      else hopper.translate(f.line + f.out * off, yEave - 0.20, u);
      B.iron.push(hopper);
      // the stack itself, against the wall face
      const stack = new THREE.CylinderGeometry(0.062, 0.062, yTop - yBot, 8);
      const su = f.axis === 'x' ? u : f.line + f.out * wallOff;
      const sw = f.axis === 'x' ? f.line + f.out * wallOff : u;
      stack.translate(su, (yTop + yBot) / 2, sw);
      B.iron.push(stack);
      // shoe, kicking the water clear of the plinth
      const shoe = f.axis === 'x' ? g3(0.13, 0.19, 0.30) : g3(0.30, 0.19, 0.13);
      if (f.axis === 'x') shoe.translate(u, yBot - 0.08, f.line + f.out * (wallOff + 0.10));
      else shoe.translate(f.line + f.out * (wallOff + 0.10), yBot - 0.08, u);
      B.iron.push(shoe);
      // collar brackets down the face
      for (let y = 2.3; y < yTop - 0.7; y += 2.4) {
        const br = f.axis === 'x' ? g3(0.16, 0.055, 0.14) : g3(0.14, 0.055, 0.16);
        if (f.axis === 'x') br.translate(u, y, f.line + f.out * (TE / 2 + 0.05));
        else br.translate(f.line + f.out * (TE / 2 + 0.05), y, u);
        B.iron.push(br);
      }
    }
  }
}

// --- foundation planting ----------------------------------------------------
// The reference manor stands in its own neglect: a band of brambles, saplings
// and long grass against the plinth, with the drive kept clear. Without it the
// building sits on a flat lawn and the silhouette has nothing to grow out of.
//
// Cheap by construction: three crossed alpha cards per clump, merged into the
// existing ivy mesh, so the whole apron of planting costs no extra draw call.
function foundationPlanting(B, gf) {
  const fp = gf.footprint;
  const rnd = prng(4021);
  const faces = [
    { axis: 'x', line: fp.z1, out: 1, a: fp.x0, b: fp.x1 },
    { axis: 'x', line: fp.z0, out: -1, a: fp.x0, b: fp.x1 },
    { axis: 'z', line: fp.x1, out: 1, a: fp.z0, b: fp.z1 },
    { axis: 'z', line: fp.x0, out: -1, a: fp.z0, b: fp.z1 },
  ];
  for (const f of faces) {
    const yaw0 = f.axis === 'x' ? (f.out > 0 ? 0 : Math.PI) : (f.out > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let u = f.a + 0.5; u < f.b - 0.5; u += 1.05 + rnd() * 0.85) {
      // the approach is kept open: nothing grows across the entrance bay
      if (f.axis === 'x' && f.out > 0 && u > -6.2 && u < 6.2) continue;
      let onDoor = false;
      for (const d of gf.doors) {
        if (d.axis !== f.axis || Math.abs(d.c - f.line) > 0.02) continue;
        if (Math.abs(u - d.at) < d.w / 2 + 1.0) onDoor = true;
      }
      if (onDoor) continue;
      const dist = TE / 2 + 0.42 + rnd() * 0.85;
      const h = 0.55 + rnd() * 0.95;
      for (let k = 0; k < 3; k++) {
        const w = 0.55 + rnd() * 0.65;
        const g = new THREE.PlaneGeometry(w, h * (0.8 + rnd() * 0.35));
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
        const yaw = yaw0 + (k - 1) * 0.85 + (rnd() - 0.5) * 0.5;
        g.rotateY(yaw);
        const du = (rnd() - 0.5) * 0.85;
        const dy = h / 2 + 0.02;
        if (f.axis === 'x') g.translate(u + du, dy, f.line + f.out * (dist + rnd() * 0.4));
        else g.translate(f.line + f.out * (dist + rnd() * 0.4), dy, u + du);
        B.ivy.push(g);
      }
    }
  }
}

// --- the build --------------------------------------------------------------
export function buildFacade(scene, arch) {
  const B = buckets();
  const colliders = [];

  const gf = LEVELS.find((l) => l.id === 'GF');
  colliders.push(...plinth(B, gf));
  quoins(B);
  corbels(B);
  porch(B);
  pilasters(B, arch, gf);

  // windows, per level, with the level's own footprint for the outward test.
  // The attic is the exception: its openings are framed by the mansard's
  // dormers, and a second stone surround on the wall behind the first would be
  // a 0.6 m deep tunnel of mouldings.
  for (const win of arch.windows) {
    const level = LEVELS.find((l) => l.id === win.level);
    if (!level || win.level === 'F4') continue;
    dressing(win, level, B);
    // the principal south and east windows are shell-screened; the rear and
    // the service side keep plain glazing, which is how a house of this age was
    // glazed — the expensive material went where visitors were received.
    if ((win.level === 'GF' || win.level === 'F2') && win.c > 0) capizPanel(win, level, B);
  }
  entrancePortal(arch, B);

  // roofs over every pavilion that is meant to be roofed
  const f4 = LEVELS.find((l) => l.id === 'F4');
  let roofed = 0;
  for (const r of f4.rooms) {
    if (OPEN_PAVILIONS.includes(r.id)) continue;
    rangeRoof(r, B);
    roofed++;
  }

  frontGable(B, arch);
  // The two continuous string courses that used to run across all four faces
  // at the F2 and F3 floor lines were the "repetitive horizontal strips" in the
  // screenshot. A rendered manor has no such bands: the storey divisions are
  // carried by the window sills and the cornice, which are still here.
  porchHoods(B, gf);
  rainGoods(B, arch, gf);
  mansard(B, arch, gf);

  // two round towers on the corners that face the drive. The southeast tower
  // carries an extra course of masonry down to floor level, so its plinth is the
  // same stone as the wall base rather than a bare concrete footing.
  // One corner tower, slender, on the corner the drive approaches from — the
  // reference has exactly one round turret and it is a bay window carried up
  // through the roof, not a drum. The west tower is gone: two opposing drums
  // with 6 m cones is what turned the house into a castle at first glance.
  colliders.push(...turret(B, {
    axis: 'z', line: gf.footprint.x1, at: 8.3, out: 1, r: 1.55, y0: -0.9, y1: 16.1, coneH: 3.5, baseCourse: true,
  }));

  // Three stacks, not eight. Two on the front at the chimney breasts that the
  // ground floor actually has, one on the rear service slope. A mansion this
  // size would have had more flues than this, but a row of identical piers is
  // what made the silhouette read as a factory, and the reference shows two
  // dominant stacks with the rest lost in the roof.
  const south = pickBays(arch, 'x', gf.footprint.z1, [-18.5, 8.6], 0.80);
  const north = pickBays(arch, 'x', gf.footprint.z0, [8.5], 0.80);
  for (const at of south) chimney(B, { axis: 'x', line: gf.footprint.z1, at, out: 1 });
  for (const at of north) chimney(B, { axis: 'x', line: gf.footprint.z0, at, out: -1 });

  ivy(B, gf, ivyTints);
  foundationPlanting(B, gf);

  const made = emit(scene, B);
  for (const c of colliders) arch.colliders.push(c);
  return {
    meshes: made,
    pieces: Object.values(B).reduce((n, a) => n + a.length, 0),
    roofed,
    colliders: colliders.length,
  };
}

export { OPEN_PAVILIONS };
