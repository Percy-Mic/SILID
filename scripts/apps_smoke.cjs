/**
 * Fast phone smoke test.
 *
 * Loads the game, takes the phone through the normal prompt, holds it up, keys
 * the passcode on the screen canvas and puts it away. No screenshots, so it
 * finishes quickly even on a software GL context.
 *
 * Usage: node scripts/apps_smoke.cjs
 */
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const PASS = ['6', '2', '9', '4']; // PHONE_PASSCODE in src/ui/PhoneUI.js

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 90000, polling: 200 });

  const out = await page.evaluate((pass) => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    w.spawnAt(spot.x, spot.z + 1.15, spot.surfaceY - 0.02, 0, 0);
    w.game.update(0.05);
    w.game.interact();
    w.game.openPhone();
    const s = w.game.phoneScreen;
    for (const k of pass) s.pressKey(k);
    s.draw();   // the game loop would do this on the next frame
    const homeTiles = s.hits.filter((h) => h.id.startsWith('app-')).map((h) => h.id);
    const state = { unlocked: s.unlocked, view: s.view, homeTiles };
    s.openApp('messages');
    state.messages = s.view;
    s.goHome();
    w.game.closePhone();
    state.closed = !s.isOpen;
    return state;
  }, PASS);

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close().catch(() => {});
  if (!out.unlocked || out.homeTiles.length !== 6 || !out.closed || errors.length) process.exit(1);
})();
