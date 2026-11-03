const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.evaluate(() => { const w = window.__silid; w.game.trialsLeft = 1; w.game.invulnT = 0; w.game.state.trials = 1; w.hitPlayer(); w.game.update(2.0); });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const b2 = document.getElementById('go-restart').getBoundingClientRect();
    return [b2.x + b2.width / 2, b2.y + b2.height / 2];
  });
  await p.mouse.click(r[0], r[1]);
  await p.waitForTimeout(400);
  console.log(JSON.stringify(await p.evaluate(() => ({
    trials: window.__silid.trials(),
    over: window.__silid.game.state.gameOver,
    overlay: !!document.getElementById('gameover'),
    hud: document.querySelectorAll('#trials i.on').length,
    residentGroups: (() => { let n = 0; window.__silid.scene.traverse((o) => { if (o.name === 'Resident') n++; }); return n; })(),
  }))));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
