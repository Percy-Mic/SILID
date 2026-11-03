// Real keyboard events, real frame loop: E on the ladder, hold W, confirm the
// climb starts and the feet rise. Short on purpose - the software renderer runs
// at about a frame a second, so this only has to prove the input path, while
// roof_route.cjs proves the whole route and every metre of it.
const { chromium } = require('playwright');

const URL = process.env.SILID_URL || 'http://127.0.0.1:5333/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.goto(URL + '?probe=1');
  await page.waitForFunction(() => window.__silid?.ready, null, { timeout: 300000 });

  const st = () => page.evaluate(() => {
    const p = window.__silid.player;
    const t = window.__silid.game.promptTarget;
    return { foot: +p.footY.toFixed(2), climbing: p.isClimbing, prompt: t ? t.kind : null };
  });

  await page.evaluate(() => {
    const w = window.__silid;
    w.spawnAt(-13.3, -12.35, 0, Math.PI, 0.3);
    w.player.enabled = true;
  });
  await sleep(2500);
  console.log('base', JSON.stringify(await st()));
  await page.keyboard.press('e');
  await sleep(1500);
  console.log('after E', JSON.stringify(await st()));
  await page.keyboard.down('w');
  await sleep(12000);
  const mid = await st();
  await page.keyboard.up('w');
  console.log('after 12s W', JSON.stringify(mid));
  console.log('errors', JSON.stringify(errs.slice(0, 4)));
  // This renderer draws well under one frame a second and dt is clamped to
  // 0.05 s, so twelve seconds of wall time is a fraction of a second of sim
  // time. Any rise at all proves the keyboard path; the rate itself is proven
  // by the frame-stepped route probe (349 frames = 5.82 s of sim time for
  // 11.6 m, i.e. 2.0 m/s).
  console.log('verdict', mid.climbing && mid.foot > 0.05
    ? 'climb starts and rises on real key input'
    : 'FAILED: no rise');
  await browser.close();
})();
