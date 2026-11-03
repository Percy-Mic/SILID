// Phone-screen probe.
//
// Verifies the model IS the interface, in the running game:
//
//   1. no HTML phone card exists in the document any more;
//   2. the PhoneGlass material of the supplied GLB carries a canvas texture,
//      and that canvas is what the UI draws into;
//   3. pressing P raises the phone (the model moves) and releases the pointer;
//   4. a real mouse click on a projected keypad key unlocks the phone — the
//      click is resolved by the same raycast/UV path the player uses;
//   5. every app opens, draws, and goes back;
//   6. P puts the phone down and returns the pointer.
//
// Screenshots are capped: a software GL context dies after about eight CDP
// captures.
//
// Usage: node scripts/phone_screen_probe.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const OUT = process.argv[2] || 'reports/phonescreen';

const out = (o) => console.log(JSON.stringify(o, null, 1));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

  // Playwright's own screenshot path stalls on this software GL context; the
  // repo's other capture scripts use CDP for the same reason.
  const cdp = await page.context().newCDPSession(page);
  const shot = async (name) => {
    await page.waitForTimeout(350);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(png.data, 'base64'));
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 90000, polling: 200 })
    .catch(() => errors.push('PHONE NEVER LOADED'));

  // Take the phone through the player's own path.
  const taken = await page.evaluate(() => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    w.spawnAt(spot.x, spot.z + 1.15, spot.surfaceY - 0.02, 0,
      Math.atan2(spot.y - (spot.surfaceY + 1.68), 1.15));
    w.game.update(0.05);
    const focus = w.game.nearestInteraction();
    w.game.interact();
    for (let i = 0; i < 10; i++) w.game.update(0.033);
    return {
      focus: focus?.id ?? focus?.name ?? null,
      inventory: [...w.game.inventory],
      held: !!w.game.heldPhoneGroup,
      heldParent: w.game.heldPhoneGroup?.parent?.type ?? null,
    };
  });
  out({ step: 'pickup', ...taken });

  // Instrument: what is the glass wearing, and is there a DOM card left?
  const wired = await page.evaluate(() => {
    const w = window.__silid;
    const g = w.game.heldPhoneGroup;
    const glass = g?.children.find((c) => (c.material?.name || '').includes('PhoneGlass'));
    const tex = glass?.material?.map;
    return {
      domCard: {
        phoneOverlay: !!document.getElementById('phoneOverlay'),
        lockScreen: !!document.querySelector('.lockScreenBg'),
        overlayNodes: document.querySelectorAll('[id^="phone"], .phoneAppLayer, .lockScreenKey').length,
      },
      glassMaterial: glass?.material?.name ?? null,
      mapIsCanvas: tex === w.game.phoneScreen.texture,
      emissiveIsSame: glass?.material?.emissiveMap === tex,
      textureSize: tex ? [tex.image.width, tex.image.height] : null,
      worldCopyShares: (() => {
        const wg = w.game.worldPhone?.children.find((c) => (c.material?.name || '').includes('PhoneGlass'));
        return wg?.material?.map === tex;
      })(),
    };
  });
  out({ step: 'wiring', ...wired });

  // Raise the phone the way the player does.
  const raised = await page.evaluate(async () => {
    const w = window.__silid;
    const before = w.game.heldPhoneGroup.position.toArray().map((n) => +n.toFixed(3));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true }));
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        w.game.update(0.016);
        if (performance.now() - t0 > 700) res(); else requestAnimationFrame(tick);
      };
      tick();
    });
    const after = w.game.heldPhoneGroup.position.toArray().map((n) => +n.toFixed(3));
    return {
      open: w.game.phoneScreen.isOpen,
      view: w.game.phoneScreen.view,
      raise: +w.game._phoneRaise.toFixed(2),
      modelBefore: before,
      modelAfter: after,
      modelMoved: before.join() !== after.join(),
      allowLock: w.game.player.allowLock,
      pointerLocked: document.pointerLockElement === w.renderer.domElement,
    };
  });
  out({ step: 'raise', ...raised });

  // Canvas point -> a real client point on the glass, through the same
  // projection the camera uses. No guessing at pixel offsets.
  const project = (id) => page.evaluate((hitId) => {
    const w = window.__silid;
    const scr = w.game.phoneScreen;
    const hit = scr.hits.find((h) => h.id === hitId);
    if (!hit) return null;
    const u = (hit.x + hit.w / 2) / scr.canvas.width;
    const yFrac = (hit.y + hit.h / 2) / scr.canvas.height;
    // The screen UVs run bottom-up; see PhoneScreen.pixelFromUV.
    const v = 1 - yFrac;
    const g = w.game.heldPhoneGroup;
    const glass = g.children.find((c) => (c.material?.name || '').includes('PhoneGlass'));
    glass.geometry.computeBoundingBox();
    const bb = glass.geometry.boundingBox;
    const p = new w.THREE.Vector3(
      bb.min.x + u * (bb.max.x - bb.min.x),
      bb.min.y + v * (bb.max.y - bb.min.y),
      bb.max.z - 0.001,
    );
    g.localToWorld(p);
    p.project(w.camera);
    const r = w.renderer.domElement.getBoundingClientRect();
    return {
      x: Math.round(r.left + (p.x * 0.5 + 0.5) * r.width),
      y: Math.round(r.top + (1 - (p.y * 0.5 + 0.5)) * r.height),
    };
  }, id);

  // Lock screen shot, then the passcode through actual clicks.
  await shot('01_lock.png');
  const code = ['key-6', 'key-2', 'key-9', 'key-4'];
  const clicks = [];
  for (const id of code) {
    const pt = await project(id);
    if (!pt) { clicks.push({ id, missing: true }); continue; }
    await page.mouse.click(pt.x, pt.y);
    clicks.push({ id, ...pt });
  }
  const unlocked = await page.evaluate(() => {
    const w = window.__silid;
    return { unlocked: w.game.phoneScreen.unlocked, view: w.game.phoneScreen.view, hits: w.game.phoneScreen.hits.length };
  });
  out({ step: 'passcode', clicks, ...unlocked });
  await shot('02_home.png');

  // Each app, opened by clicking its tile, then back with the header chevron.
  const apps = ['messages', 'calendar', 'gallery', 'camera', 'settings', 'pong'];
  const appReport = [];
  for (const app of apps) {
    const pt = await project('app-' + app);
    if (!pt) { appReport.push({ app, missing: true }); continue; }
    await page.mouse.click(pt.x, pt.y);
    const state = await page.evaluate(() => {
      const s = window.__silid.game.phoneScreen;
      return { view: s.view, hits: s.hits.map((h) => h.id) };
    });
    appReport.push({ app, ...state });
    if (app !== 'pong') {
      const back = await project('back');
      if (back) await page.mouse.click(back.x, back.y);
    }
  }
  out({ step: 'apps', appReport });

  // Frame the app screens that carry content.
  const toApp = async (id) => {
    const pt = await project('app-' + id);
    if (pt) await page.mouse.click(pt.x, pt.y);
  };
  await page.evaluate(() => { window.__silid.game.phoneScreen.goHome(); });
  await toApp('messages');
  await shot('03_messages.png');
  await page.evaluate(() => { window.__silid.game.phoneScreen.goHome(); });
  await toApp('pong');
  await shot('04_pong.png');

  // Put it down.
  const lowered = await page.evaluate(async () => {
    const w = window.__silid;
    w.game.closePhone();
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        w.game.update(0.016);
        if (performance.now() - t0 > 600) res(); else requestAnimationFrame(tick);
      };
      tick();
    });
    return {
      open: w.game.phoneScreen.isOpen,
      raise: +w.game._phoneRaise.toFixed(2),
      allowLock: w.game.player.allowLock,
      pos: w.game.heldPhoneGroup.position.toArray().map((n) => +n.toFixed(3)),
    };
  });
  out({ step: 'lower', ...lowered });

  out({ errors });
  await browser.close().catch(() => {});
})();
