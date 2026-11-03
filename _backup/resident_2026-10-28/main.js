// SILID — Act I. The boot sequence, the world assembly and the frame loop.
//
// THE LOADING PROBLEM, and what changed:
//
// The project this replaces loaded two multi-megabyte GLB scenes (a 400 MB
// decoded house texture budget) plus a forest set on top, all before the first
// frame, and then kept every interior material uploaded. On an integrated GPU
// the WebGL context was lost after a few minutes — the console showed an HLSL
// compiler failure and CONTEXT_LOST. The scene also froze while it built.
//
// This build has no giant scene download. The world is generated from the plan
// in bounded stages, each one yielding long enough for the loading bar to
// paint, and every texture that reaches the GPU is capped at 512 px. A failed
// stage reports what failed and offers a reload instead of leaving a bar at
// 12%. The boot bar is driven by stages that actually completed.

import * as THREE from 'three';
import { loadMaterials, setAnisotropy, updateWind, windStats, setWindAmplitude } from './world/materials.js';
import { buildTerrain, buildRoad, buildWater, heightAt, roadCenter, CAR } from './world/terrain.js';
import { buildForest, buildTrails } from './world/forest.js';
import { buildArchitecture, architecture, floorHeightAt } from './world/architecture.js';
import { buildUnderground } from './world/underground.js';
import { buildRuins, ruins } from './world/ruins.js';
import { loadLandmarks, landmarks } from './world/landmarks.js';
import { furnish, props } from './world/props.js';
import { buildCabinets, cabinets, updateCabinets } from './world/cabinets.js';
import { buildApparatus, apparatus } from './world/apparatus.js';
import { buildHiding, hiding } from './world/hiding.js';
import { loadFurniture, furniture } from './world/furniture.js';
import { LEVELS } from './world/plan.js';
import { buildCar } from './world/car.js';
import { buildSky } from './world/sky.js';
import { Opening } from './world/opening.js';
import { Player } from './player/player.js';
import { Game } from './game/game.js';
import { Ambience } from './game/audio.js';

const $ = (id) => document.getElementById(id);
const bar = $('boot-bar');
const msg = $('boot-msg');
const go = $('boot-go');

const params = new URLSearchParams(location.search);
let booted = false;

function progress(f, text) {
  if (bar) bar.style.width = Math.round(f * 100) + '%';
  if (msg && text) msg.textContent = text;
}

// Yield to the compositor so the bar actually paints between stages. If the tab
// is hidden there is nothing to paint, and rAF/timers are throttled: resolve
// immediately instead of turning a background load into a minute-long stall.
const tick = () => new Promise((r) => setTimeout(r, document.hidden ? 0 : 24));

async function boot() {
  progress(0.02, 'opening the door…');
  await tick();

  const canvas = document.createElement('canvas');
  document.body.insertBefore(canvas, document.getElementById('hud'));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = false;
  setAnisotropy(Math.min(4, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f14);
  scene.fog = new THREE.FogExp2(0x0a1016, 0.0105);

  const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 240);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // Moonlight is the only sky light. It is cool, low, and strong enough that a
  // tree trunk still has a lit side at ten metres; the darkness in this game
  // comes from the canopy and the interiors, not from a black exposure.
  const moon = new THREE.DirectionalLight(0xa9bdd8, 1.3);
  moon.position.set(-40, 55, -25);
  scene.add(moon);
  const skyLight = new THREE.HemisphereLight(0x4c6280, 0x1a1a1f, 1.5);
  scene.add(skyLight);

  // The dome, the stars and the moon disc are placed on the same direction as
  // the directional light, so the moon in the sky is the moon that is lighting
  // the estate.
  buildSky(scene, moon.position);

  // report a lost context as a lost context. The old build left a white
  // canvas and no explanation.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const b = document.getElementById('boot');
    if (!b) return;
    b.classList.remove('hidden');
    b.innerHTML = '<div class="sub">the graphics device reset</div>' +
      '<div class="msg">The GPU ran out of memory or the driver reset. Reload to rebuild the world; ' +
      'graphics quality is capped for this machine.</div>' +
      '<button class="go" style="display:block" onclick="location.reload()">RELOAD</button>';
  }, false);

  progress(0.05, 'mixing the materials…');
  await loadMaterials((f, text) => progress(0.05 + f * 0.25, text));
  await tick();

  const player = new Player(camera, canvas);
  player.enabled = false;

  progress(0.32, 'raising the ground…');
  buildTerrain(scene);
  buildRoad(scene);
  buildWater(scene);
  await tick();

  progress(0.44, 'building the house…');
  buildArchitecture(scene);
  await tick();

  // After the house: buildArchitecture() empties architecture.colliders when it
  // starts, and the forest appends its trunk colliders to that same list. Built
  // first, every tree in the estate was walk-through.
  progress(0.58, 'planting the forest…');
  buildForest(scene);
  buildTrails(scene);
  await tick();

  progress(0.76, 'digging the tunnels…');
  buildUnderground(scene);
  await tick();

  progress(0.79, 'raising the old walls…');
  buildRuins(scene);
  await tick();

  // The only downloaded asset in the world. It is its own stage so the bar
  // moves while it arrives, and a failure leaves the estate standing without
  // it rather than refusing to load (see landmarks.js).
  progress(0.82, 'drawing the old well…');
  await loadLandmarks(scene, (f) => progress(0.82 + f * 0.04, 'drawing the old well…'));
  await tick();

  // The modelled furniture is a 3 MB GLB of 26 Blender-built pieces. Loaded as
  // its own stage so the bar moves while it arrives, and non-fatal: if it is
  // missing, furnish() places what it can and the estate still stands.
  progress(0.84, 'carrying the furniture in…');
  await loadFurniture((f) => progress(0.84 + f * 0.04, 'carrying the furniture in…'));
  await tick();

  progress(0.89, 'dressing the rooms…');
  furnish(scene, LEVELS);
  // The searchable cabinets go in after the static furniture, so their
  // placement search can see every collider already on the floor.
  buildCabinets(scene, LEVELS);
  buildApparatus(scene, LEVELS);
  // Hideable armoires and the iron bed go in last: their placement scan needs
  // every collider and every static piece already on the floor.
  buildHiding(scene, LEVELS);
  await tick();

  player.setWorld(architecture.colliders, props.colliders);

  progress(0.92, 'starting the car…');
  // The car is driven by the opening sequence: it starts on the road south of
  // the estate with Del at the wheel, and the opening parks it on the shoulder
  // with its colliders once it has broken down.
  const car = buildCar();
  scene.add(car);
  await tick();

  progress(0.97, 'warming the lamps…');
  if (renderer.compileAsync) {
    try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('[boot] compile:', e.message); }
  }
  await tick();

  const audio = new Ambience();
  const game = new Game({ scene, player, camera, renderer, audio });
  const opener = new Opening({ scene, car, player, camera, game, audio });
  game.opener = opener;
  // Expose the game object for debugging (only in development)
  if (location.search.includes('__debug__') || location.hostname === 'localhost') {
    window.__game = game;
  }

  // The game begins in the driver's seat. A probe may still pin an exact
  // spawn; the opening places the real player itself.
  opener.prepare();
  if (params.has('probe') || params.has('x')) {
    const spawnX = params.has('x') ? parseFloat(params.get('x')) : -53.4;
    const spawnZ = params.has('z') ? parseFloat(params.get('z')) : 27.2;
    const spawnY = params.has('y') ? parseFloat(params.get('y')) : null;
    player.teleport(spawnX, spawnZ, spawnY);
    player.yaw = params.has('yaw') ? parseFloat(params.get('yaw')) : -2.55;
    player.pitch = params.has('pitch') ? parseFloat(params.get('pitch')) : -0.03;
  }
  player.onStep = (surface, running, y) => audio.step(surface, running, y);

  progress(1, 'the road is waiting');
  if (msg) msg.textContent = 'the road is waiting';
  if (go) {
    go.textContent = 'START THE ENGINE';
    go.style.display = 'block';
    go.focus();
  }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    audio.start();
    document.getElementById('boot').classList.add('hidden');
    player.dom.focus();
    player.dom.requestPointerLock?.();
    // the real game starts at the wheel; a probe jumps to the road after the
    // breakdown so the existing walk tests exercise the same world state
    if (params.has('probe')) opener.skipToWalk();
    else opener.begin();
  };
  go?.addEventListener('click', start);
  addEventListener('keydown', (e) => {
    if (!started && (e.code === 'Enter' || e.code === 'Space')) start();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now();
  let fps = 60;
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, raw);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    // one uniform per wind material; the foliage sway is entirely on the GPU
    updateWind(now * 0.001);
    // The opening car integrates in fixed steps, so it is handed the real
    // elapsed time (bounded) instead of the player clamp: a slow machine
    // then drives at the correct speed rather than in slow motion.
    opener.update(Math.min(0.6, raw));
    player.update(dt, game);
    game.update(dt);
    game._fps = fps;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  booted = true;
  window.__silid = {
    ready: true,
    THREE,
    scene, camera, renderer, player, game, opener, architecture, props,
    resident: game.resident,
    levels: LEVELS,
    landmarks,
    ruins,
    furniture,
    cabinets,
    apparatus,
    hiding,
    wind: () => windStats(),
    setWind: (a) => setWindAmplitude(a),
    spawnAt(x, z, y = null, yaw = 0, pitch = 0) {
      // a probe that teleports mid-opening first settles into the post-
      // breakdown world state, so it never fights the car for the camera
      if (!opener.walkPhase()) opener.skipToWalk(false);
      player.teleport(x, z, y);
      player.yaw = yaw;
      player.pitch = pitch;
      player.syncCamera();
    },
    floorAt: (x, z, y) => floorHeightAt(x, z, y),
    // car probes for the opening tests
    carGroundY: () => heightAt(car.position.x, car.position.z),
    carBodyY: () => car.position.y,
    roadCentreAt: (z) => roadCenter(z),
    carDoorAngle: () => car.doorL.rotation.y,
    carBonnetOpen: () => car.bonnet.rotation.x < -0.1,
    terrainAt: (x, z) => heightAt(x, z),
    metrics() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        fps: Math.round(fps),
        objects: scene.children.length,
        doors: architecture.doors.length,
        props: props.count,
        missingDoors: architecture.missingDoors,
        colliders: architecture.colliders.length,
      };
    },
  };

  // probe camera / placement: start the world but keep the player free so a
  // probe can teleport, walk and measure without a pointer lock
  if (params.has('probe')) start();
}

boot().catch((e) => {
  console.error(e);
  progress(1, '');
  if (msg) msg.innerHTML = '<span class="err">the house did not load: ' + (e?.message || e) + '</span>';
  if (go) {
    go.textContent = 'RELOAD';
    go.style.display = 'block';
    go.addEventListener('click', () => location.reload());
  }
});

