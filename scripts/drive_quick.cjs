const { chromium } = require('playwright');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:5333/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 120000 });
  console.log('ready in', Date.now() - t0, 'ms');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__silid.opener.phase === 'driving', null, { timeout: 20000 });
  const s = () => p.evaluate(() => {
    const o = window.__silid.opener;
    return { ph: o.phase, sp: +o.speed.toFixed(2), tr: +o.travelled.toFixed(1), z: +o.z.toFixed(1), fps: +window.__silid.fps?.toFixed(1) };
  });
  console.log('start', await s());
  await p.keyboard.down('w');
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    const v = await s();
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(v));
    if (v.ph !== 'driving') break;
  }
  await p.keyboard.up('w');
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const v = await s();
    console.log('stop?', JSON.stringify(v));
    if (v.ph === 'stopped' || v.ph === 'walk') break;
  }
  console.log('errs', errs.slice(0, 5));
  await b.close();
})();
