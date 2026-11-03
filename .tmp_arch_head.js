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
import { materials, tileMaps } from './materials.js';
import { LEVELS, STAIR, WINDOWS } from './plan.js';
import { hipRoof } from './primitives.js';

const T = 0.22;
const TE = 0.42;

export const architecture = {
  colliders: [],
  floors: [],
  holes: [],
  ramps: [],
  doors: [],
  rooms: [],
  levels: [],
  missingDoors: [],
  extraFloors: [],
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

function addFloor(scene, level) {
  const geo = new THREE.ShapeGeometry(shapeOf(level), 24);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
  geo.computeVertexNormals();
  const mat = materials[level.floor].clone();
  mat.side = THREE.DoubleSide;
  tileMaps(mat, 1, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = level.y;
  mesh.name = 'Floor_' + level.id;
  mesh.receiveShadow = true;
  scene.add(mesh);
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
  for (const k of ['colliders', 'floors', 'holes', 'ramps', 'doors', 'rooms', 'levels', 'missingDoors', 'windows', 'trim']) {
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
      for (const sp of L.spans) {
        // skip spans that are tiny or already full of doors
        for (let at = sp.a + 1.9; at <= sp.b - 1.4; at += WINDOWS.spacing) {
          const wa = at - WINDOWS.width / 2, wb = at + WINDOWS.width / 2;
          if (wa < sp.a + 0.4 || wb > sp.b - 0.4) continue;
          if (sp.openings.some((o) => wa < o.b + 0.5 && wb > o.a - 0.5)) continue;
          sp.openings.push({ type: 'window', a: wa, b: wb, sill: WINDOWS.sill, head: WINDOWS.head });
          // remembered for the trim pass: sills and glazing bars are built from
          // the openings that were actually cut, not from a second guess
          architecture.windows.push({
            level: level.id, axis: L.axis, c: L.c, a: wa, b: wb,
            sill: WINDOWS.sill, head: WINDOWS.head, floorY: level.y,
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
    const extMat = level.id === 'F4' ? 'stone' : 'wallPlaster';
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
          if (L.axis === 'x') g.translate((p.a + p.b) / 2, level.y + p.y0 + h / 2, L.c);
          else g.translate(L.c, level.y + p.y0 + h / 2, (p.a + p.b) / 2);
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
          // deterministic, so the house has the same lit windows every load;
          // roughly one in five, which is what a half-abandoned house looks
          // like from the road.
          if ((Math.abs(Math.round(o.a * 3 + L.c * 5)) % 5) === 0) {
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
    for (const d of doors) {
      const leafW = d.w - 0.05;
      const leafH = d.head - 0.03;
      const leaf = new THREE.Group();
      const parts = [];
      const panelGeo = box(leafW, leafH, 0.055, 0.8);
      panelGeo.translate(leafW / 2, leafH / 2, 0);
      parts.push(panelGeo);
      for (const side of [-1, 1]) {
        const inset = box(leafW * 0.6, leafH * 0.56, 0.02, 0.9);
        inset.translate(leafW / 2, leafH * 0.5, side * 0.042);
        parts.push(inset);
      }
      const panelMat = materials.woodDark.clone();
      panelMat.color.offsetHSL(0, 0, d.entrance ? 0.05 : 0);
      leaf.add(new THREE.Mesh(mergeGeometries(parts), panelMat));
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

  const doorGaps = (level, axis, c) => level.doors
    .filter((d) => d.axis === axis && Math.abs(d.c - c) < 0.01)
    .map((d) => [d.at - d.w / 2 - 0.09, d.at + d.w / 2 + 0.09])
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
    // Taken from the doors that were actually built (they carry the cut head
    // height); the plan's door records do not have one.
    for (const d of architecture.doors) {
      if (d.arch || d.level !== level.id) continue;
      const head = d.head;
      const jt = 0.075, jd = 0.026;
      const { half } = wallFace(level, d.axis, d.c);
      for (const side of [-1, 1]) {
        const off = (half + 0.014) * side;
        if (d.axis === 'x') {
          for (const s of [-1, 1]) {
            const g = box(jt, head + 0.04, jd, 1);
            g.translate(d.at + s * (d.w / 2 + jt / 2), y + (head + 0.04) / 2, d.c + off);
            woodGeos.push(g);
          }
          const hd = box(d.w + jt * 2, jt, jd, 1);
          hd.translate(d.at, y + head + 0.04 - jt / 2, d.c + off);
          woodGeos.push(hd);
        } else {
          for (const s of [-1, 1]) {
            const g = box(jd, head + 0.04, jt, 1);
            g.translate(d.c + off, y + (head + 0.04) / 2, d.at + s * (d.w / 2 + jt / 2));
            woodGeos.push(g);
          }
          const hd = box(jd, jt, d.w + jt * 2, 1);
          hd.translate(d.c + off, y + head + 0.04 - jt / 2, d.at);
          woodGeos.push(hd);
        }
      }
    }
  }

  // window joinery: a sill board that overhangs into the room, a reveal
  // lining and glazing bars. A window with no sill is a hole in a wall.
  for (const w of architecture.windows) {
    const len = w.b - w.a;
    const y0 = w.floorY + w.sill;
    const y1 = w.floorY + w.head;
    const depth = TE + 0.10;
    for (const side of [-1, 1]) {
      const c2 = w.c + side * 0.052;
      if (w.axis === 'x') {
        const sill = box(len + 0.16, 0.032, depth, 1);
        sill.translate((w.a + w.b) / 2, y0 - 0.016, c2);
        paintGeos.push(sill);
      } else {
        const sill = box(depth, 0.032, len + 0.16, 1);
        sill.translate(c2, y0 - 0.016, (w.a + w.b) / 2);
        paintGeos.push(sill);
      }
    }
    // glazing bars: one transom, two mullions, on both faces of the glass
    for (const side of [-1, 1]) {
      const cc = w.c + side * 0.045;
      const bar = 0.036;
      for (const yy of [y0 + (y1 - y0) * 0.62]) {
        const g = w.axis === 'x' ? box(len, bar, 0.05, 1) : box(0.05, bar, len, 1);
        if (w.axis === 'x') g.translate((w.a + w.b) / 2, yy, cc);
        else g.translate(cc, yy, (w.a + w.b) / 2);
        woodGeos.push(g);
      }
      for (const f of [1 / 3, 2 / 3]) {
        const g = w.axis === 'x' ? box(bar, y1 - y0, 0.05, 1) : box(0.05, y1 - y0, bar, 1);
        if (w.axis === 'x') g.translate(w.a + len * f, (y0 + y1) / 2, cc);
        else g.translate(cc, (y0 + y1) / 2, w.a + len * f);
        woodGeos.push(g);
      }
    }
  }

  const add = (geos, matKey, name) => {
    if (!geos.length) return;
    const mat = materials[matKey].clone();
    tileMaps(mat, 1, 1);
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
    architecture.trim.push(name);
  };
  add(paintGeos, 'paint', 'TrimJoinery');
  add(woodGeos, 'woodDark', 'TrimTimber');
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
function buildStairs(scene) {
  let y = 0;
  const riseArr = [STAIR.rise[0], STAIR.rise[1], STAIR.rise[2]];
  for (let i = 0; i < 3; i++) {
    const rise = riseArr[i];
    const steps = 26;
    const arc = STAIR.turns * Math.PI * 2;
    const geos = [];
    const railGeos = [];
    for (let k = 0; k < steps; k++) {
      const a0 = STAIR.a0 + (k / steps) * arc;
      const a1 = STAIR.a0 + ((k + 1) / steps) * arc;
      const am = (a0 + a1) / 2;
      const rmid = (STAIR.r0 + STAIR.r1) / 2;
      const w = STAIR.r1 - STAIR.r0;
      const depth = (arc / steps) * rmid * 1.2;
      // A deep step, not a plate: its underside overlaps the step below, so the
      // helix reads as a solid stair with risers instead of floating boards.
      const stepH = (rise / steps) * 1.55 + 0.1;
      const g = box(w, stepH, depth, 0.8);
      // rotate about the step's own centre FIRST, then move it out to the
      // helix. Translating then rotating swings the geometry around the world
      // origin, which put the whole staircase in the foyer's floor.
      g.rotateY(-am);
      // Offset from the TOWER CENTRE, not from the world origin. Without the
      // centre the whole staircase was drawn at (0,0) — inside the master
      // bedroom — while its ramp, balustrade and holes stayed in the foyer.
      g.translate(STAIR.cx + Math.cos(am) * rmid, y + (k + 0.5) * (rise / steps) - stepH * 0.35, STAIR.cz + Math.sin(am) * rmid);
      geos.push(g);

      // Solid edges. Without them the treads read as loose planks floating in
      // the well from any distance; a stair needs its skirt to look built.
      const top = y + (k + 0.5) * (rise / steps);
      for (const rr of [STAIR.r0 + 0.06, STAIR.r1 - 0.06]) {
        const band = box(0.14, 0.46, depth, 0.8);
        band.rotateY(-am);
        band.translate(STAIR.cx + Math.cos(am) * rr, top - 0.2, STAIR.cz + Math.sin(am) * rr);
        geos.push(band);

        // baluster + a handrail segment on every step, so the rail is a
        // continuous run of iron instead of posts every third tread
        const post = box(0.035, 0.92, 0.035, 1.2);
        post.translate(STAIR.cx + Math.cos(am) * rr, top + 0.46, STAIR.cz + Math.sin(am) * rr);
        railGeos.push(post);
        const rail = box(0.055, 0.05, depth * 1.15, 1.2);
        rail.rotateY(-am);
        rail.translate(STAIR.cx + Math.cos(am) * rr, top + 0.96, STAIR.cz + Math.sin(am) * rr);
        railGeos.push(rail);
      }
    }
    const geo = mergeGeometries(geos);
    const mat = materials.stone.clone();
    mat.color.setHex(0x8f8878);
    tileMaps(mat, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Stair_' + i;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const rg = mergeGeometries(railGeos);
    const rm = materials.iron.clone();
    rm.color.setHex(0x2c2a26);
    scene.add(new THREE.Mesh(rg, rm));

    architecture.ramps.push({
      cx: STAIR.cx, cz: STAIR.cz, r0: STAIR.r0, r1: STAIR.r1,
      a0: STAIR.a0, a1: STAIR.a0 + arc,
      y0: y, y1: y + rise, index: i,
    });
    y += rise;
  }

  // The newel: one cast column up the middle of all three flights. It gives
  // the helix a spine, closes the open well, and costs one draw call.
  const newel = new THREE.Mesh(
    new THREE.CylinderGeometry(STAIR.r0 - 0.05, STAIR.r0 + 0.12, 15.4, 24),
    materials.stoneDark,
  );
  newel.position.set(STAIR.cx, 7.3, STAIR.cz);
  newel.name = 'StairNewel';
  scene.add(newel);

  // Railings around the stair holes, with an opening where the stair arrives.
  // Merged into one mesh per floor: ninety-odd little posts are ninety draw
  // calls on a GPU that cannot afford them.
  for (const level of LEVELS) {
    if (level.id === 'B1' || level.id === 'GF') continue;
    const geos = [];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const rel = ((a - STAIR.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (rel < 0.3 || rel > Math.PI * 2 - 0.3) continue;
      const x = STAIR.cx + Math.cos(a) * 3.55;
      const z = STAIR.cz + Math.sin(a) * 3.55;
      const post = new THREE.CylinderGeometry(0.028, 0.028, 1.0, 5);
      post.translate(x, level.y + 0.5, z);
      geos.push(post);
      const a2 = a + (Math.PI * 2 / 30);
      const nx = STAIR.cx + Math.cos(a2) * 3.55;
      const nz = STAIR.cz + Math.sin(a2) * 3.55;
      const chord = Math.hypot(nx - x, nz - z);
      const rail = new THREE.BoxGeometry(chord, 0.05, 0.05);
      rail.rotateY(-Math.atan2(nz - z, nx - x));
      rail.translate((x + nx) / 2, level.y + 1.0, (z + nz) / 2);
      geos.push(rail);
      architecture.colliders.push({ x1: x, z1: z, x2: nx, z2: nz, kind: 'rail', y0: level.y, y1: level.y + 1.05, baseY: level.y });
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), materials.iron);
    mesh.name = 'StairRail_' + level.id;
    scene.add(mesh);
  }
}

// The service stair down to the basement, in the north end of the service hall
// (hole at x -17.2..-14.2, z -11..-5.4). It runs north and down, so the hall
// itself stays unbroken from the stair head to the guest rooms at the south —
// a stair that filled the hall would have cut the west wing off from itself.
function buildBasementStair(scene) {
  const x0 = -16.9, x1 = -14.5, zTop = -5.5, zBot = -10.9;
  const yTop = 0, yBot = -3.4;
  const steps = 17;
  const geos = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const z = zTop + (zBot - zTop) * t;
    const y = yTop + (yBot - yTop) * (t + 1 / steps);
    const g = box(x1 - x0, 0.16, Math.abs(zTop - zBot) / steps + 0.02, 0.8);
    g.translate((x0 + x1) / 2, y, z);
    geos.push(g);
  }
  const geo = mergeGeometries(geos);
  const mat = materials.concrete.clone();
  tileMaps(mat, 1, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Stair_Basement';
  scene.add(mesh);
  architecture.ramps.push({
    kind: 'linear', x0, x1, z0: zBot, z1: zTop, y0: yBot, y1: yTop,
  });
  // handrail on both sides
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, Math.abs(zTop - zBot)), materials.wood);
    rail.position.set(x, (yTop + yBot) / 2 + 1.0, (zTop + zBot) / 2);
    rail.rotation.x = Math.atan2(yTop - yBot, zTop - zBot);
    scene.add(rail);
  }
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
  const pm = materials.stone.clone();
  tileMaps(pm, 1, 1);
  scene.add(new THREE.Mesh(pg, pm));

  for (const y of [4.15, 7.95, 11.55]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(46.4, 0.18, 22.4), materials.stoneDark);
    band.position.set(-1, y, 0);
    band.name = 'StringCourse';
    scene.add(band);
  }

  // Roofs over the roof-level pavilions. These were flat iron slabs with a
  // stone lip 15 cm above them: no pitch, no eave, no ridge, which is exactly
  // why the top of the house read as boxes. Each roofed pavilion now gets a
  // ceiling and a hipped iron roof over it — eave overhang, fascia, ridge cap.
  // The observation gallery and the observatory stay open: one is the stair
  // head, the other looks at the sky on purpose, and both are roof terraces.
  const f4 = LEVELS.find((l) => l.id === 'F4');
  const yCeil = f4.y + f4.h;
  const OVER = 0.45;
  const ceilingGeos = [], slopeGeos = [], trimGeos = [];
  architecture.roofs = [];
  for (const r of f4.rooms) {
    if (r.id === 'FF4-01' || r.id === 'FF4-03') continue;
    const cw = r.x1 - r.x0, cd = r.z1 - r.z0;
    const ceil = box(cw, 0.12, cd, 0.6);
    ceil.translate((r.x0 + r.x1) / 2, yCeil + 0.06, (r.z0 + r.z1) / 2);
    ceilingGeos.push(ceil);

    // ~19°, which is what a tropical iron roof actually uses: low enough not to
    // catch the wind, steep enough to shed the rain.
    const short = Math.min(cw, cd);
    const rise = Math.max(0.7, short * 0.19);
    const yEave = yCeil + 0.16;
    const roof = hipRoof(r.x0, r.x1, r.z0, r.z1, yEave, rise, OVER);
    slopeGeos.push(roof.geometry);
    architecture.roofs.push({
      room: r.id, yEave, rise, ridgeY: roof.ridge.a[1],
      box: { x0: r.x0 - OVER, x1: r.x1 + OVER, z0: r.z0 - OVER, z1: r.z1 + OVER },
    });

    const fasciaH = 0.16, fasciaT = 0.07;
    const fx0 = r.x0 - OVER, fx1 = r.x1 + OVER, fz0 = r.z0 - OVER, fz1 = r.z1 + OVER;
    for (const [w2, d2, x2, z2] of [
      [fx1 - fx0, fasciaT, (fx0 + fx1) / 2, fz0],
      [fx1 - fx0, fasciaT, (fx0 + fx1) / 2, fz1],
      [fasciaT, fz1 - fz0, fx0, (fz0 + fz1) / 2],
      [fasciaT, fz1 - fz0, fx1, (fz0 + fz1) / 2],
    ]) {
      const g = box(w2, fasciaH, d2, 0.8);
      g.translate(x2, yEave - fasciaH / 2, z2);
      trimGeos.push(g);
    }
    const { a, b, axis, length, apex } = roof.ridge;
    // a square plan has no ridge: its hips meet at one apex, and a cap there is
    // a finial, not a ridge cap
    if (!apex) {
      const cap = axis === 'x'
        ? box(length + 0.12, 0.09, 0.22, 0.8)
        : box(0.22, 0.09, length + 0.12, 0.8);
      cap.translate((a[0] + b[0]) / 2, a[1] + 0.03, (a[2] + b[2]) / 2);
      trimGeos.push(cap);
    }
  }
  const ceilMesh = new THREE.Mesh(mergeGeometries(ceilingGeos), materials.wallPlaster.clone());
  ceilMesh.name = 'RoofCeilings';
  scene.add(ceilMesh);
  const slopeMat = materials.iron.clone();
  // the underside of an eave is visible from the terrace below it
  slopeMat.side = THREE.DoubleSide;
  const slopeMesh = new THREE.Mesh(mergeGeometries(slopeGeos), slopeMat);
  slopeMesh.name = 'RoofSlopes';
  scene.add(slopeMesh);
  const trimMesh = new THREE.Mesh(mergeGeometries(trimGeos), materials.stoneDark.clone());
  trimMesh.name = 'RoofTrim';
  scene.add(trimMesh);
}

// --- queries used by the player -------------------------------------------
export function levelContains(level, x, z) {
  return insideFootprint(level, x, z);
}

export function stairHeightAt(x, z, footY) {
  for (const r of architecture.ramps) {
    if (r.kind === 'linear') {
      if (x < r.x0 - 0.1 || x > r.x1 + 0.1 || z < r.z0 - 0.15 || z > r.z1 + 0.15) continue;
      const t = (z - r.z0) / (r.z1 - r.z0);
      const y = r.y0 + t * (r.y1 - r.y0);
      if (y > footY + 0.55 || y < footY - 1.2) continue;
      return y;
    }
    const dx = x - r.cx, dz = z - r.cz;
    const d = Math.hypot(dx, dz);
    if (d < r.r0 - 0.2 || d > r.r1 + 0.4) continue;
    let a = Math.atan2(dz, dx);
    const span = r.a1 - r.a0;
    let rel = ((a - r.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (rel > span) rel -= Math.PI * 2;
    if (rel < -0.03 || rel > span) continue;
    const y = r.y0 + (rel / span) * (r.y1 - r.y0);
    // Only a tread you could actually be standing on. The old 2.4 m window
    // made the whole helix footprint claim the slab above it: the foyer's
    // north doorway read as a 2.4 m step and the gallery was unreachable.
    if (y > footY + 0.55 || y < footY - 1.2) continue;
    return y;
  }
  return null;
}

export function floorHeightAt(x, z, footY) {
  const ramp = stairHeightAt(x, z, footY);
  if (ramp !== null) return ramp;
  for (const f of architecture.extraFloors || []) {
    if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && Math.abs(f.y - footY) < 2.0) return f.y;
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
