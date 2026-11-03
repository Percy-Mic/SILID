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
import { materials, tileMaps } from './materials.js';

export const GROUND_RADIUS = 190;
export const ROAD_X = -62;
export const MANSION = { x0: -24, x1: 22, z0: -11, z1: 11, padY: 0 };
export const POND = { x: -30, z: 46, r: 9.5, y: -1.35 };
export const CAR = { x: -56.8, z: 26, rot: Math.PI };

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

function ribbon(z0, z1, width, y, mat, steps = 220) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const z = z0 + (z1 - z0) * (i / steps);
    const cx = roadCenter(z);
    const dz = 0.01;
    const tx = (roadCenter(z + dz) - roadCenter(z - dz)) / (2 * dz);
    const len = Math.hypot(tx, 1);
    const nx = 1 / len, nz = -tx / len;
    const w = width / 2;
    pos.push(cx - nx * w, y, z - nz * w, cx + nx * w, y, z + nz * w);
    uv.push(0, z * 0.1, 1, z * 0.1);
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

export function buildRoad(scene) {
  const group = new THREE.Group();
  group.name = 'Road';

  const shoulderMat = materials.groundForest.clone();
  tileMaps(shoulderMat, 2, 60);
  shoulderMat.color.setHex(0x6a6353);

  const asphalt = materials.asphalt.clone();
  tileMaps(asphalt, 1.6, 40);

  const shoulder = ribbon(-200, 200, 11.5, 0.02, shoulderMat);
  shoulder.name = 'SM_RoadShoulder';
  group.add(shoulder);

  const road = ribbon(-200, 200, 7.2, 0.075, asphalt);
  road.name = 'SM_Road';
  group.add(road);

  // gravel edges: thin strips where the asphalt has broken away
  const edgeMat = materials.groundGrass.clone();
  tileMaps(edgeMat, 1, 50);
  edgeMat.color.setHex(0x736a55);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 400), edgeMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(ROAD_X + side * 3.9, 0.085, 0);
    strip.name = 'SM_RoadEdge';
    group.add(strip);
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
