// END-TO-END: the real opening, in the real game, in a real browser.
//
// Boots WITHOUT ?probe so START runs the opening for real, then:
//   A  the player begins at the wheel, camera inside the cabin
//   B  W drives the car north along the road (it actually moves)
//   C  the fault fires on distance, the car coasts onto the west shoulder
//      and stops off the carriageway, roughly straight, on flat ground
//   D  E opens the door and hands the player back to the walker beside the
//      car, with four solid car colliders and the walk objective set
//   E  hood / ignition / trunk interactions each answer
//   F  the car body blocks the walker; no page errors at any point
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  await p.goto('http://127.0.0.1:5333/');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });

  const out = {};
  const snap = () => p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    return {
      phase: o.phase,
      playerEnabled: s.player.enabled,
      car: { x: +o.x.toFixed(2), z: +o.z.toFixed(2), heading: +o.heading.toFixed(3), speed: +o.speed.toFixed(2) },
      cam: { x: +s.camera.position.x.toFixed(2), y: +s.camera.position.y.toFixed(2), z: +s.camera.position.z.toFixed(2) },
      hint: document.getElementById('hint').textContent,
      msg: document.getElementById('msg').textContent,
      keys: document.getElementById('keys').textContent,
      carColliders: s.architecture.colliders.filter((c) => c.kind === 'car').length,
      treeColliders: s.architecture.colliders.filter((c) => c.kind === 'tree').length,
    };
  });

  // ---- A: START, seated at the wheel ---------------------------------------
  // Enter is a bound START path (main.js binds Enter/Space); Playwright's
  // click actionability check stalls on software-rendered frame rates.
  await p.keyboard.press('Enter');
  await sleep(900);
  out.A = await snap();
  out.A.cameraInsideCabin = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    const d = Math.hypot(s.camera.position.x - o.x, s.camera.position.z - o.z);
    return { horizontalOffset: +d.toFixed(2), eyeYAboveGround: +(s.camera.position.y - s.carGroundY()).toFixed(2) };
  });

  // ---- B: drive north until the fault fires --------------------------------
  // The car sim is fixed-step, so even at ~1 fps of software rendering it
  // covers the road; we poll the phase instead of trusting wall time.
  out.B_headingBefore = (await snap()).car.heading;
  await p.keyboard.down('a');
  await sleep(1500);
  await p.keyboard.up('a');
  out.B_headingAfterSteer = (await snap()).car.heading;
  await p.keyboard.down('w');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const ph = await p.evaluate(() => window.__silid.opener.phase);
    if (ph !== 'driving') break;
    await sleep(500);
  }
  await p.keyboard.up('w');
  out.B = await snap();

  // ---- C: the coast and the stop ------------------------------------------
  const t1 = Date.now();
  while (Date.now() - t1 < 60000) {
    const ph = await p.evaluate(() => window.__silid.opener.phase);
    if (ph === 'stopped' || ph === 'exiting' || ph === 'walk') break;
    await sleep(400);
  }
  out.C = await snap();
  out.C.physics = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    const cx = s.terrainAt(o.x, o.z);          // ground under the car
    const roadX = s.roadCentreAt(o.z);
    return {
      groundUnderCar: +cx.toFixed(3),
      carBodyY: +s.carBodyY().toFixed(3),
      offsetFromRoadCentre: +(o.x - roadX).toFixed(2),
      offCarriageway: Math.abs(o.x - roadX) > 3.4,
      headingDeg: +((o.heading * 180) / Math.PI).toFixed(1),
      speed: +o.speed.toFixed(2),
    };
  });

  // ---- D: get out ----------------------------------------------------------
  await p.keyboard.press('e');
  await sleep(1400);
  out.D = await snap();
  out.D.exit = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    return {
      distPlayerToCar: +Math.hypot(s.player.pos.x - o.x, s.player.pos.z - o.z).toFixed(2),
      doorOpen: +s.carDoorAngle().toFixed(2),
      footOnGround: +(s.player.footY - s.terrainAt(s.player.pos.x, s.player.pos.z)).toFixed(3),
      colliders: s.architecture.colliders.filter((c) => c.kind === 'car').length,
      torchBackOn: s.player.flash.visible === s.player.flashlightOn,
    };
  });

  // ---- E: roadside inspections ---------------------------------------------
  const facePoint = async (lx, lz) => {
    await p.evaluate(([dx, dz]) => {
      const s = window.__silid, o = s.opener;
      const c = Math.cos(o.heading), sn = Math.sin(o.heading);
      const wx = o.x + dx * c + dz * sn, wz = o.z - dx * sn + dz * c;
      const px = wx + 2.0, pz = wz + 0.6;            // stand back and to the side
      const yaw = Math.atan2(-(wx - px), -(wz - pz));
      window.__silid.spawnAt(px, pz, null, yaw, -0.15);
    }, [lx, lz]);
    await sleep(300);
    await p.keyboard.press('e');
    await sleep(500);
    return p.evaluate(() => document.getElementById('msg').textContent);
  };
  out.E = {};
  out.E.hood = await facePoint(0.3, 2.6);
  out.E.ignition = await facePoint(1.0, -0.1);
  out.E.trunk = await facePoint(0, -2.5);
  out.E.bonnetOpen = await p.evaluate(() => window.__silid.carBonnetOpen());

  // ---- F: the body is solid, and nothing errored ---------------------------
  out.F = await p.evaluate(() => {
    const s = window.__silid, o = s.opener;
    return {
      // just inside the driver's door the body wall stops you; three metres
      // clear of the car is open road
      blockedInsideWall: s.player.blocked(o.x + 0.75, o.z),
      blockedBesideCar: s.player.blocked(o.x + 3.5, o.z),
      hint: document.getElementById('hint').textContent,
    };
  });
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
