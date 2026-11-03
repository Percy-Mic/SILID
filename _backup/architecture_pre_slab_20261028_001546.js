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
import { materials, tileMaps, tileAtMetres } from './materials.js';
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
function doorLeafGeometry(leafW, leafH) {
  const T = 0.055;            // slab thickness; its faces are the panel field
  const FT = 0.019;           // frame standing proud of the field
  const SW = 0.11;            // stile width
  const R_TOP = 0.13, R_BOT = 0.19, R_MID = 0.12;
  const midY = leafH * 0.40;  // the reference puts the mid rail low, ~40%
  const MW = 0.06;            // mullion between the two upper panels
  const upY0 = midY + R_MID / 2, upY1 = leafH - R_TOP;
  const loY0 = R_BOT, loY1 = midY - R_MID / 2;
  const u0 = SW, u1 = leafW - SW;
  const panels = [
    [u0, leafW / 2 - MW / 2, upY0, upY1],
    [leafW / 2 + MW / 2, u1, upY0, upY1],
    [u0, u1, loY0, loY1],
  ];
  const wood = [], brass = [];

  const slab = box(leafW, leafH, T, 1);
  slab.translate(leafW / 2, leafH / 2, 0);
  wood.push(slab);

  for (const side of [-1, 1]) {
    const z = side * (T / 2 + FT / 2);
    const frame = (g) => { g.translate(0, 0, z); wood.push(g); };
    frame(box(SW, leafH, FT, 1).translate(SW / 2, leafH / 2, 0));
    frame(box(SW, leafH, FT, 1).translate(leafW - SW / 2, leafH / 2, 0));
    frame(box(leafW - 2 * SW, R_BOT, FT, 1).translate(leafW / 2, R_BOT / 2, 0));
    frame(box(leafW - 2 * SW, R_TOP, FT, 1).translate(leafW / 2, leafH - R_TOP / 2, 0));
    frame(box(leafW - 2 * SW, R_MID, FT, 1).translate(leafW / 2, midY, 0));
    frame(box(MW, upY1 - upY0, FT, 1).translate(leafW / 2, (upY0 + upY1) / 2, 0));

    // bead moulding around every panel: 12 mm proud of the field, 7 mm below
    // the frame face, so the reveal steps instead of dropping. The first cut
    // used 14 mm of reveal and the torch washed it out — the reference's
    // panels read because their shadow line is deep.
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

    // brass: knob on a rosette, shank, keyhole escutcheon above it
    const base = T / 2 + FT;          // the frame face
    const kx = leafW - 0.075, ky = 1.0;
    const rosette = new THREE.CylinderGeometry(0.034, 0.034, 0.007, 14);
    rosette.rotateX(Math.PI / 2);
    rosette.translate(kx, ky, side * (base + 0.0035));
    brass.push(rosette);
    const shank = new THREE.CylinderGeometry(0.011, 0.014, 0.03, 12);
    shank.rotateX(Math.PI / 2);
    shank.translate(kx, ky, side * (base + 0.022));
    brass.push(shank);
    const knob = new THREE.SphereGeometry(0.03, 14, 10);
    knob.translate(kx, ky, side * (base + 0.052));
    brass.push(knob);
    const esc = box(0.046, 0.10, 0.007, 1);
    esc.translate(kx, ky + 0.115, side * (base + 0.0035));
    brass.push(esc);
  }
  // latch faceplate on the lock edge
  const latch = box(0.006, 0.17, 0.03, 1);
  latch.translate(leafW + 0.003, 1.0, 0);
  brass.push(latch);

  return mergeGeometries([
    mergeGeometries(wood),
    mergeGeometries(brass),
  ], true);
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

const FLOOR_W = 0.16;
const TE = 0.42;

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

function addFloor(scene, level) {
  const fp = level.footprint;
  const geo = new THREE.ShapeGeometry(shapeOf(level), 26);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
  geo.computeVertexNormals();
  const mat = materials[level.floor].clone();
  mat.side = THREE.DoubleSide;
  tileMaps(mat, 1, 1);
  const floor = new THREE.Mesh(geo, mat);
  floor.position.y = level.y;
  floor.name = 'Floor_' + level.id;
  floor.receiveShadow = true;
  scene.add(floor);
  architecture.floors.push(floor);

  // The slab has real thickness. A dollop of slab below the floor, an edge
  // skirt around the top outline that becomes the visible lip below, and a
  // fill below the plane.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(fp.x1 - fp.x0, FLOOR_W, fp.z1 - fp.z0),
    materials.flooringEdge.clone(),
  );
  slab.position.set((fp.x0 + fp.x1) / 2, level.y - FLOOR_W / 2, (fp.z0 + fp.z1) / 2);
  slab.receiveShadow = true;
  scene.add(slab);
  
  // edge skirt so the lip shows around the plan.
  const skirt = []
  skirt.push(new THREE.Mesh(new THREE.BoxGeometry(fp.x1 - fp.x0, FLOOR_W / 2, FLOOR_W), materials.flooringEdge.clone()));
  skirt[0].position.set((fp.x0 + fp.x1) / 2, level.y - FLOOR_W / 4, fp.z0);
  skirt.push(new THREE.Mesh(new THREE.BoxGeometry(fp.x1 - fp.x0, FLOOR_W / 2, FLOOR_W), materials.flooringEdge.clone()));
  skirt[1].position.set((fp.x0 + fp.x1) / 2, level.y - FLOOR_W / 4, fp.z1);
  skirt.push(new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, FLOOR_W / 2, fp.z1 - fp.z0), materials.flooringEdge.clone()));
  skirt[2].position.set(fp.x0, level.y - FLOOR_W / 4, (fp.z0 + fp.z1) / 2);
  skirt.push(new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, FLOOR_W / 2, fp.z1 - fp.z0), materials.flooringEdge.clone()));
  skirt[3].position.set(fp.x1, level.y - FLOOR_W / 4, (fp.z0 + fp.z1) / 2);
  skirt.forEach((m) => { scene.add(m); m.receiveShadow = true; iteration.stats.floorEdges++; });
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
        // the single full-length span
        const openings = existing ? existing.spans.flatMap((sp) => sp.openings) : [];
        lines.set(key, { axis, c, spans: [{ a, b, openings }] });
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
        // skip spans that are tiny or already full of doors
        for (let at = sp.a + 1.9; at <= sp.b - 1.4; at += WINDOWS.spacing) {
          const wa = at - WINDOWS.width / 2, wb = at + WINDOWS.width / 2;
          if (wa < sp.a + 0.4 || wb > sp.b - 0.4) continue;
          if (sp.openings.some((o) => wa < o.b + 0.5 && wb > o.a - 0.5)) continue;
          sp.openings.push({ type: 'window', a: wa, b: wb, sill: winSill, head: winHead });
          // remembered for the trim pass: sills and glazing bars are built from
          // the openings that were actually cut, not from a second guess
          architecture.windows.push({
            level: level.id, axis: L.axis, c: L.c, a: wa, b: wb,
            sill: winSill, head: winHead, floorY: level.y,
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
    // One cold grey stone for the whole elevation. The outside used to be
    // 'stone' on the ground and top floors and warm plaster between, which read
    // as three different buildings stacked on each other; the facade module's
    // dressings are built against one wall material and one tile size.
    const extMat = 'facade';
    for (const L of lines.values()) {
      const exterior = onPerimeter(L);
      const thickness = exterior ? TE : T;
      for (const sp of L.spans) {
        const out = [];
        cutRun(sp.a, sp.b, sp.openings, level.h, out);
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
      tileMaps(mat, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Walls_' + level.id;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if (extGeos.length) {
      const geo = mergeGeometries(extGeos);
      const mat = materials[extMat].clone();
      mat.side = THREE.DoubleSide;
      tileMaps(mat, 1, 1);
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
      tileMaps(mat, 1, 1);
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

    // --- static colliders: every wall span minus its door openings --------
    for (const L of lines.values()) {
      for (const sp of L.spans) {
        const gaps = sp.openings.filter((o) => o.type === 'door').sort((p, q) => p.a - q.a);
        let cursor = sp.a;
        for (const g of gaps) {
          if (g.a > cursor + 0.02) addSeg(L.axis, L.c, cursor, g.a, level.y, level.y + level.h);
          cursor = Math.max(cursor, g.b);
        }
        if (cursor < sp.b - 0.02) addSeg(L.axis, L.c, cursor, sp.b, level.y, level.y + level.h);
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
      const leafW = d.w - 0.05;
      const leafH = d.head - 0.03;
      const leaf = new THREE.Group();
      const leafMesh = new THREE.Mesh(
        doorLeafGeometry(leafW, leafH),
        leafMats[d.entrance ? 1 : 0],
      );
      leafMesh.receiveShadow = true;
      leaf.add(leafMesh);
      const hinge = new THREE.Group();
      if (d.axis === 'x') {
        hinge.position.set(d.at - leafW / 2, d.y, d.c);
      } else {
        hinge.position.set(d.c, d.y, d.at - leafW / 2);
        leaf.rotation.y = -Math.PI / 2;
      }
      hinge.add(leaf);
      hinge.name = 'Door_' + d.level + '_' + d.at + '_' + d.c;
      scene.add(hinge);
      const door = {
        ...d, mesh: hinge, leaf, open: false, target: 0,
        closedSeg: d.axis === 'x'
          ? { x1: d.at - d.w / 2, z1: d.c, x2: d.at + d.w / 2, z2: d.c, kind: 'door', y0: d.y, y1: d.y + d.head }
          : { x1: d.c, z1: d.at - d.w / 2, x2: d.c, z2: d.at + d.w / 2, kind: 'door', y0: d.y, y1: d.y + d.head },
      };
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
      architecture.doors.push(door);
    }
  }

  buildStairs(scene);
  buildBasementStair(scene);
  buildTrim(scene);
  buildExtras(scene);
  // Everything that stands outside the plaster line: roofs, gables, turrets,
  // chimneys, dressings. It runs last because it reads the windows, the doors
  // and the footprint the passes above have just settled.
  architecture.facade = buildFacade(scene, architecture);
  return architecture;
}

// --- joinery trim ----------------------------------------------------------

export const FLOOR_THICK = 0.165;

// Skirting, cornice and door casings. Without them the walls are bare planes
// meeting bare floor and the rooms read as boxes with furniture in them — the
// shadow line a skirting casts is most of what makes a wall look built.
// Door casings and window sills are what stop openings looking punched out.
//
// All of it is merged into two meshes for the whole house (painted joinery and
// timber), so ~900 boxes cost two draw calls.
export const FLOOR_THICK = 0.165;
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
    const inside = w.c > 0 ? 1 : -1;
    const c2 = w.c + inside * 0.052;
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
  const cx = STAIR.cx, cz = STAIR.cz;
  const r0 = STAIR.r0, r1 = STAIR.r1;
  const steps = 26;
  const arc = STAIR.turns * Math.PI * 2;
  const rmid = (r0 + r1) / 2;

  // Pale, worn stone treads; a near-black varnished string and rail; black iron.
  const treadMat = materials.concreteFloor.clone();
  treadMat.name = 'stair_tread';
  treadMat.color.setHex(0xc0b6a4);
  treadMat.roughness = 0.88;
  tileAtMetres(treadMat, 1.1);

  const stringMat = materials.woodDark.clone();
  stringMat.name = 'stair_string';
  stringMat.color.setHex(0x191512);
  stringMat.roughness = 0.48;
  tileAtMetres(stringMat, 0.85);

  const railMat = materials.woodDark.clone();
  railMat.name = 'stair_handrail';
  railMat.color.setHex(0x241a13);
  railMat.roughness = 0.38;
  tileAtMetres(railMat, 0.7);

  const ironMat = materials.ironDark.clone();
  ironMat.name = 'stair_iron';
  ironMat.color.setHex(0x161515);
  ironMat.roughness = 0.5;
  ironMat.metalness = 0.65;

  const baluster = balusterGeometry();
  const newel = newelGeometry();
  let y = 0;

  for (let i = 0; i < 3; i++) {
    const rise = STAIR.rise[i];
    const stepRise = rise / steps;
    const lineAt = (a) => y + ((a - STAIR.a0) / arc) * rise;
    const treadGeos = [];
    const stringGeos = [];
    const balusterGeos = [];

    for (let k = 0; k < steps; k++) {
      const a0 = STAIR.a0 + (k / steps) * arc;
      const a1 = STAIR.a0 + ((k + 1) / steps) * arc;
      const top = y + (k + 1) * stepRise;
      // 10 mm nosing overhang on the leading edge, so every tread throws the
      // thin shadow line the reference photograph has.
      const nosing = 0.010 / rmid;
      treadGeos.push(sectorSlab(cx, cz, r0, r1, a0 - nosing, a1, top, 0.055, 3));

      // Two slender balusters per tread, seated on the closed string.
      for (const f of [0.28, 0.72]) {
        const a = a0 + (a1 - a0) * f;
        const g = baluster.clone();
        g.translate(cx + Math.cos(a) * (r1 - 0.11), lineAt(a) - 0.10, cz + Math.sin(a) * (r1 - 0.11));
        balusterGeos.push(g);
      }
    }

    // The closed string: 0.34 m deep, following the pitch, ending under the
    // first and last tread so it meets both landings.
    stringGeos.push(helicalBand(cx, cz, r1 - 0.26, r1 + 0.012,
      (a) => lineAt(a) - 0.10, 0.34, STAIR.a0, STAIR.a0 + arc, steps * 2));

    // The handrail: one continuous swept tube at 0.98 m over the pitch line.
    const railPts = [];
    for (let k = 0; k <= steps * 2; k++) {
      const a = STAIR.a0 + (k / (steps * 2)) * arc;
      railPts.push(new THREE.Vector3(
        cx + Math.cos(a) * (r1 - 0.11), lineAt(a) + 0.98, cz + Math.sin(a) * (r1 - 0.11)));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts, false, 'catmullrom', 0.0);
    const railGeo = new THREE.TubeGeometry(railCurve, steps * 3, 0.036, 7, false);
    // rounded ends so the tube does not read as a cut pipe
    for (const p of [railPts[0], railPts[railPts.length - 1]]) {
      const cap = new THREE.SphereGeometry(0.036, 8, 6);
      cap.translate(p.x, p.y, p.z);
      balusterGeos.push(cap);
    }
    const treadMesh = new THREE.Mesh(mergeGeometries(treadGeos), treadMat);
    treadMesh.name = 'Stair_' + i;
    treadMesh.receiveShadow = true;
    scene.add(treadMesh);

    const stringMesh = new THREE.Mesh(mergeGeometries(stringGeos), stringMat);
    stringMesh.name = 'StairString_' + i;
    stringMesh.receiveShadow = true;
    scene.add(stringMesh);

    const ironMesh = new THREE.Mesh(mergeGeometries(balusterGeos), ironMat);
    ironMesh.name = 'StairBalusters_' + i;
    scene.add(ironMesh);
    const railMesh = new THREE.Mesh(railGeo, railMat);
    railMesh.name = 'StairHandrail_' + i;
    scene.add(railMesh);

    // A turned newel under each end of the rail, standing on the landing.
    const newelGeos = [];
    for (const [a, base] of [[STAIR.a0 - 0.11, y], [STAIR.a0 + arc - 0.11, y + rise]]) {
      const px = cx + Math.cos(a) * (r1 - 0.11);
      const pz = cz + Math.sin(a) * (r1 - 0.11);
      const g = newel.clone();
      g.translate(px, base, pz);
      newelGeos.push(g);
      const plinth = box(0.16, 0.10, 0.16, 1);
      plinth.translate(px, base + 0.05, pz);
      newelGeos.push(plinth);
      const finial = new THREE.SphereGeometry(0.045, 10, 8);
      finial.translate(px, base + 1.10, pz);
      newelGeos.push(finial);
      architecture.colliders.push({
        x1: px - 0.07, z1: pz - 0.07, x2: px + 0.07, z2: pz + 0.07,
        kind: 'newelPost', y0: base, y1: base + 1.06,
      });
    }
    const newelMesh = new THREE.Mesh(mergeGeometries(newelGeos), railMat);
    newelMesh.name = 'StairNewels_' + i;
    scene.add(newelMesh);

    // The landing at the head of the flight: one solid sector at floor level,
    // not a fan of boxes. It overlaps the slab by half a metre so the stair
    // meets the floor instead of ending at the lip of the well.
    const yTop = y + rise;
    const la0 = STAIR.a0 - 0.5, la1 = STAIR.a0 + 0.5;
    const lr0 = r0 - 0.05, lr1 = STAIR.holeR + 0.55;
    const landing = new THREE.Mesh(sectorSlab(cx, cz, lr0, lr1, la0, la1, yTop, 0.12, 10), treadMat);
    landing.name = 'StairLanding_' + i;
    landing.receiveShadow = true;
    scene.add(landing);
    architecture.extraFloors.push({
      kind: 'sector', cx, cz, r0: lr0, r1: lr1, a0: la0, a1: la1, y: yTop,
    });

    // The outer edge of a winder is a fall, not a kerb. Follow the helix at the
    // handrail line so the player can lean on the rail while climbing; the
    // ends stay open where the landings are.
    for (let k = 2; k < steps - 2; k++) {
      const aa = STAIR.a0 + (k / steps) * arc;
      const ab = STAIR.a0 + ((k + 1) / steps) * arc;
      const rr = r1 + 0.07;
      const ax = cx + Math.cos(aa) * rr, az = cz + Math.sin(aa) * rr;
      const bx = cx + Math.cos(ab) * rr, bz = cz + Math.sin(ab) * rr;
      const hy = lineAt((aa + ab) / 2);
      architecture.colliders.push({
        x1: ax, z1: az, x2: bx, z2: bz, kind: 'rail',
        y0: hy - 0.3, y1: hy + 1.1, baseY: hy,
      });
    }

    architecture.ramps.push({
      cx, cz, r0, r1,
      a0: STAIR.a0, a1: STAIR.a0 + arc,
      y0: y, y1: y + rise, index: i, steps, rise,
    });
    y += rise;
  }

  // The drum: lime-plastered masonry, not a mottled stone cylinder. Collars at
  // each floor make it read as built between slabs.
  const drumH = 15.2;
  const drumMat = materials.wallPlaster.clone();
  drumMat.name = 'stair_newel';
  drumMat.color.setHex(0x585d58);
  drumMat.roughness = 0.96;
  tileAtMetres(drumMat, 0.9);
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(r0 + 0.03, r0 + 0.07, drumH, 32), drumMat);
  drum.position.set(cx, 7.1, cz);
  drum.name = 'StairNewel';
  scene.add(drum);

  const collarGeos = [];
  for (const level of LEVELS) {
    const c = new THREE.CylinderGeometry(r0 + 0.10, r0 + 0.10, 0.09, 32);
    c.translate(cx, level.y + 0.045, cz);
    collarGeos.push(c);
  }
  const plinth = new THREE.CylinderGeometry(r0 + 0.09, r0 + 0.13, 0.14, 32);
  plinth.translate(cx, -3.33, cz);
  collarGeos.push(plinth);
  scene.add(new THREE.Mesh(mergeGeometries(collarGeos), materials.stoneDark));

  // The drum is solid: without this the player can walk through its middle.
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
    const r = r0 + 0.02;
    architecture.colliders.push({
      x1: cx + Math.cos(a0) * r, z1: cz + Math.sin(a0) * r,
      x2: cx + Math.cos(a1) * r, z2: cz + Math.sin(a1) * r,
      kind: 'newel', y0: -3.5, y1: 15.0,
    });
  }

  // Railings around the stair holes on the upper floors: a smooth tube, not a
  // chain of box segments, and balusters on every 6 degrees.
  for (const level of LEVELS) {
    if (level.id === 'B1' || level.id === 'GF') continue;
    const posts = [];
    const n = 60;
    const rEdge = STAIR.holeR + 0.10;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rel = ((a - STAIR.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (rel < 0.56 || rel > Math.PI * 2 - 0.56) continue;
      posts.push(a);
    }
    const railPts = posts.map((a) => new THREE.Vector3(
      cx + Math.cos(a) * rEdge, level.y + 0.98, cz + Math.sin(a) * rEdge));
    const mesh = new THREE.Mesh(mergeGeometries(posts.map((a) => {
      const g = baluster.clone();
      g.scale(1, 0.98 / 1.02, 1);
      g.translate(cx + Math.cos(a) * rEdge, level.y, cz + Math.sin(a) * rEdge);
      return g;
    })), ironMat);
    mesh.name = 'StairRail_' + level.id;
    scene.add(mesh);
    if (railPts.length > 2) {
      const curve = new THREE.CatmullRomCurve3(railPts, false, 'catmullrom', 0.0);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, railPts.length * 2, 0.034, 7, false), railMat);
      tube.name = 'StairRailTube_' + level.id;
      scene.add(tube);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      if (b - a > 0.4) continue;   // do not bridge the arrival opening
      architecture.colliders.push({
        x1: cx + Math.cos(a) * rEdge, z1: cz + Math.sin(a) * rEdge,
        x2: cx + Math.cos(b) * rEdge, z2: cz + Math.sin(b) * rEdge,
        kind: 'rail', y0: level.y, y1: level.y + 1.05, baseY: level.y,
      });
    }
  }
}

// The service stair down to the basement, in the north end of the service hall
// (hole at x -17.2..-14.2, z -11..-5.4). It runs north and down, so the hall
// itself stays unbroken from the stair head to the guest rooms at the south —
// a stair that filled the hall would have cut the west wing off from itself.
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

  for (const y of [4.2, 8.0]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.24, 2.6), materials.concrete);
    deck.position.set(-0.5, y - 0.12, 12.1);
    scene.add(deck);
    for (let x = -4.5; x <= 3.5; x += 0.6) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), materials.woodDark);
      p.position.set(x, y + 0.48, 13.3);
      scene.add(p);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.07, 0.08), materials.woodDark);
    top.position.set(-0.5, y + 0.96, 13.3);
    scene.add(top);
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

  // roof parapet
  const y4 = 11.6;
  const fp = LEVELS.find((l) => l.id === 'F4').footprint;
  const par = [];
  const t = 0.28, hh = 1.0;
  for (const [x, z, w, d] of [
    [(fp.x0 + fp.x1) / 2, fp.z0, fp.x1 - fp.x0, t],
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
    if (r.id === 'FF4-01' || r.id === 'FF4-03') continue;
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
      if (x < r.x0 - 0.02 || x > r.x1 + 0.02 || z < r.z0 - 0.15 || z > r.z1 + 0.15) continue;
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
