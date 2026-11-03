import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOUSE = path.join(ROOT, 'public/assets/blender/house');
const OPENING = path.join(ROOT, 'public/assets/blender/opening');
const QC = path.join(ROOT, 'Blender/AssetLibrary/Working/House/_qc');
const OPENING_BUILD = path.join(ROOT, 'Blender/AssetLibrary/Working/Opening/_build');
const DRACO = path.join(ROOT, 'node_modules/three/examples/jsm/libs/draco');

// The scene files keep the names the Blender build writes and the QC harness
// reads (/house.glb, /act1.glb, /act1.json, /manifest.json). Serving them under
// those names from where they already live means the game and the QC pass are
// looking at one copy of the set, not a copied-out project.
const ALIASES = {
  '/house.glb': path.join(HOUSE, 'SILID_House.glb'),
  '/manifest.json': path.join(QC, 'house_manifest.json'),
  '/act1.glb': path.join(OPENING, 'SILID_Act1.glb'),
  '/act1.json': path.join(OPENING_BUILD, 'act1_manifest.json'),
};

const MIME = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
};

function sceneFiles() {
  return {
    name: 'silid-scene-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '/').split('?')[0]);
        const hit = ALIASES[url];
        // The whole house folder, so the game can also reach the forest
        // manifest and its variants GLB (/house/forest_manifest.json,
        // /house/SILID_Forest/variants.glb). Without this the real 4.5-million-
        // triangle forest 404s and the road is left lined by the set's own
        // trees - which is how the prologue ended up looking like a second
        // world next to the mansion's.
        const house = url.startsWith('/house/')
          ? path.join(HOUSE, url.slice('/house/'.length))
          : null;
        const draco = url.startsWith('/draco/')
          ? path.join(DRACO, url.slice('/draco/'.length))
          : null;
        const file = hit || house || draco;
        if (!file) return next();
        if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end('no ' + url);
        }
        const stat = fs.statSync(file);
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');
        return fs.createReadStream(file).pipe(res);
      });
    },
    // the same four names have to exist after `vite build`
    generateBundle() {
      for (const [url, file] of Object.entries(ALIASES)) {
        if (!fs.existsSync(file)) continue;
        this.emitFile({
          type: 'asset',
          fileName: url.slice(1),
          source: fs.readFileSync(file),
        });
      }
      // The forest lives under /house/ (its manifest names the variants GLB),
      // and the dev middleware serves that folder. The build only copied the
      // four alias files, so a production build shipped a game whose forest
      // 404s: trees gone, and a floor probe with nothing to say about them.
      const forest = path.join(HOUSE, 'SILID_Forest');
      if (fs.existsSync(forest)) {
        for (const name of fs.readdirSync(forest)) {
          this.emitFile({
            type: 'asset',
            fileName: 'house/SILID_Forest/' + name,
            source: fs.readFileSync(path.join(forest, name)),
          });
        }
      }
      if (fs.existsSync(path.join(HOUSE, 'forest_manifest.json'))) {
        this.emitFile({
          type: 'asset',
          fileName: 'house/forest_manifest.json',
          source: fs.readFileSync(path.join(HOUSE, 'forest_manifest.json')),
        });
      }
    },
  };
}

export default defineConfig({
  // The game is one module that awaits its own world: `await loader.loadAsync(
  // '/house.glb')` and the shader warmup both sit at the top level of app.js.
  // Top-level await is ES2022, and Vite's default build target ('modules' =
  // chrome87/safari14) rejects it, so `npm run build` failed on a project that
  // ran perfectly under `npm run dev`. The target is the fix; the game already
  // requires WebGL2 and ES2021 at runtime.
  build: { target: 'es2022' },
  server: {
    // 127.0.0.1, not localhost: Vite binds ::1 only otherwise, and every tool
    // in this repo (the QC harness, the screenshots, the user's bookmark)
    // talks to 127.0.0.1.
    host: '127.0.0.1',
    port: 5333,
    strictPort: true,
    open: false,
  },
  preview: { port: 5333, strictPort: true },
  // three is served as source, not pre-bundled: the patch below edits its
  // Material.prototype, and an esbuild prebundle would hide it.
  optimizeDeps: { exclude: ['three'] },
  plugins: [
    sceneFiles(),
    {
      name: 'patch-three-needsupdate',
      transform(code, id) {
        // This THREE build ships a broken needsUpdate descriptor on the
        // Material / MeshStandardMaterial prototype: the setter is a no-op
        // and there is no getter, so assigning needsUpdate = true never
        // flips the internal flag the WebGLRenderer checks when it decides
        // whether to re-upload a material's uniforms. That leaves every
        // authored material stuck on the GLTF exporter's white albedo
        // (most visibly the forest foliage cards). Patch the source so the
        // assignment path actually drives the internal flag.
        if (!id.includes('three')) return null;
        if (!code.includes('set needsUpdate(')) return null;
        return code.replace(
          /set needsUpdate\(value\)\s*\{\s*if\s*\(value\s*===\s*true\)\s*this\.version\+\+\s*\}/g,
          'set needsUpdate(value) { if (value === true) { this.version++; this._needsUpdate = true; } }',
        );
      },
    },
  ],
});
