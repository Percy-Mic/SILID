// ARCHITECTURE — turns the plan into a building.
//
// All room boundaries that lie on the same line are merged before any wall is
// built. Two rooms that share a wall therefore share ONE wall, not two coplanar
// ones, and a door is cut out of that single wall. That is what makes the
// gallery arch, the foyer entrance and every bedroom door actually open.
//
// Floors are shapes with real holes — the courtyard, the stair tower, the
// basement stair — so there is no surface where there is no building. Static
// geometry is merged per material: one mesh per floor for walls, one for the
// exterior, one for stairs. Doors are separate because they move.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps, tileAtMetres, tileOf } from './materials.js';
import { LEVELS, STAIR, WINDOWS } from './plan.js';
import { buildFacade } from './facade.js';

const T = 0.22;
const TE = 0.42;

export const architecture = {
  colliders: [],
  floors: [],
  holes: [],
  ramps: [],
  // Walkable surfaces that are not a level slab and not a ramp: stair
  // landings, mostly. `kind: 'sector'` is a polar patch; a bare rect also
  // works. floorHeightAt() consults these before the level slabs.
  extraFloors: [],
  doors: [],
  rooms: [],
  levels: [],
  missingDoors: [],
  windows: [],
  trim: [],
};

function boxUV(g, w, h, d, scale = 1) {
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [uw, uh] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * uw * scale, uv.getY(k) * uh * scale);
    }
  }
  uv.needsUpdate = true;
  g.clearGroups();
}

function box(w, h, d, scale = 0.42) {
  const g = new THREE.BoxGeometry(w, h, d);
  boxUV(g, w, h, d, scale);
  return g;
}

// --- one panelled door leaf ------------------------------------------------
// The old leaf was a flat slab with a shallow rectangle stuck on each face,
// which reads as a painted board no matter what texture it wears. This is the
// reference photograph instead: stiles, a top rail, a mid rail, a bottom rail,
// a mullion splitting the tall upper pair, and three recessed panels — built
// on BOTH faces so the door is right from either side. The frame stands 14 mm
// proud of the panel field and a bead moulding fills the corner of the reveal,
// so light has two edges to break on rather than one cliff.
//
// The brass is part of the same leaf: a knob on a rosette with a shank, a
// keyhole escutcheon above it, and a latch faceplate on the lock edge (the
// only part you see once the door swings open). Everything returns one
// geometry with two groups — wood and brass — so a door is two draw calls,
// not five.
// --- one panelled door leaf ------------------------------------------------
// The leaf is a slab with a raised face frame, recessed panels with a bead
// moulding, its hardware and its hinges — built on BOTH faces, because a door
// standing open is looked at from the room it opens into. The style is chosen
// from the rooms the opening serves, not from the level: a bathroom door and a
// ballroom door are different objects in the same house.
//
//   formal   — stiles, a low mid rail, a mullion and three raised panels, brass
//   entrance — four panels and a deep face frame, ring pulls, brass
//   bedroom  — two tall panels, brass
//   bath     — one panel and a privacy slide, brass
//   service  — vertical boards, iron lever and keyhole, iron kick plate
//
// The metal is a separate geometry group (index 1) in every style, and the
// caller gives the mesh a two-material array: the hardware used to be the same
// walnut as the leaf because the mesh was handed one material for all groups.
function doorLeafGeometry(leafW, leafH, style = 'formal') {
  const T = 0.055;                                   // slab thickness
  const FT = style === 'service' ? 0.015 : 0.019;    // face frame proud of the field
  const SW = style === 'service' ? 0.095 : 0.11;     // stile width
  const R_TOP = 0.13, R_BOT = style === 'service' ? 0.15 : 0.19, R_MID = 0.12;
  const midY = leafH * (style === 'bedroom' ? 0.46 : 0.40);
  const MW = 0.06;
  const u0 = SW, u1 = leafW - SW;
  const wood = [], metal = [];

  const slab = box(leafW, leafH, T, 1);
  slab.translate(leafW / 2, leafH / 2, 0);
  wood.push(slab);

  // Panel fields. A service door is boarded, not panelled: it carries a face
  // frame and plain boards, so its "panels" list is empty on purpose.
  const panels = [];
  if (style === 'bath') {
    panels.push([u0, u1, R_BOT, leafH - R_TOP]);
  } else if (style === 'bedroom') {
    panels.push([u0, u1, midY + R_MID / 2, leafH - R_TOP]);
    panels.push([u0, u1, R_BOT, midY - R_MID / 2]);
  } else if (style === 'entrance') {
    const lowMull = 0.075;
    panels.push([u0, leafW / 2 - MW / 2, midY + R_MID / 2, leafH - R_TOP]);
    panels.push([leafW / 2 + MW / 2, u1, midY + R_MID / 2, leafH - R_TOP]);
    panels.push([u0, leafW / 2 - lowMull / 2, R_BOT, midY - R_MID / 2]);
    panels.push([leafW / 2 + lowMull / 2, u1, R_BOT, midY - R_MID / 2]);
  } else if (style !== 'service') {
    panels.push([u0, leafW / 2 - MW / 2, midY + R_MID / 2, leafH - R_TOP]);
    panels.push([leafW / 2 + MW / 2, u1, midY + R_MID / 2, leafH - R_TOP]);
    panels.push([u0, u1, R_BOT, midY - R_MID / 2]);
  }

  for (const side of [-1, 1]) {
    const z = side * (T / 2 + FT / 2);
    const frame = (g) => { g.translate(0, 0, z); wood.push(g); };
    frame(box(SW, leafH, FT, 1).translate(SW / 2, leafH / 2, 0));
    frame(box(SW, leafH, FT, 1).translate(leafW - SW / 2, leafH / 2, 0));
    if (style === 'service') {
      frame(box(leafW - 2 * SW, R_BOT, FT, 1).translate(leafW / 2, R_BOT / 2, 0));
      frame(box(leafW - 2 * SW, R_TOP, FT, 1).translate(leafW / 2, leafH - R_TOP / 2, 0));
      frame(box(leafW - 2 * SW, 0.10, FT, 1).translate(leafW / 2, leafH * 0.52, 0));
      // board joints: a groove, not a panel. Five boards across the leaf.
      for (let i = 1; i < 5; i++) {
        const g = box(0.012, leafH - R_BOT - R_TOP - 0.06, 0.006, 1);
        g.translate(SW + ((leafW - 2 * SW) * i) / 5, (leafH - R_TOP + R_BOT) / 2, side * (T / 2 + 0.003));
        wood.push(g);
      }
    } else {
      frame(box(leafW - 2 * SW, R_BOT, FT, 1).translate(leafW / 2, R_BOT / 2, 0));
      frame(box(leafW - 2 * SW, R_TOP, FT, 1).translate(leafW / 2, leafH - R_TOP / 2, 0));
      frame(box(leafW - 2 * SW, R_MID, FT, 1).translate(leafW / 2, midY, 0));
      if (style !== 'bedroom' && style !== 'bath') {
        const upY0 = midY + R_MID / 2, upY1 = leafH - R_TOP;
        frame(box(MW, upY1 - upY0, FT, 1).translate(leafW / 2, (upY0 + upY1) / 2, 0));
      }
      // bead moulding around every panel: proud of the field, below the frame
      const BW = 0.024, BD = 0.012;
      const bz = side * (T / 2 + BD / 2);
      for (const [x0, x1, y0, y1] of panels) {
        for (const [w, h, px, py] of [
          [x1 - x0, BW, (x0 + x1) / 2, y0 + BW / 2],
          [x1 - x0, BW, (x0 + x1) / 2, y1 - BW / 2],
          [BW, y1 - y0 - 2 * BW, x0 + BW / 2, (y0 + y1) / 2],
          [BW, y1 - y0 - 2 * BW, x1 - BW / 2, (y0 + y1) / 2],
        ]) {
          const g = box(w, h, BD, 1);
          g.translate(px, py, bz);
          wood.push(g);
        }
      }
    }

    // hardware, per style
    const base = T / 2 + FT;          // the frame face
    const hz = side * base;
    if (style === 'service') {
      // iron lever on a backplate, keyhole above, kick plate below
      const plate = box(0.05, 0.16, 0.007, 1);
      plate.translate(leafW - 0.11, 1.02, side * (base + 0.0035));
      metal.push(plate);
      const lever = box(0.16, 0.028, 0.026, 1);
      lever.translate(leafW - 0.14, 1.04, side * (base + 0.017));
      metal.push(lever);
      const key = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 10);
      key.rotateX(Math.PI / 2);
      key.translate(leafW - 0.11, 1.14, side * (base + 0.004));
      metal.push(key);
      const kick = box(leafW - 0.10, 0.20, 0.006, 1);
      kick.translate(leafW / 2, 0.16, side * (base + 0.003));
      metal.push(kick);
    } else if (style === 'entrance') {
      // ring pull on a rosette, brass; escutcheon above
      const ros = new THREE.CylinderGeometry(0.040, 0.040, 0.008, 16);
      ros.rotateX(Math.PI / 2);
      ros.translate(leafW - 0.13, 1.00, side * (base + 0.004));
      metal.push(ros);
      const ring = new THREE.TorusGeometry(0.055, 0.008, 8, 20);
      ring.translate(leafW - 0.13, 0.95, side * (base + 0.024));
      metal.push(ring);
      const esc = box(0.05, 0.11, 0.007, 1);
      esc.translate(leafW - 0.13, 1.14, side * (base + 0.0035));
      metal.push(esc);
    } else if (style === 'bath') {
      const ros = new THREE.CylinderGeometry(0.030, 0.030, 0.007, 14);
      ros.rotateX(Math.PI / 2);
      ros.translate(leafW - 0.08, 1.00, side * (base + 0.0035));
      metal.push(ros);
      const knob = new THREE.SphereGeometry(0.026, 12, 9);
      knob.translate(leafW - 0.08, 1.00, side * (base + 0.048));
      metal.push(knob);
      const slide = box(0.055, 0.018, 0.010, 1);
      slide.translate(leafW - 0.08, 1.16, side * (base + 0.005));
      metal.push(slide);
    } else {
      const ros = new THREE.CylinderGeometry(0.034, 0.034, 0.007, 14);
      ros.rotateX(Math.PI / 2);
      ros.translate(leafW - 0.075, 1.00, side * (base + 0.0035));
      metal.push(ros);
      const shank = new THREE.CylinderGeometry(0.011, 0.014, 0.03, 12);
      shank.rotateX(Math.PI / 2);
      shank.translate(leafW - 0.075, 1.00, side * (base + 0.022));
      metal.push(shank);
      const knob = new THREE.SphereGeometry(0.03, 14, 10);
      knob.translate(leafW - 0.075, 1.00, side * (base + 0.052));
      metal.push(knob);
      const esc = box(0.046, 0.10, 0.007, 1);
      esc.translate(leafW - 0.075, 1.115, side * (base + 0.0035));
      metal.push(esc);
    }
  }
  // latch faceplate on the lock edge
  const latch = box(0.006, 0.17, 0.03, 1);
  latch.translate(leafW + 0.003, 1.0, 0);
  metal.push(latch);

  // hinges: three cast plates on the hinged edge, with a knuckle standing in
  // the rebate. The pivot is at local x = 0, so these are what make the swing
  // believable from either side of an open door.
  for (const hy of [0.22, leafH / 2, leafH - 0.22]) {
    for (const side of [-1, 1]) {
      const plate = box(0.022, 0.115, 0.032, 1);
      plate.translate(0.014, hy, side * (T / 2 + FT + 0.002));
      metal.push(plate);
    }
    const knuckle = new THREE.CylinderGeometry(0.012, 0.012, 0.115, 8);
    knuckle.translate(-0.004, hy, 0);
    metal.push(knuckle);
  }

  return mergeGeometries([
    mergeGeometries(wood),
    mergeGeometries(metal),
  ], true);
}

// Which leaf a real opening would carry. The rooms on both sides decide it:
// the door between a service hall and the kitchen is a service door even
// though it stands on the ground floor beside the foyer.
function doorStyle(level, d) {
  if (level.id === 'B1') return 'utility';
  const cx = d.axis === 'x' ? d.at : d.c;
  const cz = d.axis === 'x' ? d.c : d.at;
  const kinds = new Set();
  for (const r of level.rooms || []) {
    if (cx >= r.x0 - 0.45 && cx <= r.x1 + 0.45 && cz >= r.z0 - 0.45 && cz <= r.z1 + 0.45) kinds.add(r.kind);
  }
  if (kinds.has('bath')) return 'bath';
  if (['service', 'kitchen', 'pantry', 'laundry', 'storage', 'workshop', 'generator', 'utility']
    .some((k) => kinds.has(k))) return 'service';
  if (kinds.has('bedroom') || kinds.has('dressing')) return 'bedroom';
  return 'formal';
}

// Which way the leaf actually swings is a property of the opening, not of the
// room it serves: a door hung beside a chimney breast or a cupboard run must
// swing the other way or it bangs into masonry on every use. Score both arcs
// against the walls already standing and take the clear side. This is why one
// bath leaf — Linen Room, Her Dressing Room and Master Bath all meet at that
// opening — no longer sweeps a metre into the dressing-room wall.
function pickSwingSign(door, leafW, colliders) {
  const axisX = door.axis === 'x';
  const hx = axisX ? door.at - leafW / 2 : door.c;
  const hz = axisX ? door.c : door.at - leafW / 2;
  const dx = axisX ? 1 : 0, dz = axisX ? 0 : 1;
  const y0 = door.y, y1 = door.y + door.head;
  const score = (sign) => {
    let bad = 0;
    for (let ai = 2; ai <= 9; ai++) {
      const a = (ai / 9) * 1.35 * sign;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = dx * ca + dz * sa, rz = -dx * sa + dz * ca;
      for (let ri = 0; ri <= 4; ri++) {
        const r = 0.35 + ((leafW - 0.45) * ri) / 4;
        const px = hx + rx * r, pz = hz + rz * r;
        for (const c of colliders) {
          if (!c || c.disabled || c === door.collider) continue;
          if (c.y1 <= y0 + 0.05 || c.y0 >= y1 - 0.02) continue;
          if (c.kind === 'rail') continue;
          const ex = c.x2 - c.x1, ez = c.z2 - c.z1;
          const l = ex * ex + ez * ez;
          let t = l ? ((px - c.x1) * ex + (pz - c.z1) * ez) / l : 0;
          t = Math.max(0, Math.min(1, t));
          if (Math.hypot(px - (c.x1 + t * ex), pz - (c.z1 + t * ez)) < 0.14) { bad++; break; }
        }
      }
    }
    return bad;
  };
  const a = score(1), b = score(-1);
  return a <= b ? 1 : -1;
}

function shapeOf(level) {
  const fp = level.footprint;
  const s = new THREE.Shape();
  s.moveTo(fp.x0, -fp.z0);
  s.lineTo(fp.x1, -fp.z0);
  s.lineTo(fp.x1, -fp.z1);
  s.lineTo(fp.x0, -fp.z1);
  s.closePath();
  for (const h of level.holes || []) {
    const p = new THREE.Path();
    if (h.kind === 'rect') {
      p.moveTo(h.x0, -h.z0);
      p.lineTo(h.x0, -h.z1);
      p.lineTo(h.x1, -h.z1);
      p.lineTo(h.x1, -h.z0);
    } else {
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const x = h.x + Math.cos(a) * h.r;
        const z = h.z + Math.sin(a) * h.r;
        if (i === 0) p.moveTo(x, -z); else p.lineTo(x, -z);
      }
    }
    p.closePath();
    s.holes.push(p);
  }
  return s;
}

// How deep the slab under every finished floor is. The stair rim, the soffit
// above it and the joists framed into it all read off this one number: 16.5 cm
// is joists and boards over the rooms, and flags on bedding in the basement.
const FLOOR_W = 0.165;
export const FLOOR_THICK = FLOOR_W;

export function flooLIB(level, x0, z0, x1, z1) {
  const xe = (x0 + x1) / 2, ze = (z0 + z1) / 2;
  const dx = x1 - x0, dz = z1 - z0;
  const geo = new THREE.PlaneGeometry(dx, dz, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(xe, 0, ze);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) - 0.5), v = (uv.getY(i) - 0.5);
    uv.setXY(i, u * 0.4 + 0.5, v * 0.4 + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

// UVs in metres, chosen per face so nothing is smeared: the caps read along
// the plan, the rim and the outside edge across it.
function slabUV(geo, topScale = 0.4, sideScale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, pos.getX(i) * topScale, pos.getZ(i) * topScale);
    else if (nx >= nz) uv.setXY(i, pos.getZ(i) * sideScale, pos.getY(i) * sideScale);
    else uv.setXY(i, pos.getX(i) * sideScale, pos.getY(i) * sideScale);
  }
  uv.needsUpdate = true;
}

// One plaster for every soffit and every floor rim in the house, so the four
// storeys cost one material and one shader. The underside of a floor never
// sees daylight, so it sits a little darker than the wall plaster.
let _soffit = null;
function soffitMaterial() {
  if (_soffit) return _soffit;
  _soffit = materials.wallPlaster.clone();
  _soffit.name = 'slabSoffit';
  _soffit.color.multiplyScalar(0.82);
  _soffit.roughness = 0.96;
  _soffit.side = THREE.DoubleSide;
  tileMaps(_soffit, 1, 1);
  return _soffit;
}

// The slab under each storey, and how it is built.
//
// The old version hung a footprint-sized BOX under the floor plane. A box has
// no holes in it, so on every upper storey it plugged the stair well and the
// courtyard void: standing on the spiral you looked up at a solid ceiling
// instead of through the opening, and the floor rim read as a paper edge
// because there was no rim at all, only the underside of a box. It also
// leaned on materials.flooringEdge, which does not exist, so the world never
// built at all.
//
// A floor here is now the plan of the storey WITH its openings, extruded down
// through FLOOR_W. The extrusion supplies the reveal around every hole for
// free, which is the thing the player actually sees the thickness of from the
// staircase, and its bottom cap is the soffit of the room below. The finished
// floor is that same extrusion top cap, so there is no second surface to
// z-fight with and no seam at the rim.
function addFloor(scene, level) {
  const shape = shapeOf(level);

  const slabGeo = new THREE.ExtrudeGeometry(shape, {
    depth: FLOOR_W, bevelEnabled: false, curveSegments: 26, steps: 1,
  });
  slabGeo.rotateX(-Math.PI / 2);               // flat; the extrusion runs up
  slabGeo.translate(0, level.y - FLOOR_W, 0);  // hung under the finished level
  slabUV(slabGeo);

  const floorMat = materials[level.floor].clone();
  floorMat.name = 'floor_' + level.id;
  floorMat.side = THREE.FrontSide;
  // The floor shape's UVs are the plan's own metres, so the material is scaled
  // to the photograph: a 3 m board scan repeats every 3 m of floor, not every
  // metre of it.
  tileAtMetres(floorMat, tileOf(level.floor));
  floorMat.polygonOffset = true;
  floorMat.polygonOffsetFactor = 1;
  floorMat.polygonOffsetUnits = 1;
  const edgeMat = soffitMaterial();
  edgeMat.polygonOffset = true;
  edgeMat.polygonOffsetFactor = -1;
  edgeMat.polygonOffsetUnits = -1;

  // ExtrudeGeometry groups its caps (0) apart from its walls (1), so the
  // tread surface and the rim/soffit are two materials on one mesh.
  const slab = new THREE.Mesh(slabGeo, [floorMat, edgeMat]);
  slab.name = 'Floor_' + level.id;
  slab.receiveShadow = true;
  slab.castShadow = true;
  scene.add(slab);
  architecture.floors.push(slab);

  // The soffit as the room below sees it: two millimetres proud of the slab
  // own bottom cap, so plaster reads cleanly instead of the cap showing
  // through at a grazing angle.
  const soffitGeo = new THREE.ShapeGeometry(shape, 26);
  soffitGeo.rotateX(-Math.PI / 2);
  soffitGeo.translate(0, level.y - FLOOR_W + 0.002, 0);
  soffitGeo.computeVertexNormals();
  const soffit = new THREE.Mesh(soffitGeo, edgeMat);
  soffit.name = 'Soffit_' + level.id;
  soffit.receiveShadow = true;
  scene.add(soffit);

  // The stair well is framed the way an opening in a timber floor is framed:
  // a curved trimmer under the rim, and the joists that run off it. Without
  // this the hole is only a hole; with it, the floor above the spiral reads
  // as carried by the house. Fourteen joists per level, merged: one draw call.
  const well = (level.holes || []).find((h) => h.kind === 'circle');
  if (well) {
    const yTop = level.y - FLOOR_W - 0.002;
    const parts = [sectorSlab(well.x, well.z, well.r, well.r + 0.13, 0, Math.PI * 2, yTop, 0.17, 26)];
    const n = 14, reach = 0.95, mid = well.r + 0.13 + reach / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const g = box(reach, 0.17, 0.10, 0.8).toNonIndexed();
      g.rotateY(-a);
      g.translate(well.x + Math.cos(a) * mid, yTop - 0.085, well.z + Math.sin(a) * mid);
      parts.push(g);
    }
    const jm = new THREE.Mesh(mergeGeometries(parts), materials.woodGrey.clone());
    jm.name = 'WellFraming_' + level.id;
    jm.castShadow = true;
    jm.receiveShadow = true;
    scene.add(jm);
  }
}

// Which stretches of a rooftop perimeter carry a wall, and which are only a
// parapet? A pavilion that stands against the perimeter is closed by it; the
// open deck behind the rest of the line is not, and a three-metre wall there
// turned the azotea into a well with the roofs hidden inside it. A door in the
// perimeter keeps its own full-height bay, because a doorway is not a parapet.
function deckSpans(level, axis, line, a, b, openings) {
  // The parapet itself is built by buildExtras, with its kerb, its iron rail
  // and its colliders. The wall here stops dead, so the rooftop line is the
  // balustrade above the timber storey rather than a fourth wall of stone.
  const PARAPET = 0.02;
  const runs = [];
  for (const r of level.rooms) {
    if (r.kind === 'terrace' || r.kind === 'courtyard') continue;
    const touches = axis === 'x'
      ? (Math.abs(r.z0 - line) < 0.06 || Math.abs(r.z1 - line) < 0.06)
      : (Math.abs(r.x0 - line) < 0.06 || Math.abs(r.x1 - line) < 0.06);
    if (!touches) continue;
    const lo = axis === 'x' ? r.x0 : r.z0;
    const hi = axis === 'x' ? r.x1 : r.z1;
    runs.push([Math.max(a, lo), Math.min(b, hi)]);
  }
  for (const d of level.doors) {
    if (d.axis !== axis || Math.abs(d.c - line) > 0.02) continue;
    runs.push([d.at - d.w / 2 - 1.0, d.at + d.w / 2 + 1.0]);
  }
  const merged = [];
  for (const [s0, e0] of runs.sort((p, q) => p[0] - q[0])) {
    const prev = merged[merged.length - 1];
    if (prev && s0 <= prev[1] + 0.01) prev[1] = Math.max(prev[1], e0);
    else merged.push([s0, e0]);
  }
  const spans = [];
  let cur = a;
  for (const [s0, e0] of merged) {
    const s = Math.max(a, s0), e = Math.min(b, e0);
    if (e <= cur + 0.01) continue;
    if (s > cur + 0.01) spans.push({ a: cur, b: s, h: PARAPET, openings: [] });
    spans.push({ a: s, b: e, h: level.h, openings: [] });
    cur = e;
  }
  if (cur < b - 0.01) spans.push({ a: cur, b, h: PARAPET, openings: [] });
  // every opening lands on exactly one span, and a door must never be split
  for (const o of openings) {
    const sp = spans.find((s) => o.a >= s.a - 0.06 && o.b <= s.b + 0.06);
    if (sp) sp.openings.push(o);
  }
  return spans;
}

function insideFootprint(level, x, z) {
  const f = level.footprint;
  if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) return false;
  for (const h of level.holes || []) {
    if (h.kind === 'rect') {
      if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) return false;
    } else if (Math.hypot(x - h.x, z - h.z) < h.r) return false;
  }
  return true;
}

function cutRun(a0, a1, openings, wallH, out) {
  const sorted = openings.slice().sort((p, q) => p.a - q.a);
  let cursor = a0;
  for (const o of sorted) {
    const s = Math.max(a0, o.a);
    const e = Math.min(a1, o.b);
    if (e <= cursor) continue;
    if (s > cursor + 0.001) out.push({ a: cursor, b: s, y0: 0, y1: wallH });
    cursor = Math.max(cursor, e);
    if (o.type === 'window') {
      out.push({ a: s, b: e, y0: 0, y1: o.sill });
      out.push({ a: s, b: e, y0: o.head, y1: wallH });
    } else if (o.head < wallH) {
      out.push({ a: s, b: e, y0: o.head, y1: wallH });
    }
  }
  if (cursor < a1 - 0.001) out.push({ a: cursor, b: a1, y0: 0, y1: wallH });
}

// How far inside the facade a window may stand before it stops being a window
// and starts being a hole into a sealed cavity. A window is only cut where a
// room is on the other side of it; the gap between the two is masonry, and the
// opening is lined through it so the reveal is as deep as the wall is thick.
// Anything further back than this has no room to light and is not cut at all.
// 2.15 m, not 1.15: the F2 and F3 room rows stand 2 m back from the west and
// east perimeter, and at the old limit every window in those lifts was refused —
// which is why the west elevation was a blank wall of plaster for two storeys.
// A deep reveal is exactly what a thick-walled manor has; the light well is
// lined jambs and a ceiling, and the glass stays where the room meets it.
const MAX_REVEAL = 2.15;

// Which room does this opening actually serve? The room has to cover the window
// along the facade and sit on the inward side of it; the nearest such room wins,
// because a window is a hole into one room, not into the stack of rooms that
// happen to line up behind it.
function roomBehind(level, axis, line, a, b) {
  const fp = level.footprint;    const inward = axis === 'x'
    ? (Math.abs(line - fp.z0) < 0.01 ? 1 : -1)
    : (Math.abs(line - fp.x0) < 0.01 ? 1 : -1);
  let best = null;
  for (const r of level.rooms) {
    // Roof decks and courtyards are plan-space placeholders, not enclosed
    // rooms. Treating them as backing rooms generated facade windows into open
    // roof voids, where the independent facade dressing could cover the glass.
    if (r.kind === 'terrace' || r.kind === 'courtyard') continue;
    const lo = axis === 'x' ? r.x0 : r.z0;
    const hi = axis === 'x' ? r.x1 : r.z1;
    // Keep every aperture and its reveal clear of perpendicular partition
    // ends. A small tolerance here made windows overlap the adjoining wall by
    // 20-25 cm at room corners, leaving the frame visible but the glazing
    // partly hidden behind a full-height wall return.
    const edgeClearance = 0.22;
    if (a < lo + edgeClearance || b > hi - edgeClearance) continue;
    const edge = axis === 'x'
      ? (inward > 0 ? r.z0 : r.z1)
      : (inward > 0 ? r.x0 : r.x1);
    const gap = inward > 0 ? edge - line : line - edge;
    if (gap < -0.02) continue;          // the room already reaches past it
    if (!best || gap < best.gap) best = { gap, room: r, line: edge };
  }
  return best;
}

// The length of a facade a window may occupy without touching a partition
// return. 0.22 m is the interior wall's own half-thickness: a jamb any closer
// to a wall end is physically inside the return, which is exactly the overlap
// this pass removes.
const APERTURE_CLEAR = 0.22;

// Which stretches of a perimeter span have a real room behind them? A window
// bay belongs to a room, and a room only exists between its two partitions.
// Working in bands, rather than firing a fixed grid down the whole elevation,
// is what lets a bay that would have landed on a wall end be re-seated inside
// the room it lights instead of being dropped altogether.
function roomBands(level, axis, line, sp) {
  const fp = level.footprint;
  const inward = axis === 'x'
    ? (Math.abs(line - fp.z0) < 0.01 ? 1 : -1)
    : (Math.abs(line - fp.x0) < 0.01 ? 1 : -1);
  const bands = [];
  for (const r of level.rooms) {
    if (r.kind === 'courtyard' || r.kind === 'terrace') continue;
    const a = Math.max(axis === 'x' ? r.x0 : r.z0, sp.a);
    const b = Math.min(axis === 'x' ? r.x1 : r.z1, sp.b);
    if (b - a < 0.4) continue;
    const edge = axis === 'x'
      ? (inward > 0 ? r.z0 : r.z1)
      : (inward > 0 ? r.x0 : r.x1);
    const gap = inward > 0 ? edge - line : line - edge;
    if (gap < -0.02 || gap > MAX_REVEAL) continue;
    bands.push([a, b]);
  }
  return bands;
}

export function buildArchitecture(scene) {
  for (const k of ['colliders', 'floors', 'holes', 'ramps', 'extraFloors', 'doors', 'rooms', 'levels', 'missingDoors', 'windows', 'trim']) {
    architecture[k].length = 0;
  }

  for (const level of LEVELS) {
    architecture.levels.push(level);
    for (const h of level.holes || []) architecture.holes.push({ level: level.id, ...h });
    addFloor(scene, level);
    for (const r of level.rooms) architecture.rooms.push({ ...r, level: level.id, floorY: level.y });

    // --- merge every room boundary on the same line ----------------------
    const lines = new Map();
    for (const r of level.rooms) {
      const sides = [
        ['x', r.z0, r.x0, r.x1], ['x', r.z1, r.x0, r.x1],
        ['z', r.x0, r.z0, r.z1], ['z', r.x1, r.z0, r.z1],
      ];
      for (const [axis, c, a, b] of sides) {
        const k = axis + ':' + c.toFixed(2);
        if (!lines.has(k)) lines.set(k, { axis, c, spans: [] });
        lines.get(k).spans.push({ a: Math.min(a, b), b: Math.max(a, b), openings: [] });
      }
    }
    for (const L of lines.values()) {
      L.spans.sort((p, q) => p.a - q.a);
      const merged = [];
      for (const sp of L.spans) {
        const prev = merged[merged.length - 1];
        if (prev && sp.a <= prev.b + 0.012) prev.b = Math.max(prev.b, sp.b);
        else merged.push(sp);
      }
      L.spans = merged;
    }

    const fp = level.footprint;
    const onPerimeter = (L) =>
      (L.axis === 'x' && (Math.abs(L.c - fp.z0) < 0.01 || Math.abs(L.c - fp.z1) < 0.01)) ||
      (L.axis === 'z' && (Math.abs(L.c - fp.x0) < 0.01 || Math.abs(L.c - fp.x1) < 0.01));

    // --- the perimeter is closed at every level above the basement ----------
    // The upper storeys are planned INSET from the ground floor's footprint: the
    // F2 and F3 room rows stop 1 m short of it on the south side, 2 m on the
    // west and up to 5 m on the east, and nothing at all reaches x = 22. A wall
    // was only built where a room's edge happened to land on the footprint line,
    // so the elevation had holes in it, and through those holes the rooms' own
    // inset walls — built, correctly, as interior plaster — were what the road
    // saw: four storeys of brown wallpaper between two bands of stone.
    //
    // A house is closed by its outer wall. Each footprint edge now carries one
    // continuous wall per storey. Where a room is inset, the strip between that
    // wall and the room is a sealed void bounded by the floor slab below and the
    // ceiling slab above, which is exactly what a very thick old wall is; it is
    // invisible from inside, and its outer face is the elevation.
    if (level.id !== 'B1') {
      for (const [axis, c] of [['x', fp.z0], ['x', fp.z1], ['z', fp.x0], ['z', fp.x1]]) {
        const key = axis + ':' + c.toFixed(2);
        const a = axis === 'x' ? fp.x0 : fp.z0;
        const b = axis === 'x' ? fp.x1 : fp.z1;
        const existing = lines.get(key);
        // doors already authored on this line survive: their openings move onto
        // the span that covers them
        const openings = existing ? existing.spans.flatMap((sp) => sp.openings) : [];
        // THE AZOTEA. On the rooftop level the outer wall is only a parapet
        // wherever the open deck runs behind it, and a full storey wall only
        // where a pavilion actually stands against the perimeter. Without this
        // split the deck was a three-metre stone box with roofs hidden inside
        // it, which is why the house read as a flat-topped block from the road.
        // 1.15 m of wall plus the stone-and-iron balustrade geometry that
        // buildExtras already raises gives the parapet its proper height.
        const spans = level.id === 'F4'
          ? deckSpans(level, axis, c, a, b, openings)
          : [{ a, b, openings }];
        lines.set(key, { axis, c, spans });
      }
    }

    // --- doors ------------------------------------------------------------
    const doors = [];
    for (const d of level.doors) {
      const L = lines.get(d.axis + ':' + d.c.toFixed(2));
      const span = L && L.spans.find((sp) => d.at - d.w / 2 >= sp.a - 0.06 && d.at + d.w / 2 <= sp.b + 0.06);
      if (!span) {
        architecture.missingDoors.push(level.id + ' ' + JSON.stringify(d));
        continue;
      }
      const head = d.arch ? 2.9 : 2.15;
      span.openings.push({ type: 'door', a: d.at - d.w / 2, b: d.at + d.w / 2, head });
      const door = { ...d, head, level: level.id, y: level.y };
      doors.push(door);
    }

    // --- windows on the perimeter ----------------------------------------
    for (const L of lines.values()) {
      if (level.id === 'B1' || !onPerimeter(L)) continue;
      // Window height is a property of the storey, not of the house: the F4
      // pavilions are 3.0 m tall, so a single 3.2 m head would cut the opening
      // straight through their ceiling. Each level clamps its own head, and the
      // clamped value is what the trim and the facade dressings are built from —
      // otherwise a blind arch would be hung on the outside of a window that
      // does not exist.
      const winSill = Math.min(WINDOWS.sill, level.h - 1.6);
      const winHead = Math.min(WINDOWS.head, level.h - 0.45);
      for (const sp of L.spans) {
        // The elevation's rhythm is one bay every `spacing` metres, measured
        // from the same origin on every storey. Where a bay's inscribed room
        // band cannot hold it clear of both partitions, the bay moves to the
        // middle of that room's clear width: the storey keeps a window in every
        // room it can, and no surround ends up buried in a wall return.
        const grid = [];
        for (let at = sp.a + 1.9; at <= sp.b - 1.4; at += WINDOWS.spacing) grid.push(at);
        const stations = [];
        for (const [lo, hi] of roomBands(level, L.axis, L.c, sp)) {
          const fits = (at) => at - WINDOWS.width / 2 >= lo + APERTURE_CLEAR
            && at + WINDOWS.width / 2 <= hi - APERTURE_CLEAR;
          const inBand = grid.filter(fits);
          if (inBand.length) { stations.push(...inBand); continue; }
          if (hi - lo < WINDOWS.width + 2 * APERTURE_CLEAR + 0.04) continue;
          // A band too narrow for a rhythmic bay still gets one window, set
          // clear of anything already cut in this wall — a service door is the
          // usual reason a room's only exterior bay has to sit off-centre.
          const half = WINDOWS.width / 2;
          const free = [(lo + hi) / 2, lo + APERTURE_CLEAR + half, hi - APERTURE_CLEAR - half]
            .find((at) => !sp.openings.some((o) => at - half < o.b + 0.5 && at + half > o.a - 0.5));
          if (free != null) stations.push(free);
        }
        const bays = [...new Set(stations.map((v) => +v.toFixed(3)))].sort((p, q) => p - q);
        // skip spans that are tiny or already full of doors
        for (const at of bays) {
          const wa = at - WINDOWS.width / 2, wb = at + WINDOWS.width / 2;
          if (wa < sp.a + 0.4 || wb > sp.b - 0.4) continue;
          if (sp.openings.some((o) => wa < o.b + 0.5 && wb > o.a - 0.5)) continue;
          // A window is only cut where a room is behind it. The perimeter is
          // closed on the shared outline at every storey, but the rooms stop
          // short of that outline in places; a window punched into the outline
          // with nothing but a sealed strip behind it is a hole into a cavity,
          // and once a room was 1 m back the room's own wall stood in front of
          // the glass and blocked it. Those openings are not made at all, and
          // the trim and the facade dressings follow `architecture.windows`, so
          // a window that is not cut gets no sill and no architrave either.
          const back = roomBehind(level, L.axis, L.c, wa, wb);
          if (!back || back.gap > MAX_REVEAL) continue;
          const innerLine = back.line;
          let innerSpan = null;
          // When the facade sits exactly on the room boundary, this perimeter
          // span is the room wall itself: its aperture already creates the
          // complete reveal and must not get a second wall opening stacked on it.
          // For inset rooms we cut the room-side partition too, making one
          // continuous light well between the exterior skin and the occupied room.
          const sameWall = Math.abs(innerLine - L.c) <= 0.01;
          if (!sameWall) {
            const innerL = lines.get(L.axis + ':' + innerLine.toFixed(2));
            innerSpan = innerL && innerL.spans.find((s) => wa >= s.a - 0.02 && wb <= s.b + 0.02
              && !s.openings.some((o) => wa < o.b + 0.45 && wb > o.a - 0.45));
            // a door or a short wall between us and the room: no window here
            if (!innerSpan) continue;
            innerSpan.openings.push({
              type: 'window', a: wa, b: wb, sill: winSill, head: winHead, inner: true,
            });
          }
          sp.openings.push({
            type: 'window', a: wa, b: wb, sill: winSill, head: winHead,
            reveal: innerSpan ? innerLine : null,
          });
          // remembered for the trim pass: sills and glazing bars are built from
          // the openings that were actually cut, not from a second guess
          architecture.windows.push({
            level: level.id, axis: L.axis, c: L.c, a: wa, b: wb,
            sill: winSill, head: winHead, floorY: level.y,
            room: back.room.id, reveal: innerSpan ? innerLine : null,
          });
        }
      }
    }

    // --- materialise walls ------------------------------------------------
    const intGeos = [];
    const extGeos = [];
    const glass = [];
    const litGlass = [];
    const trim = [];
    // The elevation is stratified the way the house actually was built: rubble
    // stone through the ground floor, boards through the two family storeys,
    // limewashed render on the rooftop pavilions. One material per storey is
    // one draw call per storey; the facade module dresses all three against the
    // same wall line, so the junction at each floor is a real junction.
    const extMat = level.id === 'GF' ? 'facadeStone'
      : (level.id === 'F2' || level.id === 'F3') ? 'facadeWood'
        : 'facade';
    for (const L of lines.values()) {
      const exterior = onPerimeter(L);
      const thickness = exterior ? TE : T;
      for (const sp of L.spans) {
        const out = [];
        cutRun(sp.a, sp.b, sp.openings, sp.h ?? level.h, out);
        for (const p of out) {
          const len = p.b - p.a;
          const h = p.y1 - p.y0;
          if (len <= 0.004 || h <= 0.004) continue;
          const g = L.axis === 'x' ? box(len, h, thickness, 0.4) : box(thickness, h, len, 0.4);
          if (L.axis === 'x') {
            g.translate((p.a + p.b) / 2, level.y + p.y0 + h / 2, L.c);
          } else {
            g.translate(L.c, level.y + p.y0 + h / 2, (p.a + p.b) / 2);
          }
          (exterior ? extGeos : intGeos).push(g);
        }
        // The reveal: where the facade wall and the room's own wall are not the
        // same wall, the opening is lined through the masonry between them.
        // Two jambs, a sill and a head, in the room's plaster finish, so the
        // window reads as a deep recess in a thick old wall instead of a sheet
        // of glass pinned to the outside of a solid one.
        if (exterior) {
          const inDir = L.axis === 'x'
            ? (Math.abs(L.c - level.footprint.z0) < 0.01 ? 1 : -1)
            : (Math.abs(L.c - level.footprint.x0) < 0.01 ? 1 : -1);
          for (const o of sp.openings) {
            if (o.type !== 'window' || o.reveal == null) continue;
            const faceA = L.c + inDir * TE / 2;
            const faceB = o.reveal - inDir * T / 2;
            const depth = faceB - faceA;
            if (depth < 0.03) continue;
            const mid = (faceA + faceB) / 2;
            const y0 = level.y + o.sill, y1 = level.y + o.head;
            const w = o.b - o.a;
            for (const side of [o.a + 0.025, o.b - 0.025]) {
              const g = L.axis === 'x' ? box(0.05, y1 - y0, depth, 0.8) : box(depth, y1 - y0, 0.05, 0.8);
              if (L.axis === 'x') g.translate(side, (y0 + y1) / 2, mid);
              else g.translate(mid, (y0 + y1) / 2, side);
              intGeos.push(g);
            }
            for (const [yy, t] of [[y0 - 0.02, 0.04], [y1 + 0.02, 0.04]]) {
              const g = L.axis === 'x' ? box(w, t, depth, 0.8) : box(depth, t, w, 0.8);
              if (L.axis === 'x') g.translate((o.a + o.b) / 2, yy, mid);
              else g.translate(mid, yy, (o.a + o.b) / 2);
              intGeos.push(g);
            }
          }
        }
        for (const o of sp.openings) {
          if (o.type !== 'window') continue;
          const w = o.b - o.a, hh = o.head - o.sill;
          const gp = new THREE.PlaneGeometry(w, hh);
          if (L.axis === 'z') gp.rotateY(Math.PI / 2);
          if (L.axis === 'x') gp.translate((o.a + o.b) / 2, level.y + o.sill + hh / 2, L.c);
          else gp.translate(L.c, level.y + o.sill + hh / 2, (o.a + o.b) / 2);
          glass.push(gp);
          // A handful of windows have a light behind them. The pattern is
          // deterministic, so the house has the same lit windows every load.
          // It used to be one in five; now that the whole perimeter is windowed
          // (close to seventy openings against twenty before) that ratio put
          // fourteen lamps behind the glass and the house read as a lit hotel.
          // One in nine keeps it what the road description says it is: a dark
          // house with a few windows somebody is still paying for.
          if ((Math.abs(Math.round(o.a * 3 + L.c * 5)) % 9) === 0) {
            const lp = new THREE.PlaneGeometry(w - 0.06, hh - 0.06);
            if (L.axis === 'z') lp.rotateY(Math.PI / 2);
            if (L.axis === 'x') lp.translate((o.a + o.b) / 2, level.y + o.sill + hh / 2, L.c + (L.c < 0 ? -0.06 : 0.06));
            else lp.translate(L.c + (L.c < 0 ? -0.06 : 0.06), level.y + o.sill + hh / 2, (o.a + o.b) / 2);
            litGlass.push(lp);
          }

          const ft = 0.055;
          const fparts = [];
          for (const [ww, hh2, xx, yy] of [[w, ft, 0, -hh / 2], [w, ft, 0, hh / 2], [ft, hh, -w / 2, 0], [ft, hh, w / 2, 0]]) {
            const fg = box(ww, hh2, 0.07, 1.2);
            fg.translate(xx, yy, 0);
            fparts.push(fg);
          }
          const fg = mergeGeometries(fparts);
          if (L.axis === 'x') fg.translate((o.a + o.b) / 2, level.y + o.sill + hh / 2, L.c);
          else {
            fg.rotateY(Math.PI / 2);
            fg.translate(L.c, level.y + o.sill + hh / 2, (o.a + o.b) / 2);
          }
          trim.push(fg);
        }
      }
    }

    if (intGeos.length) {
      const geo = mergeGeometries(intGeos);
      const mat = materials[level.wall].clone();
      mat.side = THREE.DoubleSide;
      // Wall UVs are metres (the wall is an extrusion of the plan), so this is
      // the one place a room's whole wall finish gets its real-world scale.
      tileAtMetres(mat, tileOf(level.wall));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Walls_' + level.id;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if (extGeos.length) {
      const geo = mergeGeometries(extGeos);
      const mat = materials[extMat].clone();
      mat.side = THREE.DoubleSide;
      // Exterior wall boxes carry UVs at 0.4 units per metre (boxUV), while the
      // facade module builds its dressings in true metres. Scaling the repeat by
      // the same 0.4 is what makes a 2.6 m stone tile actually cover 2.6 m of
      // wall instead of 6.5 — every stone on the elevation was two and a half
      // times life size, which is why the ground floor read as vertical boards.
      tileAtMetres(mat, tileOf(extMat) * 0.4);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Exterior_' + level.id;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if (glass.length) {
      const geo = mergeGeometries(glass);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1a2422, roughness: 0.06, metalness: 0.15,
        transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        emissive: 0x140c05, emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Windows_' + level.id;
      scene.add(mesh);
    }
    if (trim.length) {
      const geo = mergeGeometries(trim);
      const mat = materials.woodDark.clone();
      tileAtMetres(mat, 1.0);
      scene.add(new THREE.Mesh(geo, mat));
    }
    if (litGlass.length) {
      const geo = mergeGeometries(litGlass);
      // A lit window seen from the road. It used to glow at full brightness,
      // which from inside the room read as a cream poster hung on the wall; a
      // dimmer, warmer panel behind glazing bars reads as a curtained lamp.
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2b1d10, emissive: 0xb87840, emissiveIntensity: 0.45,
        roughness: 0.62, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'LitWindows_' + level.id;
      scene.add(mesh);
    }

    // --- static colliders: the wall pieces that were actually built --------
    // The collider used to be the whole span minus its doors, so every window
    // was backed by an invisible full-height wall and the sill/head split in
    // the geometry existed nowhere in the collision. Each surviving piece is
    // now collided at its own height, and the glazing itself is one segment at
    // the opening, so you can stand at the sill and look out but not walk
    // through the glass.
    //
    // Openings marked `inner` are the room-side half of a deep reveal. They are
    // cut in the plaster so the recess exists, but they deliberately keep their
    // full-height collider: a body must not climb through the inner face into
    // the thickness of the wall.
    for (const L of lines.values()) {
      for (const sp of L.spans) {
        const opens = sp.openings.filter((o) => !o.inner);
        const out = [];
        cutRun(sp.a, sp.b, opens, sp.h ?? level.h, out);
        for (const p of out) addSeg(L.axis, L.c, p.a, p.b, level.y + p.y0, level.y + p.y1);
        for (const o of opens) {
          if (o.type === 'window') addSeg(L.axis, L.c, o.a, o.b, level.y + o.sill, level.y + o.head);
        }
      }
    }

    // --- door leaves ------------------------------------------------------
    // One shared walnut for every leaf — grain turned a quarter so it runs up
    // the leaf, tiled at 1.15 m so the figure is the size of real boards. The
    // entrance gets a second, slightly lighter material instead of every door
    // cloning its own (sixty-seven clones bought sixty-seven material state
    // changes and made no picture anyone could see).
    const walnut = (lighter) => {
      const m = materials.doorWalnut.clone();
      tileAtMetres(m, 1.15);
      for (const k of ['map', 'normalMap', 'roughnessMap']) {
        const t = m[k];
        if (!t) continue;
        t.center.set(0.5, 0.5);
        t.rotation = Math.PI / 2;   // horizontal in the photograph -> vertical
      }
      if (lighter) m.color.offsetHSL(0, 0, 0.05);
      return m;
    };
    const leafMats = [walnut(false), walnut(true)];

    for (const d of doors) {
      const style = d.entrance ? 'entrance' : doorStyle(level, d);
      // service and basement leaves are ironmongered; the rest are brass
      const metal = style === 'service' || style === 'utility' ? materials.wroughtIron : materials.brass;
      const leafH = d.head - 0.03;
      const buildLeaf = (leafW, mirrored, name) => {
        const leaf = new THREE.Group();
        const mesh = new THREE.Mesh(
          doorLeafGeometry(leafW, leafH, style),
          [leafMats[d.entrance ? 1 : 0], metal],
        );
        mesh.receiveShadow = true;
        leaf.add(mesh);
        if (mirrored) leaf.rotation.y = Math.PI;
        const hinge = new THREE.Group();
        hinge.name = name;
        hinge.add(leaf);
        scene.add(hinge);
        return hinge;
      };
      const door = { ...d, style };
      if (d.entrance) {
        // Two leaves, each hinged on its own jamb, meeting on the centreline.
        // One leaf of 2.2 m would be a barn door, and the reference entrance
        // is clearly a pair.
        // 6 mm at each jamb and at the meeting stile, the gap a joiner would
        // leave. A wider centre gap let the foyer light show through the seam.
        const half = (d.w - 0.012) / 2;
        const left = buildLeaf(half, false, 'Door_entrance_L');
        const right = buildLeaf(half, true, 'Door_entrance_R');
        left.position.set(d.at - d.w / 2, d.y, d.c);
        right.position.set(d.at + d.w / 2, d.y, d.c);
        Object.assign(door, {
          mesh: left, mesh2: right, leaves: [left, right],
          open: false, target: 0, target2: 0, leafW: half, swingSign: 1,
        });
      } else {
        const leafW = d.w - 0.05;
        const hinge = buildLeaf(leafW, false, 'Door_' + d.level + '_' + d.at + '_' + d.c);
        if (d.axis === 'x') {
          hinge.position.set(d.at - leafW / 2, d.y, d.c);
        } else {
          hinge.position.set(d.c, d.y, d.at - leafW / 2);
          hinge.children[0].rotation.y = -Math.PI / 2;
        }
        Object.assign(door, {
          mesh: hinge, open: false, target: 0, leafW,
          // a leaf on a z-wall hangs along -x; its own +1 swing is the other
          // way round the arc, which the audit reads and the game applies
          swingSign: d.axis === 'x' ? 1 : -1,
        });
      }
      door.closedSeg = d.axis === 'x'
        ? { x1: d.at - d.w / 2, z1: d.c, x2: d.at + d.w / 2, z2: d.c, kind: 'door', y0: d.y, y1: d.y + d.head }
        : { x1: d.c, z1: d.at - d.w / 2, x2: d.c, z2: d.at + d.w / 2, kind: 'door', y0: d.y, y1: d.y + d.head };
      // An arch is a cased opening, not a door: no leaf, no collider, always
      // passable. Without this the ground-floor gallery was walled off from the
      // foyer by an invisible closed door the player could not see.
      if (d.arch) {
        door.open = true;
        door.arch = true;
        door.mesh.visible = false;
        architecture.doors.push(door);
        continue;
      }
      // a door that starts locked collides; an unlocked door is a barrier only
      // while closed, and the game removes this segment when it swings
      door.collider = door.closedSeg;
      architecture.colliders.push(door.collider);
      // the paired entrance keeps its fixed inward swing; single leaves are
      // resolved against the walls around them
      if (!d.entrance) door.swingSign = pickSwingSign(door, door.leafW, architecture.colliders);
      architecture.doors.push(door);
    }
  }

  buildStairs(scene);
  buildBasementStair(scene);
  buildServiceLadder(scene);
  buildRoofDeck(scene);
  buildTrim(scene);
  buildExtras(scene);
  return architecture;
}


// --- joinery trim ----------------------------------------------------------

// Skirting, cornice and door casings. Without them the walls are bare planes
// meeting bare floor and the rooms read as boxes with furniture in them — the
// shadow line a skirting casts is most of what makes a wall look built.
// Door casings and window sills are what stop openings looking punched out.
//
// All of it is merged into two meshes for the whole house (painted joinery and
// timber), so ~900 boxes cost two draw calls.
function buildTrim(scene) {
  const paintGeos = [];
  const woodGeos = [];
  const SK = { h: 0.13, t: 0.022, inset: 0.001 };
  const CN = { h: 0.075, t: 0.055 };
  const CASING = { jt: 0.10, jd: 0.036, head: 0.040, step: 0.030, stepD: 0.016, plinth: 0.16 };
  const SILL = { depth: 0.16, width: 0.08, overhang: 0.18 };

  const doorGaps = (level, axis, c) => level.doors
    .filter((d) => d.axis === axis && Math.abs(d.c - c) < 0.01)
    // 0.125, not 0.09: the architrave now carries a plinth block at the floor
    // whose outer edge sits d.w/2 + 0.11 from the centre of the opening, and
    // the skirting has to stop clear of it rather than run underneath.
    .map((d) => [d.at - d.w / 2 - 0.125, d.at + d.w / 2 + 0.125])
    .sort((p, q) => p[0] - q[0]);

  // split a run [a,b] around door openings
  const runs = (a, b, gaps) => {
    let out = [[a, b]];
    for (const [g0, g1] of gaps) {
      const next = [];
      for (const [s, e] of out) {
        if (g1 <= s || g0 >= e) { next.push([s, e]); continue; }
        if (g0 > s) next.push([s, g0]);
        if (g1 < e) next.push([g1, e]);
      }
      out = next;
    }
    return out.filter(([s, e]) => e - s > 0.12);
  };

  for (const level of LEVELS) {
    if (level.id === 'B1' || level.id === 'F4') continue;
    const y = level.y;
    for (const r of level.rooms) {
      // skirting on all four faces of the room (interior faces inset by half a
      // wall), and cornice under the ceiling where the room has one
      const faces = [
        ['x', r.z0, r.x0, r.x1, 1],
        ['x', r.z1, r.x0, r.x1, -1],
        ['z', r.x0, r.z0, r.z1, 1],
        ['z', r.x1, r.z0, r.z1, -1],
      ];
      for (const [axis, c, a, b, dir] of faces) {
        const { half } = wallFace(level, axis, c);
        const cc = c + dir * (half + SK.inset);
        for (const [s, e] of runs(a, b, doorGaps(level, axis, c))) {
          const len = e - s;
          if (len < 0.12) continue;
          const g = axis === 'x'
            ? box(len, SK.h, SK.t, 1)
            : box(SK.t, SK.h, len, 1);
          if (axis === 'x') g.translate((s + e) / 2, y + SK.h / 2, cc);
          else g.translate(cc, y + SK.h / 2, (s + e) / 2);
          paintGeos.push(g);
        }
        // cornice: a two-step moulding under the ceiling slab. A bare wall-to-
        // ceiling junction is the single strongest "box" cue in a room.
        if (level.ceiling && r.kind !== 'courtyard') {
          const cy = y + level.h - 0.022;
          const cIn = c + dir * (half + 0.001);
          let acc = 0;
          for (const [h, w2] of [[CN.h, CN.t], [0.042, CN.t + 0.028]]) {
            const g = axis === 'x' ? box(b - a, h, w2, 1) : box(w2, h, b - a, 1);
            if (axis === 'x') g.translate((a + b) / 2, cy - acc - h / 2, cIn + dir * (w2 / 2));
            else g.translate(cIn + dir * (w2 / 2), cy - acc - h / 2, (a + b) / 2);
            paintGeos.push(g);
            acc += h;
          }
        }
      }
    }

    // door casings: a jamb each side and a head, on both faces of the wall.
    for (const d of architecture.doors) {
      if (d.arch || d.level !== level.id) continue;
      const head = d.head;
      const { half } = wallFace(level, d.axis, d.c);
      for (const side of [-1, 1]) {
        const off = (half + 0.014) * side;
        if (d.axis === 'x') {
          const legH = head;
          // Each successive layer of the architrave starts a few millimetres
          // further out than the one behind it, so no two faces of different
          // depths ever share a plane to z-fight in the reveal.
          const in0 = 0.004;                       // step inset from the edge
          const st0 = in0 + CASING.step;           // where the plinth begins
          const PW = CASING.jt + 0.01 - st0;       // outer edge lands at 0.11
          for (const s of [-1, 1]) {
            const lx = d.at + s * (d.w / 2 + CASING.jt / 2);
            const g = box(CASING.jt, legH, CASING.jd, 1);
            g.translate(lx, y + legH / 2, d.c + off);
            woodGeos.push(g);
            // the stepped inner moulding: standing proud along the opening,
            // it is what turns a flat board into an architrave
            const st = box(CASING.step, legH, CASING.jd + CASING.stepD, 1);
            st.translate(d.at + s * (d.w / 2 + in0 + CASING.step / 2), y + legH / 2, d.c + off);
            woodGeos.push(st);
            // plinth block where the architrave meets the floor, 3 mm proud
            // of the step it butts against
            const pl = box(PW, CASING.plinth, CASING.jd + CASING.stepD + 0.006, 1);
            pl.translate(d.at + s * (d.w / 2 + st0 + PW / 2), y + CASING.plinth / 2, d.c + off);
            woodGeos.push(pl);
          }
          // head band crosses the full width, sitting ON the legs (the legs
          // stop at the head, so nothing here is coplanar with anything else)
          const hd = box(d.w + CASING.jt * 2, CASING.head, CASING.jd, 1);
          hd.translate(d.at, y + head + CASING.head / 2, d.c + off);
          woodGeos.push(hd);
          const hs = box(d.w + 2 * (in0 + CASING.step), CASING.step, CASING.jd + CASING.stepD, 1);
          hs.translate(d.at, y + head + CASING.step / 2, d.c + off);
          woodGeos.push(hs);
        } else {
          const legH = head;
          const in0 = 0.004;
          const st0 = in0 + CASING.step;
          const PW = CASING.jt + 0.01 - st0;
          for (const s of [-1, 1]) {
            const lz = d.at + s * (d.w / 2 + CASING.jt / 2);
            const g = box(CASING.jd, legH, CASING.jt, 1);
            g.translate(d.c + off, y + legH / 2, lz);
            woodGeos.push(g);
            const st = box(CASING.jd + CASING.stepD, legH, CASING.step, 1);
            st.translate(d.c + off, y + legH / 2, d.at + s * (d.w / 2 + in0 + CASING.step / 2));
            woodGeos.push(st);
            const pl = box(CASING.jd + CASING.stepD + 0.006, CASING.plinth, PW, 1);
            pl.translate(d.c + off, y + CASING.plinth / 2, d.at + s * (d.w / 2 + st0 + PW / 2));
            woodGeos.push(pl);
          }
          const hd = box(CASING.jd, CASING.head, d.w + CASING.jt * 2, 1);
          hd.translate(d.c + off, y + head + CASING.head / 2, d.at);
          woodGeos.push(hd);
          const hs = box(CASING.jd + CASING.stepD, CASING.step, d.w + 2 * (in0 + CASING.step), 1);
          hs.translate(d.c + off, y + head + CASING.step / 2, d.at);
          woodGeos.push(hs);
        }
      }
    }
  }

  // window joinery on the inside face only: a deeper sill, a reveal lining
  // and glazing bars. A window with no sill is a hole in a wall.
  for (const w of architecture.windows) {
    const len = w.b - w.a;
    const y0 = w.floorY + w.sill;
    const y1 = w.floorY + w.head;
    const depth = TE + 0.16;
    // Which way is into the room? The old test was `w.c > 0`, which put every
    // interior sill and every glazing bar on the OUTSIDE of the house: the
    // south wall (c = +11) has its room to the north (−z) and the north wall
    // (c = −11) has its room to the south (+z), so the sign is the opposite of
    // what the coordinate suggested. The facade's own outward test has always
    // read the footprint edge; this now reads the same edge.
    const wfp = (LEVELS.find((l) => l.id === w.level) || {}).footprint || { x0: -24, x1: 22, z0: -11, z1: 11 };
    const inside = w.axis === 'x'
      ? (Math.abs(w.c - wfp.z0) < 0.01 ? 1 : -1)
      : (Math.abs(w.c - wfp.x0) < 0.01 ? 1 : -1);
    // With a deep reveal the sill belongs on the room face of the opening, not
    // on the outside face of the facade.
    const roomFace = w.reveal != null ? w.reveal + inside * T / 2 : w.c + inside * TE / 2;
    const c2 = roomFace + inside * 0.052;
    if (w.axis === 'x') {
      const sill = box(len + SILL.overhang, SILL.depth, depth, 1);
      sill.translate((w.a + w.b) / 2, y0 - SILL.depth / 2, c2);
      paintGeos.push(sill);
    } else {
      const sill = box(depth, SILL.depth, len + SILL.overhang, 1);
      sill.translate(c2, y0 - SILL.depth / 2, (w.a + w.b) / 2);
      paintGeos.push(sill);
    }
    // glazing bars: one transom, two mullions, on the inside face only
    const cc = w.c + inside * 0.045;
    const bar = 0.036;
    for (const yy of [y0 + (y1 - y0) * 0.62]) {
      const g = w.axis === 'x' ? box(len, bar, 0.05, 1) : box(0.05, bar, len, 1);
      if (w.axis === 'x') g.translate((w.a + w.b) / 2, yy, cc);
      else g.translate(cc, yy, (w.a + w.b) / 2);
      woodGeos.push(g);
    }
    for (const f of [1 / 3, 2 / 3]) {
      const g = w.axis === 'x' ? box(bar, y1 - y0 + 0.02, 0.05, 1) : box(0.05, y1 - y0 + 0.02, bar, 1);
      if (w.axis === 'x') g.translate(w.a + len * f, (y0 + y1) / 2, cc);
      else g.translate(cc, (y0 + y1) / 2, w.a + len * f);
      woodGeos.push(g);
    }
  }

  const add = (geos, matKey, name, tileM = 0) => {
    if (!geos.length) return;
    const mat = materials[matKey].clone();
    if (tileM) {
      // Real-world tiling with the grain turned a quarter: the architrave and
      // the leaf it frames are cut from the same board, so the casing grain
      // runs up the legs the way the door's runs up the stiles.
      tileAtMetres(mat, tileM);
      for (const k of ['map', 'normalMap', 'roughnessMap']) {
        const t = mat[k];
        if (!t) continue;
        t.center.set(0.5, 0.5);
        t.rotation = Math.PI / 2;
      }
    } else {
      tileMaps(mat, 1, 1);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
    architecture.trim.push(name);
  };
  add(paintGeos, 'paint', 'TrimJoinery');
  add(woodGeos, 'doorWalnut', 'TrimTimber', 1.4);
}

function addSeg(axis, c, a, b, y0 = -20, y1 = 40) {
  if (b - a < 0.02) return;
  if (axis === 'x') architecture.colliders.push({ x1: a, z1: c, x2: b, z2: c, kind: 'wall', y0, y1 });
  else architecture.colliders.push({ x1: c, z1: a, x2: c, z2: b, kind: 'wall', y0, y1 });
}

// How far a wall's inner face sits from its centre line on a given level.
// Exterior walls are 0.42 thick and interior ones 0.22, so "the wall is at
// x = -24" does NOT mean the room starts at -24 — it means the plaster is at
// -23.79. Every surface hung on a wall (skirting, casings, tile linings,
// splashbacks) has to use this or it is built inside the masonry and is
// invisible.
export function wallFace(level, axis, line) {
  const fp = level.footprint;
  const perim = axis === 'x'
    ? (Math.abs(line - fp.z0) < 0.02 || Math.abs(line - fp.z1) < 0.02)
    : (Math.abs(line - fp.x0) < 0.02 || Math.abs(line - fp.x1) < 0.02);
  return { perim, half: (perim ? TE : T) / 2 };
}

// --- the continuous stair tower -------------------------------------------
// A cast-stone winder on a masonry drum. The previous stair stacked 0.35 m deep
// boxes and hung a 0.46 m band off BOTH edges of every tread, so each step
// clipped the one below it and the two bands read as chunky blocks. This one is
// built from polar solids: a 55 mm tread with a real nosing, open risers, and a
// continuous helical closed string that carries the balusters and the rail —
// the silhouette in the reference photograph.

// A solid annular sector. `y` is the TOP of the slab; it is `thick` deep.
// Non-indexed so the flat faces keep crisp normals; UVs are real metres, so the
// stone courses run continuously from one tread to the next instead of resetting
// per box.
function sectorSlab(cx, cz, r0, r1, a0, a1, y, thick, segs = 4) {
  const pos = [], uv = [];
  const P = (r, a, yy) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
  const quad = (A, B, C, D, UA, UB, UC, UD) => {
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    uv.push(...UA, ...UB, ...UC, ...UA, ...UC, ...UD);
  };
  const top = y, bot = y - thick;
  const uz = (p) => [p[0], p[2]];
  for (let j = 0; j < segs; j++) {
    const aa = a0 + (j / segs) * (a1 - a0);
    const ab = a0 + ((j + 1) / segs) * (a1 - a0);
    const iA0 = P(r0, aa, top), iA1 = P(r0, ab, top);
    const oB1 = P(r1, ab, top), oB0 = P(r1, aa, top);
    quad(iA0, iA1, oB1, oB0, uz(iA0), uz(iA1), uz(oB1), uz(oB0));
    const bA0 = P(r0, aa, bot), bA1 = P(r0, ab, bot);
    const bB1 = P(r1, ab, bot), bB0 = P(r1, aa, bot);
    quad(bA0, bB0, bB1, bA1, uz(bA0), uz(bB0), uz(bB1), uz(bA1));
    // outer and inner curved walls
    const oT0 = P(r1, aa, top), oT1 = P(r1, ab, top);
    quad(bB0, oT0, oT1, bB1, [aa * r1, bot], [aa * r1, top], [ab * r1, top], [ab * r1, bot]);
    const iT0 = P(r0, aa, top), iT1 = P(r0, ab, top);
    quad(bA0, bA1, iT1, iT0, [aa * r0, bot], [ab * r0, bot], [ab * r0, top], [aa * r0, top]);
  }
  // radial end faces
  const e1T0 = P(r1, a1, top), e1T1 = P(r0, a1, top);
  const e1B0 = P(r1, a1, bot), e1B1 = P(r0, a1, bot);
  quad(e1B0, e1T0, e1T1, e1B1, [r1, bot], [r1, top], [r0, top], [r0, bot]);
  const e0T0 = P(r0, a0, top), e0T1 = P(r1, a0, top);
  const e0B0 = P(r0, a0, bot), e0B1 = P(r1, a0, bot);
  quad(e0B0, e0T0, e0T1, e0B1, [r0, bot], [r0, top], [r1, top], [r1, bot]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A closed helical string: a rectangular-section ribbon that follows the pitch
// line. Its top is the underside of the treads, so the stair reads as carried
// rather than as plates stuck into a column. `yTopAt(a)` returns the top edge at
// an angle; the band hangs `height` below it.
function helicalBand(cx, cz, rIn, rOut, yTopAt, height, a0, a1, segs) {
  const pos = [], uv = [];
  const P = (r, a, yy) => [cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r];
  const quad = (A, B, C, D, UA, UB, UC, UD) => {
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    uv.push(...UA, ...UB, ...UC, ...UA, ...UC, ...UD);
  };
  for (let j = 0; j < segs; j++) {
    const aa = a0 + (j / segs) * (a1 - a0);
    const ab = a0 + ((j + 1) / segs) * (a1 - a0);
    const ya = yTopAt(aa), yb = yTopAt(ab);
    const OT0 = P(rOut, aa, ya), OT1 = P(rOut, ab, yb);
    const OB0 = P(rOut, aa, ya - height), OB1 = P(rOut, ab, yb - height);
    const IT0 = P(rIn, aa, ya), IT1 = P(rIn, ab, yb);
    const IB0 = P(rIn, aa, ya - height), IB1 = P(rIn, ab, yb - height);
    quad(OB0, OT0, OT1, OB1, [aa * rOut, ya - height], [aa * rOut, ya], [ab * rOut, yb], [ab * rOut, yb - height]);
    quad(IB0, IB1, IT1, IT0, [aa * rIn, ya - height], [ab * rIn, yb - height], [ab * rIn, yb], [aa * rIn, ya]);
    quad(IT0, IT1, OT1, OT0, [rIn, aa], [rIn, ab], [rOut, ab], [rOut, aa]);
    quad(OB0, OB1, IB1, IB0, [rOut, aa], [rOut, ab], [rIn, ab], [rIn, aa]);
  }
  // end caps, so the ribbon is solid where it meets the landings
  const p0o = P(rOut, a0, yTopAt(a0)), p0i = P(rIn, a0, yTopAt(a0));
  const p0ob = P(rOut, a0, yTopAt(a0) - height), p0ib = P(rIn, a0, yTopAt(a0) - height);
  quad(p0ob, p0o, p0i, p0ib, [rOut, 0], [rOut, 1], [rIn, 1], [rIn, 0]);
  const p1o = P(rOut, a1, yTopAt(a1)), p1i = P(rIn, a1, yTopAt(a1));
  const p1ob = P(rOut, a1, yTopAt(a1) - height), p1ib = P(rIn, a1, yTopAt(a1) - height);
  quad(p1ob, p1ib, p1i, p1o, [rOut, 0], [rIn, 0], [rIn, 1], [rOut, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// One turned iron baluster, 1.02 m from its foot to the underside of the rail.
// Lathed once and cloned: 50-odd identical balusters per flight cost one
// geometry, and the profile is what makes a rail read as ironwork rather than a
// fence of square sticks.
const BALUSTER_PROFILE = [
  [0.023, 0.00], [0.016, 0.03], [0.012, 0.07], [0.010, 0.16],
  [0.014, 0.34], [0.017, 0.38], [0.012, 0.42], [0.009, 0.55],
  [0.012, 0.78], [0.017, 0.82], [0.012, 0.86], [0.009, 0.94],
  [0.016, 0.99], [0.010, 1.02],
];
function balusterGeometry() {
  const pts = BALUSTER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 8);
}

// The newel at each end of a flight. Without it the swept handrail begins in
// mid-air a metre above the landing, which is the one detail that makes a
// staircase read as scenery rather than as built joinery.
const NEWEL_PROFILE = [
  [0.078, 0.00], [0.070, 0.035], [0.052, 0.070], [0.046, 0.130],
  [0.055, 0.190], [0.039, 0.320], [0.035, 0.560], [0.045, 0.620],
  [0.031, 0.900], [0.040, 0.980], [0.050, 1.020], [0.028, 1.060],
];
function newelGeometry() {
  const pts = NEWEL_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 12);
}

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
    // a zero-length run has no tangent, and CatmullRomCurve3 throws on it
    if (Math.abs(z1 - z0) < 0.18) return;
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
      // The cupboard under the flights is cut to the DISCRETE treads, not to
      // the pitch line. The pitch is a straight slope while the stair is a
      // staircase, and at the top of a flight the slope runs up to a riser
      // above the tread a body is standing on � which put the cupboard box
      // through the climber's shins two steps short of the landing.
      const treadTop = (z, z0, z1, y0, y1, n) => {
        const t = (z - z0) / (z1 - z0);
        const k = Math.max(0, Math.min(n - 1, Math.floor(t * n)));
        return y0 + (k / n) * (y1 - y0);
      };
      const segs = 7;
      for (let k = 0; k < segs; k++) {
        const zA = zn + ((zs - zn) * k) / segs;
        const zB = zn + ((zs - zn) * (k + 1)) / segs;
        const yTop = Math.min(treadTop(zA, zs, zn, base, mid, nB), treadTop(zB, zs, zn, base, mid, nB)) - 0.12;
        // Only close the understair where a body could actually walk into it.
        // Below 1.55 m of headroom the flight is a solid mass anyway, and the
        // collider there sat ABOVE the tread the climber stands on: the slope
        // is continuous but the treads are not, so at the low end of every
        // flight the cupboard box blocked the stair it was built under.
        if (yTop < 1.55) continue;
        const sg = box(bx1 - bx0, yTop, zB - zA + 0.01, 1);
        sg.translate((bx0 + bx1) / 2, yTop / 2, (zA + zB) / 2);
        skirtGeos.push(sg);
      }
      // and below the first flight, the same, in lane A
      for (let k = 0; k < segs; k++) {
        const zA = zn + ((zs - zn) * k) / segs;
        const zB = zn + ((zs - zn) * (k + 1)) / segs;
        const yTop = Math.min(treadTop(zA, zs, zn, base, mid, nA), treadTop(zB, zs, zn, base, mid, nA)) - 0.12;
        if (yTop < 1.55) continue;
        const sg = box(ax1 - ax0, yTop, zB - zA + 0.01, 1);
        sg.translate((ax0 + ax1) / 2, yTop / 2, (zA + zB) / 2);
        skirtGeos.push(sg);
        // No collider. The stair's own footprint is a floor surface, so a body
        // cannot stand under the flight in the first place; the collider that
        // used to be here only ever met the person climbing, whose feet are a
        // tread below the box's sloping top. It blocked both flights two steps
        // short of the half landing.
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

// The service stair down to the basement, in the north end of the service hall
// (hole at x -17.2..-14.2, z -11..-5.4). It runs north and down, so the hall
// itself stays unbroken from the stair head to the guest rooms at the south —
// a stair that filled the hall would have cut the west wing off from itself.
// --- the service ladder -----------------------------------------------------
// A steel ladder up the rear wall, from the yard to the roof deck at 11.6 m.
// The bay is not arbitrary: the rear elevation's windows run -18.44…-17.36,
// -16.04…-14.96, -10.04…-8.96, so x = -12.5 is the one slot that is clear on
// all four storeys. The top is a steel landing outside a service door cut in
// the F4 rear wall, and that door opens onto the open deck between the archive
// and the observatory — the roof terrace, without passing through a room.
//
// The geometry is what the climb in game.js and player.js uses: two flat rails
// on standoff brackets, rungs every 250 mm, a hoop over the head, and a landing
// with rails on its three open sides.
const LADDER = { x: -13.3, z: -11.42, top: 13.9, gap: 0.44, rung: 0.25, deck: 11.6 };
// The landing is wider than the ladder on purpose: the service door sits to
// the east of the rails (x = -12.2), so a body can stand square in the doorway
// with the ladder at its shoulder instead of the two fighting for the E key.
export const ROOF_DOOR_X = -12.2;
export const ROOF_DOOR_W = 1.0;
export const SERVICE_LADDER = { x: LADDER.x, z: LADDER.z, deck: LADDER.deck };

function buildServiceLadder(scene) {
  const { x, z, top, gap, rung, deck: DECK } = LADDER;
  const geos = [];
  for (const s of [-1, 1]) {
    const rail = box(0.05, top, 0.13, 1);
    rail.translate(x + (s * gap) / 2, top / 2, z);
    geos.push(rail);
  }
  for (let y = 0.30; y < top - 0.10; y += rung) {
    const r = box(gap, 0.032, 0.032, 1);
    r.translate(x, y, z);
    geos.push(r);
  }
  // standoff brackets: the ladder hangs clear of the render and is bolted to it
  for (let y = 1.0; y < top; y += 2.0) {
    for (const s of [-1, 1]) {
      const b = box(0.045, 0.045, 0.34, 1);
      b.translate(x + (s * gap) / 2, y, z + 0.15);
      geos.push(b);
    }
    const plate = box(gap + 0.16, 0.05, 0.04, 1);
    plate.translate(x, y, z + 0.30);
    geos.push(plate);
  }
  // a hoop over the top two rungs, so you step round it onto the eave
  const hoop = new THREE.TorusGeometry(0.32, 0.026, 5, 10, Math.PI);
  hoop.rotateY(Math.PI / 2);
  hoop.translate(x, top - 0.55, z - 0.02);
  geos.push(hoop);

  // The head of the ladder is a steel maintenance landing at the roof deck's
  // level, not the eave: a climb has to end somewhere a body can stand, or the
  // controller drops it back down the facade. It reaches 0.24 m through the
  // wall line, so its inboard edge is the door threshold, not a gap.
  const LTOP = DECK;
  // The deck stops just inside the wall's outer face: the doorway threshold
  // itself is the F4 slab, which is already at this height. Carrying the steel
  // through it would have put two floor surfaces on the same plane under the
  // door.
  const zOut = z - 0.88;   // outer edge of the deck
  const zIn = z + 0.57;    // through the outer wall face, shy of the slab edge
  const zc = (zOut + zIn) / 2;
  const DW = 3.0;                 // landing width, door and ladder both on it
  const DH = DW / 2;
  const deck = box(DW, 0.09, zIn - zOut, 1);
  deck.translate(x + 0.5, LTOP - 0.045, zc);
  geos.push(deck);
  // rail on the three open sides; the fourth is the wall and its door
  for (const [w, d, px, pz] of [[DW, 0.05, x + 0.5, zOut], [0.05, zIn - zOut - 0.2, x + 0.5 - DH + 0.05, zc],
    [0.05, zIn - zOut - 0.2, x + 0.5 + DH - 0.05, zc]]) {
    const rail = box(w, 0.05, d, 1);
    rail.translate(px, LTOP + 0.98, pz);
    geos.push(rail);
    const mid = box(w, 0.04, d, 1);
    mid.translate(px, LTOP + 0.52, pz);
    geos.push(mid);
  }
  for (const [px, pz] of [[x + 0.5 - DH + 0.05, zOut], [x + 0.5 + DH - 0.05, zOut],
    [x + 0.5 + DH - 0.05, z + 0.02], [x + 0.5 - DH + 0.05, z + 0.02]]) {
    const post = box(0.05, 1.0, 0.05, 1);
    post.translate(px, LTOP + 0.5, pz);
    geos.push(post);
  }
  // brackets carrying the deck back onto the wall
  for (const sx of [-0.62, 0.62]) {
    const br = box(0.06, 0.06, 0.5, 1);
    br.translate(x + sx, LTOP - 0.22, z + 0.16);
    geos.push(br);
  }

  const mesh = new THREE.Mesh(mergeGeometries(geos), materials.ironDark);
  mesh.name = 'ServiceLadder';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // the landing is walkable, and its open sides are real rails
  architecture.extraFloors.push({
    kind: 'platform', x0: x + 0.5 - DH, x1: x + 0.5 + DH, z0: zOut, z1: zIn, y: LTOP,
  });
  for (const [x1, z1, x2, z2] of [
    [x + 0.5 - DH, zOut, x + 0.5 + DH, zOut],
    [x + 0.5 - DH, zOut, x + 0.5 - DH, z + 0.02],
    [x + 0.5 + DH, zOut, x + 0.5 + DH, z + 0.02],
  ]) {
    architecture.colliders.push({
      x1, z1, x2, z2, kind: 'rail', y0: LTOP, y1: LTOP + 1.05, baseY: LTOP,
    });
  }

  // The ladder is a solid object: it stops a walking body, and its frame is the
  // same 0.88 m wide the rails are. It stops at the landing, because from there
  // on the deck is what carries the player.
  architecture.colliders.push({
    x1: x - gap / 2 - 0.05, z1: z, x2: x + gap / 2 + 0.05, z2: z,
    kind: 'ladder', y0: 0, y1: LTOP,
  });
}

// --- the roof deck ----------------------------------------------------------
// The F4 level is a roof terrace, not a storey: its ceiling is the sky, the
// pitched pavilion roofs stand on it, and the stone parapet is its edge. The
// ladder arrives at the rear, so the service corner of the deck is the one that
// has to work as a place: a boardwalk clear of the door swing, the house's
// water tank on its stand, a soil vent, and a part-used roll of roofing sheet.
// Everything here is either a real prop with collision or a lamp, and the two
// lamps are shadowless — the deck is read by moon and the spill from the door.
const ROOF_LAMPS = [];

function buildRoofDeck(scene) {
  const y = LADDER.deck;
  const iron = [];
  const wood = [];

  // boardwalk: six boards laid on three battens, running from the door towards
  // the deck's south end and clear of the tank
  for (let i = 0; i < 6; i++) {
    const b = box(0.155, 0.045, 5.9, 1);
    b.translate(-11.87 + i * 0.16, y + 0.10, -7.55);
    wood.push(b);
  }
  for (const z of [-9.6, -7.55, -5.5]) {
    const bat = box(1.02, 0.06, 0.09, 1);
    bat.translate(-11.47, y + 0.03, z);
    wood.push(bat);
  }

  // the water tank: a riveted galvanised cylinder on a four-legged stand, the
  // one piece of plant this roof would actually have carried
  const T = { x: -12.9, z: -6.0, r: 0.7, h: 1.55, stand: 0.8 };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = box(0.07, T.stand, 0.07, 1);
    leg.translate(T.x + sx * 0.5, y + T.stand / 2, T.z + sz * 0.5);
    iron.push(leg);
  }
  const frame = box(1.16, 0.08, 1.16, 1);
  frame.translate(T.x, y + T.stand, T.z);
  iron.push(frame);
  const drum = new THREE.CylinderGeometry(T.r, T.r, T.h, 14);
  drum.translate(T.x, y + T.stand + T.h / 2, T.z);
  iron.push(drum);
  const lid = new THREE.ConeGeometry(T.r + 0.04, 0.34, 14);
  lid.translate(T.x, y + T.stand + T.h + 0.17, T.z);
  iron.push(lid);
  for (const hy of [0.28, 0.62, 1.28]) {
    const band = new THREE.TorusGeometry(T.r + 0.012, 0.02, 4, 16);
    band.rotateX(Math.PI / 2);
    band.translate(T.x, y + T.stand + hy, T.z);
    iron.push(band);
  }
  // a short tapping pipe and its stopcock, so the tank is plumbed and not a bin
  const tap = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
  tap.rotateZ(Math.PI / 2);
  tap.translate(T.x + 0.72, y + 1.05, T.z);
  iron.push(tap);
  const cock = box(0.10, 0.14, 0.10, 1);
  cock.translate(T.x + 0.98, y + 1.05, T.z);
  iron.push(cock);

  // soil vent through the deck beside the archive wall
  const vent = new THREE.CylinderGeometry(0.115, 0.115, 1.15, 10);
  vent.translate(-13.15, y + 0.575, -9.1);
  iron.push(vent);
  const vcap = new THREE.ConeGeometry(0.19, 0.22, 10);
  vcap.translate(-13.15, y + 1.21, -9.1);
  iron.push(vcap);

  // part-used roll of galvanised sheet and a tar bucket
  const roll = new THREE.CylinderGeometry(0.2, 0.2, 1.1, 10);
  roll.rotateX(Math.PI / 2);
  roll.translate(-13.25, y + 0.2, -7.9);
  iron.push(roll);
  const bucket = new THREE.CylinderGeometry(0.16, 0.13, 0.3, 10);
  bucket.translate(-12.25, y + 0.15, -8.5);
  iron.push(bucket);

  const ironMesh = new THREE.Mesh(mergeGeometries(iron), materials.ironDark);
  ironMesh.name = 'RoofDeckPlant';
  ironMesh.castShadow = true;
  ironMesh.receiveShadow = true;
  scene.add(ironMesh);

  const woodMat = materials.woodGrey.clone();
  woodMat.color.multiplyScalar(0.82);
  tileMaps(woodMat, 1, 1);
  const woodMesh = new THREE.Mesh(mergeGeometries(wood), woodMat);
  woodMesh.name = 'RoofDeckWalkway';
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  scene.add(woodMesh);

  // the tank and vent are solid; the roll and bucket are low enough to step over
  architecture.colliders.push({
    x1: T.x - T.r - 0.06, x2: T.x + T.r + 0.06,
    z1: T.z - T.r - 0.06, z2: T.z + T.r + 0.06,
    kind: 'furniture', y0: y, y1: y + 2.6,
  });
  architecture.colliders.push({
    x1: -13.3, x2: -13.0, z1: -9.25, z2: -8.95, kind: 'furniture', y0: y, y1: y + 1.4,
  });

  // a bulkhead lamp over the door, warm and weak, and a second one at the
  // boardwalk's far end so the route back is legible without a torch
  for (const [lx, ly, lz, color, intensity, distance] of [
    [LADDER.x + 1.15, y + 1.75, LADDER.z + 0.55, 0xffd9a8, 2.4, 6.5],
    [-11.35, y + 1.5, -5.2, 0xcfe0ff, 1.1, 4.5],
  ]) {
    const boxLamp = box(0.2, 0.28, 0.14, 1);
    boxLamp.translate(lx, ly, lz);
    const shade = new THREE.Mesh(boxLamp, materials.ironDark);
    shade.name = 'RoofDeckLamp';
    scene.add(shade);
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.set(lx, ly - 0.18, lz);
    scene.add(light);
    ROOF_LAMPS.push(light);
  }
}

function buildBasementStair(scene) {
  // The run has to clear the basement's north wall at the bottom, so it stops
  // at z = -10.25 and leaves a 0.75 m turning space plus 2 m of landing to the
  // west. The old version ended 0.1 m from the wall: you arrived facing
  // masonry. It also had no risers, so from below it read as floating boards.
  const x0 = -16.9, x1 = -14.5, zTop = -6.05, zBot = -10.45;
  const yTop = 0, yBot = -3.4;
  const steps = 17;
  const run = zTop - zBot; // negative: the flight descends toward -z
  const going = run / steps;
  const riser = (yTop - yBot) / steps;
  const geos = [];
  const railGeos = [];
  for (let i = 0; i < steps; i++) {
    // i = 0 is the step immediately below the ground-floor lip
    const z = zTop - (i + 0.5) * going;
    const top = yTop - (i + 1) * riser;
    const tread = box(x1 - x0, 0.07, going + 0.05, 0.8);
    tread.translate((x0 + x1) / 2, top - 0.035, z);
    geos.push(tread);
    // a riser under the front edge, so the flight is closed from below
    const riserGeo = box(x1 - x0, riser + 0.02, 0.05, 1);
    riserGeo.translate((x0 + x1) / 2, top + riser / 2, z - going / 2);
    geos.push(riserGeo);
  }
  // stringers: a sloped beam on each side of the open flight
  for (const x of [x0 + 0.06, x1 - 0.06]) {
    const len = Math.hypot(run, yTop - yBot);
    const beam = box(0.13, 0.30, len, 0.8);
    beam.rotateX(Math.atan2(yTop - yBot, run));
    beam.translate(x, (yTop + yBot) / 2 - 0.20, (zTop + zBot) / 2);
    geos.push(beam);
  }
  const geo = mergeGeometries(geos);
  const mat = materials.concrete.clone();
  tileMaps(mat, 1, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Stair_Basement';
  scene.add(mesh);

  // handrail on the open east side (the west side is the hall wall)
  const xr = x1 - 0.09;
  const len = Math.hypot(run, yTop - yBot);
  const tilt = Math.atan2(yTop - yBot, run);
  for (const yy of [-0.55, -1.55, -2.55]) {
    const post = box(0.045, 1.0, 0.045, 1);
    post.translate(xr, yy + 0.5, zTop + (yy / (yTop - yBot)) * run);
    railGeos.push(post);
  }
  const hand = box(0.05, 0.06, len, 1);
  hand.rotateX(tilt);
  hand.translate(xr, (yTop + yBot) / 2 + 0.93, (zTop + zBot) / 2);
  railGeos.push(hand);
  const rm = materials.woodDark.clone();
  const railMesh = new THREE.Mesh(mergeGeometries(railGeos), rm);
  railMesh.name = 'Stair_Basement_Rail';
  scene.add(railMesh);

  // The open side is a real barrier: without this collider the player could
  // step sideways off a descending flight into the well.
  architecture.colliders.push({
    x1: xr, z1: zBot, x2: xr, z2: zTop, kind: 'wall',
    y0: yBot - 0.2, y1: yTop + 1.2,
  });
  architecture.ramps.push({
    kind: 'linear', x0, x1, z0: zBot, z1: zTop, y0: yBot, y1: yTop, steps,
  });
}

// --- porch, courtyard, balconies, parapets, string courses ----------------
function buildExtras(scene) {
  const porch = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.28, 3.2, 0.28);
  for (const x of [-4.2, -1.4, 1.4, 4.2]) {
    const p = new THREE.Mesh(postGeo, materials.woodDark);
    p.position.set(x, 1.6, 13.4);
    porch.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 4.4), materials.iron);
  roof.position.set(0, 3.25, 13.2);
  porch.add(roof);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 3.8), materials.wallPlaster);
  under.rotation.x = Math.PI / 2;
  under.position.set(0, 3.12, 13.2);
  porch.add(under);
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.5), materials.stone);
    st.position.set(0, -0.08 - i * 0.16, 12.2 + i * 0.42);
    porch.add(st);
  }
  scene.add(porch);
  // NOTE: a fabricated roof built from PlaneGeometry slabs at y=15, a
  // walkable platform at 14.15 and railings placed at y=1.5 was removed here.
  // It never parsed (a Python-style colon in a for-of header) and it was never
  // reached, because buildExtras() was behind an early return. The real roof is
  // built by the roof pass, not by this function.


  const pave = materials.stone.clone();
  tileMaps(pave, 1, 1);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), pave);
  court.rotation.x = -Math.PI / 2;
  court.position.set(14, 0.02, -2);
  court.name = 'SM_Courtyard';
  scene.add(court);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.5, 20), materials.stone);
  basin.position.set(14, 0.25, -2);
  scene.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshStandardMaterial({
    color: 0x0d191a, roughness: 0.08, metalness: 0.2,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(14, 0.46, -2);
  scene.add(water);

  // The two front balconies. They were 8.4 x 2.6 m slabs of bare concrete on a
  // timber elevation, which read as white shelves bolted to the wall — the one
  // element of the facade that never belonged to the house. A balcony on a
  // Filipino timber storey is a boarded azotea: joists, boards, a fascia, a
  // bracket under every third joist, and a turned-baluster rail. Merged into
  // two meshes per balcony, so the whole thing is still two draw calls.
  for (const y of [4.2, 8.0]) {
    const boards = [];
    for (let i = 0; i < 18; i++) {
      const b = box(0.45, 0.045, 2.55, 1);
      b.translate(-0.5 - 8.2 / 2 + 0.23 + i * 0.455, y - 0.02, 12.12);
      boards.push(b);
    }
    const dark = [];
    for (let i = 0; i < 5; i++) {
      const j = box(8.35, 0.16, 0.10, 1);
      j.translate(-0.5, y - 0.12, 11.0 + i * 0.62);
      dark.push(j);
    }
    for (const [w, d, x, z] of [[8.4, 0.10, 0.0, 13.42], [0.10, 2.5, -4.72, 12.14], [0.10, 2.5, 3.72, 12.14]]) {
      const f = box(w, 0.22, d, 1);
      f.translate(-0.5 + (x ? x + 0.5 : 0), y - 0.16, z);
      dark.push(f);
    }
    // brackets: a short corbel under the outer edge, every third joist
    for (let x = -4.4; x <= 3.6; x += 1.24) {
      const br = box(0.08, 0.30, 0.46, 1);
      br.translate(x, y - 0.34, 12.95);
      dark.push(br);
      const toe = box(0.08, 0.16, 0.26, 1);
      toe.translate(x, y - 0.50, 12.82);
      dark.push(toe);
    }
    // balusters and the two rails over them
    for (let x = -4.5; x <= 3.5; x += 0.6) {
      const bal = new THREE.CylinderGeometry(0.022, 0.028, 0.86, 6);
      bal.translate(x, y + 0.45, 13.34);
      dark.push(bal);
    }
    const rail = box(8.4, 0.09, 0.12, 1);
    rail.translate(-0.5, y + 0.905, 13.34);
    dark.push(rail);
    const bottom = box(8.4, 0.06, 0.09, 1);
    bottom.translate(-0.5, y + 0.03, 13.34);
    dark.push(bottom);
    const deck = new THREE.Mesh(mergeGeometries(boards), materials.woodGrey.clone());
    deck.name = 'Balcony_boards_' + y;
    scene.add(deck);
    const frame = new THREE.Mesh(mergeGeometries(dark), materials.woodDark.clone());
    frame.name = 'Balcony_frame_' + y;
    scene.add(frame);
  }

  // Balustrade around the courtyard void. The courtyard is a real hole in
  // every slab, and NOTHING guarded it on the upper floors: a player could
  // walk out of a bedroom straight off the edge into a four-storey drop. The
  // rail stands one tread-width back from the cut, so the slab edge reads as
  // a deliberate gallery rather than a broken floor.
  for (const level of LEVELS) {
    if (level.id === 'B1' || level.id === 'GF') continue;
    const hole = (level.holes || []).find((h) => h.kind === 'rect' && h.x0 === 8 && h.x1 === 20);
    if (!hole) continue;
    const geos = [];
    const H = 1.02;
    // Rails are only built where there is no wall already. A wall's collider
    // also tells us where the plaster is, so the two never overlap.
    const edges = [
      ['x', hole.z0, hole.x0, hole.x1, -1],
      ['x', hole.z1, hole.x0, hole.x1, 1],
      ['z', hole.x0, hole.z0, hole.z1, -1],
      ['z', hole.x1, hole.z0, hole.z1, 1],
    ];
    for (const [axis, line, a, b, side] of edges) {
      const covered = architecture.colliders
        .filter((c) => c.kind === 'wall' && c.y0 <= level.y + 0.1 && c.y1 >= level.y + 0.8 &&
          (axis === 'x'
            ? Math.abs(c.z1 - line) < 0.06 && Math.abs(c.z2 - line) < 0.06
            : Math.abs(c.x1 - line) < 0.06 && Math.abs(c.x2 - line) < 0.06))
        .map((c) => axis === 'x'
          ? [Math.min(c.x1, c.x2), Math.max(c.x1, c.x2)]
          : [Math.min(c.z1, c.z2), Math.max(c.z1, c.z2)])
        .sort((p, q) => p[0] - q[0]);
      let cursor = a;
      const runs = [];
      for (const [s, e] of covered) {
        if (e <= cursor) continue;
        if (s > cursor) runs.push([cursor, Math.min(s, b)]);
        cursor = Math.max(cursor, e);
        if (cursor >= b) break;
      }
      if (cursor < b) runs.push([cursor, b]);
      // the rail sits on the slab, one hand's width outside the cut edge
      const c = line + side * 0.12;
      for (const [s, e] of runs) {
        const len = e - s;
        if (len < 0.45) continue;
        const n = Math.max(2, Math.round(len / 0.55));
        for (let i = 0; i <= n; i++) {
          const t = s + (len * i) / n;
          const post = box(0.055, H, 0.055, 1);
          if (axis === 'x') post.translate(t, level.y + H / 2, c);
          else post.translate(c, level.y + H / 2, t);
          geos.push(post);
        }
        const rail = axis === 'x' ? box(len, 0.075, 0.10, 1) : box(0.10, 0.075, len, 1);
        if (axis === 'x') rail.translate((s + e) / 2, level.y + H, c);
        else rail.translate(c, level.y + H, (s + e) / 2);
        geos.push(rail);
        const base = axis === 'x' ? box(len, 0.12, 0.14, 1) : box(0.14, 0.12, len, 1);
        if (axis === 'x') base.translate((s + e) / 2, level.y + 0.06, c);
        else base.translate(c, level.y + 0.06, (s + e) / 2);
        geos.push(base);
        architecture.colliders.push({
          x1: axis === 'x' ? s : c, z1: axis === 'x' ? c : s,
          x2: axis === 'x' ? e : c, z2: axis === 'x' ? c : e,
          kind: 'rail', y0: level.y, y1: level.y + H + 0.1, baseY: level.y,
        });
      }
    }
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), materials.stoneDark);
    mesh.name = 'CourtyardRail_' + level.id;
    scene.add(mesh);
  }

  // roof parapet. The rear run breaks either side of the ladder landing, so
  // the service door opens onto the deck instead of onto a 1 m stone kerb.
  const y4 = 11.6;
  const fp = LEVELS.find((l) => l.id === 'F4').footprint;
  const par = [];
  const t = 0.28, hh = 1.0;
  // The break is exactly the landing's width, so the parapet butts against the
  // landing rails instead of leaving a sliver of unguarded edge beyond them.
  const gapL = LADDER.x + 0.5 - 1.5, gapR = LADDER.x + 0.5 + 1.5;
  for (const [x, z, w, d] of [
    [(fp.x0 + gapL) / 2, fp.z0, gapL - fp.x0, t],
    [(gapR + fp.x1) / 2, fp.z0, fp.x1 - gapR, t],
    [(fp.x0 + fp.x1) / 2, fp.z1, fp.x1 - fp.x0, t],
    [fp.x0, (fp.z0 + fp.z1) / 2, t, fp.z1 - fp.z0],
    [fp.x1, (fp.z0 + fp.z1) / 2, t, fp.z1 - fp.z0],
  ]) {
    const g = box(w, hh, d, 0.7);
    g.translate(x, y4 + hh / 2, z);
    par.push(g);
    if (w > d) addSeg('x', z, x - w / 2, x + w / 2, y4, y4 + hh);
    else addSeg('z', x, z - d / 2, z + d / 2, y4, y4 + hh);
  }
  const pg = mergeGeometries(par);
  const pm = materials.facade.clone();
  tileMaps(pm, 1, 1);
  scene.add(new THREE.Mesh(pg, pm));

  // String courses: a stone band on the FOUR FACADES only. This used to be a
  // single 46 x 22 m slab at every floor level, which meant an 18 cm stone
  // ceiling-to-floor plate ran through every room and straight across the
  // stairwell — the "floor intersecting the stairs" that no amount of
  // furniture could hide. A band proud of the exterior wall is what the
  // elevation actually shows.
  const fpBand = LEVELS.find((l) => l.id === 'GF').footprint;
  for (const y of [4.2, 8.0, 11.6]) {
    const bw = 0.20, bh = 0.18, out = TE / 2 + 0.06;
    const parts = [
      [(fpBand.x0 + fpBand.x1) / 2, fpBand.z0 - out, fpBand.x1 - fpBand.x0 + 0.5, bw],
      [(fpBand.x0 + fpBand.x1) / 2, fpBand.z1 + out, fpBand.x1 - fpBand.x0 + 0.5, bw],
      [fpBand.x0 - out, (fpBand.z0 + fpBand.z1) / 2, bw, fpBand.z1 - fpBand.z0 + 0.5],
      [fpBand.x1 + out, (fpBand.z0 + fpBand.z1) / 2, bw, fpBand.z1 - fpBand.z0 + 0.5],
    ];
    for (const [x, z, w, d] of parts) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), materials.facadeTrim.clone());
      band.position.set(x, y - 0.09, z);
      band.name = 'StringCourse';
      scene.add(band);
    }
  }

  // Ceilings over the roof-level pavilions, and nothing above them.
  // The pavilions used to be capped here with a flattened hip of corrugated
  // iron — 19 degrees, a 45 cm eave and a stone lip — which is why the top of
  // the house read as a row of open boxes with lids. Roofing is the facade
  // module's job now: it builds a gabled slate pitch with masonry gable ends,
  // rake boards and finials over each of these rooms, and the ceilings here are
  // the soffit those roofs sit on. The observation gallery and the observatory
  // stay open on purpose: one is the stair head, the other looks at the sky,
  // and both are roof terraces.
  const f4 = LEVELS.find((l) => l.id === 'F4');
  const yCeil = f4.y + f4.h;
  const ceilingGeos = [];
  architecture.roofs = [];
  for (const r of f4.rooms) {
    // FF4-10 is not a pavilion at all: it is the plan-wide "Roof Deck" label,
    // 46 x 22 m, and its ceiling was the single flat slab that capped the whole
    // house -- including the two pavilions that are meant to stand open to the
    // sky. Only real rooms get a soffit; the roof above them is facade.js.
    if (r.id === 'FF4-01' || r.id === 'FF4-03' || r.id === 'FF4-10') continue;
    const cw = r.x1 - r.x0, cd = r.z1 - r.z0;
    const ceil = box(cw, 0.12, cd, 0.6);
    ceil.translate((r.x0 + r.x1) / 2, yCeil + 0.06, (r.z0 + r.z1) / 2);
    ceilingGeos.push(ceil);
    architecture.roofs.push({
      room: r.id,
      box: { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 },
      yEave: yCeil + 0.12,
    });
  }
  const ceilMesh = new THREE.Mesh(mergeGeometries(ceilingGeos), materials.wallPlaster.clone());
  ceilMesh.name = 'RoofCeilings';
  scene.add(ceilMesh);
}

// --- queries used by the player -------------------------------------------
export function levelContains(level, x, z) {
  return insideFootprint(level, x, z);
}

export function stairHeightAt(x, z, footY) {
  for (const r of architecture.ramps) {
    if (r.kind === 'linear') {
      // The two flights run in opposite directions: flight A is authored from
      // z = 9.2 down to 6.1, flight B from 6.1 up to 9.2. The bounds test used to
      // read `z < z0 - 0.15 || z > z1 + 0.15`, which is inverted for a flight
      // whose z1 is below its z0 — so EVERY first flight on EVERY storey failed
      // the test and was never returned. A player walking up lane A dropped to
      // the slab, went under the stair, and was stopped by the understair
      // cupboard: the stair looked built and could not be climbed.
      const zLo = Math.min(r.z0, r.z1) - 0.15;
      const zHi = Math.max(r.z0, r.z1) + 0.15;
      if (x < r.x0 - 0.02 || x > r.x1 + 0.02 || z < zLo || z > zHi) continue;
      const t = (z - r.z0) / (r.z1 - r.z0);
      // discrete treads, not a ski slope: a riser per step, matching the boxes
      const steps = r.steps || 1;
      const i = Math.max(0, Math.min(steps - 1, Math.floor(t * steps)));
      // the linear stair is authored from its bottom; tread i is i risers up
      const y = r.y0 + (i / steps) * (r.y1 - r.y0);
      if (y > footY + 0.55 || y < footY - 1.2) continue;
      return y;
    }
    const dx = x - r.cx, dz = z - r.cz;
    const d = Math.hypot(dx, dz);
    // The walkable surface is the tread and nothing else. The old +0.4 m
    // tolerance let the player climb on invisible air outside the stringer.
    if (d < r.r0 - 0.04 || d > r.r1 + 0.10) continue;
    let a = Math.atan2(dz, dx);
    const span = r.a1 - r.a0;
    let rel = ((a - r.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (rel > span) rel -= Math.PI * 2;
    if (rel < -0.03 || rel > span) continue;
    const steps = r.steps || 1;
    const i = Math.max(0, Math.min(steps - 1, Math.floor((rel / span) * steps)));
    const y = r.y0 + ((i + 1) / steps) * (r.y1 - r.y0);
    // Only a tread you could actually be standing on: within a step up and a
    // flight down of the body.
    if (y > footY + 0.55 || y < footY - 1.2) continue;
    return y;
  }
  return null;
}

export function floorHeightAt(x, z, footY) {
  const ramp = stairHeightAt(x, z, footY);
  if (ramp !== null) return ramp;
  for (const f of architecture.extraFloors || []) {
    // a landing is a floor, not a lift: it can be stepped onto, never up to
    if (f.y > footY + 0.55 || f.y < footY - 2.0) continue;
    if (f.kind === 'sector') {
      const d = Math.hypot(x - f.cx, z - f.cz);
      if (d < f.r0 - 0.04 || d > f.r1 + 0.05) continue;
      const rel = ((Math.atan2(z - f.cz, x - f.cx) - f.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (rel <= f.a1 - f.a0) return f.y;
      continue;
    }
    if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f.y;
  }
  // Only floors at or below the foot (plus one step up). This is what stops a
  // climber halfway up the spiral from "standing" on the slab 1.8 m above
  // their head when the ramp query slips off the step edge.
  let best = null;
  for (const level of LEVELS) {
    if (!insideFootprint(level, x, z)) continue;
    if (level.y > footY + 0.5) continue;
    if (best === null || level.y > best) best = level.y;
  }
  return best;
}

