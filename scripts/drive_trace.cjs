const { chromium } = require('playwright');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 400)));
  await p.goto('http://127.0.0.1:5333/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__silid.opener.phase === 'driving', null, { timeout: 20000 });
  await p.evaluate(() => {
    const o = window.__silid.opener;
    o._trace = [];
    const orig = o.update.bind(o);
    o.update = (dt) => {
      o._trace.push([+dt.toFixed(3), o.phase, +o.speed.toFixed(2), +o.x.toFixed(2), +o.z.toFixed(2),
        +o.heading.toFixed(3), +o.steer.toFixed(2), +o.failT.toFixed(2), +o._acc.toFixed(2)]);
      if (o._trace.length > 30) o._trace.shift();
      orig(dt);
    };
  });
  await p.keyboard.down('w');
  for (let i = 0; i < 30; i++) {
    await sleep(1500);
    const st = await p.evaluate(() => {
      const o = window.__silid.opener;
      return { ph: o.phase, finite: Number.isFinite(o.speed) && Number.isFinite(o.x),
        trace: o._trace.slice(-6), fps: window.__silid.game?._fps };
    });
    console.log(JSON.stringify(st));
    if (!st.finite || st.ph !== 'driving') break;
  }
  await p.keyboard.up('w');
  await b.close();
})();
