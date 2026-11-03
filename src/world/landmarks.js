// LANDMARKS — the estate's authored objects, loaded as real assets.
//
// Everything else in this world is generated from the plan, which is why the
// whole estate boots in seconds. Some things are not worth generating: the old
// draw well beside the ruins is a photographed, hand-modelled object with four
// material sets, packed metalness/roughness and normal detail that no amount of
// cylinders and canvas noise will match. It is loaded here, as its own boot
// stage, and placed on the height field like any other object.
//
// Rules this file keeps:
//   * the asset is not fatal. If the file is missing or fails to parse, the
//     estate still loads; the well is simply absent and the console says why.
//   * it is grounded by measurement, not by a guessed offset: the world-space
//     bounding box is computed after rotation and its lowest point is put on
//     heightAt() at the placement point.
//   * it is solid. A well you can walk through is a hole in the world, so the
//     stone rim gets a ring of colliders at the measured radius.
//   * textures stay inside the project's 1024 px budget, and the file is
//     compressed by scripts/compress_glb_textures.py (11.2 MB -> 5.7 MB).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { heightAt } from './terrain.js';
import { architecture } from './architecture.js';

const URL = '/assets/models/forest_well.glb';

// The ruins clearing is the only flat, tree-free ground off the main approach
// (forest.js rejects trees within 7 m of 10, -19). A draw well is exactly what
// would survive in an abandoned outbuilding's yard, and it gives the clearing a
// reason to be walked into.
export const WELL = { x: 10.6, z: -20.4, yaw: 0.42 };

export const landmarks = { well: null, radius: 0, groundY: 0, errors: [] };

function prepMaterial(mat) {
  const maps = [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap];
  for (const t of maps) {
    if (!t) continue;
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  // the exporter marks these double-sided; a stone drum is closed, and
  // backfaces on a closed object only cost fill rate
  mat.side = THREE.FrontSide;
}

export async function loadLandmarks(scene, onProgress) {
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.load(
        URL,
        resolve,
        (e) => { if (e.total) onProgress?.(e.loaded / e.total); },
        reject,
      );
    });
  } catch (err) {
    // A missing landmark is a missing landmark, not a broken game.
    landmarks.errors.push('well: ' + (err?.message || err));
    console.warn('[landmarks] the old well did not load:', err?.message || err);
    return landmarks;
  }

  const group = new THREE.Group();
  group.name = 'OldForestWell';
  group.add(gltf.scene);
  group.rotation.y = WELL.yaw;
  group.updateWorldMatrix(true, true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) prepMaterial(m);
  });

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const groundY = heightAt(WELL.x, WELL.z);

  // 2 cm of settle: the model's own base is irregular, and a hard-planted rim
  // shows a light-leak line at the contact on a low-poly terrain quad.
  group.position.set(
    WELL.x - centre.x,
    groundY - 0.02 - box.min.y,
    WELL.z - centre.z,
  );
  group.updateWorldMatrix(true, true);
  scene.add(group);

  // The rim is the outer stone drum. 0.06 m inside the measured radius keeps
  // the walker's 0.34 m capsule from clipping the coping stones.
  const radius = Math.max(size.x, size.z) / 2 - 0.06;
  const SEG = 18;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2;
    const a1 = ((i + 1) / SEG) * Math.PI * 2;
    architecture.colliders.push({
      x1: WELL.x + Math.cos(a0) * radius,
      z1: WELL.z + Math.sin(a0) * radius,
      x2: WELL.x + Math.cos(a1) * radius,
      z2: WELL.z + Math.sin(a1) * radius,
      y0: groundY - 0.5,
      y1: groundY + 1.15,
      kind: 'well',
    });
  }

  landmarks.well = group;
  landmarks.radius = radius;
  landmarks.groundY = groundY;
  landmarks.size = size.clone();
  landmarks.meshes = (() => { let n = 0; group.traverse((o) => { if (o.isMesh) n++; }); return n; })();
  scene.userData.landmarks = landmarks;

  onProgress?.(1);
  return landmarks;
}

export function disposeLandmarks() {
  if (!landmarks.well) return;
  landmarks.well.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) m[k]?.dispose();
      m.dispose();
    }
  });
  landmarks.well.parent?.remove(landmarks.well);
  landmarks.well = null;
}
