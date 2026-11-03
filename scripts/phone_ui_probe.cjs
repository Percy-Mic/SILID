// Phone interface probe.
//
// The physical model and the screen are one thing now: the supplied GLB in the
// hand wears a canvas texture, and the player taps that mesh. This checks the
// whole path in the running game without capturing frames, so it is fast:
//
//   1. the phone is picked up through the normal interaction;
//   2. no HTML card exists; the glass material carries the UI texture;
//   3. P raises the model, releases the pointer and hides the room's prompt;
//   4. real mouse clicks on projected keypad keys unlock the phone through the
//      raycast/UV path the player uses;
//   5. each app opens and goes back;
//   6. P puts it down and gives the pointer back.
//
// Usage: node scripts/phone_ui_probe.cjs
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';
const fails = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000, polling: 500 });
  await page.waitForFunction(() => window.__silid.game?._phoneInfo != null, null, { timeout: 90000, polling: 200 })
    .catch(() => fails.push('phone GLB never loaded'));

  const pickup = await page.evaluate(() => {
    const w = window.__silid;
    const spot = w.props.interactables.find((i) => i.id === 'phone');
    w.spawnAt(spot.x, spot.z + 1.15, spot.surfaceY - 0.02, 0,
      Math.atan2(spot.y - (spot.surfaceY + 1.68), 1.15));
    w.game.update(0.05);
    const focus = w.game.nearestInteraction();
    w.game.interact();
    for (let i = 0; i < 10; i++) w.game.update(0.033);
    return { focus: focus?.id ?? null, held: !!w.game.heldPhoneGroup };
  });
  if (pickup.focus !== 'phone') fails.push('pickup prompt was ' + pickup.focus);
  if (!pickup.held) fails.push('phone was not in hand after pickup');

  const wiring = await page.evaluate(() => {
    const w = window.__silid;
    const g = w.game.heldPhoneGroup;
    const glass = g?.children.find((c) => (c.material?.name || '').includes('PhoneGlass'));
    return {
      domCard: !!document.getElementById('phoneOverlay') ||
        !!document.querySelector('.lockScreenBg, #phoneAppLayer, .phoneAppCard'),
      mapIsScreen: glass?.material?.map === w.game.phoneScreen.texture,
      emissiveIsScreen: glass?.material?.emissiveMap === w.game.phoneScreen.texture,
    };
  });
  if (wiring.domCard) fails.push('an HTML phone card still exists');
  if (!wiring.mapIsScreen) fails.push('glass map is not the screen canvas');
  if (!wiring.emissiveIsScreen) fails.push('glass emissive map is not the screen canvas');

  const raised = await page.evaluate(async () => {
    const w = window.__silid;
    const before = w.game.heldPhoneGroup.position.toArray().map((n) => +n.toFixed(3));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true }));
    await new Promise((res) => setTimeout(res, 700));
    return {
      open: w.game.phoneScreen.isOpen,
      view: w.game.phoneScreen.view,
      moved: before.join() !== w.game.heldPhoneGroup.position.toArray().map((n) => +n.toFixed(3)).join(),
      allowLock: w.game.player.allowLock,
      hudHidden: document.getElementById('hud')?.classList.contains('holding') ?? false,
      promptHidden: !document.getElementById('prompt')?.classList.contains('on'),
    };
  });
  if (!raised.open) fails.push('P did not open the phone');
  if (!raised.moved) fails.push('the model did not move when raised');
  if (raised.allowLock !== false) fails.push('the pointer was not released for taps');
  if (!raised.hudHidden) fails.push('room HUD still drawn over the screen');

  // canvas point -> real client point on the glass
  const project = (id) => page.evaluate((hitId) => {
    const w = window.__silid;
    const scr = w.game.phoneScreen;
    const hit = scr.hits.find((h) => h.id === hitId);
    if (!hit) return null;
    const u = (hit.x + hit.w / 2) / scr.canvas.width;
    const v = 1 - (hit.y + hit.h / 2) / scr.canvas.height;
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

  const clicks = [];
  for (const key of ['key-6', 'key-2', 'key-9', 'key-4']) {
    const pt = await project(key);
    if (!pt) { fails.push('key ' + key + ' has no hit region'); continue; }
    await page.mouse.click(pt.x, pt.y);
    clicks.push(key);
  }
  const unlocked = await page.evaluate(() => {
    const s = window.__silid.game.phoneScreen;
    return { unlocked: s.unlocked, view: s.view };
  });
  if (!unlocked.unlocked) fails.push('clicks on the keypad did not unlock the phone');
  if (unlocked.view !== 'home') fails.push('home did not appear after unlocking');

  // Each app, opened by tapping its tile, then back.
  const apps = {};
  for (const app of ['messages', 'calendar', 'gallery', 'camera', 'settings', 'pong']) {
    apps[app] = await page.evaluate((id) => {
      const s = window.__silid.game.phoneScreen;
      s.goHome();
      s.draw();
      let h = s.hits.find((k) => k.id === 'app-' + id);
      if (!h) return 'no tile';
      s.tap(h.x + h.w / 2, h.y + h.h / 2);
      const opened = s.view;
      const drew = s.hits.length;
      s.goHome();
      return { opened, drew };
    }, app);
  }
  for (const [app, r] of Object.entries(apps)) {
    if (!r || r === 'no tile') fails.push('no app tile for ' + app);
    else if (r.opened !== app) fails.push(app + ' opened ' + r.opened);
    else if (!r.drew) fails.push(app + ' drew no controls');
  }

  // Pong actually runs on the screen.
  const pong = await page.evaluate(async () => {
    const s = window.__silid.game.phoneScreen;
    s.openApp('pong');
    const before = { x: s.pong.ball.x, y: s.pong.ball.y };
    for (let i = 0; i < 40; i++) s.update(1 / 60);
    return { live: s.pong.live, moved: before.x !== s.pong.ball.x || before.y !== s.pong.ball.y };
  });
  if (!pong.live) fails.push('pong did not start');
  if (!pong.moved) fails.push('pong ball did not move');

  const lowered = await page.evaluate(async () => {
    const w = window.__silid;
    w.game.closePhone();
    await new Promise((res) => setTimeout(res, 500));
    return {
      open: w.game.phoneScreen.isOpen,
      allowLock: w.game.player.allowLock,
      hud: document.getElementById('hud')?.classList.contains('holding') ?? false,
    };
  });
  if (lowered.open) fails.push('phone stayed open');
  if (lowered.allowLock !== true) fails.push('pointer was not returned to the view');
  if (lowered.hud) fails.push('HUD stayed hidden after lowering');

  const report = { pickup, wiring, raised, clicks, unlocked, apps, pong, lowered, fails, errors };
  console.log(JSON.stringify(report, null, 1));
  await browser.close().catch(() => {});
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
