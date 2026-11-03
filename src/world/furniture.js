// FURNITURE — the mansion's real furniture, modelled in Blender.
//
// The assets come from scripts/build_furniture.py, which builds every piece
// with real joinery: bevelled edges, turned legs, raised door panels, rolled
// sofa arms, an inset sink bowl, a moulded cistern. That geometry is the whole
// point: a wardrobe with panelled doors and a plinth reads as a wardrobe from
// across a dark room, and a textured box does not.
//
// This module owns only three things:
//   1. loading the single GLB and splitting it into per-material geometries,
//   2. the material a piece's faces use (mapped to src/world/materials.js),
//   3. footprints and place-helpers, so props.js can validate and collide them.
//
// Draw calls stay low because props.js merges every placement of every piece on
// a floor into one mesh per material — the same strategy the box furniture
// used. A fully dressed floor is still about a dozen draw calls.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { materials } from './materials.js';

const URL = '/assets/models/furniture.glb';
const CC0_ROOT = '/assets/models/cc0/';

const CC0_FURNITURE = {
  sofa: 'painted_wooden_sofa',
  armchair: 'chinese_armchair',
  coffee_table: 'round_wooden_table_01',
  dining_chair: 'dining_chair_02',
  dining_table: 'painted_wooden_table',
  bed: 'GothicBed_01',
  nightstand: 'painted_wooden_nightstand',
  side_table: 'ClassicNightstand_01',
  bookshelf: 'wooden_bookshelf_worn',
};

const CC0_DETAILS = [
  'vintage_electric_kettle', 'vintage_oil_lamp', 'potted_plant_01',
  'antique_ceramic_vase_01', 'alarm_clock_01', 'wall_clock', 'tea_set_01',
];

// Blender UVs are metres. Fabric and leather want a finer weave than that, so
// their UVs are scaled up on load; wood stays at one metre of grain per metre.
const UV_SCALE = {
  velvet: 2.2,
  linen: 1.9,
  leather: 1.5,
  paint: 1.0,
  wood: 1.0,
  woodDark: 1.0,
  woodGrey: 1.0,
  marble: 1.0,
  tile: 1.0,
  porcelain: 1.0,
  ironDark: 1.0,
  brass: 1.0,
  iron: 1.0,
  glass: 1.0,
  rust: 1.0,
};

export const furniture = {
  templates: new Map(),
  errors: [],
  tris: 0,
  count: 0,
  loaded: false,
};

// A piece is placeable against a wall only if its model's front faces +Z, which
// the exporter guarantees (Blender's -Y front becomes +Z). These flags are the
// exceptions to "a floor piece is a collider".
export const MOUNTED = new Set(['counter_top', 'hood', 'wall_cabinet', 'shower']);

function templateTriangles(geo) {
  const index = geo.getIndex();
  return index ? index.count / 3 : geo.attributes.position.count / 3;
}

function cleanRealGeometry(geo) {
  for (const key of Object.keys(geo.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
  }
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(
      new Float32Array(geo.attributes.position.count * 2), 2));
  }
  geo.computeBoundingBox();
  return geo;
}

async function loadCC0Template(loader, name, slug, fitTo = null) {
  const url = `${CC0_ROOT}${slug}/${slug}_1k.gltf`;
  const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  if (!meshes.length) throw new Error(`${slug}: no mesh in glTF`);

  const bounds = new THREE.Box3();
  for (const o of meshes) {
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    geo.computeBoundingBox();
    bounds.union(geo.boundingBox);
  }
  const srcSize = bounds.getSize(new THREE.Vector3());
  const srcCenter = bounds.getCenter(new THREE.Vector3());
  let scale = new THREE.Vector3(1, 1, 1);
  let target = null;
  if (fitTo) {
    target = furniture.templates.get(fitTo)?.box;
    if (target) {
      const wanted = target.getSize(new THREE.Vector3());
      // Keep authored proportions. Fit uniformly within the old footprint,
      // then let the real source bounds drive collisions and inspect targets.
      const fit = Math.min(wanted.x / Math.max(srcSize.x, 1e-5),
        wanted.z / Math.max(srcSize.z, 1e-5));
      scale.setScalar(fit);
    }
  }
  const targetMin = target?.min || new THREE.Vector3(-srcSize.x * 0.5, 0, -srcSize.z * 0.5);
  const targetSize = target?.getSize(new THREE.Vector3()) || srcSize.clone();
  const targetCenter = new THREE.Vector3(
    (targetMin.x + targetMin.x + targetSize.x) * 0.5,
    targetMin.y,
    (targetMin.z + targetMin.z + targetSize.z) * 0.5,
  );
  const geos = [];
  const realBounds = new THREE.Box3();
  for (const o of meshes) {
    const geo = cleanRealGeometry(o.geometry.clone());
    geo.applyMatrix4(o.matrixWorld);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        (pos.getX(i) - srcCenter.x) * scale.x + targetCenter.x,
        (pos.getY(i) - bounds.min.y) * scale.y + targetMin.y,
        (pos.getZ(i) - srcCenter.z) * scale.z + targetCenter.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    realBounds.union(geo.boundingBox.clone());
    const srcMat = Array.isArray(o.material) ? o.material[0] : o.material;
    const mat = srcMat?.clone() || materials.wood.clone();
    mat.name = `PolyHaven CC0 — ${slug} — ${srcMat?.name || 'material'}`;
    geos.push({ mat, geo, tris: templateTriangles(geo) });
  }
  const old = furniture.templates.get(name);
  if (old) for (const g of old.geos) g.geo.dispose();
  furniture.templates.set(name, { name, geos, box: realBounds,
    tris: geos.reduce((n, g) => n + g.tris, 0), source: slug });
  return geos.reduce((n, g) => n + g.tris, 0);
}

export async function loadFurniture(onProgress) {
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.load(URL, resolve, (e) => { if (e.total) onProgress?.(e.loaded / e.total); }, reject);
    });
  } catch (err) {
    // Furniture is not the world: if the asset is missing the estate still
    // loads, and the console says exactly which file failed.
    furniture.errors.push('furniture.glb: ' + (err?.message || err));
    console.warn('[furniture] the models did not load:', err?.message || err);
    return furniture;
  }

  gltf.scene.updateMatrixWorld(true);

  for (const child of [...gltf.scene.children]) {
    const name = child.name;
    if (!name) continue;
    const geos = [];
    child.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      // glTF can carry tangents/colours the game never uses; merging requires
      // every geometry to have the same attribute set.
      for (const key of Object.keys(geo.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
      }
      if (!geo.attributes.uv) {
        const n = geo.attributes.position.count;
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      }
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const matName = src?.name || 'wood';
      const key = materials[matName] ? matName : 'wood';
      const s = UV_SCALE[key] || 1;
      if (s !== 1) {
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
        uv.needsUpdate = true;
      }
      geo.computeBoundingBox();
      geos.push({ mat: key, geo, tris: templateTriangles(geo) });
    });
    if (!geos.length) continue;

    const box = new THREE.Box3();
    for (const g of geos) box.union(g.geo.boundingBox);
    const tris = geos.reduce((n, g) => n + g.tris, 0);
    furniture.templates.set(name, { name, geos, box, tris });
    furniture.tris += tris;
  }

  // Use licensed, textured room assets for the silhouettes that dominate a
  // room. The original registry names, dimensions, placement rules and
  // collision footprints stay the same, so existing room layouts and
  // interactions continue to line up with the replaced art.
  for (const [name, slug] of Object.entries(CC0_FURNITURE)) {
    try { await loadCC0Template(loader, name, slug, name); }
    catch (err) {
      furniture.errors.push(`${slug}: ${err?.message || err}`);
      console.warn(`[furniture] CC0 replacement ${slug} failed:`, err?.message || err);
    }
  }
  // Household details are templates too: the dressing pass can place the
  // actual appliance, plant, clock, and lamp as individually inspectable
  // objects instead of approximating each from cylinders and boxes.
  for (const slug of CC0_DETAILS) {
    try { await loadCC0Template(loader, slug, slug); }
    catch (err) {
      furniture.errors.push(`${slug}: ${err?.message || err}`);
      console.warn(`[furniture] CC0 detail ${slug} failed:`, err?.message || err);
    }
  }
  furniture.loaded = true;
  furniture.count = furniture.templates.size;
  furniture.tris = [...furniture.templates.values()].reduce((sum, t) => sum + t.tris, 0);
  onProgress?.(1);
  return furniture;
}

export function template(name) {
  return furniture.templates.get(name) || null;
}

// The footprint of a piece after it is turned by rotY, in world axes. Furniture
// is validated against the same room/door/overlap rules as everything else, and
// those rules are axis-aligned, so an axis-aligned box is what they need.
export function footprint(name, x, z, rotY = 0) {
  const t = template(name);
  if (!t) return null;
  const { min, max } = t.box;
  const c = Math.cos(rotY), s = Math.sin(rotY);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const px of [min.x, max.x]) {
    for (const pz of [min.z, max.z]) {
      const wx = x + px * c + pz * s;
      const wz = z - px * s + pz * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx);
      z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
    }
  }
  return { x0, x1, z0, z1, height: max.y - min.y, minY: min.y, depth: max.z - min.z, width: max.x - min.x };
}

export function disposeFurniture() {
  const realMaterials = new Set();
  for (const t of furniture.templates.values()) for (const g of t.geos) {
    g.geo.dispose();
    if (typeof g.mat !== 'string') realMaterials.add(g.mat);
  }
  for (const mat of realMaterials) mat.dispose();
  furniture.templates.clear();
  furniture.loaded = false;
}
