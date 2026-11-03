// MATERIALS — one loader, one budget, one place where GPU memory is decided.
//
// The project this rebuild replaces died of texture memory: the house set was
// twelve 1k texture triplets per material, decoded at full size, and the
// integrated GPU lost the WebGL context after a few minutes of play. Every
// texture that reaches the renderer now goes through here, is capped at 512 px
// and is uploaded with 4x anisotropy. The 2k asphalt is capped too; asphalt is
// seen at night from a standing body, never at texel level.
//
// The texture sources are Poly Haven CC0 1k JPGs already in public/assets
// (recorded in ASSET_LICENSES.md). Leaf and fern alpha maps are drawn at
// runtime: there is no leaf atlas in the project and a canvas card at 128 px
// costs nothing on the GPU while giving the forest an actual leafy silhouette.

import * as THREE from 'three';

const TEX = '/assets/textures/';
const CAP = 512;

const cache = new Map();
let anisotropy = 4;

export function setAnisotropy(n) { anisotropy = Math.max(1, Math.min(8, n | 0)); }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('texture missing: ' + url));
    img.src = url;
  });
}

// Draw to a canvas at CAP and hand Three that. Downscaling JPEGs on the CPU
// costs a few ms per image during loading; it saves more GPU memory than any
// other decision in this file.
function capped(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const s = Math.min(1, CAP / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function textureFromCanvas(canvas, { srgb = false, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

async function loadSet(slug, names) {
  const out = {};
  for (const [kind, file] of Object.entries(names)) {
    const img = await loadImage(TEX + slug + '/' + file);
    out[kind] = textureFromCanvas(capped(img), { srgb: kind === 'map' });
  }
  return out;
}

// slug -> file names. Only the maps each material actually uses are loaded;
// normal maps on flat ceiling slabs buy nothing.
const SETS = {
  wallPlaster: ['damaged_plaster', { map: 'damaged_plaster_diff_1k.jpg', normalMap: 'damaged_plaster_nor_gl_1k.jpg', roughnessMap: 'damaged_plaster_rough_1k.jpg' }],
  wallBlue: ['blue_plaster_weathered', { map: 'blue_plaster_weathered_diff_1k.jpg', normalMap: 'blue_plaster_weathered_nor_gl_1k.jpg', roughnessMap: 'blue_plaster_weathered_rough_1k.jpg' }],
  wallpaper: ['decrepit_wallpaper', { map: 'decrepit_wallpaper_diff_1k.jpg', normalMap: 'decrepit_wallpaper_nor_gl_1k.jpg', roughnessMap: 'decrepit_wallpaper_rough_1k.jpg' }],
  concrete: ['concrete_wall_003', { map: 'concrete_wall_003_diff_1k.jpg', normalMap: 'concrete_wall_003_nor_gl_1k.jpg', roughnessMap: 'concrete_wall_003_rough_1k.jpg' }],
  brick: ['brick_wall_006', { map: 'brick_wall_006_diff_1k.jpg', normalMap: 'brick_wall_006_nor_gl_1k.jpg', roughnessMap: 'brick_wall_006_rough_1k.jpg' }],
  stone: ['estate', { map: 'plaster_stone_wall_02_diff_1k.jpg', normalMap: 'plaster_stone_wall_02_nor_gl_1k.jpg', roughnessMap: 'plaster_stone_wall_02_rough_1k.jpg' }],
  woodFloor: ['wood_floor_worn', { map: 'wood_floor_worn_diff_1k.jpg', normalMap: 'wood_floor_worn_nor_gl_1k.jpg', roughnessMap: 'wood_floor_worn_rough_1k.jpg' }],
  woodFloorOld: ['old_wooden_floor_01', { map: 'old_wooden_floor_01_diff_1k.jpg', normalMap: 'old_wooden_floor_01_nor_gl_1k.jpg', roughnessMap: 'old_wooden_floor_01_rough_1k.jpg' }],
  wood: ['estate', { map: 'planks_brown_10_diff_1k.jpg', normalMap: 'planks_brown_10_nor_gl_1k.jpg', roughnessMap: 'planks_brown_10_rough_1k.jpg' }],
  woodGrey: ['wood_planks_grey', { map: 'wood_planks_grey_diff_1k.jpg', normalMap: 'wood_planks_grey_nor_gl_1k.jpg', roughnessMap: 'wood_planks_grey_rough_1k.jpg' }],
  woodDirt: ['wood_planks_dirt', { map: 'wood_planks_dirt_diff_1k.jpg', normalMap: 'wood_planks_dirt_nor_gl_1k.jpg', roughnessMap: 'wood_planks_dirt_rough_1k.jpg' }],
  marble: ['marble_tiles', { map: 'marble_tiles_diff_1k.jpg', normalMap: 'marble_tiles_nor_gl_1k.jpg', roughnessMap: 'marble_tiles_rough_1k.jpg' }],
  tile: ['interior_tiles', { map: 'interior_tiles_diff_1k.jpg', normalMap: 'interior_tiles_nor_gl_1k.jpg', roughnessMap: 'interior_tiles_rough_1k.jpg' }],
  tileDirty: ['dirty_tiles', { map: 'dirty_tiles_diff_1k.jpg', normalMap: 'dirty_tiles_nor_gl_1k.jpg', roughnessMap: 'dirty_tiles_rough_1k.jpg' }],
  concreteFloor: ['concrete_floor_worn_001', { map: 'concrete_floor_worn_001_diff_1k.jpg', normalMap: 'concrete_floor_worn_001_nor_gl_1k.jpg', roughnessMap: 'concrete_floor_worn_001_rough_1k.jpg' }],
  iron: ['corrugated_iron_02', { map: 'corrugated_iron_02_diff_1k.jpg', normalMap: 'corrugated_iron_02_nor_gl_1k.jpg', roughnessMap: 'corrugated_iron_02_rough_1k.jpg' }],
  rust: ['rusty_metal_sheet', { map: 'rusty_metal_sheet_diff_1k.jpg', normalMap: 'rusty_metal_sheet_nor_gl_1k.jpg', roughnessMap: 'rusty_metal_sheet_rough_1k.jpg' }],
  linen: ['rough_linen', { map: 'rough_linen_diff_1k.jpg', normalMap: 'rough_linen_nor_gl_1k.jpg', roughnessMap: 'rough_linen_rough_1k.jpg' }],
  velvet: ['velour_velvet', { map: 'velour_velvet_diff_1k.jpg', normalMap: 'velour_velvet_nor_gl_1k.jpg', roughnessMap: 'velour_velvet_rough_1k.jpg' }],
  leather: ['brown_leather', { map: 'brown_leather_diff_1k.jpg', normalMap: 'brown_leather_nor_gl_1k.jpg', roughnessMap: 'brown_leather_rough_1k.jpg' }],
  groundForest: ['forrest_ground_01', { map: 'forrest_ground_01_diff_1k.jpg', normalMap: 'forrest_ground_01_nor_gl_1k.jpg', roughnessMap: 'forrest_ground_01_rough_1k.jpg' }],
  groundGrass: ['grass_ground', { map: 'grass_ground_diff_1k.jpg', normalMap: 'grass_ground_nor_gl_1k.jpg', roughnessMap: 'grass_ground_rough_1k.jpg' }],
  mud: ['brown_mud', { map: 'brown_mud_diff_1k.jpg', normalMap: 'brown_mud_nor_gl_1k.jpg', roughnessMap: 'brown_mud_rough_1k.jpg' }],
  bark: ['bark_brown_02', { map: 'bark_brown_02_Diffuse_2k.jpg', normalMap: 'bark_brown_02_nor_gl_2k.jpg' }],
  asphalt: ['asphalt_02', { map: 'asphalt_02_diff_2k.jpg', normalMap: 'asphalt_02_nor_gl_2k.jpg', roughnessMap: 'asphalt_02_rough_2k.jpg' }],
  boulder: ['boulder_01', { map: 'boulder_01_diff_1k.jpg' }],
};

const defs = {
  // plaster / masonry
  wallPlaster: { set: 'wallPlaster', color: 0xb7b0a0, rough: 0.94, metal: 0 },
  wallBlue: { set: 'wallBlue', color: 0x93a19a, rough: 0.9, metal: 0 },
  wallpaper: { set: 'wallpaper', color: 0x9d9280, rough: 0.95, metal: 0 },
  concrete: { set: 'concrete', color: 0x9a998f, rough: 0.96, metal: 0 },
  brick: { set: 'brick', color: 0x8a7261, rough: 0.95, metal: 0 },
  stone: { set: 'stone', color: 0xa29a86, rough: 0.97, metal: 0 },
  stoneDark: { set: 'stone', color: 0x6d675c, rough: 0.98, metal: 0 },
  // floors
  woodFloor: { set: 'woodFloor', color: 0x8b6f52, rough: 0.78, metal: 0 },
  woodFloorOld: { set: 'woodFloorOld', color: 0x7c644c, rough: 0.82, metal: 0 },
  marble: { set: 'marble', color: 0xb5b0a4, rough: 0.35, metal: 0 },
  tile: { set: 'tile', color: 0xa29b8d, rough: 0.55, metal: 0 },
  tileDirty: { set: 'tileDirty', color: 0x8b867a, rough: 0.7, metal: 0 },
  concreteFloor: { set: 'concreteFloor', color: 0x8d8a80, rough: 0.92, metal: 0 },
  // furniture
  wood: { set: 'wood', color: 0x84603f, rough: 0.66, metal: 0 },
  woodDark: { set: 'wood', color: 0x4c3828, rough: 0.6, metal: 0 },
  woodGrey: { set: 'woodGrey', color: 0x8a8274, rough: 0.8, metal: 0 },
  woodDirt: { set: 'woodDirt', color: 0x6d5a44, rough: 0.88, metal: 0 },
  iron: { set: 'iron', color: 0x6f6d68, rough: 0.55, metal: 0.55 },
  rust: { set: 'rust', color: 0x7a5a41, rough: 0.82, metal: 0.35 },
  linen: { set: 'linen', color: 0xbdb5a2, rough: 0.95, metal: 0 },
  velvet: { set: 'velvet', color: 0x5a2f2c, rough: 0.9, metal: 0 },
  rug: { set: 'linen', color: 0x4a352d, rough: 1, metal: 0 },
  leather: { set: 'leather', color: 0x5b4030, rough: 0.7, metal: 0 },
  // nature
  groundForest: { set: 'groundForest', color: 0x4b4a35, rough: 1, metal: 0 },
  groundGrass: { set: 'groundGrass', color: 0x50593c, rough: 1, metal: 0 },
  mud: { set: 'mud', color: 0x4a4030, rough: 1, metal: 0 },
  bark: { set: 'bark', color: 0x7a6650, rough: 0.95, metal: 0 },
  asphalt: { set: 'asphalt', color: 0x6c6d6b, rough: 0.92, metal: 0 },
  boulder: { set: 'boulder', color: 0x6a675f, rough: 0.95, metal: 0 },
};

export const materials = {};
const loadedSets = new Map();

function makeMaterial(def, maps) {
  const m = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.rough,
    metalness: def.metal,
  });
  if (maps.map) m.map = maps.map;
  if (maps.normalMap) m.normalMap = maps.normalMap;
  if (maps.roughnessMap) m.roughnessMap = maps.roughnessMap;
  return m;
}

// Load every material the world needs, reporting real progress per image.
// Sets load IN PARALLEL: sequential image decodes made the boot bar crawl for
// half a minute, which is itself a loading failure the player sees.
export async function loadMaterials(onProgress) {
  const total = Object.keys(defs).length;
  let done = 0;
  const unique = new Set(Object.values(defs).map((d) => d.set));
  let setsDone = 0;
  await Promise.all([...unique].map(async (name) => {
    const [slug, files] = SETS[name];
    const maps = await loadSet(slug, files);
    loadedSets.set(slug, maps);
    setsDone++;
    onProgress?.(0.9 * (setsDone / unique.size), 'mixing ' + slug.replace(/_/g, ' ') + '…');
  }));
  for (const [key, def] of Object.entries(defs)) {
    const [slug] = SETS[def.set];
    const maps = loadedSets.get(slug);
    // clone the maps per material so tiling and offset can differ
    const own = {};
    for (const [k, t] of Object.entries(maps)) {
      const c = t.clone();
      c.needsUpdate = true;
      own[k] = c;
    }
    materials[key] = makeMaterial(def, own);
    done++;
    onProgress?.(0.9 + 0.1 * (done / total), 'mixing the ' + key);
  }
  return materials;
}

// A material's world-space tiling. Walls use one texture repeat per 2.4 m,
// floors one per 3 m; the caller sets repeat per mesh instead of sharing one
// giant UV, so a 40 m wall does not smear into a single plank.
export function tileMaps(mat, sx, sy) {
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    if (mat[k]) {
      mat[k].repeat.set(sx, sy);
      mat[k].needsUpdate = true;
    }
  }
}

// --- procedural leaf cards -------------------------------------------------
// A cluster of 11-17 leaves drawn into RGBA. Cards crossed in three planes make
// a shrub; the same card on branches makes a crown. Alpha is tested, not
// blended, so foliage is depth-sorted by the depth buffer instead of sorting
// artefacts.
const leafCache = new Map();

export function leafTexture(variant = 0) {
  if (leafCache.has(variant)) return leafCache.get(variant);
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  let seed = 1337 + variant * 977;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const greens = variant === 2
    ? ['#3d4a2a', '#4b5a33', '#5d6a3e', '#71804a']
    : ['#2c3a24', '#38482b', '#455733', '#54663c'];
  for (let i = 0; i < 15; i++) {
    const cx = 16 + rnd() * 96;
    const cy = 16 + rnd() * 96;
    const len = 12 + rnd() * 16;
    const wid = len * (0.32 + rnd() * 0.16);
    const a = rnd() * Math.PI * 2;
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    const grad = g.createLinearGradient(0, -len, 0, len);
    grad.addColorStop(0, greens[0]);
    grad.addColorStop(0.55, greens[1 + (i % 2)]);
    grad.addColorStop(1, greens[(i + 1) % greens.length]);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, -len);
    g.bezierCurveTo(wid, -len * 0.4, wid, len * 0.35, 0, len);
    g.bezierCurveTo(-wid, len * 0.35, -wid, -len * 0.4, 0, -len);
    g.fill();
    g.strokeStyle = 'rgba(18,26,14,0.55)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(0, -len * 0.85);
    g.lineTo(0, len * 0.8);
    g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  leafCache.set(variant, t);
  return t;
}

export function leafMaterial(variant = 0) {
  const key = 'leaf' + variant;
  if (materials[key]) return materials[key];
  const m = new THREE.MeshStandardMaterial({
    map: leafTexture(variant),
    color: variant === 2 ? 0xc4d0a6 : 0xb8c498,
    roughness: 0.9,
    metalness: 0,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    // a trace of self-light keeps a leaf card from going pure black when the
    // moon is behind it; it is not a glow, it is the sky in the canopy
    emissive: 0x0c140b,
    emissiveIntensity: 0.55,
  });
  materials[key] = m;
  return m;
}

export function fernTexture() {
  if (leafCache.has('fern')) return leafCache.get('fern');
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = '#3f5230';
  g.lineWidth = 2;
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI / 2 + (f - 3) * 0.32;
    g.save();
    g.translate(64, 120);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(2, -60, 0, -118);
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const y = -18 - i * 10;
      const w = 14 - i * 1.1;
      g.strokeStyle = i < 5 ? '#4c6338' : '#5b7043';
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(w * 0.6, y - 4, w, y - 9);
      g.stroke();
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(-w * 0.6, y - 4, -w, y - 9);
      g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  leafCache.set('fern', t);
  return t;
}

export function fernMaterial() {
  if (materials.fern) return materials.fern;
  const m = new THREE.MeshStandardMaterial({
    map: fernTexture(), color: 0xa4b487, roughness: 0.95,
    alphaTest: 0.4, side: THREE.DoubleSide,
  });
  materials.fern = m;
  return m;
}

export function disposeMaterials() {
  for (const m of Object.values(materials)) m.dispose?.();
  for (const set of loadedSets.values()) for (const t of Object.values(set)) t.dispose();
  loadedSets.clear();
  cache.clear();
}
