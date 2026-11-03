// EXPORT THE PLAN — one authoritative copy of the mansion's numbers for the
// Blender build.
//
// The Blender master world must not keep a second hand-typed floor plan. This
// script imports the live `src/world/plan.js` and reads the handful of terrain
// constants out of `terrain.js`, so a change to a room, a door, the stair or the
// road moves both the game and the .blend together. Run it before every build:
//
//   node scripts/export_world_plan.mjs
//
// Output: reports/world/world_plan.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = await import(pathToFileURL(path.join(root, 'src/world/plan.js')).href);

// Terrain constants are plain exported numbers; reading them here keeps the
// Blender ground and the game's walkable ground on the same road line without
// importing three.js (and a material library) into Node.
const terrainSrc = fs.readFileSync(path.join(root, 'src/world/terrain.js'), 'utf8');
const num = (name) => {
  const m = terrainSrc.match(new RegExp(`export const ${name}\\s*=\\s*(-?[\\d.]+)`));
  if (!m) throw new Error(`terrain constant not found: ${name}`);
  return Number(m[1]);
};
const obj = (name) => {
  const m = terrainSrc.match(new RegExp(`export const ${name}\\s*=\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`terrain object not found: ${name}`);
  const out = {};
  for (const part of m[1].split(',')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    if (k && v !== undefined && !Number.isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
};

const out = {
  generated: new Date().toISOString(),
  source: 'src/world/plan.js + src/world/terrain.js',
  foot: plan.FOOT,
  bays: plan.BAYS,
  stair: plan.STAIR,
  levels: plan.LEVELS,
  windows: plan.WINDOWS,
  terrain: {
    roadX: num('ROAD_X'),
    carriage: num('CARRIAGE'),
    groundRadius: num('GROUND_RADIUS'),
    mansion: obj('MANSION'),
    pond: obj('POND'),
    car: obj('CAR'),
    // A breakdown on the shoulder: the SUV sits just off the tarmac facing
    // north, exactly where the game parks it.
    carRot: Math.PI,
  },
};

fs.mkdirSync(path.join(root, 'reports/world'), { recursive: true });
const file = path.join(root, 'reports/world/world_plan.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
const rooms = out.levels.reduce((n, l) => n + l.rooms.length, 0);
console.log(`wrote ${file}`);
console.log(`levels ${out.levels.length}, rooms ${rooms}, bays ${out.bays.length}, stair flights ${out.stair.rise.length * 2}`);
