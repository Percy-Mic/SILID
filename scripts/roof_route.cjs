// Drive the whole roof route through the controller and the game's own
// interact() by stepping the exact code the frame loop runs
// (player.update(dt, game); game.update(dt)) without rendering. The software
// renderer here draws about one frame a second, which turns an 11.6 m climb
// into a two-minute wall-clock wait; stepping removes the renderer from the
// test while keeping every metre, collider, door and prompt real.
//
// The ladder is at x = -13.3, the service door at x = -12.2, both on a 3 m
// landing.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/';
const OUT = 'reports/roof';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.goto(URL + '?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });

  const out = await page.evaluate(() => {
    const w = window.__silid;
    const p = w.player;
    const g = w.game;
    const log = [];
    const shots = {};
    // A real frame of the running scene, read back from the live canvas at the
    // exact spot the route reached - no posing, no teleporting for the camera.
    const grab = (name) => {
      w.renderer.render(w.scene, w.camera);
      shots[name] = w.renderer.domElement.toDataURL('image/png');
    };
    const push = (tag, extra) => log.push(tag + ' ' + JSON.stringify(Object.assign({
      foot: +p.footY.toFixed(2), x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2),
      climbing: p.isClimbing, prompt: g.promptTarget ? g.promptTarget.kind : null,
    }, extra || {})));
    const step = (n, keys) => {
      for (let i = 0; i < n; i++) {
        Object.assign(p.keys, { KeyW: false, KeyS: false, KeyA: false, KeyD: false }, keys || {});
        p.update(1 / 60, g);
        g.update(1 / 60);
      }
      Object.assign(p.keys, { KeyW: false, KeyS: false, KeyA: false, KeyD: false });
    };
    const stepUntil = (fn, max, keys) => {
      for (let i = 0; i < max; i++) {
        step(1, keys);
        if (fn()) return i + 1;
      }
      return -1;
    };

    // 1. four metres out there is no prompt; at the foot there is
    w.spawnAt(-13.3, -15.6, 0, Math.PI, 0);
    p.enabled = true;
    step(3);
    push('far');
    w.spawnAt(-13.3, -12.35, 0, Math.PI, 0);
    p.pitch = 0.30; p.syncCamera();
    step(3);
    push('base');
    grab('01_ladder_base');

    // 2. E starts the climb; a second E must not restart it
    g.interact();
    const t0 = p.climbTarget;
    g.interact();
    push('climb_start', {
      sameTarget: p.climbTarget === t0,
      faceYaw: +p.yaw.toFixed(2),
    });

    // 3. W up: count the frames so "instant" movement would be obvious
    // a mid-climb frame, before the top: the rungs under the boots and the
    // yard falling away below
    step(120, { KeyW: true });
    const savedYaw = p.yaw, savedPitch = p.pitch;
    p.yaw = 0; p.pitch = -0.42; p.syncCamera();
    grab('02_climb_mid');
    p.yaw = savedYaw; p.pitch = savedPitch; p.syncCamera();
    const upFrames = 120 + stepUntil(() => !p.isClimbing, 2000, { KeyW: true });
    step(2);
    push('top', { upFrames, simSeconds: +(upFrames / 60).toFixed(2) });
    grab('03_landing_door');

    // 4. the door, dead ahead of the dismount
    g.interact();
    const door = w.architecture.doors.find((d) => d.y > 11 && Math.abs((d.at ?? 0) + 12.2) < 0.4);
    step(30);
    push('door', { open: door?.open, at: door?.at, w: door?.w });
    grab('04_door_open');

    // 5. through the doorway onto the roof deck
    p.yaw = Math.PI; p.pitch = 0; p.syncCamera();
    const inFrames = stepUntil(() => p.pos.z > -10.4, 300, { KeyW: true });
    push('deck', { inFrames, floorY: +p.footY.toFixed(2) });
    // looked back at the open doorway from a step inside the deck
    p.pos.set(-12.2, p.footY + p.height, -9.5);
    p.yaw = Math.PI; p.pitch = -0.04; p.syncCamera();
    grab('05_deck_from_door');

    // the landing's outer rail: walking straight at the drop must stop on the
    // deck, not step off it
    p.pos.set(-13.6, p.footY + p.height, -11.9);
    p.yaw = 0; p.pitch = 0; p.syncCamera();
    step(60, { KeyW: true });
    push('outer_rail');

    // and it is a landing, not a trampoline: stepping back inside still works
    p.pos.set(-12.2, p.footY + p.height, -10.4);
    p.yaw = 0; p.pitch = 0; p.syncCamera();
    step(2);

    // 6. turn round, walk back to the landing
    p.yaw = 0; p.syncCamera();
    const backFrames = stepUntil(() => p.pos.z < -11.55, 300, { KeyW: true });
    push('back', { backFrames });

    // 7. face the ladder, climb back down
    p.yaw = Math.atan2(1.1, -0.28); p.pitch = 0; p.syncCamera();
    step(2);
    push('aim_ladder');
    grab('06_top_of_ladder');
    g.interact();
    push('down_start', { sameGround: +p.footY.toFixed(2) });
    const downFrames = stepUntil(() => !p.isClimbing, 2000, { KeyS: true });
    step(2);
    push('bottom', { downFrames, simSeconds: +(downFrames / 60).toFixed(2) });
    p.yaw = Math.PI; p.pitch = 0.55; p.syncCamera();
    grab('07_ground_again');

    return { log, shots };
  });

  for (const line of out.log) console.log(line);
  for (const [name, uri] of Object.entries(out.shots)) {
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(uri.split(',')[1], 'base64'));
  }
  fs.writeFileSync(`${OUT}/route.json`, JSON.stringify({ route: out.log, errors: errs.slice(0, 6) }, null, 2));
  console.log('errors', JSON.stringify(errs.slice(0, 4)));
  await browser.close();
})();
