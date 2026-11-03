// END-TO-END PROBE — the basement-to-forest underground route.
//
// This does not teleport along the tunnel and call it tested. It drives the
// real Player: the same blocked() collision, the same floorHeightAt() step
// resolution, the same extraFloors, at the same 60 Hz the game runs at. If a
// tread is 20 cm too tall the walker refuses the step and the probe reports a
// stall; if a wall is in the wrong place it reports the wall.
//
// The legs are ordered around the real door, not around convenience: the
// cistern door at x=56.2 is closed until E is pressed on it, so the walker is
// stopped at 55.95, the door is operated through the game's own interaction
// system, and only then does the walker pass through it. A probe that walked
// the whole list first and opened doors afterwards would be testing a door it
// had already been blocked by.
//
//   node scripts/underground_probe.cjs            (needs the dev server up)
//   SILID_URL=http://127.0.0.1:5199/?probe=1 node scripts/underground_probe.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5199/?probe=1';
const OUT = 'reports/underground';

// Basement junction -> the cistern door. These legs are walked before the door
// is touched, so they must all succeed with the door still shut.
const DOWN_A = [
  [11.0, 6.0], [14.2, 6.0], [18.0, 6.0], [23.0, 6.0], [28.0, 6.0], [32.0, 6.0],
  [36.0, 6.0], [40.0, 6.0], [44.0, 6.0], [47.3, 6.0], [48.4, 6.0],
  [50.5, 6.0], [53.0, 6.0], [55.3, 6.0],
];

// The door opened: through the vitrified vault, across the court, up the exit
// stair, and out onto the forest floor.
const DOWN_B = [
  [57.6, 6.0], [60.2, 6.0], [60.8, 7.9], [62.6, 7.9], [64.5, 7.9],
  [66.5, 7.9], [68.2, 7.9], [70.5, 7.9],
];

// The way home is the same list, walked backwards: out of the forest, down the
// stair, across the court, back through the door it just opened, and up the
// basement corridor to the junction it started on.
const BACK = DOWN_A.concat([[55.95, 6.0]]).concat(DOWN_B).slice().reverse();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL);
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(({ DOWN_A, DOWN_B, BACK }) => {
    const w = window.__silid;
    const p = w.player, g = w.game;
    // Start in the basement junction, on the basement's own floor. spawnAt also
    // settles the opening sequence into its walking state, which is what makes
    // the player controllable at all.
    w.spawnAt(11.0, 6.0, -3.4, -Math.PI / 2, 0);
    p.enabled = true;
    p.footY = -3.4;
    p.pos.y = p.footY + 1.62;
    const logs = [];
    const trace = [];

    // --- the walker -------------------------------------------------------
    // One second of simulated time is 60 update() calls. The walker aims with
    // the game's own yaw convention and holds W; it never sets pos directly,
    // so every metre here went through collision and floor resolution.
    const walkTo = (tx, tz, maxT = 45) => {
      const dt = 1 / 60;
      let t = 0, best = Infinity, stall = 0, yMin = Infinity, yMax = -Infinity;
      let jump = 0, lastY = p.footY, stuck = null;
      while (t < maxT) {
        const dx = tx - p.pos.x, dz = tz - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.42) break;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = 0;
        p.keys.KeyW = true;
        p.update(dt, g);
        const y = p.footY;
        jump = Math.max(jump, Math.abs(y - lastY));
        lastY = y;
        yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
        t += dt;
        if (d < best - 0.02) { best = d; stall = 0; } else stall += dt;
        if (stall > 2.5) {
          // Report the actual collider that stopped the body rather than just
          // "it stalled": the record names the wall, door or prop.
          const f = p.forward();
          // probe the way the body was actually trying to go, not always +x:
          // a wall behind the walker says nothing about the wall in front of it
          const nx = p.pos.x + Math.sign(f.x) * 0.06, nz = p.pos.z + Math.sign(f.z) * 0.06;
          const R = p.radius, b0 = p.footY + 0.05, b1 = p.footY + 1.65;
          const blockers = [];
          for (const c of p.colliders) {
            if (!c || c.disabled) continue;
            if (c.y0 !== undefined && (b1 < c.y0 || b0 > c.y1)) continue;
            if (c.kind === 'rail' && Math.abs(p.footY - c.baseY) > 0.6) continue;
            const ddx = c.x2 - c.x1, ddz = c.z2 - c.z1;
            const ll = ddx * ddx + ddz * ddz;
            let tt = ll ? ((nx - c.x1) * ddx + (nz - c.z1) * ddz) / ll : 0;
            tt = Math.max(0, Math.min(1, tt));
            const px2 = c.x1 + tt * ddx, pz2 = c.z1 + tt * ddz;
            if (Math.hypot(nx - px2, nz - pz2) < R) blockers.push(['arch', c.kind, c.x1, c.z1, c.x2, c.z2, c.y0, c.y1]);
          }
          for (const bx2 of p.boxes) {
            if (bx2.y0 !== undefined && (b1 < bx2.y0 || b0 > bx2.y1)) continue;
            if (nx > bx2.x1 - R && nx < bx2.x2 + R && nz > bx2.z1 - R && nz < bx2.z2 + R) blockers.push(['box', bx2.x1, bx2.z1, bx2.x2, bx2.z2, bx2.y0, bx2.y1]);
          }
          // If the step is refused the reason is the floor, not a wall: report
          // what floorHeightAt() offered for the next step as well.
          const near = p.colliders
            .filter((c) => c && !c.disabled && Math.hypot((c.x1 + c.x2) / 2 - nx, (c.z1 + c.z2) / 2 - nz) < 1.6)
            .map((c) => [c.kind, +(c.x1).toFixed(2), +(c.z1).toFixed(2), +(c.x2).toFixed(2), +(c.z2).toFixed(2), c.y0, c.y1, !!c.disabled]);
          stuck = {
            vel: +p.vel.x.toFixed(2) + ',' + +p.vel.z.toFixed(2),
            fwd: +f.x.toFixed(2) + ',' + +f.z.toFixed(2),
            keyW: !!p.keys.KeyW, enabled: p.enabled, climbing: !!p.isClimbing,
            nextBlocked: p.blocked(nx, nz), footY: +p.footY.toFixed(2), blockers, near,
            aim: [(tx - p.pos.x).toFixed(2), (tz - p.pos.z).toFixed(2)].join(','),
          };
          break;
        }
      }
      p.keys.KeyW = false;
      const reached = Math.hypot(tx - p.pos.x, tz - p.pos.z) < 0.7;
      return {
        to: [tx, tz], reached, wedged: !reached && stall > 2.5,
        x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +p.footY.toFixed(2),
        yMin: +yMin.toFixed(2), yMax: +yMax.toFixed(2), jump: +jump.toFixed(3),
        surface: p.surface, t: +t.toFixed(1), stuck,
      };
    };

    const leg = (list, dirName) => {
      const rows = [];
      for (const [x, z] of list) {
        const r = walkTo(x, z);
        r.dir = dirName;
        rows.push(r);
        trace.push(r);
        if (!r.reached) break;
      }
      return rows;
    };

    // --- leg 1: basement junction down to the closed service door ---------
    const first = walkTo(14.2, 6.0);
    first.dir = 'down'; trace.push(first);
    const atDoor = g.nearestInteraction();
    const basementDoor = atDoor && atDoor.kind;
    g.interact();
    // A leaf that has just been opened is still shut for a few frames, and its
    // collider only comes out of the doorway once the leaf has swung past a
    // quarter radian. Standing there for a third of a second is what a player
    // does; skipping it would test a door that is opening rather than open.
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    const baseDoorOpen = !!(atDoor && atDoor.door && atDoor.door.open);
    const baseDoorClear = !!(atDoor && atDoor.door && atDoor.door.collider && atDoor.door.collider.disabled);
    logs.push('basement east door prompt=' + !!atDoor + ' kind=' + basementDoor
      + ' open=' + baseDoorOpen + ' colliderCleared=' + baseDoorClear);

    const downA = leg(DOWN_A.slice(2), 'down');

    // --- the service door, operated through the interaction system --------
    const beforeDoor = walkTo(55.95, 6.0);
    beforeDoor.dir = 'down'; trace.push(beforeDoor);
    // The HUD prompt is composed in game.update(), not stored on the
    // interactable, so the walk loop alone leaves the element holding whatever
    // it said at spawn. One update pass is what a frame of standing here does.
    g.update(1 / 60);
    const tgt = g.promptTarget || g.nearestInteraction();
    const doorInfo = {
      kind: tgt && tgt.kind,
      // The prompt text is composed by game.js in its HUD pass, not stored on the
      // interactable, so the probe reads the element the player actually reads.
      label: (() => {
        const el = document.getElementById('prompt');
        return el && el.classList.contains('on') ? el.textContent.trim() : null;
      })(),
      dist: tgt ? +Math.hypot(tgt.x - p.pos.x, tgt.y - (p.footY + 1.62), tgt.z - p.pos.z).toFixed(2) : null,
      openBefore: !!(tgt && tgt.door && tgt.door.open),
      promptedWhileClosed: !!tgt,
    };
    g.interact();
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    const door = w.props.interactables.find((i) => i.id === 'cistern_door');
    doorInfo.openAfter = !!(door && door.door.open);
    doorInfo.colliderDisabled = !!(door && door.door.collider && door.door.collider.disabled);

    // --- leg 2: through the opening, the vault, the court, the exit stair --
    const through = walkTo(57.6, 6.0);
    through.dir = 'down'; trace.push(through);
    const downB = leg(DOWN_B.slice(1), 'down');

    // p.surface is the walker's own verdict: 'dirt' means floorHeightAt found no
    // built floor and the forest terrain is carrying the body. This is the
    // emergence test, done with the game's own signal rather than a tally.
    const out = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +p.footY.toFixed(2), surface: p.surface };

    // --- leg 3: back, forest to the basement ------------------------------
    const backLegs = leg(BACK, 'back');
    const end = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +p.footY.toFixed(2) };

    // --- standing room: is the centreline clear of colliders? -------------
    // blocked() is height-banded, so each point is tested at the floor the
    // body would actually be standing on there.
    const clear = [];
    for (let x = 16.5; x <= 47.5; x += 1.0) clear.push([x, 6, -3.4]);
    for (let x = 48.5; x <= 55.5; x += 0.75) clear.push([x, 6, -3.4 + ((x - 49) / 7.4) * 1.96]);
    for (let x = 62.5; x <= 66.5; x += 0.5) clear.push([x, 7.9, -1.44 + ((x - 61.8) / 5.2) * 2.29]);
    for (const [x, z] of [[58, 4.2], [58, 7.6], [60.5, 4.2], [60.5, 7.6], [59, 6]]) clear.push([x, z, -1.44]);
    const blockedPoints = clear
      .map(([x, z, fy]) => { const y0 = p.footY; p.footY = fy; const b = p.blocked(x, z); p.footY = y0; return b ? [x, z] : null; })
      .filter(Boolean);

    return {
      downA, downB, back: backLegs, doorInfo, out, end,
      blockedPoints, trace, logs,
    };
  }, { DOWN_A, DOWN_B, BACK });

  await page.waitForTimeout(400);
  const metrics = await page.evaluate(() => (window.__silid.metrics ? window.__silid.metrics() : null));
  fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify({ ...result, metrics, errors }, null, 1));

  const bad = result.trace.filter((r) => !r.reached);
  console.log('--- legs that did not arrive ---');
  console.log(bad.length ? JSON.stringify(bad, null, 1) : '(none)');
  console.log('--- service door ---');
  console.log(JSON.stringify(result.doorInfo, null, 1));
  console.log('--- emerged at ---', JSON.stringify(result.out));
  console.log('--- returned to ---', JSON.stringify(result.end));
  console.log('--- blocked points on the walked centreline ---', JSON.stringify(result.blockedPoints));
  console.log('--- biggest single-frame footY change ---',
    Math.max(...result.trace.map((r) => r.jump)).toFixed(3));
  console.log('--- console/page errors ---', errors.length ? errors.slice(0, 8) : '(none)');
  console.log('--- metrics ---', JSON.stringify(metrics));
  console.log('wrote', `${OUT}/probe.json`);
  await browser.close();
  if (bad.length || result.blockedPoints.length) process.exitCode = 2;
})().catch((e) => { console.error(e); process.exit(1); });
