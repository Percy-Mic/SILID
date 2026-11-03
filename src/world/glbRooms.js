// GLB ROOMS — three imported interiors dropped into the mansion's own plan.
//
// The assets (a basement interrogation cell, a château drawing room, a
// billiards hall) were modelled or captured outside the game. Each one is now
// a room of the mansion: the flat plan in plan.js still owns the walls, doors
// and colliders, and the GLB supplies the interior the player stands in.
//
// Three things had to be settled before a single vertex was placed, and
// scripts/prep_rooms_blender.py is where that work happens:
//
//   * scale. The scans are captured at roughly four times life size. The
//     drawing room's own floor is 8.06 x 11.95 m and the billiards floor is
//     16.0 x 16.6 m with a 14 m ceiling, which no floor of this house has. The
//     draw room is placed at 0.734 (its 11.95 m depth into GF-13's 8.78 m
//     clear depth), the billiards at 0.32 (its 14 m ceiling into the attic's
//     3.6 m, with the wall above the ceiling line cut away and hidden by the
//     slab above it). The cell is already 1:1 and is not scaled at all.
//   * yaw. The scans are rotated 17 and 48 degrees off the world axes.
//   * the doorway. Both scans are one merged shell whose doors are closed
//     leaves painted into the same texture, so there is no object to open. A
//     doorway is cut through the entry wall on the centre line instead, exactly
//     where the mansion's own cased opening meets it, and the reveal the
//     architecture builds around that opening hides the cut edge.
//
// The prepared files share one frame: floor at y = 0, entry wall on z = 0 with
// the interior towards -z, centred on x = 0. That is what `at` below places.
//
// Loading is lazy. The three files are 15-16 MB each and this game targets
// integrated graphics, so a room is fetched the first time the player comes
// within sight of its door, not at boot.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { materials } from './materials.js';

// Rooms the imported interiors replace. props.js skips them so its own
// furniture does not stand inside the imported floor.
export const REPLACED_ROOMS = new Set(['B-05', 'GF-13', 'FF3-04']);

// yaw: 0 keeps the interior towards -z; Math.PI turns it towards +z.
// `z` is the entry plane in world space: the mansion wall's room-side face,
// nudged 30 mm into the room so the two wall surfaces are not coplanar.
export const ROOMS = [
  {
    id: 'interrogation_room',
    room: 'B-05',
    name: 'Interrogation Room',
    level: 'B1',
    url: '/assets/rooms/interrogation_room.glb',
    x: 10.5,
    z: 1.86,
    // 20 mm proud of the basement slab: the imported floor and the mansion's
    // floor are otherwise the same plane, which z-fights, and the imported
    // ceiling lands a hair under the slab above instead of in it.
    y: -3.38,
    yaw: 0,
    halfW: 2.33,
    depth: 5.48,
    door: 1.0,
    light: { y: 2.55, color: 0xbfd0e2, intensity: 2.1, distance: 5.2 },
  },
  {
    id: 'the_great_drawing_room',
    room: 'GF-13',
    name: 'Great Drawing Room',
    level: 'GF',
    url: '/assets/rooms/the_great_drawing_room.glb',
    x: -10,
    z: 2.11,
    y: 0.02,
    yaw: Math.PI,
    halfW: 2.98,
    depth: 8.78,
    door: 1.2,
    light: { y: 3.35, color: 0xffd9ae, intensity: 3.2, distance: 7 },
  },
  {
    id: 'the_billiards_room',
    room: 'FF3-04',
    name: 'Billiards Room',
    level: 'F3',
    url: '/assets/rooms/the_billiards_room.glb',
    x: -10.5,
    z: -2.11,
    y: 8.02,
    yaw: 0,
    halfW: 2.56,
    depth: 7.01,
    door: 1.3,
    light: { y: 2.9, color: 0xffcf9a, intensity: 2.6, distance: 6 },
    // The table, measured off the exported mesh by a downward ray grid rather
    // than guessed: the playing surface spans -0.56..0.64 in x and -5.81..-3.61
    // in z, so the rails put the solid body a hand wider on every side. A
    // player walking through a pool table is the one piece of furniture a
    // scan room can not get away with.
    block: { dx: 0.04, dz: -4.71, hx: 0.74, hz: 1.30, y0: 0, y1: 0.95 },
    // This scan was captured looking up: the exported mesh has walls that stop
    // at the ceiling cut and no ceiling at all (a ray straight up from the
    // middle of the room hits nothing). In the house that left the room open to
    // the roof -- the black band over the door. The lid is the ceiling the
    // capture never had, sized to the shell and dropped far enough to cover the
    // ragged top edge of the scanned walls.
    lid: { h: 3.56, drop: 0.34 },
  },
];

export const rooms = {
  entries: ROOMS,
  loaded: new Map(),   // id -> { group, tris, meshes, materials }
  pending: new Set(),
  errors: [],
  scene: null,
  colliders: null,
  stats: [],
};

const loader = new GLTFLoader();

function addSeg(colliders, x1, z1, x2, z2, y0, y1) {
  colliders.push({ x1, z1, x2, z2, kind: 'wall', y0, y1 });
}

// The scan's shell is narrower than the mansion room it sits in, so its own
// side walls have to stop the player. Without these the player can walk into
// the void between the imported wall and the mansion's plaster and look at the
// unpainted back of the room. Segments sit on the imported wall faces, one per
// side, with the last one behind the room unless the imported depth already
// reaches the mansion's own wall.
function addColliders(colliders, r) {
  const dir = Math.cos(r.yaw) > 0 ? -1 : 1; // -z for yaw 0, +z for yaw PI
  const zEnd = r.z + dir * r.depth;
  const x0 = r.x - r.halfW;
  const x1 = r.x + r.halfW;
  const y0 = r.y - 0.2;
  const y1 = r.y + 3.2;
  addSeg(colliders, x0, r.z, x0, zEnd, y0, y1);
  addSeg(colliders, x1, r.z, x1, zEnd, y0, y1);
  addSeg(colliders, x0, zEnd, x1, zEnd, y0, y1);
  // Furniture the room is built around. The prepared frame has the floor at
  // y = 0, the entry wall at z = 0 and the interior towards -z; a yaw of PI
  // mirrors both x and z about the group's origin.
  if (r.block) {
    const b = r.block;
    const sx = Math.cos(r.yaw) > 0 ? 1 : -1;
    const ax = r.x + sx * (b.dx - b.hx);
    const bx = r.x + sx * (b.dx + b.hx);
    const az = r.z - dir * (b.dz - b.hz);
    const bz = r.z - dir * (b.dz + b.hz);
    colliders.push({
      x1: Math.min(ax, bx), x2: Math.max(ax, bx),
      z1: Math.min(az, bz), z2: Math.max(az, bz),
      kind: 'furniture', y0: r.y + b.y0, y1: r.y + b.y1,
    });
  }
}

export function installRooms(scene, colliders) {
  rooms.scene = scene;
  rooms.colliders = colliders;
  for (const r of ROOMS) addColliders(colliders, r);
  // The imported rooms bring their own practical: a bare fitting hung from the
  // ceiling of the room it lights. One per room, no shadows — three extra point
  // lights in three separate rooms, never all in view at once.
  for (const r of ROOMS) {
    if (r.lid) buildLid(scene, r);
    const g = new THREE.Group();
    g.name = 'roomLight_' + r.id;
    const lamp = new THREE.PointLight(r.light.color, r.light.intensity, r.light.distance, 1.4);
    lamp.position.set(r.x, r.y + r.light.y, r.z + (Math.cos(r.yaw) > 0 ? -r.depth / 2 : r.depth / 2));
    g.add(lamp);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.16, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
    );
    shade.position.copy(lamp.position);
    shade.position.y += 0.1;
    g.add(shade);
    scene.add(g);
    r.lightGroup = g;
  }
  return rooms;
}

// A plaster ceiling and a skirt around it, for a shell that has neither.
function buildLid(scene, r) {
  const dir = Math.cos(r.yaw) > 0 ? -1 : 1;
  const zc = r.z + (dir * r.depth) / 2;
  const mat = materials.wallPlaster.clone();
  mat.name = 'roomLid';
  mat.color.multiplyScalar(0.78);
  mat.roughness = 0.96;
  mat.side = THREE.FrontSide;
  const g = new THREE.Group();
  g.name = 'roomLid_' + r.id;
  const top = new THREE.Mesh(new THREE.BoxGeometry(r.halfW * 2 + 0.16, 0.06, r.depth + 0.16), mat);
  top.position.set(r.x, r.y + r.lid.h, zc);
  g.add(top);
  // four boards hanging from the lid, flush inside the shell so they hide the
  // cut edge instead of standing in front of the wall
  const drop = r.lid.drop;
  const y = r.y + r.lid.h - drop / 2;
  const t = 0.10;
  const skirt = [
    [r.halfW - 0.02, r.z, r.halfW - 0.02, r.z + dir * r.depth],
    [-(r.halfW - 0.02), r.z, -(r.halfW - 0.02), r.z + dir * r.depth],
  ];
  for (const [x0, z0, x1, z1] of skirt) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, drop, r.depth), mat);
    m.position.set(r.x + x0, y, zc);
    g.add(m);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(r.halfW * 2, drop, t), mat);
  back.position.set(r.x, y, r.z + dir * (r.depth - 0.02));
  g.add(back);
  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  scene.add(g);
  r.lidGroup = g;
}

function disposeEntry(entry) {
  entry.group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        m[k]?.dispose?.();
      }
      m.dispose();
    }
  });
  entry.group.removeFromParent();
}

export async function loadRoom(r) {
  if (rooms.loaded.has(r.id) || rooms.pending.has(r.id)) return null;
  rooms.pending.add(r.id);
  try {
    const gltf = await new Promise((resolve, reject) => loader.load(r.url, resolve, undefined, reject));
    const group = gltf.scene;
    group.name = 'room_' + r.id;
    group.position.set(r.x, r.y, r.z);
    group.rotation.y = r.yaw;
    let tris = 0;
    let meshes = 0;
    const seen = new Set();
    group.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = true;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m || seen.has(m.uuid)) continue;
        seen.add(m.uuid);
        // The scans were baked lit; they are lit surfaces now so that the
        // player's torch and the room's own lamp land on them. Albedo is the
        // capture, untouched.
        m.roughness = m.roughness ?? 0.94;
        m.metalness = m.metalness ?? 0.0;
        m.side = THREE.FrontSide;
        if (m.map) {
          m.map.anisotropy = 4;
          m.map.needsUpdate = true;
        }
      }
    });
    group.updateMatrixWorld(true);
    rooms.scene.add(group);
    const entry = { group, tris: Math.round(tris), meshes, materials: seen.size, spec: r };
    rooms.loaded.set(r.id, entry);
    rooms.stats.push({ id: r.id, tris: entry.tris, meshes, materials: entry.materials });
    return entry;
  } catch (e) {
    rooms.errors.push(r.id + ': ' + (e?.message || e));
    console.warn('[rooms] ' + r.id + ' did not load:', e?.message || e);
    return null;
  } finally {
    rooms.pending.delete(r.id);
  }
}

// Called from the frame loop. A room is fetched when the player is on its
// floor and close enough to see its door; once loaded it stays, because
// unloading it one door away would be a visible pop for no gain (the shell is
// one mesh and one or ten materials).
let cooldown = 0;
export function updateRooms(position, dt) {
  rooms.ticks = (rooms.ticks || 0) + 1;
  cooldown -= dt;
  if (cooldown > 0) return;
  cooldown = 0.4;
  rooms.lastCheck = {
    y: +position.y.toFixed(2),
    d: ROOMS.map((r) => +Math.hypot(position.x - r.x, position.z - r.z).toFixed(1)),
  };
  for (const r of ROOMS) {
    if (rooms.loaded.has(r.id) || rooms.pending.has(r.id)) continue;
    if (Math.abs(position.y - r.y) > 3.4) continue;
    const dx = position.x - r.x;
    const dz = position.z - r.z;
    if (dx * dx + dz * dz < 15 * 15) loadRoom(r);
  }
}

export function unloadRooms() {
  for (const [, entry] of rooms.loaded) disposeEntry(entry);
  rooms.loaded.clear();
}

export function roomStats() {
  return {
    ticks: rooms.ticks || 0,
    lastCheck: rooms.lastCheck || null,
    loaded: [...rooms.loaded.keys()],
    pending: [...rooms.pending],
    errors: rooms.errors,
    rooms: rooms.stats,
  };
}
