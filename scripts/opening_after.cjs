const { chromium } = require('playwright');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await p.goto('http://127.0.0.1:5333/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__silid.opener.phase === 'driving', null, { timeout: 20000 });
  await p.keyboard.down('w');
  await p.waitForFunction(() => window.__silid.opener.phase !== 'driving', null, { timeout: 120000, polling: 500 });
  await p.keyboard.up('w');
  await p.waitForFunction(() => window.__silid.opener.phase === 'stopped', null, { timeout: 60000, polling: 500 });

  const stop = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    const rc = s.roadCentreAt(o.z);
    const gy = s.carGroundY();
    return {
      phase: o.phase, x: +o.x.toFixed(2), z: +o.z.toFixed(2),
      roadCentre: +rc.toFixed(2), offsetFromCentre: +(o.x - rc).toFixed(2),
      heading: +o.heading.toFixed(3),
      groundY: +gy.toFixed(3), bodyY: +s.carBodyY().toFixed(3),
      speed: o.speed,
      // any architecture box under the car?
      boxesUnder: s.architecture.colliders.filter(c => c && !c.disabled &&
        Math.hypot(((c.x1 + c.x2) / 2) - o.x, ((c.z1 + c.z2) / 2) - o.z) < 3.5).length,
      keys: document.getElementById('keys').textContent,
      objective: (document.getElementById('hint') || {}).textContent,
      headL: s.scene ? 0 : 0,
    };
  });
  console.log('STOP', JSON.stringify(stop));

  // exit
  await p.keyboard.press('e');
  await sleep(2200);
  const exit = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    return {
      phase: o.phase, enabled: s.player.enabled,
      dist: +Math.hypot(s.player.pos.x - o.x, s.player.pos.z - o.z).toFixed(2),
      footY: +s.player.footY.toFixed(2), ground: +s.terrainAt(s.player.pos.x, s.player.pos.z).toFixed(2),
      doorAngle: +s.carDoorAngle().toFixed(2),
      blockedHere: s.player.blocked(s.player.pos.x, s.player.pos.z),
      keys: document.getElementById('keys').textContent,
      flashlight: s.player.flash.visible,
      camY: +s.camera.position.y.toFixed(2),
    };
  });
  console.log('EXIT', JSON.stringify(exit));

  // inspect: hood, ignition, boot
  const inspect = await p.evaluate(async () => {
    const s = window.__silid, o = s.opener;
    const out = {};
    const walkTo = (x, z, yaw) => { s.player.teleport(x, z); s.player.yaw = yaw; s.player.syncCamera(); };
    // bonnet (front of car is +local z at heading 0)
    walkTo(o.x + 2.0, o.z + 3.2, Math.PI * 0.75);
    out.hoodBefore = { flag: o.flags.hood, bonnet: s.carBonnetOpen() };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise(r => setTimeout(r, 900));
    out.hoodAfter = { flag: o.flags.hood, bonnet: s.carBonnetOpen() };
    // driver's door / ignition
    walkTo(o.x + 1.9, o.z - 0.2, Math.PI * 0.5);
    out.doorBefore = { restart: o.flags.restart };
    out.prompt = document.getElementById('prompt').textContent;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise(r => setTimeout(r, 900));
    out.doorAfter = { restart: o.flags.restart };
    // boot
    walkTo(o.x - 2.0, o.z - 3.2, -Math.PI * 0.25);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise(r => setTimeout(r, 900));
    out.boot = o.flags.boot;
    return out;
  });
  console.log('INSPECT', JSON.stringify(inspect));

  const final = await p.evaluate(() => ({
    hint: document.getElementById('hint').textContent,
    msg: document.getElementById('msg').textContent,
    phase: window.__silid.opener.phase,
    fps: +(window.__silid.game?._fps || 0).toFixed(1),
  }));
  console.log('FINAL', JSON.stringify(final));
  console.log('ERRORS', errs.slice(0, 4));
  await p.screenshot({ path: 'reports/opening/after_exit.png' }).catch(() => {});
  await b.close();
})();
