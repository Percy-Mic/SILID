const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:5333/?probe=1');
  await p.waitForFunction(() => window.__silid?.ready, null, { timeout: 180000 });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const w = window.__silid;
    const g = w.game;
    const counts = {};
    w.scene.traverse((o) => { if (/^Resident/.test(o.name)) counts[o.name] = (counts[o.name] || 0) + 1; });
    return {
      trials: w.trials(),
      hud: document.getElementById('trials')?.innerHTML,
      residentState: w.resident.state,
      residentVisible: w.resident.group.visible,
      arm: !!w.resident.arm,
      traps: w.traps.list.length,
      gameOver: g.state.gameOver,
      residentGroups: counts,
      metrics: w.metrics(),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('ERRORS', JSON.stringify(errs, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
