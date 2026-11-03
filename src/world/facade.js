// FACADE — the outside of the house.
//
// SILID's house is a Filipino ancestral mansion of the late colonial period: a
// stone ground floor carrying two timber storeys, under deep-eaved roofs, with
// capiz windows, ventanillas and a timber portico. It is the house the plan
// already describes — 46 x 22 m over four storeys, an inner courtyard, a
// stair tower, a rooftop azotea — and this file is the part of it that stands
// outside the plaster line.
//
// What this file is NOT allowed to be: a European manor. The previous envelope
// was a high-Victorian one — a mansard skirt, a corner turret with a cone, a
// front gable, chimneys, quoins, gothic hood moulds and a slate roof. From the
// road that read as a French château with lit windows, which is the opposite of
// the architecture the game is set in. All of it has been removed here and
// replaced with the form a wealthy Filipino family would actually have built:
//
//   * a rusticated stone ground floor with a battered plinth and stone piers at
//     the corners, carrying
//   * two timber upper storeys clad in vertical boards, with the floor lines
//     expressed as deep moulded bands rather than as stone string courses;
//   * windows as tall capiz sashes in dark narra frames, each with the sliding
//     pair, a fixed transom, louvred persiana shutters folded against the wall
//     and a ventanilla of slatted panels under the sill;
//   * low-pitched hipped roofs over the rooftop pavilions, in weathered
//     corrugated iron, with a metre of eave overhang, exposed rafter tails, a
//     fascia and a ridge cap — the silhouette that says "Philippines" before
//     any ornament does;
//   * a timber portico: four turned posts on stone plinths carrying a hipped
//     canopy with a calado frieze, replacing the concrete slab on stone piers.
//
// Everything here is either above the F4 pavilion ceilings (y = 14.72),
// attached to the outer face of a perimeter wall, or embedded in the thickness
// of that wall. Nothing moves a wall, a door, a stair or a collider of an
// interior: the plan, the interiors, the roof deck, the ladder route and the
// underground connection are untouched. Only the plinth and the portico posts
// add colliders, and both stand outside the building.
//
// Geometry is merged into one mesh per material. The whole elevation costs a
// few thousand boxes and about nine draw calls, which is what keeps it inside
// the frame budget on integrated graphics.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileAtMetres, ivyMaterial } from './materials.js';
import { LEVELS } from './plan.js';
import { box } from './primitives.js';

const TE = 0.42;        // exterior wall thickness, same as architecture.js
const EAVE = 14.72;     // the F4 pavilion ceilings: every roof starts here
const PARA = 11.6;      // the azotea slab: floor of the rooftop level
const OPEN_PAVILIONS = ['FF4-01', 'FF4-03'];  // terrace and observatory stay open

const g3 = (w, h, d) => box(w, h, d, 1);

// --- buckets ---------------------------------------------------------------
// One bucket per material. Anything that shares a surface shares a mesh.
function buckets() {
  return {
    stone: [],    // the ground floor, the plinth, the corner piers
    lime: [],     // limewashed render: the rooftop pavilions
    wood: [],     // board siding on the two timber storeys
    joinery: [],  // narra: window frames, shutters, the portico
    roof: [],     // corrugated iron
    iron: [],     // gutters, downpipes, brackets, ridge caps
    capiz: [],    // the shell panes
    glass: [],    // plain glazing where a room wants light, not shell
    dark: [],     // ventanilla backing, recesses
    leaf: [],     // the planting at the foot of the walls
    ironwork: [],  // shutter hinges and straps: painted iron, not narra
  };
}

function emit(scene, B) {
  const keys = {
    stone: ['facadeStone', 'FacadeStone'],
    lime: ['facade', 'FacadeLime'],
    wood: ['facadeWood', 'FacadeWood'],
    // Narra joinery, but stained near-black the way eighty years of smoke and
    // lanolin leave it. The teak colour is for furniture inside; a window frame
    // on the outside of this house is dark, and a bright one reads as plastic.
    joinery: ['woodDark', 'FacadeJoinery'],
    // Corrugated iron is seen from below as well as above: a metre of eave
    // overhang means the underside of the sheet is what you look up at.
    roof: ['roofTin', 'FacadeRoof', true],
    iron: ['ironDark', 'FacadeIron'],
    ironwork: ['ironDark', 'FacadeIronwork'],
    dark: ['woodDirt', 'FacadeDark'],
    leaf: ['ivyLeaf', 'FacadeLeaf'],
  };
  for (const [k, geos] of Object.entries(B)) {
    if (!geos.length) continue;
    let mat;
    if (k === 'capiz') {
      // Capiz is not glass: it scatters. Rough, slightly emissive, and drawn
      // from both faces because a pane is seen from inside and from the road.
      // Shell is warm and slightly translucent, but it is not a lamp: at the
      // old emissive strength every window on the elevation read as a lit
      // lightbox, which is the one thing a dark house at night must not do.
      mat = new THREE.MeshStandardMaterial({
        color: 0xc2b190, roughness: 0.80, metalness: 0,
        emissive: 0x1c1409, emissiveIntensity: 0.06,
        side: THREE.DoubleSide,
      });
    } else if (k === 'glass') {
      mat = new THREE.MeshStandardMaterial({
        color: 0x1a2422, roughness: 0.08, metalness: 0.18,
        transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        emissive: 0x140c05, emissiveIntensity: 0.4,
      });
    } else if (k === 'leaf') {
      // The one surface that is not a photograph: the same leaf card the estate
      // uses, so the planting at the foot of the house stirs with the wind.
      mat = ivyMaterial();
    } else {
    const [key, name, twoSided] = keys[k];
    const base = materials[key] || materials.facade;
    mat = base.clone();
    // Weathered galvanised sheet is a mid grey. The material is mixed dark for
    // gutters and flashings elsewhere in the world; on a roof seen from the
    // drive at night it went to black, which is why four storeys of house read
    // as a block with a shadow on top instead of as a roof.
    if (k === 'roof') { mat.color.setHex(0xa7aea3); mat.roughness = 0.62; mat.metalness = 0.34; }
    // Limewash on the rooftop pavilions is old render, not fresh white paint.
    // At full strength it was the brightest thing on the elevation and the top
    // storey read as a white box sitting on the house.
    if (k === 'lime') {
      mat.color.multiplyScalar(0.80);
      // Limewash is a wall: it is seen from both sides wherever a gable end or a
      // soffit is a single plane, and one mis-wound triangle is a hole in the
      // house that no amount of looking at the source reveals.
      mat.side = THREE.DoubleSide;
    }
      // Every bucket owns its maps: these are walls in metres, and a shared
      // texture repeat would be rewritten by whichever material is scaled last.
      // A corrugated sheet is 0.76 m across five ribs, so a 0.38 m tile gives
      // the roof its real corrugation instead of five enormous waves.
      const tile = k === 'wood' ? 1.8 : k === 'roof' ? 0.38 : k === 'joinery' ? 1.15 : k === 'lime' ? 6.0 : 2.6;
      tileAtMetres(mat, tile);
      if (twoSided) mat.side = THREE.DoubleSide;
    }
    // Extrusions, cylinders and boxes do not agree on indexing, and a merge
    // across mixed geometries fails outright: normalise to non-indexed first.
    const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const mesh = new THREE.Mesh(mergeGeometries(flat), mat);
    mesh.name = 'Facade_' + k;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

// --- putting a piece on a wall ---------------------------------------------
// Local space is (u along the wall, v up, w out of the wall) with the plaster
// face at w = 0. Rotation, never mirroring, so windings stay valid. `u` is the
// world coordinate measured along the wall — x on an x-wall, z on a z-wall —
// because the windows are recorded in world space by architecture.js.
function mount(g, axis, c, out, u) {
  if (axis === 'x') {
    if (out < 0) g.rotateY(Math.PI);
    g.translate(u, 0, c + out * (TE / 2));
  } else {
    g.rotateY(out > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(c + out * (TE / 2), 0, u);
  }
  return g;
}

function outward(level, axis, c) {
  const fp = level.footprint;
  if (axis === 'x') return c <= (fp.z0 + fp.z1) / 2 ? -1 : 1;
  return c <= (fp.x0 + fp.x1) / 2 ? -1 : 1;
}

// --- 1. the plinth ----------------------------------------------------------
// A rusticated stone base course, 1.15 m tall, wider than the wall above it.
// The base is cut at every door, because a 10 cm step is right under a wall and
// wrong under a threshold; each opening gets a slab instead, and the collider
// keeps a body from walking through the stone.
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
    const holes = gf.doors
      .filter((dr) => dr.axis === axis && Math.abs(dr.c - line) < 0.02)
      .map((dr) => [dr.at - dr.w / 2 - 0.45, dr.at + dr.w / 2 + 0.45]);
    for (const [s, e] of spansBetween(a, b, holes)) {
      const len = e - s, mid = (s + e) / 2;
      const dep = t, off = TE / 2 + dep / 2 - 0.02;
      const g = axis === 'x' ? g3(len, h, dep) : g3(dep, h, len);
      if (axis === 'x') g.translate(mid, y, line + out * off);
      else g.translate(line + out * off, y, mid);
      B.stone.push(g);
      // a chamfer course on top of the base, the shadow line of the plinth
      const cdep = dep + 0.10, coff = TE / 2 + cdep / 2 - 0.02;
      const c = axis === 'x' ? g3(len, 0.16, cdep) : g3(cdep, 0.16, len);
      if (axis === 'x') c.translate(mid, top - 0.02, line + out * coff);
      else c.translate(line + out * coff, top - 0.02, mid);
      B.joinery.push(c);
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
      B.stone.push(g);
    }
  }
  return colliders;
}

// --- 2. corner piers --------------------------------------------------------
// In a bahay na bato the corners are carried by stone or hardwood posts, not by
// alternating quoin stones. Four square piers run the full height of the stone
// storey and are picked up again at the azotea, standing a hand's width proud
// of the render, so the corner is a shadow line from every angle.
function cornerPiers(B) {
  const fp = LEVELS.find((l) => l.id === 'GF').footprint;
  for (const [x, z] of [[fp.x0, fp.z0], [fp.x0, fp.z1], [fp.x1, fp.z0], [fp.x1, fp.z1]]) {
    const sx = x === fp.x0 ? -1 : 1, sz = z === fp.z0 ? -1 : 1;
    const px = x + sx * 0.16, pz = z + sz * 0.16;
    // stone shaft through the ground storey
    const shaft = g3(0.58, 4.2, 0.58);
    shaft.translate(px, 2.1, pz);
    B.stone.push(shaft);
    // a moulded cap where the timber storey takes over
    const cap = g3(0.70, 0.16, 0.70);
    cap.translate(px, 4.24, pz);
    B.joinery.push(cap);
    // timber post carrying the two upper storeys, with a base and a capital
    for (const [y0, h] of [[4.34, 7.26]]) {
      const post = g3(0.50, h, 0.50);
      post.translate(px, y0 + h / 2, pz);
      B.wood.push(post);
      const base = g3(0.60, 0.14, 0.60);
      base.translate(px, y0 + 0.07, pz);
      B.joinery.push(base);
      const top = g3(0.62, 0.15, 0.62);
      top.translate(px, y0 + h - 0.075, pz);
      B.joinery.push(top);
    }
    // the post the azotea stands on: it rises to the parapet and stops there
    const up = g3(0.46, 1.02, 0.46);
    up.translate(px, PARA + 0.51, pz);
    B.stone.push(up);
  }
}

// --- 3. storey bands --------------------------------------------------------
// The floor joists of a timber storey show at the wall as a band of boards with
// a moulded drip under them. Two bands, at the F2 and F3 floor lines, are what
// stop the boarded elevation reading as a single tall curtain.
function storeyBands(B) {
  const fp = LEVELS.find((l) => l.id === 'GF').footprint;
  const w = fp.x1 - fp.x0, d = fp.z1 - fp.z0;
  for (const y of [4.20, 8.00]) {
    for (const [axis, line, len, a, b] of [
      ['x', fp.z1, w + 0.5, fp.x0 - 0.25, fp.x1 + 0.25],
      ['x', fp.z0, w + 0.5, fp.x0 - 0.25, fp.x1 + 0.25],
      ['z', fp.x1, d + 0.5, fp.z0 - 0.25, fp.z1 + 0.25],
      ['z', fp.x0, d + 0.5, fp.z0 - 0.25, fp.z1 + 0.25],
    ]) {
      const out = outward({ footprint: fp }, axis, line);
      const off = TE / 2 + 0.07;
      const band = axis === 'x' ? g3(len, 0.20, 0.14) : g3(0.14, 0.20, len);
      if (axis === 'x') band.translate((a + b) / 2, y - 0.02, line + out * off);
      else band.translate(line + out * off, y - 0.02, (a + b) / 2);
      B.joinery.push(band);
      // the drip under it, one finger's width prouder and darker
      const drip = axis === 'x' ? g3(len, 0.06, 0.20) : g3(0.20, 0.06, len);
      if (axis === 'x') drip.translate((a + b) / 2, y - 0.15, line + out * (TE / 2 + 0.09));
      else drip.translate(line + out * (TE / 2 + 0.09), y - 0.15, (a + b) / 2);
      B.joinery.push(drip);
    }
  }
}

// --- 4. the windows ---------------------------------------------------------
// A capiz window is the single most recognisable detail of the house type: two
// tall sliding sashes of shell panes in a dark frame, a fixed transom over them
// and a ventanilla of slatted panels at the sill. Everything is built in the
// opening's own local frame, then mounted on the wall.
// The sash returns its bars and its pane instead of pushing them into the
// buckets itself: the caller has to place them in the opening's own frame, and
// a builder that writes into a shared array forces the caller to guess how many
// entries it just added. That guess was the bug in the first draft.
function capizSash(w, h) {
  const t = 0.045, d = 0.040, m = 0.019;
  const parts = [];
  for (const [ww, hh, xx, yy] of [
    [w, t, 0, -h / 2 + t / 2], [w, t, 0, h / 2 - t / 2],
    [t, h - 2 * t, -w / 2 + t / 2, 0], [t, h - 2 * t, w / 2 - t / 2, 0],
  ]) {
    const g = box(ww, hh, d, 1);
    g.translate(xx, yy, 0);
    parts.push(g);
  }
  // muntins: three lights across, five up, the proportion of a shell sash
  for (let i = 1; i < 3; i++) {
    const g = box(m, h - 2 * t, d * 0.8, 1);
    g.translate(-w / 2 + (w * i) / 3, 0, 0);
    parts.push(g);
  }
  for (let i = 1; i < 5; i++) {
    const g = box(w - 2 * t, m, d * 0.8, 1);
    g.translate(0, -h / 2 + (h * i) / 5, 0);
    parts.push(g);
  }
  // the shell itself: one pane behind the grid, so the muntins cast onto it
  const pane = new THREE.PlaneGeometry(w - t * 1.4, h - t * 1.4);
  pane.translate(0, 0, -d / 2 + 0.006);
  return { bars: parts, pane };
}

function shutter(w, h) {
  const t = 0.038, d = 0.045;
  const parts = [];
  for (const [ww, hh, xx, yy] of [
    [w, t, 0, -h / 2 + t / 2], [w, t, 0, h / 2 - t / 2],
    [t, h - 2 * t, -w / 2 + t / 2, 0], [t, h - 2 * t, w / 2 - t / 2, 0],
  ]) {
    const g = box(ww, hh, d, 1);
    g.translate(xx, yy, 0);
    parts.push(g);
  }
  // nine louvres, pitched so they shed rain and shadow the frame
  const n = 9;
  for (let i = 0; i < n; i++) {
    const g = box(w - t * 1.6, 0.016, 0.030, 1);
    g.rotateX(0.55);
    g.translate(0, -h / 2 + t + ((h - 2 * t) * (i + 0.5)) / n, 0);
    parts.push(g);
  }
  return parts;
}

function windowDressing(win, level, B) {
  const w = win.b - win.a, h = win.head - win.sill;
  const cy = win.floorY + (win.sill + win.head) / 2;
  // A window on a wall that is not the footprint does not have an "outward"
  // the footprint can answer (a bay's west window faces west even though it
  // stands east of the house's centre line), so the wall records its own face.
  const out = win.out ?? outward(level, win.axis, win.c);
  const u = (win.a + win.b) / 2;
  const put = (g) => { mount(g, win.axis, win.c, out, u); g.translate(0, cy, 0); };

  // architrave: jambs and a moulded head. Timber, not stone — the wall around
  // it is a boarded timber wall and a dressed stone surround would lie.
  for (const s of [-1, 1]) {
    const g = box(0.10, h + 0.16, 0.115, 1);
    g.translate(s * (w / 2 + 0.05), 0, 0.03);
    put(g); B.joinery.push(g);
  }
  const head = box(w + 0.32, 0.15, 0.13, 1);
  head.translate(0, h / 2 + 0.08, 0.035);
  put(head); B.joinery.push(head);
  const cornice = box(w + 0.44, 0.065, 0.19, 1);
  cornice.translate(0, h / 2 + 0.19, 0.06);
  put(cornice); B.joinery.push(cornice);

  // sill: a projecting board with a lip, so rain runs off the wall
  const sill = box(w + 0.38, 0.075, 0.24, 1);
  sill.translate(0, -h / 2 - 0.04, 0.07);
  put(sill); B.joinery.push(sill);

  // two sliding sashes and a fixed transom over them
  const transomH = Math.min(0.42, h * 0.18);
  const sashH = h - transomH - 0.05;
  for (const s of [-1, 1]) {
    const { bars, pane } = capizSash(w / 2 - 0.055, sashH - 0.03);
    for (const g of bars) {
      g.translate(s * (w / 4 - 0.01), -h / 2 + sashH / 2 + 0.02, 0.045);
      put(g);
      B.joinery.push(g);
    }
    pane.translate(s * (w / 4 - 0.01), -h / 2 + sashH / 2 + 0.02, 0.045);
    put(pane);
    B.capiz.push(pane);
  }
  // transom: a fixed band of shell over the sashes
  const tr = box(w - 0.02, transomH - 0.06, 0.032, 1);
  tr.translate(0, h / 2 - transomH / 2 - 0.02, 0.06);
  put(tr); B.capiz.push(tr);
  for (let i = 1; i < 4; i++) {
    const m = box(0.022, transomH - 0.08, 0.05, 1);
    m.translate(-w / 2 + 0.06 + ((w - 0.12) * i) / 4, h / 2 - transomH / 2 - 0.02, 0.075);
    put(m); B.joinery.push(m);
  }
  const trRail = box(w, 0.05, 0.06, 1);
  trRail.translate(0, h / 2 - transomH - 0.01, 0.07);
  put(trRail); B.joinery.push(trRail);

  // persiana: two louvred leaves folded flat against the wall either side.
  // They are what gives the elevation its depth — a window in a board wall with
  // no shutter reads as a hole cut in paper.
  //
  // They hang ON the plaster, not 75 mm in front of it. Standing them off the
  // wall was meant to read as a shadow gap, but with nothing behind them a
  // 0.43 m louvred leaf is a slab hovering over the wall — the one thing in the
  // bay that looked pasted on. 14 mm is enough to keep them out of the plane
  // and the z-buffer while still reading as a door folded back against the
  // house, and each leaf gets hinge straps back to its jamb so it is visibly
  // hung on something.
  for (const s of [-1, 1]) {
    const sw = 0.43, sh = h * 0.94;
    const hinge = s * (w / 2 + 0.10);
    // A leaf whose outer edge would run off the end of the wall (a bay corner,
    // the return at a doorway) is cut down instead of overhanging into air.
    let leafW = sw;
    if (win.u0 != null && win.u1 != null) {
      const outer = s > 0 ? win.u1 - u : u - win.u0;
      leafW = Math.min(sw, Math.max(0, outer - 0.10));
    }
    if (leafW < 0.2) continue;
    for (const g of shutter(leafW, sh)) {
      g.translate(s * (w / 2 + 0.10 + leafW / 2), 0, 0.014);
      put(g);
      B.joinery.push(g);
    }
    // three straps across the joint: a hinge plate on the jamb, a knuckle, and
    // the strap on the leaf — the same detail a real persiana has, and the
    // reason it no longer floats.
    for (const hy of [sh / 2 - 0.14, 0, -sh / 2 + 0.14]) {
      const plate = box(0.11, 0.045, 0.012, 1);
      plate.translate(hinge - s * 0.045, hy, 0.024);
      put(plate); B.ironwork.push(plate);
      const strap = box(0.17, 0.035, 0.010, 1);
      strap.translate(hinge + s * 0.085, hy, 0.022);
      put(strap); B.ironwork.push(strap);
      const knuckle = new THREE.CylinderGeometry(0.014, 0.014, 0.075, 6);
      knuckle.translate(hinge, hy, 0.030);
      put(knuckle); B.ironwork.push(knuckle);
    }
  }

  // ventanilla: the slatted band under the sill that every house of this age
  // has, and the reason the rooms can breathe with the shutters closed.
  const vw = w + 0.10, vh = 0.30;
  const back = box(vw, vh, 0.05, 1);
  back.translate(0, -h / 2 - 0.24, 0.035);
  put(back); B.dark.push(back);
  for (let i = 0; i < 5; i++) {
    const s = box(vw - 0.06, 0.022, 0.075, 1);
    s.rotateX(0.5);
    s.translate(0, -h / 2 - 0.24 - vh / 2 + 0.035 + (i * (vh - 0.05)) / 4, 0.075);
    put(s); B.joinery.push(s);
  }
  for (const s of [-1, 1]) {
    const jamb = box(0.05, vh + 0.04, 0.09, 1);
    jamb.translate(s * (vw / 2 + 0.02), -h / 2 - 0.24, 0.06);
    put(jamb); B.joinery.push(jamb);
  }
}

// --- 5. the entrance --------------------------------------------------------
// A pair of narra pilasters under a carved beam, with a calado frieze above it.
// The door itself is architecture.js's two entrance leaves; this is the frame
// a visitor would actually see from the drive.
function entrance(arch, B) {
  const gf = LEVELS.find((l) => l.id === 'GF');
  const d = gf.doors.find((x) => x.entrance);
  if (!d) return;
  const out = 1, c = d.c, u = d.at;
  const put = (g) => { mount(g, d.axis, c, out, u); };

  for (const s of [-1, 1]) {
    const base = box(0.44, 0.24, 0.30, 1);
    base.translate(s * 1.36, 0.12, 0.06); put(base); B.stone.push(base);
    const shaft = box(0.28, 2.10, 0.16, 1);
    shaft.translate(s * 1.36, 1.29, 0.06); put(shaft); B.joinery.push(shaft);
    const cap = box(0.40, 0.14, 0.24, 1);
    cap.translate(s * 1.36, 2.41, 0.08); put(cap); B.joinery.push(cap);
    // a carved bracket under the beam, stepped like a corbel
    for (let i = 0; i < 3; i++) {
      const br = box(0.10 + i * 0.06, 0.07, 0.14 + i * 0.03, 1);
      br.translate(s * (1.22 - i * 0.04), 2.53 - i * 0.06, 0.07);
      put(br); B.joinery.push(br);
    }
  }
  // the beam and the calado band over it
  const beam = box(3.02, 0.22, 0.26, 1);
  beam.translate(0, 2.60, 0.08); put(beam); B.joinery.push(beam);
  const rail = box(2.92, 0.06, 0.20, 1);
  rail.translate(0, 2.72, 0.09); put(rail); B.joinery.push(rail);
  for (let i = 0; i < 13; i++) {
    const bar = box(0.05, 0.20, 0.12, 1);
    bar.translate(-1.36 + (i * 2.72) / 12, 2.86, 0.08);
    put(bar); B.joinery.push(bar);
  }
  const cap = box(2.96, 0.08, 0.22, 1);
  cap.translate(0, 3.0, 0.09); put(cap); B.joinery.push(cap);

  // the transom over the doors: real shell, in a rail-and-stile frame
  const ty = 2.28, th = 0.22;
  const pane = new THREE.PlaneGeometry(2.0, th - 0.05);
  pane.translate(0, ty, 0.02); put(pane); B.capiz.push(pane);
  for (const s of [-1, 1]) {
    const st = box(0.07, th, 0.07, 1);
    st.translate(s * 1.02, ty, 0.045); put(st); B.joinery.push(st);
  }
  for (const yy of [ty - th / 2, ty + th / 2]) {
    const r = box(2.10, 0.06, 0.08, 1);
    r.translate(0, yy, 0.045); put(r); B.joinery.push(r);
  }
}

// --- 6. the portico ---------------------------------------------------------
// architecture.js raises four 0.28 m posts and a flat slab over the steps. A
// Filipino portico is a timber canopy: turned posts on stone plinths, a hipped
// iron roof with a metre of gutter overhang, and a calado frieze between the
// post heads so the canopy reads as built rather than as a concrete tray.
function portico(B) {
  const PX = [-4.2, -1.4, 1.4, 4.2];
  const PZ = 13.4;
  for (const x of PX) {
    const plinth = g3(0.52, 0.46, 0.52);
    plinth.translate(x, 0.23, PZ);
    B.stone.push(plinth);
    // a turned shaft: three drums with a bead between them, not a plain box
    for (const [y0, h] of [[0.46, 0.96], [1.50, 0.96], [2.54, 0.66]]) {
      const drum = new THREE.CylinderGeometry(0.155, 0.175, h, 10);
      drum.translate(x, y0 + h / 2, PZ);
      B.joinery.push(drum);
      const bead = new THREE.TorusGeometry(0.17, 0.022, 5, 12);
      bead.rotateX(Math.PI / 2);
      bead.translate(x, y0 - 0.02, PZ);
      B.joinery.push(bead);
    }
    const cap = g3(0.40, 0.12, 0.40);
    cap.translate(x, 3.26, PZ);
    B.joinery.push(cap);
  }
  // frieze: a rail and a run of brackets between the posts, on the south face
  const railY = 3.16;
  const rail = g3(10.4, 0.10, 0.14);
  rail.translate(0, railY, PZ + 0.26);
  B.joinery.push(rail);
  for (let i = 0; i < 29; i++) {
    const x = -4.9 + (i * 9.8) / 28;
    const bar = g3(0.06, 0.20, 0.10);
    bar.translate(x, railY - 0.16, PZ + 0.26);
    B.joinery.push(bar);
  }
  const rail2 = g3(10.4, 0.09, 0.14);
  rail2.translate(0, railY - 0.30, PZ + 0.26);
  B.joinery.push(rail2);

  // the canopy roof: a hip with 0.4 m of overhang on every side. 30 degrees,
  // because a portico that is almost flat is a carport.
  B.roof.push(...hipRoof(-5.35, 11.0, 5.35, 15.4, 3.46, 1.18, 0.42, B));
  // the canopy soffit: boards, not the underside of a concrete tray. This is
  // the one ceiling in the game a visitor looks up at from outside.
  const soffit = new THREE.PlaneGeometry(10.6, 4.36);
  soffit.rotateX(Math.PI / 2);
  soffit.translate(0, 3.22, 13.2);
  B.lime.push(soffit);
  // fascia around the slab, deep enough to hide its edge and carry the roof
  for (const [w, h, d, x, y, z] of [
    [10.9, 0.36, 0.12, 0, 3.28, 15.44], [10.9, 0.36, 0.12, 0, 3.28, 10.96],
    [0.12, 0.36, 4.48, -5.38, 3.28, 13.2], [0.12, 0.36, 4.48, 5.38, 3.28, 13.2],
  ]) {
    const g = g3(w, h, d);
    g.translate(x, y, z);
    B.joinery.push(g);
  }
  // rafter tails under the eaves, on the two long sides
  for (let i = 0; i < 17; i++) {
    const x = -5.1 + (i * 10.2) / 16;
    for (const z of [15.3, 11.1]) {
      const g = g3(0.075, 0.13, 0.62);
      g.translate(x, 3.27, z);
      B.joinery.push(g);
    }
  }
}

// --- 7. hipped roofs --------------------------------------------------------
// A hip is four slopes meeting a ridge, with the two end faces triangles. Built
// as explicit triangles so the eaves line stays straight to the millimetre, and
// wound upward: a slope lit from underneath is the one sign error that turns a
// roof into a black hole.
function hipRoof(x0, z0, x1, z1, yE, rise, ov, B) {
  const xa = x0 - ov, xb = x1 + ov, za = z0 - ov, zb = z1 + ov;
  const w = x1 - x0, d = z1 - z0;
  const alongX = w >= d;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const yR = yE + rise;
  const pos = [], uv = [];
  const vert = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); };
  const quad = (a, b, c, d2, ua, va) => {
    vert(...a, 0, 0); vert(...b, ua, 0); vert(...c, ua, va);
    vert(...a, 0, 0); vert(...c, ua, va); vert(...d2, 0, va);
  };

  if (alongX) {
    const half = (zb - za) / 2, slope = Math.hypot(half, rise);
    const rx0 = xa + half, rx1 = xb - half;      // ridge ends
    // south slope (the za side) and north slope (zb), both to the ridge
    quad([xa, yE, za], [xb, yE, za], [rx1, yR, cz], [rx0, yR, cz], xb - xa, slope);
    quad([xb, yE, zb], [xa, yE, zb], [rx0, yR, cz], [rx1, yR, cz], xb - xa, slope);
    // the two hips, as triangles
    for (const [p, q, r, flip] of [
      [[xb, yE, za], [xb, yE, zb], [rx1, yR, cz], false],
      [[xa, yE, zb], [xa, yE, za], [rx0, yR, cz], true],
    ]) {
      if (!flip) { vert(...p, 0, 0); vert(...q, slope, 0); vert(...r, slope / 2, slope); }
      else { vert(...p, 0, 0); vert(...q, 0, slope); vert(...r, slope, slope); }
    }
    // ridge cap and the rafter tails that show under the eave
    const cap = g3(rx1 - rx0 + 0.24, 0.10, 0.26, 1);
    cap.translate(cx, yR + 0.05, cz);
    B.iron.push(cap);
    const n = Math.max(4, Math.round((xb - xa) / 0.62));
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      for (const z of [za + 0.02, zb - 0.02]) {
        const g = g3(0.075, 0.135, ov + 0.22);
        g.translate(x, yE - 0.07, z + (z < cz ? 0.11 : -0.11));
        B.joinery.push(g);
      }
    }
    // fascia boards along the two eaves
    for (const z of [za, zb]) {
      const f = g3(xb - xa, 0.20, 0.055);
      f.translate(cx, yE - 0.10, z);
      B.iron.push(f);
    }
  } else {
    const half = (xb - xa) / 2, slope = Math.hypot(half, rise);
    const rz0 = za + half, rz1 = zb - half;
    quad([xa, yE, zb], [xa, yE, za], [cx, yR, rz0], [cx, yR, rz1], zb - za, slope);
    quad([xb, yE, za], [xb, yE, zb], [cx, yR, rz1], [cx, yR, rz0], zb - za, slope);
    for (const [p, q, r, flip] of [
      [[xa, yE, za], [xb, yE, za], [cx, yR, rz0], true],
      [[xb, yE, zb], [xa, yE, zb], [cx, yR, rz1], false],
    ]) {
      if (!flip) { vert(...p, 0, 0); vert(...q, slope, 0); vert(...r, slope / 2, slope); }
      else { vert(...p, 0, 0); vert(...q, 0, slope); vert(...r, slope, slope); }
    }
    const cap = g3(0.26, 0.10, rz1 - rz0 + 0.24, 1);
    cap.translate(cx, yR + 0.05, cz);
    B.iron.push(cap);
    const n = Math.max(4, Math.round((zb - za) / 0.62));
    for (let i = 0; i <= n; i++) {
      const z = za + ((zb - za) * i) / n;
      for (const x of [xa + 0.02, xb - 0.02]) {
        const g = g3(ov + 0.22, 0.135, 0.075);
        g.translate(x + (x < cx ? 0.11 : -0.11), yE - 0.07, z);
        B.joinery.push(g);
      }
    }
    for (const x of [xa, xb]) {
      const f = g3(0.055, 0.20, zb - za);
      f.translate(x, yE - 0.10, cz);
      B.iron.push(f);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const wx = pos[i + 6] - pos[i], wy = pos[i + 7] - pos[i + 1], wz = pos[i + 8] - pos[i + 2];
    if (uz * wx - ux * wz < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
      }
    }
  }
  geo.computeVertexNormals();
  return [geo];
}

// A GABLE, for the two pavilions that face the drive. The house had five
// separate hips on the rooftop and every one of them was the same shape, so
// the skyline above the parapet was a row of identical dark lozenges. A gable
// end is what an ancestral house turns towards its visitors: a triangle of
// limewashed wall with a vent in it, bargeboards along the rake and the ridge
// running back into the roof. Two of them, facing south, are enough to break
// the line without turning the roof into a village.
//
// Ridge runs north-south; the gable ends face ±z.
function gableRoof(x0, z0, x1, z1, yE, rise, ov, B) {
  const xa = x0 - ov, xb = x1 + ov, za = z0 - ov, zb = z1 + ov;
  const cx = (x0 + x1) / 2;
  const yR = yE + rise;
  const pos = [], uv = [];
  const vert = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); };

  // two slopes
  const w = xb - xa, slope = Math.hypot(w / 2, rise);
  vert(xa, yE, za, 0, 0); vert(xa, yE, zb, zb - za, 0); vert(cx, yR, zb, zb - za, slope);
  vert(xa, yE, za, 0, 0); vert(cx, yR, zb, zb - za, slope); vert(cx, yR, za, 0, slope);
  vert(xb, yE, zb, 0, 0); vert(xb, yE, za, zb - za, 0); vert(cx, yR, za, zb - za, slope);
  vert(xb, yE, zb, 0, 0); vert(cx, yR, za, zb - za, slope); vert(cx, yR, zb, 0, slope);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // wind every slope upward: a roof lit from below is a black hole
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const wx = pos[i + 6] - pos[i], wy = pos[i + 7] - pos[i + 1], wz = pos[i + 8] - pos[i + 2];
    if (uz * wx - ux * wz < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
      }
    }
  }
  geo.computeVertexNormals();
  B.roof.push(geo);

  // The gable wall itself: a triangle of lime render standing on the
  // pavilion's top plate, flush with the rake so the bargeboard covers the
  // join. Wound outward — the north end faces -z, the south end +z.
  for (const [z, flip] of [[za, true], [zb, false]]) {
    const g = new THREE.BufferGeometry();
    const tri = flip
      ? [xb, yE, z, xa, yE, z, cx, yR, z]
      : [xa, yE, z, xb, yE, z, cx, yR, z];
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, xb - xa, 0, (xb - xa) / 2, rise], 2));
    g.computeVertexNormals();
    B.lime.push(g);
    // the soffit behind the gable, closing the gap between the wall head and
    // the overhanging rake: from the room's edge out to the eave line
    const inner = z === za ? z0 : z1;
    const sof = box(xb - xa, 0.045, Math.abs(z - inner), 1);
    sof.translate(cx, yE - 0.02, (z + inner) / 2);
    B.joinery.push(sof);
    // a fascia at the wall head, so the 12 cm between the top of the render
    // and the underside of the roof is a shadow line and not a slot of sky
    const fascia = box(xb - xa, 0.24, 0.07, 1);
    fascia.translate(cx, yE - 0.10, z);
    B.iron.push(fascia);
  }

  // bargeboards on the four rakes, and the ridge cap
  const ang = Math.atan2(rise, (xb - xa) / 2);
  const blen = Math.hypot((xb - xa) / 2, rise);
  for (const z of [za, zb]) {
    for (const [x0b, dir] of [[xa, 1], [xb, -1]]) {
      const b = g3(blen, 0.20, 0.09);
      b.rotateZ(dir * ang);
      b.translate((x0b + cx) / 2, (yE + yR) / 2 - 0.02, z);
      B.joinery.push(b);
    }
  }
  const cap = g3(0.26, 0.10, zb - za + 0.2, 1);
  cap.translate(cx, yR + 0.04, (za + zb) / 2);
  B.iron.push(cap);

  // Ridge cresting: a run of small iron finials along the ridge. A roof this
  // low is seen almost entirely in silhouette from the drive, and a plain ridge
  // cap gives that silhouette nothing to read.
  const run = zb - za;
  const n = Math.max(2, Math.round(run / 0.55));
  for (let i = 0; i <= n; i++) {
    const z = za + 0.2 + ((run - 0.4) * i) / n;
    const stem = g3(0.035, 0.30, 0.035, 1);
    stem.translate(cx, yR + 0.20, z);
    B.iron.push(stem);
    const bead = new THREE.SphereGeometry(0.055, 6, 5);
    bead.translate(cx, yR + 0.37, z);
    B.iron.push(bead);
    if (i < n) {
      const arc = new THREE.TorusGeometry(0.13, 0.016, 4, 8, Math.PI);
      arc.rotateY(Math.PI / 2);
      arc.rotateZ(0);
      arc.translate(cx, yR + 0.20, z + (run - 0.4) / (2 * n));
      B.iron.push(arc);
    }
  }
  // a taller finial at each end of the ridge
  for (const z of [za + 0.15, zb - 0.15]) {
    const spike = new THREE.ConeGeometry(0.05, 0.55, 6);
    spike.translate(cx, yR + 0.42, z);
    B.iron.push(spike);
  }
}

// Which pavilions get a gable and which keep their hip. The two that face the
// drive are gabled; the rest stay low hips, so the roofscape has a hierarchy
// instead of five copies of one shape.
const GABLES = new Set(['FF4-06', 'FF4-04']);

// Over every pavilion that is meant to be roofed. The terrace and the
// observatory keep their open sky, which is the whole point of them.
function pavilionRoofs(B) {
  const f4 = LEVELS.find((l) => l.id === 'F4');
  let n = 0;
  for (const r of f4.rooms) {
    if (OPEN_PAVILIONS.includes(r.id)) continue;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const short = Math.min(w, d);
    // 30 to 36 degrees: a Filipino roof is low and wide, not a slate spire, but
    // the old 0.31-of-the-short-side cap kept every ridge so far below the
    // parapet that from the drive the house had no roof at all.
    const rise = Math.min(3.2, short * 0.40);
    // A wide eave, so the roof shows above the parapet and its shadow falls on
    // the wall. The two pavilions that stand a metre apart on the west deck
    // take a tighter one so their roofs do not interpenetrate.
    const tight = r.id === 'FF4-06' || r.id === 'FF4-07';
    const ov = tight ? 0.5 : 1.15;
    if (GABLES.has(r.id)) gableRoof(r.x0, r.z0, r.x1, r.z1, EAVE, rise, ov, B);
    else B.roof.push(...hipRoof(r.x0, r.z0, r.x1, r.z1, EAVE, rise, ov, B));
    n++;
  }
  return n;
}

// --- 7b. cross-gables on the side elevations ---------------------------------
//
// The front elevation has had two gables for a while; the east and west
// elevations were still a four-storey wall with a flat line on top, because
// every pavilion inside the footprint turns its gable end north or south and
// nothing faces sideways. From the drive the house had a roofline; from the
// grounds it was a box.
//
// These are proper cross-gables, not dormers: a gabled wing whose ridge runs
// out through the pavilion's flank, with its own gable end, rakes and barge
// boards standing clear of the roof plane. They sit on the pavilion roofs at
// the roof deck (EAVE), so nothing on the fourth floor moves and the walkable
// terrace is untouched.

// One cross-gable. `wall` is the pavilion's flank (x), `dir` points out of the
// house, `cz` is the centre of the wing along z.
function crossGable(B, { wall, dir, cz, halfW = 1.9, depth = 1.9, rise = 1.75 }) {
  const xOut = wall + dir * depth;
  const xIn = wall - dir * 0.9;       // buried in the pavilion roof
  const z0 = cz - halfW, z1 = cz + halfW;
  // Stand the wing 12 cm proud of the pavilion eave so its two roof planes sit
  // above the roof they cross instead of fighting it along the junction.
  const yE = EAVE + 0.12;
  const yR = yE + rise;
  const ov = 0.24;
  const xa = Math.min(xIn, xOut), xb = Math.max(xIn, xOut);
  const za = z0 - ov, zb = z1 + ov;

  // The gable end wall: a triangle standing on the wing's top plate at the
  // outer face. It has to be wound so its normal points OUT of the house — a
  // triangle wound the other way is back-face culled and the gable simply is
  // not there. That is what happened on the east flank: the wing existed, its
  // vent and ridge cast shadows, and the wall itself was invisible.
  const g = new THREE.BufferGeometry();
  const tri = dir > 0
    ? [xOut, yE, zb, xOut, yE, za, xOut, yR, cz]
    : [xOut, yE, za, xOut, yE, zb, xOut, yR, cz];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, zb - za, 0, (zb - za) / 2, rise], 2));
  g.computeVertexNormals();
  B.lime.push(g);

  // the two flanks of the wing, from the eave to the rake, in lime render.
  // Two triangles, not four loose vertices: an unindexed BufferGeometry with a
  // vertex count that is not a multiple of three loses the remainder, so the
  // first version drew half a flank and left a wedge of sky under the rake.
  for (const [z, flip] of [[za, true], [zb, false]]) {
    const w = new THREE.BufferGeometry();
    const q = flip
      ? [xOut, yE, z, xa, yE, z, xa, yR, z,
        xOut, yE, z, xa, yR, z, xOut, yR, z]
      : [xa, yE, z, xOut, yE, z, xOut, yR, z,
        xa, yE, z, xOut, yR, z, xa, yR, z];
    w.setAttribute('position', new THREE.Float32BufferAttribute(q, 3));
    w.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 0, xOut - xa, 0, xOut - xa, rise,
      0, 0, xOut - xa, rise, 0, rise,
    ], 2));
    w.computeVertexNormals();
    B.lime.push(w);
  }

  // roof: ridge along x at the wing's centre, two planes falling to ±z
  const ridgeY = yR;
  const pos = [], uv = [];
  const vert = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); };
  const slope = Math.hypot(halfW + ov, rise);
  const run = xb - xa;
  vert(xa, yE, za, 0, 0); vert(xb, yE, za, run, 0); vert(xb, ridgeY, cz, run, slope);
  vert(xa, yE, za, 0, 0); vert(xb, ridgeY, cz, run, slope); vert(xa, ridgeY, cz, 0, slope);
  vert(xb, yE, zb, 0, 0); vert(xa, yE, zb, run, 0); vert(xa, ridgeY, cz, run, slope);
  vert(xb, yE, zb, 0, 0); vert(xa, ridgeY, cz, run, slope); vert(xb, ridgeY, cz, 0, slope);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const wx = pos[i + 6] - pos[i], wy = pos[i + 7] - pos[i + 1], wz = pos[i + 8] - pos[i + 2];
    if (uz * wx - ux * wz < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
      }
    }
  }
  rg.computeVertexNormals();
  B.roof.push(rg);

  // barge boards along the two rakes of the outer end, and the ridge cap
  // The rake lies in the y-z plane at constant x, so the board is first turned
  // to run along z and then tilted about x. At the lower z end the board climbs
  // toward +z (tilt one way); at the upper end it climbs toward -z (the other).
  const ang = Math.atan2(rise, halfW + ov);
  const blen = Math.hypot(halfW + ov, rise);
  for (const [zEnd, sgn] of [[za, -1], [zb, 1]]) {
    const b = g3(blen, 0.20, 0.10);
    b.rotateY(Math.PI / 2);
    b.rotateX(sgn * ang);
    b.translate(xOut + dir * 0.03, (yE + yR) / 2 - 0.04, (zEnd + cz) / 2);
    B.joinery.push(b);
  }
  const cap = g3(xb - xa + 0.16, 0.09, 0.24, 1);
  cap.translate((xa + xb) / 2, ridgeY + 0.04, cz);
  B.iron.push(cap);

  // a louvred vent in the gable end, so the triangle is not a blank panel
  const vw = 0.62, vh = 0.40;
  const vy = yE + rise * 0.34;
  const back = g3(0.05, vh, vw, 1);
  back.translate(xOut + dir * 0.02, vy, cz);
  B.dark.push(back);
  for (let i = 0; i < 4; i++) {
    const s = g3(0.07, 0.035, vw - 0.06, 1);
    s.rotateZ(0.5 * dir);
    s.translate(xOut + dir * 0.04, vy - vh / 2 + 0.05 + i * ((vh - 0.1) / 3), cz);
    B.joinery.push(s);
  }
  for (const sz of [-1, 1]) {
    const j = g3(0.08, vh + 0.05, 0.05, 1);
    j.translate(xOut + dir * 0.03, vy, cz + sz * (vw / 2 + 0.02));
    B.joinery.push(j);
  }

  // the wing's floor line on the elevation: a band under the gable, so it is a
  // wing and not a triangle growing out of the roof
  const band = g3(0.16, 0.18, zb - za + 0.06, 1);
  band.translate(xOut + dir * 0.02, yE - 0.10, cz);
  B.iron.push(band);
}

function crossGables(B) {
  // West flank of the archive pavilion, west flank of the maintenance room,
  // east flank of the bell room — one over each side elevation, and two on the
  // west because the west elevation is the long one.
  //
  // Sized to actually read from the grounds. The pavilion hips are 3.2 m tall
  // from the eave, so a cross-gable whose ridge is lower is swallowed whole by
  // the roof it crosses and only its tip shows above the parapet — which is
  // what the first attempt did. These ride just over the main ridge, the way a
  // cross wing on a real house does, and their ends stand a metre clear of the
  // pavilion eaves so the gable wall and its bargeboards are in plain sight.
  crossGable(B, { wall: -22, dir: -1, cz: -5.4, halfW: 2.7, depth: 2.15, rise: 3.2 });
  crossGable(B, { wall: -22, dir: -1, cz: 6.0, halfW: 2.4, depth: 2.0, rise: 3.05 });
  // The east pavilion is roofed north-south, so its own ridge runs straight
  // across the line this wing crosses on: at 3.15 m the wing's ridge landed
  // 4 cm under the main one and disappeared. It has to clear it.
  crossGable(B, { wall: 14, dir: 1, cz: 7.0, halfW: 2.8, depth: 2.25, rise: 3.75 });
}

// --- 7c. the projecting bay on the west elevation ---------------------------
// A media agua: the ground-floor window bay carried out past the wall on a
// stone plinth, glazed on its three outer faces, under its own shallow hip.
// The house's own window stays where it is, so from indoors the room gains a
// shallow alcove behind its sash instead of losing a window.
//
// It is centred on the west window at z = 2 and stops clear of the service door
// at z = 6 and of the next window at z = -2, so no opening is covered.
const WEST_BAY = { z0: 0.42, z1: 3.6, depth: 1.34, face: -24.21 };

function westBay(arch, B, colliders) {
  const { z0, z1, depth, face } = WEST_BAY;
  const xOut = face - depth;
  const cz = (z0 + z1) / 2;
  const w = z1 - z0;
  const BASE = 1.0, SILL = 1.06, HEAD = 3.18, EAVE = 3.42;

  // stone plinth, carried slightly proud of the glazing above it
  const base = box(depth + 0.14, BASE, w + 0.16, 1);
  base.translate(face - depth / 2 - 0.03, BASE / 2, cz);
  B.stone.push(base);
  const cap = box(depth + 0.22, 0.09, w + 0.24, 1);
  cap.translate(face - depth / 2 - 0.03, BASE - 0.045, cz);
  B.joinery.push(cap);

  // corner posts at the two free corners, and the mullions between the lights
  const lights = 3;
  const mullZ = [z0];
  for (let i = 1; i < lights; i++) mullZ.push(z0 + (w * i) / lights);
  mullZ.push(z1);
  for (const z of mullZ) {
    const p = box(0.14, HEAD - SILL, 0.14, 1);
    p.translate(xOut + 0.07, (SILL + HEAD) / 2, z);
    B.joinery.push(p);
  }
  // the two returns carry a single light each, so the bay reads in the round
  for (const [z, side] of [[z0, -1], [z1, 1]]) {
    const post = box(depth, HEAD - SILL, 0.13, 1);
    post.translate(face - depth / 2, (SILL + HEAD) / 2, z + side * 0.065);
    B.joinery.push(post);
    const pane = new THREE.PlaneGeometry(depth - 0.2, HEAD - SILL - 0.1);
    pane.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
    pane.translate(face - depth / 2, (SILL + HEAD) / 2, z + side * 0.01);
    B.capiz.push(pane);
  }
  // the front lights: shell panes with a transom band over them
  for (let i = 0; i < lights; i++) {
    const za = mullZ[i] + 0.07, zb = mullZ[i + 1] - 0.07;
    const pane = new THREE.PlaneGeometry(zb - za, HEAD - SILL - 0.12);
    pane.rotateY(-Math.PI / 2);
    pane.translate(xOut + 0.005, (SILL + HEAD) / 2, (za + zb) / 2);
    B.capiz.push(pane);
    // muntins: one horizontal rail, two verticals
    const rail = box(0.05, 0.045, zb - za, 1);
    rail.translate(xOut + 0.03, SILL + (HEAD - SILL) * 0.62, (za + zb) / 2);
    B.joinery.push(rail);
    for (const f of [1 / 3, 2 / 3]) {
      const m = box(0.05, HEAD - SILL - 0.12, 0.035, 1);
      m.translate(xOut + 0.03, (SILL + HEAD) / 2, za + (zb - za) * f);
      B.joinery.push(m);
    }
  }
  // sill board and head beam
  const sill = box(depth + 0.2, 0.09, w + 0.2, 1);
  sill.translate(face - depth / 2 - 0.02, SILL - 0.02, cz);
  B.joinery.push(sill);
  const head = box(depth + 0.18, 0.22, w + 0.18, 1);
  head.translate(face - depth / 2 - 0.02, HEAD + 0.11, cz);
  B.joinery.push(head);
  const cornice = box(depth + 0.30, 0.07, w + 0.30, 1);
  cornice.translate(face - depth / 2 - 0.02, EAVE - 0.04, cz);
  B.joinery.push(cornice);

  // roof: a shallow hip, kept under the first-floor line at 4.2 m
  B.roof.push(...hipRoof(xOut, z0, face, z1, EAVE, 0.55, 0.3, B));
  // gutter on the outer eave, with a shoe down to the plinth
  const gut = box(0.16, 0.13, w + 0.7, 1);
  gut.translate(xOut - 0.33, EAVE - 0.16, cz);
  B.iron.push(gut);
  const dp = new THREE.CylinderGeometry(0.055, 0.055, 3.2, 8);
  dp.translate(xOut - 0.30, 1.72, z1 + 0.28);
  B.iron.push(dp);
  for (const yy of [1.1, 2.4]) {
    const br = box(0.24, 0.05, 0.06, 1);
    br.translate(xOut - 0.17, yy, z1 + 0.28);
    B.iron.push(br);
  }

  // The bay is a solid volume in the yard: three walls, so a body cannot walk
  // through the glazing.
  colliders.push({ x1: xOut, x2: xOut + 0.09, z1: z0, z2: z1, kind: 'wall', y0: 0, y1: EAVE });
  colliders.push({ x1: xOut, x2: face, z1: z0 - 0.02, z2: z0 + 0.09, kind: 'wall', y0: 0, y1: EAVE });
  colliders.push({ x1: xOut, x2: face, z1: z1 - 0.09, z2: z1 + 0.02, kind: 'wall', y0: 0, y1: EAVE });
  return { z0, z1, xOut, eave: EAVE };
}

// --- 8. rain goods ----------------------------------------------------------
// A hipped roof needs a gutter at the eaves and a downpipe at the corner. Four
// pipes on the stone base, in the bays between windows, and a pipe at each
// pavilion corner dropping to the azotea: if the roof is built, the water has
// to have somewhere to go.
function rainGoods(B, arch, gf) {
  const fp = gf.footprint;
  const faces = [
    ['x', fp.z1, 1, fp.x0 + 3, fp.x1 - 3],
    ['x', fp.z0, -1, fp.x0 + 3, fp.x1 - 3],
    ['z', fp.x0, -1, fp.z0 + 3, fp.z1 - 3],
    ['z', fp.x1, 1, fp.z0 + 3, fp.z1 - 3],
  ];
  for (const [axis, line, out, a, b] of faces) {
    // pick stations away from the windows on that wall
    const near = arch.windows
      .filter((w) => w.level !== 'F4' && w.axis === axis && Math.abs(w.c - line) < 0.05)
      .map((w) => (w.a + w.b) / 2);
    const stations = [];
    for (let u = a; u <= b; u += 3.2) {
      if (near.every((n) => Math.abs(n - u) > 1.05)) stations.push(u);
      if (stations.length >= 3) break;
    }
    // The porch canopy covers the middle 10.7 m of the front face. An 11.3 m
    // downpipe dropped there does not run down a wall at all: it goes straight
    // up through the canopy roof and stands in the drive like a flagpole.
    for (let i = stations.length - 1; i >= 0; i--) {
      if (axis === 'x' && Math.abs(line - fp.z1) < 0.01 && Math.abs(stations[i]) < 6.35) stations.splice(i, 1);
    }
    for (const u of stations) {
      const pipe = new THREE.CylinderGeometry(0.065, 0.065, 11.3, 8);
      pipe.translate(0, 5.75, 0.16);
      mount(pipe, axis, line, out, u);
      B.iron.push(pipe);
      for (const y of [2.4, 6.2, 9.8]) {
        const br = box(0.05, 0.07, 0.18, 1);
        br.translate(0, 0, 0.10);
        mount(br, axis, line, out, u);
        br.translate(0, y, 0);
        B.iron.push(br);
      }
      // the shoe at the bottom, turning the water away from the stone
      const shoe = new THREE.CylinderGeometry(0.065, 0.075, 0.42, 8);
      shoe.rotateX(Math.PI / 2);
      mount(shoe, axis, line, out, u);
      shoe.translate(0, 0.34, 0.20);
      B.iron.push(shoe);
    }
  }
  // Gutters on the pavilion eaves, dropped into the azotea. The gutter has to
  // sit ON the eave, i.e. at the roof's overhang, not 0.45 m from the wall —
  // with the wider eaves that would have hung it in mid-air under the roof.
  const f4 = LEVELS.find((l) => l.id === 'F4');
  for (const r of f4.rooms) {
    if (OPEN_PAVILIONS.includes(r.id)) continue;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const tight = r.id === 'FF4-06' || r.id === 'FF4-07';
    const ov = tight ? 0.5 : 1.15;
    const alongX = w >= d;
    const y = EAVE - 0.19;
    if (alongX) {
      for (const z of [r.z0 - ov - 0.10, r.z1 + ov + 0.10]) {
        const g = g3(w + ov * 2 + 0.2, 0.13, 0.15);
        g.translate((r.x0 + r.x1) / 2, y, z);
        B.iron.push(g);
      }
      const pipe = new THREE.CylinderGeometry(0.06, 0.06, EAVE - PARA, 8);
      pipe.translate(r.x1 + ov * 0.6, (EAVE + PARA) / 2 - 0.3, r.z1 + ov + 0.10);
      B.iron.push(pipe);
    } else {
      for (const x of [r.x0 - ov - 0.10, r.x1 + ov + 0.10]) {
        const g = g3(0.15, 0.13, d + ov * 2 + 0.2);
        g.translate(x, y, (r.z0 + r.z1) / 2);
        B.iron.push(g);
      }
      const pipe = new THREE.CylinderGeometry(0.06, 0.06, EAVE - PARA, 8);
      pipe.translate(r.x1 + ov + 0.10, (EAVE + PARA) / 2 - 0.3, r.z1 + ov * 0.6);
      B.iron.push(pipe);
    }
  }
}

// --- 9. planting ------------------------------------------------------------
// The foot of a tropical house is not a clean line: it is ferns, sansevieria
// and a bougainvillea that somebody stopped pruning. The clumps are simple
// low-poly masses, kept to the bays between doors so no entrance is blocked.
function planting(B, gf) {
  const fp = gf.footprint;
  const doors = gf.doors;
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const faces = [
    ['x', fp.z1, 1, fp.x0 + 1, fp.x1 - 1],
    ['z', fp.x0, -1, fp.z0 + 1, fp.z1 - 1],
    ['x', fp.z0, -1, fp.x0 + 1, fp.x1 - 1],
  ];
  for (const [axis, line, out, a, b] of faces) {
    const blocked = doors
      .filter((d) => d.axis === axis && Math.abs(d.c - line) < 0.05)
      .map((d) => d.at);
    for (let u = a; u <= b; u += 1.55) {
      if (blocked.some((at) => Math.abs(at - u) < 1.5)) continue;
      if (axis === 'x' && line === fp.z1 && Math.abs(u) < 6.4) continue;  // the porch
      // and not inside the projecting west bay: a shrub planted against the
      // wall would come up through its plinth
      if (axis === 'z' && line === fp.x0 && u > WEST_BAY.z0 - 1.2 && u < WEST_BAY.z1 + 1.2) continue;
      const n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const r = 0.20 + rnd() * 0.22;
        const blob = new THREE.SphereGeometry(r, 6, 4);
        blob.scale(1, 0.75 + rnd() * 0.5, 0.9 + rnd() * 0.3);
        const off = 0.42 + rnd() * 0.24;
        if (axis === 'x') blob.translate(u + (rnd() - 0.5) * 0.9, r * 0.8, line + out * off);
        else blob.translate(line + out * off, r * 0.8, u + (rnd() - 0.5) * 0.9);
        B.leaf.push(blob);
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
  cornerPiers(B);
  storeyBands(B);

  for (const win of arch.windows) {
    const level = LEVELS.find((l) => l.id === win.level);
    if (!level) continue;
    windowDressing(win, level, B);
  }

  entrance(arch, B);
  portico(B);
  const roofed = pavilionRoofs(B);
  crossGables(B);
  const bay = westBay(arch, B, colliders);
  arch.westBay = bay;
  rainGoods(B, arch, gf);
  planting(B, gf);

  emit(scene, B);
  for (const c of colliders) arch.colliders.push(c);
  return {
    meshes: Object.keys(B).filter((k) => B[k].length),
    pieces: Object.values(B).reduce((n, a) => n + a.length, 0),
    roofed,
    colliders: colliders.length,
  };
}

export { OPEN_PAVILIONS, hipRoof, emit, buckets, windowDressing, TE as WALL_THICKNESS };
