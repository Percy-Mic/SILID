// UNDERGROUND — the service tunnel, the cave it opens into, and the way out.
//
// THE ROUTE, in world metres (+x east, +z north, +y up). Every number the
// player walks on is one of these, and the terrain cut that lets the last
// stretch come up into daylight lives in terrain.js (CISTERN) with the same
// figures. Nothing here teleports: it is one continuous floor from the
// basement's east door to the forest beyond the cistern yard.
//
//   segment             x              z          floor y      clear height
//   basement junction   16.0          4.5..7.5   -3.40         3.00
//   A brick tunnel      16.0 → 33.0   4.6..7.4   -3.40         2.45
//   B limestone cave    33.0 → 48.0   3.4..8.6   -3.40         2.78
//   C transition        48.0 → 49.0   4.6..7.4   -3.40 → -3.25  2.20
//   D rising vault      49.0 → 56.4   4.6..7.4   -3.25 → -1.44  2.10
//   E cistern court     56.4 → 61.8   3.0..9.0   -1.44         open sky
//   F exit flight       61.8 → 67.0   7.2..8.6   -1.44 → +0.85  2.29 climb
//   G forest            67.0 →        6.9..8.9   +0.85         open sky
//
// The tunnel leaves the basement at the SAME floor level as the basement, which
// is the whole point of the level's datum: the basement is at -3.40, the
// tunnel is at -3.40, and the cave is at -3.40. It used to be authored at -10,
// which put the tunnel mouth two storeys up the basement's east wall.
//
// The climb out is 4.25 m over 18 m of floor: a service stair, not a ladder.
// The last two and a half metres of it are inside a masonry court sunk into the
// grounds — the "recessed opening in a retaining wall" the brief asks for —
// with a barred iron-strapped door at the bottom and a stone flight up the
// eastern bank. From the forest you see a grassy cutting and a parapet, not a
// hatch in a lawn.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps } from './materials.js';
import { heightAt, CISTERN } from './terrain.js';
import { architecture } from './architecture.js';
import { props } from './props.js';

const Y = -3.40;                       // the underground datum (basement floor)
const CAVE_Y = -3.40;
const CF = -1.44;                      // the cistern court's floor
const ST_X0 = 61.8, ST_X1 = 67.0, ST_N = 15;
const ST_TREAD = (ST_X1 - ST_X0) / ST_N;
const ST_RISE = (CISTERN.stair.top - CF) / ST_N;
const treadY = (i) => CF + (i + 1) * ST_RISE;

// --- the one box helper ----------------------------------------------------
// UVs in metres over `per` metres, so a brick wall and a stone floor both show
// their material at the size the photograph was taken at. Every static piece
// below is a box: they merge into a handful of meshes per material.
function bx(w, h, d, per = 2.4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / per, (uv.getY(k) * dims[f][1]) / per);
    }
  }
  uv.needsUpdate = true;
  g.clearGroups();
  return g;
}

// A slab laid along a slope: the box's local +x runs from (x0,y0) to (x1,y1) and
// its underside sits on that line. Used for the vault's side walls and ceiling,
// so the tunnel climbs instead of stepping in 150 mm jumps of wall.
function slopeSlab(x0, y0, x1, y1, thick, width, z, per = 2.4) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const th = Math.atan2(y1 - y0, x1 - x0);
  const g = bx(len, thick, width, per);
  g.rotateZ(th);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2 + (thick / 2) * Math.cos(th), z);
  return g;
}

function meshOf(geos, mat, name) {
  if (!geos.length) return null;
  const m = new THREE.Mesh(geos.length === 1 ? geos[0] : mergeGeometries(geos), mat);
  m.name = name;
  m.receiveShadow = true;
  return m;
}

export const underground = {
  lights: [],
  exit: { x: 68.2, z: 7.9 },
  door: null,
};

export function buildUnderground(scene) {
  const group = new THREE.Group();
  group.name = 'Underground';

  const brick = materials.brick.clone();
  tileMaps(brick, 1, 1);
  const stone = materials.stone.clone();
  tileMaps(stone, 1, 1);
  const stoneDark = materials.stoneDark.clone();
  tileMaps(stoneDark, 1, 1);
  const concrete = materials.concrete.clone();
  tileMaps(concrete, 1, 1);
  const floorStone = materials.stone.clone();
  tileMaps(floorStone, 1, 1);
  floorStone.color.setHex(0x8f8977);

  const geos = { brick: [], stone: [], stoneDark: [], concrete: [], floor: [] };

  // =========================================================================
  // A — the brick tunnel (unchanged shape; the mouth now lands on the
  // basement's floor instead of two storeys above it)
  // =========================================================================
  {
    const g = bx(17.2, 0.24, 3.2, 2.6);
    g.translate(24.6, Y - 0.12, 6);
    geos.concrete.push(g);

    for (const z of [4.4, 7.6]) {
      const w = bx(17.2, 2.45, 0.36, 2.4);
      w.translate(24.6, Y + 1.22, z);
      geos.brick.push(w);
    }
    const ceil = bx(17.2, 0.26, 3.6, 2.6);
    ceil.translate(24.6, Y + 2.6, 6);
    geos.brick.push(ceil);

    // masonry piers every 3 m: visible structure, and they break up the corridor
    for (let x = 17.4; x < 33; x += 2.9) {
      for (const z of [4.45, 7.55]) {
        const p = bx(0.34, 2.5, 0.5, 2.6);
        p.translate(x, Y + 1.25, z);
        geos.stoneDark.push(p);
      }
      const beam = bx(0.28, 0.26, 3.5, 2.6);
      beam.translate(x, Y + 2.48, 6);
      geos.stoneDark.push(beam);
    }

    // floor drain channel down the centre, and a sump at the low end
    const grate = new THREE.Mesh(new THREE.BoxGeometry(16, 0.03, 0.22), materials.iron);
    grate.position.set(24.6, Y + 0.015, 6);
    group.add(grate);
    const sump = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), materials.iron);
    sump.position.set(24, Y + 0.02, 6);
    group.add(sump);

    // conduit and two maintenance lamps: every light has a real fixture
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 16.4, 6), materials.rust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(24.6, Y + 2.25, 4.68);
    group.add(pipe);
    for (const x of [20.5, 28.5]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.12), materials.iron);
      fixture.position.set(x, Y + 2.42, 6);
      group.add(fixture);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x6b6a5a, emissive: 0xd8c08a, emissiveIntensity: 1.2 }));
      bulb.position.set(x, Y + 2.37, 6);
      group.add(bulb);
      const light = new THREE.PointLight(0xd8bd8a, 7, 9, 2);
      light.position.set(x, Y + 2.3, 6);
      group.add(light);
      underground.lights.push(light);
    }
  }

  // =========================================================================
  // B — the cave. A displaced tube, squashed vertically so its crown stays
  // under the forest floor: the old one had a 4.1 m radius centred at -1.2,
  // which put 2.4 m of rock tube ABOVE the ground at x=40 and left the
  // passage one ring of open sky where it met the tunnel. Crown -0.62, floor
  // -3.48, so the mesh never surfaces and the floor plane always closes it.
  // =========================================================================
  {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(33.0, -2.05, 6.0),
      new THREE.Vector3(36.5, -2.05, 6.2),
      new THREE.Vector3(40.0, -2.05, 5.7),
      new THREE.Vector3(43.5, -2.05, 6.1),
      new THREE.Vector3(47.0, -2.05, 5.8),
      new THREE.Vector3(48.2, -2.05, 6.0),
    ]);
    const tube = new THREE.TubeGeometry(curve, 64, 2.6, 14, false);
    const pos = tube.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      // squash the section about the curve's height: 2.6 m radius sideways,
      // 1.43 m vertically, which is a wide low solution cavity
      v.y = -2.05 + (v.y + 2.05) * 0.55;
      const n = Math.sin(v.x * 1.7 + v.y * 2.1) * Math.cos(v.z * 1.9) * 0.55
              + Math.sin(v.x * 0.6) * 0.35;
      v.x += n * 0.16;
      v.y += n * 0.18;
      v.z += n * 0.26;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    tube.computeVertexNormals();
    const rockMat = materials.boulder.clone();
    rockMat.side = THREE.BackSide;
    rockMat.color.setHex(0x4c4a42);
    tileMaps(rockMat, 1, 1);
    const cave = new THREE.Mesh(tube, rockMat);
    cave.name = 'Cave';
    cave.receiveShadow = true;
    group.add(cave);
    underground.cave = cave;

    // one flat floor plane closes the tube's bottom everywhere it is walked on
    const caveFloorMat = materials.mud.clone();
    tileMaps(caveFloorMat, 2, 4);
    caveFloorMat.color.setHex(0x3b362b);
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 6.2), caveFloorMat);
    cf.rotation.x = -Math.PI / 2;
    cf.position.set(40.6, CAVE_Y, 6);
    cf.name = 'CaveFloor';
    group.add(cf);
    underground.caveFloor = cf;

    // standing water at the low corner; not a solid, just water
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshStandardMaterial({
      color: 0x070d0e, roughness: 0.04, metalness: 0.3,
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(45.2, CAVE_Y + 0.012, 5.1);
    group.add(pool);

    const caveLight = new THREE.PointLight(0x8fa4c0, 3.2, 13, 2);
    caveLight.position.set(38, -1.5, 6);
    group.add(caveLight);
    underground.lights.push(caveLight);

    // The rock's west end is an open ring; the brick tunnel only fills the
    // middle of it. A face with a rectangular hole for the tunnel closes the
    // ring, so no daylight can leak around the mouth.
    const face = new THREE.Shape();
    const hz = 2.9, hy = 1.85;
    // built in (z, y) and rotated -90° about Y, which maps shape-x onto world z
    face.moveTo(6 - hz, CAVE_Y - 0.35);
    face.lineTo(6 + hz, CAVE_Y - 0.35);
    face.lineTo(6 + hz, CAVE_Y + 2 * hy);
    face.lineTo(6 - hz, CAVE_Y + 2 * hy);
    face.closePath();
    const hole = new THREE.Path();
    hole.moveTo(4.55, CAVE_Y - 0.05);
    hole.lineTo(7.45, CAVE_Y - 0.05);
    hole.lineTo(7.45, Y + 2.6);
    hole.lineTo(4.55, Y + 2.6);
    hole.closePath();
    face.holes.push(hole);
    const faceGeo = new THREE.ShapeGeometry(face);
    faceGeo.rotateY(-Math.PI / 2);
    faceGeo.translate(33.02, 0, 0);
    const faceMat = materials.stoneDark.clone();
    faceMat.side = THREE.DoubleSide;
    faceMat.color.setHex(0x565248);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.name = 'CaveMouthFace';
    group.add(faceMesh);
  }

  // =========================================================================
  // C — the transition chamber: where the cave stops being rock and the
  // masonry takes over again. Jambs and a lintel frame the portal.
  // =========================================================================
  const CH_X0 = 48.0, CH_X1 = 49.0;
  {
    for (const z of [4.4, 7.6]) {
      const w = bx(CH_X1 - CH_X0 + 0.4, 2.45, 0.36, 2.4);
      w.translate((CH_X0 + CH_X1) / 2, Y + 1.225, z);
      geos.brick.push(w);
    }
    const ceil = bx(CH_X1 - CH_X0 + 0.4, 0.30, 3.6, 2.6);
    ceil.translate((CH_X0 + CH_X1) / 2, Y + 2.45, 6);
    geos.brick.push(ceil);

    // the portal face: two jambs and a lintel, standing on the cave's floor
    for (const [z, d] of [[3.95, 1.2], [8.05, 1.2]]) {
      const j = bx(0.5, 3.0, d, 2.6);
      j.translate(CH_X0, Y + 1.2, z);
      geos.stoneDark.push(j);
    }
    const lin = bx(0.5, 0.72, 2.9, 2.6);
    lin.translate(CH_X0, Y + 2.56, 6);
    geos.stoneDark.push(lin);

    // caged bulkhead lamp on the chamber's ceiling
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), materials.ironDark);
    cage.position.set(CH_X0 + 0.5, Y + 2.24, 6);
    group.add(cage);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x7a6a52, emissive: 0xe8c98a, emissiveIntensity: 1.6 }));
    bulb.position.set(CH_X0 + 0.5, Y + 2.14, 6);
    group.add(bulb);
    const lamp = new THREE.PointLight(0xe0c08c, 4.0, 8, 2);
    lamp.position.set(CH_X0 + 0.5, Y + 2.0, 6);
    group.add(lamp);
    underground.lights.push(lamp);
  }

  // =========================================================================
  // D — the rising vault: 13 brick steps climbing 1.81 m over 7.41 m, under a
  // sloped brick ceiling. The walls and the ceiling are slabs rotated to the
  // stair's own pitch, so the vault is a ramp, not a stack of boxes.
  // =========================================================================
  const V_X0 = 49.0, V_STEPS = 13, V_TREAD = 0.57;
  const V_X1 = V_X0 + V_STEPS * V_TREAD;             // 56.41
  const V_RISER = (CF - Y) / V_STEPS;                 // 0.1508, lands exactly on the court
  const V_Y0 = Y + V_RISER;                           // first tread's top: -3.249
  const V_Y1 = V_Y0 + (V_STEPS - 1) * V_RISER;        // last tread's top: -1.44
  {
    for (let i = 0; i < V_STEPS; i++) {
      const top = V_Y0 + i * V_RISER;
      const x = V_X0 + (i + 0.5) * V_TREAD;
      // 0.42 thick, so each tread reaches well below the one in front of it and
      // the flight is a solid mass with no gap under the nosing
      const t = bx(V_TREAD + 0.005, 0.42, 2.84, 2.6);
      t.translate(x, top - 0.21, 6);
      geos.concrete.push(t);
    }
    const pitch = Math.atan2(V_Y1 - V_Y0, V_X1 - V_X0);
    // ceiling: 2.10 m above the nosing line at every step
    geos.brick.push(slopeSlab(V_X0, V_Y0 + 2.10, V_X1, V_Y1 + 2.10, 0.34, 3.9, 6));
    // side walls: from just under the treads up to 2.30 above the nosings
    for (const z of [4.4, 7.6]) {
      geos.brick.push(slopeSlab(V_X0, V_Y0 - 0.45, V_X1, V_Y1 - 0.45, 2.75, 0.35, z));
    }

    // a passage that was bricked up when the works were done: the shadow of an
    // opening, a filled face, and a timber head. Blocked, and it says so.
    const blocked = bx(0.10, 1.05, 1.30, 2.6);
    blocked.translate(51.9, -1.55, 7.40);
    geos.stoneDark.push(blocked);
    const head = bx(0.14, 0.14, 1.50, 2.4);
    head.translate(51.9, -0.99, 7.40);
    geos.stoneDark.push(head);

    // painted maintenance marks: the level datum and a stencilled number
    const paint = new THREE.MeshStandardMaterial({ color: 0xcfc8b2, roughness: 0.95 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.01), paint);
    band.position.set(50.2, -2.05, 4.60);
    group.add(band);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.01), paint);
    tag.position.set(52.9, -1.25, 4.60);
    group.add(tag);

    const vaultLamp = new THREE.PointLight(0xc9b089, 2.6, 8, 2);
    vaultLamp.position.set(52.6, V_Y0 + 1.85, 6);
    group.add(vaultLamp);
    underground.lights.push(vaultLamp);
  }

  // =========================================================================
  // E — the cistern court. Sunk into the grounds (terrain.js cuts the bed),
  // stone lined, open to the sky, with the tunnel's door in its west wall.
  // =========================================================================
  const C = { x0: 56.0, x1: 62.2, z0: 2.6, z1: 9.4 };   // the walls' outer faces
  const CW = 0.40;                                        // wall thickness
  // CF (the court's floor) is the module-level datum: the vault has to land on
  // it before this block runs, and a second declaration here would put the
  // whole function in its temporal dead zone.
  const CT = 1.12;                                        // the walls' top
  {
    // floor: one slab under the whole court, its top at CF
    const slab = bx(C.x1 - C.x0, 0.16, C.z1 - C.z0, 2.6);
    slab.translate((C.x0 + C.x1) / 2, CF - 0.08, (C.z0 + C.z1) / 2);
    geos.floor.push(slab);

    const H = CT + 1.66;                                  // from the bed to the coping
    const wall = (w, d, x, z) => {
      const g = bx(w, H, d, 2.6);
      g.translate(x, CT - H / 2, z);
      geos.stoneDark.push(g);
    };

    // west: the tunnel's wall, split around the door opening (z 5.25..6.75)
    wall(CW, 2.65, C.x0 + CW / 2, 3.925);
    wall(CW, 2.65, C.x0 + CW / 2, 8.075);
    const lintel = bx(CW, 0.50, 1.50, 2.6);
    lintel.translate(C.x0 + CW / 2, 0.87, 6.0);
    geos.stoneDark.push(lintel);
    // east: split around the stair's opening (z 7.2..8.6)
    wall(CW, 4.60, C.x1 - CW / 2, 4.90);
    wall(CW, 0.80, C.x1 - CW / 2, 9.00);
    // south and north
    wall(C.x1 - C.x0, CW, (C.x0 + C.x1) / 2, C.z0 + CW / 2);
    wall(C.x1 - C.x0, CW, (C.x0 + C.x1) / 2, C.z1 - CW / 2);

    // coping: a proud stone course, so the court reads from the forest as a
    // stone rim in a cutting rather than a hole with a lid
    const cope = (w, d, x, z) => {
      const g = bx(w, 0.11, d, 1.6);
      g.translate(x, CT + 0.055, z);
      geos.stone.push(g);
    };
    cope(0.52, 2.75, C.x0 + CW / 2, 3.925);
    cope(0.52, 2.75, C.x0 + CW / 2, 8.075);
    cope(0.52, 1.50, C.x0 + CW / 2, 6.0);
    cope(0.52, 4.60, C.x1 - CW / 2, 4.90);
    cope(0.52, 0.80, C.x1 - CW / 2, 9.00);
    cope(C.x1 - C.x0, 0.52, (C.x0 + C.x1) / 2, C.z0 + CW / 2);
    cope(C.x1 - C.x0, 0.52, (C.x0 + C.x1) / 2, C.z1 - CW / 2);

    // ---- the door ---------------------------------------------------------
    // A plank service door on three strap hinges, hung to swing into the court.
    // Its collider is the line across the opening and it is what the E prompt
    // enables, so the closing is real and not a texture swap.
    const swing = new THREE.Group();
    swing.position.set(C.x0 + CW / 2, CF, 5.25);
    swing.name = 'CisternDoor';
    const leafGeos = [];
    const leaf = bx(0.075, 2.02, 1.44, 2.4);
    leaf.translate(0, 1.01, 0.75);
    leafGeos.push(leaf);
    const leafMesh = new THREE.Mesh(mergeGeometries(leafGeos), (() => {
      const m = materials.woodDirt.clone();
      tileMaps(m, 1, 1);
      m.color.setHex(0x5a4732);
      return m;
    })());
    leafMesh.castShadow = true;
    swing.add(leafMesh);
    for (const y of [0.42, 1.05, 1.70]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 1.34), materials.ironDark);
      strap.position.set(0.046, y, 0.73);
      swing.add(strap);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 6, 12), materials.ironDark);
    handle.position.set(0.09, 1.02, 1.28);
    handle.rotation.y = Math.PI / 2;
    swing.add(handle);
    swing.rotation.y = 0;
    group.add(swing);

    const doorCollider = {
      x1: C.x0 + CW / 2, z1: 5.20, x2: C.x0 + CW / 2, z2: 6.80,
      kind: 'door', y0: -1.60, y1: 0.70, disabled: false,
    };
    architecture.colliders.push(doorCollider);
    underground.door = {
      swing, collider: doorCollider, open: false, openAngle: 1.42,
      id: 'cistern_door',
      x: C.x0 + CW / 2 + 0.25, y: CF + 0.95, z: 6.0,
    };

    // ---- what the court has been used for ---------------------------------
    // sump grate at the low point, a shallow standing pool, a drain channel
    const sump = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.86), materials.iron);
    sump.position.set(57.3, CF + 0.015, 8.4);
    group.add(sump);
    const drain = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.04, 0.26), materials.ironDark);
    drain.position.set(58.9, CF + 0.01, 8.4);
    group.add(drain);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshStandardMaterial({
      color: 0x0a1112, roughness: 0.06, metalness: 0.35,
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(57.1, CF + 0.008, 3.7);
    group.add(water);

    // a rusted rising main and its valve wheel, on the north wall
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.9, 8), materials.rust);
    main.position.set(59.9, CF + 0.95, C.z1 - CW - 0.10);
    group.add(main);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 6, 14), materials.ironDark);
    wheel.position.set(59.9, CF + 1.05, C.z1 - CW - 0.26);
    group.add(wheel);

    // two crates and a coil of old hose, pushed against the south wall
    for (const [x, z, s] of [[57.0, 3.35, 0.62], [57.75, 3.4, 0.48]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), (() => {
        const m = materials.woodDirt.clone();
        tileMaps(m, 1, 1);
        return m;
      })());
      c.position.set(x, CF + s * 0.4, z);
      c.rotation.y = 0.12;
      group.add(c);
      const band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.01, 0.05, s + 0.01), materials.rustDark);
      band.position.set(x, CF + s * 0.55, z);
      band.rotation.y = 0.12;
      group.add(band);
    }

    // a low caged light over the door — the one fitting anyone ever wired in
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), materials.ironDark);
    bracket.position.set(C.x0 + CW + 0.06, 0.42, 6.9);
    group.add(bracket);
    const bulk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x6f6a5c, emissive: 0xb99a63, emissiveIntensity: 0.9 }));
    bulk.position.set(C.x0 + CW + 0.16, 0.36, 6.9);
    group.add(bulk);
    const courtLamp = new THREE.PointLight(0xc9ab7a, 1.8, 5.5, 2);
    courtLamp.position.set(C.x0 + CW + 0.2, 0.36, 6.9);
    group.add(courtLamp);
    underground.lights.push(courtLamp);

    // roots through the coping: the grounds are taking the yard back
    for (const [x, z, len, tilt] of [[57.6, 9.1, 1.5, 0.22], [60.2, 9.15, 1.2, -0.15],
      [61.7, 3.0, 1.35, 0.18], [56.2, 4.4, 1.1, -0.2]]) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, len, 5), materials.barkMoss);
      root.position.set(x, CF + 1.9, z);
      root.rotation.z = tilt;
      group.add(root);
    }
  }

  // =========================================================================
  // F — the exit flight. 15 stone treads up the east bank, in a channel cut
  // through the grounds, between two retaining/parapet cheeks that rise to the
  // field where the bank is higher than the stair and become a parapet where
  // the stair comes out at ground level.
  // =========================================================================
  const S = CISTERN.stair;
  {
    for (let i = 0; i < ST_N; i++) {
      const top = treadY(i);
      const x = ST_X0 + (i + 0.5) * ST_TREAD;
      const t = bx(ST_TREAD + 0.005, 0.44, 1.40, 2.0);
      t.translate(x, top - 0.22, 7.9);
      geos.concrete.push(t);
    }
    // the landing: level with the field at x=67, wide enough to close the cut's
    // bed on both sides and long enough to overhang its far end
    const landing = bx(2.0, 0.34, 1.90, 2.0);
    landing.translate(67.9, S.top - 0.17, 7.9);
    geos.floor.push(landing);

    // cheeks, in 0.52 m lifts following the flight
    const lift = (ST_X1 - ST_X0) / 10;
    for (let k = 0; k < 10; k++) {
      const x = ST_X0 + (k + 0.5) * lift;
      const idx = Math.min(ST_N - 1, Math.max(0, Math.floor((x - ST_X0) / ST_TREAD)));
      const top = Math.max(treadY(idx) + 0.55, 1.14);
      for (const z of [7.025, 8.775]) {
        const g = bx(lift + 0.02, top + 1.66, 0.35, 2.6);
        g.translate(x, top - (top + 1.66) / 2, z);
        geos.stoneDark.push(g);
      }
    }
  }

  // =========================================================================
  // merge the static geometry, one mesh per material
  // =========================================================================
  const brickMesh = meshOf(geos.brick, brick, 'Underground_Brick');
  const stoneMesh = meshOf(geos.stone, stone, 'Underground_Stone');
  const darkMesh = meshOf(geos.stoneDark, stoneDark, 'Underground_StoneDark');
  const concreteMesh = meshOf(geos.concrete, concrete, 'Underground_Concrete');
  const floorMesh = meshOf(geos.floor, floorStone, 'Underground_Floor');
  for (const m of [brickMesh, stoneMesh, darkMesh, concreteMesh, floorMesh]) if (m) group.add(m);

  // =========================================================================
  // walking surfaces. floorHeightAt() reads these before the level slabs, so
  // the tunnel is ground and not a hole in the height field.
  // =========================================================================
  architecture.extraFloors.push(
    { x0: 16, x1: 33.3, z0: 4.45, z1: 7.55, y: Y },
    { x0: 32.5, x1: 48.4, z0: 2.9, z1: 9.1, y: CAVE_Y },
    { x0: 47.9, x1: 49.1, z0: 4.4, z1: 7.6, y: Y },
    { x0: C.x0, x1: C.x1 - CW, z0: C.z0, z1: C.z1, y: CF },
    { x0: 66.9, x1: 68.9, z0: 6.95, z1: 8.85, y: S.top },
  );
  for (let i = 0; i < V_STEPS; i++) {
    architecture.extraFloors.push({
      x0: V_X0 + i * V_TREAD, x1: V_X0 + (i + 1) * V_TREAD,
      z0: 4.5, z1: 7.5, y: V_Y0 + i * V_RISER,
    });
  }
  for (let i = 0; i < ST_N; i++) {
    architecture.extraFloors.push({
      x0: ST_X0 + i * ST_TREAD, x1: ST_X0 + (i + 1) * ST_TREAD,
      z0: 7.15, z1: 8.65, y: treadY(i),
    });
  }

  // =========================================================================
  // colliders. Walls belong to a floor, so each carries its own y band: a wall
  // in the court does not exist for a body in the cave below it.
  // =========================================================================
  const seg = (x1, z1, x2, z2, y0, y1, kind) =>
    architecture.colliders.push({ x1, z1, x2, z2, y0, y1, kind });

  // brick tunnel
  for (const z of [4.45, 7.55]) seg(16, z, 33.2, z, Y - 0.1, Y + 2.45, 'tunnel');

  // cave: an enclosing polyline that follows the squashed tube's floor width,
  // with the mouth left open and the rest closed. The old polygon's ends were
  // 2.2 m clear of the tunnel walls, which let the player walk into the rock.
  seg(33.0, 3.45, 48.0, 3.45, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');
  seg(48.0, 3.45, 48.0, 4.55, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');
  seg(48.0, 7.45, 48.0, 8.55, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');
  seg(48.0, 8.55, 33.0, 8.55, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');
  seg(33.0, 3.45, 33.0, 4.45, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');
  seg(33.0, 8.55, 33.0, 7.55, CAVE_Y - 0.1, CAVE_Y + 3.0, 'cave');

  // chamber + vault walls, full height of the climb
  for (const z of [4.58, 7.42]) seg(48, z, 56.2, z, Y - 0.1, V_Y1 + 2.3, 'tunnel');

  // the court's walls
  seg(C.x0 + CW / 2, C.z0, C.x0 + CW / 2, 5.20, -1.7, 1.15, 'wall');
  seg(C.x0 + CW / 2, 6.80, C.x0 + CW / 2, C.z1, -1.7, 1.15, 'wall');
  seg(C.x1 - CW / 2, C.z0, C.x1 - CW / 2, 7.20, -1.7, 1.15, 'wall');
  seg(C.x1 - CW / 2, 8.60, C.x1 - CW / 2, C.z1, -1.7, 1.15, 'wall');
  seg(C.x0, C.z0 + CW / 2, C.x1, C.z0 + CW / 2, -1.7, 1.15, 'wall');
  seg(C.x0, C.z1 - CW / 2, C.x1, C.z1 - CW / 2, -1.7, 1.15, 'wall');

  // the exit flight's cheeks
  for (const z of [7.025, 8.775]) seg(ST_X0, z, ST_X1, z, -1.7, 1.6, 'wall');

  // =========================================================================
  // dress the cutting: boulders and a fallen branch on the bank, so the ground
  // reads as something that has slumped and grown over rather than been cut
  // =========================================================================
  const rockMat2 = materials.boulder.clone();
  tileMaps(rockMat2, 1, 1);
  for (const [x, z, r, sy] of [[63.6, 4.0, 0.55, 0.6], [63.4, 9.9, 0.42, 0.55],
    [54.4, 8.4, 0.5, 0.5], [54.6, 2.9, 0.36, 0.7]]) {
    const y = heightAt(x, z);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), rockMat2);
    rock.scale.set(1, sy, 1);
    rock.position.set(x, y + r * sy * 0.35, z);
    rock.rotation.set(0.3, x, 0.15);
    group.add(rock);
  }
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 2.6, 6), materials.bark);
  branch.position.set(63.2, heightAt(63.2, 8.6) + 0.16, 8.6);
  branch.rotation.set(0.1, 0.4, Math.PI / 2 - 0.08);
  group.add(branch);

  scene.add(group);
  underground.group = group;
  return underground;
}

// The service door's prompt is registered here and not in buildUnderground(),
// because furnish() empties props.interactables when it dresses the house —
// underground geometry is built at 0.76 of the boot and the dressing runs at
// 0.89. main.js calls this after the dressing pass.
export function registerUndergroundInteractables() {
  const door = underground.door;
  if (!door) return;
  if (props.interactables.some((it) => it.id === 'cistern_door')) return;
  props.interactables.push({
    id: 'cistern_door',
    name: 'the service door',
    kind: 'tunnelDoor',
    x: door.x, y: door.y, z: door.z,
    door,
  });
}

// The cave mouth sits under the forest floor; this makes sure the terrain above
// it is high enough that the cave is genuinely underground and not daylight.
export function caveCover() {
  return heightAt(40, 6);
}
