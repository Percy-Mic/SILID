// TERRAIN — the ground, the road, and the water. One analytic height function
// drives both the mesh and the walker, so what you see and what you stand on
// cannot disagree. The mansion sits on a flat pad at y=0; the road runs north-
// south 38 m west of the west facade and is flattened into the same field.
//
// Layout (metres, +x east, +z north):
//   mansion      x -24..22, z -11..11, pad y 0, porch south at z=11
//   road         centreline x=-62, carriageway 7.2 m, edge nearest house -58.4
//   car          (-58.0, 26), on the shoulder, facing north
//   gate/path    (-15, 18) -> porch (-1, 13.5), then the road path south-west
//   pond         (-30, 46), radius ~9, fed by a stream from the north-east
//   ruins        (10, -19), east of the approach, in the trees
//
// The field is deliberately quiet near authored surfaces (road, pad, path) and
// rolls beyond them. A rim climb far outside the playable radius closes the
// view without a wall.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps, tileAtMetres, tileOf } from './materials.js';

export const GROUND_RADIUS = 190;
export const ROAD_X = -62;
export const MANSION = { x0: -24, x1: 22, z0: -11, z1: 11, padY: 0 };
export const POND = { x: -30, z: 46, r: 9.5, y: -1.35 };
export const CAR = { x: -56.8, z: 26, rot: Math.PI };

// Authored carriageway width. The car pulls off onto the shoulder 4.3 m from the
// centreline, so this number is load-bearing for the opening sequence and is not
// a surface-detail decision.
export const CARRIAGE = 7.2;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function rectMask(x, z, x0, x1, z0, z1, feather) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  const d = Math.max(dx, dz);
  return 1 - smooth(d / feather);
}

// The pond basin is a smooth bowl that meets the field at its lip.
function pondCarve(x, z) {
  const d = Math.hypot(x - POND.x, z - POND.z);
  if (d > POND.r * 1.35) return 0;
  const t = smooth(1 - d / (POND.r * 1.25));
  return -2.05 * t * t;
}

// A shallow stream channel from the house side of the forest into the pond.
function streamCarve(x, z) {
  const ax = -10, az = 58, bx = -26, bz = 48;
  const dx = bx - ax, dz = bz - az;
  const l = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l));
  const px = ax + t * dx, pz = az + t * dz;
  const d = Math.hypot(x - px, z - pz);
  if (d > 5) return 0;
  return -0.85 * smooth(1 - d / 5);
}

export function heightAt(x, z) {
  const mansionPad = rectMask(x, z, MANSION.x0 - 8, MANSION.x1 + 8, MANSION.z0 - 8, MANSION.z1 + 8, 12);
  const roadMask = rectMask(x, z, ROAD_X - 6.5, ROAD_X + 6.5, -220, 220, 10);
  const pathMask = rectMask(x, z, -18, 2, 12, 30, 8);
  const flat = Math.max(mansionPad, roadMask, pathMask * 0.75);

  let h = 0.55 * Math.sin(x * 0.041 + 0.7) * Math.cos(z * 0.037)
        + 0.32 * Math.sin(x * 0.093 + 1.9) * Math.sin(z * 0.081)
        + 0.18 * Math.cos(x * 0.19 + z * 0.14);

  // the estate rises gently to the east and north, so the house has a plinth
  h += 0.9 * smooth((x - 15) / 60) + 0.6 * smooth((-z - 20) / 70);

  // rim: closes the horizon well outside anything walkable
  const r = Math.hypot(x, z);
  h += 15 * smooth((r - GROUND_RADIUS) / 55);

  h = h * (1 - flat) + 0.005 * flat;
  h += pondCarve(x, z) + streamCarve(x, z);

  // the pad the house actually stands on is dead flat and sits 0.1 m proud
  const pad = rectMask(x, z, MANSION.x0, MANSION.x1, MANSION.z0, MANSION.z1, 1.5);
  h = h * (1 - pad);

  // The carriageway is a crowned surface: highest at the centreline, falling
  // to the verge at the asphalt edge, which is how a real road sheds water.
  // This is in the height function rather than only in the road mesh because
  // the walker and the vehicle are grounded on THIS function: before it
  // existed, the tarmac was a flat plane floating 70 mm above the ground the
  // SUV's tyres and the player's boots stood on, so both stood inside the road.
  const rd = x - roadCenter(z);
  const t = 1 - Math.min(1, (rd / 4.6) * (rd / 4.6));
  h += roadMask * 0.05 * Math.max(0, t);
  return h;
}

export function buildTerrain(scene) {
  const size = GROUND_RADIUS * 2 + 40;
  const seg = 220;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    // subtle colour change: wet leaf litter in the low ground, drier grass on
    // the rise. Not a green wash; the texture carries the detail.
    const wet = smooth((2 - y) / 5) * 0.35;
    colors[i * 3] = 0.92 - wet * 0.16;
    colors[i * 3 + 1] = 0.90 - wet * 0.10;
    colors[i * 3 + 2] = 0.82 - wet * 0.14;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = materials.groundForest.clone();
  mat.vertexColors = true;
  tileMaps(mat, 46, 46);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Terrain';
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Ribbon along the road's own centreline. The road is not perfectly straight:
// a long, slow bend is what hides the house until the player is almost level
// with the gate, exactly as the estate map asks.
export function roadCenter(z) {
  return ROAD_X + 3.2 * Math.sin((z - 10) * 0.012) + 1.4 * Math.sin(z * 0.031);
}

// A band of road surface following the centreline: `offset` metres to the side
// of the centreline, `width` metres wide, `lift` above the ground it follows.
//
// Two things about this matter more than the geometry:
//   * the band follows heightAt(), so the crowned carriageway, its broken edge
//     and the verge are one continuous surface instead of a flat plane laid
//     over rolling ground (that flat plane was the visible "floating slab" at
//     the roadside, and it was also why the vehicle sat 70 mm into the tarmac);
//   * UVs are written in METRES, and the material is scaled once by 1/tile in
//     tileAtMetres(). Exactly one of those two places may divide by the tile
//     size: doing it in both is how a 3.2 m asphalt photograph ends up
//     repeating every 10.24 m of road, which is the smear this replaced. The
//     previous ribbon wrote uv = (0..1 across, z*0.1 along) and callers
//     multiplied that by 40, tiling the same asphalt every 0.25 m instead.
// `cols` is how many vertices the band has ACROSS its width. Two is enough for
// a marking or a narrow break strip, but a band as wide as the carriageway must
// be subdivided across, or its surface is a chord under the crown. With two
// columns the 7.2 m carriageway was a straight line from edge to edge while the
// terrain between them held the true 50 mm crown — the forest floor poked up
// through the middle of the road and that is what the "smooth, streaky tarmac"
// actually was: the terrain, seen through the asphalt.
function bandGeo(z0, z1, offset, width, lift = 0.004, steps = 220, wob = 0, cols = 2) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const z = z0 + (z1 - z0) * (i / steps);
    const cx = roadCenter(z);
    const dz = 0.01;
    const tx = (roadCenter(z + dz) - roadCenter(z - dz)) / (2 * dz);
    const len = Math.hypot(tx, 1);
    const nx = 1 / len, nz = -tx / len;
    // A verge boundary is never a straight line for 400 m. `wob` slides the
    // whole band sideways on two incommensurate sines, so the soil-to-grass
    // edge wanders the way an unkerbed road edge does. Deterministic: the same
    // road every load, or a screenshot could not be compared with a rebuild.
    const off = offset + (wob ? wob * (Math.sin(z * 0.21 + 1.7) * 0.6 + Math.sin(z * 0.53) * 0.4) : 0);
    for (let j = 0; j < cols; j++) {
      const side = off - width / 2 + (width * j) / (cols - 1);
      const x = cx + nx * side, zz = z + nz * side;
      pos.push(x, heightAt(x, zz) + lift, zz);
      uv.push(side, zz);   // metres — the material carries the tile size
    }
    if (i < steps) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j;
        const b = a + cols;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function band(z0, z1, offset, width, mat, lift = 0.004, steps = 220, wob = 0, cols = 2) {
  const m = new THREE.Mesh(bandGeo(z0, z1, offset, width, lift, steps, wob, cols), mat);
  m.receiveShadow = true;
  return m;
}

// Merged bands: dashes, cracks and patches are dozens of small pieces that all
// share one material, so they are one draw call each rather than fifty.
function mergedBand(pieces, mat) {
  const geos = pieces.map((p) => bandGeo(p.z0, p.z1, p.offset, p.width, p.lift, 8, 0, p.cols || 2));
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Deterministic per-build sequence, so the road wears the same way every load
// and the repairs can be checked against a screenshot.
function seq(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildRoad(scene) {
  const group = new THREE.Group();
  group.name = 'Road';

  const Z0 = -200, Z1 = 200;
  const H = CARRIAGE / 2;           // 3.6 m: the authored half-carriageway
  const rnd = seq(0x5d1d);

  // --- the verge -----------------------------------------------------------
  // Compacted wet soil either side of the carriageway, in one wide apron that
  // runs under the asphalt and out to where the forest floor takes over. This
  // is the surface that carries the eye from tarmac to litter: without it the
  // carriageway is a black strip laid straight onto green.
  const vergeMat = tileAtMetres(materials.groundMud.clone(), tileOf('groundMud'));
  const verge = band(Z0, Z1, 0, 12.0, vergeMat, 0.002, 220, 0, 7);
  verge.name = 'SM_RoadVerge';
  group.add(verge);

  // Compacted soil right against the asphalt, the way the opening-scene blend
  // shoulders its 5.8 m carriageway with brown_mud: the ground that carries the
  // vehicle's weight and the foot traffic is bare and packed, and it is only
  // further out that leaf litter and grass take over.
  const soilMat = tileAtMetres(materials.mud.clone(), tileOf('mud'));
  soilMat.polygonOffset = true;
  soilMat.polygonOffsetFactor = -1;
  soilMat.polygonOffsetUnits = -1;
  for (const side of [-1, 1]) {
    const s = band(Z0, Z1, side * 4.65, 2.1, soilMat, 0.0028, 220, 0, 3);
    s.name = 'SM_RoadShoulder';
    group.add(s);
  }

  // The grass verge outside the compacted soil, butt-joined to it and wobbled
  // so the change of surface is a wandering line rather than a 400 m ruler
  // edge. Beyond this the lit ground is the forest floor itself.
  const grassMat = tileAtMetres(materials.groundGrass.clone(), tileOf('groundGrass'));
  // It overlaps the soil band by half a metre and wins the depth tie on
  // polygon offset: two surfaces half a millimetre apart need more than a
  // lift to settle which is on top.
  grassMat.polygonOffset = true;
  grassMat.polygonOffsetFactor = -1;
  grassMat.polygonOffsetUnits = -1;
  for (const side of [-1, 1]) {
    const g = band(Z0, Z1, side * 7.0, 3.0, grassMat, 0.0025, 220, 0.5, 3);
    g.name = 'SM_RoadGrass';
    group.add(g);
  }

  // --- broken edge ---------------------------------------------------------
  // Where the tar has failed, a band of torn, litter-filled asphalt. It is the
  // same family as the carriageway, so the join is a material change and not a
  // seam between two unrelated surfaces.
  const breakMat = tileAtMetres(materials.asphaltEdge.clone(), tileOf('asphaltEdge'));
  // Butt-joined to the asphalt edge rather than overlapping it: two surfaces
  // 2 mm apart z-fight at distance, and a material change is a legitimate
  // seam where a road has broken away.
  for (const side of [-1, 1]) {
    const b = band(Z0, Z1, side * (H + 0.36), 0.72, breakMat, 0.0045, 220, 0, 2);
    b.name = 'SM_RoadBreak';
    group.add(b);
  }

  // --- carriageway ---------------------------------------------------------
  const asphaltMat = tileAtMetres(materials.asphalt.clone(), tileOf('asphalt'));
  const road = band(Z0, Z1, 0, CARRIAGE, asphaltMat, 0.005, 220, 0, 13);
  road.name = 'SM_Road';
  group.add(road);

  // --- repairs -------------------------------------------------------------
  // Resurfaced rectangles in the other asphalt of the same family. They sit a
  // few millimetres proud like a real patch, and they are laid along the road
  // so nothing here can become an obstacle to a vehicle.
  const patchPieces = [];
  for (let i = 0; i < 26; i++) {   // ~1 per 15 m, the blend's cadence
    const z = Z0 + 12 + rnd() * (Z1 - Z0 - 24);
    const len = 1.2 + rnd() * 1.8;
    patchPieces.push({
      z0: z, z1: z + len,
      offset: (rnd() * 2 - 1) * (H - 1.6),
      width: 0.9 + rnd() * 1.6,
      lift: 0.008,
      // across the crown: a patch spanning the crown with two columns would
      // chord under it and disappear into the middle of the road
      cols: 5,
    });
  }
  const patchMat = tileAtMetres(materials.asphaltPatch.clone(), tileOf('asphaltPatch'));
  patchMat.roughness = 0.88;
  patchMat.polygonOffset = true;
  patchMat.polygonOffsetFactor = -1;
  patchMat.polygonOffsetUnits = -1;
  const patches = mergedBand(patchPieces, patchMat);
  patches.name = 'SM_RoadPatch';
  group.add(patches);

  // --- tar-sealed cracks ---------------------------------------------------
  // Long, thin and dark: a crack in a sealed road, not a chasm.
  const crackMat = tileAtMetres(materials.asphalt.clone(), tileOf('asphalt'));
  crackMat.color.multiplyScalar(0.55);
  crackMat.roughness = 0.95;
  crackMat.polygonOffset = true;
  crackMat.polygonOffsetFactor = -2;
  crackMat.polygonOffsetUnits = -2;
  const crackPieces = [];
  for (let i = 0; i < 14; i++) {   // ~1 per 28 m, the blend's cadence
    const z = Z0 + 16 + rnd() * (Z1 - Z0 - 32);
    const len = 2.3 + rnd() * 2.9;
    crackPieces.push({
      z0: z, z1: z + len,
      offset: (rnd() * 2 - 1) * (H - 0.5),
      width: 0.05 + rnd() * 0.045,
      lift: 0.0075,
    });
  }
  const cracks = mergedBand(crackPieces, crackMat);
  cracks.name = 'SM_RoadCrack';
  group.add(cracks);

  // --- markings ------------------------------------------------------------
  // The opening-scene blend's road at 5.8 m carries a 2.6 m centre dash on a
  // 6.4 m cadence with 0.1 m edge lines inset from the asphalt edge. That
  // cadence is kept exactly; the game's carriageway is 7.2 m, so the edge lines
  // sit at 3.3 m and the extra 0.3 m outside them is unmarked asphalt, which is
  // what a provincial two-lane road actually looks like.
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x9e9980, roughness: 0.9, metalness: 0,
    // Markings, patches and cracks are decals a few millimetres above the
    // carriageway. The depth offset stops them fighting the asphalt at 200 m,
    // where a 3 mm separation is far below depth precision.
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const dashPieces = [];
  for (let z = Z0 + 6; z < Z1 - 6; z += 6.4) {
    dashPieces.push({ z0: z, z1: z + 2.6, offset: 0, width: 0.14, lift: 0.0085 });
  }
  const dashes = mergedBand(dashPieces, lineMat);
  dashes.name = 'SM_RoadDash';
  group.add(dashes);
  for (const side of [-1, 1]) {
    const edgeLine = band(Z0, Z1, side * 3.3, 0.10, lineMat, 0.0085);
    edgeLine.name = 'SM_RoadEdgeLine';
    group.add(edgeLine);
  }

  scene.add(group);
  return group;
}

// Water: one mesh for the pond and one shallow channel. Lambert-free
// MeshStandardMaterial with a low roughness catches the moon without a
// reflector pass, which an integrated GPU cannot afford.
export function buildWater(scene) {
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x101a1b, roughness: 0.12, metalness: 0.25,
    transparent: true, opacity: 0.88,
  });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r * 0.95, 40), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, POND.y, POND.z);
  pond.name = 'SM_PondWater';
  scene.add(pond);

  // the stream is a narrow ribbon following the carved channel
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = -10 + (-26 + 10) * t;
    const z = 58 + (48 - 58) * t;
    pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.10, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 40, 0.7, 4, false);
  const stream = new THREE.Mesh(g, waterMat);
  stream.name = 'SM_Stream';
  stream.scale.y = 0.25;
  scene.add(stream);
  return { pond, stream };
}
