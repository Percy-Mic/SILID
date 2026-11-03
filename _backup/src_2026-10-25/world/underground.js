// UNDERGROUND — the masonry service tunnel and the cave it opens into.
//
// The tunnel starts at the basement junction's east door (x=16, z=6) and runs
// east to x=33, then the construction changes: the brick lining stops and the
// passage becomes a natural solution cavity in the limestone the estate is
// built on. The floor stays at the basement's level for the first eight metres
// (drainage falls away from the house), then climbs 0.6 m to the cave.
//
// Everything here is solid: floor, two walls, a ceiling with beams. The tunnel
// is 2.8 m wide and 2.4 m high, which is a real service passage, not a crawl.
// The cave is a displaced tube: its interior is the visible surface, so the
// player is genuinely inside rock rather than under a black dome.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materials, tileMaps } from './materials.js';
import { heightAt } from './terrain.js';
import { architecture } from './architecture.js';

function box(w, h, d, scale = 0.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] * scale, uv.getY(k) * dims[f][1] * scale);
    }
  }
  uv.needsUpdate = true;
  g.clearGroups();
  return g;
}

export const underground = { lights: [], exit: { x: 44, z: 6 } };

export function buildUnderground(scene) {
  const y0 = -3.4;
  const tunnel = new THREE.Group();
  tunnel.name = 'ServiceTunnel';

  const brickMat = materials.brick.clone();
  tileMaps(brickMat, 1, 1);
  const concrete = materials.concrete.clone();
  tileMaps(concrete, 1, 1);

  const floorGeo = box(17.2, 0.24, 3.2, 0.6);
  floorGeo.translate(24.6, y0 - 0.12, 6);
  const floor = new THREE.Mesh(floorGeo, concrete);
  floor.receiveShadow = true;
  tunnel.add(floor);

  const wallGeos = [];
  for (const z of [4.4, 7.6]) {
    const g = box(17.2, 2.45, 0.36, 0.7);
    g.translate(24.6, y0 + 1.22, z);
    wallGeos.push(g);
  }
  // lintel and ceiling
  const ceil = box(17.2, 0.26, 3.6, 0.6);
  ceil.translate(24.6, y0 + 2.6, 6);
  wallGeos.push(ceil);
  const walls = new THREE.Mesh(mergeGeometries(wallGeos), brickMat);
  walls.receiveShadow = true;
  tunnel.add(walls);

  // masonry piers every 3 m: visible structure, and they break up the corridor
  const pierGeos = [];
  for (let x = 17.4; x < 33; x += 2.9) {
    for (const z of [4.45, 7.55]) {
      const g = box(0.34, 2.5, 0.5, 0.9);
      g.translate(x, y0 + 1.25, z);
      pierGeos.push(g);
    }
    const beam = box(0.28, 0.26, 3.5, 0.9);
    beam.translate(x, y0 + 2.48, 6);
    pierGeos.push(beam);
  }
  const piers = new THREE.Mesh(mergeGeometries(pierGeos), materials.stoneDark);
  tunnel.add(piers);

  // floor drain channel down the centre, and a sump at the low end
  const grate = new THREE.Mesh(new THREE.BoxGeometry(16, 0.03, 0.22), materials.iron);
  grate.position.set(24.6, y0 + 0.015, 6);
  tunnel.add(grate);
  const sump = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), materials.iron);
  sump.position.set(24, y0 + 0.02, 6);
  tunnel.add(sump);

  // conduit and a single maintenance lamp: the light has a real fixture
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 16.4, 6), materials.rust);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(24.6, y0 + 2.25, 4.68);
  tunnel.add(pipe);

  for (const x of [20.5, 28.5]) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.12), materials.iron);
    fixture.position.set(x, y0 + 2.42, 6);
    tunnel.add(fixture);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6b6a5a, emissive: 0xd8c08a, emissiveIntensity: 1.2 }));
    bulb.position.set(x, y0 + 2.37, 6);
    tunnel.add(bulb);
    const light = new THREE.PointLight(0xd8bd8a, 7, 9, 2);
    light.position.set(x, y0 + 2.3, 6);
    tunnel.add(light);
    underground.lights.push(light);
  }
  scene.add(tunnel);

  // --- the cave ---------------------------------------------------------
  // A displaced tube along x, opening from the tunnel mouth and widening into
  // a chamber. TubeGeometry's normals point outward, so the mesh is BackSide:
  // you see the inside of the rock. The displacement makes the section
  // irregular instead of a pipe.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(32.5, -1.25, 6),
    new THREE.Vector3(36, -1.0, 6.2),
    new THREE.Vector3(39, -0.9, 5.6),
    new THREE.Vector3(43, -1.1, 6.1),
    new THREE.Vector3(47, -1.4, 5.8),
  ]);
  const tube = new THREE.TubeGeometry(curve, 48, 4.1, 12, false);
  const pos = tube.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = Math.sin(v.x * 1.7 + v.y * 2.1) * Math.cos(v.z * 1.9) * 0.55
            + Math.sin(v.x * 0.6) * 0.35;
    v.x += n * 0.25;
    v.y += n * 0.5;
    v.z += n * 0.4;
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
  scene.add(cave);

  // cave floor: a plane wide enough to close the tube bottom, at y=-3.35
  const caveFloorMat = materials.mud.clone();
  tileMaps(caveFloorMat, 2, 4);
  caveFloorMat.color.setHex(0x3b362b);
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 8.5), caveFloorMat);
  cf.rotation.x = -Math.PI / 2;
  cf.position.set(40, -3.32, 6);
  cf.name = 'CaveFloor';
  scene.add(cf);

  // a black water pool at the low end; not a solid, just water
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshStandardMaterial({
    color: 0x070d0e, roughness: 0.04, metalness: 0.3,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(44.2, -3.28, 5.9);
  scene.add(pool);

  // one cold pool of light where the tunnel meets the cave: the maintenance
  // lamp above is the only powered fixture down here
  const caveLight = new THREE.PointLight(0x8fa4c0, 3.5, 14, 2);
  caveLight.position.set(38, -1.2, 6);
  scene.add(caveLight);

  // the tunnel ceiling end at x=33 is open into the cave; a masonry arch frames
  // the transition so it reads as built, then natural
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.28, 6, 12, Math.PI), materials.stoneDark);
  arch.position.set(33.1, y0 + 0.4, 6);
  arch.rotation.y = Math.PI / 2;
  arch.rotation.z = 0;
  scene.add(arch);

  // walking surfaces beyond the basement footprint. floorHeightAt consults
  // these rects, so the tunnel and cave are solid ground and not a hole in the
  // height field through which the player would climb back to the forest.
  architecture.extraFloors.push(
    { x0: 16, x1: 33.3, z0: 4.45, z1: 7.55, y: -3.4 },
    { x0: 32.5, x1: 48.4, z0: 1.9, z1: 10.2, y: -3.42 },
  );
  // tunnel walls: only exist between the tunnel's floor and its ceiling
  for (const z of [4.45, 7.55]) {
    architecture.colliders.push({ x1: 16, z1: z, x2: 33.2, z2: z, kind: 'tunnel', y0: -3.4, y1: -0.85 });
  }
  // cave boundary: uneven sides, kept simple and enclosing
  const cavePts = [[33, 2.2], [36, 2.0], [38.5, 1.8], [41, 1.9], [43.5, 2.4], [46, 2.6], [48, 3.1],
                   [48, 8.9], [46, 9.4], [43.5, 9.7], [41, 9.9], [38.5, 10.1], [36, 10.0], [33, 9.8]];
  // The polygon is deliberately NOT closed: the missing last edge is the
  // tunnel mouth. Closing it put a rock wall across the one way in.
  for (let i = 0; i < cavePts.length - 1; i++) {
    const a = cavePts[i], b = cavePts[i + 1];
    architecture.colliders.push({ x1: a[0], z1: a[1], x2: b[0], z2: b[1], kind: 'cave', y0: -3.42, y1: 0.5 });
  }

  underground.cave = cave;
  underground.tunnel = tunnel;
  return underground;
}

// The cave mouth sits under the forest floor; this makes sure the terrain above
// it is high enough that the cave is genuinely underground and not daylight.
export function caveCover() {
  return heightAt(40, 6);
}
