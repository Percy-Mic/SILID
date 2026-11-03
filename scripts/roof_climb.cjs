// Climb the service ladder with the real controller: E on the interactable, W
// to climb, E on the service door, walk onto the roof deck, turn round, climb
// back down. Every wait is on player/door state, not on the clock: the software
// renderer here draws a few frames a second, so an 11.6 m climb takes the better
// part of a minute even though the sim time is ~4.5 s.
//
// The ladder sits at x = -13.3 and the service door at x = -12.2, both on a
// 3 m landing. They are offset on purpose: centred, the ladder's own prompt
// beat the door's at the top of the climb.
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/';
const OUT = 'reports/roof';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAD_X = -13.3;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.goto(URL + '?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });

  const state = () => page.evaluate(() => {
    const w = window.__silid;
    const p = w.player;
    const t = w.game.promptTarget;
    return {
      foot: +p.footY.toFixed(2), pos: p.pos.toArray().map((v) => +v.toFixed(2)),
      climbing: p.isClimbing, prompt: t ? t.kind + ':' + (t.dir || '') : null,
    };
  });
  const until = async (fn, ms = 220000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await state();
      if (fn(s)) return s;
      await sleep(600);
    }
    return null;
  };
  const face = (dx, dz) => page.evaluate(({ dx, dz }) => {
    const p = window.__silid.player;
    p.yaw = Math.atan2(-dx, -dz); p.pitch = 0; p.syncCamera();
  }, { dx, dz });
  // the software renderer needs a long while to produce one composited frame
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 150000 });
  const wait = (ms) => sleep(ms);

  const result = { legs: {}, errors: errs };
  const leg = (k, v) => { result.legs[k] = v; console.log(k, JSON.stringify(v)); };

  // 1. approach: no prompt from four metres out, prompt at the foot
  await page.evaluate((x) => { const w = window.__silid; w.spawnAt(x, -15.6, 0, Math.PI, 0); w.player.enabled = true; }, LAD_X);
  await wait(1200);
  leg('far', await state());
  await page.evaluate((x) => {
    const w = window.__silid;
    w.spawnAt(x, -12.35, 0, Math.PI, 0);
  }, LAD_X);
  await wait(1500);
  leg('base', await state());
  await shot('01_ladder_base');
  if (!result.legs.base.prompt) { console.log('no prompt at the ladder base'); }

  // 2. E, then W up; release W the moment the climb ends so the body does not
  //    walk on into the closed door
  await page.keyboard.press('e');
  const started = await until((s) => s.climbing, 20000);
  leg('started', started);
  await page.keyboard.down('w');
  const topped = await until((s) => !s.climbing, 240000);
  await page.keyboard.up('w');
  leg('top', topped);
  await wait(800);
  await shot('02_landing');

  // 3. the door, dead ahead of the dismount
  leg('aim_door', await state());
  await page.keyboard.press('e');
  const doorState = () => page.evaluate(() => {
    const d = window.__silid.architecture.doors.find((x) => x.y > 11 && Math.abs((x.at ?? 0) + 12.2) < 0.4);
    return d ? { open: d.open, at: d.at, w: d.w, y: d.y } : null;
  });
  // the leaf swings on the game clock; its collider goes once it is past a
  // quarter radian, so the walk-through below waits for the state, not a timer
  let doorNow = null;
  for (let i = 0; i < 40; i++) {
    doorNow = await doorState();
    if (doorNow?.open) break;
    await wait(250);
  }
  leg('door', doorNow);
  await wait(1500);
  await shot('03_door_open');

  // 4. through onto the roof deck
  await face(0, 1);
  await page.keyboard.down('w');
  const deck = await until((s) => s.pos[2] > -10.1, 90000);
  await page.keyboard.up('w');
  leg('deck', deck);
  await wait(600);
  await shot('04_deck');

  // 5. turn round, walk back to the landing
  await face(0, -1);
  await page.keyboard.down('w');
  const back = await until((s) => s.pos[2] < -11.5, 90000);
  await page.keyboard.up('w');
  leg('back', back);

  // 6. face the ladder, climb down
  await page.evaluate((x) => {
    const p = window.__silid.player;
    p.pos.x = x + 1.1; p.pos.z = -11.75; p.syncCamera();
  }, LAD_X);
  await face(-1.1, 0.33);
  await wait(1200);
  leg('aim_ladder', await state());
  await shot('05_top_of_ladder');
  await page.keyboard.press('e');
  const down = await until((s) => s.climbing, 20000);
  leg('down_start', down);
  if (down) {
    await page.keyboard.down('s');
    const bottom = await until((s) => !s.climbing, 240000);
    await page.keyboard.up('s');
    leg('bottom', bottom);
  }
  await wait(800);
  await shot('06_ground_again');

  result.ok = !!(result.legs.base?.prompt && result.legs.top && result.legs.door?.open
    && result.legs.deck && result.legs.bottom);
  console.log('errors', JSON.stringify(errs.slice(0, 6)));
  fs.writeFileSync(`${OUT}/climb.json`, JSON.stringify(result, null, 2));
  await browser.close();
})();
