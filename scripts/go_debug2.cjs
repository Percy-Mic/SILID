const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  const out = await p.evaluate(() => {
    const w = window.__silid, g = w.game;
    const step = (s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) g.update(1 / 60); };
    g.trialsLeft = 1; g.state.trials = 1; g.invulnT = 0; g.updateTrialsHud();
    w.hitPlayer();
    step(2.2);
    const o = document.getElementById('gameover');
    const btn = document.getElementById('go-restart');
    const r = btn?.getBoundingClientRect();
    return {
      state: { gameOver: g.state.gameOver, caughtActive: g.caughtActive, deathT: g.deathT },
      overlay: !!o,
      buttons: o ? o.querySelectorAll('button').length : 0,
      html: o ? o.outerHTML.slice(0, 400) : null,
      btn: !!btn,
      rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
      bodyChildren: [...document.body.children].map((e) => e.id || e.tagName),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  try { await p.click('#go-restart', { timeout: 8000 }); console.log('PW CLICK ok'); }
  catch (e) { console.log('PW CLICK fail:', e.message.split('
')[0]); }
  const click = await p.evaluate(() => {
    const btn = document.getElementById('go-restart');
    if (!btn) return 'no button';
    btn.click();
    return { gameOver: window.__silid.game.state.gameOver, trials: window.__silid.trials(), overlay: !!document.getElementById('gameover') };
  });
  console.log('DIRECT CLICK', JSON.stringify(click));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
