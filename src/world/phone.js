// PHONE — the player's own phone, modelled in Blender.
//
// The asset is the supplied file, served from /assets/models/smart_phone.glb
// (copied from Blender/AssetLibrary/smart_phone.glb). It is a valid binary glTF
// 2.0 file, 360 KB, with one embedded buffer and two embedded JPEGs — the screen
// image, which its material also uses as the emissive map, and the back-camera
// texture. It carries three meshes under the materials MetalRim, PhoneGlass and
// backcam, and no external references at all.
//
// Its own frame, read out of the accessors rather than guessed at:
//   x  -0.51 .. 0.51   width       (1.02)  screen facing +Y
//   y  -0.06 .. 0.06   thickness   (0.11)
//   z  -1.00 .. 1.00   length      (2.00)  camera island at the -Z end
// which is the phone at 10x: 1.02 / 0.11 / 2.00 is 75 / 8 / 147 mm. Only one
// number needs to be right, so PHONE_HEIGHT is the phone's real 14.7 cm and
// everything is scaled from it.
//
// On load the parts are stood upright (screen to +Z, camera end up) and their
// pivot is moved to the middle of the body, so a pose is one position and one
// rotation and nothing about the asset has to be remembered by the caller.
//
// Both the phone lying on the console and the phone in the player's hand are
// this asset — there is no box model and no HTML card behind it. The display
// is the asset's own PhoneGlass, re-textured with a canvas the UI draws into
// (src/ui/PhoneUI.js), so the lock screen and every app are on the model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const modelUrl = '/assets/models/smart_phone.glb';

// 146.6 mm, the real thing.
export const PHONE_HEIGHT = 0.147;

// How the dark house treats a phone: the metal stops being a mirror and the
// screen keeps its own image but glows less than the asset's own 0.5 emissive.
const TUNE = {
  MetalRim: { color: 0x9a9995, roughness: 0.46, metalness: 0.78 },
  PhoneGlass: { emissiveIntensity: 0.62, roughness: 0.12, metalness: 0.2 },
  backcam: { roughness: 0.3, metalness: 0.5 },
};

function loadGlb(url) {
  return new GLTFLoader().loadAsync(url);
}

function tuneMaterial(src, name, { viewmodel = false, held = false } = {}) {
  const m = src
    ? src.clone()
    : new THREE.MeshStandardMaterial({ color: 0x8b8a88, roughness: 0.5, metalness: 0.7 });
  m.name = (held ? 'held_' : 'world_') + (name || 'phone');
  const t = TUNE[name];
  if (t) {
    if (t.color != null) m.color.setHex(t.color);
    if (t.roughness != null) m.roughness = t.roughness;
    if (t.metalness != null) m.metalness = t.metalness;
    if (t.emissiveIntensity != null) m.emissiveIntensity = t.emissiveIntensity;
  }
  if (viewmodel) {
    // A held object parented to the camera cuts into a wall the moment the
    // player stands close to one. It is drawn last with the depth test off, so
    // it reads as a viewmodel instead of stabbing through the plaster — the
    // usual hand-item layer, without a second render pass.
    m.depthTest = false;
    m.depthWrite = false;
    m.side = THREE.FrontSide;
  }
  return m;
}

// Load, orient, centre and scale the asset once. Returns null (with a console
// line naming the file) if it cannot be fetched, so the estate still loads.
export async function loadPhone(onProgress = () => {}) {
  let gltf;
  try {
    gltf = await loadGlb(modelUrl);
  } catch (err) {
    console.warn('[phone] ' + modelUrl + ' did not load:', err?.message || err);
    return null;
  }

  gltf.scene.updateMatrixWorld(true);

  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry.clone();
    // The export nests the phone under two Sketchfab rotations that cancel, so
    // baking world matrices is what puts the parts in the frame measured above.
    geo.applyMatrix4(o.matrixWorld);
    // Then stand it up: screen to +Z, camera end to +Y.
    geo.rotateX(Math.PI / 2);
    for (const key of Object.keys(geo.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
    }
    if (!geo.attributes.uv) {
      const n = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.push({
      name: o.name || 'phone_part',
      matName: src?.name || 'MetalRim',
      src: src || null,
      geo,
    });
  });

  if (!parts.length) {
    console.warn('[phone] ' + modelUrl + ' has no meshes');
    return null;
  }

  // Measure, then own the pivot: centre the body on the origin and set its
  // length to PHONE_HEIGHT. Nothing downstream has to know the asset's units.
  const box = new THREE.Box3();
  for (const p of parts) {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3());
  const scale = PHONE_HEIGHT / size.y;
  const centre = box.getCenter(new THREE.Vector3());
  for (const p of parts) {
    p.geo.translate(-centre.x, -centre.y, -centre.z);
    p.geo.scale(scale, scale, scale);
    p.geo.computeBoundingBox();
  }
  // The box the callers care about is the fitted one: centred, and 14.7 cm long.
  const fitted = new THREE.Box3();
  for (const p of parts) fitted.union(p.geo.boundingBox);

  const info = {
    gltf,
    parts,
    scale,
    sourceSize: size.clone(),
    box: fitted,
    size: fitted.getSize(new THREE.Vector3()),
  };
  onProgress(1);
  return info;
}

// A Box3 around the fitted phone (its own local frame).
export function phoneBox(info) {
  if (!info) return null;
  return info.box.clone();
}

export function phoneMeshes(info) {
  return info ? info.parts.map((p) => p.geo) : [];
}

// A phone that is being pocketed or removed from a pocket keeps a tiny bit of
// lift so it does not clip straight into the hip or the console. The caller
// should fade this back to zero when the move is finished.
export const POCKET_LIFT = 0.018;

// Build the phone as a Group. `viewmodel: true` is the in-hand copy: it gets
// its own material instances so the depth-test-off trick never leaks onto the
// phone lying in the world.
export function buildPhone(info, { viewmodel = false, held = false } = {}) {
  if (!info) return null;
  const group = new THREE.Group();
  group.name = held ? 'phone_held' : 'phone_world';
  const materials = [];
  for (const part of info.parts) {
    const mat = tuneMaterial(part.src, part.matName, { viewmodel, held });
    const mesh = new THREE.Mesh(part.geo, mat);
    mesh.name = (held ? 'held_' : 'world_') + part.name;
    mesh.castShadow = !viewmodel;
    mesh.receiveShadow = !viewmodel;
    if (viewmodel) mesh.renderOrder = 999;
    group.add(mesh);
    materials.push(mat);
  }
  group.userData.isPhone = true;
  group.userData.materials = materials;
  return group;
}

// The phone in the player's hand, with the small dark marker under it that the
// prompt hangs off. The caller parents the group to the camera.
export function holdPhone(info, { markerY = -0.085, viewmodel = true } = {}) {
  const phone = buildPhone(info, { viewmodel, held: true });
  if (!phone) return null;
  const mark = phonePickupMark();
  mark.position.y = markerY;
  mark.visible = false;             // in hand, the prompt is not needed
  mark.userData.isPhoneMarker = true;
  phone.add(mark);
  return { phone, mark };
}

// A small marker for the pickup prompt / inventory hint. It sits a little below
// the phone so the prompt reads as hovering just under it, not floating above.
export function phonePickupMark() {
  const g = new THREE.SphereGeometry(0.05, 12, 8);
  const m = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    emissive: 0x102028,
    emissiveIntensity: 0.6,
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
  const mark = new THREE.Mesh(g, m);
  mark.name = 'phone_pickup_mark';
  mark.scale.set(1.4, 0.4, 1.4);
  return mark;
}

// Where the phone is and how it is turned when it is lying on a surface. The
// fitted frame stands the phone up; lying it on its back is a quarter turn
// about X, which puts the screen to +Y and the camera island toward -Z.
export const LYING_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };

// A tiny anchor drawn at the player's hip when the phone is tucked away.
// It is the only visual sign the phone is in a pocket; the rest of the time
// the phone is either on the console or held in front of the camera.
export function pocketAnchor() {
  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.042, 10),
    new THREE.MeshStandardMaterial({
      color: 0x20242b,
      emissive: 0x0a0f14,
      emissiveIntensity: 0.5,
      roughness: 0.6,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
    }),
  );
  pin.rotation.x = Math.PI / 2;
  pin.position.y = 0;
  const g = new THREE.Group();
  g.name = 'phone_pocket_anchor';
  g.add(pin);
  // a faint ring so the anchor reads as a loop rather than a pin
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.032, 0.004, 6, 14),
    pin.material,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.012;
  g.add(ring);
  return g;
}

