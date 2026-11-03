// APPARATUS — the electrical panel in the generator room.
//
// The generator is useless without a circuit, and the circuit is useless
// without a fuse carrier. The panel is built here rather than merged into the
// generator because its cover has to MOVE: it is a hinged door with a handle,
// a lock catch, a DIN rail of breakers and a porcelain carrier inside.
//
// State lives on the returned object and is read by the game:
//   open          the cover is swung out
//   fuseInstalled the ceramic fuse from the workshop bench has been seated
// The cover is animated, the interior is modelled (not painted on), and the
// interaction target sits in front of the open face, not inside the box.

import * as THREE from 'three';
import { materials, tileMaps } from './materials.js';
import { box } from './primitives.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { props } from './props.js';
import { wallFace } from './architecture.js';

export const apparatus = { fuseBox: null, errors: [] };

function steel(key, name) {
  const m = materials[key].clone();
  m.name = name;
  tileMaps(m, 1, 1);
  return m;
}

export function buildApparatus(scene, levels) {
  apparatus.fuseBox = null;
  apparatus.errors.length = 0;

  const level = levels.find((l) => l.id === 'B1');
  const room = level?.rooms.find((r) => r.id === 'B-04');
  if (!level || !room) { apparatus.errors.push('no generator room'); return apparatus; }

  const wallX = room.x1 - wallFace(level, 'z', room.x1).half;
  const z = room.z0 + 2.1;          // clear of the generator pad and the fuel drum
  const y = level.y + 1.35;         // a panel at working height
  const W = 0.56, H = 0.64, D = 0.13;

  const root = new THREE.Group();
  root.name = 'FusePanel';
  root.position.set(wallX - 0.055, y, z);
  root.rotation.y = -Math.PI / 2;   // local +z faces into the room (-x)

  // back box: a real enclosure with a lip, not a plaque on the wall
  const body = [];
  body.push(box(W, H, 0.035, 1).translate(0, 0, -D / 2 + 0.017));
  for (const sx of [-1, 1]) body.push(box(0.035, H, D, 1).translate(sx * (W / 2 - 0.017), 0, 0));
  for (const sy of [-1, 1]) body.push(box(W, 0.035, D, 1).translate(0, sy * (H / 2 - 0.017), 0));
  body.push(box(W, H, 0.022, 1).translate(0, 0, -0.008)); // dark interior back
  const bodyMesh = new THREE.Mesh(mergeGeometries(body), steel('iron', 'fusebox_body'));
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // interior: a DIN rail, six breakers, a busbar, a carrier slot and wiring
  const inner = [];
  const rail = box(W - 0.08, 0.035, 0.035, 1);
  rail.translate(0, 0.10, 0.005);
  inner.push(rail);
  for (let i = 0; i < 6; i++) {
    const b = box(0.055, 0.13, 0.06, 1);
    b.translate(-0.20 + i * 0.08, 0.10, 0.028);
    inner.push(b);
  }
  const bus = box(W - 0.12, 0.018, 0.015, 1);
  bus.translate(0, -0.01, 0.005);
  inner.push(bus);
  // the empty carrier: a porcelain cradle with two brass clips
  inner.push(box(0.13, 0.09, 0.05, 1).translate(0.13, -0.15, 0.02));
  inner.push(box(0.10, 0.03, 0.02, 1).translate(0.13, -0.10, 0.05));
  // cable glands along the bottom
  for (let i = 0; i < 3; i++) {
    const g = new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8);
    g.rotateX(Math.PI / 2);
    g.translate(-0.16 + i * 0.16, -H / 2 + 0.09, 0.03);
    inner.push(g);
  }
  const innerMesh = new THREE.Mesh(mergeGeometries(inner), steel('stoneDark', 'fusebox_internals'));
  root.add(innerMesh);

  // a single ceramic cartridge, visible only once it has been fitted
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.021, 0.075, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.55 }),
  );
  fuse.rotation.z = Math.PI / 2;
  fuse.position.set(0.13, -0.15, 0.055);
  fuse.visible = false;
  root.add(fuse);

  // the cover, hinged along its left edge
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, D / 2 - 0.01);
  root.add(hinge);
  const coverParts = [];
  const cw = W - 0.006, ch = H - 0.006;
  coverParts.push(box(cw, ch, 0.022, 1).translate(cw / 2, 0, 0));
  coverParts.push(box(cw - 0.10, ch - 0.10, 0.012, 1).translate(cw / 2, 0, 0.014));
  // handle and catch
  coverParts.push(box(0.035, 0.10, 0.025, 1).translate(cw - 0.045, -0.02, 0.026));
  coverParts.push(box(0.05, 0.03, 0.02, 1).translate(cw - 0.07, -0.20, 0.024));
  const cover = new THREE.Mesh(mergeGeometries(coverParts), steel('woodGrey', 'fusebox_cover'));
  cover.castShadow = true;
  hinge.add(cover);

  // a small warning label above the panel: paper, not paint
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xc9bd9c, roughness: 0.9, side: THREE.DoubleSide }),
  );
  label.position.set(0, H / 2 + 0.10, 0.02);
  root.add(label);

  scene.add(root);

  // a wall panel need not stop the body, but it must not be walked through
  props.colliders.push({
    x1: wallX - 0.14, x2: wallX + 0.02, z1: z - W / 2 - 0.02, z2: z + W / 2 + 0.02,
    kind: 'apparatus', y0: y - H / 2, y1: y + H / 2,
  });

  const target = {
    id: 'fusebox', name: 'the fuse panel', kind: 'fusebox',
    x: wallX - 0.55, y, z, room: room.name,
    panel: null,
  };
  props.interactables.push(target);

  const state = {
    root, hinge, fuse, target,
    open: false, coverTarget: 0, coverAngle: 0,
    fuseInstalled: false,
    setFuse(v) { fuse.visible = v; this.fuseInstalled = v; },
    update(dt) {
      this.hinge.rotation.y += (this.coverTarget - this.hinge.rotation.y) * Math.min(1, dt * 7);
    },
  };
  target.panel = state;
  apparatus.fuseBox = state;
  return apparatus;
}

export function updateApparatus(dt) {
  if (apparatus.fuseBox) apparatus.fuseBox.update(dt);
}
