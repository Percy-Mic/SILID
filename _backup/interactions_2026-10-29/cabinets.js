// CABINETS — furniture you can actually open.
//
// The mansion's furniture GLB is a beautiful set of static pieces: each chest
// and dresser was exported as ONE merged mesh, so its drawer fronts are fused
// into the carcass and nothing about it can move. Rather than leave the player
// pulling at a painted box, the containers that are meant to be searchable are
// built here, as real joinery:
//
//   * a carcass with two sides, a top, a bottom, a back and a plinth — the
//     cavity between them is empty, so a drawer has somewhere to go;
//   * drawers with a bottom, two sides, a back and a separate front panel,
//     with 4 mm of clearance all round;
//   * brass handles, an inset front panel, and a runner on each side;
//   * a bounded 0.30 m travel along the cabinet's own front axis.
//
// The collision box is only the carcass. The drawer never pushes the player:
// it slides into space that was already validated as clear. Interactables are
// per drawer, at the drawer's own front, so the prompt appears on the drawer
// you are looking at rather than on the whole cabinet.
//
// These are placed only in rooms where a searchable container belongs. The
// static wardrobes and cupboards elsewhere stay scenery — the point of a
// searchable drawer is that not every box in the house is one.
//
// Everything is parented to one Group per unit and animated in game.update().

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileAtMetres } from './materials.js';
import { box } from './primitives.js';
import { wallFace } from './architecture.js';
import { props } from './props.js';

export const cabinets = { units: [], errors: [], count: 0 };

const T = 0.022;          // carcass panel thickness
const TRAVEL = 0.30;      // how far a drawer slides out

// Every unit uses the same narra, cedar and brass. Sharing the materials is not
// only tidier: tileAtMetres() gives each material its own texture objects, and
// five units cloning five materials was seventy-five separate 512 px GPU
// textures for one identical finish.
const FINISHES = new Map();

// One cabinet. Local space: origin on the floor at the centre of the carcass,
// front facing +z, so a unit against a north wall is simply rotated by PI.
//
// This is furniture, not a textured crate. A leg-and-apron case lifts the body
// off the floor; a moulded top overhangs it; a face frame with stiles and rails
// surrounds each opening; every drawer has a framed, recessed front panel, a
// real box with a plywood bottom, and a brass bail pull. The cavity behind the
// face frame is empty and the dust boards between drawers are modelled, so an
// open drawer shows a compartment rather than the drawer below it.
function finish(key, name, color, rough, tile = 0.6) {
  if (FINISHES.has(name)) return FINISHES.get(name);
  const m = materials[key].clone();
  m.name = name;
  if (color !== null) m.color.setHex(color);
  m.roughness = rough;
  tileAtMetres(m, tile);
  FINISHES.set(name, m);
  return m;
}

function bailPull(x, y, z, w = 0.075) {
  // A period brass bail: a half-round drop handle on two rosettes.
  const parts = [];
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (i / 10);
    pts.push(new THREE.Vector3(x - Math.cos(a) * w, y - Math.sin(a) * w * 0.62, z));
  }
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0055, 6, false));
  for (const sx of [-1, 1]) {
    const rosette = new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10);
    rosette.rotateX(Math.PI / 2);
    rosette.translate(x + sx * w, y, z - 0.003);
    parts.push(rosette);
    const post = new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8);
    post.rotateX(Math.PI / 2);
    post.translate(x + sx * w, y, z - 0.018);
    parts.push(post);
  }
  return merge(parts);
}

function makeUnit({ scene, level, room, x, z, rot, width, height, depth, drawers, label, contents }) {
  const group = new THREE.Group();
  group.name = 'Cabinet_' + label;
  group.position.set(x, level.y, z);
  group.rotation.y = rot;

  const W = width, H = height, D = depth;
  const legH = 0.10;
  const topT = 0.030;
  const bodyY1 = H - topT;
  const sideT = 0.022;
  const faceZ = D / 2 - 0.014;
  const frameT = 0.026;
  const stileW = 0.055;

  // Warm narra fronts and top; a darker stained carcass; pale cedar interiors.
  const frontMat = finish('woodNarra', 'cabinet_front_narra', 0x80614c, 0.58, 0.9);
  const topMat = finish('woodNarra', 'cabinet_top_narra', 0x745643, 0.55, 1.1);
  const caseMat = finish('woodDark', 'cabinet_carcass', 0x35271d, 0.62, 0.7);
  const backMat = finish('woodDark', 'cabinet_back', 0x241a14, 0.78, 1.0);
  const innerMat = finish('wood', 'cabinet_drawer_cedar', 0xb08a60, 0.82, 0.5);
  const brass = materials.brass;

  const carcass = [];

  // --- legs and apron -------------------------------------------------------
  // Turned legs, 0.10 m, with a foot, an ankle and a collar under the case.
  const legProfile = [[0.030, 0], [0.043, 0.006], [0.038, 0.022], [0.030, 0.042],
    [0.033, 0.060], [0.041, 0.072], [0.046, 0.088], [0.044, 0.10]];
  const legGeo = new THREE.LatheGeometry(legProfile.map(([r, y]) => new THREE.Vector2(r, y)), 10);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = legGeo.clone();
      g.translate(sx * (W / 2 - 0.055), 0, sz * (D / 2 - 0.055));
      carcass.push(g);
    }
  }
  // apron rails between the legs, set back from the face so they shadow
  for (const sz of [-1, 1]) {
    const g = box(W - 0.13, 0.052, 0.022, 1);
    g.translate(0, legH - 0.026, sz * (D / 2 - 0.065));
    carcass.push(g);
  }
  for (const sx of [-1, 1]) {
    const g = box(0.022, 0.052, D - 0.15, 1);
    g.translate(sx * (W / 2 - 0.065), legH - 0.026, 0);
    carcass.push(g);
  }

  // --- carcass panels -------------------------------------------------------
  // sides, bottom, back and a top rail under the slab
  for (const sx of [-1, 1]) {
    const g = box(sideT, bodyY1 - legH, D - 0.02, 1);
    g.translate(sx * (W / 2 - sideT / 2), legH + (bodyY1 - legH) / 2, -0.01);
    carcass.push(g);
  }
  const bottom = box(W - 2 * sideT, 0.020, D - 0.03, 1);
  bottom.translate(0, legH + 0.01, -0.005);
  carcass.push(bottom);
  const back = box(W - 2 * sideT, bodyY1 - legH - 0.02, 0.012, 1);
  back.translate(0, legH + (bodyY1 - legH) / 2, -D / 2 + 0.010);
  carcass.push(back);
  for (const sx of [-1, 1]) {
    const rail = box(0.06, 0.05, D - 0.04, 1);
    rail.translate(sx * (W / 2 - 0.03), bodyY1 - 0.025, -0.01);
    carcass.push(rail);
  }

  // The drawer opening stack: a bottom rail, three openings, two intermediate
  // rails and a top rail. All heights derive from the case, so a shorter or
  // taller cabinet still gets even drawers.
  const ap0 = legH + 0.045;
  const ap1 = bodyY1 - 0.030;
  const railH = 0.026;
  const n = drawers;
  const openingH = (ap1 - ap0 - (n - 1) * railH) / n;

  // dust boards: the flat bottom of each compartment, so the drawer above is
  // not visible through the opening below
  for (let i = 0; i <= n; i++) {
    const y = ap0 + i * (openingH + railH) - (i > 0 ? railH : 0);
    const g = box(W - 2 * sideT - 0.004, 0.012, D - 0.05, 1);
    g.translate(0, y, -0.02);
    carcass.push(g);
  }
  // wooden runners on the carcass sides, under each drawer
  for (let i = 0; i < n; i++) {
    const y = ap0 + i * (openingH + railH) + 0.012;
    for (const sx of [-1, 1]) {
      const g = box(0.018, 0.022, D - 0.09, 1);
      g.translate(sx * (W / 2 - sideT - 0.012), y, -0.02);
      carcass.push(g);
    }
  }

  const carcassMesh = new THREE.Mesh(merge(carcass), caseMat);
  carcassMesh.castShadow = true;
  carcassMesh.receiveShadow = true;
  group.add(carcassMesh);

  // --- face frame -----------------------------------------------------------
  // Stiles and rails stand proud of the carcass. The drawer fronts then sit
  // inside the openings, proud of the frame by 6 mm: the reveal is the line that
  // tells the eye this is a cabinet and not a painted box.
  const faceParts = [];
  for (const sx of [-1, 1]) {
    faceParts.push(box(stileW, bodyY1 - legH, frameT, 1)
      .translate(sx * (W / 2 - stileW / 2), legH + (bodyY1 - legH) / 2, faceZ));
  }
  faceParts.push(box(W - 2 * stileW, 0.045, frameT, 1).translate(0, legH + 0.0225, faceZ));
  faceParts.push(box(W - 2 * stileW, 0.030, frameT, 1).translate(0, bodyY1 - 0.015, faceZ));
  for (let i = 1; i < n; i++) {
    const y = ap0 + i * (openingH + railH) - railH / 2;
    faceParts.push(box(W - 2 * stileW, railH, frameT, 1).translate(0, y, faceZ));
  }
  const faceMesh = new THREE.Mesh(merge(faceParts), frontMat);
  faceMesh.castShadow = true;
  faceMesh.receiveShadow = true;
  group.add(faceMesh);

  const unit = {
    kind: 'cabinet', level: level.id, room: room.id, label,
    x, z, rot, w: W, h: H, d: D, y: level.y,
    group, drawers: [], open: false, contentsTaken: false,
  };

  // --- drawers --------------------------------------------------------------
  const innerW = W - 2 * sideT;
  for (let i = 0; i < n; i++) {
    const yc = ap0 + i * (openingH + railH) + openingH / 2;
    const holder = new THREE.Group();
    holder.position.set(0, yc, 0);
    group.add(holder);

    // An inset front: it has to pass through the face-frame opening, so it is
    // slightly smaller than the opening, not wider than the stiles.
    const frontW = W - 2 * stileW - 0.006;
    const frontH = openingH - 0.006;
    const boxW = frontW - 0.014;
    const boxH = frontH - 0.020;
    const boxD = D - 0.075;

    const inner = [];   // the drawer box: bottom, sides, back, structural front
    const floor = box(boxW, 0.008, boxD, 1);
    floor.translate(0, -boxH / 2 + 0.010, -0.012);
    inner.push(floor);
    for (const sx of [-1, 1]) {
      const g = box(0.012, boxH, boxD, 1);
      g.translate(sx * (boxW / 2 - 0.006), 0, -0.012);
      inner.push(g);
    }
    const rb = box(boxW - 0.024, boxH, 0.012, 1);
    rb.translate(0, 0, -D / 2 + 0.048);
    inner.push(rb);
    // structural front, sitting behind the decorative framed panel
    const sf = box(boxW, boxH, 0.012, 1);
    sf.translate(0, 0, faceZ - 0.020);
    inner.push(sf);
    // corner blocks on the floor, the way a drawer is actually glued
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = box(0.026, 0.026, 0.026, 1);
        g.translate(sx * (boxW / 2 - 0.015), -boxH / 2 + 0.026, sz * (boxD / 2 - 0.02));
        inner.push(g);
      }
    }
    const innerMesh = new THREE.Mesh(merge(inner), innerMat);
    innerMesh.receiveShadow = true;
    holder.add(innerMesh);

    // The framed front: stiles, rails, a recessed field and a bead moulding,
    // all separate pieces with real depth. The front face lands 6 mm proud of
    // the face frame.
    const fw = 0.050;
    const frontZ = faceZ + frameT / 2;
    const parts = [];
    const field = box(frontW - 2 * fw, frontH - 2 * fw, 0.012, 1);
    field.translate(0, 0, frontZ - 0.011);
    parts.push(field);
    for (const sx of [-1, 1]) {
      parts.push(box(fw, frontH, 0.024, 1)
        .translate(sx * (frontW / 2 - fw / 2), 0, frontZ));
    }
    for (const sy of [-1, 1]) {
      parts.push(box(frontW - 2 * fw, fw, 0.024, 1)
        .translate(0, sy * (frontH / 2 - fw / 2), frontZ));
    }
    // bead: a 6 mm lip where the field meets the frame, throwing a shadow line
    for (const sy of [-1, 1]) {
      parts.push(box(frontW - 2 * fw + 0.012, 0.008, 0.006, 1)
        .translate(0, sy * (frontH / 2 - fw), frontZ - 0.001));
    }
    for (const sx of [-1, 1]) {
      parts.push(box(0.008, frontH - 2 * fw + 0.012, 0.006, 1)
        .translate(sx * (frontW / 2 - fw), 0, frontZ - 0.001));
    }
    const frontMesh = new THREE.Mesh(merge(parts), frontMat);
    frontMesh.castShadow = true;
    holder.add(frontMesh);

    // brass bail on the centre of the drawer, and an escutcheon on the top one
    const hw = 0.075;
    const pull = new THREE.Mesh(bailPull(0, -0.012, frontZ + 0.032, hw), brass);
    holder.add(pull);
    if (i === 0) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 12), brass);
      plate.rotation.x = Math.PI / 2;
      plate.position.set(0, frontH / 2 - fw / 2, frontZ + 0.014);
      holder.add(plate);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.013, 0.002), materials.ironDark);
      hole.position.set(0, frontH / 2 - fw / 2 - 0.002, frontZ + 0.017);
      holder.add(hole);
    }

    const drawer = {
      index: i, holder, open: false, target: 0,
      travel: TRAVEL, yc,
      contents: null,
    };

    if (contents && i === contents.drawer) {
      const c = contents;
      const item = new THREE.Group();
      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xcfc3a4, roughness: 0.95, side: THREE.DoubleSide,
      });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.21), paperMat);
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = 0.08;
      sheet.position.set(0.02, -boxH / 2 + 0.016, 0.02);
      item.add(sheet);
      // a second leaf, slightly askew, so the drawer does not read as one white
      // rectangle placed for the camera
      const sheet2 = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), paperMat);
      sheet2.rotation.x = -Math.PI / 2;
      sheet2.rotation.z = -0.19;
      sheet2.position.set(-0.02, -boxH / 2 + 0.017, -0.03);
      item.add(sheet2);
      holder.add(item);
      drawer.contents = { ...c, mesh: item };
    }

    unit.drawers.push(drawer);
  }

  // --- moulded top ----------------------------------------------------------
  // A 25 mm overhanging slab with a bullnose edge, not a flat lid. The cylinders
  // run along the front and sides; corner spheres close the joint.
  const topParts = [];
  const tw = W + 0.05, td = D + 0.045;
  const noseR = 0.009;
  // The slab is inset by the nose radius on every side; the half-rounds then
  // form the actual edge instead of sitting buried inside a square lid.
  topParts.push(box(tw - noseR * 2, topT - 0.012, td - noseR * 2, 1)
    .translate(0, H - (topT - 0.012) / 2, 0));
  // under-edge moulding, set in 6 mm
  topParts.push(box(tw - 0.012, 0.010, td - 0.012, 1).translate(0, H - topT + 0.002, 0));
  const frontNose = new THREE.CylinderGeometry(noseR, noseR, tw, 8);
  frontNose.rotateZ(Math.PI / 2);
  frontNose.translate(0, H - noseR, td / 2 - noseR);
  topParts.push(frontNose);
  const backNose = new THREE.CylinderGeometry(noseR, noseR, tw, 8);
  backNose.rotateZ(Math.PI / 2);
  backNose.translate(0, H - noseR, -td / 2 + noseR);
  topParts.push(backNose);
  for (const sx of [-1, 1]) {
    const sideNose = new THREE.CylinderGeometry(noseR, noseR, td, 8);
    sideNose.rotateX(Math.PI / 2);
    sideNose.translate(sx * (tw / 2 - noseR), H - noseR, 0);
    topParts.push(sideNose);
    for (const sz of [-1, 1]) {
      const corner = new THREE.SphereGeometry(noseR, 8, 6);
      corner.translate(sx * (tw / 2 - noseR), H - noseR, sz * (td / 2 - noseR));
      topParts.push(corner);
    }
  }
  const topMesh = new THREE.Mesh(merge(topParts), topMat);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // One collision box: the carcass footprint, rotated with the unit. The drawer
  // never pushes the body — it slides into space that was validated as clear.
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  const hx = (W / 2) * c + (D / 2) * s;
  const hz = (W / 2) * s + (D / 2) * c;
  props.colliders.push({
    x1: x - hx, x2: x + hx, z1: z - hz, z2: z + hz,
    kind: 'furniture', y0: level.y, y1: level.y + H,
  });

  // Register one interaction per drawer, at that drawer's front face.
  const cos = Math.cos(rot), sin = Math.sin(rot);
  for (const drawer of unit.drawers) {
    const lx = 0, lz = D / 2 + 0.06;
    const wx = x + lx * cos + lz * sin;
    const wz = z - lx * sin + lz * cos;
    const target = {
      id: `drawer:${label}:${drawer.index}`,
      // The stack is built from the floor up (ap0 is the lowest opening), so
      // index 0 is the BOTTOM drawer. The prompt used to call it the top one,
      // which meant the HUD contradicted the drawer the player was looking at.
      name: drawer.index === unit.drawers.length - 1 ? 'the top drawer' : drawer.index === 1 ? 'the middle drawer' : 'the bottom drawer',
      kind: 'drawer', unit, drawer, room: room.name,
      x: wx, y: level.y + drawer.yc, z: wz,
    };
    props.interactables.push(target);
    drawer.targetEntry = target;
  }

  scene.add(group);
  cabinets.units.push(unit);
  cabinets.count++;
  return unit;
}

function merge(geos) {
  return geos.length === 1 ? geos[0] : mergeGeometries(geos);
}

export function updateCabinets(dt) {
  for (const u of cabinets.units) {
    for (const d of u.drawers) {
      const p = d.holder.position;
      if (Math.abs(p.z - d.target) < 1e-4) continue;
      p.z += (d.target - p.z) * Math.min(1, dt * 8);
      if (Math.abs(p.z - d.target) < 1e-3) p.z = d.target;
    }
  }
}

export function toggleDrawer(unit, drawer) {
  drawer.open = !drawer.open;
  drawer.target = drawer.open ? drawer.travel : 0;
  // The interaction point deliberately stays on the CLOSED front. Moving it
  // out with the drawer made the focus jump to a neighbouring drawer as soon
  // as this one opened; a person reaches for the opening, wherever the front
  // has slid to.
  void unit;
  return drawer.open;
}

// --- placement -------------------------------------------------------------
// A wall-backed spot with real clearance: inside the room's plaster line, out
// of every door's approach, and clear of every piece of furniture already
// placed on this floor. Searches along each wall in 10 cm steps and takes the
// candidate nearest the room's centre, so the piece lands where a person would
// put it rather than wherever the scan happened to start.
function overlaps(a, b, pad = 0.02) {
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad;
}

function spotFor(level, room, W, D, H) {
  const rect = {
    x0: room.x0 + wallFace(level, 'z', room.x0).half,
    x1: room.x1 - wallFace(level, 'z', room.x1).half,
    z0: room.z0 + wallFace(level, 'x', room.z0).half,
    z1: room.z1 - wallFace(level, 'x', room.z1).half,
  };
  const doors = [];
  for (const d of level.doors) {
    if (d.axis === 'x' && d.c >= room.z0 - 0.4 && d.c <= room.z1 + 0.4 && d.at > room.x0 - 0.4 && d.at < room.x1 + 0.4) {
      doors.push({ x0: d.at - d.w / 2 - 0.55, x1: d.at + d.w / 2 + 0.55, z0: d.c - 1.0, z1: d.c + 1.0 });
    }
    if (d.axis === 'z' && d.c >= room.x0 - 0.4 && d.c <= room.x1 + 0.4 && d.at > room.z0 - 0.4 && d.at < room.z1 + 0.4) {
      doors.push({ x0: d.c - 1.0, x1: d.c + 1.0, z0: d.at - d.w / 2 - 0.55, z1: d.at + d.w / 2 + 0.55 });
    }
  }
  const solids = props.colliders.filter((c) => c.y0 !== undefined && c.y0 < level.y + H && c.y1 > level.y + 0.05);
  const ok = (b) => {
    if (b.x0 < rect.x0 + 0.05 || b.x1 > rect.x1 - 0.05) return false;
    if (b.z0 < rect.z0 + 0.05 || b.z1 > rect.z1 - 0.05) return false;
    for (const z of doors) if (overlaps(b, z, 0)) return false;
    for (const c of solids) {
      if (overlaps(b, { x0: c.x1, x1: c.x2, z0: c.z1, z1: c.z2 }, 0.04)) return false;
    }
    return true;
  };

  const midX = (rect.x0 + rect.x1) / 2, midZ = (rect.z0 + rect.z1) / 2;
  const walls = ['S', 'N', 'W', 'E'];
  let best = null;
  for (const wall of walls) {
    const rot = wall === 'N' ? Math.PI : wall === 'S' ? 0 : wall === 'E' ? -Math.PI / 2 : Math.PI / 2;
    const gap = 0.05;
    let fixed, a0, a1;
    if (wall === 'N' || wall === 'S') {
      fixed = wall === 'N' ? rect.z1 - gap - D / 2 : rect.z0 + gap + D / 2;
      a0 = rect.x0 + W / 2 + 0.08; a1 = rect.x1 - W / 2 - 0.08;
    } else {
      fixed = wall === 'E' ? rect.x1 - gap - D / 2 : rect.x0 + gap + D / 2;
      a0 = rect.z0 + W / 2 + 0.08; a1 = rect.z1 - W / 2 - 0.08;
    }
    if (a1 < a0) continue;
    for (let a = a0; a <= a1 + 1e-6; a += 0.10) {
      const x = wall === 'N' || wall === 'S' ? a : fixed;
      const z = wall === 'N' || wall === 'S' ? fixed : a;
      const halfW = (wall === 'N' || wall === 'S') ? W / 2 : D / 2;
      const halfD = (wall === 'N' || wall === 'S') ? D / 2 : W / 2;
      const b = { x0: x - halfW, x1: x + halfW, z0: z - halfD, z1: z + halfD };
      if (!ok(b)) continue;
      const score = Math.hypot(x - midX, z - midZ);
      if (!best || score < best.score) best = { x, z, rot, score, box: b };
    }
  }
  return best;
}

// --- the authored containers ----------------------------------------------
// Only these rooms get functional containers. The rest of the house keeps the
// static furniture set, which is the intended distinction between furniture
// and a searchable cabinet.
const PROGRAM = [
  { level: 'F2', room: 'FF2-03', label: 'master_dresser', w: 1.10, h: 0.92, d: 0.50, drawers: 3,
    contents: { drawer: 0, id: 'letter', name: 'a folded letter',
      text: 'A letter in your mother\'s hand. "The east room key is in the desk by the window. Do not let your father run the generator after dark."' } },
  { level: 'F2', room: 'FF2-06', label: 'bedroom3_nightstand', w: 0.72, h: 0.62, d: 0.42, drawers: 2,
    contents: { drawer: 1, id: 'photograph', name: 'a water-stained photograph',
      text: 'Four people on the porch. One face has been scratched out with a fingernail, over and over.' } },
  { level: 'GF', room: 'GF-06', label: 'study_pedestal', w: 0.72, h: 0.76, d: 0.52, drawers: 3,
    contents: { drawer: 2, id: 'ledgerpage', name: 'a ledger page',
      text: 'A page torn from the estate ledger: "August — fuel, one drum. Fuse, one. Paid in cash. The house will not take the current."' } },
  { level: 'GF', room: 'GF-01', label: 'kitchen_drawers', w: 0.90, h: 0.86, d: 0.50, drawers: 3,
    contents: { drawer: 1, id: 'matches', name: 'a box of matches',
      text: 'A box of matches, damp at one corner. Enough to strike once.' } },
  // The foyer cabinet used to stand on the west wall, in the gap between the
  // wall and the stair tower: with the static console it sealed the approach
  // to the grand stair. It belongs in the sitting room, and the foyer keeps
  // its console on the east wall.
  { level: 'GF', room: 'GF-15', label: 'sitting_console', w: 1.05, h: 0.80, d: 0.40, drawers: 2, contents: null },
];

export function buildCabinets(scene, levels) {
  cabinets.units.length = 0;
  cabinets.errors.length = 0;
  cabinets.count = 0;
  for (const spec of PROGRAM) {
    const level = levels.find((l) => l.id === spec.level);
    const room = level?.rooms.find((r) => r.id === spec.room);
    if (!room) { cabinets.errors.push('no room ' + spec.level + '/' + spec.room); continue; }
    const spot = spotFor(level, room, spec.w, spec.d, spec.h);
    if (!spot) { cabinets.errors.push('no clear wall for ' + spec.label); continue; }
    makeUnit({
      scene, level, room, x: spot.x, z: spot.z, rot: spot.rot,
      width: spec.w, height: spec.h, depth: spec.d,
      drawers: spec.drawers, label: spec.label, contents: spec.contents,
    });
  }
  return cabinets;
}
