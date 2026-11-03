const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => {
    const w = window.__silid;
    window.__clicks = [];
    document.addEventListener('click', (e) => {
      window.__clicks.push((e.target.id || e.target.tagName) + '@' + e.clientX + ',' + e.clientY);
    }, true);
    w.game.trialsLeft = 1; w.game.invulnT = 0; w.game.state.trials = 1;
    w.hitPlayer(); w.game.update(2.0);
  });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const b2 = document.getElementById('go-restart').getBoundingClientRect();
    return { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2, at: document.elementFromPoint(b2.x + b2.width / 2, b2.y + b2.height / 2)?.id };
  });
  await p.mouse.move(r.x, r.y);
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => ({ clicks: window.__clicks, trials: window.__silid.trials(), over: window.__silid.game.state.gameOver }))));
  // now dispatch a DOM click event on the button itself
  console.log(JSON.stringify(await p.evaluate(() => {
    const btn = document.getElementById('go-restart');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1, clientY: 1 }));
    return { trials: window.__silid.trials(), over: window.__silid.game.state.gameOver, clicks: window.__clicks };
  })));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
