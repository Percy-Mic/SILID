// STEALTH TEST — the live game, the real player, the real armoires.
//
// This is not a code inspection. It boots the Vite build with ?probe=1, finds
// the armoires the placement pass actually built, walks the interaction path
// to enter one, peeks, leaves, does the same under the iron bed, and then
// drives the Resident's real senses (sight blocked by a closed carcass, a
// peek exposed through the opening, a search that discovers the player).
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/?probe=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 220)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 220)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const s = window.__silid;
    const g = s.game;
    const pl = s.player;
    const r = s.resident;
    const res = { spots: [], errors: [...s.hiding.errors], checks: {} };

    const advance = (secs, dt = 0.033) => {
      for (let i = 0; i < Math.ceil(secs / dt); i++) {
        pl.update(dt, g);
        g.update(dt);
      }
    };
    const at = (x, z, levelY, yaw) => {
      pl.enabled = true;
      pl.teleport(x, z, levelY);
      pl.yaw = yaw;
      pl.pitch = 0;
      pl.syncCamera();
    };

    res.spots = s.hiding.spots.map((sp) => ({
      id: sp.id, type: sp.type, level: sp.level,
      x: +sp.x.toFixed(2), z: +sp.z.toFixed(2),
      eyeY: +sp.eyeY.toFixed(2), doors: sp.doors.length,
    }));

    const armoire = s.hiding.spots.find((sp) => sp.type === 'armoire' && sp.level === 'F2');
    if (!armoire) { res.checks.armoireFound = false; return res; }
    res.checks.armoireFound = true;
    res.checks.armoire = { id: armoire.id, x: armoire.x, z: armoire.z };

    // --- enter through the prompt, not by setting state -------------------
    at(armoire.out.x, armoire.out.z, armoire.levelY, armoire.outYaw + Math.PI);
    advance(0.1);
    const focused = g.nearestInteraction();
    res.checks.promptTarget = focused ? focused.kind + ':' + (focused.spot?.type || '') : null;
    g.interact();
    res.checks.modeAfterE = g.hiding.mode;
    advance(2.2);
    res.checks.modeEntered = g.hiding.mode;
    res.checks.cameraInside = {
      x: +pl.pos.x.toFixed(3), y: +pl.pos.y.toFixed(3), z: +pl.pos.z.toFixed(3),
    };
    res.checks.eyeExpected = +armoire.eyeY.toFixed(3);
    res.checks.playerDisabled = pl.enabled === false;
    res.checks.doorsClosedInside = armoire.doors.every((d) => Math.abs(d.hinge.rotation.y) < 0.02);
    res.checks.promptText = document.getElementById('prompt')?.textContent || '';

    // --- peek: real leaf angle, camera leans to the gap -------------------
    g.interact();
    advance(0.45);
    res.checks.peekMode = g.hiding.mode;
    res.checks.peekAngles = armoire.doors.map((d) => +d.hinge.rotation.y.toFixed(3));
    res.checks.peekEye = { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2) };
    res.checks.peekPrompt = document.getElementById('prompt')?.textContent || '';

    // --- leave with Q ------------------------------------------------------
    const x0 = pl.pos.x, z0 = pl.pos.z;
    g.leaveHiding();
    advance(1.0);
    res.checks.modeLeft = g.hiding.mode;
    res.checks.enabledAfterExit = pl.enabled;
    res.checks.exitMoved = +Math.hypot(pl.pos.x - x0, pl.pos.z - z0).toFixed(2);
    res.checks.exitOnFloor = +pl.footY.toFixed(2);
    res.checks.exitBlocked = pl.blocked(pl.pos.x, pl.pos.z);
    res.checks.doorsClosedAfter = armoire.doors.every((d) => Math.abs(d.hinge.rotation.y) < 0.03);

    // --- under the iron bed ------------------------------------------------
    const bed = s.hiding.spots.find((sp) => sp.type === 'underbed');
    res.checks.underbedFound = !!bed;
    if (bed) {
      at(bed.out.x, bed.out.z, bed.levelY, bed.outYaw + Math.PI);
      advance(0.1);
      const t2 = g.nearestInteraction();
      res.checks.underbedPrompt = t2 ? t2.kind + ':' + t2.spot.type : null;
      g.interact();
      advance(1.1);
      res.checks.underbedMode = g.hiding.mode;
      res.checks.underbedEyeY = +pl.pos.y.toFixed(3);
      res.checks.underbedExpectedY = +bed.eyeY.toFixed(3);
      g.interact();
      advance(0.45);
      res.checks.underbedPeek = g.hiding.mode;
      res.checks.underbedPeekY = +pl.pos.y.toFixed(2);
      g.leaveHiding();
      advance(1.0);
      res.checks.underbedLeft = g.hiding.mode;
      res.checks.underbedExitBlocked = pl.blocked(pl.pos.x, pl.pos.z);
    }

    // --- the Resident's senses --------------------------------------------
    r.armed = true;
    r.state = 'patrol';
    r.level = 'F2';
    r.pos.set(-4, 0, 0);
    r.footY = 4.2;
    r.yaw = Math.PI / 2;          // faces -x, down the upper landing
    g.hiding.mode = 'out'; g.hiding.spot = null; g.hiding.peek = false;
    at(-8, 0, 4.2, -Math.PI / 2);
    r.senseT = 0;
    r.sense(0);
    res.checks.seenInCorridor = r.canSee;
    res.checks.stateOnSight = r.state;

    // closed armoire blocks sight
    r.pos.set(armoire.out.x, 0, armoire.out.z);
    r.footY = armoire.levelY;
    r.yaw = armoire.outYaw + Math.PI;   // look at the closed front
    g.hiding.mode = 'hidden';
    g.hiding.spot = armoire;
    g.hiding.peek = false;
    pl.enabled = false;
    pl.pos.set(armoire.inside.x, armoire.eyeY, armoire.inside.z);
    pl.footY = armoire.levelY;
    r.sense(0);
    res.checks.hiddenNotSeen = r.canSee === false;

    // peeking is exposed
    g.hiding.peek = true;
    g.hiding.mode = 'peek';
    r.sense(0);
    res.checks.peekSeen = r.canSee;

    // a search that finds a player who peeked
    g.hiding.mode = 'hidden';
    g.hiding.peek = false;
    g.hiding.peekedAt = performance.now() / 1000;
    g.hiding.noise = 1;
    r.checked.clear();
    r.searchT = 5;
    r.pos.set(armoire.out.x, armoire.levelY, armoire.out.z);
    r.footY = armoire.levelY;
    r.level = armoire.level;
    r.searchSpots(0.1);
    res.checks.discovered = g.caughtActive === true;

    // put the world back after the catch timer would fire
    return res;
  });

  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
