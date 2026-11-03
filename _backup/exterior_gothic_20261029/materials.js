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
// One texture budget for the whole world. 512 px is the default because the
// integrated GPU this game targets shares system RAM with the CPU, and thirty
// material sets at 1k would be ~90 MB of texture memory more than the 512 set.
// The carriageway is the one surface the player inspects at arm's length with
// headlights on it, so asphalt gets a 1k cap of its own: it is a single set, and
// at the 3.2 m tile the blend authored it with, 1k is 320 px per metre of road.
const CAP = 512;
const CAP_BY_SET = { asphalt: 1024 };

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
function capped(img, cap = CAP) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const s = Math.min(1, cap / Math.max(w, h));
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

async function loadSet(slug, names, cap = CAP) {
  const out = {};
  for (const [kind, file] of Object.entries(names)) {
    const img = await loadImage(TEX + slug + '/' + file);
    out[kind] = textureFromCanvas(capped(img, cap), { srgb: kind === 'map' });
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
  // Polished stone floor tiles, 2.2 m of wall/floor per repeat (Poly Haven
  // grey_tiles, fetched for the service rooms this pass). Warm grey, worn at
  // the joints, laid 4 x 4 in the photograph — the 0.55 m tile of a 1930s
  // service bath rather than the 1.8 m sheet the generic interior tile map was
  // being asked to be.
  tileSmall: ['grey_tiles', { map: 'grey_tiles_diff_1k.jpg', normalMap: 'grey_tiles_nor_gl_1k.jpg', roughnessMap: 'grey_tiles_rough_1k.jpg' }],
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
  barkMoss: ['tree_bark_03', { map: 'tree_bark_03_diff_1k.jpg', normalMap: 'tree_bark_03_nor_gl_1k.jpg', roughnessMap: 'tree_bark_03_rough_1k.jpg' }],
  asphalt: ['asphalt_02', { map: 'asphalt_02_diff_2k.jpg', normalMap: 'asphalt_02_nor_gl_2k.jpg', roughnessMap: 'asphalt_02_rough_2k.jpg' }],
  // The other two thirds of a provincial road surface: asphalt_01 is the same
  // aggregate laid and worn differently (2.08 m tile) and is used for the
  // patched, resurfaced rectangles and the drive; worn_asphalt is the failure
  // at the edge of the carriageway, where the tar has broken up and leaf litter
  // has collected in it (2 m tile). Same family, so the repairs read as repairs.
  asphaltPatch: ['asphalt_01', { map: 'asphalt_01_diff_1k.jpg', normalMap: 'asphalt_01_nor_gl_1k.jpg', roughnessMap: 'asphalt_01_rough_1k.jpg' }],
  asphaltEdge: ['worn_asphalt', { map: 'worn_asphalt_diff_1k.jpg', normalMap: 'worn_asphalt_nor_gl_1k.jpg', roughnessMap: 'worn_asphalt_rough_1k.jpg' }],
  groundMud: ['mud_forest', { map: 'mud_forest_diff_1k.jpg', normalMap: 'mud_forest_nor_gl_1k.jpg', roughnessMap: 'mud_forest_rough_1k.jpg' }],
  boulder: ['boulder_01', { map: 'boulder_01_diff_1k.jpg' }],
  // Fine hardwood veneer for the mansion's joinery. The plank maps are right
  // for floors, decks and doors; on a 1 m dresser front their board joints read
  // as stripes at ten times the scale of real furniture grain.
  teak: ['teak_veneer', {
    map: 'teak_veneer_diff_1k.jpg',
    normalMap: 'teak_veneer_nor_gl_1k.jpg',
    roughnessMap: 'teak_veneer_rough_1k.jpg',
  }],
};

const defs = {
  // plaster / masonry
  wallPlaster: { set: 'wallPlaster', color: 0xb7b0a0, rough: 0.94, metal: 0 },
  // The blue plaster is a stained, desaturated grey-blue, not a teal. The map
  // is already blue; a green tint on top of it pushed every ground-floor room
  // toward aquarium light and made the stair reference impossible to match.
  // The map's own average is (135,164,159) — a green-teal — so the tint has to
  // pull red and blue up to land on the cold, weathered blue-grey of the stair
  // reference. A neutral grey tint left every blue room looking like a pool.
  wallBlue: { set: 'wallBlue', color: 0xb4b2c2, rough: 0.93, metal: 0 },
  wallpaper: { set: 'wallpaper', color: 0x9d9280, rough: 0.95, metal: 0 },
  concrete: { set: 'concrete', color: 0x9a998f, rough: 0.96, metal: 0 },
  brick: { set: 'brick', color: 0x8a7261, rough: 0.95, metal: 0 },
  stone: { set: 'stone', color: 0xa29a86, rough: 0.97, metal: 0 },
  stoneDark: { set: 'stone', color: 0x6d675c, rough: 0.98, metal: 0 },
  // THE ELEVATION. The walls read as brown fieldstone for four storeys, which
  // is what the plaster photograph is: a warm, sandy rubble. The reference
  // manor is a cold, wet grey — so the outside gets its own keys, pulled blue
  // and desaturated, and the base course a darker damp band under it. Interiors
  // keep the warm plaster; only what stands outside the plaster line changes.
  facade: { set: 'stone', color: 0x8f948f, rough: 0.95, metal: 0 },
  facadeDamp: { set: 'stone', color: 0x565c59, rough: 0.98, metal: 0 },
  facadeTrim: { set: 'stone', color: 0xa3a8a0, rough: 0.90, metal: 0 },
  // Slate. The floor-plan charcoal the reference roofs are, taken off the grey
  // plank map so the courses have a lap to catch the moonlight, tiled small and
  // kept smooth: slate is the one roof surface that should not look rough.
  roofSlate: { set: 'woodGrey', color: 0x3a4145, rough: 0.58, metal: 0.05 },
  // The stacks. In the reference the chimneys are the only warm note in a cold
  // elevation — soft red brick climbing out of grey stone — and stone stacks
  // disappeared against the roof entirely.
  chimneyBrick: { set: 'brick', color: 0x8d6a5c, rough: 0.95, metal: 0 },
  // floors
  woodFloor: { set: 'woodFloor', color: 0x8b6f52, rough: 0.78, metal: 0 },
  woodFloorOld: { set: 'woodFloorOld', color: 0x7c644c, rough: 0.82, metal: 0 },
  marble: { set: 'marble', color: 0xb5b0a4, rough: 0.35, metal: 0 },
  tile: { set: 'tile', color: 0xa29b8d, rough: 0.55, metal: 0 },
  tileDirty: { set: 'tileDirty', color: 0x8b867a, rough: 0.7, metal: 0 },
  tileSmall: { set: 'tileSmall', color: 0x9a9384, rough: 0.44, metal: 0 },
  concreteFloor: { set: 'concreteFloor', color: 0x8d8a80, rough: 0.92, metal: 0 },
  // furniture
  wood: { set: 'wood', color: 0x84603f, rough: 0.66, metal: 0 },
  // Narra was the hardwood of the period; the teak veneer carries the fine
  // grain, the tint keeps it in the same warm family as the estate timber.
  woodNarra: { set: 'teak', color: 0xa87850, rough: 0.5, metal: 0 },
  woodDark: { set: 'wood', color: 0x4c3828, rough: 0.6, metal: 0 },
  // The doors and their architraves: dark walnut stain on the same veneer
  // photograph as the narra pieces, tinted down to the near-black brown of an
  // eighty-year-old interior door — the first attempt at 0x6b4a2e came out of
  // the flashlight as cherry orange, which is the reference photo's opposite.
  // Built by architecture.js, which turns the grain a quarter so it runs UP
  // the leaf instead of across it.
  doorWalnut: { set: 'teak', color: 0x3d2d20, rough: 0.62, metal: 0 },
  woodGrey: { set: 'woodGrey', color: 0x8a8274, rough: 0.8, metal: 0 },
  woodDirt: { set: 'woodDirt', color: 0x6d5a44, rough: 0.88, metal: 0 },
  iron: { set: 'iron', color: 0x6f6d68, rough: 0.55, metal: 0.55 },
  ironDark: { set: 'iron', color: 0x4a4844, rough: 0.62, metal: 0.5 },
  rust: { set: 'rust', color: 0x7a5a41, rough: 0.82, metal: 0.35 },
  rustDark: { set: 'rust', color: 0x523a2a, rough: 0.88, metal: 0.25 },
  linen: { set: 'linen', color: 0xbdb5a2, rough: 0.95, metal: 0 },
  velvet: { set: 'velvet', color: 0x5a2f2c, rough: 0.9, metal: 0 },
  rug: { set: 'linen', color: 0x4a352d, rough: 1, metal: 0 },
  leather: { set: 'leather', color: 0x5b4030, rough: 0.7, metal: 0 },
  // nature
  groundForest: { set: 'groundForest', color: 0x4b4a35, rough: 1, metal: 0 },
  groundGrass: { set: 'groundGrass', color: 0x50593c, rough: 1, metal: 0 },
  mud: { set: 'mud', color: 0x4a4030, rough: 1, metal: 0 },
  bark: { set: 'bark', color: 0x7a6650, rough: 0.95, metal: 0 },
  barkMoss: { set: 'barkMoss', color: 0x6d6350, rough: 0.97, metal: 0 },
  // Tint, not paint: the blend's road material multiplies the map by a near-
  // white base (0.8), so colour here is a small tint on real aggregate. The
  // old 0.42 grey was a second darkening on top of a dark photograph.
  asphalt: { set: 'asphalt', color: 0xc0c1be, rough: 0.9, metal: 0 },
  asphaltPatch: { set: 'asphaltPatch', color: 0xb5b5b1, rough: 0.87, metal: 0 },
  asphaltEdge: { set: 'asphaltEdge', color: 0xa09c92, rough: 0.94, metal: 0 },
  // The verge: dark, wet forest floor where the shoulder meets the trees. It is
  // a different surface from the litter under the canopy, and using it stops
  // the roadside reading as one enormous smear of the same ground texture.
  groundMud: { set: 'groundMud', color: 0x7f7660, rough: 1, metal: 0 },
  boulder: { set: 'boulder', color: 0x6a675f, rough: 0.95, metal: 0 },
};

// --- the real size of one texture repeat -----------------------------------
// Every surface in this game is textured by mapping UVs in METRES and scaling
// the map by 1/tile. That is the only way the same material can be right on a
// 0.14 m door leaf and a 400 m road: the caller hands geometry a UV in metres
// and the material converts it once. It also makes a mistake visible instead of
// invisible — the road used to be tiled every 0.25 m instead of every 3.2 m,
// which is a 13x error that rendered as a black rectangle under headlights.
//
// The tile sizes are the physical dimensions of the source photograph, taken
// from the Poly Haven API `dimensions` field for each asset, so a 3.2 m tile is
// 3.2 m of road and not 3.2 m of nothing in particular.
export const TILE = {
  asphalt: 3.2,        // asphalt_02 — the value the opening-scene blend uses
  asphaltPatch: 2.08,  // asphalt_01
  asphaltEdge: 2.0,    // worn_asphalt
  groundMud: 2.35,     // mud_forest
  barkMoss: 1.0,       // tree_bark_03
  bark: 2.0,           // bark_brown_02
  groundForest: 5.0,   // forrest_ground_01
  groundGrass: 4.0,    // grass_ground
  mud: 4.0,            // brown_mud
  // --- interiors -----------------------------------------------------------
  // These are the same photographs, at the size the photograph actually
  // covers (ASSET_LICENSES.md records the Poly Haven dimensions field for each
  // one). They were previously all laid at one repeat per metre, so a 2 m
  // plaster photograph tiled twice as often as the wall it came from and every
  // room read as a grid of square panels; the floorboards were worse at 3 m.
  wallPlaster: 2.0,    // damaged_plaster
  wallBlue: 2.4,       // blue_plaster_weathered
  wallpaper: 2.0,      // decrepit_wallpaper
  concrete: 2.6,       // concrete_wall_003
  brick: 2.4,          // brick_wall_006
  stone: 2.6,          // estate / plaster_stone_wall_02
  facade: 2.6,
  woodFloor: 3.0,      // wooden_floor_02
  woodFloorOld: 3.0,   // old_wooden_floor_01
  marble: 2.4,         // marble_tiles
  tile: 1.8,           // interior_tiles
  tileDirty: 1.6,      // dirty_tiles
  tileSmall: 2.2,      // grey_tiles
  concreteFloor: 2.6,  // concrete_floor_worn_001
  wood: 2.4,           // planks_brown_10
  woodGrey: 2.4,       // wood_planks_grey
  woodDirt: 2.4,       // wood_planks_dirt
  iron: 2.0,           // corrugated_iron_02
  rust: 1.6,           // rusty_metal_sheet
  linen: 1.2,          // rough_linen
  velvet: 1.0,         // velour_velvet
  leather: 1.0,        // brown_leather
};

export function tileOf(key) { return TILE[key] || 3; }

// Scale a material's maps so a UV expressed in metres lands as one repeat per
// `metres`. Replaces the old tileMaps(mat, sx, sy) guesswork at the call sites
// that deal with real-world surfaces.
export function tileAtMetres(mat, metres) {
  const r = 1 / Math.max(0.05, metres);
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    if (!mat[k]) continue;
    // material.clone() copies the map REFERENCES, so setting a repeat on a
    // clone silently rewrites the tiling of every other mesh using the same
    // texture — and is rewritten by whichever code calls tileMaps last. Any
    // material that is being given its own real-world scale must own its maps.
    if (!mat.userData.uvOwned) {
      mat[k] = mat[k].clone();
      mat[k].needsUpdate = true;
    }
    mat[k].repeat.set(r, r);
    mat[k].needsUpdate = true;
  }
  mat.userData.uvOwned = true;
  return mat;
}

// --- dressed stone, drawn -------------------------------------------------
// The elevation used the interior's rubble fieldstone photograph, and that is
// wrong twice over. The manor is dressed ashlar, not rubble; and a photo of
// loose stones has no COURSE in it — no horizontal line the eye can follow
// across forty metres — so at four storeys the wall reads as white pebbles
// scattered on a green ground. That was the single largest reason the outside
// did not match its reference.
//
// So the tile is drawn: ten courses of squared blocks, joints darker than the
// stone, every block a slightly different grey because ashlar is laid from
// whatever the quarry lifted that week, and eighty years of rain running down
// it in vertical streaks. Drawn nine times on a shifted canvas so it wraps.
// At the 2.6 m repeat the elevation uses, one course lands at 0.26 m — a real
// dressed stone, and coarse enough to read from the drive on a 1280-wide frame.
const ASHLAR_PX = 512;
let ashlarCache = null;

function ashlarCanvas(S = ASHLAR_PX) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 20261028;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const wrapped = (fn) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        g.save(); g.translate(dx * S, dy * S); fn(); g.restore();
      }
    }
  };
  // the joint colour is the ground: it shows through every gap
  g.fillStyle = '#3d3f37';
  g.fillRect(0, 0, S, S);

  // Eight courses, not ten. Ten at a 2.6 m repeat gives 0.26 m stones with a
// joint every 0.26 m, which reads as grey brick from the drive — the reference
// wall is dressed in larger, flatter blocks with joints that are a shadow and
// not a groove. Eight courses land at 0.33 m, and the tone range is halved: an
// ashlar face varies, but it does not alternate light and dark block by block.
  const COURSES = 8;
  const ch = S / COURSES;
  const J = 2.0;                       // joint width, px
  for (let row = 0; row < COURSES; row++) {
    const y = row * ch;
    // joints stagger row to row, the way coursed ashlar is bonded
    let x = -rnd() * ch * 1.7;
    while (x < S) {
      const w = ch * (1.25 + rnd() * 1.95);
      const v = 104 + rnd() * 26;      // cold mid grey, 104..130
      const warm = rnd() * 12;         // a few sandy stones in the run
      const r = v + warm * 0.55, gg = v + warm * 0.22, b = v - 2;
      wrapped(() => {
        g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        g.fillRect(x + J / 2, y + J / 2, w - J, ch - J);
        // a chiselled edge: the top of the block catches light, its bed sits
        // in the shadow of the joint
        g.fillStyle = 'rgba(255,255,255,0.055)';
        g.fillRect(x + J / 2, y + J / 2, w - J, 1.7);
        g.fillStyle = 'rgba(0,0,0,0.17)';
        g.fillRect(x + J / 2, y + ch - J / 2 - 2.2, w - J, 2.2);
      });
      x += w;
    }
  }

  // grain: even a dressed face is not a flat fill
  for (let i = 0; i < S * S * 0.09; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.02 + rnd() * 0.04})`;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1);
  }

  // grime. Vertical, because water runs down a wall and stops on a joint.
  for (let i = 0; i < 52; i++) {
    const x = rnd() * S, w = 3 + rnd() * 24, top = rnd() * S * 0.55;
    const h = S * (0.30 + rnd() * 0.70);
    const grd = g.createLinearGradient(0, top, 0, top + h);
    grd.addColorStop(0, 'rgba(24,28,24,0)');
    grd.addColorStop(0.32, `rgba(24,28,24,${0.10 + rnd() * 0.17})`);
    grd.addColorStop(1, 'rgba(18,22,20,0)');
    g.fillStyle = grd;
    g.fillRect(x, top, w, h);
  }

  // damp blooms where the wall never dries, and lichen in the joints
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 58;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(44,52,42,${0.09 + rnd() * 0.13})`);
    grd.addColorStop(1, 'rgba(44,52,42,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

// Colour and height from the same drawing: the joints recess and the dressed
// faces stand proud, which is the whole difference between a wall and a poster.
export function ashlarTexture() {
  if (ashlarCache) return ashlarCache;
  const c = ashlarCanvas();
  ashlarCache = {
    map: textureFromCanvas(c, { srgb: true }),
    bump: textureFromCanvas(c),
  };
  return ashlarCache;
}

// --- slate, drawn ----------------------------------------------------------
// The roofs wore a grey plank map tinted charcoal. Planks are the one thing a
// slate roof is not: slate is hung in overlapping courses, each course casting
// a lap shadow on the one below, and in the reference that banding is the only
// thing that describes the roof. One 512 px tile, eleven courses, staggered
// slates — no photograph needed for a surface this regular.
let slateCache = null;

function slateCanvas(S = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 77103;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const wrapped = (fn) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        g.save(); g.translate(dx * S, dy * S); fn(); g.restore();
      }
    }
  };
  g.fillStyle = '#20262a';
  g.fillRect(0, 0, S, S);
  const COURSES = 11;
  const ch = S / COURSES;
  for (let row = 0; row < COURSES; row++) {
    const y = row * ch;
    let x = (row % 2 ? -ch * 1.1 : 0) - rnd() * ch * 0.5;
    while (x < S) {
      const w = ch * (0.72 + rnd() * 0.34);
      const v = 44 + rnd() * 26;                       // blue-grey charcoal
      wrapped(() => {
        g.fillStyle = `rgb(${(v * 0.94) | 0},${v | 0},${(v * 1.10) | 0})`;
        g.fillRect(x + 0.8, y, w - 1.6, ch);
        // the lap: the bottom edge of each slate lifts and catches the sky
        g.fillStyle = 'rgba(198,214,224,0.10)';
        g.fillRect(x + 0.8, y + ch - 3.2, w - 1.6, 2.0);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x + 0.8, y + ch - 1.2, w - 1.6, 1.2);
        // a wet slate is not evenly wet
        if (rnd() < 0.30) {
          g.fillStyle = `rgba(150,170,182,${0.03 + rnd() * 0.05})`;
          g.fillRect(x + 0.8 + rnd() * w * 0.4, y + rnd() * ch * 0.5, w * 0.35, ch * 0.4);
        }
      });
      x += w;
    }
  }
  // moss along the laps, the way a slate roof eighty years unmaintained is
  for (let i = 0; i < 44; i++) {
    const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 13;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(58,68,44,${0.16 + rnd() * 0.20})`);
    grd.addColorStop(1, 'rgba(58,68,44,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

export function slateTexture() {
  if (slateCache) return slateCache;
  const c = slateCanvas();
  slateCache = {
    map: textureFromCanvas(c, { srgb: true }),
    bump: textureFromCanvas(c),
  };
  return slateCache;
}

// Put the drawn stone and slate on the materials that stand outside the plaster
// line, and drop the photographed normal and roughness maps with them: a rubble
// normal on an ashlar wall is a lie the light will tell at every glancing angle.
function applyDrawnExterior() {
  const a = ashlarTexture();
  // The field and the dressings must not be the same value. In the reference
  // the wall is a dark weathered grey and the surrounds, sills and cornice are
  // pale dressed stone: that contrast is what draws the rows of windows across
  // the elevation. Tinting them within two per cent of each other, as the first
  // pass did, erases the whole window rhythm and leaves a flat grey cliff.
  for (const [key, tint, rough] of [
    ['facade', 0x8d9088, 0.95],
    ['facadeTrim', 0xc9cbc2, 0.92],
    ['facadeDamp', 0x5f645e, 0.96],
  ]) {
    const m = materials[key];
    if (!m) continue;
    m.map = a.map;
    m.bumpMap = a.bump;
    m.bumpScale = 0.022;
    m.normalMap = null;
    m.roughnessMap = null;
    m.color.setHex(tint);
    m.roughness = rough;
    m.needsUpdate = true;
  }
  const s = slateTexture();
  const roof = materials.roofSlate;
  if (roof) {
    roof.map = s.map;
    roof.bumpMap = s.bump;
    roof.bumpScale = 0.018;
    roof.normalMap = null;
    roof.roughnessMap = null;
    roof.color.setHex(0x99a3ab);
    roof.roughness = 0.64;
    roof.needsUpdate = true;
  }
}

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
    const maps = await loadSet(slug, files, CAP_BY_SET[name]);
    // Keyed by material set, not by texture folder. Two sets (stone and wood)
    // both live in public/assets/textures/estate; keying by the folder meant
    // whichever finished loading last won, and every wooden prop or every
    // stone wall was drawn with the other one's texture.
    loadedSets.set(name, maps);
    setsDone++;
    onProgress?.(0.9 * (setsDone / unique.size), 'mixing ' + slug.replace(/_/g, ' ') + '…');
  }));
  for (const [key, def] of Object.entries(defs)) {
    const maps = loadedSets.get(def.set);
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
  for (const key of Object.keys(FLAT)) materials[key] = makeFlatMaterial(key);
  applyDrawnExterior();
  return materials;
}

// --- one material per soffit family, kept separate from the wall plaster ---
// The ceiling under a floor and the underside of a raised timber structure
// should not keep reusing the wall plaster map. Plaster reads as a painted
// surface; a timber underside reads as planks, which is what the shore, the
// porch roof and the staircase soffit actually are.
let _soffit = null;
function soffitMaterial() {
  if (_soffit) return _soffit;
  _soffit = materials.wallPlaster.clone();
  _soffit.name = 'slabSoffit';
  _soffit.color.multiplyScalar(0.82);
  _soffit.roughness = 0.96;
  _soffit.side = THREE.DoubleSide;
  tileMaps(_soffit, 1, 1);
  return _soffit;
}

let _woodSoffit = null;
function woodSoffitMaterial() {
  if (_woodSoffIt) return _woodSoffIt;
  _woodSoffIt = materials.woodGrey.clone();
  _woodSoffit.name = 'slabWoodSoffit';
  _woodSoffit.roughness = 0.82;
  _woodSoffit.side = THREE.DoubleSide;
  tileAtMetres(_woodSoffit, 1.8);
  _woodSoffit.map.repeat.set(1 / 1.8, 1 / 1.8);
  return _woodSoffit;
}

// --- materials that are a shader, not a photographed surface --------------
const flatCache = new Map();

function noiseCanvas(size, base, spread, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  // coarse blotches first, then fine grain: roughness varies at two scales on
  // any real glazed or painted surface
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 220; i++) {
    const r = 4 + rnd() * size * 0.16;
    const v = base + (rnd() - 0.5) * spread * 2;
    const x = rnd() * size, y = rnd() * size;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v | 0},${v | 0},${v | 0},0.55)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < size * size * 0.35; i++) {
    const v = base + (rnd() - 0.5) * spread;
    ctx.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.22)`;
    ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  return c;
}

function flatMaps(key) {
  if (flatCache.has(key)) return flatCache.get(key);
  const spec = FLAT[key];
  const maps = {};
  if (spec.grain) {
    const c = noiseCanvas(256, 190, spec.grain, 1337 + key.length * 7);
    maps.roughnessMap = textureFromCanvas(c);
    maps.roughnessMap.repeat.set(2.5, 2.5);
    if (spec.bump) {
      maps.bumpMap = textureFromCanvas(c);
      maps.bumpMap.repeat.set(2.5, 2.5);
    }
  }
  flatCache.set(key, maps);
  return maps;
}

const FLAT = {
  brass:      { color: 0x8f6f34, rough: 0.36, metal: 0.88, grain: 26 },
  porcelain:  { color: 0xe6e4dc, rough: 0.17, metal: 0.02, grain: 12 },
  paint:      { color: 0xcfcabb, rough: 0.48, metal: 0.0, grain: 22, bump: true },
  glass:      { color: 0x8fa8a8, rough: 0.06, metal: 0.0, glass: true },
  enamel:     { color: 0xdfe0d8, rough: 0.22, metal: 0.35, grain: 10 },
  ceramic:    { color: 0xe6e3d8, rough: 0.34, metal: 0.0, grain: 14, bump: true },
  // Machinery paint: a dark blue-grey engine enamel and a lighter panel grey.
  // Flat materials, because a corrugated-iron map on a rocker cover reads as
  // corrugated iron and not as a casting.
  engineEnamel: { color: 0x56625c, rough: 0.52, metal: 0.22, grain: 14 },
  panelSteel:   { color: 0x6a716d, rough: 0.58, metal: 0.30, grain: 12 },
  // The fuse is wrapped in paper; without this key the wrap was silently
  // dropped and the console filled with 'unknown material paper'.
  paper:        { color: 0xd6cdb6, rough: 0.95, metal: 0.0, grain: 10 },
  // Blacksmith's iron for door furniture: hinges, service levers, strap
  // plates. Not corrugated_iron_02 — that map is a roof, and at 5 cm across a
  // hinge it reads as a rusted sheet rather than as a casting.
  wroughtIron:  { color: 0x3c3a36, rough: 0.54, metal: 0.74, grain: 18 },
};

function makeFlatMaterial(key) {
  const spec = FLAT[key];
  const maps = flatMaps(key);
  const m = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.rough,
    metalness: spec.metal,
  });
  if (maps.roughnessMap) m.roughnessMap = maps.roughnessMap;
  if (maps.bumpMap) { m.bumpMap = maps.bumpMap; m.bumpScale = 0.0035; }
  if (spec.glass) {
    m.transparent = true;
    m.opacity = 0.26;
    m.side = THREE.DoubleSide;
    m.depthWrite = false;
  }
  return m;
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

// --- materials that are a shader, not a photographed surface --------------
function noiseCanvasSmall(size, base, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 220; i++) {
    const r = 4 + rnd() * size * 0.16;
    const v = base + (rnd() - 0.5) * 26 * 2;
    const x = rnd() * size, y = rnd() * size;
    ctx.fillStyle = `rgb(${v|0},${v|0},${v|0})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

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

// --- wind -----------------------------------------------------------------
// Foliage is instanced alpha-tested cards, and a static card forest is the
// single biggest tell that a world is a model. The sway is a vertex-shader
// displacement: no per-vertex CPU work, no extra draw calls, no extra
// geometry.
//   * phase comes from each instance's world position, so neighbouring trees
//     do not sway in lockstep;
//   * three sines at incommensurate frequencies build and drop the gust instead
//     of metronoming;
//   * amplitude grows with height above the instance origin, so a fern moves
//     centimetres and a canopy moves decimetres;
//   * it fades out past 55 m, where the motion is sub-pixel and would only cost
//     vertex work.
const windUniforms = [];

let windSeconds = 0;

export function updateWind(seconds) {
  windSeconds = seconds;
  for (const u of windUniforms) u.uWindTime.value = seconds;
}

export function windTime() { return windSeconds; }

// Probe surface: how many materials carry the wind program, at what phase, and
// a way to A/B the displacement (a still frame with amp 0 is the control that
// proves the moving pixels are the wind and not something else in the scene).
export function windStats() {
  return {
    programs: windUniforms.length,
    time: +windSeconds.toFixed(2),
    amp: windUniforms[0]?.uWindAmp?.value ?? null,
  };
}

export function setWindAmplitude(a) {
  for (const u of windUniforms) u.uWindAmp.value = a;
}// --- support for the probe inspector --------------------------------------
export function soffitMaterialOf(name) {
  const m = materials[name];
  if (!m) return { ok: false, why: 'no such material' };
  const maps = ['map', 'normalMap', 'roughnessMap'].filter((k) => !!m[k]);
  return { ok: true, tiling: maps.map((k) => [k, m[k].repeat.toArray()]) };
}

function applyWind(material, amp = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: windSeconds };
    shader.uniforms.uWindAmp = { value: amp };
    windUniforms.push(shader.uniforms);
    shader.vertexShader = 'uniform float uWindTime;\nuniform float uWindAmp;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 windOrigin = vec3(0.0);
      #ifdef USE_INSTANCING
        windOrigin = instanceMatrix[3].xyz;
      #endif
      float windPhase = windOrigin.x * 0.31 + windOrigin.z * 0.27;
      float gust = sin(uWindTime * 0.55 + windPhase) * 0.58
                 + sin(uWindTime * 1.23 + windPhase * 1.7) * 0.27
                 + sin(uWindTime * 2.31 + windPhase * 2.9) * 0.15;
      float swayAmp = (0.012 + 0.0062 * min(position.y, 14.0)) * uWindAmp;
      float windFade = 1.0 - smoothstep(55.0, 130.0, distance(windOrigin, cameraPosition));
      transformed.x += gust * swayAmp * windFade;
      transformed.z += cos(uWindTime * 0.71 + windPhase * 1.3) * swayAmp * 0.55 * windFade;
    `);
  };
  // Without this the renderer would hand this material a program compiled for
  // an unmodified MeshStandardMaterial and the sway would silently not exist.
  material.customProgramCacheKey = () => 'wind' + amp;
  return material;
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
  applyWind(m, 1);
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
  // understory is short: same gust, a third of the travel
  applyWind(m, 0.55);
  materials.fern = m;
  return m;
}

// --- ivy ------------------------------------------------------------------
// The reference elevation is half-claimed by ivy: curtains hanging off the
// cornice, runners climbing out of the base, the tower wrapped to its string
// band. There is no leaf atlas in this project (see the header) and a
// photograph would not tile, so the tile is drawn here — vines first as dark
// runners, then three-lobed leaves along them, everything drawn nine times on
// a shifted canvas so the pattern wraps seamlessly. 192 px, 1.1 m of wall per
// repeat: an ivy leaf lands at about 9 cm, which is what the plant does.
let ivyLeafDraw = null;

function ivyLeafPath(g, x, y, r, a, fill) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, r * 0.85);                                            // petiole end
  g.bezierCurveTo(-r * 0.62, r * 0.62, -r * 1.05, r * 0.05, -r * 0.72, -r * 0.38);
  g.bezierCurveTo(-r * 0.5, -r * 0.7, -r * 0.3, -r * 0.74, -r * 0.15, -r * 0.98);
  g.lineTo(0, -r * 0.6);                                            // the notch
  g.lineTo(r * 0.15, -r * 0.98);
  g.bezierCurveTo(r * 0.3, -r * 0.74, r * 0.5, -r * 0.7, r * 0.72, -r * 0.38);
  g.bezierCurveTo(r * 1.05, r * 0.05, r * 0.62, r * 0.62, 0, r * 0.85);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(14,20,12,0.45)';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

export function ivyTexture() {
  if (ivyLeafDraw) return ivyLeafDraw;
  // 256, not 192. A non-power-of-two canvas gets no mipmaps in WebGL, so the
  // ivy was minified without filtering: at thirty metres every alpha-tested
  // leaf broke into a fixed pattern of pinholes, the grey wall showed through
  // them, and the whole facade's ivy read as pale speckled teal. Power of two
  // buys mipmaps and anisotropy and the leaves resolve into foliage again.
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 20261027;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const wrapped = (fn) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        g.save(); g.translate(dx * S, dy * S); fn(); g.restore();
      }
    }
  };

  // the runners the leaves hang from
  const vines = [];
  for (let i = 0; i < 7; i++) {
    const x0 = rnd() * S, y0 = rnd() * S;
    const x1 = x0 + (rnd() - 0.5) * 170, y1 = y0 + (rnd() - 0.5) * 170;
    const cx = (x0 + x1) / 2 + (rnd() - 0.5) * 80;
    const cy = (y0 + y1) / 2 + (rnd() - 0.5) * 80;
    vines.push([x0, y0, cx, cy, x1, y1]);
  }
  for (const [x0, y0, cx, cy, x1, y1] of vines) {
    wrapped(() => {
      g.strokeStyle = '#3a3620';
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(cx, cy, x1, y1);
      g.stroke();
    });
  }

  // leaves along the runners, then a scatter to close the gaps. The greens
  // are deliberately dull and a few are yellowed: fresh ivy green reads as
  // plastic on a wall that has been dying for eighty years.
  const greens = ['#2b3a22', '#33452a', '#3b5030', '#455a37', '#4f653d', '#586b41', '#627047', '#6d7349', '#727047', '#5f6440'];
  const leaf = (x, y, r, a) => wrapped(() => ivyLeafPath(g, x, y, r, a, greens[(rnd() * greens.length) | 0]));
  for (const [x0, y0, cx, cy, x1, y1] of vines) {
    const n = 16 + ((rnd() * 10) | 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, it = 1 - t;
      const x = it * it * x0 + 2 * it * t * cx + t * t * x1 + (rnd() - 0.5) * 14;
      const y = it * it * y0 + 2 * it * t * cy + t * t * y1 + (rnd() - 0.5) * 14;
      leaf(x, y, 9 + rnd() * 7, rnd() * Math.PI * 2);
    }
  }
  // The first pass draws strands; this one closes them into a mass. The
  // reference elevation does not show a creeper, it shows a wall being
  // consumed — at forty leaves the tile read as green string at any distance
  // the player actually stands at.
  for (let i = 0; i < 300; i++) leaf(rnd() * S, rnd() * S, 8.5 + rnd() * 7, rnd() * Math.PI * 2);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  ivyLeafDraw = t;
  return t;
}

const ivyTints = [
  0x556b3a, 0x455429, 0x596238, 0x322a24, 0x8b9c78,
  0x6f7a52, 0x4a5638, 0x727047, 0x5f6440, 0x6a7546,
];
export const ivyLeafTints = ivyTints;
export function ivyMaterial() {
  if (materials.ivyLeaf) return materials.ivyLeaf;
  const m = new THREE.MeshStandardMaterial({
    map: ivyTexture(),
    color: 0x93a084,
    roughness: 0.93,
    metalness: 0,
    alphaTest: 0.28,
    side: THREE.DoubleSide,
    emissive: 0x0a1109,
    emissiveIntensity: 0.6,
  });
  applyWind(m, 0.45);
  materials.ivyLeaf = m;
  return m;
}

export function disposeMaterials() {
  for (const m of Object.values(materials)) m.dispose?.();
  for (const set of loadedSets.values()) for (const t of Object.values(set)) t.dispose();
  loadedSets.clear();
  cache.clear();
}
