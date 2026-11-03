/**
 * Static scan of the phone interface wiring.
 *
 * The phone is no longer a DOM card: the interface is drawn into a canvas whose
 * texture is assigned to the PhoneGlass of the supplied GLB, and taps are
 * resolved by raycasting that mesh. This checks the pieces that make that work,
 * and — just as important — that the old overlay did not come back.
 *
 * Usage: node scripts/scan_apps.cjs
 */

const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8').replace(/\r/g, '');
const ui = read('../src/ui/PhoneUI.js');
const game = read('../src/game/game.js');
const player = read('../src/player/player.js');

const checks = [
  // the display exists and is a texture, not a layer
  { label: 'PhoneUI module exists', test: () => ui.includes('export class PhoneScreen') },
  { label: 'screen canvas is 512 x 1024', test: () => ui.includes('SCREEN_W = 512') && ui.includes('SCREEN_H = 1024') },
  { label: 'canvas becomes a canvas texture', test: () => ui.includes('new THREE.CanvasTexture(this.canvas)') },
  { label: 'game imports the screen', test: () => game.includes("from '../ui/PhoneUI.js'") },
  { label: 'glass is re-textured on the model', test: () => game.includes('attachPhoneScreen') && game.includes("m.name.indexOf('PhoneGlass')") },
  { label: 'map and emissive share the canvas', test: () => game.includes('m.map = this.phoneScreen.texture') && game.includes('m.emissiveMap = this.phoneScreen.texture') },

  // the six apps
  { label: 'app grid lists messages', test: () => ui.includes("id: 'messages'") },
  { label: 'app grid lists calendar', test: () => ui.includes("id: 'calendar'") },
  { label: 'app grid lists gallery', test: () => ui.includes("id: 'gallery'") },
  { label: 'app grid lists camera', test: () => ui.includes("id: 'camera'") },
  { label: 'app grid lists settings', test: () => ui.includes("id: 'settings'") },
  { label: 'app grid lists pong', test: () => ui.includes("id: 'pong'") },
  { label: 'every app has a draw pass', test: () => ['drawMessages', 'drawCalendar', 'drawGallery', 'drawCamera', 'drawSettings', 'drawPong'].every((f) => ui.includes(f + '()')) },
  { label: 'openApp routes all six', test: () => /openApp\(id\)[\s\S]{0,400}this\.view = id/.test(ui) },
  { label: 'every app can go back home', test: () => ui.includes('goHome()') && ui.includes("this.hit('back'") },

  // the lock screen and the content that matters
  { label: 'passcode matches the story', test: () => ui.includes("PHONE_PASSCODE = '6294'") },
  { label: 'passcode has an on-screen hint', test: () => ui.includes('6 · 2 · 94') },
  { label: 'Pico message present', test: () => ui.includes('My phone died hours ago') },
  { label: 'calendar events present', test: () => ui.includes('Engine dies on Tuluyan road') },

  // input: taps on the real glass
  { label: 'hit regions are built while drawing', test: () => ui.includes('this.hits.length = 0') && ui.includes('this.hits.push') },
  { label: 'tap resolves a hit', test: () => /tap\(x, y\)[\s\S]{0,300}this\.hits/.test(ui) },
  { label: 'pointer ray goes through the glass UVs', test: () => game.includes('intersectObject(child, false)') && game.includes('PhoneScreen.pixelFromUV') },
  { label: 'UV mapping follows flipY', test: () => ui.includes('flipY = true') && ui.includes('y: (1 - v) * SCREEN_H') },
  { label: 'pointerdown is bound', test: () => game.includes("addEventListener('pointerdown', (e) => this.onPhoneDown(e))") },

  // opening is a physical move and frees the cursor
  { label: 'raising moves the model', test: () => game.includes('RAISED_PHONE_POSE') && game.includes('poseHeldPhone(this.heldPhoneGroup, this._phoneRaise)') },
  { label: 'opening releases pointer lock', test: () => /openPhone\(\)[\s\S]{0,500}exitPointerLock/.test(game) },
  { label: 'click does not re-lock while the phone is up', test: () => player.includes('this.allowLock !== false') && game.includes('this.player.allowLock = false') },

  // the card is gone, and stays gone
  { label: 'old overlay builder is gone', test: () => !game.includes('buildPhoneOverlay') },
  { label: 'no phone DOM ids remain in game.js', test: () => !game.includes('#phoneAppLayer') && !game.includes('phoneEl(') },
  { label: 'no phone CSS card in index.html', test: () => !read('../index.html').includes('phoneOverlay') },
];

let failed = false;
for (const c of checks) {
  const ok = c.test();
  console.log((ok ? 'OK  ' : 'FAIL') + '  ' + c.label);
  if (!ok) failed = true;
}

console.log('\nVerdict:', failed ? 'Some phone-interface checks failed' : 'Phone interface is on the model and wired');
process.exit(failed ? 1 : 0);
