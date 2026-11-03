const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => { const w = window.__silid; w.game.trialsLeft = 1; w.game.invulnT = 0; w.game.state.trials = 1; w.hitPlayer(); w.game.update(2.0); });
  await p.waitForTimeout(1200);
  const probe = await p.evaluate(() => {
    const btn = document.getElementById('go-restart');
    const r = btn.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { rect: [r.x, r.y, r.width, r.height], at: at && (at.id || at.tagName), opacity: getComputedStyle(document.getElementById('gameover')).opacity };
  });
  console.log('PROBE', JSON.stringify(probe));
  try {
    await p.click('#go-restart', { timeout: 6000 });
    console.log('CLICK ok', JSON.stringify(await p.evaluate(() => ({ trials: window.__silid.trials(), over: window.__silid.game.state.gameOver }))));
  } catch (e) {
    console.log('CLICK fail', e.message.split('\n').slice(0, 6).join(' | '));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
