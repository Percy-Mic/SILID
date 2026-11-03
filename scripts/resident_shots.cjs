// Photographs of the Resident, its weapon, a trap, the trial HUD and the game
// over screen, taken from the running game at 127.0.0.1:5333.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'reports/resident';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(600);

  // a low fill so the figure reads in a night room without changing the scene
  await p.evaluate(() => {
    const w = window.__silid, T = w.THREE;
    const hemi = new T.HemisphereLight(0x9fb0c4, 0x2a2620, 1.5);
    hemi.name = 'PROBE_Hemi';
    w.scene.add(hemi);
    w.renderer.toneMappingExposure = 1.25;
  });

  const shot = async (name, setup) => {
    await p.evaluate(setup);
    await p.waitForTimeout(350);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(png.data, 'base64'));
    console.log('shot', name);
  };

  // --- the figure, three quarter, weapon in hand -------------------------
  await shot('resident_close', () => {
    const w = window.__silid, r = w.resident;
    const px = 0.4, pz = 2.9;
    r.pos.set(1.0, 0, -0.2); r.footY = 0; r.level = 'GF';
    const yaw = Math.atan2(-(r.pos.x - px), -(r.pos.z - pz));
    w.spawnAt(px, pz, 0, yaw, 0.06);
    r.state = 'observe'; r.observeT = 0; r.yaw = Math.atan2(-(px - r.pos.x), -(pz - r.pos.z));
    r.armed = true; r.group.visible = true;
    r.arm.rotation.set(0.06, 0, -0.10);
    r.group.position.set(r.pos.x, 0, r.pos.z);
    r.group.rotation.y = r.yaw + Math.PI;
    w.player.flashlightOn = true; w.player.flash.visible = true;
    w.game._lightTimer = 0;
  });

  // --- mid-swing, the tell ------------------------------------------------
  await shot('resident_swing', () => {
    const w = window.__silid, r = w.resident;
    r.attackPhase = 'windup'; r.attackT = 0.36;
    r.arm.rotation.set(0.06 + 0.78, 0, -0.26);
    w.game.update(0.001);
  });

  // --- the trap on the boards --------------------------------------------
  await shot('trap_floor', () => {
    const w = window.__silid, r = w.resident;
    r.state = 'patrol'; r.attackPhase = 'idle'; r.pos.set(6, 0, 6); r.footY = 4.2;
    r.group.visible = false;
    w.traps.clear();
    const t = w.traps.place({ x: 0.2, z: 2.4, y: 0.002, yaw: 0.12, level: 'GF' })
      || w.traps.place({ x: 2.5, z: 5.5, y: 0.002, yaw: 0.12, level: 'GF' });
    const x = t ? t.x : 2.5, z = t ? t.z : 5.5;
    w.spawnAt(x + 0.55, z + 1.75, 0, Math.atan2(0.55, 1.75), -0.62);
    w.player.flashlightOn = true; w.player.flash.visible = true;
    w.game._lightTimer = 0;
  });

  // --- the trial marks, two spent ----------------------------------------
  await shot('hud_trials', () => {
    const w = window.__silid;
    w.game.trialsLeft = 3; w.game.state.trials = 3; w.game.updateTrialsHud();
    w.spawnAt(0, 8.0, 0, Math.PI, 0.02);
    w.game.say('It was faster than you.', 6000);
  });

  // --- the game over screen ----------------------------------------------
  await shot('game_over', () => {
    const w = window.__silid, g = w.game;
    g.trialsLeft = 0; g.state.trials = 0; g.updateTrialsHud();
    g.gameOver(null);
  });

  console.log('ERRORS ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
